---
title: "vLLM Hybrid HiSparse 源码实现分析：KV Cache 内存管理深入拆解"
date: 2026-09-19 23:59:00
tags: [vLLM, HiSparse, KV Cache, 稀疏注意力, KV 卸载, 源码分析, 推理优化, MLA]
categories: [技术]
---

> **版本说明**：Hybrid HiSparse 在 [vLLM 官方博客（2026-09-08）](https://vllm.ai/blog/2026-09-08-glm53-part1-hybrid-sparse-offloading)发布时尚在 `hisparse-glm` 分支（基准 commit `e8ef1e07bd`），现已合入 `v0.30.0rc2`（commit `fa6ff0606`）。本文基于 **v0.30.0rc2** 的源码（[GitHub tag 链接](https://github.com/vllm-project/vllm/tree/v0.30.0rc2)），文内文件路径均可对照该 tag 阅读；它与分析的基准 commit 是同一路径的两个快照，细节以 rc2 为准。
>
> **相关阅读**：本博同日翻译的 [GLM 5.3 优化（一）：vLLM 的 Hybrid HiSparse 混合稀疏卸载](/2026-09-19-glm53-part1-hybrid-sparse-offloading/)（官方博客）与 [vLLM HiSparse 本地 KV 卸载架构（附 SGLang 对照）](/2026-09-19-vllm-hisparse-local-kv-offload-architecture/)（官方设计文档）。本文是对照源码的第三篇：前两篇讲"是什么、为什么"，这篇讲"代码里到底怎么做的"。

## 0. 代码地图

| 模块 | 文件 | 职责 |
| --- | --- | --- |
| 布局构建 | `vllm/v1/hisparse/layout.py` | 把 sparse-MLA 组拆成 source/resident/hot/indexer 四种组，规划 GPU 共享池与主机池 |
| 调度侧协调器 | `vllm/v1/hisparse/coordinator.py`（778 行） | 驻留状态机、spill 事务、主机页发布、GPU 副本复用 |
| 缓存管理器 | `vllm/v1/core/single_type_kv_cache_manager.py:2219` 起 | `HiSparseSourceManager` / `HiSparseHotManager` / `HiSparseResidentManager` |
| Connector | `vllm/distributed/kv_transfer/kv_connector/v1/hisparse/connector.py` | scheduler/worker 元数据边界 |
| Worker 数据面 | `vllm/distributed/kv_transfer/kv_connector/v1/hisparse/worker.py`（928 行） | DMA 调度、行镜像、restore、失效传播 |
| Worker 热路径 | `vllm/v1/hisparse/runtime.py`（1291 行） | 热缓冲视图、GPU LRU、融合解析器调用 |
| CUDA kernel | `csrc/libtorch_stable/hisparse_kernels.cu`（1244 行） | 解析/搬运/失效三个 kernel |
| 绑定 | `vllm/v1/hisparse/binding.py` | 显存/块表/slot mapping 绑定到 attention 层 |
| Attention 集成 | `vllm/v1/attention/backends/mla/index_group.py`、`flashmla_sparse.py`、`vllm/model_executor/layers/attention/mla_attention.py` | top-k 逻辑位置→物理行号、KV 写入目标切换 |

## 1. 全景：一次倒置的层级结构

整个设计的核心是一句话，写在 `coordinator.py` 的类文档里：

> **GPU-resident pages are a write-back cache of the host tier.**

传统 KV 卸载里 CPU 是 GPU 的降级副本；HiSparse 把关系倒过来：**锁页主机内存是 sparse-MLA KV 的唯一真身（source of truth），GPU 上的驻留页只是它的写回缓存（write-back cache），热缓冲则是按行索引的另一层小缓存**。于是：

- 主机池按**块**管理（前缀缓存、P/D 导入、跨请求复用都在这一层）；
- GPU 驻留页按**页**租借、可整页归还（压力释放）；
- 热缓冲按**行**管理（indexer 选中的 top-K 行才有资格进来）。

三层共用**同一个 GPU 块池、同一块打包显存**，这是 "Hybrid" 的含义：无压力时一切驻留 GPU，压力来了逐页让出，decode 永不中断。

## 2. 内存布局：一个池、一块显存、一个主机池

### 2.1 组的拆分

`layout.py` 的 `create_hisparse_layout()` 把模型里原本一个 MLA 组拆成四类：

- **source 组**（`role=HISPARSE_SOURCE, host_resident=True`）：sparse-MLA 全部层的逻辑页，住在锁页主机内存，参与前缀缓存。它不持有数字型 GPU 池 ID——host 所有权无法伪装成 GPU 块号（设计文档"所有权"一节的落实）。
- **indexer 组**：普通 GPU cache 组，照常前缀缓存，HiSparse 完全不碰它。
- **resident 组 + hot 组**：成对创建。每个"热单元"（hot unit）由一个 index-group leader 层及其 follower 层组成（GLM 5.3 的 IndexShare 是 4 个 sparse-MLA 层共享 1 个 indexer 层，`layout.py` 按 `is_index_group_leader` 切分）。单元按"组合页大小 ≤ indexer 页大小"装箱成组，保证共享池的 `bytes_per_block` 一致。

### 2.2 关键点：resident 和 hot 是同一块显存的两个视图

这是官方博客"它们住在同一个 KV-cache 张量里"的代码证据。`binding.py` 里有一个硬断言：

```python
if (resident.cache.untyped_storage().data_ptr() != hot.cache.untyped_storage().data_ptr()
        or resident.cache.data_ptr() != hot.cache.data_ptr()
        or resident.cache.stride() != hot.cache.stride()):
    raise RuntimeError("HiSparse resident and hot layouts must match.")
```

即**每个 sparse-MLA 层的 resident 视图和 hot 视图指向完全相同的地址、相同的 stride**。这之所以不冲突，是因为 `_build_hisparse_kv_cache_tensors()` 里所有 resident/hot 组的 tensor offset 都是 0、都 overlay 在同一块 `size = bytes_per_block × num_blocks` 的 backing 上——**物理块号全局唯一，一个块要么被 resident manager 租走、要么被 hot manager（或 indexer 组）租走，永不共用**。所以"一个热缓冲页就是一个普通的 KV-cache 块"不是比喻，是字面事实：热缓冲占用的是共享池里的普通块，只是由 `HiSparseHotManager` 而不是 resident manager 持有租约。

### 2.3 GPU 池与主机池的定量关系

`get_hisparse_kv_cache_config()`：

- GPU 池：`num_blocks = available_memory // bytes_per_block`，启动日志形如 `"HiSparse HMA: 8.0 GiB host source (N blocks), 130.0 GiB shared GPU indexer/resident/hot pool (M blocks)"`。
- 主机池：`host_num_blocks = host_budget // host_block_stride`（`host_pool_gib` 按 DP 副本计，向下取整到完整主机块——与博客附录一致）。
- **容量规划的关键减法**：`get_hisparse_gpu_memory_usage()` 在估算"最大内存占用"时只统计 indexer 组和其他常规组，**刻意不算 sparse-MLA 驻留历史的满额**——因为它是可回收的。这就是并发上限能按"热缓冲 + indexer"而非"全长历史"计算的机制根源（`kv_cache_utils.py` 的 `_max_memory_usage_bytes_from_groups` 专门为 HiSparse 分叉）。

### 2.4 主机池：锁页、TP 共享、分段注册

`runtime.py`：

- **私有模式**：先 4KB 对齐再 `cudaHostRegister` 精确锁页，退出时用 `cudaHostUnregister` 确定性释放（`release_pinned_state()` 会打出 `"unpinned %.1f GiB of host pool in %.1fs"` 日志）。
- **共享模式**（TP>1 且 mp 后端等条件，`use_shared_hisparse_host_pool()`）：利用 MLA KV 在 TP 各 rank 完全相同的性质，整个 DP 副本内的 TP rank 共享一个 `SharedOffloadRegion` mmap——**rank 0 创建并写入，其余 rank 映射同一物理内存**。这就是博客"锁页主机池按 DP 副本分配、由其本地 TP rank 共享"的实现。
- **分段注册**：CUDA 批量拷贝拒绝跨相邻注册区的描述符，所以 `_hisparse_registration_ranges()` 把大池按 ≤256 GiB（`HOST_REGISTER_CHUNK_BYTES`）切块，且用数论方法（GCD + 模逆元找"块边界与 OS 页边界重合点"）保证**不切开任何 tensor 的任何主机块**。
- 启动时用 psutil 检查可用 RAM（95% 阈值），不够直接拒绝启动。

## 3. 块池新原语：`unpin_blocks`

整套驻留策略依赖 `BlockPool` 新增的一个原语：

```python
def unpin_blocks(self, blocks, on_reuse):
    """Release references to blocks that stay readable until reused.
    The blocks become last-resort eviction candidates ... they join the
    tail of the free queue and count as free. ``on_reuse`` fires when
    ``get_new_blocks`` hands a block out ..."""
```

语义：`ref_cnt -= 1`、块进 free 队列**尾部**、计入空闲数，但**块表里仍指向它、attention 仍读它**；注册的 `on_reuse` watcher 在块被真正再次分配时回调。这精确实现了博客说的"驻留块表里真实块与空占位并排存在"以及"释放的块可以被重新租约为热页"——一个请求 unpinned 的驻留页，物理块随时可能变成别的请求的热缓冲块，此时 watcher 触发 `_lose_page()`：把该请求块表项换成 null 占位、标记需要热区。

配合它的是准入语义的改动：`HiSparseResidentManager.get_num_blocks_to_allocate()` 支持准入封顶（按 in-flight token 上限即博客的"142K 准入"），且 unpinned 块计入 free，调度器的水位判断自然放宽——并发由此提升。

## 4. 驻留状态机（scheduler 侧）

`_HiSparseRequestState` 跟踪每个请求的每个页：

- **dirty**：只有 GPU 副本（还没镜像/拷贝到主机）；
- **clean + pinned**：主机副本已落盘，GPU 页仍持引用；
- **clean + unpinned**：主机副本在，GPU 引用已还给池子，块表仍读它直到被复用。

每步调度后由 `HiSparseResidentManager.cache_blocks()` 驱动两个动作：

1. **`plan_prefix_materialization()`**——博客"HiSparse 在压力到来之前就做准备"的落实：把所有**已封口但主机还没有副本**的页排队 spill（`after_forward=True`），每步有预算上限，防止一次排太多。
2. **`update_residency()`**——混合驻留的开关：
   - 请求已能从主机读（所有 hot manager 都给了它热区）→ 把全部 pinned clean 页 unpin，**主动**把 GPU 还给池子；
   - 还不能 → 检查共享池空闲块数是否低于水位线 `transition_watermark = max(每请求热块总成本, num_blocks // 10)`；低于才 `require_hot()` 申请热区——申请在下一次调度通过 `HiSparseHotManager.get_num_blocks_to_allocate()` 兑现（host 导入、host 前缀续跑、或已被要求过渡三种情况才分配，其余返回 0）。

**尾部保护**：`_ACTIVE_TAIL_PAGES = 2`——块表尾部两页永不 unpin，保证正在被 in-flight 步写入的页不会被从脚下抽走。这就是"尾部永不被驱逐"。

**主机页发布的持久性门槛**：`HiSparseSourceManager.cache_blocks()` 不直接发布 hash，而是转交 `publish_when_ready()`——只有当所有 spill 都到达 `completed` 状态才调用真正的 `publish_blocks` 把主机块 hash 放进前缀缓存；否则存成待定发布，等 spill 完成事件再补发。**脏页绝不进前缀缓存**。

**GPU 副本复用（`copies` 表）**：coordinator 维护 `主机块hash → GPU块元组` 的索引。请求命中主机前缀时逐页检查：如果同内容页在 GPU 池里还有未复用的副本，直接"收养"进自己的块表，省掉一次主机→GPU 往返。请求结束时 `free()` 把 clean 页变成池子里"匿名可读副本"，后续同前缀请求还能再收养。prefill 侧对应 `HiSparsePrefillStagingPlan.ensure_gpu_sources()`：staging 计划里能从 resident 缓存 D2D 取的行就不走主机 DMA。

## 5. Spill 两阶段事务

设计文档里的时序图在代码里是严格的两个确认点：

```
coordinator                        worker
  │ plan: SparseKVPageTransfer ──► │ enqueue GPU→host copy (dma_stream)
  │◄─ enqueued (transfer_id) ──────│   → 释放 resident GPU 块引用
  │                                   （流顺序保证安全：拷贝已入队）
  │◄─ completed (event 已观察) ─────│   → 页变 clean → 可能立刻 unpin
  │                                   host 页发布进前缀缓存，目的租约释放
```

- **enqueued** 就释放 GPU 引用，对应博客"其 GPU 槽位在拷贝入队那一刻起就可复用"；
- **completed** 才发布主机页，对应"同步因此简单而安全"。

传输元数据只有 transfer_id 和物理坐标（`SparseKVPageTransfer` 就是 `host_block_id + resident_block_ids + 两个 flag`），请求身份全部留在 scheduler——与设计文档"worker 传输里只包含传输 ID 和物理拷贝坐标"一致。

**host-write 事件**：worker 用两个 ping-pong 的 CUDA event（跨 TP rank 时经 `ipc_handle()` 广播）。每步开头当前流等上一个 host-write 事件（CPU 读者不会看到 GPU 上还在排队的写）；每次 DMA 提交后在 dma_stream 上 record 当前事件；`finish_forward` 让计算流等待本步 host-write 事件。

## 6. Worker 数据面：一次 launch 拷走所有层

worker 的 DMA 引擎很朴素也很讲究：

- **描述符批拷**：src/dst/sizes 三个 int64 数组（带 numpy 视图直接填指针），提交 `ops.swap_blocks_batch` 到专用 `dma_stream`，描述符池按完成事件回收。
- **行镜像（row mirror）**：scheduler 给出"信封"（本步调度窗口内每页的 resident 源行区间 → host 目的行区间），但**最终拷贝集 = 信封 ∩ 本步实际写入的行**。方法是 forward 前在 side stream 把 resident slot mapping 暂存进锁页 buffer，forward 中/后用 numpy searchsorted 求交并合并连续 run。注释特别强调"窗口只前进，丢行会造成主机行永久陈旧"，所以只跳过映射不出的页。
- **分层组提交**：每个层在 KV 更新后回调 `submit_layer_mirror`；同一驻留组的层攒齐后，一次 `swap_blocks_batch` 描述符**层间交错**地批出，用该组最后一层的 ready 事件做同步。这就是博客"前向传播之后，用一次 launch 把所有 sparse-MLA 层一起拷走"的实现——它是按驻留组流水化的，层组完成即可提交，不必等整个 forward。
- **`eager_host_mirror = True`（默认）**：decode 步也把写入的行镜像回主机（配置文档原话："Mirror decode-written KV rows to the host pool during the forward so **page spills complete without moving data**"）。后果是 spill 页传输到达 worker 时**只记录完成事件、不搬数据**——数据已经在每次 forward 的行镜像里写过去了。spill 从"拷贝事务"退化为"发布屏障"，这是 `hisparse-glm` 分支轻量化的核心。关掉它则 decode 行只驻留 GPU，spill 时才真拷页。
- **TP 协议**：共享主机池时只有 rank 0 是 writer，主机块 copy-on-write 由 rank 0 执行后 `barrier()`；非 writer rank 没有 dma_stream，只在计算流上做 restore。
- **失效传播**（热缓存一致性）：scheduler 每步上报 source 组新分配的主机块号，worker 把这些块的行槽排序后批量匹配作废——**主机块复用为别的内容时，指向旧行的热表项必须清除**；本步被 prefill 重写的行则由专用 kernel 按（请求，槽位）精确清除。
- **restore（P/D 导入）**：对 `restore=True` 的传输做 H2D 整页拷贝进驻留尾页，代码注释点明动机："Each import pays one H2D page copy and enqueue per layer/rank instead of tail prefill on D"。scheduler 侧 `complete_host_import()` 把导入页标记 valid 并只给**最后一页**排 restore；resident manager 对导入只保留可写尾页，更早的页留主机层——零驻留起步。

## 7. Decode 关键路径：融合解析器

### 7.1 数据结构（全部常驻 GPU）

每个 index group（leader + followers 共享）：

| 张量 | 形状 | 含义 |
| --- | --- | --- |
| `device_global_indices` | `[max_num_seqs, region_stride]` int32 | 每请求每个热槽 → 主机全局行号；-1 = miss |
| `lru_slots` | `[max_num_seqs, region_stride]` int16 | 每请求热槽的 LRU 顺序（int16 → 上限 32768） |
| `shared_topk.*` | `[max_swap_rows, top_k]` | 每步解析结果与紧凑 miss 计划（可重放） |
| `swap_stats` | `[2]` uint64 | hits/misses 计数（每 2000 次调用才回读一次，避开热路径同步） |

`region_stride = device_buffer_size`，默认 `(max_decode_query_len + 1) × index_topk`。无投机 = 2×top_k（博客的"每请求 2× top-K 行"）；MTP3：`max_query_len = 1+3 = 4` → **5×top_k = (num_speculative_tokens+2)×top_k**，与博客脚注公式逐字吻合——多出的一份是"所有验证步 top-k 的最坏并集 + 一份 LRU 余量"。热区物理块由 `HiSparseHotManager` 分配 `cdiv(device_buffer_size, block_size)` 块，热行物理地址经热组的块表换算。

`request_state_indices` 是 CUDA graph 兼容的关键：持久化的"输入批行 → 请求状态行"间接表，批紧缩时刷新（捕获中跳过），kernel 里 padding 行直接输出 -1 交给 attention 掩掉。

### 7.2 `hisparse_resolve_residency_kernel` 逐阶段

**每个 batch 行一个 block、1024 线程**，共享内存里放 top-k、开放寻址 hash（`hash_size = 2×top_k`，Knuth 乘法散列）、前缀和缓冲和 `hot_size` 的 int16 LRU 输出区：

- **Phase 1（驻留短路）**：top-k 逻辑位置经 source（主机）块表翻译成主机全局行号；同时查 resident 块表——页非空则输出直接是**驻留物理行**，直接完成，不碰热 LRU、不碰主机。若全部短路（全驻留批）**整行早退**，连 hash 都不建。
- **Phase 2（热行命中 + LRU 分类）**：按 LRU 顺序走热槽，每个槽的缓存键查共享内存 hash；命中 → 输出热物理行；未命中 → 可逐。ballot + warp 扫描做双端紧缩（命中向前、可逐向后）。
- **Phase 3（miss 计划 + 受害者选择）**：剩余 miss 紧缩，**从可逐列表尾部（最老）依次分配槽位**，写新归属，同时填紧凑 swap 计划（主机源行 + 热物理目的行）。有两处"损坏绊线"：LRU/映射状态里超出范围的槽（注释举例"stray RDMA into reused VRAM"）降级为 re-miss 而不是越界写。
- **Phase 4（LRU 重写）**：新顺序 = 陈旧可逐 | 刚载入的 miss | 命中（MRU 端）。

随后 `hisparse_gather_compact_kernel` 把 miss 行从**锁页主机内存**直接 warp 级拷进热物理行（16B 向量化 `__ldcg/__stcg`，行宽不齐走 4B/1B 兜底；源行号超界则把目标行清零而不是读脏数据）。两段都在 group 的 `copy_stream` 上跑，与计算流重叠；每层记录 ready 事件，计算流等待它。

### 7.3 输出即 HMA 行号

kernel 把物理行换算成 `(row/block_size)×attention_block_stride + row%block_size`——**attention_block_stride 是整块打包张量的行跨度**。因为 resident/hot 同块同 stride，这个行号对两类来源统一有效；sparse kernel 拿热视图整池的 flat 视图加这个行号表直接算。博客"解析器交出的都是 HMA 行 ID，HMA 以一次 stride 完成汇聚"即此。decode 路径块表传 dummy，因果性完全来自 indexer 的 top-k 索引。

### 7.4 IndexShare 与投机解码

- **follower 层零成本重放**：`hisparse_gather_plan_kernel` 的注释直言——共享 index 的层看到相同的索引，槽位分配完全一致，只有每层的字节不同，所以 follower 只按 leader 的计划各拷各的字节，无 LRU 解析。这是"兼容的层仍共享一份 miss 计划"不变量的实现。
- **MTP 每步可重放**：按验证步循环调 `swap_in`，每步切一段共享工作区——每个验证步有自己的解析与搬运，但共享同一请求的热状态（LRU 表），后一步不会在前一步消费前复用某热行。
- **CUDA graph**：固定形状、无 CPU 决策、无设备标量回读（stats 定期采样也在捕获外），prefill 超过 decode 工作区尺寸时要求"全部上下文页驻留"走纯块表换算。

### 7.5 prefill 的 staging 路径

带主机前缀的 prefill 用 `build_hisparse_prefill_staging_plan()` 把主机块表重编号成紧致暂存区（纯 GPU 端 torch 算子，无数据依赖分配），先 D2D 收养 GPU 副本，缺的行由专用 kernel 从主机 gather 进线性 staging 缓冲，attention 在重映射块表上跑。KV 写入侧：写目标换成 resident 视图 + resident slot mapping（截到实际 token 数），prefill 同时把行线性写入每层的镜像 staging 缓冲（单元测试验证：resident slot 为 -1 的行也进 staging）。

## 8. 与 vLLM 其余部分的组合

- **indexer KV**：纯普通组。HiSparse connector 自身不做 P/D 传输；与 `OffloadingConnector`（TieringOffloadingSpec）通过 MultiConnector 并存，indexer 的卸载走通用路径。主机前缀与 GPU 驻留 indexer 前缀长度不一致时截断到公共前缀。
- **P/D 导入**：decoder 按常规准入算一次落点选择；装得进设备池 → NIXL 直传驻留页，否则落主机层；主机池放不下导入时返回"不可准入"哨兵——让请求重试而不是抢占在跑请求。
- **主机块 copy-on-write**：主机前缀被多请求共享后新写入需要 CoW，由 worker 在主机内存内执行（rank 0 执行 + barrier），完成确认按"每个 worker 都跑过同样拷贝 → 取并集即 ack"聚合。

## 9. 一笔定量账（示意）

fp8 sparse-MLA 行宽 656 B（512B NoPE + 16B scales + 128B RoPE，`runtime.py` 顶部的常量）。以 top_k=2048、60 个 sparse-MLA 层、100K 上下文为例：

| 项 | 每请求 GPU 占用 |
| --- | --- |
| 全驻留 sparse-MLA KV | 100K × 656 B × 60 ≈ **3.9 GiB** |
| 热缓冲（2×top_k 默认） | 2 × 2048 × 656 B × 60 ≈ **155 MiB** |
| 混合态上限 | 热缓冲 + 尾部（随压力从全长收敛下来） |

约 25 倍的差距就是并发提升的来源；indexer KV 仍驻留增长（每 4 层一份，行宽小得多），构成新的上限项——与博客内置计算器的口径一致。主机侧按 DP 副本 384 GiB，取整到主机块（共享模式下还对齐到共享区域的块对齐要求）。

## 10. 文档没写、代码里才看到的细节

实现里有几处设计文档没写、但很能体现工程取舍的点：

1. **eager host mirror 让 spill 变成零拷贝发布**（默认开启）——文档只说"排队一次到 CPU 的拷贝"，代码里这次拷贝在默认配置下根本不发生。
2. **信封 ∩ 实写行**：row mirror 不是照单全拷，而是与本步 slot mapping 求交，只为真正写入的行付 DMA。
3. **损坏绊线**：对长期驻留的 LRU/映射状态做防御性边界检查，坏槽降级为 re-miss——针对"外部写手（如误入复用显存的 RDMA）"的现实防护。
4. **一处实测注释**："blocking here costs no throughput (26.7 vs 27.6 gen tok/s)"——为拷贝精确性接受一次 host 侧同步，且用数据证明无伤。
5. kernel 头部注明算法是 **SGLang HiSparse `load_cache_to_device_buffer` 的移植**，改动点恰好两条：按全局 KV 槽位键控（免掉每请求主机位置表）和固定大小热区。[前一篇译文](/2026-09-19-vllm-hisparse-local-kv-offload-architecture/)末尾"两个框架收敛出同一套最佳实践"的判断，在源码注释里得到了直接印证。

## 11. 小结

Hybrid HiSparse 的内存管理可以压缩成三条规则：**主机是真身、GPU 是缓存**（发布 hash 前必须 durable，spill 两阶段确认）；**一切 GPU 租约同池同张量**（`unpin` 原语让"可读但可回收"成为一等状态，热页和驻留页只是同一池子里的不同租约，解析器输出统一行号）；**decode 热路径零 CPU 参与**（融合 kernel + GPU LRU + 每步可重放的计划，全程 CUDA graph 可捕获）。压力上升时系统逐页退让而非抢占，压力下降时 GPU 副本被新请求直接收养——这就是原博客里"两个请求都在继续解码"那张图的机制本体。

---

**源码阅读入口**：tag [`v0.30.0rc2`](https://github.com/vllm-project/vllm/tree/v0.30.0rc2)，从 `vllm/v1/hisparse/` 四个文件开始即可；`tests/v1/kv_connector/unit/test_hisparse_connector.py` 与 `tests/v1/e2e/general/test_hisparse.py` 是很好的行为规格说明。
