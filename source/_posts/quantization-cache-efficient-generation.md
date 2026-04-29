---
title: "Q&C - 量化与缓存融合的高效生成"
date: 2026-04-29
tags: ["论文翻译"]
mathjax: true
source: https://arxiv.org/abs/2503.02508
---

# Q&C: 当量化遇见缓存——高效生成中的技术融合

**标题**: Q&C: When Quantization Meets Cache in Efficient Generation

**作者**: Xin Ding, Xin Li, Haotong Qin, Zhibo Chen (中国科学技术大学 + 苏黎世联邦理工学院)

**arXiv**: 2503.02508

**发表**: ICLR 2026

---

## 摘要

量化（Quantization）和缓存（Cache）机制通常被分别应用于 Diffusion Transformers（DiTs）的高效加速，各自展现出显著的加速潜力。然而，将这两种机制结合对高效生成的正向促进作用仍缺乏充分探索。通过实证研究，我们发现将两种机制结合应用于 DiT 并不简单，两个关键挑战导致了严重的性能灾难性下降：（i）后训练量化（PTQ）中校准数据集的样本效率被缓存操作显著削弱；（ii）上述机制的组合在采样分布中引入了更严重的曝光偏差（exposure bias），导致图像生成过程中误差累积被放大。在本文中，我们利用这两种加速机制的优势，通过解决上述挑战提出了一种混合加速方法，旨在进一步提升 DiTs 效率的同时保持出色的生成能力。

具体而言，我们设计了**时序感知并行聚类（TAP）**，能够在 PTQ 校准过程中针对不同扩散步骤动态提升样本选择效率。同时，我们提出了**方差补偿（VC）**策略来修正采样分布，通过自适应校正因子生成来缓解曝光偏差。大量实验表明，我们的方法在保持有竞争力的生成能力的同时，实现了 DiTs 12.7 倍的加速。代码将发布于 https://github.com/xinding-sys/Quant-Cache。

## 1. 引言

Diffusion Transformers（DiTs）[43] 的迅速崛起推动了生成任务（尤其是图像生成 [6, 61]）的重大突破。凭借基于 Transformer 的架构 [3, 51, 57]，DiTs 提供了卓越的可扩展性和性能 [2]。然而，巨大的计算复杂度和参数量限制了其广泛采用。例如，使用 DiTs 生成一张 512 × 512 分辨率的图像可能需要超过 1 分钟的时间。

![图 1. 不同设置下的效率与效果权衡。气泡大小表示相对于 DDPM 基线（250 步）在生成质量上的相对加速比。我们从 FID（顶部）和 sFID（底部）两个维度，比较了 50、100 和 250 步不同设置下各方法的表现。我们的方法在所有设置中始终处于左上区域，在保持生成质量的同时实现了最大加速。]

量化 [29, 37, 38] 和缓存 [50, 54, 58] 作为两种加速机制，已被初步探索用于分别缓解 DiTs 的计算负担 [4, 33, 48, 55]。量化通过将权重和激活转换为低位格式来加速模型，显著减少推理时间和内存占用。特别是后训练量化（PTQ）[14] 作为一种量化范式，仅需要少量校准数据集来消除量化误差，与量化感知训练（QAT）[32] 相比，对 DiTs 来说更加高效且资源友好。相比之下，缓存机制旨在利用扩散过程中历史特征的可复用性来消除推理中的计算成本，从而成为加速 DiTs 的另一种流行方式。常用的缓存策略利用扩散过程的重复性质，存储和重用跨不同去噪步骤的注意力层和 MLP 层等特征。

尽管量化与缓存机制各自有效，但一个关键问题仍然缺乏探索：**"将这两种机制结合能否进一步提升 DiTs 的效率？"** 然而，当量化遇见缓存时，尽管获得了显著的加速收益，DiTs 的生成质量却出现了明显下降。为回答这一问题，我们对 DiTs 中的采样过程进行了深入分析，并确定了导致性能下降的两个关键因素。

首先，如图 2 所示，我们惊讶地发现，PTQ 校准数据集中样本的相似性被缓存操作大幅提高，导致样本效率显著降低。而且，这种降低随着扩散步骤的增加而愈发严重，由于对整体生成分布的覆盖不足，损害了 PTQ 的有效性。

其次，量化和缓存的协同作用导致采样分布中的曝光偏差更加严重（详见补充材料中的详细定义）。这一问题在单独探索量化或缓存时并不明显，从图 3 可以观察到。此外，曝光偏差导致在 DiTs 采样迭代增加时，去噪输出的分布方差发生累积偏移。

