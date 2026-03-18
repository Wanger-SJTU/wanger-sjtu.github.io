---
title: 推理LLM的强化学习现状
date: 2026-03-18 12:20:00
tags:
  - LLM
  - 强化学习
  - 深度学习
  - AI研究
categories:
  - 技术翻译
toc: true
---

> **原文**: [State of RL for reasoning LLMs](https://aweers.de/blog/2026/rl-for-llms/) by [aweers](https://x.com/a_weers)
>
> **翻译说明**: 本文翻译自 aweers 的技术博客，系统梳理了 2024-2026 年间推理 LLM 强化学习领域的重大发展。文章从基础算法（REINFORCE、PPO）讲起，逐步深入到 GRPO 及后续改进方法，内容详实且结构清晰，是了解该领域最新进展的绝佳资料。


## 引言

强化学习已成为 LLM 后训练栈中最重要的发展之一。它是将 GPT-3 转化为 InstructGPT 的关键要素 [1]，也是当前推理能力提升浪潮的核心 [2][3]。

第一代 LLM 强化学习以 PPO [4] 为主，这是为 Atari 游戏和机器人等传统 RL 场景开发的方法，但在 RLHF 中取得了巨大成功。

第二代方法以提高推理能力为目标，带来了新一轮算法改进。短时间内出现了大量变体，大多数与前辈相比只有微小但关键的区别。

本文将紧凑概述推理 LLM 强化学习的主要发展（2024-2026）。从基础（REINFORCE 和 PPO）开始，然后覆盖 GRPO 及后续改进方法。

## RL 简要介绍

在标准 RL 设置中，智能体观察状态 <script type="math/tex">s_t</script>，根据策略 <script type="math/tex">\pi(a_t \mid s_t)</script> 选择动作 <script type="math/tex">a_t</script>，根据环境动态 <script type="math/tex">p(s_{t+1} \mid s_t, a_t)</script> 转移到新状态 <script type="math/tex">s_{t+1}</script>，并接收奖励 <script type="math/tex">r_t</script>。

具体例子是机器人在房间中导航：状态是当前位置和传感器读数，动作是移动命令，转移动态由物理规律控制（轮子可能打滑），奖励反映向目标的进展。

这个循环重复 <script type="math/tex">T</script> 个时间步。智能体目标是最大化期望折扣回报：

<script type="math/tex; mode=display"> J = \mathbb{E}\left[\sum_{t=0}^{T} \gamma^t r_t\right] </script>

其中折扣因子 <script type="math/tex">0 \leq \gamma \leq 1</script> 控制未来奖励的折扣程度。

策略通常由 <script type="math/tex">\theta</script> 参数化。许多 RL 算法的核心对象是价值函数：

<script type="math/tex; mode=display"> V^\pi(s) = \mathbb{E}_\pi\left[\sum_{l=0}^{T-t} \gamma^l r_{t+l} \mid s_t = s\right], </script>

它衡量在策略 <script type="math/tex">\pi</script> 下状态 <script type="math/tex">s</script> 的好坏。由此可以推导出优势（advantages），估计某个动作比预期更好还是更差。

对于 LLM，设置通常大幅简化。我们有一个参数化模型 <script type="math/tex">\pi_\theta</script> 对提示词 <script type="math/tex">x \sim \mathcal{D}</script> 采样响应 <script type="math/tex">y \sim \pi_\theta(\cdot|x)</script>，我们用标量奖励 <script type="math/tex">r(x, y)</script> 评分。目标变为：

<script type="math/tex; mode=display"> J(\theta) = \mathbb{E}_{x \sim \mathcal{D},\, y \sim \pi_\theta(\cdot|x)}\left[r(x, y)\right] </script>

仍然可以将此环境建模为状态是（提示词 + 之前生成的 token）而动作是下一个 token。但实际上，通常无法为单个 token 分配有意义的奖励，只能为给定提示词的完整响应提供一个奖励。除了最后一个 token 外所有 token 的奖励为零，使设置不必要地复杂化。

## REINFORCE

我们从 REINFORCE [5] 开始，因为它概念简单且是所有策略梯度方法的基础。

最简单形式的 REINFORCE 目标是：

<script type="math/tex; mode=display"> J(\theta) = \mathbb{E}_{y \sim \pi_\theta(\cdot \mid x)}\left[r(x, y)\right] </script>

该目标的梯度有简单且可解释的形式：

<script type="math/tex; mode=display"> \nabla_\theta J(\theta) = \mathbb{E}_{y \sim \pi_\theta(\cdot \mid x)}\left[\nabla_\theta \log \pi_\theta(y \mid x) \cdot r(x, y)\right] </script>

对比监督微调的梯度：

<script type="math/tex; mode=display"> \nabla_\theta L_{\text{SFT}}(\theta) = -\nabla_\theta \log \pi_\theta(y^* \mid x) </script>

（注意 SFT 损失最小化，而 RL 目标最大化）

这个比较揭示了 REINFORCE 本质上是加权形式的 SFT。不是强化提供的离策略答案 <script type="math/tex">y^*</script>，而是根据奖励加权强化或惩罚采样的在策略答案 <script type="math/tex">y</script>。

REINFORCE 的主要缺点是方差。即使奖励相对结构化（例如大型测试套件，每个测试贡献部分奖励），梯度估计在样本间也可能大幅变化。

为了减少方差，REINFORCE 减去一个不依赖于采样动作（响应）的基线 <script type="math/tex">b(x)</script>。这使期望梯度不变，因为：

<script type="math/tex; mode=display"> \mathbb{E}_{y \sim \pi_\theta(\cdot \mid x)}\left[\nabla_\theta \log \pi_\theta(y \mid x)\, b(x)\right] = 0, </script>

同时通常大幅减少方差。梯度变为：

<script type="math/tex; mode=display"> \nabla_\theta J(\theta) = \mathbb{E}_{y \sim \pi_\theta(\cdot \mid x)}\left[\nabla_\theta \log \pi_\theta(y \mid x)\, \bigl(r(x,y)-b(x)\bigr)\right]. </script>

量 <script type="math/tex">r(x,y)-b(x)</script> 是优势估计的最简单形式。

## PPO

PPO（Proximal Policy Optimization）[4] 成为主导的通用策略梯度算法，多年来是 RLHF 的默认选择。

PPO 目标通常以看似复杂的形式呈现：

<script type="math/tex; mode=display"> J^{\text{PPO}}(\theta) = \mathbb{E}_t\left[\min\left(\rho_t(\theta)\hat{A}_t,\; \operatorname{clip}(\rho_t(\theta), 1-\epsilon, 1+\epsilon)\hat{A}_t\right)\right], </script>

其中：

<script type="math/tex; mode=display"> \rho_t(\theta) = \frac{\pi_\theta(a_t \mid s_t)}{\pi_{\theta_{\text{old}}}(a_t \mid s_t)} </script>

是当前策略 <script type="math/tex">\pi_\theta</script> 与生成轨迹的策略 <script type="math/tex">\pi_{\theta_\text{old}}</script> 之间的重要性采样（IS）比率。

可能会问："对于在策略 RL 这不应该总是 1 吗？"答案是肯定的，但仅在生成轨迹后的第一个优化器步骤时成立。

需要这个比率是因为生成轨迹成本高。实际上，通常将一批生成的数据重用于多个 minibatch 更新或多个 epoch。第一个优化器步骤后，训练策略不再与生成策略完全相同，所以 PPO 变得略微离策略。比率修正这种不匹配，裁剪限制优化可以偏离生成策略多远。这是 PPO 对信任区域的近似 [6]。

注意裁剪不仅影响目标值，更重要的是影响其对 <script type="math/tex">\theta</script> 的依赖。由于我们优化 <script type="math/tex">\theta</script> 以最大化 <script type="math/tex">J</script>，裁剪情况产生零梯度，因为学习的策略不再参与方程。这些情况的更新被跳过，因为已移出信任区域。

裁剪处理四种场景：

| | 未裁剪 | 裁剪 |
|---|---|---|
| **正优势**（好答案，强化） | <script type="math/tex">\rho_t(\theta)\hat{A}_t</script>：答案好且未过度更新 | <script type="math/tex">(1+\epsilon)\hat{A}_t</script>：答案已足够可能，梯度停止 |
| **负优势**（坏答案，抑制） | <script type="math/tex">\rho_t(\theta)\hat{A}_t</script>：答案坏且未过度更新 | <script type="math/tex">(1-\epsilon)\hat{A}_t</script>：答案已足够不可能，梯度停止 |

也可以将此裁剪表示为掩码：

<script type="math/tex; mode=display"> M(\hat{A}_t, \rho_t, \epsilon) = \begin{cases} 0 & \text{if } (\hat{A}_t > 0 \land \rho_t > 1 + \epsilon) \lor (\hat{A}_t < 0 \land \rho_t < 1 - \epsilon) \\ 1 & \text{otherwise} \end{cases} </script>

用这个公式，目标简化为：

<script type="math/tex; mode=display"> J^{\text{PPO}}(\theta) = \mathbb{E}_t\left[M(\hat{A}_t,\rho_t(\theta),\epsilon)\,\rho_t(\theta)\,\hat{A}_t\right]. </script>

所以，PPO 本质上是带信任区域掩码的重要性加权策略梯度。

对于优势估计，PPO 使用广义优势估计器（GAE）：

<script type="math/tex; mode=display"> \hat{A}_t = \sum_{l=0}^{\infty} (\gamma \lambda)^l \delta_{t+l} </script>

计算 <script type="math/tex">\delta</script> 需要学习价值函数。在 LLM 设置中，这通常需要额外的价值模型，通常与策略模型大小相当。这在内存上成本高且增加训练复杂性。我们不会在本文中详细检查 GAE，因为移除此组件是 GRPO 的主要实际贡献。有关 PPO 及其所有组件的深入解释，请参阅这篇[详细文章](https://huggingface.co/blog/NormalUhr/rlhf-pipeline)。

最后，PPO 目标通常与 KL 正则化结合：

<script type="math/tex; mode=display"> J^{\text{PPO-KL}}(\theta) = \mathbb{E}_t\left[M(\hat{A}_t,\rho_t,\epsilon)\rho_t(\theta)\hat{A}_t\right] - \beta\, D_{\text{KL}}(\pi_\theta \,\|\, \pi_{\text{ref}}). </script>

这里 <script type="math/tex">\pi_{\text{ref}}</script> 通常是 RL 训练前的模型。在 RLHF 中这项特别重要，因为它保留通用能力并帮助控制相对于奖励模型的分布偏移（奖励模型是在参考策略 <script type="math/tex">\pi_{\text{ref}}</script> 上训练的）。在推理 RL 中，KL 惩罚通常设置得小得多或完全省略 [3][7]。

完整形式的 PPO 在内存中需要四个大组件：可训练策略、轨迹策略、参考策略和价值模型。

## GRPO

GRPO（Group Relative Policy Optimization）在 DeepSeekMath 中引入，后来由 DeepSeek-R1 推广 [8][3]，移除了 PPO 的价值模型并用组相对基线替代。

关键见解是可以通过将每个响应与同一提示词的其他响应比较来获得良好的基线。对于每个提示词 <script type="math/tex">x \sim \mathcal{D}</script>，GRPO 采样一组 <script type="math/tex">G</script> 个响应 <script type="math/tex">\{y_1, \ldots, y_G\}</script>，计算奖励 <script type="math/tex">r_i = r(x, y_i)</script>，并在组内归一化奖励以获得优势：

<script type="math/tex; mode=display"> \hat{A}_i = \frac{r_i - \mu_G}{\sigma_G}, \qquad \mu_G = \frac{1}{G}\sum_{j=1}^{G} r_j, \qquad \sigma_G = \sqrt{\frac{1}{G}\sum_{j=1}^{G}(r_j-\mu_G)^2}. </script>

直观地说，轨迹的基线不再是学习的价值函数，而是同一提示词的其他轨迹的性能。这在奖励稀疏但每个提示词有多个样本可用时特别有效。

GRPO 目标保持 PPO 风格的裁剪重要性采样，其原始形式包括 KL 项：

<script type="math/tex; mode=display"> J^{\text{GRPO}}(\theta) = \mathbb{E}_{x \sim \mathcal{D}}\left[\frac{1}{G}\sum_{i=1}^{G} \min\left(\rho_i(\theta) \hat{A}_i,\, \text{clip}(\rho_i(\theta), 1-\epsilon, 1+\epsilon) \hat{A}_i\right) - \beta \cdot D_{\text{KL}}(\pi_\theta(\cdot|x) \| \pi_{\text{ref}}(\cdot|x))\right] </script>

其中 <script type="math/tex">\rho_i(\theta)=\frac{\pi_\theta(y_i \mid x)}{\pi_{\theta_{\text{old}}}(y_i \mid x)}</script>。

组归一化有两个有用效果。减去均值使学习信号相对于提示词：如果该提示词的所有样本在 <script type="math/tex">[0.8, 1.0]</script> 中，奖励 $0.8$ 应该与在 <script type="math/tex">[0.2, 0.8]</script> 中时不同地解释。除以标准差使奖励尺度不太敏感，这在组合不同奖励范围的任务时有用。

然而，GRPO 成功的更重要原因更简单：它移除了评论家。这大幅减少内存使用，使推理模型的大规模 RL 更容易运行。

## RLOO

RLOO（REINFORCE Leave-One-Out）[9] 从不同方向得出了类似结论：PPO 对于 LLM 微调设置可能比所需的更复杂 [1]。LLM 在应用 RL 时已经训练良好，不像通常从随机初始化开始的传统 RL 智能体。虽然动作空间（词汇表）大得多，但概率质量集中在少数合理的 token 上。

对于每个提示词，RLOO 采样 <script type="math/tex">K</script> 个响应 <script type="math/tex">\{y_1, \ldots, y_K\}</script>。响应 <script type="math/tex">y_i</script> 的优势是其奖励减去其他 <script type="math/tex">K-1</script> 个响应的平均奖励：

<script type="math/tex; mode=display"> \hat{A}_i = r_i - \frac{1}{K-1}\sum_{j \neq i} r_j </script>

这个基线是无偏的且不需要学习的价值模型。与 GRPO 不同，RLOO 不除以组的标准差。

更重要的是，RLOO 放弃 PPO 风格的裁剪并返回纯 REINFORCE 风格的更新。

RLOO 目标是：

<script type="math/tex; mode=display"> J^{\text{RLOO}}(\theta) = \mathbb{E}_{x \sim \mathcal{D}}\left[\frac{1}{K}\sum_{i=1}^{K} \nabla_\theta \log \pi_\theta(y_i|x) \cdot \hat{A}_i\right] </script>

作者认为这种裁剪在他们实验中在不到 5% 的情况下起作用，可能在此设置中不必要。正如我们将看到的，后续工作得出了不同结论。

## Dr. GRPO

DeepSeek 在其 DeepSeek-Math 和 R1 论文中报告，随着 RL 训练进行，响应长度大幅增加。他们将其归因于推理和反思能力的改进（著名的"Aha"时刻）。虽然这可能是驱动因素之一，Dr. GRPO（"GRPO Done Right"）[10] 的作者识别了另一个更重要的原因：标准样本级损失归一化引入了偏向短正确响应和长错误响应的偏差。

在常见 GRPO 实现中，token 损失首先在每个序列内平均，然后在序列间平均。这意味着固定序列级奖励分布在序列中的所有 token 上。因此，长响应如果正确则每个 token 接受更弱的强化，如果错误则每个 token 接受更弱的惩罚。这可能产生过度冗长的激励。

修复很简单：Dr. GRPO 不是先除以序列长度然后除以批大小，而是除以固定常数（最大 token 数）。这有效地移除了不正确答案不必要长的激励。

Dr. GRPO 还移除了引入不希望偏差的另一个归一化。当每个提示词的奖励通过其标准差归一化时，所有答案有相似奖励的提示词（例如，除一个外都正确，奖励方差低），即使小奖励差异也可能变成大的归一化优势。结果，模型已经大多正确的提示词可能接收不成比例大的更新。

Dr. GRPO 优势简化为：

<script type="math/tex; mode=display"> \hat{A}_i = r_i - \mu_G </script>

没有除以标准差，损失在 token 级别用固定归一化聚合，而不是首先按序列长度平均。

实际信息不是 GRPO 根本上坏了，而是它一些看似无害的归一化不是中性的。在长篇推理中，它们改变哪些提示词和哪些 token 接收梯度信号。

## DAPO

DAPO（Decoupled Advantage Policy Optimization）[7] 是另一个对 GRPO 多个组件的深入分析，提出四项改进。

首先，DAPO 用 token 级别的聚合替代样本级平均（类似于 Dr. GRPO，但 DAPO 除以实际 token 数，而 Dr. GRPO 使用常数）。

第二项改进针对裁剪机制：PPO 的对称比率裁剪对低概率 token 特别（过度）限制。例如，如果 token 概率为 $0.01$，那么用 <script type="math/tex">\epsilon = 0.2</script> 其概率在裁剪前只能上升到 $0.012$，几乎不改变其被采样的可能性。这可能抑制学习稀有但有用的推理延续。因此 DAPO 解耦裁剪边界并使用更大的上界 <script type="math/tex">\epsilon_{\text{high}} = 0.28</script>，保持 <script type="math/tex">\epsilon_{\text{low}} = 0.2</script>（非对称裁剪）。

有了 token 级聚合和非对称裁剪，DAPO 目标变为：

<script type="math/tex; mode=display"> J^{\text{DAPO}}(\theta) = \mathbb{E}\left[ \frac{1}{\sum_{i=1}^{G}|y_i|} \sum_{i=1}^{G}\sum_{t=1}^{|y_i|} \min\left( \rho_{i,t}(\theta)\hat{A}_i,\; \operatorname{clip}(\rho_{i,t}(\theta),1-\epsilon_{\text{low}},1+\epsilon_{\text{high}})\hat{A}_i \right) \right]. </script>

其他两项改进不修改目标方程，但提高步效率。

第三项更改是超长奖励塑形。在许多设置中，截断的响应接收与完全错误响应相同的奖励。这很嘈杂：响应可能包含大多正确的推理，仍被长度限制切断。DAPO 在硬截断前添加软惩罚区：

<script type="math/tex; mode=display"> R_\text{length}(y) = \begin{cases} 0, & |y| \le L_\text{max} - L_\text{cache} \\ \frac{(L_\text{max} - L_\text{cache}) - |y|}{L_\text{cache}}, & L_\text{max} - L_\text{cache} < |y| \le L_\text{max} \\ -1, & L_\text{max} < |y|. \end{cases} </script>

这创建了更直接的学习信号，因为略微超长的响应仅受到轻微惩罚，而过度响应接收更强的负反馈。因此模型可以学习响应长度是问题，而不是将截断与完全任务失败混淆。

第四项更改是动态采样。如果提示词的所有采样响应都正确或都错误，则组相对优势都为零，提示词不贡献梯度。在这种情况下，DAPO 继续采样直到每个提示词有混合结果，确保优化批中的每个提示词提供学习信号。这提高了步效率，尽管可能增加挂钟时间，因为困难批次可能需要更多生成。

## CISPO

CISPO（Clipped Importance Sampling Policy Optimization）在 MiniMax-M1 报告 [11] 中引入，针对 PPO 风格裁剪的特定弱点：当 token 落在裁剪范围外时，PPO 完全阻止其梯度。

这种行为保守，但也可能过度谨慎。经历大概率偏移的 token 通常正是对学习推理行为最重要的（报告提到例如"However"、"Recheck"、"Wait"和"Aha"在基础模型中概率低，但可以作为推理轨迹中的分叉）。如果这些 token 在比率变得太大时被掩码，学习因丢弃一些信息梯度而减慢。

因此 CISPO 将裁剪与梯度流解耦。不是以诱导硬掩码的方式裁剪目标，而是仅裁剪重要性采样权重并对该权重应用停止梯度操作：

<script type="math/tex; mode=display"> J^{\text{CISPO}}(\theta) = \mathbb{E}\left[ \operatorname{sg}\left(\hat{\rho}_t(\theta)\right)\,\hat{A}_t\,\log \pi_\theta(a_t \mid s_t) \right], \qquad \hat{\rho}_t(\theta)=\operatorname{clip}\bigl(\rho_t(\theta), 1-\epsilon_{l}, 1+\epsilon_{h}\bigr), </script>

其中 <script type="math/tex">\operatorname{sg}(\cdot)</script> 表示停止梯度。

有趣的是，他们报告只需要上裁剪 <script type="math/tex">\epsilon_h</script> 并调优，下裁剪 <script type="math/tex">\epsilon_l</script> 设置得足够高以有效不活跃。

这个公式保留了 IS 权重裁剪的方差减少好处，同时允许所有 token 的梯度流动。结果是更稳定的训练，不抑制高信息 token 的学习，在 MiniMax 实验中与 DAPO 相比步效率提高 2 倍。

CISPO 可以看作 PPO 风格掩码的软替代：保持信任区域直觉，但裁剪权重而不是删除完整更新。

## MaxRL

MaxRL（Maximum Likelihood Reinforcement Learning）[12] 从不同角度开始：标准 RL 目标优化期望奖励（pass@1），这经常被观察到（pass@1 以 pass@<script type="math/tex">k</script> 为代价提高），但不一定是最合适的目标。相比之下，最大似然训练（如预训练和 SFT 中使用）将最大化 <script type="math/tex">\log p_\theta(x)</script>。

这很重要，因为他们表明：

<script type="math/tex; mode=display"> \log p_\theta(x) = -\sum_{k=1}^{\infty}\frac{(1-p_\theta(x))^k}{k}, </script>

所以最大似然梯度是 pass@<script type="math/tex">k</script> 梯度的无限调和混合，不仅仅是 pass@1。而标准 RL 只保留该展开的第一阶项。

因此，MaxRL 定义了计算索引的截断目标族：

<script type="math/tex; mode=display"> J_{\text{MaxRL}}^{(T)}(x) = -\sum_{k=1}^{T}\frac{(1-p_\theta(x))^k}{k}, </script>

其中 <script type="math/tex">T=1</script> 恢复标准 RL，<script type="math/tex">T\to \infty</script> 恢复最大似然。

期望梯度与此目标匹配的在策略估计器非常简单：给定提示词的 <script type="math/tex">N</script> 个轨迹，让 <script type="math/tex">K</script> 为成功轨迹数。然后 MaxRL 仅平均成功轨迹的得分函数：

<script type="math/tex; mode=display"> \hat{g}_N(x) = \begin{cases} \displaystyle \frac{1}{K}\sum_{i=1}^{N} r_i \nabla_\theta \log \pi_\theta(y_i \mid x), & K \ge 1, \\[0.8em] 0, & K = 0. \end{cases} </script>

这个估计器对 <script type="math/tex">T=N</script> 的截断 MaxRL 目标是无偏的。与 REINFORCE 的关键区别是在这种情况下增加轨迹减少估计器方差，同时也使优化的目标本身更好地近似最大似然。

也可以用带零均值控制变量的 REINFORCE 形式重写估计器，这使加权更明确。如果 <script type="math/tex">\hat r = K/N</script> 是该提示词的成功率，则有效优势变为正比于：

<script type="math/tex; mode=display"> \hat{A}_i^{\text{MaxRL}} \propto \frac{r_i - \hat r}{\hat r}. </script>

这显示了为什么 MaxRL 将学习信号集中在困难提示词上。当 <script type="math/tex">\hat r</script> 小但非零时，该提示词的成功轨迹被强加权。相比之下，<script type="math/tex">\hat r \approx 1</script> 的简单提示词接收相对较少的额外强调。

经验上，MaxRL 改进 pass@<script type="math/tex">k</script>，比 GRPO 更好地保留输出多样性，并在测试时缩放效率上产生实质性收益。

从概念上讲，它也很有趣，因为它将可验证任务的 RL 重构为非可微采样下的近似最大似然训练。

## DPPO

DPPO（Divergence PPO）[13] 比 DAPO 或 CISPO 更直接地重新审视信任区域问题。

核心批评是 PPO 基于采样 token 的概率比率裁剪。这可能是实际策略发散的糟糕代理，特别是对于稀有 token。它们的概率可能改变一个数量级，对全分布仍只有非常小的影响。

这个问题因训练/推理框架不匹配而放大：即使参数相同，不同框架间低概率 token 的概率比率可能高度波动，而总变差等发散度量更稳定。

因此 DPPO 用估计策略发散（TV 或 KL）定义的信任区域替代基于比率的掩码。词汇表上精确全发散的计算昂贵，但二进制近似（仅比较两个策略下采样 token 的概率）或 top-K 近似在经验上都很好。

DPPO 更新变为：

<script type="math/tex; mode=display"> J^{\text{DPPO}}(\theta) = \mathbb{E}\left[ M_{\text{div}}\!\left(\widehat{D}(\pi_\theta,\pi_{\theta_{\text{old}}}), \tau\right)\, \rho(\theta)\, \hat{A} \right], </script>

其中 <script type="math/tex">M_{\text{div}}</script> 掩码其估计发散超过阈值 <script type="math/tex">\tau</script> 的更新。

他们实验的一个有趣见解：只有一小部分（不到 0.5%）的更新是不稳定的原因，当负样本将策略推得太远时。阻止这些足以稳定训练（在他们的实验中）。

因此 DPPO 提出（并提出一个答案）我们在 LLM 体制中如何定义信任区域的问题。

## ScaleRL

ScaleRL [14] 不太关于发明新目标，而是关于确定哪些设计选择在计算严重缩放时继续重要。该论文报告了超过 400,000 GPU 小时的消融，更重要的是，通过拟合 S 形性能与计算曲线而不是比较单个训练检查点来评估方法。

这个框架有用，因为它分离了经常混淆的两个量：方法在给定计算预算下改进的速度，以及最终饱和的地方。方法可以在低计算时看起来强大但仍早期达到平台。另一个可能上升更慢但达到更好的渐近线。

他们的主要发现是：

**异步 RL**。ScaleRL 更喜欢流水线异步设置而不是常见的生成然后更新循环。在此设置中轨迹连续生成，权重更新立即推送。这主要通过减少空闲时间提高计算效率，同时保持最终性能竞争或更好。

**损失类型**。在他们比较的离策略损失函数中，CISPO 和 GSPO 在渐近性能上优于 DAPO，选择 CISPO 作为默认，因为它结合了强结果和相对鲁棒性。

**FP32 logits**。生成内核和训练内核间的小数值不匹配可以实质性地扭曲重要性采样比率。正如 MiniMax 报告 [11] 提出的，在 FP32 中计算 LM head 急剧减少这个问题，并在他们的消融中大幅改善渐近性能。

**损失聚合**。对于损失聚合，他们显示了与 Dr. GRPO [10] 和 DAPO [7] 概述的相同偏差，样本平均是次优的。相反，他们看到提示词级平均的最佳性能。

**零方差过滤**。如果提示词的所有答案都正确或都错误，则没有学习信号。不是采样更多（如 DAPO，这可能对步数最优），他们从优化中排除这些提示词，加速训练。

**无正重采样**。如果提示词导致超过 90% 正确答案，则从未来 epoch 排除。这略微减慢训练但达到更高的渐近性能。

ScaleRL 既因其大规模经验验证又因阐明改进曲线的形状（包括早期学习速度和渐近性能）而有价值。

## 总结

下表总结了方法间的主要差异：

| 方法 | 基线/优势 | 裁剪 | 掩码 | 损失聚合 | 改进 |
|---|---|---|---|---|---|
| REINFORCE | EMA 或批平均奖励 | 无 | 无 | 样本平均 | 建立策略梯度 |
| PPO | 带 critic 的 GAE | 对称 IS | <script type="math/tex">M_\text{sym}(\hat{A}_t, \rho_t, 0.2)</script> | 样本平均 | 稳定，更样本高效 |
| GRPO | <script type="math/tex">(r-\mu_G)/\sigma_G</script> | 对称 IS | <script type="math/tex">M_\text{sym}(\hat{A}_t, \rho_t, 0.2)</script> | 长度归一化<script type="math/tex">^\dagger</script> | 更少内存密集 |
| RLOO | 留一平均 | 无 | 无 | 样本平均 | 无 critic 的方差减少 |
| Dr. GRPO | <script type="math/tex">r - \mu_G</script> | 对称 IS | <script type="math/tex">M_\text{sym}(\hat{A}_t, \rho_t, 0.2)</script> | Token 平均<script type="math/tex">^\ddagger</script> | 移除长度偏差和 std 加权 |
| DAPO | <script type="math/tex">(r-\mu_G)/\sigma_G</script> | 非对称 IS | <script type="math/tex">M_\text{asym}(\hat{A}_t, \rho_t, 0.2, 0.28)</script> | Token 平均 | 给小概率更多增长空间 |
| CISPO | 组内 <script type="math/tex">(r-\mu_G)/\sigma_G</script> | 上界 IS | 无 | Token 平均 | 不掩码梯度，仅裁剪 |
| DPPO | 组内 <script type="math/tex">(r-\mu)/\sigma</script> | 对称 DV | <script type="math/tex">M_\text{div}(\hat{A}_t, \upsilon_t, 0.15)</script> | 样本平均 | 使用 DV 信任区域适应 LLM 域 |
| MaxRL | <script type="math/tex">(r_i - \hat{r})/(N\cdot \hat{r})</script> 且 <script type="math/tex">\hat{r}=K/N</script> | 无 | 无 | 样本平均 | RL 和 MLE 间插值，更好 pass@k |
| ScaleRL | <script type="math/tex">(r-\mu_B)/\sigma_B</script> | 上界 IS | 无 | 提示词平均 | 大规模验证和缩放定律 |

<script type="math/tex">^\dagger</script> 实现可能不同，例如 [Huggingface TRL](https://huggingface.co/docs/trl/grpo_trainer#computing-the-loss)

<script type="math/tex">^\ddagger</script> 带常数分母

其中：

<script type="math/tex; mode=display"> \begin{align*} \rho_t(\theta) &= \frac{\pi_\theta(a|s)}{\pi_{\theta_{\text{old}}}(a|s)} \\ \upsilon_t(\theta) &= \pi_\theta(a|s) - \pi_{\theta_{\text{old}}}(a|s) \\ M_\text{sym}(\hat{A}_t, \rho_t, \epsilon) &= \begin{cases} 0 & \text{if } (\hat{A}_t > 0 \land \rho_t > 1 + \epsilon) \lor (\hat{A}_t < 0 \land \rho_t < 1 - \epsilon) \\ 1 & \text{otherwise} \end{cases} \\ M_\text{asym}(\hat{A}_t, \rho_t, \epsilon_l, \epsilon_h) &= \begin{cases} 0 & \text{if } (\hat{A}_t > 0 \land \rho_t > 1 + \epsilon_h) \lor (\hat{A}_t < 0 \land \rho_t < 1 - \epsilon_l) \\ 1 & \text{otherwise} \end{cases} \\ M_\text{div}(\hat{A}_t, \upsilon_t, \delta) &= \begin{cases} 0 & \text{if } (\hat{A}_t > 0 \land \upsilon_t > \delta) \lor (\hat{A}_t < 0 \land \upsilon_t < \delta) \\ 1 & \text{otherwise} \end{cases} \end{align*} </script>

在这些方法中，一些模式反复出现：

**评论家对 LLM 训练不必要**。自 PPO 以来每个方法都发现更简单的基线（组均值、留一、贪婪轨迹）匹配或超过学习的价值函数，同时节省约 50% 内存。LLM 微调设置（模型从强预训练检查点开始而不是随机初始化）似乎使 PPO 的方差减少机制在很大程度上多余。这不意味着我们永远不会再见价值模型。只是目前它们不证明内存成本作为方差减少。

**标准差归一化倾向于有害**。Dr. GRPO 和 MaxRL 都显示除以 <script type="math/tex">\sigma</script> 在几乎解决的问题上增加太多权重。ScaleRL 消融确认 DAPO（带标准差归一化）达到显著更低的渐近性能，相比于 CISPO 和 GSPO [15]（本文未涵盖，可能在扩展中）。

**损失聚合不是小细节**。Dr. GRPO 和 DAPO 显示序列级奖励与样本级平均结合可能扭曲每 token 学习信号。损失的减少是方法的关键部分，错误选择可能引入微妙偏差。

**信任区域是优化的好点**。PPO 的信任区域定义（<script type="math/tex">\epsilon = 0.2</script>）似乎非常精心选择，因为它跨模型和任务工作良好。然而，最近许多方法针对信任区域并显示改进性能：DAPO 非对称放松，CISPO 裁剪权重而不是掩码梯度，DPPO 认为采样 token 比率是首先约束的错误量。领域尚未收敛到信任区域的良好定义，可能没有单一、任务和模型无关的定义，但这里的一些进一步研究可能导致持续改进。

**临时配方正在出现**。当前最强的大规模证据指向无 critic 训练、token 感知或提示词感知损失聚合、更软或更有原则的信任区域处理，以及对课程和计算分配越来越明确的关注 [11][13][14]。虽然这是进展，但它可能随着新方法或细节的引入而快速变化。

## 开放问题

尽管快速进展，几个基本挑战仍然存在。本节的参考文献不完整，如果认为我漏掉了一个，请联系。

**信用分配** [16][17][18]。当前基于结果的方法本质上将相同奖励分配给响应中的所有 token。这出奇地好，它们易于实现，但显然效率低。导致推理失败的 token 接收与其周围的样板 token 相同的信号。过程奖励模型、步骤级验证器、基于搜索的方法和分支敏感训练目标都试图解决这个问题，但没有一个成为标准解决方案。

**样本效率** [19]。著名地，RL 中的信息增益只有一位（正确/错误）。大多数当前配方依赖每个提示词多个轨迹，通常 8 到 64，以构建有用的相对基线。即使有自动验证器这也昂贵，当验证成本高或部分手动时更糟。更好地重用不成功样本、更好的离线到在线混合或更好的提示词选择策略可以大幅减少此成本。

**非常困难的问题** [20][21]。如果模型从未为提示词产生正确轨迹，则这里所有方法都不提供梯度。课程学习在实践中帮助，但这只是变通方法。从部分正确轨迹提取信号的更强方法，或将搜索与 RL 结合，仍然是重要的研究方向（与信用分配相关）。

**扩展到数学和代码之外** [22][23]。最近几乎所有进展来自有廉价和明确验证的领域（数学和代码）。将这些方法扩展到有嘈杂奖励、延迟奖励、主观评估或多轮交互的设置仍然困难。

**经验可靠性** [24][25]。也许最被低估的开放问题是这个领域的大多数证据仍然是经验的、相对狭窄的，且昂贵重现。许多论文测试一个模型家族、一个验证器设置、一个数据集混合和一个计算预算。正如 ScaleRL 明确的，干预可以改变早期学习速度、渐近性能或两者，这些不可互换。因此我们仍然知道比有时看起来更少。一些方法可能是鲁棒的算法改进，而其他可能主要为特定模型、奖励设计或训练体制工作。两者都有用，但我们需要知道它们的局限性。

这些开放问题暗示更广泛的结论。LLM 的 RL 不再因缺乏可行算法而瓶颈。我们现在有几个。更难的问题是关于效率、鲁棒性、通用性，以及理解哪些经验改进实际上在缩放和迁移中存活。

评论、更正和相关参考文献非常欢迎。只需在 [X](https://x.com/a_weers) 上联系或写信给我 [email@aweers.de](mailto:email@aweers.de)。

---

## 参考文献

[1]: Ouyang et al. (2022), Training language models to follow instructions with human feedback
[2]: Jaech et al. (2024), OpenAI o1 system card
[3]: DeepSeek-AI (2025), DeepSeek-R1: Incentivizing reasoning capability in LLMs via reinforcement learning
[4]: Schulman et al. (2017), Proximal policy optimization algorithms
[5]: Williams (1992), Simple statistical gradient-following algorithms for connectionist reinforcement learning
[6]: Schulman et al. (2015), Trust region policy optimization
[7]: Yu et al. (2025), DAPO: An open-source LLM reinforcement learning system
[8]: Shao et al. (2024), DeepSeekMath: Pushing the limits of mathematical reasoning in open language models
[9]: Ahmadian et al. (2024), Back to basics: Revisiting reinforce style optimization for learning from human feedback in LLMs
[10]: Liu et al. (2025), Understanding GRPO: Theoretical foundations and practical improvements
[11]: Chen et al. (2025), MiniMax-01: Scaling foundation models with lightning attention
[12]: Tajwar et al. (2026), Maximum likelihood reinforcement learning for reasoning tasks
[13]: Qi et al. (2026), Rethinking trust regions for LLM policy optimization
[14]: Khatri et al. (2025), The art of scaling: Large-scale ablations in LLM reinforcement learning
[15]: Zheng et al. (2025), Group relative policy optimization for diverse tasks
[16]: Zhang et al. (2025), Lessons from process reward models
[17]: She et al. (2025), R: Step-level reasoning verification
[18]: Sharma et al. (2026), PRISM: Process-aware reinforcement learning
[19]: Mao et al. (2026), Dynamics of sample efficiency in LLM RL
[20]: Setlur et al. (2026), Reuse: Extracting signal from failed trajectories
[21]: Qu et al. (2026), POPE: Policy optimization with partial evidence
[22]: Zhao et al. (2025), Learning from subjective feedback
[23]: Lu et al. (2026), Golden: Multi-turn RL for conversational agents
[24]: Hu et al. (2025), Breaking the empirical bottleneck
[25]: Yue et al. (2025), Does it really work? Reproducibility in LLM RL
