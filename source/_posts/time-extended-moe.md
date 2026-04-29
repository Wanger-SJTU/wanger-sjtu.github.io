---
title: "时间扩展的混合专家模型"
date: 2026-04-29
tags: ["论文翻译"]
mathjax: true
source: https://arxiv.org/abs/2604.20156
---


# 时间扩展的混合专家模型

**作者**: Zeyu Shen, Peter Henderson（普林斯顿大学）

## 摘要

混合专家（Mixture-of-Experts, MoE）模型目前在固定推理速度下扩展容量方面广受欢迎，但几乎在每个 token 都会切换专家。一旦模型超出可用 GPU 内存，这种频繁切换会使卸载（offloading）和预取（pre-fetching）等优化措施失效。本文指出，强化学习中的选项框架（options framework）是解决这一问题的完美匹配，并提出了时间扩展的混合专家层。基于带有审议成本（deliberation costs）的选项-评论（option-critic）框架，我们在每一层添加了一个控制器，学习何时切换专家集以及加载哪些专家。通过将此方法应用于 gpt-oss-20b 并配合低秩适配器和自蒸馏奖励，我们的方法将切换率从 50% 以上降低到 5% 以下，同时在 MATH、MMLU 和 MMMLU 上保留了基线模型高达 90% 的准确率。这表明即使是现有的预训练模型，也可以通过轻量级训练转换为时间扩展的 MoE，而审议成本使模型训练者能够在切换率和能力之间进行权衡。我们希望这能为不断增长的 MoE 模型中的内存高效服务和持续学习开辟一条基于选项框架的有原则的路径。

---

## 1 引言

现代大语言模型（LLM）主要在其架构中使用某种变体的混合专家（MoE）层[32, 9, 3, 19]，包括 Gemini-2.5-Pro [11]、GLM5 [12]、Qwen3.5-397B-A17B [29]、Qwen3-Next-80B-A3B [30]、DeepSeek-V3 [6] 和 gpt-oss [27]。MoE 仅对每个 token 激活专家的稀疏子集，使得即使总参数量增长，推理时计算量也能保持平稳。例如，一个 1200 亿参数的模型（如 gpt-oss-120b）每次可能只激活 51 亿参数。原则上，如果有足够的内存，可以添加极其大量的专家，同时保持推理延迟不变。扩展专家数量可能会带来能力提升[5, 15]。利用不断增长的专家数量甚至可能有助于改善神经可塑性和持续学习（尽管这尚未得到彻底探索）。

然而，在有限的内存资源下，这一愿景面临挑战：

- 一旦专家总数超出 GPU 内存，权重必须卸载到主机内存或磁盘并按需加载[8, 40]。每次加载都会产生延迟，中断工作流并降低吞吐量。当前的 MoE 架构在很大程度上忽略了这种切换成本，假设所有专家都可以保留在内存中。在三个前沿开源 MoE 中，平均切换率很高，活跃专家集几乎在每个 token 都会改变（第 3 节）。

先前的工作主要通过两个方向来解决 MoE 的内存相关挑战。首先，一些工作应用专家剪枝来减少专家总数，通过永久移除或合并专家，可能还配合额外的微调[39, 24, 25]。其次，一些工作探索缓存、预取和卸载感知的服务方法，并设计启发式方法——通常基于专家激活或跨层/提示的专家使用相关性——来决定哪些专家保留在 GPU 上，哪些从主机内存获取[40, 33, 36, 42]。

然而，我们观察到这个问题在强化学习中有一个直接的对应。选择何时承诺一组资源、何时付出切换成本——这正是在选项框架[35]中由时间扩展动作所形式化的结构。智能体选择一个高级"选项"，该选项在多个时间步中持续；切换到新选项会产生审议成本[14]。

我们提出了**时间扩展混合专家**，训练一个轻量级控制器——一个选项策略——来决定何时切换专家集以及加载哪个新集。控制器通过带有审议成本的选项-评论架构[1]进行优化。由于切换成本是目标函数中的显式项，控制器发现了时间结构。它仅在预期质量增益证明成本合理时才切换专家。

本文的贡献如下：

1. **设计理念**：我们提出了时间扩展 MoE 作为选项框架一部分的设计理念，指出过度的专家切换可能导致在训练、推理和持续学习中的内存优化机会错失。
2. **形式化**：我们将专家的动态加载形式化为半马尔可夫决策过程（s-MDP），将专家掩码视为选项，将专家加载延迟视为审议成本。我们改编并应用选项-评论框架进行优化，设计了一个可以修改大多数现代 MoE 架构的轻量级控制器。
3. **实验验证**：我们展示了 gpt-oss-20b 可以使用我们的选项-评论方法和少量适配器进行训练，将切换率从 50% 以上（每隔一个 token）降低到 5% 以下甚至 1%，并提供与审议成本相称的可配置性能权衡。这表明时间扩展 MoE 甚至可以在不进行大规模预训练的情况下被利用。

我们相信这项工作指出了 MoE 后训练的更广泛原则。随着专家数量持续增长，可能随可用磁盘而非 GPU 内存扩展，切换成本将越来越主导服务延迟。训练将专家加载视为时间扩展决策、具有显式审议成本的控制器，可能为管理这一权衡提供一条有原则的路径。我们将我们的框架视为该方向的初步探索，并提供了其可行性的具体证据。

---

## 2 预备知识

### 2.1 MDP、s-MDP 与选项