为在通过结合量化和缓存机制保持增强加速效果的同时恢复 DiTs 的生成能力，我们通过开发两种关键技术来解决上述挑战，构成了我们的混合加速机制：（i）**时序感知并行聚类（TAP）** 和（ii）**分布方差补偿（VC）**。

具体而言，TAP 旨在恢复因缓存操作而降低的校准数据集样本效率，从而能够更准确地识别和校正量化误差。值得注意的是，一种简单的克服样本效率降低的方法是增加数据集大小。然而，这会引入过多的冗余数据和不必要的计算成本。相比之下，我们的 TAP 通过高效的聚类方式从大规模数据集中动态选择最具信息量和最具区分度的样本来构建校准数据集。与传统谱聚类方法不同，传统方法面临 (O(n^3)) [5, 21, 60] 甚至加速/优化算法下 (O(n^2)) 的高计算复杂度。TAP 结合时序序列与数据分布，实现大小为 (r) 的子样本并行处理，降低计算成本至 (O(rn))，其中 (r \ll n)。这种设计利用了近期研究 [23, 26] 强调的扩散校准数据集的时间敏感特性，允许有效聚类和采样，更好地代表整体分布且无过多冗余。

我们关于图像生成过程的深入分析揭示了图像方差与曝光偏差之间的强相关性（见第 2.2 节）。为此，我们提出了 VC，这是一种定制化方法，通过方差校正自适应缓解曝光偏差。与引入额外神经网络来预测腐败估计中误差的方法 [54] 不同，我们的方法不需要额外训练。相反，它利用一小批中间样本来计算重构因子，在每个时间步自适应校正特征方差。该方法有效减少曝光偏差，带来整体模型性能的显著提升。

### 本文贡献

本文贡献总结如下：

- **我们是首个**在 DiTs 中研究量化和缓存技术结合使用的团队，证明了这种方法在减轻计算负担方面的巨大潜力。
- **我们识别了**将量化与缓存整合时的两个关键挑战：（1）校准数据集中高度冗余样本的产生；（2）由模型输出分布方差偏移引起的曝光偏差的出现，且该问题随迭代而加剧。
- **我们提出了**两种新方法：（1）TAP 从大规模数据集中动态选择信息丰富且具有区分度的样本来优化校准数据集效率；（2）VC，一种自适应方法，通过在每个时间步校正特征方差来缓解曝光偏差，无需额外训练。
- 大量实证结果表明，我们的方法在保持相当生成质量的同时，将扩散图像生成加速高达 **12.7 倍**。

## 2. 背景与动机

### 2.1. 量化与缓存

量化作为模型部署中的关键环节，长期以来因其在减少内存占用和推理延迟方面的能力而受到严格审视。通常，其量化器 (Q(X|b)) 定义如下：

$$Q(X|b) = \text{clip}\left(\left\lfloor \frac{X - l}{s} \right\rfloor + z, 0, 2^b - 1\right) \quad (1)$$

其中 (s)（scale）和 (z)（zero-point）是量化参数，由 (X) 的下界 (l) 和上界 (u) 决定，通常定义为：

$$l = \min(X), \quad u = \max(X) \quad (2)$$

$$s = \frac{u - l}{2^b - 1}, \quad z = \text{clip}\left(\left\lfloor -\frac{l}{s} \right\rfloor + z, 0, 2^b - 1\right) \quad (3)$$

使用校准数据集和公式（2）和（3），我们可以推导 (s) 和 (z) 的统计信息。先前研究 [19, 20, 53, 56] 检查了下游任务在多种模型、压缩方法和校准数据源上的性能。他们的发现表明，校准数据的选择可以显著影响压缩模型的性能。

缓存是一种利用扩散模型去噪步骤重复性的技术，能够在保持生成样本质量的同时显著降低计算成本。缓存机制通过在采样过程中存储和重用中间输出，避免每一步的冗余计算。该方法的关键参数是缓存间隔 (N)，它决定了特征重新计算和缓存的频率。初始时，所有层的特征都被缓存，在每个时间步 (t)，如果 (\text{mod}(t, N) = 0)，模型重新计算并更新缓存。在接下来的 (N-1) 步中，模型重用这些缓存特征，跳过重复的完整前向传播。这种设计有效地减少了计算开销，特别是在扩散模型中，同时不牺牲生成质量。

