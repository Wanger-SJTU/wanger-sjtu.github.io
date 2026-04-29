---
title: "SWARM - 多SSD协同激活感知的KVCache卸载"
date: 2026-04-29
tags: ["论文翻译"]
mathjax: true
source: 2603.17803
---

# SWARM: 多SSD协同激活感知的KVCache卸载

**作者**: Tuowei Wang, Liyun Chu, Ruwen Fan, Ju Ren（清华大学）

**arXiv**: 2603.17803

**发表**: FAST 2026（File and Storage Technologies）

---

## 摘要

键值（KV）缓存已成为大型语言模型（LLM）推理过程中内存消耗的主导因素。虽然将KVCache从GPU高带宽内存（HBM）卸载到CPU DRAM可以缓解设备内存压力，但DRAM容量受限且成本高昂，难以支持大规模持久化工作负载。固态硬盘（SSD）提供了一种经济高效的替代方案，但朴素的基于SSD的分页机制由于PCIe吞吐量和单设备带宽限制，本质上是带宽受限的。本文发现，现实世界工作负载中KVCache的激活表现出强且稳定的相关性。我们将这一现象称为**KVCache协同激活（KVCache Co-Activation）**——访问一个KV条目通常伴随一组稳定且重复出现的其他KV条目的访问。利用这一特性，我们提出了**SWARM**，一个基于SSD的KVCache卸载系统，将带宽受限的单设备访问转化为多SSD并行I/O。具体而言，SWARM离线地将协同激活的KV条目聚类，并通过基于图的放置策略和选择性复制将产生的聚类分布到多个SSD上，以最大化并行I/O带宽。在运行时，SWARM执行负载均衡的聚类检索，并动态调整聚类和缓存决策，以在不断演变的访问模式下维持高带宽利用率。评估结果表明，SWARM将I/O时间缩短了**2.41倍**，有效带宽利用率提升了**2.72倍**。

---

## 1 引言

键值（KV）缓存是现代大型语言模型（LLM）推理的核心组件。通过存储先前计算的键和值，它消除了冗余计算并实现了高效的自回归解码。然而，KVCache随序列长度和模型深度单调增长，其生命周期远远超出单个解码步骤。随着上下文长度不断扩展[22,27,48]和模型加深[17,28,42,45]，KVCache已成为推理时内存占用的主导因素。除了每个请求的占用量之外，KVCache越来越多地在不同请求和会话之间持久化。例如，长文档或视频通常会用不同问题反复查询[6,11]。类似地，代理风格的交互经常复用先前步骤的工具指令[18,40]和上下文[50,51]。现实世界的生产部署[3,36]已报告存在大量长共享KVCache。因此，KVCache已从临时产物演变为长期存在的数据结构，使其成为持久化存储的自然且极具吸引力的候选对象。因此，设计一个针对KVCache管理量身定制的可扩展高效存储系统变得越来越关键。

鉴于GPU侧高带宽内存（HBM）容量有限且成本高昂，KVCache通常被卸载到CPU侧的动态随机存取内存（DRAM）[16,23,41]。为了减少DRAM和HBM之间的I/O开销，近期工作[44,47,53,54]利用注意力机制的内在稀疏性，仅选择性激活和传输最相关的KV进行计算。然而，DRAM容量仍然有限且昂贵[24,43]，使其不足以承载大规模、持久化的KVCache。在此背景下，固态硬盘（SSD）成为KVCache卸载的一种有吸引力的替代方案。与DRAM相比，SSD提供数量级更高的容量，且每比特成本更低，使其非常适合承载大规模持久化KVCache状态。这一成本-容量优势促使业界对基于SSD的KVCache存储越来越感兴趣，作为通向可扩展推理的路径[7,12,14,39]。遗憾的是，朴素地在SSD和DRAM之间分页KVCache被证明是低效的[20,37]。与DRAM不同，SSD通过相对较窄的PCIe接口访问，且提供有限的单设备带宽[7]。因此，从SSD提供的KVCache访问成为带宽受限的，导致注意力计算停滞并增加推理延迟。

本文提出了一个关键观察：LLM中的KVCache在其激活模式上表现出强相关性，我们将这一现象称为**KVCache协同激活**。这一特性在LLM工作负载中普遍存在，却基本未被充分探索，可以被策略性地利用来缓解KVCache卸载过程中的SSD带宽瓶颈。具体而言，在处理现实世界数据集时，单个KV对的激活始终伴随着一组稳定且重复出现的其他KV对的激活。这些协同激活的KV可以被同时获取，自然地暴露了可被利用来提高有效SSD带宽的I/O并行性。受此观察启发，我们提出了**SWARM**，一种新颖的基于SSD的KVCache卸载解决方案。SWARM不依赖单个SSD并受单设备带宽约束，而是将KVCache卸载到多个SSD上，并通过策略性地聚合所有设备的带宽来提升性能。SWARM的一个关键思想是将KVCache协同激活模式与多SSD I/O并行性对齐：频繁协同激活的KV对被识别、分布、检索和跨SSD更新，以最大化并行读取。如图1所示，SWARM将基于SSD的KVCache卸载从带宽受限的单设备操作转变为高度并行的多设备数据路径，实现了高效且可扩展的KVCache管理。

SWARM采用两阶段设计，包含离线执行的分层优化和在线执行的分层优化：

**离线阶段**：SWARM捕获KVCache协同激活模式，并将KV条目组织成相关性感知的聚类，同时使用聚类中心作为代表构建轻量级驻留在DRAM中的索引。在这一聚类布局的指导下，它将KVCache划分到DRAM-SSD层次结构中——将中心点、局部窗口条目和热聚类保留在DRAM中，并将剩余的聚类条目分布到SSD上以实现并行检索。

**在线阶段**：SWARM使用负载均衡调度在多SSD布局下高效检索所选聚类，开销可忽略不计。它还在解码过程中动态调整聚类成员关系和缓存决策，以在不断演变的访问模式下维持高带宽利用率和检索效率。

我们在两个类型的SSD上使用四个现实世界数据集对SWARM进行了评估，并基准测试了五个代表性LLM。结果表明，SWARM平均将I/O时间缩短了**2.41倍**，有效带宽利用率平均提升了**2.72倍**。值得注意的是，当扩展到八个SSD时，SWARM达到了高达**37.67 GB/s**的带宽，与GPU HBM和CPU DRAM之间的带宽相当。

我们的贡献总结如下：

- 我们识别了LLM推理中一个普遍存在却未被充分探索的现象——**KVCache协同激活**，并展示了如何利用它来缓解基于SSD的KVCache卸载中的主要带宽瓶颈。
- 我们设计了一个两阶段解决方案，系统性地对跨SSD的协同激活KV进行建模、放置、检索和更新，最大化带宽利用率。
- 我们在多样化的LLM、数据集和硬件配置上进行了广泛评估，在性能和成本上均优于现有解决方案。

---

## 2 背景

### 2.1 自回归生成中的KVCache

最先进的LLM主要采用自回归解码，其中令牌是顺序生成的，每个新令牌都会关注所有先前生成的令牌。这一机制通过多头注意力（MHA）[46]实现。对于每个注意力头，输入令牌嵌入被投影为三个分量：Query（Q）、Key（K）和Value（V）。注意力计算定义如下：

