# SGLang PR #33089 设计说明：Ascend NPU 上的稀疏驱动 KV 卸载

> 原标题：*[NPU] Add sparsity-driven KV offload for DeepSeek DSA on Ascend*
> 作者：USTC（Yinhe Chen、Chengru Yang、Chengjie Tang、Youhui Bai、Cheng Li）+ 昇腾 NPU 网络实验室
> 状态：2026-09-09 合入 main，+1737 / −30，共 9 个文件
> 关联：RFC [sglang#31779](https://github.com/sgl-project/sglang/issues/31779)；内核原语 [sgl-kernel-npu#636](https://github.com/sgl-project/sgl-kernel-npu/pull/636)

---

## 1. 一句话概括

DeepSeek V3.2 一类的 DSA（DeepSeek Sparse Attention）模型在解码时每个 token 只需注意（attend）索引器选出的 top-k（约 2048 个）历史 token，但基线 Ascend 路径仍把**完整 MLA latent KV Cache 驻留在 NPU HBM**。本 PR 引入一条可选数据通路：完整 latent KV 存放在**向 NPU 注册过的主机共享内存**中，设备上只保留三样东西——DSA 索引 KV、每请求 2048 token 的"已选 KV"缓存、以及一张 slot map。每个解码步先用 slot map 查设备缓存命中，未命中的行从主机内存搬入，拼成一个**紧凑 KV 缓冲区**，再用稀疏 Flash Attention 对这个紧凑缓冲区做注意力。设备端每 token 的 KV 占用从 576 维 latent 降到 128 维索引（约 4.5×），等效于大幅放宽了 HBM 容量对并发和上下文长度的限制。

实测（PR 描述）：GLM-5.1，TP16 混部部署 + 图优化，解码吞吐 39.42 → 63.06 TPS（**1.6×**）；GSM8K 0.98 → 0.97，AIME-26 无损。RFC 中的 DeepSeek-V3.2-W8A8 数据更激进：峰值解码吞吐 44.70 → 113.97 TPS（**2.55×**），增益主要来自"能跑更大的 batch"而非单请求变快。

---

## 2. 背景与动机

### 2.1 DSA 稀疏注意力回顾

DeepSeek V3.2 引入的 DSA 用一个轻量索引器（`index_head_dim = 128`）为当前 query 对全部历史 token 打分，选出 top-k（`index_topk = 2048`，GLM-5.x 为 1536）个 token，注意力只在这 k 个 token 上计算。因此运行时存在两种 KV：

- **索引 KV**：索引器自己的 key，每 token 每层 128 维，注意力计算必须每步全量扫描 → 必须留在设备上；
- **MLA latent KV**：`kv_lora_rank(512) + qk_rope_head_dim(64) = 576` 维，每步实际只被 top-k 命中的行读取 → 是卸载的对象。

基线 Ascend MLA 路径里这两者都放在 `NPUMLATokenToKVPool` 的 HBM 缓冲区中。虽然注意力内核只读 top-k 行，完整 latent 历史仍然霸占 HBM——这正是"算子稀疏、存储不稀疏"的错配。

### 2.2 NPU 特有的三个挑战（来自 RFC）

1. **缺少索引驱动的 Host↔Device 搬运原语**：CUDA 有 `cudaMemcpyAsync` + 批量 gather 等成熟手段，昇腾 CANN 栈没有现成的"按索引行搬运"算子；
2. **NPU 图执行偏好静态形状**：top-k 是数据相关的动态集合，与图捕获/回放的定形要求冲突；
3. **没有成熟的统一内存抽象**：主机内存的注册、设备可见地址、生命周期都要显式管理。

本 PR 的内核侧配套（sgl-kernel-npu#636）补齐了 1 和 3：`shm_allocator`（注册主机共享内存，返回 NPU 可见地址）、`unidex_copy`（带掩码的按索引行复制，支持 D2D / H2D / D2H）、`slot_map_lookup`（设备端 slot map 查询）。本 PR 则实现运行时缓存管理与注意力后端集成。

---

## 3. 总体架构

### 3.1 数据通路

```text
                    ┌────────────────────────────────────────────────┐
                    │  DSA 索引器输出 top-k indices（每层每步）         │
                    └───────────────────────┬────────────────────────┘
                                            │
                    ┌───────────────────────▼────────────────────────┐
                    │  slot_map_lookup(device_slot_map, req, topk)   │
                    │  → token_on_device[b,k], device_token_pos[b,k] │
                    └───────┬────────────────────────┬───────────────┘
                      hit   │                  miss  │
                    ┌───────▼──────┐        ┌────────▼────────────────┐
                    │ device_kv_   │        │ host_kv_buffer          │
                    │ buffer       │        │ （注册共享内存，D2H/H2D  │
                    │ （D2D gather）│        │  经 dev_ptr 直达）       │
                    └───────┬──────┘        └────────┬────────────────┘
                            │      双流并行拷贝        │
                    ┌───────▼────────────────────────▼───────────────┐
                    │  selected_kv_buffer  [B, sparse_ctx, 1, 576]   │
                    │  （紧凑 top-K KV，本次注意力的唯一 KV 输入）      │
                    └───────────────────────┬────────────────────────┘
                                            │
                    ┌───────────────────────▼────────────────────────┐
                    │  npu_sparse_flash_attention（BSND, mode=0,     │
                    │  MLA attention_mode=2，identity 稀疏索引）       │
                    └───────────────────────┬────────────────────────┘
                                            │
                    ┌───────────────────────▼────────────────────────┐
                    │  后台流：selected → device_kv_buffer 回填，       │
                    │  slot map 全量重置 + 新映射写入（供下一步命中）    │
                    └────────────────────────────────────────────────┘
```

### 3.2 核心设计思想

**把"稀疏注意力"物化成"紧凑缓冲区上的伪稠密注意力"。** 注意力内核拿到的不再是 paged cache + 任意 top-k 索引，而是一个每请求恰好 `sparse_context_len` 行的紧凑缓冲区，稀疏索引退化为恒等映射 `arange`（无效位补 −1）。这一转换带来三个好处：

- 注意力内核的 KV 访问模式变成连续紧凑，无论上下文多长，注意力工作量以 2048 为上界；
- 所有中间张量都是静态形状，天然兼容 NPU 图捕获；
- 稀疏性解析（hit/miss 判定、gather）被隔离到注意力之前的数据搬运阶段，可以用专用拷贝流与计算重叠。

其次，**设备缓存采用"每步全量替换"的直接映射策略**：每请求设备缓存恰好保存上一步的 top-k 集合，slot map 每步全量重置后重写。命中率 = 相邻两步 top-k 集合的交叠率。策略极简，但换来了元数据维护无需逐项失效、且图形状完全静态。

### 3.3 代码组织

```text
python/sglang/srt/
├── environ.py                                  # +1 行：环境开关
├── model_executor/pool_configurator.py         # +15 行：index-only cell size
└── hardware_backend/npu/
    ├── memory_pool_npu.py                      # 改造：latent K/V 条件化分配
    ├── attention/ascend_backend.py             # 集成点：初始化 + 分发
    └── sparsity_driven_kv_offload/             # 新包（4 个文件）
        ├── config.py        (96 行)  门禁校验、sparse_ctx、cell size
        ├── manager.py       (980 行) 核心：存储/生命周期/多流物化
        ├── attention.py     (318 行) 稀疏注意力前向（prefill/decode）
        └── host_callback.py (80 行)  ACL 上报线程（图流回调）
test/registered/unit/npu/test_sparsity_driven_kv_offload_config.py  # 配置单测
```

---

## 4. 特性门禁与配置（config.py）

开关是环境变量（注意：PR 描述文本里写的是 `SGLANG_ENABLE_SPARSITY_DRIVEN_KV_OFFLOAD`，但代码实际注册和测试用的是 **`SGLANG_NPU_ENABLE_SPARSE_KV_OFFLOAD`**，以代码为准）：

```python
# environ.py:914
SGLANG_NPU_ENABLE_SPARSE_KV_OFFLOAD = EnvBool(False)   # 默认关闭
```

`is_sparsity_driven_kv_offload_enabled()`（config.py:20）在环境变量打开时**继续强校验**五个条件，任一不满足直接抛 `ValueError` 快速失败：

| 条件 | 理由 |
| --- | --- |
| `is_npu()` | 该通路依赖昇腾专用算子（`unidex_copy` 等） |
| prefill 与 decode attention backend 均为 `ascend` | 分离后端（如 ascend+torch_native）不支持 |
| `use_mla_backend` | latent 吸收式 MLA 专属，断言 `KV_N == 1` |
| `is_deepseek_dsa(hf_config)` | 仅 DSA 家族（DeepSeek V3.2、GLM-5.x）有 top-k 索引 |
| `max_running_requests` 已显式设置 | 主机/设备缓冲都按请求容量静态分配，必须显式定界 |

其余三个纯函数：

- `get_sparsity_driven_kv_offload_sparse_context_len()`：取 `index_topk` 作为每请求设备缓存窗口（DSV3.2 = 2048，GLM-5.1 = 1536），要求为正；
- `get_sparsity_driven_kv_offload_index_head_dim()`：优先 `model_config.index_head_dim`，回退 hf config；
- `get_sparsity_driven_kv_offload_cell_size()`：返回 `index_head_dim × num_layers × element_size`，即 **index-only 设备池的每 token 字节数**。

`pool_configurator.py:313` 的钩子在 MLA 分支最前面接住这个值，使调度器按"每 token 只占索引 128 维"估算 token 容量——这就是设备池表观容量膨胀 4.5× 的机制来源。不启用时一切照旧。

---

## 5. 内存池改造（memory_pool_npu.py）

`NPUMLATokenToKVPool.__init__`（memory_pool_npu.py:611 起）变为条件分配：

- **启用时**：`k_buffer = None`、`v_buffer = None`（latent KV 不再驻留设备）；`index_k_buffer` 照常分配（索引器每步要全量扫它）。若模型没有 `index_head_dim` 则直接 `ValueError`。
- **未启用时**：原逻辑分毫未动。

配套的防御性改造：

- 新增 `_raise_if_native_kv_cache_disabled()`（memory_pool_npu.py:732），挂在 `get_kv_buffer / get_key_buffer / get_value_buffer / set_kv_buffer / get_contiguous_buf_infos` 上——latent 缓冲不存在时这些访问点**显式报错**而不是空指针崩溃。报错文案明确指路："走 sparse KV manager 路径，或关闭该特性"。`get_contiguous_buf_infos` 被拦也意味着 **PD 分离场景当前不支持**此特性。
- `get_kv_size_bytes()` 改为 `getattr(..., None)` 风格判空，只在缓冲存在时累计。

---

## 6. SparseKVCacheManager 详解（manager.py，980 行）

整个特性的核心。四个职责：主机注册存储的分配、请求生命周期、KV 写回（offload）、解码步 top-K 物化（materialize）。

### 6.1 数据结构总览

构造参数：`req_to_token_pool`、`token_to_kv_pool_allocator`（用于取 `MLATokenToKVPool` 读 MLA 形参并校验类型）、`sparse_context_len`。

| 结构 | 形状（每层一份） | 位置 | 用途 |
| --- | --- | --- | --- |
| `device_kv_buffer` | `[size, sparse_ctx, 1, 576]` | NPU HBM | 每请求 top-K 已选缓存（上一步工作集） |
| `device_slot_map` | `[size+1, (max_ctx/8+1)×8]` int32 | NPU HBM | 逻辑 token 位置 → 设备缓存槽位；−1 = 未命中 |
| `_device_slot_map_minus_one` | 同上 | NPU HBM | 全 −1 模板，整表重置用一次 D2D 拷贝完成 |
| `host_kv_buffer` | `[size, max_context_len, 1, 576]` | 主机共享内存（已注册） | **完整 latent KV 的真值存放地** |
| `dev_ptr_list` | 每层一个标量 | — | 注册内存的 NPU 可见地址，喂给 `unidex_copy` |
| `host_kv_ctx_len` | `[size, max_ctx]` int32 | CPU | 每请求长度簿记（本 PR 内只写未读） |

其中 `size = req_to_token_pool` 的行数（含 padding 行——注释特别说明：图模式下 0 行保留给 padding 后，真实请求 ID 可能等于容量值，因此尺寸必须含 padding 行）；四条专用流与四个事件配对：

```python
self._materialize_d2d_hit_stream     / self.hit_done       # 设备缓存命中 gather
self._materialize_h2d_miss_stream    / self.miss_done      # 主机缺失行 fetch
self._materialize_refill_stream      / self.refill_done    # 设备缓存回填
self._materialize_slot_map_stream    / self.slot_map_done  # slot map 重建
```

主机缓冲通过内核库的 `create_shm_tensor(shape, dtype, device_id, name)` 创建，同时返回 `(cpu_tensor, host_ptr, dev_ptr)`；`dev_ptr` 是 NPU 视角的地址，之后所有 H2D/D2H 都由 `unidex_copy` 直接经它完成，绕开常规 pinned-memory 拷贝接口。分配失败统一走 `_raise_buffer_allocation_error()`，报错中带上三个容量参数并提示"调小 `--max-running-requests`"。

### 6.2 哨兵与对齐

图执行要定形，所以所有"非法"都路由到哨兵而不是变长处理：

- **slot map 哨兵行** = `self.size`（额外多分配的那一行）：非法/填充请求的行号统一指到这里（该行永远全 −1 → 全 miss）；
- **slot map 哨兵列** = `max_context_len`（正好是合法 token 下标的上界，行宽对齐 8×int32 = 32B 后保证此列存在）：非法 top-k 写入被散射到这一列，不污染合法映射；
- **设备缓存 0 行**：非法请求的 `device_cache_row_indices` 归 0，读取端反正被 `valid_topk_mask` 屏蔽；
- **slot map 行宽按 8 个 int32（32 字节）对齐**：`（max_context_len // 8 + 1) * 8`，兼顾对齐访问与哨兵列存在性。

### 6.3 请求生命周期

```python
def _install_req_alloc_hook(req_to_token_pool):     # manager.py:249
    # 包装 pool.alloc：记录哪些请求是"新分配"（req_pool_idx 原为 None），
    # 调用原 alloc 后，对这些请求的 slot map 行做 index_fill_(-1) 整行失效
```

这是对 `ReqToTokenPool.alloc` 的猴子补丁式包装——侵入最小，但属于对上游内部接口的隐式依赖（见 §14）。`init_req()`（跳过 chunked 请求）先记 `host_kv_ctx_len[rid] = len(origin_input_ids)` 再 `reset_requests([rid])`；`reset_requests()` 对所有层的 slot map 按 `index_fill_(0, req_ids, -1)` 整行清 −1。

由于设备缓存采用每步全量替换策略，行级失效只发生在**新请求入池**时；请求运行期间的失效由每步的整表重置完成。

### 6.4 offload_v2：新 KV 写回主机（manager.py:383）

`forward_sparsity_driven_kv_offload` 在 `save_kv_cache` 时调用它，把本步前向刚算出的紧凑 KV 行（`k_nope ‖ k_rope` 沿最后一维拼接成 576 维）经 `unidex_copy` D2H 写入主机存储。源行就是 `[0, num_new_tokens)`（v1 `offload()` 假设输入是完整 cache 视图、以 `out_cache_loc` 为源行，本 PR 实际只调用 v2；v1 保留未用）。

目的索引 `dst = req_id × max_context_len + token_pos`，两条分支：

- **decode**：`token_pos = seq_lens − 1`，每请求一行。校验紧凑行数 == batch 数 == `out_cache_loc` 行数；`valid_mask` 剔除 padding 请求（沿用图解码约定 `seq_len == 1` 即 padding）、负 cache_loc、越界位置；
- **prefill/extend**：兼容两种物理布局——
  - **紧凑 ragged 布局**（`rows == sum(extend_seq_lens)`，chunked prefill 常态）：用 `repeat_interleave` 把请求号、段起始、前缀长度展开到 token 粒度，`token_pos = prefix + 全局偏移 − 段起始`；
  - **图静态布局**（`rows % batch == 0`，即 `[B, tokens_per_req]` 行主序）：二维展开 + `local_offsets < extend_seq_lens` 掩掉填充列。
  - 两者都以 `out_cache_loc >= 0`（若形状匹配）追加进有效掩码。

掩码、索引全部静态形状、设备端构造——这是能进图的关键。拷贝 `block_dim=48`，`dst_ptr` 用注册地址。

### 6.5 materialize_selected_kv：解码步多流物化（manager.py:688）

解码热路径。输入：本层 `topk_indices`（`[B, K]`）与调用方预分配的 `selected_kv_buffer`（`[B, sparse_ctx, 1, 576]`）。五个阶段：

**① 主流上构建索引**（与计算同流，无同步开销）：

```python
slot_map_row_indices   = 非法请求 → self.size（哨兵行）
device_cache_row_indices = 非法请求 → 0（反正被掩码）
valid_topk_mask = (0 ≤ topk < max_ctx) & 请求合法

token_on_device, device_token_pos = slot_map_lookup(slot_map, 行号, topk)
# 设备端查表，输出 [B,K] 布尔 + [B,K] 槽位；随后 & valid_topk_mask
```

`slot_map_lookup` 是内核库提供的设备端查表算子——**命中判定不下沉到 CPU**，这是图兼容的前提。之后构建三组扁平索引（`bs×topk` 长）：

- hit：`src = req × sparse_ctx + device_token_pos`（设备缓存行），`dst = b × topk + k`（紧凑缓冲行）；
- miss：`src = req × max_ctx + topk_token`（主机存储行），`dst` 同上；
- refill：`src = arange(bs×topk)`（紧凑缓冲），`dst = req × sparse_ctx + 槽位号`。

最后 `record copy_ready` 事件，放行四条后台流。

**② hit 流**：等 `copy_ready` → D2D `unidex_copy(device_kv_buffer → selected_kv_buffer)` → `hit_done`。

**③ miss 流**：等 `copy_ready` → H2D `unidex_copy(host_kv_buffer → selected_kv_buffer, src_ptr=dev_ptr)` → `miss_done`。与 ② **完全并行**，D2D 与 H2D 各占一条流互不阻塞。

**④ refill 流**：等 `hit_done` **和** `miss_done` → D2D 把紧凑缓冲整体回填进设备缓存（下一步的候选工作集）→ `refill_done`。回填掩码就是 `valid_topk_mask`，即**每步全量替换**该请求的 top-K 缓存。

**⑤ slot map 流**：等 `copy_ready` → 先整表 `copy_(_device_slot_map_minus_one)` 重置为全 −1，再把本步映射（`token → 槽位`，非法项写哨兵列）经一次散射 `unidex_copy` 写入 → `slot_map_done`。整表重置保证"上一步选中、本步落选"的条目不会残留为假命中。

调用方（attention.py）只在注意力**之前**等 `hit_done/miss_done`，在注意力**发射之后**才等 `refill_done/slot_map_done`——即 ④⑤ 与注意力计算重叠。

### 6.6 get_forward_kv：prefill 全量收集（manager.py:575）

prefill/extend 的非 CP 分支需要请求的**完整**前缀 KV 作注意力输入。该函数按 `repeat_interleave` 展开 `src = req × max_ctx + token_pos`，把主机存储中的 `[Σseq_len, 1, 576]` 紧凑 TND 张量收集上来，再 split 成 `(k_nope, k_pe)` 返回。含空批次、请求号越界、seq_len 超界的防御。

代码里的 TODO 明说：每个 prefill chunk 都会把**全量前缀**从主机搬一遍，将来应加 prefill 驻留设备缓存（同一 req_id 连续 chunk 复用槽位）。长提示词下这是 O(前缀长度 × chunk 数) 的主机带宽开销。

---

## 7. 注意力路径（attention.py）

### 7.1 统一入口与分支

`AscendAttnBackend.forward_extend / forward_decode` 在 `topk_indices is not None` 且特性启用时分发到 `forward_sparsity_driven_kv_offload()`（ascend_backend.py:1320 / 2776），签名与 `forward_sparse` 对齐。公共前置：

- `v` 直接丢弃（MLA 吸收式：value 即 latent，内核以 `k_nope` 兼任 value）；
- 必须有 `q_rope / k_rope / topk_indices`，否则 `ValueError`；
- `save_kv_cache` 时先 `offload_v2`（本步 KV 落主机）；
- 计算 `actual_seq_qlen`：prefill 用 `cumsum(extend_seq_lens)`；decode 常规为 `arange(1, B+1)`；投机解码（draft extend v2 / target verify）为 `arange(K, K+rows, K)`——每请求恰好 `speculative_num_draft_tokens` 个 query。

之后三分支：

| 分支 | 条件 | KV 来源 | 内核布局 |
| --- | --- | --- | --- |
| A. CP prefill | prefill 且开 DSA prefill CP | 走原 `do_cp_balance_attn`（不变） | — |
| B. decode | `is_decode()` | `materialize_selected_kv` 紧凑缓冲 | BSND，`sparse_mode=0` |
| C. 其余 extend | — | `get_forward_kv`（prefill）或本步新行 | TND，`sparse_mode=3` |

### 7.2 decode 紧凑 BSND 路径（attention.py:118）

这是特性的主战场，逐段拆解：

1. **top-k 规范化与补齐**：`normalize_batch_topk_indices` 把 `[B,K] / [B,1,K] / [B,1,1,K]` 统一成 `[B,K]`（兼容不同 DSA 变体的索引布局）；若 `K < sparse_context_len`（动态 top-k，如 GLM 的 1536 < 2048），用 **−1 右填充**到满宽——缓冲区与索引形状始终静态，语义靠掩码表达。`K > sparse_ctx` 直接报错。
2. **物化**：分配 `selected_kv_buffer[B, sparse_ctx, 1, 576]`，调 `materialize_selected_kv`，随后主流等 `hit_done + miss_done`。
3. **变长元数据**：`topk_valid = topk ≥ 0 (& seq_len > 0)`；`actual_seq_lengths_kv = topk_valid.sum(1).clamp(1, sparse_ctx)`（每请求的有效行数，至少 1）；query 长度全 1。
4. **恒等稀疏索引**：`sparse_indices = arange(sparse_ctx)` 广播成 `[B,1,1,sparse_ctx]`，无效位 −1。**全无效行**（该请求 top-k 全被掩掉）强制把第 0 个索引置 0，避免内核看到空行。至此，"任意 top-k 稀疏"被彻底改写成"紧凑缓冲上的带掩码稠密"。
5. **形状适配**：`num_kv_heads == 1` 断言（MLA）；`padded_query_heads = numel / (B × nope_dim)` 从元素数反推（图填充后 query 行数可大于真实 batch）；q/k 全部 `contiguous()` 成 BSND。
6. **调用内核**：

```python
torch_npu.npu_sparse_flash_attention(
    q_nope_sfa, k_nope_sfa, k_nope_sfa,   # value 用 k_nope 兼任（MLA 吸收）
    sparse_indices, layer.scaling,
    actual_seq_lengths_query=ones, actual_seq_lengths_kv=有效计数,
    query_rope=q_rope_sfa, key_rope=k_rope_sfa,
    sparse_block_size=1,                  # token 粒度
    layout_query="BSND", layout_kv="BSND",
    sparse_mode=0, attention_mode=2,      # MLA 模式（nope+rope 双路）
    return_softmax_lse=False)
```

7. **收尾同步**：内核**发射后**主流才等 `refill_done + slot_map_done`——缓存回填与 slot map 重建藏在注意力执行时间里；同时这两个等待也构成了下一步 hit 拷贝的安全性前提（§9）。
8. **输出整形**：`[:, :, :num_query_heads, :].reshape(B, heads × kv_lora_rank)`，切掉图填充的 head，交回 MLA 上投影。

### 7.3 非 decode 分支

prefill（非 CP）：`get_forward_kv` 收集全量前缀 KV，`kv 侧 seq_lens = cumsum(seq_lens)`，top-k 索引 `_expand_dsa_sparse_indices` 升维 `[T,1,K]`，走 TND 布局、`sparse_mode=3` 的稀疏注意力（索引指向全量 KV 内的真实位置）。非 prefill 非 decode（如 draft extend）：直接用本步新产生的 k 行。

---

## 8. ACL host callback（host_callback.py)

CANN 运行时需要有线程持续调用 `acl.rt.process_report(timeout)` 来服务流上的主机侧回调；图执行（捕获/回放）时这些回调发生在图流上，若无人处理会卡死。本文件提供：

- `_AclReportThread`：每设备一个守护线程，`set_device` 后死循环 `acl.rt.process_report(100)`；`atexit` 注册清理；
- `subscribe(stream)`：`acl.rt.subscribe_report(thread_id, stream_ptr)` 把流挂到该线程；`_get_stream_ptr` 兼容 `npu_stream / stream_ptr / cuda_stream` 三种属性名取裸流句柄；
- `register_npu_host_callback_stream(stream, device)`：按 `device_index` 复用线程（`_REPORTERS` 全局字典）。

接入点在 `AscendAttnBackend._init_cuda_graph_metadata`（ascend_backend.py:688）：**每个图 batch size 的捕获流**都订阅一次，保证图模式下回调有人接。

---

## 9. 流同步与正确性论证

跨流数据竞争逐一核对（主流 = 计算流）：

| 依赖 | 保证机制 |
| --- | --- |
| 本步 offload（D2H 写主机）→ miss 流读主机 | miss 流先等 `copy_ready`，而 `copy_ready` 在主流上记录于 offload 之后 → 传递有序 |
| 索引张量（主流构建）→ hit/miss 流消费 | 同上，`copy_ready` 屏障 |
| hit/miss 拷贝 → 主流读 selected 缓冲 | 主流显式等 `hit_done + miss_done`（SFA 之前） |
| hit/miss 拷贝 → refill 写设备缓存 | refill 流等两个 done |
| **第 N 步 refill / slot map 写 → 第 N+1 步 hit 读 & lookup 读** | 第 N 步 SFA 发射后主流等 `refill_done + slot_map_done`；第 N+1 步的 `copy_ready` 在主流上记录于这些等待之后，hit 流与 slot-map 流只认 `copy_ready` → 事件链传递有序 |
| slot map 重置与重写 | 同流串行（先模板整表 copy，后散射写入） |

值得点名的是第五行：把 `refill_done/slot_map_done` 的等待放在 SFA **之后**，既换来了与注意力重叠的带宽，又免费充当了跨步屏障——这个双重身份是时序设计里最巧的一处。

---

## 10. NPU 图（类 CUDA Graph）兼容性清单

- 一切缓冲静态形状：`selected_kv_buffer` 每步 `sparse_ctx` 满宽；top-k 动态长度用 −1 填充表达；
- 一切控制流数据化：请求合法性 → 哨兵行/列；空 top-k 行 → 索引 0 强制有效；命中判定 → 设备端 `slot_map_lookup`，零 CPU 介入；
- 索引/掩码全用可捕获算子（`arange / where / repeat_interleave / index_fill_`）构造；
- offload_v2 显式区分紧凑 ragged 与图静态两种物理布局；
- 图流订阅 ACL 上报线程，主机回调不丢。

---

## 11. 容量规划与内存公式

设 `R` = 请求容量（`max_running_requests`），`L` = 层数，`K` = `index_topk`，`C` = `max_context_len`，`D` = 索引头维（128），`M` = latent 维（576），`s` = dtype 字节数（bf16 = 2）：

| 项 | 公式 | 位置 | R=128, C=128K, L=61, K=2048, bf16 |
| --- | --- | --- | --- |
| 基线 latent 池 | `N·M·s·L`（N 为 token 数） | HBM | 70.3 GB / 百万 token |
| 索引池（本特性） | `N·D·s·L` | HBM | 15.6 GB / 百万 token（**4.5×↓**） |
| 设备已选缓存 | `R·K·M·s·L` | HBM | ≈ 18.4 GB（固定开销） |
| slot map | `(R+1)·⌈C/8⌉·8·4·L` | HBM | ≈ 4.1 GB（固定开销） |
| **主机全量 KV** | `R·C·M·s·L` | 主机内存 | **≈ 1.18 TB** |

几个直接推论：

- 固定开销（已选缓存 + slot map ≈ 22.5 GB）与 token 容量无关；token 容量约 41 万以上时总 HBM 占用才低于同容量基线，而基线在每 die 64 GB 下根本放不下百万级 token——**本特性买的是"容量上限"，不是"同容量下更省"**；
- 主机内存随 `R × C` 线性爆涨（上例 1.18 TB，正好对上 RFC 中 2 TB 主机内存的机型），这就是强制显式 `max_running_requests` 的根本原因；
- RFC 的 2.55× 吞吐提升本质：HBM 不再限制并发 → 解码 batch 上调 → 吞吐随并发继续爬坡。

---

## 12. 精度论证

系统级无损：top-k 的**选择**仍由索引器在设备端完成（索引 KV 未动），物化路径只是改变被选 KV 行的**存放位置与搬运路径**，选中集合、KV 数值、注意力计算三者不变。GSM8K 0.98 → 0.97 的差异在稀疏策略本身的噪声范围内（RFC 亦如此声明）。

---

## 13. 与基线的互不干扰

- 默认关闭；环境变量不开时 `memory_pool_npu` / `pool_configurator` / `ascend_backend` 的行为逐字节等价于改动前；
- 三处接入点全部前置短路：`is_sparsity_driven_kv_offload_enabled()` 失败即走原 `forward_sparse`；
- 配置非法时启动即报错（fail fast），单测覆盖三种拒绝场景（GLM 正常启用、分离后端拒绝、缺 max_running_requests 拒绝）。

---

## 14. 设计评注：亮点与可改进点

**亮点**

1. **"稀疏 → 紧凑伪稠密"的转换**是全篇题眼：把动态稀疏性从注意力内核挪到数据搬运阶段，一石三鸟（内核访问连续、形状静态、搬运可并行）；
2. **多流流水线的同步闭环**：D2D 命中与 H2D 缺失双流并行，refill / slot map 重建藏在注意力执行时间内，且跨步安全性由主流事件链免费保障；
3. **哨兵 + 掩码的图兼容方法论**干净彻底，`copy_ready` 单屏障管理四条流；
4. **防御性编程密度高**：offload/物化/索引构建处处显式校验形状与取值，非法路径全部显式报错并给出可操作建议。

**可改进点 / 已知债务**

1. **slot map 整表重置**：每层每步全表 D2D 拷贝 `(R+1)×对齐后C×4B`（上例 ≈ 68 MB/层/步，61 层 ≈ 4.1 GB/步的隐藏带宽），虽有重叠但随 `R×C` 线性放大，只重置被本批请求触达的行是显然的优化方向；
2. **prefill 无设备缓存**（代码 TODO）：每 chunk 全量拉前缀，长上下文预填充的主机带宽开销为 O(prefix²/chunk)；
3. **猴子补丁 `pool.alloc`**：对上游内部接口的隐式依赖，`ReqToTokenPool` 重构时易碎；
4. **miss 必然走 H2D 临界路径**：无预取（RFC 已把 cache-miss prefetching 列为 future work）；缓存策略为"上一步 top-k 全量替换"，相邻步交叠率低时 H2D 压力全暴露；
5. **主机存储无页化/无前缀共享/无淘汰**：按 `R×C` 静态超额分配，与 HiCache/radix cache 体系不互通，finished 请求的 KV 静默废弃至行复用；
6. **PD 分离被显式阻断**（`get_contiguous_buf_infos` 报错）、shm 注册表进程本地——与部署模型的耦合写死在内核库侧；
7. 杂项：`offload()` v1 已无调用方；`host_kv_ctx_len`、类属性 `copy_stream / miss_shm_*` 均为只写不读的遗留；PR 描述中的环境变量名与代码不一致（以 `SGLANG_NPU_ENABLE_SPARSE_KV_OFFLOAD` 为准）。

**适用边界**：DSA 家族 + Ascend MLA 后端 + 单机混部 + 显式请求容量。非 DSA 模型、分离式 prefill/decode、HiCache 多级缓存场景均不适用（当前版本）。

---

## 15. 致谢与延伸阅读

- RFC（动机、评测全貌、路线图）：sglang#31779——future work 包括 miss 预取、PD 分离、超节点内存池、950D 与 DeepSeek-V4 适配；
- 内核原语（shm 注册 / unidex_copy / slot_map_lookup 的算子实现与基准）：sgl-kernel-npu#636；
- 对照阅读：本博客已有的 HiSparse（vLLM 侧主机 KV 卸载）、SGLang HiCache 多级 KV 缓存分析——三者同为"KV 分层 + 按需搬运"，本 PR 的差异点在于**以模型自带稀疏性（DSA top-k）作为搬运依据**，而非 LRU/前缀复用等通用策略，因此可以做到每步搬运量有硬上界（K 行/请求）。

---

## 16. 全量代码核验与合并后演进（2026-09-19，main@76f9213a41）

基于本地 `~/codes/sglang`（已快进到合并后 10 天的最新 main）通读完整源码后的核验结论与增补。

### 16.1 核验结论：实现与本文分析一致

- **特性包零改动**：`sparsity_driven_kv_offload/` 四个文件与合并提交 `295132c4` 逐字节一致（`git diff` 为空），单测文件同样未动。本文 §4–§10 的逐行分析对当前 HEAD 完全有效，文内包文件行号即为当前行号。
- **集成点全部存活**：四个被修改文件在合并后又经历了 30+ 个其他 PR（DSV4、GLM-5.2/950、HiCache、投机解码等）的演进，但本特性的 8 处调用点（environ 注册、pool_configurator 钩子、内存池守卫、后端初始化/图回调/两处分发）原样保留，仅行号漂移（文中引用已更新为当前行号）。
- **数据流闭环确认**（设计与实现完全对上）：

```text
dsa_npu_indexer.forward_npu()                       # layers/attention/dsa/dsa_npu_indexer.py
  ├─ pool.set_index_k_buffer(layer, out_cache_loc, k)   # 索引 KV 写入设备驻留缓存（不走卸载）
  └─ npu_lightning_indexer(q, index_k_buffer, sparse_count=index_topk)
        → topk_indices                                 # 设备端 top-k 选择
RadixAttention.forward(..., topk_indices)            # layers/radix_attention.py:449
AscendAttnBackend.forward_decode / forward_extend    # topk_indices is not None 时
  ├─ 特性开启 → forward_sparsity_driven_kv_offload   # 本文 §7
  └─ 否则     → forward_sparse（基线）               # 见 16.2
```

索引器返回 `topk_indices[0].squeeze(1)`（`[B,1,K]` 形态），这正是 manager 里 `normalize_batch_topk_indices` 要兼容三种形状的由来。

### 16.2 基线 `forward_sparse` 对比（被替代的原路径）

读完整后端后可以更精确地刻画差异。基线（ascend_backend.py:1145）的每步：

1. `set_kv_buffer(layer, out_cache_loc, k, k_rope)` —— 新 KV 写入**分页设备池**；
2. `k_nope, k_pe = get_kv_buffer(layer)` —— 取**全量**分页缓存视图；
3. `npu_sparse_flash_attention(..., layout_kv=PA_BSND, block_table=..., sparse_mode=3)` —— 稀疏 FA 以 block_table 间接寻址访问全量分页缓存中的 top-k 行（另有一条 950 专用的 `npu_kv_quant_sparse_flash_attention` FP8 变体）。

对比之下卸载路径的替换关系一目了然：第 1 步换成 `offload_v2`（写主机注册内存），第 2 步换成 `materialize_selected_kv`（紧凑缓冲），第 3 步换成 BSND 恒等索引的紧凑 FA。**索引器的 top-k 选择逻辑两边完全相同**——这就是"系统级无损"论断的代码依据。

### 16.3 模型门禁的实际覆盖面已扩大

`is_deepseek_dsa`（configs/model_config.py:187）在合并后扩容，现覆盖 DeepseekV3/V3.2/NextN、MistralLarge3、Pixtral、**GlmMoeDsa**（GLM-5.2）、Glm5Next、LongcatFlash、Dots3Note、HYV4 等十余种架构（要求 `index_topk` 存在）。因此本特性的模型条件今天实际是"任意 DSA 家族 + Ascend MLA 后端"，比 PR 时期的"DeepSeek V3.2 / GLM-5.x"宽得多。另注意 `dsa_layer_skips_topk`：LongCat 每 `cli_factor` 层、部分模型以 `indexer_types="shared"` 复用上层 top-k——卸载路径按层独立物化，复用索引的层自然获得 100% 相邻层命中率，功能正确且恰好受益。

### 16.4 共享文件的后续演进（与本特性的交互）

- **FP8 DSA KV 池**（`dsa_kv_cache_store_fp8`，PR #38250，面向 950/GLM-5.2）：把索引+latent 打包进 FP8 的 k_buffer。与卸载特性无显式互斥守卫，但组合下 `k_buffer=None` 使 FP8 打包分支不可达，且分发顺序（offload 先于 forward_sparse）保证不会误入 FP8 内核——实际是两代硬件（910C 卸载 vs 950 FP8）各自的路线，属良性互斥；
- **部分层索引器**（`indexer_layer_ids`）：`index_k_buffer` 现按 `num_indexer_layers` 分配而非全层数，索引器层槽位经 `_get_indexer_slot` 映射。卸载特性只读 `layer_num` 尺寸的 latent 形参、不触碰索引缓冲布局，不受影响；
- **pool_configurator**：钩子周围新增了 GLM DSA 层分离的 `effective_num_layers` 逻辑，本特性的 index-only cell size 分支仍在最前优先命中。

### 16.5 增补评注

- config.py 从 `runtime_context.attention_backends() / get_schedule()` 读取**解析后**的配置（config bag），而非原始 ServerArgs 字段——这是 PR 最后一笔提交（333c8fb）的修正，避免分离后端/默认容量在参数别名下漏检，也是后续同类特性应该模仿的做法；
- 通读全量代码后维持 §14 的全部评注不变，且可追加一条：**offload 包对 `sgl_kernel_npu` 的三个算子（`create_shm_tensor / slot_map_lookup / unidex_copy_inplace`）是硬依赖**，无 GPU 回退、无 CI 环境下的 mock——这解释了为何单测只覆盖 config 层。