### 2.2. 高效图像生成中量化和缓存协同的挑战

量化和缓存的卓越性能自然促使我们考虑将它们结合以增强 DiTs 效率的显著潜力。为此，我们进行了深入分析并确定了两个关键问题。

#### 挑战 1：校准数据集有效性下降

在扩散量化中，先前工作 [23, 31, 65] 通常从所有时间步均匀随机采样中间输入来生成小型校准集。这种策略利用了连续时间步之间的平滑过渡，确保有限的校准集仍然能够有效代表整体分布 [26]。然而，当量化遇见缓存时，这种平衡被打破，校准数据集的效率显著降低。为可视化这个问题，我们遵循 [55] 的设置，构造了多个各含 250 步样本的校准数据集。然后我们计算了这些样本之间的余弦相似度，并观察到与无缓存情况相比相似度大幅上升（见图 2）。

#### 挑战 2：曝光偏差的放大

先前研究 [41, 44, 45, 47] 一致表明，曝光偏差（源于训练与推理的差异）对文本和图像生成模型有深远影响。由于曝光偏差的存在，它随着推理采样步数的增加而逐渐加剧，成为误差累积的主要原因 [22, 24]（详见补充材料中的更详细定义）。为进一步探索，我们比较了不同加速方法下曝光偏差的变化，惊讶地发现**当量化遇见缓存时，曝光偏差显著恶化**，而当单独使用量化或缓存时则不会出现这种情况（如图 3 所示）。

为分析潜在原因，我们使用 5000 张图像检验了生成过程中的分布变化。我们观察到这种放大是由于方差的变化。具体来说，如图 4 所示，在去噪过程开始时，方差跨度较窄，方差变化保持稳定……

![图 4. 在不同时间步下 ImageNet 5000 个样本的方差密度分布对比。它们说明了在各种时间步下样本分布方差的变化，分别对应无量化-缓存（顶部）和有量化-缓存（底部）的情况。随着扩散的进行，样本分布的方差开始偏离高斯白噪声。我们对均值进行了相同的实验，但未观察到类似现象，详细分析见补充材料。]

这突出表明需要在生成的后期阶段校正方差，以减轻其对曝光偏差的负面影响。

## 3. 方法

### 3.1. 用于校准的时序感知并行聚类

在本节中，我们介绍**时序感知并行聚类（Temporal-Aware Parallel Clustering, TAP）**，这是一种新方法，它整合空间数据分布和时序动态来解决具有复杂特征交互和固有时序模式的数据集聚类挑战。TAP 利用并行子采样来有效结合空间和时序相似性，为生成校准数据集提供了一种稳健的方法。

#### 算法概述

给定一个包含 (N) 个样本的数据集 (T)，TAP 通过子采样降低计算复杂度，然后在多个子采样集上并行处理。每个子样本通过随机采样生成，其中选择样本的概率为 (p_i = \frac{n}{N})，(n) 是每个子样本的样本数。通过重复这一过程，我们获得 (m) 个子采样集 (\{S_1, S_2, ..., S_m\})。并行子采样方法提供两个关键优势：（1）它减轻了数据集中潜在的随机噪声和分布偏差；（2）它显著提高了计算效率。

对于每个子采样集，构建相似度矩阵 (A^{(i)}_{\text{final}})。然后对每个加权相似度矩阵 (A^{(i)}_{\text{final}}) 应用谱聚类来检测社区。首先，我们为每个并行子采样集计算归一化拉普拉斯矩阵，如下所示：

$$L^{(i)} = (D^{(i)}_r)^{-\frac{1}{2}} A^{(i)}_{\text{final}} (D^{(i)}_c)^{-\frac{1}{2}} \in \mathbb{R}^{N \times n} \quad (4)$$

给定子采样相似度矩阵 (A^{(i)}_{\text{final}})，其中 (D) 是一个对角矩阵，第 (i) 个对角元素为 (\sum_h A^{(i)}_{kh})（(1 \leq k \leq N)），子采样节点集 (S_i) 的度矩阵定义为：

$$D^{(i)}_r = \text{diag}\left(D^{(i)}_{r,k}\right)_{k=1}^{N}, \quad D^{(i)}_c = \text{diag}\left(D^{(i)}_{c,h}\right)_{h=1}^{N} \quad (5)$$