$$
\text{Attention}(Q, K, V) = \text{softmax}\left(\frac{QK^T}{\sqrt{d_k}}\right)V
$$

其中 (d_k) 表示键向量的维度。在解码步骤 (t) 时，当前查询 (q_t) 关注所有先前生成的键（(K_{<t})）和值（(V_{<t})）。由于这些历史张量一旦计算就不会改变，在每个步骤重新计算它们会导致相当大且不必要的开销。这种冗余严重增加了响应生成延迟，使遵守服务级别目标（SLO）变得困难[39]。

为消除这一低效问题，现代推理系统存储和重用先前计算的键和值，统称为KVCache。在实践中，KVCache表现出两个显著特征：

**特征#1：巨大占用量**。对于具有 (L) 层和隐藏维度 (d) 的模型，长度为 (S) 的序列的KVCache内存占用规模为 (O(L \times S \times d))。随着模型变深和上下文窗口扩展以容纳长文档、代码仓库和多模态输入（如图像和视频），KVCache很容易超过模型参数本身的大小。如表1所示，在长上下文设置下，总KVCache占用量可能达到数百或数千GB，给LLM推理带来严重的内存压力。

**特征#2：时间持久性**。KVCache的生命周期超出单个解码步骤，甚至经常超出单个请求。一方面，长文档或视频可能在底层上下文保持不变的情况下用不同问题反复查询。另一方面，现实世界的工作负载，如多轮代理和迭代编码助手，在连续交互中持续重用历史上下文。在这两种情况下，丢弃和重新计算KVCache不仅浪费计算资源，还会引入可避免的延迟。如图2所示，有效重用KVCache可以显著减少首令牌时间（TTFT），特别是在前缀处理主导延迟的长上下文设置中。

**表1**：GPT-3（在FP16下）相对于模型权重的KVCache内存占用，随序列长度变化。

| 权重 | (s = 32K) | (s = 64K) | (s = 128K) | (s = 256K) | (s = 512K) |
|------|-----------|-----------|------------|------------|------------|
| 326 GB | 144 GB | 288 GB | 576 GB | 1.13 TB | 2.25 TB |
| 相对比例 | 0.44× | 0.88× | 1.77× | 3.53× | 7.07× |

---

### 2.2 三层KVCache卸载

KVCache的巨大占用量和时间持久性挑战着现有的内存层次结构。在实践中，GPU高带宽内存（HBM）作为第一层，提供低延迟和高吞吐量，但容量有限且成本高昂。为扩展可用内存池，CPU DRAM通常被用作卸载的第二层，提供比HBM高一个数量级的容量。在推理过程中，KVCache条目按需从CPU传输到GPU，通过PCIe接口。得益于现代PCIe链路[38]的高带宽和软件级优化（如预取[10,52]和缓存[12,14]），这一数据传输开销通常是可管理的。然而，DRAM容量在规模上仍然受到根本约束且成本高昂。随着KVCache在大小和生命周期上的增长，仅依赖HBM和DRAM在经济和实践上都变得不可持续。在此背景下，固态硬盘（SSD）正成为KVCache卸载的一种经济高效的第三层。SSD建立在NAND闪存[25]之上，提供比DRAM大得多的容量，可扩展到TB级别，且每比特成本更低。此外，现代服务器平台支持通过独立PCIe通道将多个SSD连接到单个CPU，实现灵活的容量扩展和设备级并行。然而，将SSD纳入内存层次结构将瓶颈转移到I/O带宽。尽管现代SSD利用高性能协议如非易失性内存快速（NVMe）[35]，但其带宽与DRAM相比仍然受到结构性限制。当KVCache驻留在DRAM中时，可以通过相对较高吞吐量的PCIe ×16链路传输到GPU。相比之下，大多数NVMe SSD通过PCIe ×4连接，仅提供DRAM和HBM之间可用带宽的一小部分。如图2所示，将KVCache卸载到SSD会引入大量I/O延迟，朴素的设计可能严重降低整体推理性能。

---

### 2.3 稀疏性驱动的KVCache激活

为缓解跨内存层级传输KVCache的开销，近期研究[44,47,53,54]利用注意力机制中固有的稀疏性。尽管上下文长度很大，但只有一小部分具有最高注意力分数的令牌主导最终注意力输出。如图3(a)所示，大部分KVCache可以被安全忽略，对模型输出的影响可以忽略不计。因此，无需激活和传输所有历史键和值，只需在每个解码步骤识别并加载这些关键令牌的KVCache条目就足够了。然而，基于稀疏性的KVCache激活面临两个关键挑战。首先，KVCache稀疏性模式本质上是动态的且依赖于查询。如图3(b)所示，激活的KV条目集在不同输入令牌之间存在差异。系统需要在每个步骤动态计算相关性分数（如查询-键内积）并高效检索关键条目，这需要一种高效的检索机制。其次，尽管稀疏性减少了数据传输和注意力计算，从而降低了整体推理延迟，但它并不能从根本上消除SSD带宽瓶颈。改进源于工作负载的缩减，而非有效I/O吞吐量的增加。因此，SSD带宽仍然处于推理的关键路径上，继续成为主要的性能约束。

---

## 3 动机与挑战

### 3.1 洞察：KVCache协同激活观察

本文旨在解决SSD带宽瓶颈，以实现高效且可扩展的KVCache卸载。我们的方法基于一个深刻但基本未被充分探索的观察：KVCache激活不是均匀随机的，而是表现出强相关性。如图4所示，在处理现实世界工作负载时，给定KV条目的激活通常伴随着一组稳定且重复出现的其他条目的激活。我们将这一现象称为**KVCache协同激活**，它自然地源于稀疏性驱动的KVCache激活，并一致地出现在不同模型和数据集上。这一观察表明存在利用结构化访问模式的机会。

**核心思想**。KVCache协同激活揭示了KVCache激活模式中的内在并行性。在每个KVCache协同激活组内，KV条目在计算上是独立的，因此可以并发获取而无需引入额外同步。这种并行性与现代存储系统的拓扑结构自然对齐，其中多个SSD通过独立PCIe通道连接。通过策略性地将协同激活的KV条目分布到多个SSD，系统可以聚合设备级带宽进行KVCache传输。产生的聚合带宽可以匹配甚至超过DRAM和HBM之间的有效带宽，从根本上缓解瓶颈。

### 3.2 主要挑战

尽管KVCache协同激活暴露了内在I/O并行性，将这一洞察转化为实际的基于SSD的系统绝非易事。基于综合分析，我们确定了四个必须解决的关键挑战：

**挑战#1：建模**。KVCache条目数量庞大且激活模式复杂，使得识别协同激活条目具有挑战性。如图5(a)所示，实践中的协同激活模式并非可清晰分离的，而是形成重叠结构，有些条目参与超过20个协同激活关系。选择性复制可以帮助解耦这些依赖关系，但这引入了一个NP难度的组合优化问题。

**挑战#2：放置**。除了识别之外，系统必须进一步将这些相关KV条目组织成结构良好的布局。具体而言，这一放置应自然地与SSD卸载层次结构对齐。一方面，协同激活的条目应尽可能均匀地分布到SSD上，以最大化并行读取带宽。另一方面，系统应能够高效选择这些条目，而无需先将它们传输到DRAM。

