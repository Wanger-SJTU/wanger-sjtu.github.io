---
title: "DeepSeek-V4 论文逐页注解巡读"
date: 2026-05-12
tags:
  - 论文解读
  - DeepSeek
  - MoE
  - LLM
mathjax: true
source: https://dsv4.interactive.ikot.blog/
---

# DeepSeek-V4 论文逐页注解巡读

> **作者**: Igor Kotenkov
> **原文**: [DeepSeek-V4: Annotated Paper Walkthrough](https://dsv4.interactive.ikot.blog/)

本文档包含 50 条注解，涵盖 DeepSeek-V4 论文的核心技术要点。注解类型包括：规模笔记、架构笔记、硬件笔记、训练笔记、MoE笔记、注意力笔记、精度笔记、内存笔记、系统笔记、内核笔记、优化器笔记、后训练笔记、Agent笔记、蒸馏笔记、评估笔记等。

## 第 1 页

### 🔢 Big model smell

Finally, we have a model comparable in scale to Google's [legendary Switch-C](https://huggingface.co/google/switch-c-2048)! It's been [5 years](https://arxiv.org/abs/2101.03961) since Noam Shazeer & Co. scaled MoEs to an unprecedented size, though that model only had about 1.8B active parameters.

最后，我们拥有了一个规模可与谷歌的[传奇 Switch-C](https://huggingface.co/google/switch-c-2048)相媲美的模型！自从 Noam Shazeer 等人将 MoE 扩展到前所未有的规模已经过去了[5 年](https://arxiv.org/abs/2101.03961)，不过那个模型的有效参数只有约 1.8 B。

To put things in perspective, Google spent roughly \(3.3 \times 10^{21}\ \text{FLOPs}\) (floating-point operations) on that pretraining run. If we do some back-of-the-envelope math for DeepSeek-V4 Pro, we get:

为了给出直观的对比，谷歌在该预训练过程中大约消耗了 \(3.3 \times 10^{21}\ \text{FLOPs}\)（浮点运算）。如果我们对 DeepSeek-V4 Pro 进行简易估算，可得：

\[\begin{aligned}
\mathrm{FLOPs}_{\mathrm{V4\ Pro}}
&amp;\approx 6 \times N_{\mathrm{active}} \times D_{\mathrm{tokens}} \\
&amp;\approx 6 \times 49\mathrm{B} \times 33\mathrm{T} \\
&amp;\approx 9.7 \times 10^{24}\ \text{FLOPs} \\
&amp;\approx 1 \times 10^{25}\ \text{FLOPs}
\end{aligned}\]

That's a 3,000x difference in compute!

这意味着计算量相差约 **3,000 倍**！

### 📊 Comparison with DeepSeek-V3.2

……这已经是一个强大的基线。事实上，它在注意力机制的某些调整上具有开创性——正是这些调整如今在DeepSeek-V4中得以体现，而且其运行效率也出奇地高。

[以下是](https://arxiv.org/pdf/2512.02556) V3.1与V3.2在不同上下文长度下的推理成本对比。（快速回顾：预填充阶段指模型为提示语计算KV缓存，而解码阶段则是逐词生成实际输出的过程。）

![](asset/dsv4/img_01.png) alt="推理成本对比图">

## 第 4 页

### 🏗️ What counts as modeling capability

这可能听起来有些抽象，所以让我们澄清一下。**“建模能力”**通常指模型表示复杂函数并捕捉错综模式的能力。你也可以把它看作是**拓扑表达力**——即模型在不同层之间灵活路由、存储和组合信息的程度。

正如众多**机制可解释性**论文所展示的（[1](https://transformer-circuits.pub/), [2](https://arxiv.org/abs/2312.12141v1)），Transformer 中的信息是顺序流经唯一的**残差流**（residual stream）的。这是层读取和写入的主要高速公路。每一层（Attention、MLP、MoE）都必须从该流中读取数据，进行处理，然后再写回去。

![](asset/dsv4/img_02.png) alt="Transformer 残差流示意图">

> 摘自 [Anthropic 的博客文章](https://transformer-circuits.pub/2021/framework/index.html)。

（这直接来源于残差连接的工作方式：`x' = x + layer(x)`（为简洁起见省略了归一化），我们只是把多个相加操作链在一个不断变化的 `x'` 上。）

提升建模能力和表达力的最可靠方法是通过增加隐藏维度或嵌入维度来**扩宽**这条“高速公路”。直观上，这相当于为层间信息传递创建了更多的“槽位”。但这里有一个限制：Attention / FFN / MoE 层的计算成本（FLOPs）随隐藏维度的增加呈二次增长。把残差流扩宽会使模型的计算速度显著下降，并且计算负担大幅加重。

这正是 **HyperConnections (HC)** 及其升级版 **mHC** 发挥作用的地方。它们能够在几乎不增加计算开销的情况下，**大幅提升残差流的带宽**。本质上，它们引入了一种“虚拟”宽度，使得表示保持区分度和丰富度。通过将残差流扩展 \(n\) 倍（例如，宽度提升 4 倍），它可以在不覆盖先前数据的情况下，向前传播四倍的信息量。

## 第 5 页

### ⚡ How FP4-FP8 can be more efficient

以下是您所需的中文翻译，已严格遵循保留Markdown格式、LaTeX公式、代码块、URL链接以及专业术语准确性的要求：

为什么效率提升了1/3？张量核心的计算受限于物理资源。具体来说，关键在于每个周期内能有多少操作数比特被暂存、解码并送入计算流水线。

当矩阵元素的大小缩小时，我们可以在相同时间内将更多元素推入数据通路。但有一个前提：计算块本身必须原生支持这种格式。

以下是英伟达的官方规格。您可以清楚地看到，操作数大小减半后，潜在的计算能力翻了一番：

![](asset/dsv4/img_03.png) alt="英伟达计算规格">

在底层，这种加速是因为GPU指令可以在单次处理中以固定的时钟周期数处理更大的矩阵。

请查看这篇[论文](https://www.scribd.com/document/768738241/Benchmarking-and-Dissecting-the-Nvidia-Hopper-GPU-Architecture)中的截图，该论文对H800上的不同指令进行了基准测试：

![](asset/dsv4/img_04.png) alt="H800指令基准测试">

请注意，指令名称中包含了矩阵分块大小 `m-n-k`。例如，`m64n256k16`（16位格式的第一行）表示将一个 `64x16` 的矩阵乘以一个 `16x256` 的矩阵。

现在看第四行中的8位FP8格式。它使用了 `m64n256k32`，这意味着将 `64x32` 乘以 `32x256`。这是该GPU类型的最大可能尺寸；更大的矩阵会被拆分成多个分块。

内维度K翻倍了，但该指令仍然恰好需要128个时钟周期来执行。因此，通过降低到8位，GPU在相同周期数内成功将乘法的元素数翻倍。

这引出了一个有趣的结论。如果GPU原生支持FP4 x FP8，那么每条指令处理的数据元素数将超过FP8 x FP8。这给我们带来了理论上的加速比 \((8+8)/(4+8) = 16/12 = 1.33\times\)。

但如果没有这种硬件支持，开发者只能使用性能与标准FP8 x FP8完全一致的指令。

当前一代

## 第 6 页

### 🏗️ Transformer of Theseus

很有意思，我们把这类模型仍称为“Transformer”，沿袭2017年原始架构的命名，但实际上几乎所有组件都已面目全非。

注意力机制如今已彻底改头换面（比如本论文中实际上采用了两种注意力类型！）。我们抛弃了标准前馈网络（FFN），改用混合专家模型（MoE）——而MoE自身也已历经数次迭代——同时替换了位置嵌入，并从LayerNorm转向RMSNorm。

就连损失函数也进化到融合了多Token预测任务。更不用说，原始编码器-解码器架构已发生了向仅解码器大型语言模型（Decoder-only LLM）的宏大范式迁移。

再加上传奇般的Adam优化器已被AdamW取代，如今我们正迈向Muon优化器。

这堪称“忒修斯之Transformer”。若随时间推移替换掉所有原始组件，它是否仍是Transformer？这个问题留给读者作为思考题。

## 第 7 页

### 🎯 Multi-Token Prediction

多令牌预测（Multi-Token Prediction，MTP）顾名思义，是在每个位置同时预测多个未来令牌。在V4版本中，我们仅额外预测一个令牌，但为何要如此设计？

首先，MTP目标函数能提供更密集的训练信号，从而提升数据效率。同时，它迫使模型"提前规划"，并针对未来令牌优化其内部表征。

如原始[DeepSeek-V3论文](https://arxiv.org/abs/2412.19437)图示所示，MTP在保持每步完整因果链的前提下，顺序预测这些额外令牌。

![](asset/dsv4/img_06.png) alt="MTP顺序预测示意图">

在架构层面，每个MTP模块与主模型共享输入和输出嵌入，但维护独立的完整Transformer块。该模块包含注意力层，且尽管论文未明确证实，很可能还包含MoE层（尽管也可能只是标准的前馈网络FFN）。

通过MTP，我们计算标准交叉熵损失。该损失作为辅助损失，其权重系数（参考V3论文）可能在0.1至0.3之间。

训练时，MTP采用标准交叉熵损失。根据V3论文推断，该损失作为辅助损失，权重因子可能设定在0.1至0.3范围内。

### 🧩 Auxiliary-loss-free expert routing

当训练MoE模型时，token路由常遭遇"路由坍缩"问题——网络会顽固地将大多数token发送给少数专家。这完全摧毁了效率，造成严重的GPU瓶颈，使大部分硬件处于闲置状态。传统解决方案是使用辅助损失函数——通过惩罚项强制模型均匀分配token。

但该惩罚项作为正则化项会改变梯度，与主要语言建模目标产生冲突。如[此项研究](https://arxiv.org/abs/2408.15664)所示，若将惩罚强度提升至足以成功平衡负载，则会降低模型的整体性能。

为摆脱这种权衡，无辅助损失策略将平衡机制从损失函数中剥离，直接嵌入路由过程。具体通过为每个专家施加动态偏置实现（每个MoE层中每个专家仅对应一个标量值）。

当某专家接收的token超过公平份额时（参见下图外列），其偏置会被**降低**以抑制被选中概率。若专家未被充分利用，则偏置会被**提升**。通过基于批次统计迭代调整这些偏置，我们能在不损害训练目标的前提下实现专家负载的完美均衡。

![](asset/dsv4/img_07.png) alt="MoE层动态偏置与负载均衡">

精妙之处在于：该动态偏置仅用于路由决策。选定顶尖专家后，偏置随即被剥离。随后我们使用原始路由器的评分来加权专家实际输出的结果。

### 🧩 Hash routing in early layers

在几乎所有近期的 **MoE** 模型中，前 **1 到 3 层** 都是标准的 **dense FFN**。我们采用这种结构纯粹是出于必要性。如果在最早的层中使用学习得到的 MoE 路由，往往会遭遇 **“routing collapse”** ——模型几乎把所有 token 都倾斜到一两个 expert 上，导致训练极度不稳定。

**为什么会出现这种情况？**  
Transformer 的最早几层充当 **特征提取器**，抽取诸如形态学和拼写等通用的低层次特征。这一步发生在 token 表示甚至还未吸收其周围上下文之前。由于这些隐藏状态完全 **未上下文化**，标准的 MoE 路由器难以学习到任何有意义、动态的 expert 专业化映射。

**dense FFN** 通过强制所有 token 使用完全相同的权重来解决这一问题。它构建了一个共享的表征基础。相比于 **增加 hidden size**（这会导致后续所有层的计算量呈二次增长），这种方式更为高效。它也优于 **扩展词表规模**——巨大的词表已经存在大量稀有、训练不足的 token（如果你还没读过著名的 [SolidGoldMagikarp](https://www.lesswrong.com/posts/aPeJE8bSo6rAFoLqg/solidgoldmagikarp-plus-prompt-generation) 故事，它正好阐释了这一问题）。

此外，即使训练得到稳定，**早层学习到的路由器** 能实现的最好效果也只能是记忆一个静态映射。它本质上学习到类似 “**始终将 Token ID 405 发送给 Expert 3**” 的硬编码规则。**HashMoE** 正是利用了这一点：完全去除学习到的路由器，

### 🧩 Sqrt-Softplus for router scores

在选择并计算MoE层中K个专家的输出后，我们计算其加权和。将此过程分解为三个不同的概念会更有帮助：

- **路由器logits** — 路由器线性层的原始输出。
- **亲和力得分** — 应用激活函数（如\(Softmax\)）后得到的正得分。
- **路由权重** — 归一化后选出的top-K得分，实际用于混合专家输出。

经典的MoE路由器通常依赖\(Softmax\)。这确保了所选专家的权重非负，并被归一化为类似概率的分布。但\(Softmax\)由于指数运算可能变得过于尖锐。例如，如果4个专家的路由器logits为`[4, 4, 4, 8]`，最后一个专家会占据约95%的概率质量，前三个专家只能争夺剩余的5%。这导致了严重的赢家通吃局面。

DeepSeek-V3通过改用基于\(Sigmoid\)的亲和力得分解决了这一问题。与\(Softmax\)不同，\(Sigmoid\)独立地对每个专家进行评分。如果一个专家获得高分，并不会自动抑制其他专家。

但\(Sigmoid\)有其致命缺陷：它会饱和。较大的正logits会被压缩到接近1，较大的负logits则降至接近0。梯度在两端都会消失。因此，如果两个专家的logits分别为4和8，\(Sigmoid\)只会说：“嗯，它们基本上都是1。”你会丢失关于该token与专家实际匹配程度的关键信息。

这种基于\(Sigmoid\)的路由方式迅速成为类似DeepSeek的MoE模型的标准，包括Kimi K2.x、GLM-5.x和MiniMax-M2.x。然而，在DeepSeek-V4中，团队再次调整了方向。他们放弃了\(Sigmoid\)，转而采用\(Sqrt(Softplus)\)。

\(Softplus\)的行为类似于平滑的\(ReLU\)：\(Softplus(z)=\log(1+e^z)\)：

![Softplus激活函数图](asset/dsv4/img_08.png) 
对于高度负值，它趋近于零。但对于较大的正值，它保持线性增长。

### 🏗️ How Hyper-Connections expand

You might assume this means adding \(n_{hc}\) embedding layers at the start to pass multiple distinct embeddings down the residual stream. Surprisingly, that’s not the case. For each token, the embedding is simply repeated multiple times:

```python
def forward(self, input_ids: torch.Tensor, start_pos: int = 0):
    h = self.embed(input_ids)
    # Expand to hc_mult copies for Hyper-Connections using repetition
    h = h.unsqueeze(2).repeat(1, 1, self.hc_mult, 1)
    # Traverse transformer blocks
    for layer in self.layers:
        h = layer(h, start_pos, input_ids)
    # Output LMHead
    logits = self.head(h, self.hc_head_fn, self.hc_head_scale, self.hc_head_base, self.norm)
    return logits
```

Under the hood, each `layer` contains the projection matrices we’ll discuss later. We need these to mix the \(n_{hc}\) channels into one before running the core operation (like Attention or MoE), and to separate them back out afterward. 

In practice, this means that while identical embeddings enter the first transformer layer across all \(n_{hc}\) streams, they will look different by the time they exit.

### 🏗️ Hyper-Connections and Equations 1, 3, 5 explained

该方程与下方公式(3)-(5)可能看起来极其复杂且难以直观理解，但理解它们的关键在于论文中的图2：

![](asset/dsv4/img_09.png) alt="图2 论文中解释超连接（HyperConnections）的示意图">

现在，Transformer块对每个词元输入4个嵌入向量，而非仅1个（因为DeepSeek-V4 Pro架构中\(n_{hc} = 4\)）。然而，核心层（DeepSeekMoE / CSA / HCA）仍仅处理单个嵌入向量。为填补这一差异，他们引入了两个组件：

- **块前混合**（底部中央）。这对应于公式中的输入映射\(A_l\)。我们将4个嵌入向量展平为单一向量，并通过一个输出维度为4的线性层。这4个数值作为权重，对输入嵌入向量进行加权求和，最终得到一个单一嵌入向量，该向量以正确比例融合了所有4种"语义"。这个单一嵌入向量才是实际输入核心层的对象。

- **块后混合**。这对应于公式中的输出映射\(C_l\)。其作用相反，将单一嵌入向量重新分配回4个残差流中。值得注意的是，我们并非将层输出拆分为四个不同向量，而是将相同的层更新广播至四条超连接通道，仅使用不同的学习振幅。例如，我们可能对某个残差流写入`1.1 * u`，而对另一残差流写入`0.3 * u`，其中\(u\)为核心层的输出。

- 尽管这可能听起来有违直觉，但此步骤的权重是通过拼接块前混合中使用的完全相同的4个嵌入向量获得的。此处的线性层具有相同维度：输入为\(4d\)，输出为4。

简而言之：四个嵌入向量被压缩为相同尺寸的单一嵌入向量。该向量以零计算开销通过MoE/Attention层，随后广播回四个流。在公式中，这表示为\(C_lF_l(A_lX_l)\)，而非标准的\(F_l(X_l)\)。此后，

## 第 8 页

### 📐 TF is Birkhoff polytope?

“这到底是什么鬼？”你可能会问。我讨厌那些简单概念被冠以过度复杂名称的命名方式。你很快就会发现，这其实相当直白。

在这个上下文中，残差映射矩阵 \(B_l\) 正是我前面提到的那个4x4矩阵。它只是定义了用于组合不同残差流中嵌入向量的权重。

研究人员用所有这些花哨的术语只是为了说明一个基本事实：让我们对矩阵进行归一化，使得每一行和每一列之和都恰好为1，并且所有元素保持非负。遵循这一规则的矩阵被称为“双随机矩阵”。所有这类矩阵的数学集合被称为“伯克霍夫多面体”。

这是mHC与标准HC之间的核心区别。甚至在V4之前，研究人员就注意到控制残差流混合的4x4矩阵容易出现退化。随着网络层数加深，这些矩阵的绝对值会变得越发离谱：

![](asset/dsv4/img_13.png) alt="分别对应第1层、第30层和第60层的矩阵">

> 分别对应第1层、第30层和第60层的矩阵

在图像的上半部分，你可以看到未经过归一化训练的网络的 \(B_l\) 矩阵。每行和每列的和分别标注在每个矩阵的左侧和底部边缘。如你所见，这些和会不断膨胀。

如果我们使用这些未经归一化的原始权重来组合残差流，向量模长将完全失去约束。它们不仅无法保持稳定，还可能以数十倍或数百倍的幅度跳跃。这对优化来说是彻底的噩梦，并会导致严重的训练不稳定。

但请看图像的下半部分。mHC对这些矩阵进行了归一化，使得这些和保持在1附近。虽然这并非总是完美，但嘿，它确实有效！

### ⚖️ Why constrain residual mixing in mHC?

回顾一下，当你将嵌入向量 \(x\) 与权重矩阵 \(W\) 相乘时，实际上是在应用一个线性变换。从几何角度来看，该变换会对输入空间进行旋转、挤压和拉伸。

矩阵的谱范数就是其最大拉伸因子。由于论文将该范数约束为1，矩阵的最大拉伸因子至多为1.0。因此，无论你用该矩阵乘以任何向量，输出长度都不会超过输入长度。

为什么这一点很重要？在mHC中，我们会在残差流中反复应用混合变换。如果其中任意矩阵的谱范数大于1，激活空间中的某些方向将持续被放大。即使每层仅放大3%，在60层网络中也会产生 \(1.03^{60} \approx 5.9\) 倍的放大效应。

通过将 \(B\) 约束为双随机矩阵，mHC使得残差映射表现为一个保质量的混合器。它可以在扩展的残差通道间混合信息，但无法任意放大信号。

[mHC论文](https://arxiv.org/abs/2512.24880) 直接可视化展示了这一效果：在无约束的HC设置与约束后的mHC设置中，分别呈现了60层残差混合矩阵的乘积。在HC情况下，复合映射出现了极端的正负值。这意味着残差流中的某些路径会强烈放大信号或梯度——这正是导致优化不稳定的典型行为。

![](asset/dsv4/img_14.png) alt="60层残差混合矩阵的乘积">

而在mHC情况下，复合矩阵保持稳定。其元素为非负值，行和与列和均接近1。由于底层归一化算法是迭代式的，双随机约束只是近似满足，因此行和与列和并非精确等于1。但关键在于，增益始终保持有界，而非无限膨胀。

### 🌀 The Birkhoff polytope

如前所述，这种复杂的表述实际上意味着我们对矩阵进行归一化，使得每一行和每一列的和均为1，且所有元素均为非负值。

## 第 9 页

### 👁️ Two KV-entry series

一个系列 \(C^b\) 包含代表"当前块"的特征，而另一个系列 \(C^a\) 则代表"前一块"。实际上，我们为每个令牌创建了两种表示形式。第一种用于该令牌属于当前压缩块时，并可能编码其核心含义；第二种用于该令牌作为上下文时，仅提供补充性细节。

## 第 10 页

### 👁️ Learnable positional biases

这些仅仅是位置偏差。它们允许模型学习每个块内的衰减效应等模式，即较早的token对求和结果的贡献小于较晚的token。由于每个块包含\(m\)个token，我们需要\(m\)个这样的偏置向量。

### 👁️ Equations 11-12 for CSA

让我们更详细地拆解这些公式中发生了什么。我们有三对术语：

- **\(C^a\) 和 \(C^b\)** — 用于构建压缩块表示的 token 向量。正如前文所述，\(a\) 与 \(b\) 分别表示前一个块和当前块。在 **CSA** 中，每个块有 \(m=4\) 个 token（在 **HSA** 中是 \(m=128\)，但思想完全相同）。
  
  *直观上，这些向量捕获了嵌入的真实语义。*

- **\(Z^a\) 和 \(Z^b\)** — 我们在压缩过程中用于加权不同 token 的局部 attention logits。不同于标准 Attention 为每对 token 计算一个 logit，这里的 logits 是按通道（channel）划分的。

  *直观上，这些向量跟踪每个 token 内信息的重要性。*

- **\(B^a\) 和 \(B^b\)** — 如前所述，这些只是按位置的偏置，使模型能够学习诸如块内部衰减（intra‑chunk decay）之类的行为。

  *直观上，它们根据 token 的位置对 \(Z^a\) 和 \(Z^b\) 的重要性进行下调。*

因此，公式中传递给 **\(Softmax_{row}\)** 的参数表示两个块（当前块和前一个块）中全部 \(2m\) 个 token 的重要性（就像它们被拼接在一起），并已根据它们的位置进行了校正。**\(Softmax_{row}\)** 随后在每个通道上分别对这些 token 进行 softmax 归一。与标准 **Softmax**（通常作用于标量）不同，这里我们对每个隐藏通道独立地、在相邻两块的 token 位置上执行该操作。

于是，**\(Softmax_{row}\)** 输出加权得分 **\(S^a\)** 与 **\(S^b\)**。我们利用这些得分对 **\(C^a\)** 与 **\(C^b\)** 按通道进行加权，如公式 (12) 所示。这实际上是对平均池化（average pooling）的一种更智能的替代方案——token 自行决定自身的权重。

我们将 **\(C\)** 与 **\(Z\)** 解耦，以处理特定的极端情况。有时某个 token 嵌入通道的数值会异常大，在普通的平均池化中会主导压缩后的表示。将二者分离即可确保它不会贡献过多。

### 🔢 The Hadamard product

Hadamard乘积 \(\odot\) 只是逐通道的乘法：

![](asset/dsv4/img_15.png) alt="Hadamard product illustration">

正如我之前所述，权重是对每个通道单独施加的，而不是对每个 token 使用单一的标量权重。这正是我们在此需要使用 Hadamard 乘积的原因。

## 第 11 页

### 👁️ The grouped projection trick

根据我的了解，这是首次采用此类方法。在先前任何同等规模的LLM中都无法找到这种方案。不过，偶尔能看到概念上相似的想法，例如论文《重新思考注意力输出投影：面向高效Transformer的结构化哈达玛变换》（[Rethinking Attention Output Projection: Structured Hadamard Transforms for Efficient Transformers](https://arxiv.org/abs/2603.08343)）中的相关研究。

### 🔢 The "quite large" attention output

When the paper says "\(cn_h\) is quite large", they mean \(c \times n_h = 512 \times 128 = 65536\). So before the attention output projection, each token has a 65,536-dimensional concatenated attention output. Since the model's hidden size is \(d = 7168\), the output projection would require a Linear layer with nearly 470 million parameters—for every single layer.

For reference, BERT-Large had 340M parameters in total. Oh, the brave new world of LLMs!

That's why DeepSeek factorizes this massive matrix into several smaller ones. This trick cuts the parameter count per layer down to \(16 \times (4096 \times 1024) + 16384 \times 7168 \approx 185\)M parameters, which is a 2.55x reduction. Across 61 layers, you're looking at roughly 28.66B parameters for the naive approach versus 11.26B parameters with GOP. That saves 17.4B parameters just in the attention output projections alone.

You might wonder why other models haven't used this trick. Well, most mainstream models have significantly smaller (compressed) per-head embedding sizes. For instance:

- In DeepSeek-V3.2, \(c \times n_h = 128 \times 128 = 16384\), and the `Linear(16384, 7168)` layer only has 117M parameters.

- For Kimi-2.5/2.6, \(c \times n_h = 128 \times 64 = 8192\), and the `Linear(8192, 7168)` layer has 59M parameters.

So, this bottleneck only emerged because of the massive increase in embedding size. This is mainly because the sequence is compressed, with each chunk representation carrying the semantic information of multiple tokens at once.

## 第 13 页

### 👁️ RoPE on 64 dimensions

The idea of applying RoPE to only a part of the embedding isn't exactly new. It surfaced recently in [Gemma 4](https://arc.net/l/quote/wvnvlywj), for example. Let's dive into how and why this actually works.

RoPE takes the Query and Key vectors and slices them up into pairs of values. A 64-dimensional vector has 32 of these pairs. We can look at each pair as a 2D vector pointing in a specific direction. RoPE applies a slight rotation to each pair, and angle of rotation decreases as we move through the embedding dimensions. As Maarten Grootendorst explains in his [Gemma 4 breakdown](https://newsletter.maartengrootendorst.com/i/193064129/p-rope):

![](asset/dsv4/img_16.png) alt="image.png">

This is known as the frequency. High-frequency pairs are extremely sensitive to small position changes because they undergo a large rotation. The low-frequency pairs, on the other hand, get a very slight rotation. They barely move at all from word to word.

You could say the first pairs are high-frequency and handle short-range dependencies. The last pairs are low-frequency and manage long-range influence. Since they rotate so little over standard context lengths, relative position doesn't drastically change their dot-product contribution.

But why use rotation in the first place? RoPE changes the relative angle between the Query and Key while preserving their norms. This directly affects their dot product, which is what we use to compute attention logits. Rotation lowers the dot product, which in turn lowers the attention scores. Here's a cool GIF from Lorenzo Cesconetto’s [blog](https://towardsdatascience.com/rope-clearly-explained/):

![](asset/dsv4/img_17.gif) alt="DeepSeek uses RMSNorm before core attention on both Qs and KVs, so calling it “cosine” is somehow justified.">

> DeepSeek uses RMSNorm before core attention on both Qs and KVs, so calling it “cosine” is somehow justified.

The tempting intuition here is simple: the larger the relative distance, the more the rotation misaligns the Query and Key, so the attention score should decay. This holds up in a toy setup where Q and K are already aligned or nearly constant. But generally speaking, it's just not true! To quote the paper [Round and Round We Go! What makes Rotary Positional Encodings useful](https://arxiv.org/abs/2410.06205):

> 

A common belief is that RoPE is useful because it helps to decay token dependency as relative distance increases. In this work, we argue that this is unlikely to be the core reason. We study the internals of a trained Gemma 7B model to understand how RoPE is being used at a mechanical level. We find that Gemma learns to use RoPE to construct robust "positional" attention patterns by exploiting the highest frequencies. We also find that, in general, Gemma greatly prefers to use the lowest frequencies of RoPE, which we suspect are used to carry semantic information.

&lt;…&gt; we carry out an ablation in which they truncate the very lowest frequencies of RoPE. The intuition is that &lt;…&gt; truncating the lowest frequencies should not harm performance. In fact, this allows RoPE to provide robust semantic channels that are distance agnostic. We call this modification p-RoPE, with \(p\) being the fraction of RoPE “kept”.

DeepSeek-V4 uses **partial RoPE**, not p-RoPE (and yes, they are actually different). The model reserves the last 64 dimensions of each 512-d attention head as a RoPE slice and computes a standard 64-d RoPE ladder directly within that slice. This differs from p-RoPE, which keeps the original full-head frequency scale but discards the lowest-frequency dimensions. To put it simply: DeepSeek reduces the rotary dimension, while p-RoPE truncates the frequency ladder.

And, of course, you could just as easily use the first 64 dimensions instead of the last—it makes absolutely no difference.

![](asset/dsv4/img_18.png) alt="image.png">

### 👁️ RoPE absolute-position leakage

To see why this happens, we need to dig into the math behind how RoPE actually works. In the previous note, we talked about slicing the Query and Key vectors into pairs of values, then rotating them by different angles.

These angles are a deterministic function of the token's **absolute** position and the specific RoPE channel pair index. But wait, don't we want relative positional encoding? Yes! And that's exactly what we get when we multiply Q and K to compute the attention logits.

To see why, let's recall two handy properties of rotation matrices:

- The transpose of a rotation matrix gives you the inverse rotation: \(R_a^T = R_{-a}\)

- Multiplying two rotation matrices adds their angles together: \(R_a R_b = R_{a+b}\)

Now, imagine we're computing the attention logit between a query at position \(t\) and a key at position \(j\). Without RoPE, that's just \(attention_{logit}(t, j) = q_t^T k_j\). Let's apply the RoPE rotation matrices to Q and K: \(q_t\rarr R_t q_t,\space\space k_j \rarr R_j k_j\). As mentioned earlier, these matrices depend *only* on their absolute positions in the sequence, \(t\) and \(j\).

So our new score becomes:

\[\begin{aligned}
score(t, j)
&amp;= (R_t q_t)^T (R_j k_j) \\
&amp;= q_t^T R_t^T R_j k_j \\
&amp;= q_t^T R_{j-t} k_j
\end{aligned}\]

Boom! The extra term in our dot product no longer depends on \(t\) and \(j\) individually. It depends purely on their difference! \(R_{j-t}\) will be exactly the same whether \(j=995, \space t=1000\) or \(j=95,\space t=100\). In both cases, the tokens are exactly 5 positions apart.

Now, let's see how RoPE actually gets applied in the Attention layer. [Here](https://huggingface.co/deepseek-ai/DeepSeek-V4-Pro/blob/main/inference/model.py#L502) is the relevant part of the code:

`kv = self.wkv(x)
kv = self.kv_norm(kv)
apply_rotary_emb(kv[..., -rd:], freqs_cis)
...
o = sparse_attn(q, kv, self.attn_sink, topk_idxs, self.softmax_scale)

```

After we call `apply_rotary_emb`, the last 64 dimensions of `kv` carry absolute positional info. Inside the attention block, we compute attention weights, which are then used to calculate a weighted sum of the values. But these values have also been RoPE-rotated based on their absolute positions. This happens because the KV vector serves as both the key and the value (which cuts our KV cache memory footprint in half).

This side effect is exactly what the authors mean when they talk about absolute position embeddings leaking into the attention output (`o`).

### 👁️ SWA + CSA/HCA = ?

Here's a fun thought experiment: does this mean the exact same token can show up in the attention calculation twice? Like, once in the sliding window and again inside a compressed CSA/HCA chunk?

Well, yes and no. The chunk doesn't contain the raw token itself; instead, its semantics are included into the chunk's overall representation.

Let's walk through an example. Imagine our query token sits at position 200. We'll use the DeepSeek-V4 Pro hyperparameters: `window_size = 128` and `compress_ratio = 4` for CSA. The sliding window will cover tokens `73...200`. Meanwhile, compressed chunk #49 spans tokens `196...199`. Since the compression overlaps, it also pulls in information from the previous block, `192...195`.

Now, suppose the indexer selects the two most recent chunks, #48 and #49. When that happens, the attention mechanism will simultaneously see:

`...
raw token 191
raw token 192
...
raw token 198
raw token 199
...
compressed summary of tokens in chunk 192...199
compressed summary of tokens in chunk 188...195
...

```

So, yes, the model can actually see the same piece of information twice or even three times (in our example, tokens `192...195`). It's just packaged in different formats.

### 👁️ The Attention-sink

The issue with these emergent attention sinks is that the attention mechanism can't just choose to look at nothing. It has to look somewhere. If all the Q-K pairs have the exact same score, the probability mass (which must sum to 1) gets smeared evenly across every single token.

Ideally, an attention head wants to lock onto a specific interaction pattern between embeddings. But some of those patterns are rare and simply aren't present in a given sequence. So, LLMs learn a neat trick: they dump their "excess" attention mass onto the very first tokens. You can clearly see this happening from layer 2 onwards in the image below:

![](asset/dsv4/img_19.png) alt="Attention maps showing sink tokens">

> Image from the [paper](https://arxiv.org/abs/2309.17453)

But here's where standard Sliding Window Attention (SWA) runs into trouble. As the window shifts forward, those initial tokens—the ones the model was using as an implicit sink—fall right out of the KV cache. You could fix this by constantly reprocessing the active window and recomputing its KVs, but that defeats the whole purpose of reusing the cache in the first place.

![](asset/dsv4/img_20.png) alt="image.png">

To solve this, we can simply add a dedicated sink term to the softmax denominator (though this is just one of several potential workarounds). This gives the attention head a clear "none-of-the-above" option. This way, any leftover attention mass safely drains into the sink instead of spilling over onto the active KV entries after the initial tokens drop out.

Effectively, this formula creates a dummy token. It only participates in the softmax normalization and affects the final attention output as if its value vector consisted entirely of zeros.

### 🎛️ FP4 inside the CSA indexer / attention

I did some digging with GPT-5.5 Pro, and it looks like DeepSeek-V4 is probably the first public 100B+ LLM to use FP4 inside attention during training. Even in [Nvidia's most recent paper](https://arxiv.org/abs/2604.12374) on Nemotron 3 Super, where they advertise their GPU-accelerated NVFP4 format and its pre-training stability, they explicitly keep QKV and attention projections out of NVFP4 to "maintain fidelity of few attention layers":

![](asset/dsv4/img_21.png) alt="image.png">

(Side note: keeping the final 15% of the network in higher precision is a really interesting trick. Duly noted 📝)

It's worth noting that DeepSeek isn't doing full FP4 attention. They only use reduced precision in the indexer, which is responsible for picking candidate chunks. Why is this approach less insane than full FP4 attention? Full attention has several numerically nasty parts that can easily blow up:

- QK dot products can have heavy-tailed logits.

- Softmax is exponential and severely amplifies these logit errors.

- Small logit differences can wildly shift probability mass.

DeepSeek-V4 sidesteps the worst of this. The indexer only needs high recall, not perfectly calibrated probabilities or exact rankings. The top-k is large enough (1024) that a little bit of score noise doesn't really matter. As long as the right block makes it into the candidate set, we're good, because it will get processed by higher-precision attention later anyway.

That said, this is still a big deal.

### 💾 Where ~2% KV cache claim comes from

Let’s break down exactly which architectural tweaks drive this massive 50x reduction. Under the hood, the memory footprint actually shrinks by 200x, but each KV entry is now 4 times wider (512 dimensions instead of 128).

Baseline KV per token per layer:

\[\begin{aligned}
2_{K,V} \times 8_{KV\space heads}
\times 128_{dim} \times 2_{BF16\space bytes}
= 4096 \space bytes
\end{aligned}\]

Here's a table summarizing how each change contributes to the final number:

Step
Size change
B/token/layer
Cumulative reduction
Intuition / notes

**Baseline: BF16 GQA8, K+V, 128-d**
—
**4096**
**1×**
starting point

**1 KV head instead of 8**
÷8
**512**
**8×**
[MQA-style cache](https://arxiv.org/abs/2305.13245): one KV stream for all query heads

**Shared KV instead of separate K and V**
÷2
**256**
**16×**
one vector acts as both key and value

**Token-level compression: CSA/HCA**
÷7.76
**33**
**124×**
CSA stores 1 per 4 tokens; HCA stores 1 per 128 tokens

**But V4 KV entry is 512-d, not 128-d**
×4
**132**
**31×**
each compressed entry is wider to summarize a token chunk

**Mixed precision: 64 BF16 + 448 FP8 dims**
÷~1.78
**74.25**
**55×**

(would be 220× without the 512-d expansion)
512 BF16 dims would be 1024 B; V4 stores 576 B

**Small overheads (CSA indexer, etc)**
+~8 B
**~82 B**
**~50×**
aligns with the paper’s ≈2%

The 7.76× effective token-compression factor comes from compression ratios for chunks of size 4 (CSA) and 128 (HCA):

\[\frac{1}{\frac{1}{2}\left(\frac{1}{4} + \frac{1}{128}\right)}
= \frac{1}{0.1289}
\approx 7.76\]

assuming a 50/50 mix.

Looking at the table, the two biggest contributors are MQA and token-level chunk compression. While MQA is standard practice these days, this chunk compression is the real architectural gem of DeepSeek-V4.

## 第 14 页

### 📝 The Muon optimizer

New, efficient optimizers—and the field of optimization as a whole—are massive topics. I definitely can't cover them fully in a single note. Hell, they deserve their own hour-long lecture!

If you want to dive deeper and build some intuition on your own, I highly recommend checking out these links:

- Original blog post: [Muon: An optimizer for hidden layers in neural networks](https://kellerjordan.github.io/posts/muon/)

- [Monotone Newton-Schulz: Near-Monotone Polynomial Iterations for Matrix Sign](https://jasonjiaxiangli.github.io/blog/monotone-ns/)

- [Understanding Muon: A Revolutionary Neural Network Optimizer](https://www.notion.so/233ffa7f40c4800eafa5cc843e039327?pvs=21)

For now, I'll just share a few important quotes from those posts:

- Traditional optimizers treat all parameters the same, but Muon is smarter. It understands that 2D weight matrices have unique geometric structures.

- When we examine the gradient matrices that traditional optimizers produce, we find they often have very high condition numbers. Think of this as how "sensitive" a matrix is to small changes. High condition numbers mean the matrix is nearly low-rank - most of its information is concentrated in just a few directions. Some parameters get huge updates while others get tiny ones, creating imbalanced learning.

- Muon solves this problem through a elegant mathematical insight: instead of applying raw momentum updates, it orthogonalizes them to create more balanced parameter changes.

- Think of orthogonalization like this: if traditional optimizers create updates that are like a bunch of arrows pointing in similar directions (wasteful and imbalanced), Muon transforms them into arrows that point in perpendicular directions - each carrying unique, non-redundant information.

- We speculate that orthogonalization effectively increases the scale of other “rare directions” which have small magnitude in the update but are nevertheless important for learning.

## 第 15 页

### 🔧 2 (or 3) Linear layers inside an expert

Reading the paper, you might think a single expert has two linear layers. But that's not the case—there are actually three. [Here's](https://huggingface.co/deepseek-ai/DeepSeek-V4-Pro/blob/main/inference/model.py#L587) the code:

`class Expert(nn.Module):
 &quot;&quot;&quot;Single MoE expert: SwiGLU FFN (w1, w2, w3). Computation in float32 for stability.&quot;&quot;&quot;
 def __init__(self, dim: int, inter_dim: int, dtype=None, swiglu_limit=0):
 super().__init__()
 self.w1 = Linear(dim, inter_dim, dtype=dtype)
 self.w2 = Linear(inter_dim, dim, dtype=dtype)
 self.w3 = Linear(dim, inter_dim, dtype=dtype)
 self.swiglu_limit = swiglu_limit

 def forward(self, x: torch.Tensor, weights: Optional[torch.Tensor] = None) -&gt; torch.Tensor:
 dtype = x.dtype
 gate = self.w1(x).float()
 up = self.w3(x).float()
 if self.swiglu_limit &gt; 0:
 up = torch.clamp(up, min=-self.swiglu_limit, max=self.swiglu_limit)
 gate = torch.clamp(gate, max=self.swiglu_limit)
 x = F.silu(gate) * up
 if weights is not None:
 x = weights * x
 return self.w2(x.to(dtype))

```

As you can see, `w1` (gate) and `w3` (up) have the exact same dimensions. Under the hood, they are actually [fused](https://github.com/deepseek-ai/DeepGEMM/blob/211d2678d9d178de7a77fbfefe7310e0f4f8821c/deep_gemm/include/deep_gemm/impls/sm100_fp8_fp4_mega_moe.cuh#L37) into a single linear layer (Linear-1) and computed in parallel. You can even spot this in Figure 5, where L1 takes about twice as long to compute as L2:

![](asset/dsv4/img_22.png) alt="Timeline comparison of L1 and L2 computation">

### 🔧 Expert parallelism

Borrowing from the excellent [Ultra-Scale Playbook](https://huggingface.co/spaces/nanotron/ultrascale-playbook?section=expert_parallelism):

The design of MoE layers makes it easy to implement parallelism across the experts dimension, for what we call expert parallelism (EP). Since the feedforward layers are fully independent, we can simply put each expert's feedforward layer on a different worker (GPU). Compared to TP (TensorParallelism), this approach is much more lightweight, since we don't need to split the matrix multiplication; we just need to route the hidden states of a token to the right expert.

![](asset/dsv4/img_23.png) alt="Expert Parallelism routing illustration">

There are a few tricks to make EP work efficiently, and they are closely tied to model design. For instance, DeepSeek-V3 enforces a constraint in the router, ensuring that each token is sent to at most \(M\) nodes (in their case, 4) to keep the tokens on a single node and reduce communication overhead.

## 第 16 页

### ⚙️ Torch ATen operators

ATen is PyTorch's low-level tensor operator library. When you write standard PyTorch code like this:

`y = torch.softmax(x, dim=-1)
z = torch.matmul(y, w)
u = z + bias

```

PyTorch translates it into lower-level ATen operators:

`aten::softmax
aten::matmul
aten::add
aten::view
aten::sum

```

While these ATen ops are great building blocks, chaining them together creates two major bottlenecks. First is the kernel launch overhead. Every ATen call requires the host CPU to schedule a separate GPU kernel. While individual launch times are microscopic, doing this for hundreds of tiny ops per layer adds up quickly.

Second is the memory bandwidth bottleneck. Executing ops sequentially forces intermediate tensors to be written out to slow global GPU memory (VRAM), only to be immediately read back into fast on-chip memory (SRAM/registers) by the next operator.

You can drastically speed up your code by replacing multiple ATen ops with a fused kernel. This minimizes CPU scheduling overhead and lets you keep intermediate results in fast memory, preventing expensive read/write cycles.

![](asset/dsv4/img_24.png)>

From [the Ultra-Scale Playbook](https://huggingface.co/spaces/nanotron/ultrascale-playbook?section=fused_kernels).

## 第 17 页

### 📝 Why integer analysis shows up

When translating a high-level tensor operation into low-level GPU code, the compiler has to map exact memory slices to specific CUDA threads (compute units). You might write something innocent in Python like `x[:, ::2].T + bias`, but behind the scenes, that turns into an absolute of integer arithmetic over shapes, strides, offsets, block sizes, thread IDs, masks, and alignment constraints.

This is where a solver comes in, acting as a mini theorem prover. The compiler hits it with questions like: "Can this index ever go out of bounds?", "Will two threads write to the exact same address?", or "Are these elements guaranteed to be contiguous?" If the solver can mathematically prove these properties, the compiler gets the green light to take a highly optimized fast path.

Vectorized memory loading is a classic example. If several values are contiguous and properly aligned in GPU memory, the kernel can fetch them in a single instruction instead of using multiple scalar loads. But the moment you introduce slicing, transposing, padding, or custom layouts, logical "neighbors" in your tensor are rarely physical neighbors in memory anymore.

Because the underlying address formula might involve strides, modulos, floor division, and symbolic dimensions, the compiler has to prove that `address(k + 1) == address(k) + 1` (and that `k` remains strictly within bounds). If it can't prove this, It falls back to a slow, conservative approach using scalar loads and runtime bounds checks.

So, where does this solver actually live in everyday PyTorch? If you're running in standard eager mode, it doesn't. Eager mode relies entirely on pre-compiled kernels where human engineers have already done all the heavy mathematical lifting.

But the second you wrap your model in torch.compile(), everything changes. PyTorch starts generating custom GPU kernels on the fly. Behind the scenes, it fires up SymPy—a symbolic math library—to act as this exact kind of solver. By symbolically analyzing dynamic shapes and strides, SymPy proves to TorchInductor (the compiler) exactly when it's safe to vectorize memory reads or fuse operations without unnecessary overhead.

## 第 18 页

### ⚙️ Why split-KV is unavailable

First, let's break down what the Split-KV method is and why we need it. Then we’ll look at why we can't actually use it here.

In NVIDIA GPU architecture, the Streaming Multiprocessor (SM) is the fundamental computational building block. You can think of it loosely as a highly parallel GPU "core". A modern GPU like an H100 has over a hundred SMs, and we usually parallelize compute workloads across them.

The famous FlashAttention algorithm works exceptionally well during training because it parallelizes across the batch and query dimensions. During pre-training or the prefill phase of inference, we process many query tokens in parallel, which naturally provides enough work to keep all SMs busy.

But during decoding—for both standard inference and, more importantly, RL rollouts—the query length is tiny. It's often just a single token. Combine that with long contexts that force small batch sizes due to memory limits, and the GPU suddenly lacks parallel work. Most of the SMs sit completely idle, leading to terrible GPU utilization.

To fix this, we use Split-KV. This decoding-focused optimization splits the long sequence dimension (the KV cache) into smaller chunks to be processed in parallel across multiple SMs. This allows all SMs to work on the exact same query simultaneously. Afterward, a separate step gathers the partial results from all SMs and reduces (sums) them to produce the final attention output:

![](asset/dsv4/img_25.gif) alt="Split-KV method illustration">

However, Split-KV's reduction step is problematic. DeepSeek requires bitwise batch invariance, meaning the same token must produce exactly the same bits regardless of where it appears in a batch.

In standard floating-point arithmetic, the order of summation matters. Due to rounding errors, \((A+B)+C\neq A+(B+C)\). Since the final bitwise result strictly depends on the exact grouping and order of these additions, Split-KV can't guarantee the strict reproducibility that DeepSeek needs.

### ⚙️ When split-KV is removed

In the previous note, we saw how Split-KV slices the long sequence dimension (the KV cache) into smaller chunks to process them in parallel across multiple SMs. Without it, our GPU parallelization options shrink to just splitting over the batch and query length.

Since the query length during decoding is exactly 1, there's nothing to parallelize there. We're left with just the batch.

In the standard approach without Split-KV, a single batch element occupies all the resources of an entire SM. An H800 GPU physically has 132 SMs. I don't know the exact batch size DeepSeek uses for long-context RL rollouts, but let's assume it's 200 to keep things simple.

Each SM picks up one batch element, multiplying the current token's Query by the KV cache of the entire context. The first 132 elements start processing immediately, fully saturating the GPU. This is the first wave. The remaining 68 requests (\(200 - 132 = 68\)) have to wait for the second wave, since there are no free SMs left.

Once the first wave finishes, the remaining 68 elements are assigned to the newly freed SMs. But now the GPU is half-idle. We're only using 68 out of 132 SMs, while the other 64 just sit there doing nothing.

This hardware underutilization is exactly what Split-KV solved. It allowed us to spread the tail of the batch across all SMs. But the DeepSeek-V4 team decided to ditch it to preserve batch invariance.

Interesting insight: this means bumping the batch size from 200 to 264 is essentially free in terms of latency (assuming you have enough VRAM for the KV cache). The compute time for batches of 200 and 264 will be exactly the same. In both cases, the GPU needs to execute exactly two waves.

The [Nvidia docs](https://docs.nvidia.com/deeplearning/performance/dl-performance-matrix-multiplication/index.html#wave-quant) have a great chart illustrating this effect for matrix multiplication of sizes \(M \times K\) and \(K \times N\). If \(K\) and \(M\) are fixed while \(N\) grows, the number of tiles (chunks) and execution time increase in discrete steps:

![](asset/dsv4/img_26.png) alt="Nvidia wave quantization chart">

A matrix with \(N=3100\) will take the exact same amount of time to compute as a matrix with \(N=4500\).

This exact scenario leads to severe wave-quantization inefficiencies. Without the ability to parallelize the workload at a finer granularity, we simply can't fully utilize the GPU.

### ⚙️ Split-K for small batches

Conceptually, split-K is based on the exact same idea as the split-KV trick we discussed earlier, but this time, we’re applying it to GEMM (general matrix multiplication).

We use GEMM all the time in linear layers to multiply inputs by a weight matrix. The operation `C = A @ B` has the following shapes:

- A: [M, K]

- B: [K, N]

- C: [M, K] x [K, N] = [M, N]

We calculate each element \(C[m, n]\) as a sum over \(K\): \(C[m, n] = \sum_k A[m, k] * B[k, n]\).

Usually, GEMM parallelizes the computation by slicing the \([m, n]\) grid into tiles. A single CUDA block handles a specific tile \(C[m0:m1, n0:n1]\). It loops through all values of \(K\), accumulates the sum, and writes out the finished tile.

Split-K takes this a step further by splitting the computation along the \(K\) dimension. Now, our tile looks like this:

\[C[m0:m1, n0:n1]
= partial_0 + partial_1 + partial_2 + partial_3 + ...\]

We use this splitting technique in roughly the same scenarios as split-KV. When parallelizing across just two axes (especially when one is very small, like the batch size) doesn't generate enough parallel work, some SMs on the GPU end up idle. This reduces hardware utilization.

Just like with split-KV, the order in which we accumulate the partial sums \(partial_0 + partial_1 + partial_2 + partial_3\) actually matters. If we don't preserve it, we break batch invariance. Floating-point addition simply isn't associative: \((A+B)+C\neq A+(B+C)\).

Note that even though "split-KV" and "split-K" sound very similar, the "K" refers to completely different things.

In split-KV, it stands for Keys and Values in attention calculations. Split-KV slices the sequence dimension, and later we have to merge the partial softmax statistics and weighted values.

In split-K, `K` refers to one of the GEMM dimensions. It's the reduction dimension, which usually corresponds to the input feature dimension in a `[batch_size, features_dim]` matrix.

### 🔩 24 in mHC dimensions

Let's quickly recap how mHC works. It takes \(m\) embeddings of size \(d\) from the residual stream, concatenates them, normalizes them, and passes the resulting \(m*d\) vector through three linear layers:

- Pre-Block Mixing (4 output features)

- Post-Block Mixing (4 output features)

- Residual Mixing (\(4\times 4\) output features)

![](asset/dsv4/img_27.png) alt="mHC mixing layers diagram">

We can actually fuse these three linear layers into a single layer with an output dimension of \(4 + 4 + (4\times4)=24\). This 24 is exactly the number of scalars mHC needs to generate for the three small mixing matrices when we set `n_hc = 4`. You can see this reflected in the [inference code](https://huggingface.co/deepseek-ai/DeepSeek-V4-Pro/blob/main/inference/model.py#L666):

`# assume hc_mult = 4
mix_hc = (2 + hc_mult) * hc_mult
hc_dim = hc_mult * args.dim

# both of these are 24 x (4 * dim)
self.hc_attn_fn = nn.Parameter(torch.empty(mix_hc, hc_dim))
self.hc_ffn_fn = nn.Parameter(torch.empty(mix_hc, hc_dim))

```

Interestingly, this fusion slightly complicates the Muon optimizer logic we discussed earlier. We now have three completely different projections bundled together into a single 2D weight matrix (`hc_attn_fn` and `hc_ffn_fn`). The DeepSeek team likely anticipated this, and presumably only fuses these layers during the forward pass and at inference time.

## 第 19 页

### 🎛️ FP4 during post-training

Back in DeepSeek-V3, the core training framework relied on FP8 mixed precision for both pretraining and RL. Just a quick refresher: this means we mix and match different data types—the big win here is that MoE weights are stored and multiplied in FP8, which saves a massive amount of memory. Meanwhile, attention and other sensitive components are kept in higher precision.

![](asset/dsv4/img_28.png) alt="It really was quite something!">

It really was quite something!

Now, DeepSeek-V4 introduces a much more granular breakdown across the different training stages. I’ve put together a quick table summarizing all the precision types mentioned throughout the paper. It's super handy to keep this in mind as we go:

Stage
Type
Notes

LM Pretrain
**FP8 mixed**
Inherits the DS-V3 training framework. Core Linear GEMMs are in FP8. No FP4 whatsoever.

Specialist SFT
**simulated FP4→FP8**
QAT in post-training. FP4 expert weights are de-quantized to FP8 for the forward and backward passes.

Specialist RL / rollouts
**native FP4**
No backward pass. Uses FP4 weights directly for sampling.

Specialist RL / train
**simulated FP4→FP8**
Backward pass over FP8 weights. Gradients flow into FP32 master weights via STE.

OPD / student rollouts
**native FP4**
The student generates on-policy trajectories.

OPD / teacher logits inference
**native FP4**
Inference-only forward passes, meaning no backward pass is needed.

OPD / student train
**simulated FP4→FP8**
Reverse-KL / full-vocab distillation.

Model serving (API)
**native FP4**
FP4 is used for MoE expert weights and the CSA indexer QK path.

I want to reiterate: we aren't talking about compressing *all* the model weights here. The paper clarifies this later on (specifically, right in the same paragraph as this note):

> 

We apply FP4 (MXFP4) quantization to two components: (1) MoE expert weights, which are a major source of GPU memory occupancy and (2) the Query-Key (QK) path in the indexer of CSA, where QK activations are cached, loaded, and multiplied entirely in FP4.

So, none of this affects how things like token embeddings are stored.

### 🎛️ FP4-to-FP8 scale absorption

At first glance, losslessly casting FP4 values to FP8 seems straightforward. But it's not totally clear if the quantization scales will actually fit. Let's peek under the hood to see how these quantizations work.

DeepSeek-V3 was trained in FP8. Unlike our good old FP16 and FP32, this format comes with a catch. 16 and 32 bits give you enough dynamic range to accurately capture the spread of values in a neural network. But 8 bits just isn't enough—numbers quickly collapse into zeros or blow up to infinity due to overflow and underflow.

To fix this, FP8 relies on a separate quantization scale that lives outside those 8 bits. We calculate this scale so that multiplying it back restores the original weight with minimal loss: \(w \approx w_{fp8} * scale\).

The memory savings come from sharing a single quantization scale across a whole block of FP8 values. Block sizes differ for activations and weights, but for this note, we'll stick to weights. In DeepSeek-V3, they group and scale weight elements in 128x128 blocks (i.e., per 128 input channels and 128 output channels).

If a matrix is larger than that, we simply slice it into 128x128 tiles. For example, the FP8 weights for a `Linear(7168, 2048)` layer get chopped into \((7168/128) \times (2048/128) = 896\) blocks. So, alongside the raw FP8 values, we also have to store 896 scaling factors. The matrix multiplications natively factor in these scales. Here's a great visualization from [Nvidia's blog](https://developer.nvidia.com/blog/per-tensor-and-per-block-scaling-strategies-for-effective-fp8-training/):

![](asset/dsv4/img_29.png) alt="FP8 block scaling visualization">

DeepSeek-V4 applies the exact same principle to FP4. However, because FP4 quantization is much more aggressive, rounding errors accumulate faster. To counter this, they shrank the group size down to 1x32. This means a single 128x128 block of FP8 values now contains exactly \((128 / 1) \times (128 / 32) = 512\) of these tiny FP4 chunks.

Spot the problem yet? Standard FP8 expects exactly one scale per 128x128 block, but our new FP4 setup has 512 scales for that same block. DeepSeek claims the FP8 weights can just "absorb" these extra scales. Let's write some code to prove it:

`import torch

# FP8 block: 128x128; FP4 scale tile: 1x32
R, C, G = 128, 128, 32

# Values exactly representable by FP4
fp4 = torch.tensor([0, .5, 1, 1.5, 2, 3, 4, 6,
 -.5, -1, -1.5, -2, -3, -4, -6],
 dtype=torch.float32)

# Fake already-quantized FP4 payload, unpacked into fp32
q4 = fp4[torch.randint(len(fp4), (R, C))].view(R, C // G, G)

# One local scale per 1x32 tile
s4 = (2.0 ** torch.randint(0, 15, (R, C // G)))

# One shared FP8 scale for the whole 128x128 block
s8 = torch.tensor(2.0 ** 8)

# Absorb local FP4 scales into the FP8 payload
original_data = q4 * s4[..., None]
q8 = (original_data / s8).reshape(R, C)
q8 = q8.to(torch.float8_e4m3fn)

# Same weights: many FP4 local scales vs one FP8 block scale
assert torch.equal(
 (q4 * s4[..., None]).reshape(R, C),
 q8.float() * s8,
)

```

In this snippet, `fp4` lists the actual values that an FP4 number can represent. It can only express a small, fixed grid (values taken from [here](https://developer.nvidia.com/blog/introducing-nvfp4-for-efficient-and-accurate-low-precision-inference/#:~:text=What%20is%20NVFP4?,same%20for%20the%20negative%20range)), not arbitrary floats. We use `torch.randint(len(fp4), (R, C))` to sample random entries from this grid, simulating an already-quantized FP4 payload (MoE weights).

Next, in `s4` we randomly sample one local power-of-two scale per 1x32 tile. Finally, `s8 = 2^8` is our shared 128x128 FP8 block scale. I picked this specific value for the toy example so the rescaled payload fits cleanly into FP8, though in reality, it might differ.

Now for the magic. The line `original_data = q4 * s4[..., None]` reconstructs the original weights in higher precision. Then, `q8 = (original_data / s8).reshape(R, C)` folds that fine-grained FP4 scale information directly into the FP8 payload itself. If the final `assert` passes, it means the FP4→FP8 conversion didn't introduce any additional rounding error. `q4 * s4` and `q8 * s8` reconstruct the exact same weights.

Keep in mind that information is inherently lost when you initially compress the weights down to the FP4 grid. FP4 simply can't store a value like 1.7—it has to snap to 1.5, as you can see in our `fp4` tensor.

## 第 21 页

### 🔧 Context-parallel all-gather

Yes, each rank receives the full KV cache for the entire sequence.

You might expect this to eat up a ton of space and completely blow up your VRAM. But thanks to the incredible efficiency of CSA and HCA, the actual memory footprint is tiny, even for super long context windows.

Let's do some quick math. For simplicity, we'll assume all elements are stored in BF16 (2 bytes per element), even though DeepSeek mentioned storing some dimensions in FP8.

For a 64k token context, a single CSA layer stores \(64\text{k}/4 = 16,384\) KV entries (thanks to the compression factor \(m=4\)). That comes out to just:

\[512 \times 2 \times 16,384
= 16.7\text{M} \text{ bytes}
\approx 16.7\text{ MB}\]

per layer, per sequence.

For HCA, that number drops by a factor of \(128/4 = 32\). We're talking less than a single megabyte!

Even scaling all the way up to a 1M token context, we're still only looking at roughly 256 MB and 8 MB, respectively. These numbers are so small they barely make a dent in either your network bandwidth or VRAM.

## 第 22 页

### 💾 Layer-varying KV caches

This is because CSA and HCA operate on different chunk sizes (for example, \(m=4\) versus \(m&#x27;=128\)). To handle this, we have to keep token buffers of different sizes so we can compress them into a single chunk later on. Consequently, one layer will have vastly more token slots than another.

We also have to account for the fact that CSA and HCA inherently produce different numbers of chunks due to their distinct compression factors. On top of that, CSA requires us to store the lightning indexer keys in the KV cache. 

Long story short, the layers differ a lot.

## 第 24 页

### 🚀 Is on-disk KV cache fast enough?

You might think reading from disk is extremely slow and would massively spike response latency—especially in long-context scenarios with a massive KV cache.

But it turns out, that's not the case. In their recent paper, [DualPath: Breaking the Storage Bandwidth Bottleneck in Agentic LLM Inference](https://arxiv.org/abs/2602.21548), DeepSeek wrote: “Our cluster-wide 3FS has no internal DRAM cache and can saturate the 400Gbps bandwidth of the storage NIC.”

3FS is the name of their custom file system. The interesting part is the lack of a DRAM cache. This means the system isn't faking its performance by keeping hot KV blocks in a massive DRAM data cache; everything is read directly from SSDs.

Despite this, the storage architecture is designed to completely saturate the Network Interface Controller (NIC). In other words, you physically can't pump more data into a given GPU server without adding more NICs.

For context, 400 Gbps is roughly 50 GB/s. That's about the bandwidth of a single fast DDR5 memory channel. Sure, it falls way short of the aggregate server DRAM bandwidth. But it's actually right on par with the relevant ingress path into a GPU. This path is typically the PCIe Gen5 I/O fabric, which pushes about 64 GB/s in one direction.

So, a single fully saturated 400 Gbps storage NIC gets you pretty close to the per-GPU host ingress limit. Of course, this is still a drop in the bucket compared to the massive HBM bandwidth inside the GPU itself.

But a standard host doesn't just have one GPU—it has eight. Since eight GPUs have to share that 400 Gbps connection, you're still looking at a pretty hefty bottleneck.

This is exactly the problem DeepSeek tackles in that DualPath paper I mentioned earlier. They actually managed to nearly double the throughput by using the NIC of a neighboring host and routing the data over a blazing-fast GPU-to-GPU link (via a separate Storage NIC, or SNIC).

Now, how do you saturate that 50 GB/s read speed using SSDs? That's obviously way beyond what a single SSD can handle. But it's totally doable for a small cluster of datacenter NVMe drives. On paper, roughly four PCIe 5.0 SSDs or eight PCIe 4.0 SSDs can easily max it out.

This perfectly explains the hardware design described on [DeepSeek’s GitHub](https://github.com/deepseek-ai/3fs). They use a 3FS storage node packed with 16 PCIe 4.0 NVMe drives and two 400 Gbps NICs. This SSD array can deliver up to 112 GB/s of sequential read bandwidth.

![](asset/dsv4/img_30.png) alt="DeepSeek 3FS storage node architecture">

This doesn't magically turn an SSD into RAM for cache reads. But it does explain why this setup isn't orders of magnitude slower than reading the cache straight out of DRAM.

## 第 26 页

### 📝 How to combine AdamW + Muon

As mentioned earlier in the paper, AdamW is also applied to the static biases and gating factors of the mHC modules.

![](asset/dsv4/img_31.png) alt="These six parameters from Equations 3-5.">

> These six parameters from Equations 3-5.

But why do we make this specific split? Why train some layers with Muon and others with AdamW?

Let's recall what we discussed about Muon in an earlier note. Traditional optimizers treat all parameters exactly the same. Muon is smarter. It understands that 2D weight matrices (like those in Linear layers) have unique geometric structures.

During the backward pass, it doesn't just apply raw momentum updates. Instead, it orthogonalizes them to create much more balanced parameter changes.

This means Muon’s operation only really makes sense when the parameter is a proper matrix transform. Let’s look at the exceptions:

- **Embedding module:** Yes, technically it's a 2D matrix of shape \(vocab\_size \times hidden\_dim\). But semantically, it's not a normal dense linear map—it's a lookup table. The rows correspond to discrete tokens, not continuous input features. AdamW is a better fit here because it maintains per-parameter adaptive second moments. This allows rows for rare and frequent tokens to get different effective learning rates.

- **Prediction head** (often called the LM head): it's It's a classifier over a categorical vocabulary. Its rows and columns are tied to token identities, not just hidden features.

- **RMSNorm:** The weights here are usually just a 1D scale vector. There is no meaningful 2D matrix geometry to orthogonalize. You could try reshaping it to \(1\times d\), but then Muon would just degenerate into normalizing or coupling the entire vector update. That's definitely not what you want.

- **mHC components:** The same logic applies to the mHC static biases and gates.

You can easily carry this logic over to your own experiments. Muon is fantastic for internal learned matrix transforms. For everything else, just stick to AdamW.

## 第 27 页

### 🎯 SwiGLU clamping

Even though they explicitly say "throughout the **training**," you absolutely have to do this during inference too. Otherwise, generation [breaks](https://github.com/sgl-project/sglang/issues/23752):

![](asset/dsv4/img_32.png) alt="Broken generation issue">

In DeepSeek's initial code release, the SwiGLU clipping for the shared expert was missing. There was even a comment right next to it, so leaving it out was a deliberate choice. (Did an LLM write that? 🤔)

Fortunately, the open-source community quickly tracked down the issue: "the missing clamp causes shared-expert SiLU output to grow to **±2000+** during inference. This pollutes the residual stream via `final_hidden_states += shared_output`, propagates through `mhc_post`, and degrades `lm_head` logits at sentence-boundary positions."

DeepSeek quickly [rolled out a fix](https://huggingface.co/deepseek-ai/DeepSeek-V4-Pro/commit/a1fd202632e91bc0efe4eedb63ce554649c53997):

![](asset/dsv4/img_33.png) alt="DeepSeek bug fix commit">

Long story short: don't forget to clip your activations!

## 第 29 页

### 📝 Generative Reward Models

A Generalist Reward Model (GRM) is a model trained to evaluate non-verifiable or weakly verifiable tasks. These evaluation scores allow us to run RLVR (Reinforcement Learning from Verifiable Rewards) algorithms like GRPO.

Right now, DeepSeek has just [one paper](https://arxiv.org/abs/2504.02495) detailing their GRM. Personally, I suspect this specific approach is a bit outdated and has probably evolved (I'll touch on one of those changes in the next note). But I still want to give you a rough idea of how a GRM works.

The GRM is trained using RL. Given a prompt and a policy trajectory, it learns to write an evaluation plan—basically a set of principles and their relative weights. From there, it generates a critique, a partial score for each principle, and a final weighted score.

![](asset/dsv4/img_34.png) alt="GRM evaluation process diagram">

> From [this paper](https://arxiv.org/abs/2504.02495)

This approach easily generalizes to tasks where a simple binary "right/wrong" score doesn't work. Think creative writing, report compilation, summarization, and many others.

### 📝 Same GRM ⇔ Policy model

As far as I know, DeepSeek hasn't published a standalone paper showing exactly how they train a general GRM alongside their base model. They do have a paper on [Inference-Time Scaling for Generalist Reward Modeling](https://arxiv.org/abs/2504.02495) that covers the core principles of GRM training. Interestingly, though, they don't even use it as a Reward Model for the LLM in GRPO in that work.

That said, we can find a very similar approach in [DeepSeekMath-v2](https://arxiv.org/abs/2511.22570). There, the authors train the exact same model in three distinct modes simultaneously:

- **Proof Generator**: actually solves the math problems.

- **Verifier**: identifies issues and scores proofs from the Proof Generator.

- **Meta-Verifier**: reviews the proof analyses produced by the Verifier.

As a result, the model masters all three skills. More importantly, this setup helps "incentivize the Proof Generator to identify and resolve as many issues as possible in their own proofs before finalizing them." Since the model already knows how to find errors and critique itself, it can self-verify on the fly while generating a solution. This is exactly what drives up the quality!

What's cool is that the authors didn't just combine all three modes right away. They arrived at this setup after running some error analysis:

> 

&lt;…&gt; we observed a critical limitation: when prompted to both generate and analyze its own proof in one shot, the generator tends to claim correctness even when the external verifier easily identify flaws. In other words, while the generator can refine proofs based on external feedback, it fails to evaluate its own work with the same rigor as the dedicated verifier.

This observation motivated us to endow the proof generator with genuine verification capabilities.

The proof verifier and generator create a tight feedback loop. The verifier improves the generator, and as the generator gets better, it produces new proofs that push the verifier’s current limits.

For the general domain, these verification capabilities might look a lot like the DeepSeek GRM. The model first comes up with "Principles" that determine the quality of a potential response for a given query. Then, it evaluates the answer based on these principles and calculates a final score using a weighted sum. Everything is learned end-to-end via RL, and the model writes its own reasoning to justify the score. Humans don't have to hardcode these principles at all.

![](asset/dsv4/img_34.png) alt="GRM evaluation process diagram">

> From [this paper](https://arxiv.org/abs/2504.02495)

## 第 31 页

### 🤖 Reasoning across agent turns

When I was using Codex and ChatGPT last year, I kept wondering: can these models actually see their own reasoning from the previous steps? Half the time, it felt like they couldn't. I’d point out a specific step in their logic and ask, "Why did you do that?"—and they'd completely lose the plot. They genuinely had no clue what I was talking about.

![](asset/dsv4/img_35.png) alt="Hidden CoT example">

Now the meta has shifted: models are explicitly fed their previous reasoning steps. This keeps them from getting stuck in endless logic loops. Not only is it a massive UX upgrade, but it also slashes token usage, especially for tool calling. A model can formulate a plan and execute several tool calls sequentially, without needing to constantly reinvent the plan for future calls because it was discarded.

Even Anthropic, who are notoriously secretive about their closed-source Claude Code—talked about this in a recent [blog post](https://www.anthropic.com/engineering/april-23-postmortem):

![](asset/dsv4/img_36.png) alt="Anthropic blog post snippet about reasoning chains">

## 第 33 页

### 🎓 Why reverse KL is used for on-policy distillation

Okay, what is reverse KL, and why don't we use forward KL? Let's break it down.

Approaches to post-training a student model generally fall into two categories. To quote a great [blog post](https://thinkingmachines.ai/blog/on-policy-distillation/#loss-function-reverse-kl) by Thinking Machines:

- **On-policy** training samples rollouts from the student model itself and assigns them some reward.

- **Off-policy** training relies on target outputs from an external source that the student learns to imitate.

The downside of off-policy training is that the student learns in contexts the teacher frequents, not the ones the student itself will actually encounter. This leads to compounding errors. If the student makes an early mistake that the teacher would never make, it drifts further and further away from the states it saw during training.

So why not use on-policy methods all the time? It helps to compare on-policy distillation to RL. The student generates trajectories, and the teacher grades each of them to provide feedback. But standard RL has a massive downside: this feedback is very sparse. The student only learns that its final answer was wrong and avoids that path in the future. It doesn't learn exactly where it made the mistake.

Intuitively, the core idea of on-policy distillation (OPD) is to sample trajectories from the student model and use a high-performing teacher to grade **each token** along the way.

Let's recall that Kullback-Leibler (KL) divergence is a type of statistical distance. It measures how much an approximating probability distribution \(Q\) (the student) differs from a target or reference distribution \(P\) (the teacher).

Crucially, divergences are generally asymmetric, meaning \(D_{KL}(P || Q) \neq D_{KL}(Q || P)\). Because of this asymmetry, we have to choose the order of the arguments, which dictates whether we use Forward KL or Reverse KL.

The formula for Forward KL, straight from [Wikipedia](https://en.wikipedia.org/wiki/Kullback%E2%80%93Leibler_divergence), looks like this:

\[D_{\mathrm{KL}}(P || Q)
= \sum_{x \in \mathcal{X}} P(x)\log\frac{P(x)}{Q(x)}\]

In this formula, \(x\) is the token actually sampled at a given position in the teacher's trajectory. Since we're using the teacher for rollouts, this is an off-policy approach. The loss is then summed over the sampled tokens in that rollout. \(P(x)\) is the probability predicted by the teacher model for that token given a specific prefix. \(Q(x)\) is the probability predicted by the student model for the exact same prefix.

In other words, the teacher's predicted probability acts as the weight in the sum we want to minimize. Suppose, for example, that at a given prefix, the teacher's distribution looks like this:

Token
Teacher (P(x))
Meaning

A
0.499
valid reasoning path

B
0.499
another valid reasoning path

C
0.002
bad / weird continuation

Now let's compare two possible students. Student 1 covers both good options and imitates the teacher's output almost exactly. Student 2 simply commits to a single good option:

Token
Student (Q(x))

A
0.997

B
0.001

C
0.002

Student 2 is basically saying, "I know the teacher likes both A and B, but I'll mostly just use A." It doesn't perfectly match the full teacher distribution, but it still confidently chooses a valid, teacher-approved token.

You can read Forward KL as asking: "For every token the teacher likes, does the student also assign probability mass there?" This happens because the multiplier in our equation is \(P(x)\), the teacher's probability. Intuitively, we're teaching the student not to ignore any important options the teacher considers valid—Student 2 from the example above would be punished.

This is exactly why Forward KL is known as a **mode-covering** objective. It forces the student to cover all the major modes of the teacher's distribution. If the teacher uses several plausible reasoning styles, Forward KL pushes the student to preserve every single one of them.

Reverse KL is, as the name suggests, reversed:

\[D_{\mathrm{KL}}(Q || P)
= \sum_{x \in \mathcal{X}} Q(x)\log\frac{Q(x)}{P(x)}\]

The critical difference here is that \(x\) is the token actually sampled at a position in the student's trajectory.

You can read this one as: "For every token the student wants to use, does the teacher also approve of it?" This makes sense because our multiplier is now \(Q(x)\), the student's probability.

If the student assigns zero probability to token B, it won't be penalized at all, even if the teacher thinks B is a perfectly valid option. However, Reverse KL heavily penalizes the student if it puts probability mass on a bad token like C, when the teacher considers \(P(C)\) to be tiny.

This is why Reverse KL is called **mode-seeking**. It tends to commit to one high-probability mode instead of spreading its probability mass over all available modes. In other words, it tells the student: "Pick something the teacher likes. You don't have to cover every possible thing they like, just pick one. But whatever you do, don't put mass on tokens the teacher deems unlikely.”

The 2023 [MiniLLM](https://arxiv.org/abs/2306.08543) paper provides a good empirical validation of this concept using a toy experiment setup:

![](asset/dsv4/img_37.png) alt="MiniLLM paper empirical validation">

Real LLM experiments in that same paper confirm this behavior as well. We also saw this recently in the [Qwen 3 paper](https://arxiv.org/abs/2505.09388):

![](asset/dsv4/img_38.png) alt="Qwen 3 paper results">

The Qwen team reported that starting from the exact same off-policy distilled 8B checkpoint, on-policy distillation outperformed direct RL while using roughly one-tenth of the GPU hours.

The exact reason why OPD works this well is still an ongoing topic of discussion. Will Brown from Prime Intellect wrote an interesting piece on it [here](https://x.com/willccbb/status/2050038277454143918).

## 第 34 页

### 🎓 Teacher hidden-state caching

This might look like a tiny optimization you could easily skip. But let's run the numbers to see how much memory it actually saves.

To figure this out, we need the bit precision for the teacher's last-layer hidden states and materialized logits. The paper leaves this out, so let's keep it simple and assume standard 2-byte floats (BF16/FP16). This gives us the following memory footprint per teacher, per sequence:

- \(M_{\text{logits}} = \text{Seq\_len} \times |\text{Vocab}| \times 2\)

- \(M_{\text{hidden}} = \text{Seq\_len} \times \text{dim} \times 2\)

Let's assume a context length of 64k—a fairly standard size for agentic rollouts. For DeepSeek-V4 Pro \(|\text{Vocab}| = 131,072\) and \(d = 7168\), we'd need 16 GB to store the logits versus just 0.875 GB for the hidden states. That’s a difference of over 15 GB per sequence, per teacher.

(And yes, if they used FP8 instead of BF16/FP16, the absolute numbers would be cut in half, but the savings ratio stays exactly the same).

It's also worth noting that hidden states (and especially output logits) are not KV cache entries. They don't get compressed into chunks of 4 or 128 tokens, so we can't rely on those massive memory savings here.

DeepSeek mentions using over ten teacher models. That means we are saving over 150 GB per sequence. That number sounds so ridiculous I actually had to double-check my math.

## 第 38 页

### 📈 The SimpleQA-Verified situation

DeepSeek-V4 Pro 在 SimpleQA 上碾压 Kimi K2.6 的结果显得有些不合理。毕竟 Kimi 同样是基于超过 30T token 训练、拥有 1 万亿参数的庞大模型，两者在该测试上的性能差距却大得不成比例。虽然我不质疑 V4 本身的质量，但这一结果指向了过拟合，或预训练集未能有效过滤掉评估数据的问题。

话虽如此，我并非认为 DeepSeek 在造假。V4 在 [AA-Omniscience](https://artificialanalysis.ai/evaluations/omniscience) 这一较新的、用于衡量模型知识广度的基准测试上确实表现出色，并且仍能超越 Kimi：

![](asset/dsv4/img_39.png) alt="AA-Omniscience 基准测试对比"

## 第 39 页

### 📈 Agentic effort levels

Looking at the table, there isn't a significant difference between the `high` and `max` settings on DeepSeek-V4 Pro for agentic tasks. While diminishing returns are expected at the highest reasoning tiers, the real issue is the complete lack of `medium` or `low` options.

Just look at how GPT-5.5 scales across a suite of benchmarks. Having these lower tiers gives you way more control:

![](asset/dsv4/img_40.png) alt="GPT-5.5 benchmark scores across reasoning efforts">

Sure, GPT-5.5's `xhigh` and `high` settings are quite similar as well. However, the lower tiers are important for balancing quality, API costs, and response times. You can see how the reasoning chain lengths scale across different configurations:

![](asset/dsv4/img_41.png) alt="Reasoning chain length comparison">

It looks like we'll have to wait for DeepSeek-V4.1+ to introduce `medium` / `low` reasoning efforts before we see any meaningful differentiation. I’d say `medium + max` is an ideal combo.

## 第 44 页

### 📈 Coding R&D benchmarks

嗯，用户让我把一段英文技术文档翻译成中文，还要保留所有Markdown格式、LaTeX公式、代码块、URL链接，技术术语比如MoE、Attention、Transformer这些直接保留英文，用词要专业精准。好的，先看看原文内容。

原文是：“DeepSeek aside, this is an insane amount of progress on real-world engineering tasks. Sonnet 4.5 came out on September 29, 2025, and Opus 4.6 dropped on February 5, 2026. In just four months, the success rate jumped from 50% to 80%. And keep in mind, these aren't trivial problems. We're talking about complex R&amp;D tasks typically handled by a top-tier engineering team. It's only going to accelerate from here 🚀”

首先，我需要确认每个部分怎么处理。保留Markdown格式，比如加粗、斜体、代码块等，但这段文字里好像没有明显的Markdown标记，除了可能的🚀这个表情符号，不过可能不算格式。LaTeX数学公式的话，原文里没有$...$或者$$...$$，所以不用处理。代码块的话，也没有```这样的，所以可能不需要处理。URL链接也没有，所以这部分没问题。

技术术语方面，DeepSeek应该保留，Sonnet 4.5和Opus 4.6是产品名称，可能不需要翻译，直接保留。R&D是Research and Development，通常中文里会翻译成“研发”，但有时候也会用R&D，不过这里可能需要看习惯。不过用户说技术术语如MoE、Attention、Transformer直接保留英文，但R&D可能属于缩写，可能需要处理。不过R&D在中文里通常翻译为“研发”或者保留R&D。比如“R&D tasks”可以翻译为“研发任务”或者“R&D任务”。不过有时候在中文技术文档中会直接写R&D，但可能更常见的是翻译成“研发”。例如“complex R&D tasks typically handled by a top-tier engineering team”可以翻译为“通常由顶级工程团队处理的复杂研发任务”。

“DeepSeek aside”这里可能需要处理。DeepSeek是一个模型或者公司的名字，应该保留。"aside"在这里可能意思是“抛开DeepSeek不谈”，或者“除了DeepSeek之外”。比如“抛开DeepSeek不谈”或者“除DeepSeek外”。

“this is an insane amount of progress on real-world engineering tasks”——“insane amount”可以翻译为“惊人的进展”或者“难以置信的进展”，但“insane”在这里可能有夸张的意味，用“惊人”比较合适。“real-world engineering tasks”是“实际工程任务”。

“Sonnet 4.5 came out on September 29, 2025, and Opus 4.6 dropped on February 5, 2026.” 这里“came out”可以翻译为“发布”，“dropped”通常指发布，但可能用“推出”或者“发布”更合适。日期格式在中文里通常用“2025年9月29日”这样的格式。

“In just four months, the success rate jumped from 50% to 80%.” 这里的“jumped”可以用“跃升”或者“提升”，“success rate”是“成功率”。

“these aren't trivial problems” ——“trivial”翻译为“微不足道”或者“简单”，但这里说“这些不是简单的问题”，或者“并非 trivial 问题”，但可能更自然的说法是“这些问题绝非 trivial”或者“这些问题并不简单”。不过根据用户要求，技术术语可以保留英文，但trivial可能不是特定术语，可能需要翻译。比如“这些问题绝非 trivial”或者“这些问题并非 trivial”，但可能中文习惯会说“这些问题并不简单”或者“这些问题并非 trivial”，不过可能更准确的是“这些问题绝非 trivial”，但trivial在中文技术文档中有时保留，但可能翻译为“琐碎”或者“微不足道”。不过通常会说“这些问题并不简单”或者“这些问题并非 trivial”，但可能更专业的是“这些问题并非 trivial”，但可能更自然的翻译是“这些问题绝非 trivial”，不过可能直接说“这些问题并不简单”更合适。

“We're talking about complex R&D tasks typically handled by a top-tier engineering team.” ——“complex R&D tasks”翻译为“复杂研发任务”，“top-tier engineering team”是“顶级工程团队”。

“It's only going to accelerate from here 🚀” ——“accelerate”是“加速”，“from here”是“从此开始”，所以“此后只会加速 🚀”或者“此后将加速推进 🚀