然后提取 (L) 的前 (k) 个特征向量，并在结果特征向量矩阵的行上执行 k-means 聚类以产生最终聚类结果。由于整个数据集被划分为 (k) 个类别，我们可以从这些类别中均匀采样来构建最终校准数据集，确保其数据分布完美覆盖原始数据集的整体分布。详细算法流程如算法 1 所示。

#### 相似度矩阵 (A^{(i)}_{\text{final}}) 的定义

借鉴先前工作 [15, 23]，数据集 (T) 具有复杂的特征分布和固有时序模式。为考虑这些方面，我们通过结合空间和时序相似性来构建全面的相似度度量。具体而言，对于每个子集 (S_i)，我们基于特征空间计算数据相似度矩阵 (A^{(i)}_{\text{data}})，以及捕捉时序相关性的时序相似度矩阵 (A^{(i)}_{\text{time}})。然后为每个子样本构建加权相似度矩阵，结合空间和时序相似性：

$$A^{(i)}_{\text{final}} = \alpha A^{(i)}_{\text{spatial}} + (1 - \alpha) A^{(i)}_{\text{temporal}} \quad (6)$$

其中 (\alpha) 表示平衡数据空间和时序属性影响的可调权重。

**空间相似度矩阵** (A^{(i)}_{\text{spatial}}) 捕捉样本在数据特征方面的相似性。对于子采样集 (S_i) 中的每对样本 (x_k) 和 (x_h)，元素 (A^{(i)}_{\text{spatial},kh}) 表示这两个样本基于其特征向量的相似程度，可定义为：

$$A^{(i)}_{\text{data},kh} = \frac{x_k \cdot x_h}{\|x_k\|\|x_h\|} \quad (7)$$

**时序相似度矩阵** (A^{(i)}_{\text{temporal}}) 捕捉样本基于其时序关系的相似性。对于每对时间戳为 (t_k) 和 (t_h) 的样本，元素 (A^{(i)}_{\text{temporal},kh}) 可定义为：

$$A^{(i)}_{\text{time},kh} = \exp(-|t_k - t_h|) \quad (8)$$

#### 算法 1：时序感知并行聚类（TAP）

**输入**：包含 (N) 个样本的数据集 (T)，每个子样本的样本数 (n)

**输出**：数据集 (T) 的聚类分配

```
1  for i = 1 to m in parallel do
2      从 T 生成子样本 S_i，其中 |S_i| = n;
3      为 S_i 计算空间矩阵 A^(i)_spatial;
4      for S_i 中的每对 (x_k, x_h) do
5          A^(i)_spatial,kh ← (x_k · x_h) / (||x_k|| ||x_h||);
6      为 S_i 计算时序矩阵 A^(i)_temporal;
7      for 时间戳为 (t_k, t_h) ∈ S_i 的每对 do
8          A^(i)_temporal,kh ← exp(-|t_k - t_h|);
9      结合时空相似性 A^(i)_final;
10     计算度矩阵 D^(i)_r 和 D^(i)_c;
11     计算归一化拉普拉斯矩阵:
12     L^(i) ← (D^(i)_r)^(-1/2) A^(i)_final (D^(i)_c)^(-1/2);
13     提取 L^(i) 的前 k 个特征向量，并在特征向量矩阵行上执行 k-means 聚类;
14 聚合所有子样本的聚类分配以产生最终聚类结果;
```

### 3.2. 方差对齐以消除曝光偏差

假设随机变量 (f) 服从正态分布，记为 (f \sim N(\mu, \sigma^2))，其中 (\mu) 表示均值，(\sigma^2) 表示方差。要改变 (f) 的方差，我们可以应用缩放变换。如果目标是修改方差到新值 (\sigma^2_{\text{new}})，变换可定义如下：

$$Y = \mu + \frac{\sigma_{\text{new}}}{\sigma}(f - \mu) \quad (9)$$

（后续方法细节在原文中延续，包括方差补偿的具体实现、采样分布校正等技术环节。）

## 4. 实验

### 4.1 实验设置

我们的实验设置密切遵循原始 Diffusion Transformers（DiTs）研究 [43] 中的配置。我们使用预训练的类条件 DiT-XL/2 模型 [43]，在 ImageNet 数据集 [8] 上评估我们方法在 256 × 256 和 512 × 512 图像分辨率下的性能。主生成过程使用 DDPM 求解器 [17] 和 250 个采样步，同时使用减少到 100 和 50 的采样步进行额外评估，以进一步测试我们方法的鲁棒性。