**挑战#3：检索**。复制使检索更加复杂。同一个KV条目可能驻留在多个SSD上，创建多条可行检索路径。如图5(b)所示，不同的检索路径可能产生明显不同的有效带宽，即使在相同的KVCache放置下也是如此。次优策略可能重新引入负载不平衡并抵消复制的益处，而过于复杂的调度可能产生禁止性的每步开销。

**挑战#4：更新**。LLM解码持续生成新的KV条目，需要集成到现有组织中。如图5(c)所示，朴素更新（基于组大小或嵌入相似性）可能严重降低协同激活概率，限制随时间可实现的并行性。此外，缓存决策应适应不断演变的访问模式，以减少热条目的重复I/O。

---

## 4 设计概述

图6展示了SWARM的概述。利用KVCache协同激活，SWARM为建模、放置、检索和更新协同激活KV条目提供了系统性解决方案。整体工作流程分为两个阶段：

**离线阶段（§5）**。在这一阶段，SWARM确定跨SSD的KV条目放置，以最大化聚合带宽利用率。
- ❶ 首先对KVCache的协同激活模式进行建模，并据此将条目组织成聚类。
- ❷ 同时，SWARM在聚类上构建索引结构，以支持在线推理期间的高效检索。基于这一聚类，将每个聚类的条目均匀分布到SSD上，以促进并行数据传输。

**在线阶段（§6）**。给定以聚合为导向的放置，SWARM进一步引入运行时策略以充分利用可用带宽。一方面，
- ❸ 它采用负载均衡调度机制在聚类检索期间路由令牌。另一方面，
- ❹ SWARM在解码过程中动态调整聚类和缓存决策，以在不断演变的访问模式下维持高效率。

---

## 5 离线阶段：建模与放置

### 5.1 相关性感知聚类

KVCache协同激活分析表明，KV条目通常以高度相关的组形式激活，而非独立激活。受此洞察启发，SWARM将KVCache组织成一组结构化聚类，每个聚类包含具有强协同激活关系的条目。如图7所示，SWARM采用四步聚类工作流程。

**步骤1：模式提取**。SWARM首先在推理前作为一次性预处理步骤对KVCache协同激活模式进行分析。对于每个模型层，我们构建一个邻接矩阵 (A) 来捕获KV条目之间的成对协同激活统计。每个元素 (A_{ij}) 记录KV条目 (e_i) 和 (e_j) 在注意力计算过程中一起激活的次数。因此，(A) 编码了所有条目对的经验协同激活频率。基于测量的频率 (f(e_i, e_j))，我们估计 (e_i) 和 (e_j) 之间的协同激活概率，记为 (P(e_i, e_j))，如下所示：

$$
P(e_i, e_j) = \frac{f(e_i, e_j)}{\sum_{k=1}^{N}\sum_{l=1}^{N}f(e_k, e_l)} \tag{2}
$$

其中 (N) 表示上下文长度。分析在任务无关的数据集上执行，以获得KVCache行为的统计代表性表征。

**步骤2：图抽象**。基于提取的协同激活模式，SWARM将这些关系抽象为完整图，以实现原理性的图论优化。在这一形式化中，每个节点代表一个KV条目，每条边代表一对条目之间的协同激活关系。我们将边权重定义为两个条目之间的距离度量，记为 (d(e_i, e_j))，量化它们的协同激活强度如下：

$$
d(e_i, e_j) := 1 - P(e_i, e_j) \tag{3}
$$

在此定义下，较小的距离对应较强的协同激活。在极端情况下，当 (d(e_i, e_j) = 1) 时，两个条目始终协同激活。基于这一抽象，可以为所有条目构建成对距离矩阵 (D)。因此，将协同激活的KV条目聚类被重新表述为一个图优化问题：识别具有最小距离边的紧密连接节点集。

SWARM在最后两个步骤中完成这一优化过程。考虑到在完整加权图上进行精确组合优化是NP难的[26]，SWARM采用启发式算法来平衡效率和解决方案质量，如算法1所述。核心思想是首先选择具有最高总体协同激活的条目作为中心点（Medoid，第6-10行），然后通过迭代纳入具有强协同激活关系的其他条目，将该中心点贪婪地扩展为聚类（第11-28行）。

**算法1：KVCache协同激活聚类**

```
输入：KV条目集 E，距离矩阵 D，聚类半径 τ
输出：KVCache聚类集 C

函数 BUILD_CLUSTERS(E, D, τ):
    初始化 C ← ∅
    初始化 covered[e] ← false，对所有 e ∈ E
    ▷ 步骤3：中心点选择
    对每个 e_i ∈ E 执行:
        co-activation密度 ρ[e_i] ← Σ_{e_j ∈ E} I(D(e_i, e_j) ≤ τ)
    中心点队列 Q_m ← 按 ρ[·] 降序排列 E
    ▷ 步骤4：聚类扩展
    对每个 m_i ∈ Q_m 且 covered[m_i] = false 执行:
        KVCache聚类 C_i ← {m_i}
        候选队列 Q_c ← {e ∈ E \ {m_i} | D(m_i, e) ≤ τ}
        Q_c ← 按 D(m_i, ·) 升序排列 Q_c
        对每个 c_j ∈ Q_c 且 Σ_{e_k ∈ C_i} D(c_j, e_k) / |C_i| ≤ τ 执行:
            C_i ← C_i ∪ {c_j}
        C ← C ∪ {C_i}
        covered[e_i] ← true，对所有 e_i ∈ C_i
        若 ∀e ∈ E, covered[e] = true 则中断
    返回 C
```

**步骤3：中心点选择**。为量化KV条目的协同激活强度，我们进一步定义条目 (e_i) 的协同激活密度，记为 (\rho(e_i))，如下：

$$
\rho(e_i) := |\{e_j \mid j \neq i, d(e_i, e_j) < \tau\}| \tag{4}
$$

其中 (\tau) 是预定义的聚类半径，控制预期聚类大小。在这一形式化下，在半径 (\tau) 内有更多邻居的条目具有更高的协同激活密度，表明更强的协同激活关系。SWARM然后计算所有KV条目的 (\rho(e_i))，并按降序排列它们以构建中心点队列 (Q_m)。条目随后按顺序从 (Q_m) 中选择作为聚类中心点。通过构造，这些中心点表现出最高的协同激活密度，因此当被激活时，在各自聚类中与其他条目协同激活的可能性最大。

**步骤4：聚类扩展**。当选中一个中心点 (m_i) 时，SWARM计算它与所有其他条目的距离。任何满足 (d(m_i, e_j) < \tau) 的条目 (e_j) 被视为聚类 (C_i) 的候选成员。这些候选按与中心点的距离排序，并组织成候选队列 (Q_c)。对于从 (Q_c) 中取出的每个候选 (c_j)，我们将其到聚类 (C_i) 的距离定义为平均成对距离：

$$
d(c_j, C_i) := \frac{\sum_{e_k \in C_i} D(c_j, e_k)}{|C_i|} \tag{5}
$$