我们考虑一个马尔可夫决策过程（MDP）((S, A, P, r, \gamma))，其中状态 (s \in S)，动作 (a \in A)，转移核 (P(s'|s,a))，奖励 (r(s,a))，折扣因子 (\gamma \in [0,1))。策略 (\pi(a|s)) 生成轨迹 (\tau = (s_0, a_0, s_1, a_1, \ldots, s_T)) 和回报 (G(\tau) = \sum_{t=0}^{T} \gamma^t r(s_t, a_t))。

半马尔可夫决策过程（s-MDP）[35]通过允许持续可变步数的动作来推广 MDP：在决策时间 (t_k)，智能体选择一个高级动作，环境演化一个随机持续时间 (\kappa_k)，智能体在该期间接收累积奖励，然后做出下一个决策。

选项是构建此类时间扩展动作的标准框架[35]。选项 (\omega \in \Omega) 由三元组 ((\mathcal{I}_\omega, \pi_\omega(a|s), \beta_\omega(s))) 定义，其中 (\mathcal{I}_\omega \subseteq S) 是起始集（选项可能启动的状态），(\pi_\omega(a|s)) 是基本动作的选项内策略，(\beta_\omega(s) \in [0,1]) 是终止函数（选项到达状态 (s) 时终止的概率）。

选项策略 (\pi_\Omega(\omega|s)) 在状态 (s) 时选择启动哪个选项。我们采用调用-返回（call-and-return）选项执行模型[1]：智能体从初始选项 (\omega_0 \sim \pi_\Omega(\cdot|s_0)) 开始。当选项 (\omega) 激活时，采样基本动作 (a_t \sim \pi_\omega(\cdot|s_t))。每次转移到 (s_{t+1}) 后，以概率 (\beta_\omega(s_{t+1})) 终止选项。如果选项终止，采样新选项 (\omega_{t+1} \sim \pi_\Omega(\cdot|s_{t+1}))；否则继续使用同一选项。

### 2.2 MoE 路由与专家掩码

我们关注 MLP 块实现为 MoE 的 transformer 层，每层包含 (N) 个专家，共 (L) 层。对于层 (\ell) 中 token 位置 (t)，MoE 路由器产生 logits (g_t^{(\ell)} \in \mathbb{R}^N)，由此得到分布 (p_t^{(\ell)} = \text{softmax}(g_t^{(\ell)}))。在基础 MoE 路由器中，基于 (g_t^{(\ell)}) 选择稀疏的 top-(\tilde{k}) 专家集，专家输出与归一化路由权重 (p_t^{(\ell)}) 组合。

在我们的设定中，路由还受到二元专家掩码 (\omega_t^{(\ell)} \in \{0,1\}^N) 的约束，其中 (\omega_{t,i}^{(\ell)} = 1) 表示专家 (i) 在时间 (t)、层 (\ell) 中被允许。top-(\tilde{k}) 专家选择被限制在允许的专家集中。

这个二元专家掩码 (\omega_t^{(\ell)}) 就是我们设定中的选项。全文中，我们用 (\hat{k}) 表示专家掩码允许的专家数，用 (\tilde{k}) 表示激活的专家数。当 (\omega_t^{(\ell)} \neq \omega_{t-1}^{(\ell)}) 时，即专家掩码发生变化，我们说在 token 位置 (t)、层 (\ell) 发生了一次切换。

长度为 (T) 的生成序列的切换率为：

$$\frac{1}{L} \sum_{\ell=1}^{L} \frac{1}{T-1} \sum_{t=1}^{T-1} \mathbb{1}[\omega_t^{(\ell)} \neq \omega_{t-1}^{(\ell)}]$$

### 2.3 选项-评论架构

选项-评论架构[1]将策略梯度定理扩展到选项框架，允许同时优化选项内策略 (\pi_\omega) 和终止函数 (\beta_\omega)。

首先定义在状态-选项对 ((s,\omega)) 下执行动作 (a) 的值为：

$$Q_U(s, \omega, a) = r(s,a) + \gamma \sum_{s'} P(s'|s,a) U(\omega, s')$$

其中 (U(\omega, s')) 是在状态 (s') 下选项 (\omega) 激活的值：

$$U(\omega, s') = (1 - \beta_\omega(s')) Q_\Omega(s', \omega) + \beta_\omega(s') V_\Omega(s')$$

这里 (Q_\Omega(s, \omega) = \sum_a \pi_\omega(a|s) Q_U(s, \omega, a)) 是从状态 (s) 开始执行选项 (\omega) 的值，(V_\Omega(s) = \sum_\omega \pi_\Omega(\omega|s) Q_\Omega(s, \omega)) 是状态 (s) 的值。

选项-评论框架优化选项内策略参数 (\theta) 和终止函数参数 (\nu) 以最大化期望折扣回报。这通过以下两个定理实现：

**定理 1（选项内策略梯度定理，[1]的定理 1）**：给定一组具有随机选项内策略 (\pi_{\omega,\theta}) 的选项，期望折扣回报对 (\theta) 的梯度为：

$$\frac{\partial Q_\Omega(s_0, \omega_0)}{\partial \theta} = \sum_{s,\omega} \mu(s,\omega) \sum_a \frac{\partial \pi_\omega(a|s)}{\partial \theta} Q_U(s, \omega, a)$$

其中 (\mu(s,\omega)) 是从 ((s_0, \omega_0)) 开始的轨迹上状态-选项对的折扣加权。

**定理 2（终止梯度定理，[1]的定理 2）**：给定一组具有随机终止函数 (\beta_{\omega,\nu}) 的选项，期望回报对 (\nu) 的梯度为：

$$\frac{\partial Q_\Omega(s_0, \omega_0)}{\partial \nu} = -\sum_{s,\omega} \mu(s,\omega) \frac{\partial \beta_\omega(s)}{\partial \nu} (Q_\Omega(s, \omega) - V_\Omega(s))$$

直觉上，(Q_\Omega(s, \omega) - V_\Omega(s)) 是当前选项相对于切换到新选项期望值的优势。如果当前选项的值高于新选择选项的期望值，梯度更新会降低终止概率 (\beta_\omega(s))，从而延长当前选项的持续时间。

---

## 3 动机

### 3.1 当前混合专家 LLM 不是时间扩展的

我们首先展示当前 MoE 模型不是时间扩展的。我们测量了三个前沿开源 MoE 模型的切换率——gpt-oss-20b（32 专家，top-4）、gpt-oss-120b（128 专家，top-4）和 Qwen3-Next-80B-A3B（512 专家，top-10）——在 Nemotron 后训练数据集 v2 [26] 的 10 个类别中各 100 个提示上进行评估。对于每个提示，我们以温度 0.5 生成 256 个 token，记录每个 token 位置和每层的专家激活情况。

图 2 可视化了任意选定提示在层 0 的专家激活模式，其中 x 轴是 token 位置，y 轴是专家。我们可以看到，在所有三个模型中，专家选择几乎没有时间连续性，表 1 证实了这一点。

**表 1**：在 (\hat{k} = \tilde{k}) 下每个类别 100 个提示的平均切换率（均值 ± 标准差）。

| 模型 | Chat | Code | Math | STEM | Multi (en) | Multi (de) | Multi (es) | Multi (fr) | Multi (it) | Multi (ja) |
|---|---|---|---|---|---|---|---|---|---|---|
| gpt-oss-20b | 0.94±0.06 | 0.95±0.01 | 0.94±0.02 | 0.95±0.01 | 0.95±0.02 | 0.95±0.01 | 0.95±0.02 | 0.95±0.02 | 0.95±0.02 | 0.95±0.01 |
| gpt-oss-120b | 0.98±0.01 | 0.99±0.00 | 0.99±0.00 | 0.99±0.00 | 0.99±0.00 | 0.99±0.00 | 0.99±0.00 | 0.99±0.00 | 0.99±0.00 | 0.99±0.00 |
| Qwen3-Next-80B | 1.00±0.00 | 1.00±0.00 | 1.00±0.00 | 1.00±0.00 | 1.00±0.00 | 1.00±0.00 | 1.00±0.00 | 1.00±0.00 | 1.00±0.00 | 1.00±0.00 |

所有模型的平均切换率接近 1，几乎在每个 token 都在切换。

### 3.2 错失的机会

当前 MoE 路由中缺乏时间扩展导致模型整个生命周期中错失了优化机会。我们强调时间扩展专家选择可以解锁的三个机会：

**减少内存的推理服务。** 在自回归生成期间，标准 MoE 服务必须将每层所有 (N) 个专家保留在快速设备内存中（或准备好在每步获取其中任何一个），因为活跃专家集不是时间扩展的。当专家权重无法放入可用 GPU 时，系统会将专家卸载到主机内存并按需预取[40, 33]，但预测错误可能导致显著延迟。有了时间连续性，活跃专家集已知会持续多个连续 token，减少预取未命中的成本，并实现更简单、更可预测的服务策略。每层只有 (\hat{k}) 个活跃专家需要驻留在 GPU 上，专家交换仅偶尔发生。两次切换之间，推理以 (\hat{k}/N) 的专家内存占用运行。由于专家参数在现代 MoE 模型中占总参数的主导比例（例如在 gpt-oss-20b 中超过 96%），这直接转化为 GPU 内存需求的实质性减少。例如，对 gpt-oss-20b 仅保留 16 个专家（(\hat{k}=16)）可减少约 4.7 GiB（37%）的显存需求，8 个专家可减少约 7.1 GiB（55%）。

**通过时间分块的内存高效训练。** 类似的原则适用于训练阶段。在当前的 MoE 训练流水线中，所有专家参数在前向和反向传播期间必须可访问，因为序列中的任何 token 可能路由到任何专家。有了时间扩展路由，响应可以被分割为连续块，每块关联固定的专家掩码。在每个块内，只有当前掩码中的 (\hat{k}) 个专家参与前向和反向计算。这开辟了块级训练策略的可能性，其中非活跃专家在每个块的前向-反向传播期间被卸载，降低 GPU 峰值内存。

**可扩展专家容量的持续学习。** 时间扩展还为持续学习提供了自然路径。由于任何时候只有 (N) 个专家中的 (\hat{k}) 个是活跃的，可以向模型添加新专家而不增加每 token 计算量或活跃内存占用。当适应新领域或任务时，可以初始化新的专家模块，让控制器学习在有益时路由到它们。固定的活跃集大小（(\hat{k})）确保推理成本保持不变，无论添加了多少新专家。

---

## 4 方法

本节介绍我们实现 MoE transformer 中专家路由时间扩展控制的方法。如前所述，我们维护每层选项 (\omega_t^{(\ell)})——允许的 (\hat{k}) 个专家子集的专家掩码——并限制路由器仅从此集合中选择。我们实现了一个轻量级控制器，学习何时切换以及切换到哪个新专家掩码，同时通过选项内策略更新微调 MoE 模型参数。

**图 3**：控制器与 MoE 层的集成。控制器观察 LLM 隐藏状态 (h_t^{(\ell)}) 和当前选项 (\omega_{t-1}^{(\ell)})，输出新的专家掩码 (\omega_t^{(\ell)})，限制 top-(\tilde{k}) 路由可以选择的专家。灰色专家被掩码排除。

### 4.1 专家掩码控制的选项形式化

对于每层 (\ell)，选项空间是专家可能掩码的组合：

$$\Omega^{(\ell)} = \{\omega \in \{0,1\}^N : \|\omega\|_1 = \hat{k}\} \tag{1}$$

我们的控制器实现调用-返回执行，活跃选项 (\omega^{(\ell)}) 跨 token 持续，直到终止决策 (d_t^{(\ell)} = 1) 触发新选项的选择。执行期间，路由器被限制仅从活跃选项中的专家选择，通过在 top-(\tilde{k}) 操作之前将所有其他专家的 logits 掩码为 (-\infty)。

原则上，可以将联合掩码 (\omega_t = (\omega_t^{(1)}, \ldots, \omega_t^{(L)})) 视为单个选项并学习跨所有层的联合终止和选择策略。但我们将控制器分解为 (L) 个独立的逐层控制器以保证可处理性，每个控制器以各自层的隐藏状态和当前掩码为条件。这是联合 s-MDP 的近似：每层控制器将网络其余部分视为环境的一部分，同时共享相同的 token 级奖励。尽管存在近似，它在实践中训练稳定，并实现了良好的性能和大幅的切换率降低。

### 4.2 控制器架构

每个 MoE MLP 层 (\ell) 有自己的控制器模块，架构相同但参数独立。在 token (t)、层 (\ell)，(p_t^{(\ell)}) 是路由器 logits 的 softmax，(\omega_{t-1}^{(\ell)}) 是上一步的活跃专家掩码。控制器直接操作 LLM 预 MLP 隐藏表示 (h_t^{(\ell)})，即将 (h_t^{(\ell)}) 视为状态 (s)。

**专家集嵌入。** 每个选项 (\omega) 是一个专家掩码。为了获得专家掩码的更丰富表示，我们使用 DeepSets 编码器[41]：

$$z^{(\ell)}(\omega) = \frac{1}{\hat{k}} \sum_{i \in \omega} \phi(e_i) \tag{2}$$

其中 (e_i \in \mathbb{R}^{d_e}) 是专家 (i) 的可学习嵌入，(\phi: \mathbb{R}^{d_e} \to \mathbb{R}^{d_c}) 是具有 GELU 激活的两层 MLP。每层有独立的编码器。

**终止头。** 终止决策 (\beta_t^{(\ell)}) 取决于 LLM 状态 (h_t^{(\ell)}) 和当前选项 (\omega_{t-1}^{(\ell)})：

$$\beta_t^{(\ell)} = \sigma\big(\text{MLP}_\beta[\text{concat}(\bar{h}_t^{(\ell)}, \bar{z}^{(\ell)}(\omega_{t-1}^{(\ell)}))]\big) \tag{3}$$

其中 (\bar{h}_t^{(\ell)} = \text{RMSNorm}(h_t^{(\ell)}))，(\bar{z}^{(\ell)} = \text{RMSNorm}(z^{(\ell)})) 平衡两个表示的尺度，(\text{MLP}_\beta) 是具有 ReLU 激活的两层 MLP，(\sigma) 是 sigmoid 函数。切换决策采样为 (d_t^{(\ell)} \sim \text{Bernoulli}(\beta_t^{(\ell)}))。

**值和选项值头。** 状态值函数为线性头 (V_\Omega(h_t^{(\ell)}) = w_V^\top h_t^{(\ell)} + b_V)。选项值函数为：

$$Q_\Omega(h_t^{(\ell)}, \omega) = \text{MLP}_Q[\text{concat}(\bar{h}_t^{(\ell)}, \bar{z}^{(\ell)}(\omega))] \tag{4}$$

其中 (\bar{h}_t^{(\ell)} = \text{RMSNorm}(h_t^{(\ell)}))，(\bar{z}^{(\ell)} = \text{RMSNorm}(z^{(\ell)}))，(\text{MLP}_Q) 是具有 ReLU 激活的两层 MLP。

**选项选择头。** 当 (d_t^{(\ell)} = 1) 时，必须选择新选项。我们使用选择头 (f_{\text{sel}}^{(\ell)}: \mathbb{R}^d \to \mathbb{R}^N)，一个从路由器权重初始化的线性层，产生候选 logits (c_t^{(\ell)} = f_{\text{sel}}(h_t^{(\ell)}))。我们使用 Plackett-Luce (PL) 分布采样 (\hat{k}) 个专家，该分布通过无放回的顺序采样定义有序选择 ((i_1, \ldots, i_{\hat{k}})) 的概率：

$$P_{\text{PL}}(i_1, \ldots, i_{\hat{k}} | c) = \prod_{j=1}^{\hat{k}} \frac{\exp(c_{i_j})}{\sum_{m \notin \{i_1, \ldots, i_{j-1}\}} \exp(c_m)} \tag{5}$$

记诱导分布为 (\pi_{\text{sel}}(\omega|h))。实际实现中，顺序采样较慢，我们通过 Gumbel-top-(\hat{k}) 技巧进行采样：向 (c_t^{(\ell)}) 添加独立同分布的 Gumbel(0,1) 噪声，取扰动 logits 的 top-(\hat{k}) 索引，这在数学上等价但完全向量化。新选项为 (\omega_t^{(\ell)} = \{i_1, \ldots, i_{\hat{k}}\})。

**初始化。** 在 (t=0) 时，初始选项设为路由器 logits 下的 top-(\hat{k}) 专家。切换决策强制为 (d_0^{(\ell)} = 0)。

### 4.3 控制器训练

我们将 MoE 模型中非控制器参数视为选项内策略。使用带有审议成本[14]的选项-评论框架和逐 token 稠密奖励来训练控制器和 MoE 模型。

**奖励设计。** 我们的目标是将预训练 MoE 转换为时间扩展 MoE，同时保持其原有的质量和性能。因此我们遵循[23]，使用逐 token 反向 KL 散度作为逐 token 奖励——即在相同先验轨迹条件下学生分布和教师分布之间的散度。教师是原始冻结的 MoE 模型（无控制器和权重更新），学生是我们训练的模型。

$$r_t = \log p_{\text{teacher}}(a_t | x, a_{<t}) - \log p_{\text{student}}(a_t | x, a_{<t}) \tag{6}$$

其中 (a_t) 是步骤 (t) 生成的 token。注意，在学生采样分布的期望下，(-r_t) 是反向 KL 散度 (\text{KL}(p_{\text{student}} \| p_{\text{teacher}})) 的无偏估计。

为避免训练模型生成退化和重复输出（低反向 KL），我们按照[13]从学生和教师分布的混合中采样 token：

$$p_{\text{mix}} = (1-\tau) p_{\text{student}} + \tau p_{\text{teacher}} \tag{7}$$

并在策略梯度中应用近似重要性权重 (w_t = p_{\text{student}}(a_t | x, a_{<t}) / p_{\text{mix}}(a_t | x, a_{<t})) 来纠正离策略采样。

**梯度更新。** 训练过程遵循[14]的 A2OC 算法并适配我们的设定。

对于评论家学习，我们使用 GAE((\lambda))[31] 目标最小化平方 TD 误差来学习 (V_\Omega) 和 (Q_\Omega)。对于 (V_\Omega)，token (t)、层 (\ell) 的 TD 误差为 (\delta_t^V = r_t + \gamma V_\Omega(h_{t+1}^{(\ell)}) - V_\Omega(h_t^{(\ell)}))。对于 (Q_\Omega)，我们使用 (U(\omega, s')) 进行自举：(\delta_t^Q = r_t + \gamma U(\omega_t^{(\ell)}, h_{t+1}^{(\ell)}) - Q_\Omega(h_t^{(\ell)}, \omega_t^{(\ell)}))。

对于选项内策略更新，我们应用定理 1 更新选项内策略参数 (\theta)（专家和路由器参数）。使用对数导数技巧，定理 1 的梯度可以写为：

$$\mathbb{E}_{(s,\omega) \sim \mu, a \sim \pi_{\omega,\theta}} \left[\frac{\partial \log \pi_\omega(a|s)}{\partial \theta} Q_U(s, \omega, a)\right] \tag{8}$$

实践中，我们用蒙特卡洛回报 (\bar{G}_t = \sum_{j \geq 0} \gamma^j r_{t+j}) 估计 (Q_U(s, \omega, a))。

对于终止梯度更新，我们按照[14]将审议成本 (\eta) 加入定理 2：

$$-\sum_{s,\omega} \mu(s,\omega) \frac{\partial \beta_\omega(s)}{\partial \nu} (Q_\Omega(s, \omega) - V_\Omega(s) + \eta) \tag{9}$$

其中 (\mu(s,\omega)) 是定理 1 中定义的折扣状态-选项访问分布。(\eta) 作为边界，使得只有当当前选项足够劣于替代选项以克服审议成本时，终止才被偏好。

对于选项选择头，仅在发生切换时更新。当 (d_t^{(\ell)} = 1) 时，使用策略梯度更新选择头参数 (\phi)：

$$\sum_{s,\omega} \mu(s,\omega) \nabla_\phi \log \pi_{\text{sel}}(\omega | h) (Q_\Omega(s, \omega) - V_\Omega(s)) \tag{10}$$

算法 1 给出了高层版本的算法。

**算法 1：MoE 选项-评论训练（高层）**

> **输入**：具有 (L) 层、每层 (N) 个专家、top-(\tilde{k}) 路由的 MoE 模型；提示数据集 (D)；教师模型 (p_{\text{teacher}})；教师混合系数 (\tau)；折扣 (\gamma)；GAE 参数 (\lambda)；审议成本 (\eta)；学习率 (\alpha_{\text{controller}})、(\alpha_{\text{intra}})。用 (\theta) 表示 LLM 参数，(\nu) 表示终止头，(\psi) 表示评论家参数（包括 (V_\Omega) 和 (Q_\Omega)），(\phi) 表示选项选择头参数。
> 
> 1. 对每个训练迭代：
> 2.　采样提示 (x \sim D)；
> 3.　对每层 (\ell)，初始化 (\omega_0^{(\ell)} \leftarrow \text{TopK}(g_0^{(\ell)}, \hat{k}))；
> 4.　对 (t = 1, \ldots, T)：
> 5.　　对每层 (\ell)：
> 6.　　　从隐藏状态 (h_t^{(\ell)}) 和当前选项 (\omega_{t-1}^{(\ell)}) 计算终止概率 (\beta_t^{(\ell)})；
> 7.　　　采样 (d_t^{(\ell)} \sim \text{Bernoulli}(\beta_t^{(\ell)}))；
> 8.　　　如果 (d_t^{(\ell)} = 1)，通过 Plackett-Luce 采样 (\hat{k}) 个专家选择新选项 (\omega_t^{(\ell)})；
> 9.　　　否则保持 (\omega_t^{(\ell)} \leftarrow \omega_{t-1}^{(\ell)})；
> 10.　　　将路由器掩码为 (\omega_t^{(\ell)}) 中的专家；
> 11.　　　采样 token (a_t \sim p_{\text{mix}} = (1-\tau)\pi_{\omega,\theta} + \tau p_{\text{teacher}})；
> 12.　　　记录重要性权重 (w_t \leftarrow \pi_{\omega,\theta}(a_t) / p_{\text{mix}}(a_t)) 和奖励 (r_t)；
> 13.　对每层 (\ell)：
> 14.　　使用 (V_\Omega, Q_\Omega) 和 (r_t) 计算 GAE((\lambda)) 目标 (\hat{V}_{\text{targ}}^t, \hat{Q}_{\text{targ}}^t)；
> 15.　　对 (t = 1, \ldots, T)：
> 16.　　　累积终止梯度：(d_\nu^- = w_t \nabla_\nu \beta_t^{(\ell)} (Q_\Omega(h_t^{(\ell)}, \omega_{t-1}^{(\ell)}) - V_\Omega(h_t^{(\ell)}) + \eta))；
> 17.　　　累积选择梯度（当 (d_t^{(\ell)} = 1) 时）：(d_\phi^+ = w_t \nabla_\phi \log \pi_{\text{sel}}(\omega_t^{(\ell)}) (Q_\Omega(h_t^{(\ell)}, \omega_t^{(\ell)}) - V_\Omega(h_t^{(\ell)})))；
> 18.　　　累积评论家损失：(d_\psi^- = \nabla_\psi [(V_\Omega - \hat{V}_{\text{targ}}^t)^2 + (Q_\Omega - \hat{Q}_{\text{targ}}^t)^2])；
> 19.　对 (t = 1, \ldots, T)：
> 20.　　计算折扣回报 (\bar{G}_t = \sum_{j \geq 0} \gamma^j r_{t+j})；
> 21.　　(d_\theta^+ = w_t \nabla_\theta \log \pi_{\omega,\theta}(a_t) \cdot \bar{G}_t)；
> 22.　((\nu, \psi, \phi) \leftarrow (\nu, \psi, \phi) + \frac{\alpha_{\text{ctrl}}}{L}(d_\nu, d_\psi, d_\phi))；(\theta \leftarrow \theta + \alpha_{\text{intra}} d_\theta)；

---

## 5 实验

### 训练细节

所有实验在 gpt-oss-20b [27] 上进行，这是一个具有 24 个 transformer 层、每层 32 个专家、top-4 路由（(\tilde{k}=4)）的混合专家 LLM。模型原生使用 MXFP4 量化，训练时反量化为 bf16。在 4× NVIDIA 140GB H200 GPU 上训练，使用修改版的 TRL 库[37]。

训练超参数：折扣因子 (\gamma = 0.95)，GAE 参数 (\lambda = 0.95)，值损失系数 0.01。控制器学习率 (\alpha_{\text{controller}} = 10^{-4})（AdamW）。选项内策略更新对专家参数和注意力参数应用 LoRA [18]（rank (r=16)，(\alpha=16)）。路由器权重也可训练。选项内策略学习率 (\alpha_{\text{intra}} = 2 \times 10^{-4})。每个训练步使用 16 个提示，最大提示长度 512 token，最大响应长度 512 token。token 生成使用温度 1.0，Top-(p=0.95)。教师混合比率 (\tau=0.2)。

### 数据集和基准

训练使用 Nemotron 后训练数据集 v2 [26]，包含 10 个类别的提示：chat、code、math、STEM 和多语言（英语、德语、西班牙语、法语、意大利语、日语）。评估在 MATH 数据集 [17]、MMLU 和 MMMLU [16] 各随机选取 200 个问题上进行。所有评估使用温度 0.5、Top-(p=0.95)、最大响应长度 2048 token。随机种子为 42。

### 基线

与四种剪枝基线比较：频率选择、重建损失最小化 [24]、随机选择和 Wanda（结构化）[34]。所有基线使用 128 个提示作为校准集。

**表 2：(\hat{k}=16) 下的准确率（%，均值 ± 95% CI）和切换率（%，均值 ± 95% CI）。**

| | 我们的方法（学习控制器） | | | 基线模型 | 频率 | 重建 | 随机 | Wanda |
|---|---|---|---|---|---|---|---|---|
| | (\eta=0.02) | (\eta=0.03) | (\eta=0.04) | | | | | |
| MATH | 71.5±5.9 | 64.0±6.7 | 58.5±6.9 | 55.0±6.9 | 15.0±4.9 | 3.5±2.5 | 53.5±6.9 | 51.5±6.9 |
| 切换% | 58.6±0.51 | 79.0±0.39 | 9.2±0.14 | 7.4±0.12 | 5.4±0.10 | 1.3±0.02 | 4.1±0.02 | 1.2±0.02 |
| MMLU | 79.5±5.7 | 72.5±6.3 | 67.5±6.5 | 63.0±6.7 | 9.0±3.9 | 48.5±6.1 | 55.5±6.9 | 35.0±6.7 |
| 切换% | 57.1±0.53 | 77.4±0.45 | 8.5±0.10 | 5.0±0.06 | 7.6±0.08 | 1.3±0.02 | 4.2±0.02 | 1.2±0.02 |
| MMMLU | 67.5±6.5 | 59.5±6.9 | 56.5±6.9 | 49.5±6.9 | 7.0±3.5 | 39.0±6.5 | 42.0±6.9 | 48.0±6.9 |
| 切换% | 54.5±0.51 | 75.5±0.43 | 9.0±0.14 | 5.4±0.08 | 8.0±0.10 | 1.4±0.02 | 4.2±0.02 | 1.2±0.02 |

**表 3：(\hat{k}=8) 下的准确率（%，均值 ± 95% CI）和切换率（%，均值 ± 95% CI）。**

| | 我们的方法（学习控制器） | | | 基线模型 | 频率 | 重建 | 随机 | Wanda |
|---|---|---|---|---|---|---|---|---|
| | (\eta=0.02) | (\eta=0.03) | (\eta=0.04) | | | | | |
| MATH | 71.5±5.9 | 27.5±6.1 | 23.0±5.9 | 15.5±4.9 | 0.0±0.0 | 0.0±0.0 | 11.5±4.3 | 7.5±3.5 |
| 切换% | 79.0±0.39 | 9.2±0.14 | 7.4±0.12 | 5.4±0.10 | 9.2±0.14 | 7.4±0.12 | 5.4±0.10 | 7.4±0.12 |
| MMLU | 79.5±5.7 | 48.5±6.9 | 41.0±6.9 | 38.0±6.7 | 0.0±0.0 | 12.5±4.5 | 2.5±2.2 | 4.0±2.7 |
| 切换% | 77.4±0.45 | 8.5±0.10 | 5.0±0.06 | 5.0±0.06 | 8.5±0.10 | 7.6±0.08 | 8.5±0.10 | 5.0±0.06 |
| MMMLU | 67.5±6.5 | 39.0±6.5 | 31.5±6.3 | 22.5±5.9 | 0.0±0.0 | 8.5±3.9 | 1.0±1.4 | 3.0±2.4 |
| 切换% | 75.5±0.43 | 9.0±0.14 | 5.4±0.08 | 5.4±0.08 | 9.0±0.14 | 8.0±0.10 | 9.0±0.14 | 5.4±0.08 |

### 训练动态

我们使用不同的审议成本 (\eta \in \{0.02, 0.03, 0.04\}) 和专家预算 (\hat{k} \in \{8, 16\}) 训练控制器。训练曲线如图 5 所示。在不同配置下，奖励在训练期间稳步增加，(\hat{k}=8) 时增益更显著。切换率初始下降（随着值网络 (V_\Omega)、(Q_\Omega) 学习）并逐渐稳定在由 (\eta) 决定的水平，更高的审议成本产生更低的收敛切换率。困惑度在整个训练过程中也在下降，(\hat{k}=8) 时改善更明显。

### 基准评估

对于 (\hat{k}=8)，评估第 300 步的检查点。对于 (\hat{k}=16)，评估第 120 步的检查点。在 (\hat{k}=16)、(\eta=0.02) 下，我们的控制器达到接近未剪枝基线模型的准确率，并在所有基准上大幅优于所有基线。性能展示了与审议成本和掩码大小 (\hat{k}) 相称的权衡。这一权衡可能通过完整的后训练运行得到改善，并可以通过审议成本进行校准。

### 控制器下的时间连续性

作为与图 2 的直接对比，我们绘制了 gpt-oss-20b 在训练后控制器下（(\eta=0.02)）的选项（即专家掩码），使用第 3 节中相同的提示。

---

## 6 讨论与结论

本文引入了时间扩展 MoE 模型的概念，并提出了一个使用选项框架解决动态专家加载的框架。我们的方法有效地平衡了生成质量与专家集传输的延迟成本。我们的发现还指出了一个有希望的未来方向：以时间扩展的方式设计 MoE 架构，将其作为后训练甚至预训练期间的核心目标。开发这种本质上的时间扩展 MoE 模型可能为内存高效服务和持续学习开辟道路。

---

## 附录

### A1 相关工作

**混合专家模型。** MoE 架构已成为 LLM 扩展容量的主导范式。最近的进展已转向高稀疏性方向，即专家总数远超每层活跃专家数。例如[27]每层 128 个专家但每个 token 只激活 4 个；[30]每层 512 个专家但只激活 10 个（加一个共享专家）。MoE 架构在扩散模型中也日益流行，从文本到图像模型如 SDXL [28]、ERNIE-ViLG 2.0 [10] 和 eDIFF-I [2]，到最近的视频生成模型如 Wan2.2 [38]。

**MoE 效率。** 多项工作旨在通过剪枝、缓存/预取和卸载感知服务提高 MoE 效率。剪枝方面，[25] 提出两阶段方法，通过频率计数剪枝专家总数然后微调恢复准确率。[24] 最小化重建损失，选择最佳重建原始层输出的专家子集。[22] 引入 EEP，使用无梯度进化策略剪枝和合并专家。[39] 设计了结合路由器权重信息的剪枝指标。缓存/预取和卸载感知服务方面，[40] 提出 MoE-infinity，将专家卸载到主机内存。[33] 提出 ProMoE，使用激活预测即将需要的专家。[36] 展示跨层和相似提示间专家需求的相关性，提出 eMoE。[42] 引入 DuoServe-MoE。这些工作通常不研究延迟成本与生成质量的权衡。

**选项、s-MDP 与层次化 RL。** 我们将专家掩码选择形式化为时间扩展控制问题。[35] 形式化了选项框架。[1] 推导了选项的策略梯度定理并提出了选项-评论架构。[14] 指出选项框架在存在审议成本时最有用，提出了带审议成本的选项-评论变体。[20] 重新审视了深度强化学习中的选项内学习。近期还有工作将选项框架或层次化 RL 用于训练语言模型，如[4]将 token 序列视为宏动作并纳入 RLHF，[7] 提出基于 GRPO 的层次化 RL 方法用于推理，[21] 提出"内部 RL"框架。

### A2 额外实现细节

**完整算法。** 完整训练过程见算法 2。

**控制器架构细节。** 每个 MoE 层有独立控制器。DeepSets 专家集编码器使用嵌入维度 (d_e = 128) 和具有 GELU 激活、隐藏维度 1024 的两层 MLP。终止头、选项值头 (Q_\Omega) 和专家选择头都使用隐藏维度 1024。状态值头 (V_\Omega) 是从路由器权重初始化的单线性层。终止头偏置初始化为 (-3)（对应初始切换概率 (\sigma(-3) \approx 0.05)，从一开始就鼓励时间连续性）。RMSNorm 在拼接前应用于平衡 (h_t^{(\ell)}) 和 (z_t^{(\ell)}) 的尺度。

**优势归一化。** 对于终止梯度，原始优势为 (A_t^{\text{term},\ell} = Q_\Omega(h_t^{(\ell)}, \omega_{t-1}^{(\ell)}) - V_\Omega(h_t^{(\ell)}) + \eta)。我们在每层 (\ell) 内对所有时间步 (t > 0) 独立应用 RMS 归一化（不进行均值中心化）：

$$\hat{A}_t^{\text{term},\ell} = \frac{A_t^{\text{term},\ell}}{\text{RMS}(A^{\text{term},\ell})}$$

其中 (\text{RMS}(A^{\text{term},\ell}) = \sqrt{\frac{1}{T-1} \sum_{t=1}^{T-1} (A_t^{\text{term},\ell})^2})。

---

## 参考文献

[1] Bacon, P.-L., Harb, J., & Precup, D. The option-critic architecture, 2016.

[2] Balaji, Y. et al. ediff-i: Text-to-image diffusion models with an ensemble of expert denoisers, 2023.

[3] Cai, W. et al. A survey on mixture of experts in large language models. IEEE TKDE, 2025.

[4] Chai, Y. et al. Ma-rlhf: RLHF with macro actions, 2025.

[5] Clark, A. et al. Unified scaling laws for routed language models. ICML, 2022.

[6] DeepSeek-AI et al. DeepSeek-V3 technical report, 2025.

[7] Di, X. & Jiao, W. Enhancing math reasoning via preview difficulty-aware intervention, 2025.

[8] Eliseev, A. & Mazur, D. Fast inference of MoE LLMs with offloading, 2023.

[9] Fedus, W., Zoph, B., & Shazeer, N. Switch transformers, 2022.

[10] Feng, Z. et al. ERNIE-ViLG 2.0, 2023.

[11] Gemini-Team. Gemini 2.5, 2025.

[12] GLM-5-Team et al. GLM-5: From vibe coding to agentic engineering, 2026.

[13] Gu, Y. et al. MiniLLM: On-policy distillation of large language models, 2026.

[14] Harb, J. et al. When waiting is not an option: Learning options with deliberation cost, 2017.

[15] He, X.O. Mixture of a million experts, 2024.

[16] Hendrycks, D. et al. Measuring massive multitask language understanding, 2021.

[17] Hendrycks, D. et al. Measuring mathematical problem solving with the math dataset, 2021.

[18] Hu, E.J. et al. LoRA: Low-rank adaptation of large language models, 2021.

[19] Jiang, A.Q. et al. Mixtral of experts, 2024.

[20] Klissarov, M. & Precup, D. Flexible option learning, 2021.

[21] Kobayashi, S. et al. Emergent temporal abstractions in autoregressive models, 2025.

[22] Liu, E. et al. Efficient expert pruning for sparse MoE LLMs, 2024.

[23] Lu, K. On-policy distillation, 2025.

[24] Lu, X. et al. Not all experts are equal: Efficient expert pruning and skipping, 2024.

[25] Muzio, A., Sun, A., & He, C. Seer-moe, 2024.

[26] Nathawani, D. et al. Nemotron-Post-Training-Dataset-v2, 2025.

[27] OpenAI et al. gpt-oss-120b and gpt-oss-20b model card, 2025.

[28] Podell, D. et al. SDXL, 2023.

[29] Qwen Team. Qwen3.5, 2026.

[30] Qwen Team. Qwen3-Next, 2025.

[31] Schulman, J. et al. High-dimensional continuous control using GAE, 2018.

[32] Shazeer, N. et al. Outrageously large neural networks: Sparsely-gated MoE layer, 2017.

[33] Song, X. et al. ProMoE: Fast MoE serving using proactive caching, 2025.

[34] Sun, M. et al. A simple and effective pruning approach for LLMs (Wanda), 2024.

[35] Sutton, R.S., Precup, D., & Singh, S. Between MDPs and semi-MDPs: A framework for temporal abstraction in RL. AI, 1999.

[36] Tairin, S. et al. eMoE: Task-aware memory efficient MoE inference, 2025.

[37] von Werra, L. et al. TRL: Transformers Reinforcement Learning, 2020.

[38] Wan Team et al. Wan: Open and advanced large-scale video generative models, 2025.

[39] Xie, Y. et al. MoE-pruner, 2024.

[40] Xue, L. et al. MoE-infinity: Efficient MoE inference with sparsity-aware expert cache, 2025.

[41] DeepSets encoder (Zaheer et al.), referenced as [41].

[42] DuoServe-MoE (Xue et al.), referenced as [42].