为创建校准数据集，我们在扩散过程中跨 ImageNet 类别生成大规模样本，形成数据集 (D_l)。我们利用 TAP 算法选择最终集合用于量化校准。具体而言，执行三次并行采样过程，每次采样仅选择 1/20 的样本。这允许我们将 (D_l) 分为 100 个类别，从每个类别中随机选择 3-10 个样本，最终形成 800 个校准样本——遵循先前工作的实现 [55]。

所有实验均在 NVIDIA RTX A100 GPU 上进行，代码基于 PyTorch [42]。

为全面评估生成图像的质量，我们采用四个评估指标：Fréchet Inception Distance（FID）[16]、空间 FID（sFID）[39, 46]、Inception Score（IS）[1, 46] 和 Precision。所有指标均使用 ADM 工具包 [9] 计算。为公平比较所有方法（包括原始模型），我们对 ImageNet 256×256 采样 10,000 张图像，对 ImageNet 512×512 采样 5,000 张图像，与先前研究 [40, 49] 使用的标准一致。

### 4.2 性能比较

我们对方法与主流基线进行了全面评估，**首次**探索量化和缓存的结合效果。

我们的基准包括 PTQ4DM [49]、Q-Diffusion [23]、PTQD [15]、Learn-to-Cache [33]、RepQ [27] 和 Fora [48]。所有量化方法使用均匀量化器，对权重应用通道级量化，对激活应用张量级量化，而缓存方法存储和重用自注意力和 MLP 层的输出。

表 1 和表 2 总结了在 256 × 256 和 512 × 512 分辨率下 ImageNet 上大规模类条件图像生成的结果。

表 1 进一步展示了我们方法在各种时间步设置下的性能。重要的是，我们的发现表明，**在 8 位量化下，我们的方法与原始模型的生成质量紧密对齐，同时提供显著的计算效率**。

图 1 展示了不同配置下的效率与效果权衡，我们的方法实现了与原始模型（250 步，DDPM）相当的性能，但计算成本显著降低（12.7 倍提升），为高质量图像生成提供了一种实用解决方案。在所有测试设置中，我们的方法在性能-效率空间中处于左上位置，始终超越主流替代方案，验证了其有效性和适应性。

### 4.3 方法的通用性

为展示我们方法的通用性，我们还在 LSUN-Bedroom 和 LSUN-Church 数据集 [62] 上将 PTQ4DM [49] 和 APQ-DM [52] 进行了比较。结果如下。

**表 3. LDM 上 W8A8 的性能**

| Step | Method      | Speed   | LSUN-Bedroom FID ↓ | sFID ↓ | IS ↑ | LSUN-Church FID ↓ | sFID ↓ | IS ↑ |
|------|-------------|---------|--------------------|--------|------|--------------------|--------|------|
| 100  | DDIM        | 1×      | 6.39               | 2.45   | 10.98| 16.16              | 2.76   | —    |
|      | PTQ4DM      | 2×      | 7.48               | 2.23   | 10.98| 17.28              | 2.76   | —    |
|      | Q-Diffusion | 2×      | 7.04               | 2.27   | 12.72| 16.96              | 2.72   | —    |
|      | APQ-DM      | 2×      | 6.46               | 2.55   | 9.04 | 16.74              | 2.84   | —    |
|      | Q&C         | 3.02×   | 6.52               | 2.55   | 9.10 | 16.73              | 2.83   | —    |

### 4.4 方法有效性的可视化

为检验所提方法是否有效提升了校准数据集的样本效率并缓解了曝光偏差，我们在补充材料中提供了全面可视化。结果清楚表明 TAP 和 VC 分别显著增强了各个方面的性能。

### 4.5 消融实验

#### TAP 和 VC 的独立贡献

为评估 TAP 和 VC 的有效性，我们在 ImageNet 256 × 256 分辨率、50 个采样时间步的 W8A8 量化设置下进行了消融实验。我们评估了三种方法变体：

（i）**基线**，利用最新的量化和缓存技术，具体是在 DiTs 上结合 PTQ4DiT [55] 和 Learn-to-Cache [33]；

（ii）**基线 + TAP**，通过 TAP 选择优化的校准数据集；

（iii）**基线 + TAP + VC**，包含两个组件。

结果如表 4 所示，展示了每个添加组件的性能提升，证明了它们各自的有效性。值得注意的是，结果表明 TAP 和 VC 对生成输出的质量有显著贡献，表明我们第 2.2 节中的实验准确识别了量化和缓存结合使用的关键挑战，我们的方法有效解决了这些问题。具体而言，基线中量化和缓存方法的简单堆叠导致生成质量急剧下降，而添加 TAP 和 VC 后带来了实质性改进，FID 降低 8.24，sFID 降低 6.34，显著超越基线。