如果这个距离小于 (\tau)，则将 (c_j) 加入 (C_i)。聚类在此标准下迭代扩展，直到没有更多条目可以纳入。一旦每个条目都属于至少一个聚类，聚类过程终止。

重要的是，该算法自然地为高度协同激活的KV条目创建副本，这对于捕获交错的协同激活模式至关重要。考虑以下情况：条目A频繁地与条目B和条目C协同激活，而B和C本身很少协同激活。如果每个条目被限制为单一归属，A必须与B和C都在同一个聚类中，或者只与其中之一分组。在前一种情况下，检索聚类时会产生冗余传输（当只需要B时传输了C）。在后一种情况下，不包含A的聚类会失去利用其与A频繁协同激活的机会。通过允许高度协同激活条目的副本，SWARM以可忽略的存储开销解决了这一矛盾。

---

### 5.2 卸载友好的划分

SWARM将KVCache聚类作为原子检索单元，并根据需要将它们从SSD传输到DRAM。为实现准确且高效的检索，SWARM在KVCache聚类上构建索引结构，借鉴了KVCache检索与数据库系统中经典数据检索之间的概念并行。通过将每个聚类的条目分布到多个SSD，单个聚类的传输可以利用多个设备的聚合带宽，从而缓解带宽瓶颈。如图8所示，SWARM通过在两层内存层次结构中仔细划分来实现这一设计，在最小化I/O开销的同时最大化聚合带宽利用率。

**第一层：DRAM**。SWARM在DRAM中放置三类数据：

1. **中心点（Medoids）**。SWARM使用每个聚类的中心点作为其索引条目，并维护一个记录其SSD放置位置的路由表。每个中心点与传入查询计算相关性分数，以确定是否应检索相应聚类。在聚类过程中，聚类中的每个条目被约束在其中心点的半径内。因此，中心点自然地充当聚类的代表条目，最有可能与同一聚类中的其他条目协同激活。通过将该索引保留在DRAM中，SWARM可以在不产生SSD访问开销的情况下实现高效聚类选择。

2. **局部窗口条目（Local Window Entries）**。SWARM将局部窗口内（如256个令牌）的KV条目保留在DRAM中，以在推理过程中保持上下文连续性。滑动缓冲区动态跟踪生成进展中的最新条目。

3. **热聚类（Hot Clusters）**。为利用聚类级激活局部性，SWARM将最频繁激活的聚类缓存到DRAM中。为平衡空间开销与I/O减少，我们为聚类 (C_i) 定义成本效益分数如下：

$$
S(C_i) = \frac{f_i \cdot T_{\text{base}} + s_i \cdot T_{\text{transfer}}}{s_i} \tag{6}
$$

其中 (f_i) 表示聚类 (C_i) 的激活频率，(T_{\text{base}}) 是SSD寻址延迟，(T_{\text{transfer}}) 是每条目传输成本。给定固定的DRAM缓冲区容量，聚类按此分数降序缓存，以在内存约束下最大化整体成本效益。

**第二层：SSD**。SWARM跨SSD存储所有KVCache聚类。由于KV条目已基于协同激活模式进行了聚类，主要目标是将聚类尽可能均匀地分布以最大化聚合带宽利用率。SWARM采用轮询放置策略，灵活适应不同的聚类大小和SSD数量。具体而言，SWARM维护一个全局磁盘指针 (p_{\text{global}}) 并顺序处理聚类。对于每个聚类 (C_i)，目标磁盘标识符确定如下：

$$
\text{id}_i := p_{\text{global}} \mod N_{\text{disk}}, \quad p_{\text{global}} := p_{\text{global}} + |C_i| \tag{7}
$$

其中 (N_{\text{disk}}) 表示SSD总数。然后每个聚类将其条目从磁盘 (\text{id}_i) 开始放置，跨SSD按循环方式顺序分布。这一策略确保了均衡的存储利用率，并在聚类检索期间最大化并行数据传输。

---

## 6 在线阶段：检索与更新

### 6.1 负载均衡调度

在SWARM的离线优化之后，KV条目使用跨SSD的带宽聚合布局放置。在运行时，SWARM专注于根据传入查询高效传输所选聚类。设计遵循两个关键目标。首先，聚类过程自然地引入了KV条目副本。虽然复制对于准确捕获协同激活模式至关重要，但如果同时检索包含重叠条目的多个聚类，可能导致冗余数据传输。其次，所选聚类应以负载均衡的方式组装，以充分利用可用的聚合带宽。同时，整体调度机制必须保持轻量，以避免引入额外的运行时开销。

如图9所示，SWARM开发了解耦的条目-桶调度算法。首先，在将KV聚类传输到DRAM之前，SWARM对所有激活聚类执行全局合并，以构造I/O条目集：

$$
E_{\text{I/O}} = \left(\bigcup_{C_i \in C_{\text{activated}}} C_i\right) \setminus E_{\text{DRAM}} \tag{8}
$$

此操作消除跨聚类的重复KV条目，并过滤掉已驻留在DRAM中的条目，从而避免冗余数据传输。接下来，每个SSD被分配一个专用桶，用于存储待传输的条目。(E_{\text{I/O}}) 中的所有条目首先按其复制因子（即条目所在SSD的数量）升序排序。没有副本的条目直接分配到其对应的SSD桶。对于具有多个副本的条目，SWARM将每个条目路由到当前桶大小最小的SSD桶，在设备间平衡负载。当多个SSD具有相同桶大小时，任意选择其中一个。在为每个SSD构造桶之后，系统迭代地从每个桶中提取头部条目，并将它们聚合成单个提交批次。然后通过单个系统调用将此批次发送到内核。通过将多个I/O请求合并为大型批量提交，SWARM最小化了提交操作数量并减少了用户-内核上下文切换。

---

### 6.2 聚类对齐的适配

SWARM还在线阶段动态适应不断变化的系统状态。新生成的KVCache条目可能改变聚类结构，而变化的激活模式转移DRAM缓存优先级。为解决这些动态问题，SWARM采用两种专用更新策略。

**聚类维护（Cluster Maintenance）**。如§5.2所述，新生成的KV条目在大小为 (W) 的局部窗口内保留在DRAM中。SWARM利用这个 (W) 步间隔来分析它们与现有KVCache聚类的协同激活模式。如图10所示，新生成的KV条目 (e_{\text{new}}) 与聚类 (C_i) 之间的距离定义为：

$$
d(e_{\text{new}}, C_i) = 1 - \frac{f(e_{\text{new}}, m_i)}{\sum_{j=1}^{N} f(e_{\text{new}}, m_j)} = 1 - \frac{f(e_{\text{new}}, m_i)}{W} \tag{9}
$$

其中 (m_i) 表示聚类 (C_i) 的中心点，(N) 是聚类总数。如果计算的距离小于聚类半径 (\tau)，SWARM将 (e_{\text{new}}) 分配给聚类 (C_i)，并将其放置在该聚类分配到的下一个SSD上（即在磁盘索引 (\text{id}_i + |C_i| + 1)，必要时取模 (N_{\text{disk}})）。如果有多个聚类满足距离阈值，则将该条目添加到所有这些聚类中，保持受控复制。这种增量放置策略在解码进展时保持聚类一致性并维持并行传输。

