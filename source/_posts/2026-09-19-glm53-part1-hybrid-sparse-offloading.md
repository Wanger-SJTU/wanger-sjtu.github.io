---
title: "GLM 5.3 优化（一）：vLLM 的 Hybrid HiSparse 混合稀疏卸载"
date: 2026-09-19 23:00:00
tags: [vLLM, GLM, HiSparse, KV Cache, 稀疏注意力, KV 卸载, 推理优化, MTP]
categories: [技术]
source: https://vllm.ai/blog/2026-09-08-glm53-part1-hybrid-sparse-offloading
---

> **来源**: vLLM 官方博客（2026-09-08）
> **原文**: [GLM 5.3 Optimizations, Part 1: Hybrid HiSparse Offloading in vLLM](https://vllm.ai/blog/2026-09-08-glm53-part1-hybrid-sparse-offloading)
> **相关阅读**: 本博同日翻译的 [vLLM HiSparse 设计文档（附 SGLang 对照）](/2026-09-19-vllm-hisparse-local-kv-offload-architecture/)正是这套机制的详细设计。

**TL;DR**：vLLM 的使命是让推理更快、更便宜地服务。在这个两篇系列中，我们介绍为 GLM 5.3 引入的新优化：第一篇演示 Hybrid HiSparse 如何在单台 8× H200 节点的聚合部署上施展身手——对这个规模的模型而言，该硬件的内存相当紧张。Hybrid HiSparse 使 GLM 5.3 能以完整 100 万上下文长度运行（此前在这套硬件上不可能），并在各上下文长度下都获得显著更高的并发。

## 在需要时利用稀疏性

Agent 型负载的特点是大量并发请求，每个请求都带着一条不断增长的长上下文。由于 GPU 块池是固定的，KV cache 迟早会没有空间容纳并发请求申请新块。

此前应对这个问题主要有两条路，各有代价：

- **抢占（preemption）**：挑一个请求，丢掉它的 KV cache，之后重新 prefill。每次被驱逐，该请求都要重新付一遍完整的 TTFT。

- **卸载（offloading）**：把块搬到主机内存，但稠密注意力要求每个 token 都驻留在 GPU 上，因此并发请求数仍受 GPU 显存约束。

对 sparse-MLA KV cache 而言，indexer 会选出 top-K 个 token、只关注它们。HiSparse 利用这一行为，把**除被选中 token 之外**的所有 KV cache 都卸载到 CPU，相当于为每个请求的 GPU 显存需求给出一个有效的上限。indexer KV 仍然驻留 GPU、仍随上下文长度增长，但总量小得多；而且 GLM 5.3 的 IndexShare 意味着每四个 sparse-MLA 层只共享一个 indexer 层。

我们在此基础上引入 **Hybrid HiSparse**：只要 GPU 容量足够，KV cache 就继续留在 GPU 上；只有当 KV cache 承受压力时，才启用上述 HiSparse 卸载机制。热缓冲页以 token 为单位索引，因此一页可以装下来自许多不同 CPU 块的 token，从而在很宽的上下文跨度上做归约。这样，Hybrid HiSparse 只在系统处于 KV cache 压力之下（也就是更高并发）时，才付出 CPU–GPU 内存搬运的成本。

![一个块池、两个不断增长的请求：抢占 vs 卸载](asset/glm53-hisparse/hisparse-two-requests.svg)

*抢占：B 的槽位被释放、KV 随之消失。常规卸载：B 的 KV 在主机上幸存、无需重新 prefill，但在全部装回 GPU 之前 B 仍然无法运行，于是只剩 A 在解码。混合稀疏卸载：每个请求原地释放自己最冷的页，同样的槽位被重新租约为新的尾部与热页，两个请求都在继续解码。*

只有 Hybrid HiSparse 能让两个请求都在解码。热页与 KV 页从同一个块池租借；更重要的是，它们住在同一个 KV-cache 张量里，因此在稀疏 MLA kernel 看来就是普通页。混合稀疏独有的一点是：部分 token 可以存在于热缓冲，同时另一些 token 还存在于 GPU 驻留页中，从而减少 CPU 重载量。

## 工作原理

![同一个共享 GPU 块池上的三种 KV 驻留状态](asset/glm53-hisparse/hisparse-residency.svg)

*三个面板中圈出的都是同样的六个 top-K token，变化的只是它们的驻留状态。实线箭头：miss 时把一行拷入热页。虚线箭头：热命中，无需拷贝直接复用。*

驻留状态按页跟踪，因此随着压力升降，一个请求会在三个状态之间迁移：

- **全驻留（full residency）**：所有 sparse-MLA KV 保持驻留 GPU，同时已完成的 prefix 页被主动物化到主机内存。

- **混合驻留（mixed residency）**：请求的尾部留在 GPU，较老的页只存在于 CPU 内存，而 indexer 需要的那些页上的行放在热缓冲里。块表中真实块与空占位并排存在，且尾部永不被驱逐。一个融合 kernel 完成 top-K 解析：驻留 token 原地读取；热 token 读取并刷新其 LRU 表项；miss 则从锁页主机内存把单行拷入一个 LRU 槽位。decode 路径上没有任何环节要等 CPU 决策，因此整条路径保持可被 CUDA graph 捕获。

- **零驻留（no residency）**：复用只存在于 CPU 内存中的前缀的新请求，从占位符和一页热页起步。行随着 indexer 选中它们而到达——我们只为模型真正关注的内容付费，而不是整段历史。

三种状态之所以都可行，是因为热缓冲不是一份独立分配。一个热缓冲页就是一个普通的 KV-cache 块，通过 vLLM 的混合内存分配器（HMA）从同一个池租借：请求第一次需要时取用，不再需要时归还。无论行位于驻留页还是热缓冲，解析器交出的都是 HMA 行 ID，HMA 以一次 stride 完成汇聚。一个请求释放的块，可以变成另一个请求的热缓冲容量。

HiSparse 在压力到来之前就做准备。当一个可缓存的前缀页完成时，HiSparse 排队一次到 CPU 内存的拷贝，同时继续从 GPU 服务它。若 GPU cache 之后被填满，该页可以无需再次拷贝就释放 GPU 槽位。即使压力先落到较新的页上，其 GPU 槽位在拷贝入队那一刻起就可复用，CPU 副本则在传输完成后可用于前缀复用。

`hisparse-glm` 分支让这条路径保持轻量：前向传播之后，用一次 launch 把所有 sparse-MLA 层一起拷走。拷贝按模型 GPU 流上的顺序排队，同步因此简单而安全。

## 与 vLLM 其余部分的组合

Hybrid HiSparse 是共享 HMA 池之上的一种驻留策略，也是与 vLLM 其他 KV 机制并列的一个 connector，因此栈的其余部分照常工作。其他 cache 组照旧使用普通的前缀缓存、传输与卸载；尤其是 indexer KV 完全不经 HiSparse 之手：标准的 OffloadingConnector 可以用普通的块粒度存储独立卸载它。来自 P/D 分离的导入在 prefix 装不进驻留层时可以落在主机侧；投机解码则通过每步可重放的解析器计划工作，各验证步共享请求的热状态。

热缓冲默认为每请求 2× top-K 行，在保持缓冲小巧的同时确保高命中率。由于 MLA KV 在各 TP rank 间完全相同，锁页主机池按 DP 副本分配、由其本地 TP rank 共享。TP rank 0 写入共享副本，每个 rank 都可读取，一个 CUDA event 保证流顺序。

## 实测数据

我们在 8× H200 上用 OpenHands 多轮 Agent 负载（源）对 GLM 5.3 做了基准：13 轮对话，首轮 74,160 token，后续各轮 753 token，固定 220 token 输出。两组 TP8 部署都使用 MTP3、FP8 KV cache、142K 准入上限、`max_num_batched_tokens=32768`、`max_num_seqs=256`、`gpu_memory_utilization=0.92`。卸载基线使用 512 GiB 卸载池；Hybrid HiSparse 把同一份主机预算拆成 384 GiB HiSparse 池 + 128 GiB 普通卸载。

![GLM 5.3 的交互性–吞吐 Pareto 与实测并发运行请求数](asset/glm53-hisparse/openhands-pareto-occupancy.svg)

*上：交互性–吞吐扫描。交互性 = 1000 / 平均 TPOT；逻辑总 token 吞吐含前缀缓存命中的 prompt token，并已除以八块 GPU。下：各基准点期间采集的非零 `vllm:num_requests_running` 样本均值。Hybrid HiSparse：`e8ef1e07bd`；卸载基线：`80cb71c9ff`。*

我们计划在 vLLM v0.30 中让 Hybrid HiSparse 广泛可用。在那之前，这些结果对应的确切启动命令与基准客户端配置见下方复现附录。

## 只在需要的地方卸载

Hybrid HiSparse 只在需要的地方卸载。KV 从 GPU 起步，只要有空间就留在那里；池子吃紧时再一页一页地让出驻留。热缓冲与驻留页共享池和张量，因此承压的请求以部分驻留继续解码，而不是等一个空槽、或为再次 prefill 自己付费。

## 估算你的配置能获得多少收益

下面的计算器用同样的可用 HBM 估算普通 GPU 驻留 KV 与混合稀疏卸载的容量。调整负载、GPU、并行度、热缓冲与主机池，即可近似一个部署。调整数值能直观感受并发可能提升多少。

计算器给出不让 CPU 内存拖后腿（即不拖累 GPU 侧 indexer 与热缓冲所能支撑的并发）所需的最小 HiSparse 主机池。原生 indexer 卸载被建模为另一个独立的 CPU 总池：它扩展前缀缓存，但活跃的 indexer 历史仍消耗 HBM，因此仍是运行请求数上限的一部分。图表在假设 HiSparse 主机容量不设限的前提下，比较不同序列长度下 HiSparse 与普通 GPU 驻留的总并发。热缓冲给每个请求增加一笔固定 GPU 开销，因此短上下文下普通驻留能塞下更多请求；上下文更长时，对 sparse-MLA 驻留的封顶让 HiSparse 能维持更多并发请求。加大热缓冲就是拿一部分容量换取更广的热缓存覆盖。

注：这些是规划估算，不是保证的服务上限——运行时 workspace、请求长度偏斜与调度行为都可能降低实际达到的并发。

注：MTP 会进一步约束并发，因为其热缓冲必须一次容纳所有验证 token。截至发文，这意味着每个热缓冲要按 `(num_speculative_tokens + 2) × top-K` 配置。随着我们不断缩小缓冲，这一约束可能改变；当前计算器尚未计入该项，因为我们计划放宽它。

（译注：以下并发估算器内嵌自[原文页面](https://vllm.ai/blog/2026-09-08-glm53-part1-hybrid-sparse-offloading)，为自包含页面、本地加载运行；也可[全屏打开](hisparse-calculator.html)。）

<iframe src="hisparse-calculator.html" height="1520" title="Hybrid sparse offloading concurrency calculator" loading="lazy" scrolling="no" style="width:100%;border:0;border-radius:0.75rem;"></iframe>

<a href="hisparse-calculator.html" target="_blank" rel="noopener">全屏打开并发估算器</a>

## 第二部分预告

这是 GLM 5.3 服务系列的第一篇。Hybrid HiSparse 在 P/D 部署的 decode 侧最为关键——那里上下文最长、KV 压力最大。第二篇我们将在大规模部署上把各部分组装起来，结合新旧优化：Prefill Context Parallelism（PCP）、Decode Context Parallelism（DCP）、自适应验证（adaptive verification）与 Hybrid HiSparse。

## 致谢

vLLM 的 Hybrid HiSparse 实现由 Matthew Bonanni（Red Hat）、Lucas Wilkinson（Red Hat）与 Fares Obeid（Prime Intellect）开发。设计与 Chao Lei（蚂蚁集团）、Nicolò Lucchesi（Mistral）密切协作打磨。Simon Veitner（Red Hat）参与了性能评估与本文写作。我们感谢 HiSparse 的作者们提出了本工作所采用的稀疏卸载概念。

## 附录：复现我们的结果

上述结果使用 vLLM `e8ef1e07bd`。我们计划在 v0.30 让 Hybrid HiSparse 广泛可用；在此之前，请构建上述固定 commit。在单台 8× H200 节点上按以下配置启动 Hybrid HiSparse：

```bash
vllm serve zai-org/GLM-5.3 \
 --served-model-name glm-agentx \
 --trust-remote-code \
 --host 0.0.0.0 \
 --port 8000 \
 --tensor-parallel-size 8 \
 --kv-cache-dtype fp8 \
 --gpu-memory-utilization 0.92 \
 --max-model-len 142000 \
 --max-num-batched-tokens 32768 \
 --max-num-seqs 256 \
 --enable-prefix-caching \
 --attention-config '{"hisparse_config":{"host_pool_gib":384}}' \
 --kv-transfer-config '{"kv_connector":"OffloadingConnector","kv_role":"kv_both","kv_connector_extra_config":{"spec_name":"TieringOffloadingSpec","cpu_bytes_to_use":137438953472}}' \
 --speculative-config '{"method":"mtp","num_speculative_tokens":3}' \
 --enable-auto-tool-choice \
 --tool-call-parser glm47 \
 --reasoning-parser glm45
```

`host_pool_gib` 按 DP 副本计，并向下取整到完整主机块。128 GiB 卸载池存储不由 HiSparse 管理的 cache 组，包括 indexer KV。要复现不带 MTP 的 HiSparse，省略 `--speculative-config`。图中不带 HiSparse 的 MTP3 基线：保留 `--speculative-config`、省略 `--attention-config`、并把 `cpu_bytes_to_use` 改为 `549755813888`（512 GiB）。不带 MTP 的基线则把 HiSparse 与 `--speculative-config` 都省去。HiSparse 目前仅支持 NVIDIA GPU。

### 复现填充版 OpenHands 扫描

基准客户端所需的一切都随本文发布，配方自包含：`build_openhands_padded_dataset.py`、`install_evalscope_deps.sh` 与 `evalscope-all-nodeps.txt`，三者下载到同一目录。EvalScope 固定在 `acd09b44384d53174768bb1063f675420f76fae9`。以下先构建确定性的 128 组对话数据集，再在每一点都换新对话跑 c1/c8/c16/c24/c32：

```bash
python3.12 -m venv client-venv
source client-venv/bin/activate
bash install_evalscope_deps.sh
pip install 'modelscope[datasets]==1.34.0' 'lxml==6.0.2'
pip install 'evalscope[perf] @ git+https://github.com/modelscope/evalscope.git@acd09b44384d53174768bb1063f675420f76fae9'

python build_openhands_padded_dataset.py \
 --model zai-org/GLM-5.3 \
 --pad-source openscience \
 --first-turn-length 74160 \
 --subsequent-turn-length 753 \
 --num-turns 13 \
 --number 128 \
 --output-path openhand-zai-org-GLM-5.3.json

evalscope perf \
 --model glm-agentx \
 --url http://127.0.0.1:8000/v1/chat/completions \
 --api openai \
 --dataset swe_smith \
 --dataset-path openhand-zai-org-GLM-5.3.json \
 --dataset-offset 52 \
 --max-tokens 220 \
 --multi-turn \
 --number 4 16 32 48 64 \
 --parallel 1 8 16 24 32 \
 --extra-args '{"ignore_eos":true}' \
 --name tp8-hisparse384-native128 \
 --outputs-dir results \
 --no-timestamp
```

图中指标口径：交互性 = `1000 / mean_TPOT_ms`；每 GPU 逻辑总 token 吞吐 = EvalScope 总 token 吞吐除以八。每个点期间每 30 秒抓取一次 `/metrics`。请求占用取非零 `vllm:num_requests_running` 样本均值；MTP 接受长度 = `1 + Δ(vllm:spec_decode_num_accepted_tokens_total) / Δ(vllm:spec_decode_num_drafts_total)`。

---

**原文链接**: [GLM 5.3 Optimizations, Part 1: Hybrid HiSparse Offloading in vLLM — vLLM Blog](https://vllm.ai/blog/2026-09-08-glm53-part1-hybrid-sparse-offloading)
