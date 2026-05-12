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

嗯，用户让我把一段英文翻译成简短的中文，还要保留格式。先看看原文内容。这段话是在比较DeepSeek-V4 Pro和Google的Switch-C模型的规模，特别是计算量的差异。

首先，开头提到“Finally, we have a model comparable in scale to Google's [legendary Switch-C](https://huggingface.co/google/switch-c-2048)! It's been [5 years](https://arxiv.org/abs/2101.03961) since Noam Shazeer & Co. scaled MoEs to an unprecedented size, though that model only had about 1.8B active parameters.” 这里需要翻译，同时保留超链接的格式。中文里通常会把链接放在方括号里，比如[超链接文字](链接地址)，所以翻译的时候要保持这个结构。

接下来，“To put things in perspective, Google spent roughly \(3.3 \times 10^{21}\ \text{FLOPs}\) (floating-point operations) on that pretraining run.” 这里的FLOPs需要翻译，通常中文会说“浮点运算次数”或者直接保留FLOPs，可能用“浮点运算”或者“FLOPS”。不过可能直接保留FLOPs，因为技术文档中常用。然后计算部分：

\[\begin{aligned} \mathrm{FLOPs}_{\mathrm{V4\ Pro}} &\approx 6 \times N_{\mathrm{active}} \times D_{\mathrm{tokens}} \\ &\approx 6 \times 49\mathrm{B} \times 33\mathrm{T} \\ &\approx 9.7 \times 10^{24}\ \text{FLOPs} \\ &\approx 1 \times 10^{25}\ \text{FLOPs} \end{aligned}\]

这部分需要保持公式格式，但中文里可能用“约”代替≈，或者直接保留符号。不过通常数学公式中的符号是保留的。数字部分如49B是490亿，33T是33万亿，可能需要转换成中文的单位，但有时候直接保留B和T，或者写成“490亿”和“33万亿”。不过在技术文档中可能保留B和T，但中文环境下可能需要说明。比如49B通常翻译为490亿，33T是33万亿。不过有时候也会直接写49B，但可能需要确认。

然后最后说“That's a 3,000x difference in compute!” 翻译为“计算量相差3000倍！”或者“计算量差异达3000倍！”

现在整理一下：

首先，第一句：“Finally, we have a model comparable in scale to Google's [legendary Switch-C](https://huggingface.co/google/switch-c-2048)! It's been [5 years](https://arxiv.org/abs/2101.03961) since Noam Shazeer & Co. scaled MoEs to an unprecedented size, though that model only had about 1.8B active parameters.”

翻译成中文：“我们终于有了可与Google[传奇Switch-C](https://huggingface.co/google/switch-c-2048)相媲美的模型！自Noam Shazeer等人将MoE扩展至前所未有的规模至今已[5年](https://arxiv.org/abs/2101.03961)，但该模型仅约18亿活跃参数。”

这里“legendary”翻译为“传奇”可能合适，或者“著名”，但“legendary”通常译为“传奇

### 📊 Comparison with DeepSeek-V3.2

...这已经是一个很强的基线。事实上，它实际上开创了我们现在在DeepSeek-V4中看到的一些注意力机制调整，而且它的效率极高。

下图展示了V3.1和V3.2在不同上下文长度下的推理成本对比。（快速回顾：预填充是指模型为提示词计算KV缓存，而解码是实际的逐个token生成过程。）

![](asset/dsv4/img_01.png) alt="Inference costs comparison">

## 第 4 页

### 🏗️ What counts as modeling capability

嗯，用户让我把一段英文翻译成中文，要简短，还要保留格式。首先，我需要仔细看看原文内容。这段讲的是模型的建模能力，特别是Transformer中的残差流，还有计算成本的问题。

先通读一遍原文。开头说“这可能听起来有点抽象，所以让我们澄清一下。”然后解释“建模能力”通常指模型表示复杂函数和捕捉复杂模式的能力，也可以理解为拓扑表达性，即模型如何灵活地路由、存储和组合不同层的信息。接着提到很多机制可解释性的论文，比如[1]和[2]的链接，说明Transformer中信息通过单一残差流顺序流动，这是各层读写的主要通道。每个层（Attention、MLP、MoE）都必须读取这个流，处理数据再写回。后面有个图片链接和alt文本，还有引用Anthropic的博客。然后解释残差连接的工作原理，x' = x + layer(x)，然后说提升建模能力的方法是加宽“高速公路”，即增加隐藏或嵌入维度，但计算成本会随隐藏维度二次方增长，导致模型变慢更重。

现在需要翻译成简短的中文，保留格式。首先，注意保留原文的结构，比如引用链接、图片标记、引用块等。用户要求简短，所以可能需要适当精简，但不能改变原意。

先处理第一句：“This might sound a bit abstract, so let's clarify. 'Modeling capability' generally refers to a model's ability to represent complex functions and capture intricate patterns. You can also think of it as topological expressivity—how flexibly the model can route, store, and combine information across different layers.”

翻译成中文，简短：“这可能有点抽象，我们来澄清一下。'建模能力'指模型表示复杂函数和捕捉精细模式的能力，也可视为拓扑表达性——模型在各层间路由、存储和组合信息的灵活性。”

接下来：“As numerous mechanistic interpretability papers have shown ([1](https://transformer-circuits.pub/), [2](https://arxiv.org/abs/2312.12141v1)), information in a Transformer flows sequentially through a single residual stream. This is the main highway that layers read from and write to. Every single layer (Attention, MLP, MoE) has to read from this stream, process the data, and write it back. ![](asset/dsv4/img_02.png) alt="Transformer residual stream illustration"> > From [Anthropic’s blogpost](https://transformer-circuits.pub/2021/framework/index.html).”

翻译时，注意保留链接和图片标记。例如：“如多篇机制可解释性论文所示([1](https://transformer-circuits.pub/), [2](https://arxiv.org/abs/2312.12141v1))，Transformer中的信息通过单一残差流顺序流动，这是各层读写的主干道。每个层（Attention、MLP、MoE）都需从该流读取、处理数据并写回。![](asset/dsv4/img_02.png) alt='Transformer残差流示例'> > 来自[Anthropic博客](https://transformer-circuits.pub/2021/framework/index.html)。”

然后：“(This follows directly from how residual connections work: `x' = x + layer(x)`, omitting normalizations for clarity. We just chain multiple additions to an ever-changing `x'`).”

翻译：“（这源于残差连接的工作原理：`x' = x + layer(x)`（省略归一化以简化），通过多次累加到不断变化的`x'`。）”

接下来

## 第 5 页

### ⚡ How FP4-FP8 can be more efficient

So why is it 1/3 more efficient? Tensor core computations are bottlenecked by physical resources. Specifically, it's about how many operand bits can be staged, decoded, and fed into the compute pipeline per cycle.

When the size of matrix elements shrinks, we can push more elements through the datapath in the same amount of time. But there's a catch: the compute blocks themselves must natively support this format.

Here are Nvidia's official specs. You can clearly see how cutting the operand size in half doubles the potential compute:

![](asset/dsv4/img_03.png) alt="Nvidia compute specs">

Under the hood, this speedup happens because GPU instructions can process larger matrices in a single pass, taking a fixed number of clock cycles.

Check out this screenshot from a [paper](https://www.scribd.com/document/768738241/Benchmarking-and-Dissecting-the-Nvidia-Hopper-GPU-Architecture) benchmarking different instructions on the H800:

![](asset/dsv4/img_04.png) alt="H800 instructions benchmark">

Notice how the instruction names include the matrix chunk sizes `m-n-k`. For instance, `m64n256k16` (the first row for 16-bit formats) means multiplying a `64x16` matrix by a `16x256` matrix.

Now look at the 8-bit FP8 format in the fourth row. It uses `m64n256k32`, which means multiplying `64x32` by `32x256`. That's the maximum possible size for this GPU type; larger matrices just get split into chunks.

The inner dimension K has doubled, but the instruction still takes exactly 128 clock cycles to execute. So, by dropping down to 8 bits, the GPU manages to multiply twice as many elements in the same number of cycles.

This brings us to an interesting conclusion. If a GPU natively supports FP4 x FP8, it can process more elements per instruction than FP8 x FP8. This gives us a theoretical speedup of \((8+8)/(4+8) = 16/12 = 1.33\times\).

But without this hardware support, developers are stuck calling instructions that perform exactly like standard FP8 x FP8.

The current generation of Blackwell GPUs doesn't actually support this FP4 x FP8 efficiency boost. Sure, they allow multiplying any combination of `{f4,f6,f8} × {f4,f6,f8}`, but the throughput stays exactly the same. Doing `f4 x f8` is exactly as fast as `f8 x f8`. Yes, it's twice as fast as Hopper (see the blue box below), but that's it:

![](asset/dsv4/img_05.png) alt="Blackwell GPU specifications">

That 2x boost is just a baseline architectural improvement in the GPU, which you can also see for FP16 and TF32 (in the red box). A true 2x throughput jump only happens if you go full `f4 x f4` (in the green box).

Because of this, getting that 1/3 extra efficiency out of the box just isn't happening right now. DeepSeek will either have to transition to `f4 x f4` compute, or we'll have to wait for the next generation of hardware—like Nvidia's Vera Rubin or, more likely, upcoming Huawei chips.

## 第 6 页

### 🏗️ Transformer of Theseus

有趣的是，我们至今仍称这些模型为"Transformer"来指代2017年的原始架构，尽管从那以后几乎一切都改变了。

现在的注意力机制完全不同了（我们看到的论文实际使用了两种类型！）。我们抛弃了标准FFN，改用MoE——它们本身也已多次演变——替换了位置嵌入，从LayerNorm转向RMSNorm。

甚至连损失函数都演变为混合多token预测任务。这些甚至还没提从原始编码器-解码器架构到纯解码器LLM的巨大范式转变。

再加上传奇的Adam优化器被AdamW取代，现在又转向Muon。

这就是Transformer版的忒修斯之船。如果你随时间替换了所有原始组件，它还是Transformer吗？我把它留给读者思考。

## 第 7 页

### 🎯 Multi-Token Prediction

嗯，用户让我把一段英文翻译成中文，要简短，还要保留格式。首先，我需要仔细看看原文内容。原文讲的是Multi-Token Prediction（MTP），在V4中只预测一个额外的token，然后解释为什么需要这个，比如更密集的训练信号、数据效率、让模型“提前思考”等等。还有架构上的细节，比如共享输入输出嵌入，有自己的transformer块，可能包含MoE层，还有损失函数的权重。

首先，我需要确保翻译准确，同时保持简短。用户特别提到“简短”，所以可能需要删减一些重复的部分，或者用更简洁的表达。比如原文中两次提到“for training, MTP uses a standard cross-entropy loss...”，可能可以合并。另外，保留格式，比如链接、图片alt文本等。

先看第一句：“Multi-Token Prediction (MTP) does exactly what it sounds like: it predicts multiple future tokens at every position.” 翻译成中文，可能需要简短，比如“多令牌预测（MTP）名副其实：在每个位置预测多个未来令牌。”不过“令牌”通常翻译为“token”，但中文里可能直接用“token”或者“标记”，不过技术文档里通常保留英文，所以可能写“多令牌预测（MTP）名副其实：在每个位置预测多个未来token。”

接下来，“In V4, we’re only predicting one extra token, but why bother?” 翻译成“V4中仅预测一个额外token，为何如此？”或者更口语化一点，“V4仅预测一个额外token，为何要这么做？”

然后解释原因：“First, an MTP objective provides a denser training signal, which improves data efficiency. It also forces the model to "think ahead" and optimize its internal representations for future tokens.” 可以翻译为“首先，MTP提供更密集的训练信号，提升数据效率；同时迫使模型‘提前思考’，优化内部表示以处理未来token。”

接着，“As shown in the diagram from the [original DeepSeek-V3 paper](https://arxiv.org/abs/2412.19437), MTP predicts these extra tokens sequentially while maintaining the full causal chain at every step. ![](asset/dsv4/img_06.png) alt="MTP sequential prediction illustration">” 这里需要保留链接和图片格式。中文可能写“如[DeepSeek-V3原论文](https://arxiv.org/abs/2412.19437)图示，MTP按顺序预测额外token，同时每一步保持完整因果链。![](asset/dsv4/img_06.png) alt='MTP顺序预测示例'”

然后架构部分：“Architecturally, each MTP module shares its input and output embeddings with the main model, but maintains its own full transformer block. This block includes an attention layer and—while the paper doesn't explicitly confirm it—likely an MoE layer (though it could just be a standard FFN).” 翻译：“架构上，每个MTP模块共享主模型的输入输出嵌入，但保留独立的完整transformer块，包含注意力层及可能的MoE层（或标准FFN）。”

最后损失函数部分：“With MTP, we compute a standard cross-entropy loss. This acts as an auxiliary loss with some weight (likely somewhere between 0.1 and 0.3, if we go by the V3 paper). For training, MTP uses a standard cross-entropy loss. This functions as an auxiliary loss, with a weighting factor likely somewhere between 0.1 and 0.3, if we go by the V3 paper.” 这里重复了，可以合并为“训练时使用

### 🧩 Auxiliary-loss-free expert routing

当我们训练MoE模型时，token路由经常遭遇"路由崩溃"问题。这是指网络固执地将大部分token发送给少数几个专家，完全破坏了效率并造成GPU瓶颈，使大部分硬件处于空闲状态。

传统解决方案是使用辅助损失函数来强制平均分配token。

但这种惩罚作为正则化项会改变梯度，与主要的语言建模目标冲突。如果惩罚足够强以平衡负载，会降低模型整体性能。

为了避免这种权衡，无辅助损失的策略将平衡任务从损失函数转移到路由机制中，通过动态的专家偏置（每个MoE层每个专家一个标量值）实现。

如果专家收到超过公平份额的token，其偏置被**降低**以抑制选择；如果专家未充分利用，其偏置被**提高**。通过基于批次统计动态调整这些偏置，实现完美平衡的专家负载而不影响训练目标。

![](asset/dsv4/img_07.png) alt="MoE层中的动态偏置和负载均衡"

动态偏置仅用于路由决策。

### 🧩 Hash routing in early layers

嗯，用户让我把一段英文翻译成简短的中文，还要保留格式。首先，我需要仔细看看原文内容。这段讲的是MoE模型中前几层使用标准密集FFN的原因，避免路由崩溃的问题。

先通读一遍原文。开头说在几乎所有最近的MoE模型中，第一到第三层是标准的密集FFN，这是出于必要。如果早期层用学习的MoE路由，会导致路由崩溃，大部分token都送到一两个专家，训练不稳定。为什么？因为Transformer的早期层是特征提取器，处理通用的低级特征，比如形态和拼写，这时候token还没吸收上下文，所以隐藏状态没有上下文，标准MoE路由器难以学习有意义的动态映射。密集FFN强制所有token用相同权重，建立共享表示基础。比增加隐藏尺寸更高效，因为后者计算量二次增长。也比扩大词汇量好，大词汇量有长尾问题，罕见token训练不足，还提到SolidGoldMagikarp的故事。另外，即使训练稳定，早期路由器最多只能记忆静态映射，比如固定把某个token ID送到特定专家。

现在需要翻译成简短中文，保留格式。可能用户需要技术文档或者论文中的翻译，所以要准确，同时简洁。要注意术语的正确翻译，比如MoE是混合专家，FFN是前馈神经网络，routing collapse翻译成路由崩溃。SolidGoldMagikarp可能需要保留英文，或者用中文译名，但原文有链接，可能直接保留链接，但中文里可能用“SolidGoldMagikarp”或者“固金魔法鲤鱼”之类的，不过通常技术文档中可能保留英文名，或者加引号。

“dense FFNs”翻译为“密集前馈网络”或者“密集FFN”，可能用“密集前馈网络”更准确，但有时候在中文里直接说FFN也可以，不过可能需要全称。不过用户要求简短，可能用“密集FFN”即可。

“routing collapse”翻译为“路由崩溃”应该没问题。

“feature extractors for universal, low-level traits like morphology and spelling” 这里“morphology”是形态学，但可能指词形变化，比如词的结构，比如词根、词缀等。“spelling”是拼写。

“uncontextualized”翻译为“无上下文的”或者“未上下文化的”。

“shared representational foundation”共享表示基础。

“quadratically increase compute”计算量二次增长，或者计算量呈二次方增长。

“long tail of rare, undertrained tokens”长尾的罕见、训练不足的token。

“SolidGoldMagikarp”可能直接保留，或者翻译为“固金魔法鲤鱼”，但通常可能保留英文，因为可能是一个专有名词，比如LessWrong上的文章，可能需要保留原名，或者加引号。

“hardcoded rule”硬编码规则。

现在要简短，所以可能需要把长句拆短，用更简洁的表达。例如“we do this out of pure necessity”可以翻译为“这是出于必要”。

“the model just dumps almost all tokens onto one or two experts”可以译为“模型几乎将所有token分配给一两个专家”。

“severe training instability”训练严重不稳定。

“before a token representation even absorbs its surrounding context”在token表示吸收周围上下文之前。

“standard MoE routers struggle to learn any meaningful, dynamic mappings for expert specialization”标准MoE路由器难以学习有意义的动态专家分配映射。

“Dense FFNs solve this by forcing all tokens through the exact same weights.”密集FFN通过强制所有token使用相同权重来解决此问题。

“builds a shared representational foundation”建立共享的表示基础。

“much more efficient than increasing the hidden

### 🧩 Sqrt-Softplus for router scores

After selecting and computing the outputs for K experts in an MoE layer, we calculate their weighted sum. It's helpful to break this down into three distinct concepts:

- Router logits — the raw outputs of the router linear layer.

- Affinity scores — the positive scores you get after applying an activation function like \(Softmax\).

- Routing weights — the selected top-K scores after normalization, which are actually used to mix the expert outputs.

Classic MoE routers typically relied on \(Softmax\). This ensures the selected expert weights are non-negative and normalized into a probability-like distribution. But \(Softmax\) can get way too sharp because of the exponential. For example, if the router logits for 4 experts are `[4, 4, 4, 8]`, the last expert grabs about 95% of the probability mass. The first three experts are left fighting over the remaining 5%. This leads to a harsh winner-take-most dynamic.

DeepSeek-V3 tackled this by moving to \(Sigmoid\)-based affinity scores. Unlike \(Softmax\), \(Sigmoid\) scores each expert independently. If one expert gets a massive score, it doesn't automatically suppress the others.

But \(Sigmoid\) has its own fatal flaw: it saturates. Large positive logits all squash to roughly 1, and large negative logits drop to roughly 0. Gradients vanish on both ends. So, if two experts have logits of 4 and 8, \(Sigmoid\) just says, "Yep, they're both basically 1." You lose critical information about how strongly that token actually matches the expert.

This \(Sigmoid\)-style routing quickly became the standard for DeepSeek-like MoE models, including Kimi K2.x, GLM-5.x, and MiniMax-M2.x. However, with DeepSeek-V4, the team shifted gears again. They dropped \(Sigmoid\) for \(Sqrt(Softplus)\).

\(Softplus\) behaves a lot like a smooth \(ReLU\): \(Softplus(z)=\log(1+e^z)\):

![](asset/dsv4/img_08.png) alt="Softplus activation function graph">

For highly negative values, it hugs zero. But for large positive values, it keeps growing roughly linearly instead of flattening out. This means positive router logits finally preserve their magnitude. A logit of 8 is now meaningfully stronger than a logit of 4.

Still, plain \(Softplus\) can be a bit too aggressive. If one selected expert has a massive positive logit, it can easily dominate the normalized mixture. Taking the square root beautifully solves this by compressing the dynamic range. \(Sqrt(Softplus)\) hits the perfect sweet spot.

Let's check out the MoE [code](https://huggingface.co/deepseek-ai/DeepSeek-V4-Pro/blob/main/inference/model.py#L546):

`# Compute router logits
scores = router(x)
# Convert logits into positive affinity scores
scores = F.softplus(scores).sqrt()
# Select top-K experts by affinity
indices = scores.topk(self.topk, dim=-1)[1]
weights = scores.gather(1, indices)
# Normalize relative weights among selected experts
weights /= weights.sum(dim=-1, keepdim=True)
# What's this?
weights *= self.route_scale

```

We can see that the `weights` are normalized at the end so they sum to one. But why multiply them by `self.route_scale` right after?

Imagine the selected top-6 experts output vectors with similar magnitudes, but they point in different directions. Not literally opposite, just capturing different features. When we average those vectors together, their coordinates partially cancel out. As a result, the final vector can end up much smaller than a single expert's output.

RMS (root mean square) is just a handy way to measure this. It basically means the "typical per-coordinate size" of a vector. In the toy simulation below, averaging 6 somewhat independent expert outputs gives us a vector with an RMS of only \(1/\sqrt{6} \approx 0.41\) compared to that of a single expert. Without any correction, the routed MoE branch would just become too weak.

DeepSeek-V4 Pro uses top-6 routing and sets `route_scale = 2.5`. Multiplying by 2.5 scales that uniform top-6 average back up to roughly the scale of a single expert:

`import torch
torch.manual_seed(0)

expert_out = torch.randn(4096, 6, 1024) # [tokens, top6 experts, hidden_dim]
weights = torch.ones(6) / 6 # uniform top-6 routing

original_rms = expert_out.pow(2).mean(-1).sqrt().mean()

for route_scale in [1.0, 2.5]:
 agg_out = route_scale * (expert_out * weights[None, :, None]).sum(dim=1)
 agg_rms = agg_out.pow(2).mean(-1).sqrt().mean()
 print(f&quot;route_scale={route_scale}: aggregated/original RMS = {agg_rms / original_rms:.4f}&quot;)
# route_scale=1.0: aggregated/original RMS = 0.4083
# route_scale=2.5: aggregated/original RMS = 1.0209

```

For instance, Kimi K2.5 [uses](https://huggingface.co/moonshotai/Kimi-K2.6/blob/main/config.json#L145) top-8 routing and a scale of 2.827, which is almost exactly \(\sqrt{8}\). It's not a strict rule, though.

### 🏗️ How Hyper-Connections expand

你可能认为这意味着在开始时添加 \(n_{hc}\) 个嵌入层，将多个不同的嵌入传递到残差流中。令人惊讶的是，事实并非如此。对于每个token，嵌入只是简单地重复多次：

`def forward(self, input_ids: torch.Tensor, start_pos: int = 0):
 h = self.embed(input_ids)
 # 通过重复展开为hc_mult份拷贝以实现超连接
 h = h.unsqueeze(2).repeat(1, 1, self.hc_mult, 1)
 # 遍历transformer块
 for layer in self.layers:
 h = layer(h, start_pos, input_ids)
 # 输出LMHead
 logits = self.head(h, self.hc_head_fn, self.hc_head_scale, self.hc_head_base, self.norm)
 return logits

```

在底层，每个`layer`都包含我们稍后会讨论的投影矩阵。我们需要这些矩阵在运行核心操作（如Attention或MoE）之前将\(n_{hc}\)个通道混合成一个，并在之后将其分离回多个通道。

实际上，这意味着虽然相同的嵌入在所有\(n_{hc}\)流中进入第一个transformer层，但当它们退出时看起来会有所不同。

### 🏗️ Hyper-Connections and Equations 1, 3, 5 explained

嗯，用户让我把一段英文翻译成简短的中文，还要保留格式。先看看原文内容。这段讲的是关于Transformer块处理多个嵌入的机制，提到了Pre-Block Mixing和Post-Block Mixing，还有公式里的A_l和C_l，以及DeepSeek-V4 Pro架构里的n_hc=4。

首先，我需要准确理解每个技术点。比如“4 embeddings per token”要翻译成“每个token有4个嵌入”，但可能需要更简洁。然后“flatten the 4 embeddings into a single vector”就是“将4个嵌入展平为单个向量”，不过可能用“展平”或者“合并”更合适。

“linear layer with an output dimension of 4”应该翻译为“输出维度为4的线性层”。然后“weights for a weighted sum”是“加权和的权重”。这里可能需要检查专业术语是否正确，比如“weighted sum”通常译为“加权求和”。

“core layers (DeepSeekMoE / CSA / HCA) still only process a single embedding”这里要保留专有名词，比如DeepSeekMoE、CSA、HCA可能不需要翻译，直接保留。所以“核心层（DeepSeekMoE/CSA/HCA）仍仅处理单个嵌入”。

接下来“Pre-Block Mixing (bottom center)”翻译成“预块混合（底部中心）”，可能需要确认“pre-block”是否常用“预块”还是“块前”，但可能“预块混合”更准确。然后“input mapping A_l in the formula”是“公式中的输入映射A_l”。

“flatten the 4 embeddings into a single vector and pass it through a linear layer with an output dimension of 4” → “将4个嵌入展平为单个向量，通过输出维度为4的线性层”。不过可能“展平”在中文里更常用“展开”或者“扁平化”，但“展平”也可以。

然后“4 numbers act as weights for a weighted sum of the input embeddings” → “这4个数作为输入嵌入加权和的权重”。或者“作为输入嵌入加权和的权重”。

“The result is a single embedding that captures all 4 'meanings' in the right proportions.” → “结果得到一个能以适当比例融合4种含义的单一嵌入。”

“core layer”翻译为“核心层”没问题。

Post-Block Mixing对应“输出映射C_l”，“distributing that single embedding back into the 4 residual streams” → “将该单一嵌入分配回4个残差流”。

“broadcast the same layer update into the four hyper-connection lanes, just with different learned amplitudes.” → “将同一层更新广播到四个超连接通道，但使用不同的学习振幅。”或者“广播到四个超连接通道，但使用不同的学习振幅”。

“1.1 * u to one residual stream and 0.3 * u to another” → “例如，将1.1*u送入一个残差流，0.3*u送入另一个，其中u为核心层输出。”

然后“it might sound counterintuitive, but the...”可能后面还有内容，但用户给的原文到“but the”就结束了，可能后面被截断了？不过用户给的原文最后是“it might sound counterintuitive, but the”，可能后面没写完，但翻译的时候只需要处理到这部分。

现在要简短，所以可能需要更精炼。比如“每个token接收4个嵌入（n_hc=4）”，然后核心层仍处理单个嵌入，通过预块混合和后块混合处理。

检查格式：保留原格式，比如“- **Pre

## 第 8 页

### 📐 TF is Birkhoff polytope?

"What the hell is that?" you might ask. I hate it when simple concepts get slapped with overly complex names. As you'll see, it's actually pretty straightforward.

In this context, the residual mapping matrix \(B_l\) is exactly that 4x4 matrix I mentioned earlier. It simply defines the weights used to combine the embeddings across the different residual streams.

Researchers use all this fancy jargon to say one basic thing: let's just normalize the matrix so that every row and column sums to exactly one, and all elements stay non-negative. Matrices that follow this rule are called "doubly stochastic." The mathematical set of all such matrices is known as the "Birkhoff Polytope."

This is the core difference between mHC and standard HC. Even before V4, researchers noticed that the 4x4 matrices controlling the residual stream mixing tended to break down. The deeper you go into the network, the crazier the absolute values get:

![](asset/dsv4/img_13.png) alt="Matrices in layers 1, 30, and 60 respectively.">

> Matrices in layers 1, 30, and 60 respectively.

In the top half of the image, you can see the \(B_l\) matrices in a trained network without normalization. The row and column sums are printed along the left and bottom edges of each matrix. As you can see, those sums just blow up.

If we combine the streams using these raw, unnormalized weights, the vector magnitudes become completely unbounded. Instead of staying stable, they can jump by factors of tens or hundreds. That's 

### ⚖️ Why constrain residual mixing in mHC?

Recall that whenever you multiply an embedding \(x\) by a weight matrix \(W\), you're applying a linear transformation. Geometrically, this transformation takes the input space and rotates, squishes, and stretches it.

The spectral norm of a matrix is simply its maximum stretch factor. Since the paper bounds this norm to 1, the matrix's maximum stretch factor is at most 1.0. As a result, no matter what vector you multiply by this matrix, the output will never be longer than the input.

Why does this matter? In mHC, we repeatedly apply mixing transformations in the residual stream. If any of these matrices have a spectral norm greater than 1, certain directions in the activation space will keep getting amplified. Even a 3% expansion at each layer yields an amplification of \(1.03^{60} \approx 5.9\) (assuming a 60-layer network).

By constraining \(B\) to be doubly stochastic, mHC makes the residual mapping behave like a mass-preserving mixer. It can blend information across the expanded residual lanes, but it can't arbitrarily amplify the signal.

[The mHC paper](https://arxiv.org/abs/2512.24880) visualizes this directly, showing the products of residual mixing matrices across 60 layers for both the unconstrained HC setup and the constrained mHC setup. In the HC case, the composite mapping develops extreme positive and negative values. This means some paths through the residual stream strongly amplify the signal or gradients—exactly the kind of behavior that destabilizes optim

### 🌀 The Birkhoff polytope

如前所述，这种复杂表述仅意味着我们将矩阵归一化，使每行每列的和都为1，且所有元素均为非负数。

## 第 9 页

### 👁️ Two KV-entry series

一个序列 \(C^b\) 包含表示"当前块"的特征，另一个序列 \(C^a\) 表示"前一个块"。实际上，我们为每个token创建了两种表示。第一种表示用于token作为当前压缩块的一部分，编码其核心含义；第二种表示用于作为上下文信息，提供补充细节。

## 第 10 页

### 👁️ Learnable positional biases

嗯，用户让我把一段英文翻译成中文，还要简短，保留格式。先看看原文内容。

原文是：“These are just per-position biases. They allow the model to learn patterns like a decay effect within a chunk, where early tokens contribute less to the sum than later ones. Since we have \(m\) tokens per chunk, we need \(m\) of these bias vectors.”

首先，我需要准确理解每个部分的意思。"per-position biases"应该翻译为“逐位置偏置”或者“按位置的偏置”。“decay effect within a chunk”可能是指在一个块（chunk）内的衰减效应，也就是前面的token对总和的贡献比后面的少。

“Since we have \(m\) tokens per chunk, we need \(m\) of these bias vectors.” 这里m是每个chunk的token数量，所以需要m个这样的偏置向量。

现在要简短，所以可能需要把句子结构简化，但保留技术术语。比如“per-position biases”可以译为“逐位置偏置”，“decay effect”可能用“衰减效应”或者“衰减效果”。

“allow the model to learn patterns like a decay effect within a chunk, where early tokens contribute less to the sum than later ones.” 这部分可以翻译为“使模型学习块内衰减模式，早期token对总和的贡献小于后期token”。

然后“Since we have m tokens per chunk, we need m of these bias vectors.” 这里可能需要处理数学符号，比如“\(m\)”在中文里通常保留符号，或者写成“m个”，但可能直接保留原样，比如“每个chunk有m个token，因此需要m个这样的偏置向量。”

检查一下格式是否保留，原文中的\(m\)在中文里可能还是用LaTeX格式，所以应该保留为\(m\)。但中文环境下有时候可能直接写m，但用户说保留格式，所以可能保持原样。

现在组合起来：

“这些是逐位置偏置，使模型学习块内衰减模式（早期token对总和贡献小于后期）。由于每个chunk有\(m\)个token，需\(m\)个此类偏置向量。”

或者更简短一点：“逐位置偏置让模型学习块内衰减效应：早期token贡献小于后期。每个chunk含\(m\)个token，需\(m\)个偏置向量。”

需要检查是否准确，比如“decay effect”是否翻译为“衰减效应”更合适，或者“衰减模式”？可能“衰减效应”更准确。

“early tokens contribute less to the sum than later ones”可以简化为“早期token贡献小于后期”。

“we need m of these bias vectors”可以译为“需m个此类偏置向量”或者“需要m个这样的偏置向量”。

可能更简洁的表达：“逐位置偏置使模型学习块内衰减效应（早期token贡献小于后期）。因每个chunk有\(m\)个token，需\(m\)个偏置向量。”

或者更简短，比如：“逐位置偏置用于学习块内衰减效应（早期token贡献小于后期）。每个chunk含\(m\)个token，需\(m\)个此类偏置向量。”

可能还可以更简短，比如去掉“用于”，直接“逐位置偏置让模型学习块内衰减效应：早期token贡献小于后期。每个chunk有\(m\)个token，需\(m\)个偏置向量。”

检查是否符合简短的要求。可能“per-position biases”翻译成“逐位置偏置”是标准的，比如在Transformer中常用这个术语。

“decay effect within a chunk”可以翻译为“块内衰减效应”或者“chunk内的衰减效应”，但

### 👁️ Equations 11-12 for CSA

让我们更详细地分解这些公式中发生的事情。我们有三对项：

- \(C^a\) 和 \(C^b\) —— 用于构建压缩块表示的令牌向量。如上所述，\(a\) 和 \(b\) 表示前一个和当前块。

- 直观上，这些向量捕捉了嵌入的实际含义。

- \(Z^a\) 和 \(Z^b\) —— 用于在压缩期间加权不同令牌的局部注意力对数。与标准注意力机制中每个令牌对计算一个对数不同，这里的对数是每通道的。

- 直观上，这些向量跟踪每个令牌内信息的重要性。

- \(B^a\) 和 \(B^b\) —— 如前所述，这些是每个位置的偏差，因此模型可以学习诸如块内衰减之类的东西。

- 直观上，它们根据位置降低 \(Z^a\) 和 \(Z^b\) 的重要性。

因此，公式中传递给 \(Softmax_{row}\) 的参数代表了所有 \(2m\) 个令牌在两个块（当前和前一个，好像它们被连接起来）中的重要性，已根据它们的位置进行调整。然后对每个通道分别对令牌应用 \(Softmax_{row}\)。这与通常在标量上操作的标准 \(Softmax\) 不同。相反，我们针对每个隐藏通道独立地应用此操作，横跨两个连续块中的令牌位置。

### 🔢 The Hadamard product

Hadamard积$\odot$就是简单的通道逐元素相乘：

![](asset/dsv4/img_15.png) alt="Hadamard积图示">

正如我之前提到的，这里的加权是按通道进行的，而不是每个token使用单个标量权重。这正是我们需要Hadamard积的原因。

## 第 11 页

### 👁️ The grouped projection trick

嗯，用户让我把一段英文翻译成中文，要简短，还要保留格式。先看看原文内容。

原文是：“From what I've gathered, this is the first time an approach like this has been used. You won't find it in any previous LLMs of this scale. You do occasionally see conceptually similar ideas though, such as in [Rethinking Attention Output Projection: Structured Hadamard Transforms for Efficient Transformers](https://arxiv.org/abs/2603.08343).”

首先，我需要准确翻译，同时保持简短。用户可能希望翻译后的中文既准确又简洁，可能用于技术文档或者快速传达信息。要注意保留格式，比如链接部分不能动，可能需要保留方括号和URL。

先分解句子：

1. "From what I've gathered, this is the first time an approach like this has been used." 
   - 意思是根据我所了解的，这是第一次使用这种方法。或者“据我所知，这是首次采用这种方案。”

2. "You won't find it in any previous LLMs of this scale."
   - 在以往同等规模的LLM中找不到这种做法。或者“此前没有同等规模的LLM采用过此方法。”

3. "You do occasionally see conceptually similar ideas though, such as in [Rethinking Attention Output Projection: Structured Hadamard Transforms for Efficient Transformers](https://arxiv.org/abs/2603.08343)."
   - 不过有时会有概念相似的想法，比如这篇论文：[Rethinking Attention Output Projection: Structured Hadamard Transforms for Efficient Transformers](https://arxiv.org/abs/2603.08343)

现在需要简短翻译。可能需要调整结构，让句子更紧凑。

比如：

据我所知，这是首次采用此类方法，此前同等规模的LLM中未见此做法。但概念相似的思路偶有出现，例如[《重新思考注意力输出投影：高效Transformer的结构化Hadamard变换》](https://arxiv.org/abs/2603.08343)。

检查是否简短。可能需要更简练。比如“此前同等规模LLM中未见此方法”或者“此前无同等规模LLM使用过”。

“据我所知，这是首次采用此类方法，此前同等规模LLM中未见。但概念相似的思路偶有出现，如[《重新思考注意力输出投影：高效Transformer的结构化Hadamard变换》](https://arxiv.org/abs/2603.08343)。”

或者更简短一点，比如“据我所知，这是首次使用此类方法，此前同等规模LLM中未见。但概念相似的思路偶有出现，例如[...]”。

注意论文标题的翻译是否准确。原题是“Rethinking Attention Output Projection: Structured Hadamard Transforms for Efficient Transformers”，通常中文翻译可能会是“重新思考注意力输出投影：用于高效Transformer的结构化Hadamard变换”或者更简洁的“重新思考注意力输出投影：高效Transformer的结构化Hadamard变换”。

保持标题的翻译准确，但可能不需要太长。例如“重新思考注意力输出投影：高效Transformer的结构化Hadamard变换”。

然后检查格式是否保留，比如方括号和链接是否原样保留。是的，中文翻译中应该保留[标题](链接)的格式。

再检查是否简短。原句翻译后的中文是否足够简短。可能可以去掉“据我所知”，但“从我收集到的信息来看”可能更口语化，但用户要求简短，所以“据我所知

### 🔢 The "quite large" attention output

When the paper says "\(cn_h\) is quite large", they mean \(c \times n_h = 512 \times 128 = 65536\). So before the attention output projection, each token has a 65,536-dimensional concatenated attention output. Since the model's hidden size is \(d = 7168\), the output projection would require a Linear layer with nearly 470 million parameters—for every single layer.

For reference, BERT-Large had 340M parameters in total. Oh, the brave new world of LLMs!

That's why DeepSeek factorizes this massive matrix into several smaller ones. This trick cuts the parameter count per layer down to \(16 \times (4096 \times 1024) + 16384 \times 7168 \approx 185\)M parameters, which is a 2.55x reduction. Across 61 layers, you're looking at roughly 28.66B parameters for the naive approach versus 11.26B parameters with GOP. That saves 17.4B parameters just in the attention output projections alone.

You might wonder why other models haven't used this trick. Well, most mainstream models have significantly smaller (compressed) per-head embedding sizes. For instance:

- In DeepSeek-V3.2, \(c \times n_h = 128 \times 128 = 16384\), and the `Linear(16384, 7168)` layer only has 117M parameters.

- For Kimi-2.5/2.6, \(c \times n_h = 128 \times 64 = 8192\), and the `Linear(8192, 7168)` layer has 59M parameters.

So, this bottleneck only emerged because of the massive increase in embedding size. This is mainly because the sequence is compressed, with each chunk representation carrying the semantic informa

## 第 13 页

### 👁️ RoPE on 64 dimensions

The idea of applying RoPE to only a part of the embedding isn't exactly new. It surfaced recently in [Gemma 4](https://arc.net/l/quote/wvnvlywj), for example. Let's dive into how and why this actually works.

RoPE takes the Query and Key vectors and slices them up into pairs of values. A 64-dimensional vector has 32 of these pairs. We can look at each pair as a 2D vector pointing in a specific direction. RoPE applies a slight rotation to each pair, and angle of rotation decreases as we move through the embedding dimensions. As Maarten Grootendorst explains in his [Gemma 4 breakdown](https://newsletter.maartengrootendorst.com/i/193064129/p-rope):

![](asset/dsv4/img_16.png) alt="image.png">

This is known as the frequency. High-frequency pairs are extremely sensitive to small position changes because they undergo a large rotation. The low-frequency pairs, on the other hand, get a very slight rotation. They barely move at all from word to word.

You could say the first pairs are high-frequency and handle short-range dependencies. The last pairs are low-frequency and manage long-range influence. Since they rotate so little over standard context lengths, relative position doesn't drastically change their dot-product contribution.

But why use rotation in the first place? RoPE changes the relative angle between the Query and Key while preserving their norms. This directly affects their dot product, which is what we use to compute attention logits. Rotation lowers the dot product, 

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

Boom! The extra term in our dot product no longer depends on \(t\) and \(j\) individually. It depends purely on their difference! \(R_{j-t}\) will be exactly the same whether \(j=995, \space t=1000\) or \(j

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

To solve this, we can simply add a dedicated sink term to the softmax denominator (though this is just one of several potential workarounds). This gives the attention head a clear "none-of-the-above" option. This way, any leftover attention mass safely drains into the sink instead of spilling over onto the active K

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

\[\frac{1}{\frac{1}{2}\left(\frac{1}{4} + \frac{1}{12

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

- Thin

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

![](asset/dsv4/img_

### 🔧 Expert parallelism

嗯，用户让我把一段英文翻译成简短的中文，保留格式。首先，我需要仔细看看原文内容。原文是关于专家并行（Expert Parallelism, EP）的，引用了Hugging Face的一个空间链接，还有图片和一些技术细节。

首先，我得确认翻译的要求：简短，保留格式。所以可能需要保留链接、图片标记、数学符号等。比如“[Ultra-Scale Playbook](https://huggingface.co/spaces/nanotron/ultrascale-playbook?section=expert_parallelism)”这个链接要保持原样，图片的alt文本也要处理。

接下来，逐句分析。第一句：“Borrowing from the excellent [Ultra-Scale Playbook](https://huggingface.co/spaces/nanotron/ultrascale-playbook?section=expert_parallelism): The design of MoE layers makes it easy to implement parallelism across the experts dimension, for what we call expert parallelism (EP).” 这里“Borrowing from”可以翻译为“借鉴自”，然后链接部分保持原样。MoE layers是“混合专家（MoE）层”，expert parallelism翻译成“专家并行（EP）”。

接下来：“Since the feedforward layers are fully independent, we can simply put each expert's feedforward layer on a different worker (GPU). Compared to TP (TensorParallelism), this approach is much more lightweight, since we don't need to split the matrix multiplication; we just need to route the hidden states of a token to the right expert.” 这里feedforward layers是“前馈层”，worker (GPU)可以译为“工作节点（GPU）”。TP是张量并行，需要写成“张量并行（TP）”。然后“split the matrix multiplication”可能翻译为“拆分矩阵乘法”，“route the hidden states”是“路由隐藏状态”。

然后图片部分：“![](asset/dsv4/img_23.png) alt="Expert Parallelism routing illustration">” 这里需要保留图片标记，但alt文本可能需要翻译。不过通常alt文本在中文环境下可能保留英文，或者翻译成中文。比如“专家并行路由示意图”可能更合适。不过用户说保留格式，所以可能图片的markdown格式不变，alt部分翻译成中文。例如：alt="专家并行路由示意图"

接下来：“There are a few tricks to make EP work efficiently, and they are closely tied to model design. For instance, DeepSeek-V3 enforces a constraint in the router, ensuring that each token is sent to at most \(M\) nodes (in their case, 4) to keep the tokens on a single node and reduce communication overhead.” 这里“tricks”可以译为“技巧”或者“诀窍”，“enforces a constraint”是“施加约束”，“each token is sent to at most M nodes”即“每个令牌最多发送到M个节点”，这里M是变量，保持原样，括号里例子是4。最后“reduce communication overhead”是“减少通信开销”。

现在要确保翻译简短，所以可能需要精简一些表达。例如“makes it easy to implement parallelism across the experts dimension”可以简化为“便于实现专家维度的并行”。

检查是否有需要简化的部分。比如“Since the feedforward layers are fully independent, we can simply put each expert's feedforward layer on a different worker (GPU).” 可以译为“前馈层完全独立，可将各专家的前馈层分配至不同GPU工作节点。”

“Compared to TP (TensorParallelism), this approach is much more lightweight, since we don't need to split the matrix multiplication; we just need to route the hidden states of a token to the right expert.”

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

So, whe

## 第 18 页

### ⚙️ Why split-KV is unavailable

First, let's break down what the Split-KV method is and why we need it. Then we’ll look at why we can't actually use it here.

In NVIDIA GPU architecture, the Streaming Multiprocessor (SM) is the fundamental computational building block. You can think of it loosely as a highly parallel GPU "core". A modern GPU like an H100 has over a hundred SMs, and we usually parallelize compute workloads across them.

The famous FlashAttention algorithm works exceptionally well during training because it parallelizes across the batch and query dimensions. During pre-training or the prefill phase of inference, we process many query tokens in parallel, which naturally provides enough work to keep all SMs busy.

But during decoding—for both standard inference and, more importantly, RL rollouts—the query length is tiny. It's often just a single token. Combine that with long contexts that force small batch sizes due to memory limits, and the GPU suddenly lacks parallel work. Most of the SMs sit completely idle, leading to terrible GPU utilization.

To fix this, we use Split-KV. This decoding-focused optimization splits the long sequence dimension (the KV cache) into smaller chunks to be processed in parallel across multiple SMs. This allows all SMs to work on the exact same query simultaneously. Afterward, a separate step gathers the partial results from all SMs and reduces (sums) them to produce the final attention output:

![](asset/dsv4/img_25.gif) alt="Split-KV method illustration">

Howeve

### ⚙️ When split-KV is removed

在上一篇笔记中，我们看到了Split-KV如何将长序列维度（KV缓存）切分成更小的块，以便在多个SM上并行处理。没有它，我们的GPU并行化选项就只剩下在batch和查询长度上进行分割。

由于解码时的查询长度为1，这里无法并行化。我们只剩下batch维度。

在标准方法中，不使用Split-KV时，单个batch元素会占用整个SM的所有资源。H800 GPU物理上有132个SM。我不知道DeepSeek在长上下文RL rollout中使用的具体batch大小，但为了简化，假设为200。

每个SM处理一个batch元素，将当前token的Query乘以整个上下文的KV缓存。前132个元素立即开始处理，完全饱和GPU。这是第一波。剩余的68个请求（\(200 - 132 = 68\)）必须等待第二波，因为没有空闲的SM了。

第一波完成后，剩余的68个元素被分配到新释放的SM上。但现在GPU有一半处于空闲状态。我们只使用了132个SM中的68个，而其他64个什么都不做。

这正是Split-KV解决的硬件利用率不足问题。它允许我们将batch的尾部扩展到所有SM上。但DeepSeek-V4团队决定放弃它以保持batch不变性。

有趣的见解：这意味着将batch大小从200增加到264基本上是免费的 t

### ⚙️ Split-K for small batches

嗯，用户让我把一段英文翻译成中文，要简短，还要保留格式。首先，我需要仔细看看这段英文内容。看起来是关于split-K和GEMM的，可能涉及GPU计算或者深度学习的优化技术。

首先，我得确认用户的需求。他们需要翻译，但保持格式，比如代码块、数学符号、列表结构等。所以不能随便改格式，比如里面的列表项、数学公式、代码块的标记都要保留。

先通读一遍原文。开头说Conceptually, split-K is based on the exact same idea as the split-KV trick... 然后讲GEMM，矩阵乘法，形状，计算方式，然后split-K如何进一步拆分K维度，还有关于并行化的问题，SM空闲，浮点加法不满足结合律，等等。

翻译的时候要注意专业术语的正确性。比如“split-K”可能直接保留，或者翻译成“分裂K”？不过通常这类术语可能不翻译，直接保留英文。比如split-KV可能也是保留。GEMM一般翻译为“通用矩阵乘法”或者直接用GEMM。CUDA block可能保留CUDA，因为这是专有名词。

然后看结构。原文有列表，比如A: [M, K]，B: [K, N]，C: [M, K] x [K, N] = [M, N]。这些需要保留格式，可能用中文的冒号或者保持原样。比如“A: [M, K]”可能翻译成“A: [M, K]”保持不变，因为括号里的内容是数学符号。

然后数学公式部分，比如C[m, n] = sum_k A[m, k] * B[k, n]，需要保留LaTeX格式，比如用$...$或者$$...$$。原文中是用\( ... \)表示的，可能翻译后还是用同样的符号。

接下来，“split-K takes this a step further by splitting the computation along the K dimension. Now, our tile looks like this: [C[m0:m1, n0:n1] = partial_0 + partial_1 + ...]” 这里的tile可能翻译为“块”或者“瓦片”，但可能保留tile？或者根据上下文。不过通常在GPU计算中，tile可能翻译为“分块”或者直接保留tile。不过可能需要看中文技术文档的习惯。比如“分块”或者“切块”。

然后“partial_0 + partial_1 + ...”可能保留partial，或者翻译为“部分和”？比如partial sum，所以partial_0可能翻译为“部分和0”之类的，但可能直接保留partial_0，因为这是变量名。

后面提到“when parallelizing across just two axes (especially when one is very small, like the batch size) doesn't generate enough parallel work, some SMs on the GPU end up idle.” 这里的SM是Streaming Multiprocessors，通常翻译为“流式多处理器”或者直接SM。batch size是批大小。

“Floating-point addition simply isn't associative: (A+B)+C≠A+(B+C).” 这句需要准确翻译，浮点加法不满足结合律。

然后最后提到“Note that even though "split-KV" and "split” 可能后面还有，但用户给的原文可能被截断了，但翻译时可能需要处理。

现在开始逐句翻译，保持简短，同时保留格式。

比如开头：“Conceptually, split-K is based on the exact same idea as the split-KV trick we discussed earlier, but this time, we’re applying it to GEMM (general matrix multiplication).”

翻译：概念上，split-K基于之前讨论的split-KV技巧的相同思路，但

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

嗯，用户让我把一段英文翻译成简短的中文，还要保留格式。先看看原文内容。看起来是关于DeepSeek-V3和V4的训练框架中精度设置的说明，里面有表格和一些技术术语。

首先，我需要确认用户的需求：简短翻译，保留格式。可能需要保持原有的结构，比如标题、表格、图片链接等。不过用户给的示例里有个图片链接和alt文本，可能需要处理一下。比如“![](asset/dsv4/img_28.png) alt="It really was quite something!"”这部分，可能翻译的时候要保留图片标记，但alt文本可能需要翻译，或者保持原样？

不过用户说“保留格式”，可能是指保持原有的Markdown结构，比如加粗、表格、图片链接等。但中文翻译时，可能需要把文字部分翻译，但结构不变。

现在看原文内容，第一句：“Back in DeepSeek-V3, the core training framework relied on FP8 mixed precision for both pretraining and RL. Just a quick refresher: this means we mix and match different data types—the big win here is that MoE weights are stored and multiplied in FP8, which saves a massive amount of memory. Meanwhile, attention and other sensitive components are kept in higher precision. ![](asset/dsv4/img_28.png) alt="It really was quite something!" It really was quite something! Now, DeepSeek-V4 introduces a much more granular breakdown across the different training stages. I’ve put together a quick table summarizing all the precision types mentioned throughout the paper. It's super handy to keep this in mind as we go: Stage Type Notes LM Pretrain **FP8 mixed** Inherits the DS-V3 training framework. Core Linear GEMMs are in FP8. No FP4 whatsoever. Specialist SFT **simulated FP4→FP8** QAT in post-training. FP4 expert weights are de-quantized to FP8 for the forward and backward passes. Specialist RL / rollouts **native FP4** No backward pass. Uses FP4 weights directly for sampling. Specialist RL / train **simulated FP4→FP8** Backward pass over FP8 weights. Gradients flow into FP32 master weights via STE. OPD / student rollouts **native FP4** The student generates on-policy trajectories. OPD / teacher logits inference **native FP4** Inference-only forward passes, meaning no backward pass is needed. OPD / student train **simulated FP4→FP8** Reverse-KL / full-vocab distillation. Mod”

需要翻译成中文，简短。可能要注意技术术语的正确翻译，比如FP8是8位浮点，FP4是4位浮点，MoE是混合专家模型，QAT是量化感知训练，STE是Straight-Through Estimator，GEMMs是通用矩阵乘法，RL是强化学习，SFT是监督微调，OPD可能是指某种特定的训练阶段，比如Online Policy Distillation？不过可能需要确认，但用户可能只需要直译。

先处理每个部分：

“Back in DeepSeek-V3, the core training framework relied on FP8 mixed precision for both pretraining and RL.” → 回顾DeepSeek-V3，核心训练框架在预训练和强化学习中均使用FP8混合精度。

“Just a quick refresher: this means we mix and match different data types—the big win here is that MoE weights are stored and multiplied in FP8, which saves a massive amount of memory. Meanwhile, attention and other sensitive components are kept in higher precision.” → 简单回顾：混合不同数据类型，MoE权重以FP8存储和计算，大幅节省内存，而注意力等敏感组件保持高精度。

“![](asset/dsv4/img_28.png)

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

是的，每个rank都会接收整个序列的完整KV缓存。

你可能会认为这会占用大量空间，完全耗尽你的显存。但由于CSA和HCA的惊人效率，即使对于超长上下文窗口，实际内存占用也很小。

让我们快速计算一下。为简单起见，我们假设所有元素都以BF16（每个元素2字节）存储，尽管DeepSeek提到某些维度以FP8存储。

对于64k token上下文，单个CSA层存储\(64\text{k}/4 = 16,384\)个KV条目（得益于压缩因子\(m=4\)）。这得出的结果仅为：

\[512 \times 2 \times 16,384
= 16.7\text{M} \text{字节}
\approx 16.7\text{MB}\]

每层每序列。

对于HCA，这个数字减少了\(128/4 = 32\)倍。我们谈论的是不到1兆字节！

即使扩展到1M token上下文，我们也只看到大约256 MB和8 MB。这些数字如此之小，几乎不会对你的网络带宽或显存造成任何影响。

## 第 22 页

### 💾 Layer-varying KV caches

这是因为CSA和HCA使用不同的块大小（例如，\(m=4\) 与 \(m'=128\)）。
因此，我们必须保留不同大小的token缓冲区，以便稍后将它们压缩成单个块。结果是一层的token槽位远多于另一层。

我们还必须考虑到CSA和HCA由于压缩因子不同而固有地产生不同数量的块。此外，CSA要求我们将闪电索引器密钥存储在KV缓存中。

简而言之，各层差异很大。

## 第 24 页

### 🚀 Is on-disk KV cache fast enough?

嗯，用户让我把一段英文翻译成中文，要简短，保留格式。先看看原文内容。这段讲的是关于磁盘读取速度和LLM推理中的存储带宽问题，提到了DualPath论文，DeepSeek的3FS文件系统，还有带宽数据之类的。

首先，我需要准确翻译技术术语，比如“KV cache”应该是“键值缓存”，“DRAM cache”是“DRAM缓存”，“SSDs”是“固态硬盘”，“NIC”是“网络接口控制器”，“PCIe Gen5”保持原样，“HBM”是高带宽内存。可能有些缩写需要确认，比如“3FS”可能直接保留，因为是专有名词。

然后看结构，原文有几段，需要保持段落结构。用户要求简短，所以可能需要精简一些细节，但必须保留关键数据和术语。比如“400Gbps”转换成“400 Gbps”，中文里通常写成“400 Gbps”或者“400吉比特每秒”，但可能保留数字和单位更合适。

“cluster-wide 3FS has no internal DRAM cache and can saturate the 400Gbps bandwidth of the storage NIC.” 这里“saturate”翻译为“充分利用”或者“达到饱和”，但技术上可能用“充分利用”或者“满载”更合适。“saturate the bandwidth”通常翻译为“充分利用带宽”或者“达到带宽上限”。

“3FS is the name of their custom file system.” 这句可以翻译为“3FS是他们自定义的文件系统名称。”

“The interesting part is the lack of a DRAM cache.” 可以说“有趣的是，该系统没有DRAM缓存。”

“everything is read directly from SSDs.” 译为“所有数据直接从SSD读取。”

“Despite this, the storage architecture is designed to completely saturate the Network Interface Controller (NIC).” 这里“completely saturate”可能需要准确表达，比如“完全利用NIC的带宽”或者“使NIC达到满载”。

“400 Gbps is roughly 50 GB/s.” 这个转换要准确，50 GB/s是对的，因为1 Gbps = 0.125 GB/s，所以400*0.125=50。

“single fast DDR5 memory channel” 译为“单条快速DDR5内存通道”。

“PCIe Gen5 I/O fabric, which pushes about 64 GB/s in one direction.” PCIe Gen5 I/O架构，单向传输约64 GB/s。

“per-GPU host ingress limit” 可能翻译为“每GPU主机的入口带宽限制”。

“a drop in the bucket compared to the massive HBM bandwidth inside the GPU itself” 这个成语“drop in the bucket”意思是微不足道，可以译为“与GPU内部的高带宽HBM相比，这仍微不足道”。

然后检查有没有需要简化的部分。比如“DeepSeek wrote: “Our cluster-wide 3FS has no internal DRAM cache and can saturate the 400Gbps bandwidth of the storage NIC.”” 可以翻译为“DeepSeek在论文中表示：‘我们的集群级3FS无内部DRAM缓存，可充分利用存储网卡的400 Gbps带宽。’”

“3FS is the name of their custom file system.” 简单说“3FS是其自研文件系统”。

“the lack of a DRAM cache. This means the system isn't faking its performance by keeping hot KV blocks in a massive DRAM data cache; everything is read directly from SSDs.” 这里“is

## 第 26 页

### 📝 How to combine AdamW + Muon

如论文前面所述，AdamW也应用于mHC模块的静态偏置和门控因子。

![](asset/dsv4/img_31.png) alt="方程3-5中的这六个参数。">

> 方程3-5中的这六个参数。

但为什么要这样分割？为什么有些层用Muon训练，有些层用AdamW？

让我们回顾一下之前关于Muon的讨论。传统优化器对所有参数一视同仁。Muon更智能，它理解2D权重矩阵（如线性层中的矩阵）具有独特的几何结构。

在反向传播过程中，它不只是应用原始动量更新，而是将其正交化以产生更平衡的参数变化。

这意味着Muon的操作只有在参数是 proper 矩阵变换时才有意义。让我们看看例外情况：

- **嵌入模块：** 是的，从技术上讲它是形状为\(vocab\_size \times hidden\_dim\)的2D矩阵。但从语义上讲，它不是普通的密集线性映射——它是查找表。行对应离散标记，而不是连续输入特征。这里AdamW更合适，因为它保持每个参数的自适应二阶矩。这使得稀有和频繁标记的行可以获得不同的有效学习率。

- **预测头**（通常称为LM头）：它是对分类词汇的分类器。其行和列与标记标识相关，而不仅仅是隐藏特征。

- **RMSNorm：** 这里的权重是...

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

&lt;…&gt; we observed a critical limitation: when prompted to both generate and analyze its own proof in one shot, the generator tends to claim correctness even when

## 第 31 页

### 🤖 Reasoning across agent turns

When I was using Codex and ChatGPT last year, I kept wondering: can these models actually see their own reasoning from the previous steps? Half the time, it felt like they couldn't. I’d point out a specific step in their logic and ask, "Why did you do that?"—and they'd completely lose the plot. They genuinely had no clue what I was talking about.

![](asset/dsv4/img_35.png) alt="Hidden CoT example">

Now the meta has shifted: models are explicitly fed their previous reasoning steps. This keeps them from getting stuck in endless logic loops. Not only is it a massive UX upgrade, but it also slashes token usage, especially for tool calling. A model can formulate a plan and execute several tool calls sequentially, without needing to constantly reinvent the plan for future calls because it was discarded.

Even Anthropic, who are notoriously secretive about their closed-source Claude Code—talked about this in a recent [blog post](https://www.anthropic.com/engineering/april-23-postmortem):

![](asset/dsv4/img_36.png) alt="Anthropic blog post snippet about reasoning chains">

## 第 33 页

### 🎓 Why reverse KL is used for on-policy distillation

好的，什么是反向KL，为什么我们不使用前向KL？来分解一下。

学生模型的后训练方法通常分为两类。引用Thinking Machines的一篇优秀[博客文章](https://thinkingmachines.ai/blog/on-policy-distillation/#loss-function-reverse-kl)：

- **在线策略**训练从学生模型本身采样轨迹并为其分配奖励。

- **离线策略**训练依赖于来自外部源的目标输出，学生学习模仿这些输出。

离线策略训练的缺点是学生在教师常去的情境中学习，而不是在学生实际会遇到的情境中。这导致错误累积。如果学生犯了早期错误而教师永远不会犯，它会偏离训练期间看到的状态越来越远。

那么为什么不总是使用在线策略方法呢？将在线策略蒸馏与RL进行比较会有帮助。学生生成轨迹，教师对每个轨迹进行评分以提供反馈。但标准RL有一个巨大缺点：这种反馈非常稀疏。学生只知道最终答案是错误的，并在未来避免这条路径。它不知道具体在哪里犯了错误。

直观上，在线策略蒸馏(OPD)的核心思想是从学生模型采样轨迹，并使用高性能教师对**每个token**进行评分。

让我们回顾一下，Kullback-Leibler(KL)散度是一种

## 第 34 页

### 🎓 Teacher hidden-state caching

这看起来像是一个可以轻松跳过的小优化。但让我们来计算一下它实际上节省了多少内存。

为了弄清楚这一点，我们需要教师模型最后层隐藏状态和实体化对数的位精度。论文中没有提到这一点，所以我们简化假设标准的2字节浮点数（BF16/FP16）。这样我们得到每个教师模型每个序列的内存占用：

- \(M_{\text{logits}} = \text{Seq\_len} \times |\text{Vocab}| \times 2\)

- \(M_{\text{hidden}} = \text{Seq\_len} \times \text{dim} \times 2\)

假设上下文长度为64k——对于代理回放来说这是一个相当标准的大小。对于DeepSeek-V4 Pro，\( |\text{Vocab}| = 131,072 \) 和 \( d = 7168 \)，存储对数需要16GB，而隐藏状态只需要0.875GB。这意味着每个序列每个教师模型节省超过15GB。

（是的，如果他们使用FP8而不是BF16/FP16，绝对数值会减半，但节省比例完全相同）。

还值得注意的是，隐藏状态（尤其是输出对数）不是KV缓存条目。它们不会被压缩成4或128个token的块，所以我们不能依赖这些巨大的内存节省。

DeepSeek提到使用了十多个教师模型。这意味着我们每个序列节省超过150GB。这个数字听起来太离谱了，我实际上不得不重新检查我的数学。

## 第 38 页

### 📈 The SimpleQA-Verified situation

DeepSeek-V4 Pro crushing Kimi K2.6 here feels a bit off. Since Kimi is also a huge 1-trillion parameter model trained on over 30T tokens, the performance gap on SimpleQA seems disproportionately large. While I don't doubt V4's underlying quality, this result points toward overfitting or a failure to properly filter out the eval data from their pretraining set.

That said, I'm not saying DeepSeek is faking it. V4 performs legitimately well on [AA-Omniscience](https://artificialanalysis.ai/evaluations/omniscience)—a newer benchmark designed to measure a model's breadth of knowledge—where it still manages to outperform Kimi:

![](asset/dsv4/img_39.png) alt="AA-Omniscience benchmark comparison">

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

DeepSeek aside, this is an insane amount of progress on real-world engineering tasks. Sonnet 4.5 came out on September 29, 2025, and Opus 4.6 dropped on February 5, 2026. In just four months, the success rate jumped from 50% to 80%.

And keep in mind, these aren't trivial problems. We're talking about complex R&amp;D tasks typically handled by a top-tier engineering team.

It's only going to accelerate from here 🚀