**缓存替换（Cache Replacement）**。在离线阶段，SWARM根据成本效益分数将KVCache聚类缓存在DRAM中。如公式6所定义，该分数中使用的激活频率 (f_i) 最初来自离线分析。为适应不断变化的运行时行为，SWARM基于观察到的访问模式动态更新每个聚类的激活频率。具体而言，每当聚类被激活时，其频率增加一。相反，对于已缓存在DRAM但在解码步骤中未被激活的聚类，其频率减一。这一设计奖励表现出时间局部性的聚类，同时惩罚不活跃的聚类。为高效管理DRAM缓存，SWARM使用按成本效益分数排序的最小堆结构维护缓存聚类，实现高效更新和替换。

---

## 7 实现

我们实现了SWARM作为一个端到端系统，用于在CPU-GPU协作执行中进行高效的SSD支撑KVCache卸载。系统横跨Python和C++，包含超过2000行代码，涵盖从底层数据移动到运行时调度的完整技术栈。

**异步I/O**。我们构建了一个定制的C++ I/O后端，以充分利用多个SSD的聚合带宽。对于高性能异步数据传输，我们利用Linux内核接口io_uring[4]来发起并发非阻塞读取命令。为进一步消除CPU侧复制开销，所有SSD读取都直接写入预分配的固定主机内存。这允许NVMe DMA控制器直接将数据放入这些缓冲区，实现到GPU HBM通过CUDA复制引擎的零复制传输[34]。

**流水线预取**。为在自回归解码期间隐藏SSD访问延迟，我们设计了一个精心工程的流水线，将计算与预测性KVCache传输重叠。具体而言，当GPU为第 (L) 层执行注意力计算时，CPU同时为第 (L+1) 层执行三个阶段：
1. 通过将第 (L) 层嵌入与第 (L+1) 层的聚类中心点进行比较，预测可能被访问的KV聚类；
2. 向SSD发起异步取请求，将相应数据从SSD加载到固定主机内存；
3. 通过专用CUDA流将取回的数据流式传输到GPU HBM。基于相邻层之间的嵌入相似性[21]，这一设计有效地将SSD访问与GPU计算重叠。

---

## 8 评估

### 8.1 实验设置

**硬件**。我们的系统包括Intel Xeon Gold 6530 CPU（64核，128线程）、8个NVIDIA H20 GPU（每个96 GB HBM）、1 TB DDR5 DRAM和最多8个NVMe SSD。为覆盖异构存储，我们使用了高端三星PM9A3 SSD（最高1.1M IOPS，6.9 GB/s）和低端Intel Optane 900P SSD（最高0.55M IOPS，2.5 GB/s）。

**模型**。我们选择了六个广泛采用的LLM，如表2所列。这些模型在架构、规模和KVCache特性上有所不同。所有模型采用分组查询注意力（GQA）[2]，具有不同的组大小。

**表2**：模型配置。

| 模型 | 规模 | 注意力类型 | 隐藏维度 | 组大小 |
|------|------|-----------|----------|--------|
| Qwen3-S[49] | 14B | GQA | 5120 | 5 |
| Qwen3-M[49] | 32B | GQA | 5120 | 8 |
| Llama3.1[33] | 70B | GQA | 8192 | 8 |
| GPT-OSS[1] | 120B | GQA | 2880 | 8 |
| Qwen3-L-MoE[49] | 235B | GQA | 4096 | 16 |

**数据集**。我们在涵盖纯文本、指令遵循和数学任务的多样化数据集上评估SWARM。这些数据集捕获了广泛的语言结构，使我们能够跨不同协同激活模式进行全面评估。为支持更长的前缀长度，当单个序列不足时，我们连接多个样本，构建长达1M令牌扩展输入。

**基线**。我们将SWARM与三种代表性KVCache管理方法进行比较。所有方法均在10%稀疏率下评估。

1. **No Cluster**：KV条目在SSD上存储，没有任何聚类或索引结构。为识别激活的KV条目，首先将整个KVCache加载到DRAM中（必要时分块）以计算注意力分数，然后从SSD检索所需条目。为公平起见，我们仅报告注意力分数计算时间和所需条目传输时间。
2. **InfLLM[47]**：KV条目被组织成固定大小的块。在块级别确定令牌重要性，在推理期间仅检索所选块。
3. **PQCache[53]**：一种基于聚类的方法，使用K-means[31]对KV条目进行分组，其中使用聚类中心来识别相关令牌进行检索。

### 8.2 整体性能

**吞吐量**。图11(a)报告了以每秒令牌数（TPS）衡量的端到端吞吐量。SWARM始终达到最高TPS，分别比No Cluster、InfLLM和PQCache提高吞吐量3.99倍、1.76倍和1.47倍。No Cluster由于缺乏任何结构化KVCache管理而提供最低吞吐量。虽然InfLLM和PQCache引入了结构化方法，但它们基于块划分或嵌入相似性的策略与KVCache协同激活模式对齐不佳。相比之下，SWARM明确根据激活模式对KVCache条目进行聚类并跨SSD分布，有效缓解了带宽瓶颈。

**带宽**。图11(b)呈现了KV检索期间的详细I/O带宽。与吞吐量结果一致，SWARM实现了最高带宽利用率，分别超过No Cluster、InfLLM和PQCache平均3.95倍、2.67倍和1.55倍。通过结合分层离线在线优化，SWARM不仅平衡了跨设备的I/O工作负载，还减少了不必要的数据传输，接近SSD的实际带宽极限。I/O改进到端到端延迟的强力转化证实，I/O是SSD支撑卸载中的主要瓶颈。SWARM以最小的运行时开销解决了这一瓶颈。

**精度**。图11(c)展示了归一化精度，其中神谕令牌选择（No Cluster）达到最高分数。SWARM始终在所有模型和数据集上获得最接近这一上界的精度。这一结果表明，SWARM有效捕获了与注意力动态高度对齐的KVCache协同激活模式，使其能够检索信息量最大的令牌。相比之下，其他基线在KVCache结构和激活模式之间表现出不匹配，导致包含无关令牌或排除重要令牌。

### 8.3 消融研究

**离线建模**。我们首先评估聚类算法的有效性。我们考虑两个基线：**Medoid Only**仅使用中心点半径内的条目构建聚类，**No Replica**限制每个条目属于单一聚类。如图12所示，与这些基线相比，SWARM分别平均降低延迟1.14倍和1.33倍。这些结果强调了捕获聚类内成对协同激活关系的重要性，并表明条目复制对于建模复杂激活模式至关重要。

**离线放置-SSD**。我们将SWARM实现的聚合带宽与两个基线进行比较。图13显示：**No Cluster**跨SSD顺序放置令牌，不考虑协同激活关系；第二个基线**No Balance**按聚类组织令牌，但从单个SSD开始放置，导致利用不均衡。结果表明，SWARM分别将I/O延迟最高降低2.63倍和3.17倍，有效地将军聚类转化为跨SSD更高的聚合带宽。

**离线放置-DRAM**。表4评估了DRAM放置策略。除了局部窗口外，SWARM将聚类中心点保留在DRAM中。结果表明，SWARM在不同前缀长度上将选择延迟降低6.9倍至12.2倍，收益随上下文长度增加而增加。重要的是，这一改进仅产生最小内存开销（1M上下文下为0.412 GB）。