**表 4. 50 步时 ImageNet 256 × 256 上的消融实验**

| Method          | FID ↓ | sFID ↓ | IS ↑    | Precision ↑ |
|-----------------|-------|--------|--------|-------------|
| —               | 5.22  | 17.63  | 237.8   | 0.8056      |
| PTQ4DiT         | 5.45  | 19.50  | 250.68  | 0.7882      |
| Baseline        | 13.67 | 25.86  | 189.65  | 0.7124      |
| + VC            | 9.65  | 22.34  | 210.35  | 0.7445      |
| + TAP           | 8.34  | 21.65  | 220.67  | 0.7566      |
| + TAP + VC      | 5.43  | 19.52  | 250.68  | 0.7895      |

#### TAP 的有效性

为展示 TAP 方法的优越性，我们将其与几种常见聚类方法进行比较，涵盖了基于划分、基于密度和层次聚类的代表性算法。具体而言，我们选择 K-Means [28]、DB-SCAN [7] 和 Agglomerative [35] 聚类进行比较。结果如表 5 所示。

**表 5. 不同聚类方法的 TAP 消融实验**

| Method          | FID ↓ | sFID ↓ | IS ↑    | Precision ↑ |
|-----------------|-------|--------|--------|-------------|
| Kmeans          | 10.31 | 23.65  | 195.43  | 0.7332      |
| DBSCAN          | 10.12 | 23.21  | 201.35  | 0.7365      |
| Agglomerative   | 9.56  | 22.13  | 202.12  | 0.7345      |
| TAP (ours)      | 8.34  | 21.65  | 220.67  | 0.7566      |

#### TAP 中的超参数

TAP 利用空间数据分布和时序动态构建相似度矩阵。为评估公式（6）中参数 (\alpha) 的影响，我们进行了消融实验，结果如表 6 所示。

**表 6. 相似度矩阵在 ImageNet 256 × 256 上的消融实验**

| α   | FID ↓ | sFID ↓ | IS ↑    | Precision ↑ |
|-----|-------|--------|--------|-------------|
| 0.3 | 5.57  | 19.58  | 248.63  | 0.7823      |
| 0.4 | 5.46  | 19.55  | 250.62  | 0.7863      |
| 0.5 | 5.43  | 19.52  | 250.68  | 0.7895      |
| 0.6 | 5.36  | 19.56  | 249.53  | 0.7875      |
| 0.7 | 5.45  | 19.46  | 248.96  | 0.7725      |

## 5. 相关工作

由于与 DiTs 等更大模型相关的高计算成本，提高扩散模型的效率变得越来越必要。量化和缓存机制为提高扩散模型的计算效率提供了有前景的方法。

**量化方法**如后训练量化（PTQ）因能够在不需要重新训练的情况下减少模型大小和推理时间而受到关注，使其在计算上高效。与量化感知训练（QAT）不同，PTQ 只需最少校准，可以通过使用全精度模型生成校准数据集以无数据方式实现。Q-Diffusion [23] 等技术将 BRECQ [25] 提出的 PTQ 方法应用于优化各种数据集的性能，而 PTQD [15] 通过将量化误差与扩散噪声整合来减轻量化误差。EfficientDM [14] 等最新工作使用 QALoRA [13, 59] 微调量化扩散模型，而 HQ-DiT [30] 采用低精度浮点格式，利用数据分布分析和随机 Hadamard 变换来减少异常值并以最小计算成本增强量化性能。

**缓存**旨在利用连续扩散步骤中高层特征变化最小的特点，通过重用这些特征同时仅更新低层细节来减轻扩散模型推理中的计算冗余。例如，研究 [54, 58] 重用 U-Net 架构内特定组件的特征图，而 [18] 专注于重用注意力图。[50, 54, 58] 的进一步改进涉及缓存特征的自适应生命周期和调整缩放以最大化重用效率。此外，[63] 识别了保真度提升步骤中交叉注意力的冗余，可以缓存以减少计算。

先前研究在量化和缓存方面积累了大量工作。然而，对于这两种加速机制如何有效结合以及整合带来的挑战鲜有探索。本工作旨在系统地识别这些挑战并加以解决。

## 6. 结论

