---
title: "vLLM HiSparse 本地 KV 卸载架构"
date: 2026-09-19 22:00:00
tags: [vLLM, KV Cache, HiSparse, 稀疏注意力, KV 卸载, 推理优化, MLA]
categories: [技术]
source: https://docs.vllm.ai/en/latest/design/hisparse/
---

> **来源**: vLLM 官方设计文档（developer preview / latest，2026-09-12 更新）
> **原文**: [HiSparse local KV offload architecture](https://docs.vllm.ai/en/latest/design/hisparse/)

状态：实验性（experimental）。

# vLLM HiSparse 本地 KV 卸载架构

## 速览

这套设计里有三种不同的职责：

1. 常规 KV cache 系统管理 GPU 块池（block pool）和块表（block table）。
2. `HiSparseCoordinator` 管理逻辑主机块、源前缀身份（source-prefix identity），以及主机/GPU 之间的驻留（residency）状态迁移。
3. `HiSparseConnector` 在 scheduler 和 worker 之间搬运驻留工作；`HiSparseWorker` 负责协调传输，而每个 cache 各自的 `HiSparseRuntime` 对象持有 host/hot 视图与 GPU 替换状态。

worker 侧的任何对象都不分配或释放逻辑块。HMA 提供驻留组和热组共享的 GPU 分配；它不管理 CPU 内存，也不持有任何 KV 身份。

```
request ────► HiSparseCoordinator ── source blocks + residency policy
                    │
                    ├──► KV cache manager ── resident/hot GPU leases (HMA)
                    │
                    └──► HiSparseConnector ── host bytes + copies + GPU LRU
```

这是一个本地 KV connector。当同时配置了 P/D 或其他卸载 connector 时，`MultiConnector` 会把它与 `HiSparseConnector` 组合起来。

`host_pool_gib` 配置在 `HiSparseConnector` 上，是每个数据并行副本（data-parallel replica）可用的主机缓存容量，而不是节点级的内存预算。张量并行（TP）的各 rank 持有同一份逻辑缓存的复制视图。这些视图可以使用每个 rank 私有的后备内存，也可以共用一份物理分配，配置的容量不变。因此物理主机内存的实际占用取决于拓扑和实现。实际可用容量可能略小，因为预算会向下取整到完整的主机块。

## 所有权

| 对象 | 所有者 | 「所有者」的含义 |
| --- | --- | --- |
| HiSparse 源与前缀身份 | `HiSparseCoordinator` | 把 token 映射到逻辑主机块 |
| 驻留 GPU 块租约 | 常规 KV cache manager | 分配和释放 HMA 块 |
| 驻留块表 | 常规 KV cache manager | 告诉 attention 驻留页在哪里 |
| 驻留状态迁移 | `HiSparseCoordinator` | 规划「先换出、再释放」的事务 |
| 逻辑主机块分配 | `HiSparseCoordinator` | 拥有独立的 CPU 块池及其生命周期 |
| 锁页主机池生命周期 | `HiSparseWorker` | worker 级的后备内存与销毁 |
| 每 cache 的主机视图与热内容 | `HiSparseRuntime` | 绑定 host/hot 存储，填充 cache manager 提供的热租约 |
| 热行映射与 LRU | `HiSparseRuntime` | 解析命中，并在 GPU 上挑选受害者 |
| 驻留缓存路由 | `HiSparseCacheHandle` | 向 attention 暴露驻留或 host/hot 解析 |
| 稀疏注意力 | attention backend | 消费设备缓存和物理行 ID |
| HMA | 分配器 | 提供 GPU 容量；不持有任何 KV 语义 |

关键的区分是「逻辑分配」与「内容」。`HiSparseCoordinator` 拥有主机块 ID 及其与请求/前缀的关联；`HiSparseWorker` 和它下面的各 cache runtime 拥有对应的字节。常规 cache manager 只看得到设备池。source group 的 `block_pool_id=None`；设备池的消费者在用它索引之前必须先收窄这个值，这样主机所有权就无法伪装成一个数字型的 GPU 池。

## 代码边界

```
scheduler process                           worker process

HiSparseConnector                          HiSparseConnector
  └─ HiSparseCoordinator                         └─ HiSparseWorker
       │                                          │
       │ connector metadata                       ├─ host bytes
       │ - page transfers                         ├─ copy scheduling
       │ - block-table replacements               └─ per-layer hot state
       └───────────────────────────────────────────────►│
       ◄──────── connector worker metadata ─────────────┘
                    enqueued and completed transfer IDs
```

指令经 `kv_connector_metadata` 下发；传输更新经 `KVConnectorOutput.kv_connector_worker_meta` 返回。model runner 不解释 page transfer。入队确认（enqueue acknowledgement）让 scheduler 能按流顺序释放源租约；完成确认负责发布已拷贝好的主机页。

## 驻留设备页

驻留页被有意放在 `HiSparseRuntime` 之外。

KV cache 初始化时，在构造 `HiSparseWorker` 之前，先把 cache manager 的分配绑定到面向 attention 的 `HiSparseCacheHandle` 上。同一个 handle 的 runtime 保留传输计划所需的驻留源索引。这里没有第二个驻留对象，也没有额外的注册包装层。

```
KV cache setup
   │
   ├─ bind resident allocation ──► HiSparseCacheHandle
   │                               cache + block table + slot mapping
   │
   ├─ bind host/hot allocation ──► HiSparseRuntime
   │                               host + hot + GPU LRU
   │
   └─ register cache handles ────► HiSparseWorker
                                   step-level transfers

HiSparseWorker registers the same HiSparseCacheHandle objects directly
```

attention 构造时，把每一层链接到真正持有 indexer 的最近一层。这会在 GPU 内存 profile 之前释放 follower 层重复的 LRU 张量。缓存绑定只负责挂接存储；它不会从物理 packed-tensor 的排列顺序去推断语义分组。构造游标（construction cursor）随 worker 的锁页状态一起销毁。

每个 HiSparse decode batch 都使用同一个融合解析器（fused resolver）。它先查驻留页，再查热行，最后查锁页主机内存。驻留命中在 kernel 内部就直接返回，不会走热行 LRU 查找或主机拷贝；没有框架级的驻留路由，也没有单独的 CUDA graph。decode 路径上不新增任何 CPU 决策。解析器直接消费 attention metadata 里已有的、graph 稳定的请求映射；worker 和各个 cache handle 都不保留重复的映射。

投机解码（speculative decoding）按顺序解析并消费每个验证步。每一步拿到各自可重放（replayable）的计划行，同时共享该请求的热缓存状态，因此后一步不可能在前一步消费之前复用某个热行。

## P/D 导入目标

decoder 对每个请求只依据常规 cache 准入计算做一次落地目标的选择。如果完整的导入前缀装得进设备池，NIXL 会把它直接传进驻留 GPU 页。否则，若固定的「主机后备 GPU 占用」加上主机源块装得下，请求就导入主机层（host tier）。这里没有上下文长度阈值之类的启发式；等待容量的请求在多次准入重试之间保持既定选择不变。

主机导入会先经过一个有界的 decoder-GPU 暂存池（staging pool），再拷入已注册的主机内存。立即需要的页会在这次拷贝中同时镜像到各自的驻留目的地。两种落地目标随后都使用上文描述的同一个融合 decode 解析器。

## 索引器 KV 卸载

HiSparse 不为 indexer KV 维护私有的 CPU 副本。indexer 仍是一个正常的、可做前缀缓存的 GPU cache 组。如果 `OffloadingConnector` 与 HiSparse 一起配置，它会经由通用 KV 卸载路径存储和恢复该组；HiSparse 继续只拥有稀疏 MLA 的主机层。

两个前缀源的命中长度可能不同。当 HiSparse 主机前缀超出 GPU 驻留的 indexer 前缀时，scheduler 会请求 `OffloadingConnector` 只恢复缺失的 indexer 后缀，并截断到主机前缀边界。如果该后缀不可用，所有组回退到它们共同拥有的较短前缀。NIXL P/D 传输仍把 indexer KV 直接放进它的 GPU 组。

## 换出（Spill）事务

一个驻留块在其内容尚未交给 worker 之前不能被复用。

```
HiSparseCoordinator                            HiSparseWorker
          │                                     │
          │ pin source and destination leases   │
          │── SparseKVPageTransfer ─────────────►│
          │                                     │ enqueue GPU-to-host copy
          │◄── enqueued transfer ID ────────────│
          │ replace resident table entry        │
          │ release resident lease to HMA       │
          │                                     │ copy reaches its event
          │◄── completed transfer ID ───────────│
          │ mark host page valid                │
          │ release destination host lease      │
```

「enqueued」表示拷贝已进入 worker 流。流顺序保证此时复用驻留 GPU 块去做后续工作是安全的，但主机页还没有发布。「completed」表示 worker 已观察到该拷贝的事件；只有到那时，coordinator 才发布主机页供前缀复用，并释放其目的租约。另有一个独立的 host-write 事件，保护直接读 CPU 的读者，使其不会看到已在加速器上排队的写。

worker 传输里只包含传输 ID 和物理拷贝坐标。请求身份和逻辑页状态都留在 scheduler。

## 热行查找与 LRU

NVIDIA CUDA 路径把替换逻辑全部留在加速器上：

```
top-K logical positions
        │
        ▼
resident page? ── yes ──► resident physical row
        │ no
        ▼
hot row? ──────── yes ──► existing hot physical row + update GPU LRU
        │ no
        ▼
choose GPU LRU victim ──► copy pinned host row ──► hot physical row
```

目前不支持 ROCm，因为融合的 HiSparse cache 操作只有 CUDA kernel 实现。未来的平台特定 worker 可以提供相同的 command、output 与 cache 解析边界。

## 主要类

| 类 | 继承 / 实现 | 职责 |
| --- | --- | --- |
| `HiSparseCoordinator` | 纯 scheduler 组件 | 主机分配、源前缀、驻留租约与换出状态机 |
| `HiSparseConnector` | `KVConnectorBase_V1`、`SupportsHMA` | scheduler/worker 元数据与生命周期边界 |
| `HiSparseResidentManager` | `SingleTypeKVCacheManager` | 常规块池簿记，支持主机后备的空洞 |
| `PagedCacheView` | 不可变数据对象 | 共享的驻留/热 HMA 张量绑定 |
| `HiSparseWorker` | connector 持有的 worker 组件 | worker 级传输调度与主机池生命周期 |
| `HiSparseRuntime` | worker 持有的纯组件 | 每 cache 的 host/hot 张量、GPU LRU 与融合解析 |
| `HiSparseCacheHandle` | 纯 attention 组件 | 驻留视图与融合缓存解析 |
| `SparseKVOffloadCommand` | dataclass | scheduler 到 worker 的不透明工作单元 |

## 性能不变量

- 驻留命中在融合解析器内部绕过热行 LRU 查找与主机拷贝。
- 热行查找、受害者选择和 LRU 更新全部在 GPU 上完成。
- 热行未命中时仍直接从已注册的锁页主机内存拷贝。
- Top-K 解析留在 attention 调用内部，保持可被 CUDA graph 捕获。
- 兼容的层仍共享一份 miss 计划。
- 共享 index 的 follower 层在内存测算之前释放其私有 LRU 状态。
- 除非配置了通用 KV 卸载器，HiSparse 不碰 indexer KV。
- 驻留与热租约仍可共享同一份打包的 HMA 分配。
- 不新增任何设备标量回读（readback）或 CPU/设备间元数据往返。
- 抽象包裹融合 kernel，不额外增加 kernel launch。
- HiSparse 关闭时，scheduler 不会构造卸载命令，也不会构造空更新表。

## 仍属于平台特定的部分

command/result 与 attention 层的边界可以共享。主机分配器、拷贝实现、热行布局和替换策略应当保持平台特定。NVIDIA 使用当前的加速器端 LRU 与融合 host/hot kernel。目前不支持 ROCm；AMD 或其他加速器后端可以实现自己的 worker，而不必把 NVIDIA 的策略强加进共享边界。

---

**原文链接**: [HiSparse local KV offload architecture](https://docs.vllm.ai/en/latest/design/hisparse/)