**表4**：Qwen3-32B在两种DRAM放置策略下不同前缀长度的选择延迟。

| 前缀长度 | (s = 128K) | (s = 256K) | (s = 512K) | (s = 1M) |
|----------|-----------|-----------|-----------|---------|
| Naive延迟(ms) | 1.635 | 3.136 | 6.176 | 12.15 |
| SWARM延迟(ms) | 0.236 | 0.374 | 0.554 | 0.999 |
| SWARM内存(GB) | 0.053 | 0.104 | 0.207 | 0.412 |

**在线检索**。我们在三种策略下评估SWARM的在线调度算法（I/O延迟和I/O量）。**Static**使用静态多SSD路由，始终从第一个可用副本读取，既不进行去重也不进行负载均衡。**No Balance**执行去重但忽略负载均衡，导致请求集中于部分SSD，使最慢SSD成为瓶颈。**No Deduplication**跨SSD平衡请求，但不消除聚类副本引入的重复令牌，导致读取放大。图14显示，通过在运行时联合考虑复制和负载均衡，SWARM与所有三个基线相比平均将I/O延迟降低2.57倍，I/O量降低1.24倍。

**在线更新-聚类**。表5评估了SWARM在解码期间如何维护聚类质量。我们测量聚类条目与其中心点之间的平均距离，按离线计算的初始距离归一化。作为基线，**Min-Size**完全基于聚类大小分配新令牌，而**Min-Diff**基于与聚类中心点的相似性分配。SWARM分别以8.0倍和2.3倍优于两个基线。通过在局部窗口内跟踪协同激活模式，SWARM有效地近似了新令牌与现有聚类之间不断变化的关系。

**表5**：聚类条目与中心点之间的距离（与初始值比较），在Qwen3-32B和WikiText上评估。

| 解码步骤 | (t=1) | (t=2) | (t=4) | (t=8) | (t=16) | (t=32) |
|---------|-------|-------|-------|-------|--------|--------|
| Min-Size | 1.733 | 2.481 | 3.957 | 6.834 | 12.004 | 21.376 |
| Min-Diff | 1.581 | 1.880 | 2.184 | 2.348 | 2.649 | 3.019 |
| SWARM | 1.001 | 1.001 | 1.001 | 1.002 | 1.005 | 1.012 |

**在线更新-缓存**。图15展示了不同DRAM缓存比率下的缓存命中率和每层延迟。在所有缓存预算下，SWARM始终优于最近最少使用（LRU）[9]基线，缓存命中率平均提高74%，每层延迟平均降低13.6%。LRU仅跟踪最近访问，可能保留一次访问但很少重用的大聚类。相比之下，SWARM通过成本效益分数动态平衡激活频率和聚类大小。

### 8.4 敏感性分析

**前缀长度**。图16展示了在不同前缀长度下批量大小为1、4和8的I/O延迟。对于小前缀长度，延迟随工作负载增加缓慢，因为此时受IOPS限制：I/O请求数量有限，SSD带宽未充分利用。随着前缀长度增加，系统变为带宽受限，延迟大致随检索数据量线性增长。增加批量大小提高了并发I/O请求数量，使SWARM更早进入带宽受限状态。

**SSD类型**。我们在两种存储配置上评估SWARM和基线：四个高端PM9A3 SSD和四个低端900P SSD。图17显示，在所有前缀长度下，SWARM始终比所有基线实现更高吞吐量。在较低性能SSD上，系统因IOPS能力有限而在前缀较短处（约32K）从IOPS受限过渡到带宽受限。相比之下，使用更高性能PM9A3 SSD时，这一过渡发生在较大前缀处（约64K），SWARM达到更高的可用带宽上限。

**SSD数量**。图18展示了SSD数量从1增加到8时的吞吐量。当使用单个SSD时，SWARM回退到基线。随着数量增加，其吞吐量稳步扩展，并始终超越所有基线。这一可扩展性源于两个因素：离线放置灵活适应不同数量的SSD，在线调度有效平衡工作负载。

**聚类阈值**。我们研究了跨三个数据集的吞吐量对聚类半径 (\tau) 的敏感性。结果表明，即使在数据集迁移的情况下，SWARM仍然有效，展示了聚类方法的鲁棒性。

**稀疏率**。图20展示了在不同稀疏率下的吞吐量。在低稀疏率下，I/O量小，性能主要受IOPS限制，带宽未充分利用。随着稀疏率增加，工作负载变为带宽受限，吞吐量受最大可达I/O带宽约束。在所有设置下，SWARM始终优于基线。通过有效利用聚合多磁盘带宽，SWARM在两种状态下都实现了更高吞吐量。

---

## 9 相关工作

**KVCache稀疏性**。近期工作越来越探索LLM长上下文推理中KVCache的内在稀疏性。Quest[44]通过基于查询动态选择相关KV页提出查询感知稀疏性。RetrievalAttention[29]利用近似最近邻搜索通过向量相似性检索KV条目。HeadKV[13]通过仅保留重要注意力头的子集引入头级稀疏性。然而，将这些洞察转化为现实推理系统中的切实性能收益仍然是关键剩余挑战。SWARM通过算法与系统的协同设计弥合了这一差距。

**KVCache卸载**。在LLM长上下文推理中，KVCache带来巨大内存压力，促使将KVCache卸载到DRAM和SSD。FlexGen[41]提出跨越HBM、DRAM和SSD的三层内存层次结构，利用线性规划优化张量放置。SolidAttention[55]采用KV条目在SSD上的交错布局并结合推测性预取，针对高效单节点部署。IMPRESS[7]和CachedAttention[15]通过根据令牌重要性在多层存储层次结构中组织KV条目，将这一工作线扩展到云设置。尽管有这些进展，先前工作确定SSD带宽为主要瓶颈。相比之下，SWARM通过利用多磁盘并行性解决了这一限制。

**KVCache聚类**。在KVCache卸载中，KV条目的组织在实现高效检索方面起着关键作用。ClusterKV[30]基于静态相似性度量应用K-means聚类。InfLLM[47]选择高分令牌作为代表，并在粗粒度上检索KV条目。PQCache[53]将聚类检索表述为向量搜索问题。这些方法主要依赖数学相似性或启发式重要性进行聚类。SWARM基于协同激活模式组织KV条目，将其转化为切实的性能收益。

---

## 10 结论

我们提出了SWARM，这是一个基于SSD的KVCache卸载框架，利用KVCache协同激活实现跨SSD的高效带宽并行检索。通过将带宽受限的KVCache访问转化为可扩展的并行I/O，SWARM为LLM推理的成本高效和容量可扩展存储系统铺平了道路。

---

## 参考文献

[1] Sandhini Agarwal, Lama Ahmad, Jason Ai, Sam Altman, Andy Applebaum, Edwin Arbus, Rahul K Arora, Yu Bai, Bowen Baker, Haiming Bao, et al. gpt-oss-120b & gpt-oss-20b model card. arXiv preprint arXiv:2508.10925, 2025.