在本文中，我们研究了将量化技术与缓存机制整合以实现高效图像生成的影响。我们的研究确定了将量化与缓存策略结合时的关键挑战，特别是校准数据集中的冗余和曝光偏差的加剧。为应对这些挑战，我们引入了——用于校准的**时序感知并行聚类（TAP）** 和用于曝光偏差的**方差补偿（VC）策略**。结果表明，TAP 和 VC 的整合在保持计算效率的同时带来了生成质量的显著提升。我们相信我们的工作为更高效和更有效的图像生成流程铺平了道路。

未来研究将专注于将我们的方法扩展到各种类型的生成模型，并进一步优化计算成本与生成质量之间的权衡。

---

## 补充材料：曝光偏差定义

**曝光偏差（Exposure Bias）定义**：

曝光偏差是指生成模型训练过程与推理过程之间的差异。在训练期间，模型通常基于完整序列（例如整个标题或图像）进行条件化，而在推理时，它们逐步生成序列，仅观察先前生成的 token。这种逐步生成引入了一种偏差，因为模型并未基于尚未生成的未来 token 进行条件化。

---

## 参考文献

[1] Barratt S, Sharma R. A note on the inception score. arXiv:1801.01973, 2018.

[2] Brooks T, et al. Video generation models as world simulators. 2024.

[3] Carion N, et al. End-to-end object detection with transformers. ECCV, 2020.

[4] Chen P, et al. Delta-DiT: A training-free acceleration method tailored for diffusion transformers. arXiv:2406.01125, 2024.

[5] Chen X, Cai D. Large scale spectral clustering with landmark-based representation. AAAI, 2011.

[6] Croitoru F-A, et al. Diffusion models in vision: A survey. TPAMI, 45(9):10850-10869, 2023.

[7] Deng D. DBSCAN clustering algorithm based on density. IFEEA, 2020.

[8] Deng J, et al. ImageNet: A large-scale hierarchical image database. CVPR, 2009.

[9] Dhariwal P, Nichol A. Diffusion models beat GANs on image synthesis. NeurIPS, 2021.

[10] Feng X, et al. Faster matrix completion using randomized SVD. ICTAI, 2018.

[11] Finkelstein A, et al. Fighting quantization bias with bias. arXiv:1906.03193, 2019.

[12] Halko N, et al. Finding structure with randomness. SIAM review, 53(2):217-288, 2011.

[13] Han Z, et al. Parameter-efficient fine-tuning for large models: A comprehensive survey. arXiv:2403.14608, 2024.

[14] He Y, et al. EfficientDM: Efficient quantization-aware fine-tuning of low-bit diffusion models. arXiv:2310.03270, 2023.

[15] He Y, et al. PTQD: Accurate post-training quantization for diffusion models. NeurIPS, 36, 2024.

[16] Heusel M, et al. GANs trained by a two time-scale update rule converge to a local Nash equilibrium. NeurIPS, 30, 2017.

[17] Ho J, et al. Denoising diffusion probabilistic models. NeurIPS, 33:6840-6851, 2020.

[18] Hunter R, et al. Fast inference through the reuse of attention maps in diffusion models. arXiv:2401.01008, 2023.

[19] Jaiswal A, et al. Compressing LLMs: The truth is rarely pure and never simple. arXiv:2310.01382, 2023.

[20] Lee J, et al. Enhancing computation efficiency in large language models through weight and activation quantization. arXiv:2311.05161, 2023.

[21] Li M, et al. Time and space efficient spectral clustering via column sampling. CVPR, 2011.

[22] Li M, et al. Alleviating exposure bias in diffusion models through sampling with shifted time steps. arXiv:2305.15583, 2023.

[23] Li X, et al. Q-Diffusion: Quantizing diffusion models. ICCV, 2023.

[24] Li Y, van der Schaar M. On error propagation of diffusion models. ICLR, 2023.

[25] Li Y, et al. BRECQ: Pushing the limit of post-training quantization by block reconstruction. arXiv:2102.05426, 2021.

[26] Li Y, et al. Q-DM: An efficient low-bit quantized diffusion model. NeurIPS, 36, 2024.

[27] Li Z, et al. RepQ-ViT: Scale reparameterization for post-training quantization of vision transformers. ICCV, 2023.

[28] Likas A, et al. The global k-means clustering algorithm. Pattern recognition, 36(2):451-461, 2003.

[29] Liu S-Y, et al. Oscillation-free quantization for low-bit vision transformers. ICML, 2023.

