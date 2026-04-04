---
title: "4万美金的H100都在等磁盘IO——Agent的真实瓶颈根本不是推理"
date: 2026-04-04
tags: [存储, IO, 性能]
---

> 原文链接：[知乎 - Guanlan](https://zhuanlan.zhihu.com/p/2021028461456701359)
>
> 作者：Guanlan，Runta 创始人CEO，打造 Agent 原生 Infra

---

## 🔑 存储IO瓶颈要点总结

这篇文章来自 ASPLOS 2026 的 AgenticOS Workshop，核心发现令人震惊：

**LLM 推理时间只占端到端延迟的 30%~40%，剩下 60%~70% 主要耗在工具执行和环境初始化上——跑测试、装依赖、执行脚本，全都在等磁盘 I/O。**

关键数据：
- **144 个 SWE-bench 任务**用 Claude Code 跑，同一个任务执行时间差 **1.8 倍**
- **平均 CPU 利用率不到 13%**，但内存峰值能到 4GB，**峰均比高达 15.4 倍**（serverless 约 1.5 倍，microservice 通常 2~3 倍）
- **我们在用单价 4 万美金的 H100，去等待最廉价的磁盘 I/O**

结论：Agent 执行层的瓶颈不是算力，而是存储 I/O、资源调度的突发性、以及非确定性路径的管理。需要一套能原生理解非确定性分支和语义级安全的系统底座。

---

以下是原文完整内容：

刚从 GTC 2026 的算力狂欢中抽身，本周我在顶会 ASPLOS 2026 的 AgenticOS Workshop 感受到了截然不同的氛围。GTC 还在堆砌算力集群，Infra 和系统研究者们已经在头疼一个更基本的问题：Agent 这种全新的计算负载，到底需要什么样的执行层？

Eunomia-bpf 团队在 Workshop 上给出了一组很硬的 profiling 数据。他们拿 144 个 SWE-bench 任务用 Claude Code 跑，并且在操作系统层面做了完整 profiling：

> AgentCgroup: Understanding and Controlling OS Resources of AI Agents: Yusheng Zheng, Jiakun Fan etc

同一个任务跑三次，执行时间差 1.8 倍，产生完全不同的解决方案、不同的代码修改、不同的文件。LLM 推理时间只占端到端延迟的 30% 到 40%，剩下的 60% 到 70% 主要耗在工具执行和环境初始化上：跑测试、装依赖、执行脚本。平均 CPU 利用率不到 13%，但内存峰值能到 4GB，峰均比高达 15.4 倍。对照一下：serverless 大概是 1.5 倍，microservice 通常是 2 到 3 倍。

**我们在用单价 4 万美金的 H100，去等待最廉价的磁盘 I/O。**

这组数据其实把三个问题摆到了执行层面前：怎么处理分支，怎么约束副作用，怎么应对突发资源波动。

## 非确定路径：执行层怎么处理分支与回滚？

传统基础设施假设工作负载是大致可预测的，历史模式可以指导未来调度。

BranchContext 切入的是 Agent 并行探索时的状态管理。当 Agent 同时尝试三种方案修一个 bug，每种方案都会改文件、装包、跑测试，你需要隔离副作用，然后把成功的那个原子提交。

> Fork, Explore, Commit: OS Primitives for Agentic Exploration: Cong Wang and Yusheng Zheng

他们提出的抽象是 branch context：copy-on-write 的文件系统视图加受控的进程组，支持 fork/explore/commit 的生命周期，first-committer-wins 的解析语义。设计上有一个不错的取舍：父进程在分支存在期间变成只读（frozen origin）。这通过 construction 消除了合并冲突的可能性，代价是父进程在等待期间不能做任何事。放到 Agent 这个场景里，我觉得这个 trade-off 很成立，因为父进程大多数时候本来也不是在干活，而是在等哪个分支先给出能提交的结果。

这段 Q&A 比论文正文更有意思，一个是问题关于怎么决定 commit 哪个分支：目前靠外部打分系统，Best-of-N 模式下给每个分支评分选最高的，但在 beam search 模式下可以利用树结构的层级反馈。作者认为 scoring 没有好的通用方案。我原本以为 BranchContext 解决的是状态隔离，但现场讨论让我意识到更大的问题其实是 token 预算：Agent 的分支探索不只是状态管理，它本质上是"投机执行"(Speculative Execution)。系统层必须像内核调度 CPU 时间片一样，去动态调度 Token 预算。没有"经济感知"的执行层，并行探索的 Token 消耗量将会难以控制。

他们用这套原语实现了七种探索模式（并行推测、BestOfN、Reflexion、TreeOfThoughts、BeamSearch、Tournament、Cascaded），其中 Reflexion 作为单分支顺序重试的特例特别有意思，同一个分支原语既能描述并行探索也能描述带回滚的串行重试。

## 副作用边界：执行层怎么控制能力授权

在副作用不可避免的前提下，执行层到底应该把 trust boundary 画在哪里？

这次 workshop 里，出现了三种思路：

**Execute-Only Agents**: Rahul Tiwari and Dan Williams

Execute-Only Agents 的做法最激进：让 LLM 永远不接触不可信数据。LLM 只生成脚本，脚本在沙箱里跟数据交互，结果直接返回用户。他们发现 78% 的 AgentDojo 任务不需要 LLM 看到数据就能完成，这相当于在架构层面直接拿掉了 prompt injection 这类攻击面。

**Grimlock**: Guarding High-Agency Systems with eBPF and Attested Channels: Qiancheng Wu, Wenhui Zhang etc.

Grimlock 来自 Roblox，走的是基础设施下沉的路：用 eBPF 在沙箱边界拦截所有网络请求，强制走 mTLS 通道，用 TEE 远程证明加短期 scoped token 做授权。安全边界从应用代码下沉到 Agent 无法绕过的基础设施层。现场讨论中作者区分了两类策略：硬边界（不能 root、不能访问某些资源，和 Agent 意图无关）是可以明确定义的；但软边界（根据 Agent 当前行为动态调整权限）还没有好方案。

**VibeWAF**: Toward LLM-Driven Rule Generation for Enforcement Systems: Quanzhi Fu and Dan Williams

VibeWAF 走的是在线学习的路：用 LLM 在线进化 WAF 规则集，快速规则引擎处理已知模式，未匹配的流量送 LLM 分析并生成新规则，逐步把流量从 LLM 卸载到规则引擎。反馈循环确实收敛了，命中率从 0% 涨到 88%。

但 VibeWAF 的实验同时揭示了一个比它自身更重要的教训。他们发现黑名单规则收敛得很好（攻击模式有共性），白名单几乎不收敛（正常流量太多样）。更危险的是，早期生成的白名单会在新攻击出现时静默放行恶意流量。因为请求已经被规则引擎匹配了，LLM 根本没机会看到，也就没机会自我纠正。

我对在线学习生成 allow rule 这条路会更保守一些。不是说它一定走不通，而是它让我很不舒服的一点在于：你等于把学习接口本身暴露给了攻击者。系统每学会一条 allow rule，未来都可能变成攻击者绕过你的固定通道。一旦这些规则又被规则引擎缓存，后面甚至连纠错机会都没了。至少今天，我还不太敢把这种机制放到底座。

硬边界最好仍然是 deny-by-default，而且要由基础设施层强制执行；软边界可以探索，但最后兜底最好还是拒绝，不要指望 Agent 自己收敛出安全边界。

## 非稳态资源：执行层怎么调度与隔离？

15.4 倍的峰均比意味着 Agent 的资源消耗模式和传统工作负载有本质区别。burst 主要来自工具调用，持续时间只有 1 到 2 秒，触发时机不可预测。传统的弹性伸缩假设负载变化是渐进的、可预测的，对 Agent 来说这个假设不成立。

更棘手的是容错。传统云基础设施把 kill-restart 当作可接受的降级手段，但 kill 一个 Agent 容器意味着丢失所有 LLM 上下文。重启后 Agent 走完全不同的路径，甚至不保证收敛到同一个解。

这里存在一个尚未解决的张力。一方面，kill-restart 不可接受意味着我们需要 Checkpoint/Resume 来保护执行连续性，这是昂贵的。另一方面，BranchContext 引导我们走 fork/explore 的概率性容错路径，既然路径本来就是非确定的，与其花大代价保存一条路径的精确状态，不如直接开新分支重试。

执行层恐怕要同时支持两套容错路径：长任务更适合 checkpoint，早期探索更适合 fork 重试。对于已经积累了大量有价值中间状态的长任务（比如已经跑了 20 分钟的 SWE-bench 任务），checkpoint 是值得的；对于还在早期探索阶段的短任务，fork 重试的成本更低。关键是执行层需要提供足够的信息让上层做出这个判断，把选择权交给调度策略。

## 横切面：Policy 与 Mechanism 的解耦

> Rethinking OS Interfaces for LLM Agents: Yuan Wang, Mingyu Li and Haibo Chen

中科院软件所的 Declarative Model Interface (声明式模型接口) 论文提供了一个干净的量化验证。他们给 LLM Agent 设计了一种声明式 OS 接口，把 GUI 导航建模为确定性图结构，LLM 只声明目标状态，导航和交互由 DMI 层自动完成。在 Microsoft Office 任务上成功率从 44.4% 提升到 74.1%，步骤减少 43.5%，61% 的成功任务单次 LLM 调用就完成了。

很多本来被塞进 prompt 里的东西，其实不该由模型来猜。模型更适合做语义决策，但导航、交互、状态转换这些机制，一旦从 prompt 里拿出来，变成显式系统接口，整个系统就会轻很多，也稳很多。

IBM Research 的 FMOS 论文也在印证同一个方向：把部分 context、policy 和 reasoning 调度，从 prompt 里拿出来，变成更明确的系统接口。它到底更像操作系统还是 framework，现场其实有争议，但它再次说明了一点：mechanism 越少让模型自己猜，系统就越高效、越可控。

## 还缺什么？

纵观 Workshop，几乎所有工作都在 Linux 生态内展开：eBPF、cgroup v2、sched_ext、FUSE。Linux 作为底层机制的抽象依然强悍，进程、网络、隔离、资源控制这些基本构件并没有过时。

这些工作之间缺少一个共同的协调层：BranchContext 在文件系统层创造了平行宇宙，但 Grimlock 颁发的安全 token 无法感知这种分支，一旦某个分支被放弃，权限该如何即时回收？分支探索与能力授权之间完全脱节。当 scoped token 需要对接调度策略来决定该不该 checkpoint，协调成本本身就变成了系统瓶颈。在 15 倍峰均比、路径完全发散的 Agent 负载下，靠在 Linux 上堆砌局部补丁无法弥合这些断裂，这些补丁之间需要一个原生的执行层来协调。

就像当年虚拟化催生了 Hypervisor、容器化催生了 K8s，Agent 负载需要一套能原生理解非确定性分支和语义级安全的系统底座。

Hypervisor 的 forcing function 是硬件辅助虚拟化的成熟，K8s 的 forcing function 是 Docker 生态的爆发，都是单一明确的技术拐点。真正把 Agent 执行层逼出来的，是几股压力开始同时收紧：任务越来越长、越来越分支化；token 还没有便宜到可以任意挥霍；真实权限一旦放进来，安全事故的代价就会陡增。

三者叠在一起，如果继续在 Linux 上打局部补丁，很快会比单独做一层协调系统更昂贵。

对我来说，这也是这次 workshop 最有价值的地方：它没有给出统一答案，但第一次把这些断裂真正并排摆在一起了。但学术界的路径是在 Linux 上逐个验证局部原语，不会是把它们统一成产品。从 BranchContext 到 Grimlock 到 DMI，每一篇论文都在证明 Agent 执行层需要支持的某个能力，同时也在证明靠论文之间的隐性协调拼不出一个完整的系统。这中间的空白，需要靠工程来解决。