[2] Joshua Ainslie, James Lee-Thorp, Michiel De Jong, Yury Zemlyanskiy, Federico Lebrón, and Sumit Sanghai. Gqa: Training generalized multi-query transformer models from multi-head checkpoints. In Proceedings of the 2023 Conference on Empirical Methods in Natural Language Processing, pages 4895–4901, 2023.

[3] Anthropic. Prompt caching with claude. https://www.anthropic.com/news/prompt-caching, 2024. Anthropic blog post.

[4] Jens Axboe. liburing. https://github.com/axboe/liburing, 2026. Accessed: 2026-03-17.

[5] Yushi Bai, Xin Lv, Jiajie Zhang, Hongchang Lyu, Jiankai Tang, Zhidian Huang, Zhengxiao Du, Xiao Liu, Aohan Zeng, Lei Hou, et al. Longbench: A bilingual, multitask benchmark for long context understanding. In Proceedings of the 62nd annual meeting of the association for computational linguistics (volume 1: Long papers), pages 3119–3137, 2024.

[6] Joya Chen, Zhaoyang Lv, Shiwei Wu, Kevin Qinghong Lin, Chenan Song, Difei Gao, Jia-Wei Liu, Ziteng Gao, Dongxing Mao, and Mike Zheng Shou. Videollm-online: Online video large language model for streaming video. In Proceedings of the IEEE/CVF Conference on Computer Vision and Pattern Recognition, pages 18407–18418, 2024.

[7] Weijian Chen, Shuibing He, Haoyang Qu, Ruidong Zhang, Siling Yang, Ping Chen, Yi Zheng, Baoxing Huai, and Gang Chen. IMPRESS: An Importance-Informed Multi-Tier prefix KV storage system for large language model inference. In 23rd USENIX Conference on File and Storage Technologies (FAST 25), pages 187–201, 2025.

[8] Karl Cobbe, Vineet Kosaraju, Mohammad Bavarian, Mark Chen, Heewoo Jun, Lukasz Kaiser, Matthias Plappert, Jerry Tworek, Jacob Hilton, Reiichiro Nakano, Christopher Hesse, and John Schulman. Training verifiers to solve math word problems. arXiv preprint arXiv:2110.14168, 2021.

[9] Peter J Denning. The working set model for program behavior. Communications of the ACM, 11(5):323–333, 1968.

[10] Yanhao Dong, Yubo Miao, Weinan Li, Xiao Zheng, Chao Wang, Jiesheng Wu, and Feng Lyu. Accelerating llm inference throughput via asynchronous kv cache prefetching. arXiv preprint arXiv:2504.06319, 2025.

[11] Wenqi Fan, Yujuan Ding, Liangbo Ning, Shijie Wang, Hengyun Li, Dawei Yin, Tat-Seng Chua, and Qing Li. A survey on rag meeting llms: Towards retrieval-augmented large language models. In Proceedings of the 30th ACM SIGKDD conference on knowledge discovery and data mining, pages 6491–6501, 2024.

[12] Shaoting Feng, Hanchen Li, Kuntai Du, Zhuohan Gu, Yuhan Liu, Jiayi Yao, Siddhant Ray, Samuel Shen, Yihua Cheng, Ganesh Ananthanarayanan, et al. Adaptcache: Kv cache native storage hierarchy for low-delay and high-quality language model serving. arXiv preprint arXiv:2509.00105, 2025.

[13] Yu Fu, Zefan Cai, Abedelkadir Asi, Wayne Xiong, Yue Dong, and Wen Xiao. Not all heads matter: A head-level kv cache compression method with integrated retrieval and reasoning. arXiv preprint arXiv:2410.19258, 2024.

[14] Bin Gao, Zhuomin He, Puru Sharma, Qingxuan Kang, Djordje Jevdjic, Junbo Deng, Xingkun Yang, Zhou Yu, and Pengfei Zuo. Cost-Efficient large language model serving for multi-turn conversations with CachedAttention. In 2024 USENIX Annual Technical Conference (USENIX ATC 24), pages 111–126, 2024.

[15] Bin Gao, Zhuomin He, Puru Sharma, Qingxuan Kang, Djordje Jevdjic, Junbo Deng, Xingkun Yang, Zhou Yu, and Pengfei Zuo. Cost-Efficient large language model serving for multi-turn conversations with CachedAttention. In 2024 USENIX annual technical conference (USENIX ATC 24), pages 111–126, 2024.

[16] In Gim, Guojun Chen, Seung-seob Lee, Nikhil Sarda, Anurag Khandelwal, and Lin Zhong. Prompt cache: Modular attention reuse for low-latency inference. Proceedings of Machine Learning and Systems, 6:325–338, 2024.

[17] Google DeepMind. Gemini 3 pro model card. Technical report, Google DeepMind, November 2025. Accessed: December 2025.

[18] Shibo Hao, Tianyang Liu, Zhen Wang, and Zhiting Hu. Toolkengpt: Augmenting frozen language models with massive tools via tool embeddings. Advances in neural information processing systems, 36:45870–45894, 2023.

[19] Dan Hendrycks, Collin Burns, Steven Basart, Andy Zou, Mantas Mazeika, Dawn Song, and Jacob Steinhardt. Measuring massive multitask language understanding. Proceedings of the International Conference on Learning Representations (ICLR), 2021.

[20] Chaoyi Jiang, Lei Gao, Hossein Entezari Zarch, and Murali Annavaram. Efficient llm inference with i/o-aware partial kv cache recomputation. arXiv preprint arXiv:2411.17089, 2024.

[21] Jiachen Jiang, Jinxin Zhou, and Zhihui Zhu. Tracing representation progression: Analyzing and enhancing layer-wise similarity. arXiv preprint arXiv:2406.14479, 2024.

[22] Carlos E Jimenez, John Yang, Alexander Wettig, Shunyu Yao, Kexin Pei, Ofir Press, and Karthik Narasimhan. Swe-bench: Can language models resolve real-world github issues? arXiv preprint arXiv:2310.06770, 2023.

[23] Chao Jin, Zili Zhang, Xuanlin Jiang, Fangyue Liu, Shu-fan Liu, Xuanzhe Liu, and Xin Jin. Ragcache: Efficient knowledge caching for retrieval-augmented generation. ACM Transactions on Computer Systems, 44(1):1–27, 2025.

[24] Hyunjoo Jin. Trendforce sees chip prices surging 90-95% in q1 from previous quarter. Reuters, February 2026. Reports TrendForce forecast that conventional DRAM contract prices will jump 90–95% QoQ in 1Q26.

[25] Kingston Technology. Flash Memory Guide, 2012. Document MKF-283US. Archived PDF (snapshot 2013-10-19).

[26] Jan V Leeuwen. Handbook of theoretical computer science: Algorithms and complexity. Mit Press, 1990.

[27] Jiaqi Li, Mengmeng Wang, Zilong Zheng, and Muhan Zhang. Loogle: Can long-context language models understand long contexts? In Proceedings of the 62nd Annual Meeting of the Association for Computational Linguistics (Volume 1: Long Papers), pages 16304–16333, 2024.

[28] Aixin Liu, Bei Feng, Bing Xue, Bingxuan Wang, Bochao Wu, Chengda Lu, Chenggang Zhao, Chengqi Deng, Chenyu Zhang, Chong Ruan, et al. Deepseek-v3 technical report. arXiv preprint arXiv:2412.19437, 2024.