[30] Liu W, Zhang S. HQ-DiT: Efficient diffusion transformer with FP4 hybrid quantization. arXiv:2405.19751, 2024.

[31] Liu X, et al. Enhanced distribution alignment for post-training quantization of diffusion models. arXiv:2401.04585, 2024.

[32] Lu X, et al. TerDiT: Ternary diffusion models with transformers. arXiv:2405.14854, 2024.

[33] Ma X, et al. Learning-to-cache: Accelerating diffusion transformer via layer caching. arXiv:2406.01733, 2024.

[34] Martin L, et al. Fast approximate spectral clustering for dynamic networks. ICML, 2018.

[35] Murtagh F, Legendre P. Ward's hierarchical agglomerative clustering method. J. classification, 31:274-295, 2014.

[36] Nagel M, et al. Data-free quantization through weight equalization and bias correction. ICCV, 2019.

[37] Nagel M, et al. Up or down? Adaptive rounding for post-training quantization. ICML, 2020.

[38] Nagel M, et al. A white paper on neural network quantization. arXiv:2106.08295, 2021.

[39] Nash C, et al. Generating images with sparse representations. arXiv:2103.03841, 2021.

[40] Nichol A Q, Dhariwal P. Improved denoising diffusion probabilistic models. ICML, 2021.

[41] Ning M, et al. Input perturbation reduces exposure bias in diffusion models. arXiv:2301.11706, 2023.

[42] Paszke A, et al. PyTorch: An imperative style, high-performance deep learning library. NeurIPS, 32, 2019.

[43] Peebles W, Xie S. Scalable diffusion models with transformers. ICCV, 2023.

[44] Ranzato M, et al. Sequence level training with recurrent neural networks. arXiv:1511.06732, 2015.

[45] Rennie S J, et al. Self-critical sequence training for image captioning. CVPR, 2017.

[46] Salimans T, et al. Improved techniques for training GANs. NeurIPS, 29, 2016.

[47] Schmidt F. Generalization in generation: A closer look at exposure bias. arXiv:1910.00292, 2019.

[48] Selvaraj P, et al. Fora: Fast-forward caching in diffusion transformer acceleration. arXiv:2407.01425, 2024.

[49] Shang Y, et al. Post-training quantization on diffusion models. CVPR, 2023.

[50] So J, et al. FrDiff: Feature reuse for universal training-free acceleration of diffusion models. arXiv:2312.03517, 2023.

[52] Wang C, et al. Towards accurate data-free quantization for diffusion models. arXiv:2305.18723, 2023.

[53] Williams M, Aletras N. On the impact of calibration data in post-training quantization and pruning. ACL, 2024.

[54] Wimbauer F, et al. Cache me if you can: Accelerating diffusion models through block caching. CVPR, 2024.

[55] Wu J, et al. PTQ4DiT: Post-training quantization for diffusion transformers. arXiv:2405.16005, 2024.

[56] Wu X, et al. Zero-quant (4+2): Redefining LLMs quantization with a new FP6-centric strategy for diverse generative tasks. arXiv:2312.08583, 2023.

[57] Xie E, et al. SegFormer: Simple and efficient design for semantic segmentation with transformers. NeurIPS, 34:12077-12090, 2021.

[58] Xu M, et al. DeepCache: Principled cache for mobile deep vision. MobiCom, 2018.

[59] Xu Y, et al. QA-Lora: Quantization-aware low-rank adaptation of large language models. arXiv:2309.14717, 2023.

[60] Yan D, et al. Fast approximate spectral clustering. KDD, 2009.

[61] Yang L, et al. Diffusion models: A comprehensive survey of methods and applications. ACM Computing Surveys, 56(4):1-39, 2023.

[62] Yu F, et al. LSUN: Construction of a large-scale image dataset using deep learning with humans in the loop. arXiv:1506.03365, 2015.

[63] Zhang W, et al. Cross-attention makes inference cumbersome in text-to-image diffusion models. arXiv:2404.02747, 2024.

[64] Zhao T, et al. ViDiT-Q: Efficient and accurate quantization of diffusion transformers for image and video generation. arXiv:2406.02540, 2024.

[65] Zhao T, et al. MixDQ: Memory-efficient few-step text-to-image diffusion models with metric-decoupled mixed precision quantization. arXiv:2405.17873, 2024.

---

*本文翻译自 arXiv:2503.02508，ICLR 2026。翻译保留所有技术细节、公式、算法描述和实验结果。*