[29] Di Liu, Meng Chen, Baotong Lu, Huiqiang Jiang, Zhenhua Han, Qianxi Zhang, Qi Chen, Chengruidong Zhang, Bailu Ding, Kai Zhang, Chen Chen, Fan Yang, Yuqing Yang, and Lili Qiu. Retrievalattention: Accelerating long-context llm inference via vector retrieval, 2024.

[30] Guangda Liu, Chengwei Li, Jieru Zhao, Chenqi Zhang, and Minyi Guo. Clusterkv: Manipulating llm kv cache in semantic space for recallable compression. arXiv preprint arXiv:2412.03213, 2024.

[31] J MacQueen. Multivariate observations. In Proceedings of the 5th Berkeley Symposium on Mathematical Statistics and Probability, volume 1, pages 281–297, 1967.

[32] Stephen Merity, Caiming Xiong, James Bradbury, and Richard Socher. Pointer sentinel mixture models, 2016.

[33] Meta AI. The llama 3.1 herd of models. https://ai.meta.com/llama/, 2024. Accessed: 2026-03-18.

[34] NVIDIA Corporation. NVIDIA CUDA C++ Programming Guide, 2026. Version 13.0.

[35] NVM Express, Inc. NVM Express. https://nvmexpress.org/, 2017. Retrieved 2017-01-24. (Site archived 2019-12-05.).

[36] OpenAI. Prompt caching. https://developers.openai.com/api/docs/guides/prompt-caching, 2024. OpenAI API documentation.

[37] Xiurui Pan, Endian Li, Qiao Li, Shengwen Liang, Yizhou Shan, Ke Zhou, Yingwei Luo, Xiaolin Wang, and Jie Zhang. Instinfer: In-storage attention offloading for cost-effective long-context llm inference. arXiv preprint arXiv:2409.04992, 2024.

[38] PCI-SIG. Pci express® base specification revision 5.0. Specification Rev. 5.0, v1.0, PCI Special Interest Group, May 2019. Version 1.0.

[39] Ruoyu Qin, Zheming Li, Weiran He, Jialei Cui, Feng Ren, Mingxing Zhang, Yongwei Wu, Weimin Zheng, and Xinran Xu. Mooncake: Trading more storage for less computation—a KVCache-centric architecture for serving LLM chatbot. In 23rd USENIX Conference on File and Storage Technologies (FAST 25), pages 155–170, 2025.

[40] Yujia Qin, Shihao Liang, Yining Ye, Kunlun Zhu, Lan Yan, Yaxi Lu, Yankai Lin, Xin Cong, Xiangru Tang, Bill Qian, et al. Toolllm: Facilitating large language models to master 16000+ real-world apis. arXiv preprint arXiv:2307.16789, 2023.

[41] Ying Sheng, Lianmin Zheng, Binhang Yuan, Zhuohan Li, Max Ryabinin, Beidi Chen, Percy Liang, Christopher Ré, Ion Stoica, and Ce Zhang. Flexgen: High-throughput generative inference of large language models with a single gpu. In International Conference on Machine Learning, pages 31094–31116. PMLR, 2023.

[42] Aaditya Singh, Adam Fry, Adam Perelman, Adam Tart, Adi Ganesh, Ahmed El-Kishky, Aidan McLaughlin, Aiden Low, AJ Ostrow, Akhila Ananthram, et al. Openai gpt-5 system card. arXiv preprint arXiv:2601.03267, 2025.

[43] Jaspreet Singh and Zaheer Kachwala. Surging memory chip prices dim outlook for consumer electronics makers. Reuters, January 2026.

[44] Jiaming Tang, Yilong Zhao, Kan Zhu, Guangxuan Xiao, Baris Kasikci, and Song Han. Quest: Query-aware sparsity for efficient long-context LLM inference. arXiv preprint arXiv:2406.10774, 2024.

[45] Kimi Team, Yifan Bai, Yiping Bao, Guanduo Chen, Jiahao Chen, Ningxin Chen, Ruijue Chen, Yanru Chen, Yuankun Chen, Yutian Chen, et al. Kimi k2: Open agentic intelligence. arXiv preprint arXiv:2507.20534, 2025.

[46] Ashish Vaswani, Noam Shazeer, Niki Parmar, Jakob Uszkoreit, Llion Jones, Aidan N Gomez, Łukasz Kaiser, and Illia Polosukhin. Attention is all you need. Advances in neural information processing systems, 30, 2017.

[47] Chaojun Xiao, Pengle Zhang, Xu Han, Guangxuan Xiao, Yankai Lin, Zhengyan Zhang, Zhiyuan Liu, and Maosong Sun. InfLLM: Training-free long-context extrapolation for LLMs with an efficient context memory. Advances in Neural Information Processing Systems, 37:119638–119661, 2024.

[48] Junbin Xiao, Xindi Shang, Angela Yao, and Tat-Seng Chua. Next-qa: Next phase of question-answering to explaining temporal actions. In Proceedings of the IEEE/CVF conference on computer vision and pattern recognition, pages 9777–9786, 2021.

[49] An Yang, Anfeng Li, Baosong Yang, Beichen Zhang, Binyuan Hui, Bo Zheng, Bowen Yu, Chang Gao, Chengen Huang, Chenxu Lv, et al. Qwen3 technical report. arXiv preprint arXiv:2505.09388, 2025.

[50] Shunyu Yao, Jeffrey Zhao, Dian Yu, Nan Du, Izhak Shafran, Karthik R Narasimhan, and Yuan Cao. Tree of thoughts: Deliberate problem solving with large language models. Advances in neural information processing systems, 36:11809–11822, 2023.

[51] Shunyu Yao, Jeffrey Zhao, Dian Yu, Nan Du, Izhak Shafran, Karthik R Narasimhan, and Yuan Cao. React: Synergizing reasoning and acting in language models. In The eleventh international conference on learning representations, 2022.

[52] Ahmet Caner Yüzügüler, Jiawei Zhuang, and Lukas Cavigelli. Preserve: Prefetching model weights and KV-cache in distributed LLM serving. arXiv preprint arXiv:2501.08192, 2025.

[53] Hailin Zhang, Xiaodong Ji, Yilin Chen, Fangcheng Fu, Xupeng Miao, Xiaonan Nie, Weipeng Chen, and Bin Cui. PQCache: Product quantization-based KVCache for long context LLM inference. Proceedings of the ACM on Management of Data, 3(3):1–30, 2025.

[54] Zhenyu Zhang, Ying Sheng, Tianyi Zhou, Tianlong Chen, Lianmin Zheng, Ruisi Cai, Zhao Song, Yuandong Tian, Christopher Ré, Clark Barrett, et al. H2o: Heavy-hitter oracle for efficient generative inference of large language models. Advances in Neural Information Processing Systems, 36:34661–34710, 2023.

[55] Xinrui Zheng, Dongliang Wei, Jianxiang Gao, Yixin Song, Zeyu Mi, and Haibo Chen. SolidAttention: Low-Latency SSD-based serving on Memory-Constrained PCs. In 24th USENIX Conference on File and Storage Technologies (FAST 26), pages 67–82, 2026.
