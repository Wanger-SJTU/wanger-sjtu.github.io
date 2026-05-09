---
title: "Perplexity 的 Agent Skills 设计之道"
date: 2026-05-09
tags: ["Agent", "Skill", "Perplexity", "工程实践"]
categories: ["翻译转载"]
mathjax: true
---

> **原文**: [Designing, Refining, and Maintaining Agent Skills at Perplexity](https://research.perplexity.ai/articles/designing-refining-and-maintaining-agent-skills-at-perplexity)
> **发布**: 2026年5月1日
> **翻译**: Wanger

Perplexity 的前沿 Agent 产品建立在模块化的 **Agent Skills** 之上。他们的 Agents 团队审查大量 PR 时，几乎总是有大量修改意见——因为编写代码的模式在 Skill 创建中往往是**反模式**。

<!-- more -->

## PEP20 vs Skill Zen

| Zen of Python | Zen of Skills |
|---------------|---------------|
| Simple is better than complex | **A Skill is a folder, not a file. Complexity is the feature.** |
| Explicit is better than implicit | Activation is implicit pattern matching |
| Sparse is better than dense | Context is expensive. Maximum signal per token |
| Special cases aren't special enough to break the rules | **Gotchas ARE the special cases (highest-value content)** |
| If the implementation is easy to explain | **If it's easy to explain, the model already knows it. Delete it.** |

## Skill 是什么？

**一个 Skill 是四样东西：目录、格式、可调用、递进的。**

### 目录结构

```
skill-name/
├── SKILL.md          # frontmatter + 指令
├── scripts/          # agent 运行的代码
├── references/       # 按需加载的重文档
├── assets/           # 模板、schema、数据
└── config.json       # 首次运行用户设置
```

多级目录结构能帮助模型导航。税务 Skill 用 3 层嵌套处理 1945 个 IRS 条目——把所有内容塞进一个文件夹的效果比不加载 Skill 还差。

### 三层成本

| Tier | 内容 | 预算 |
|------|------|------|
| Index | name + description | ~100 tokens/Skill，**每 session 每个用户都要付** |
| Load | 完整 SKILL.md body | ~5000 tokens |
| Runtime | scripts/、references/、assets/ | 无上限，**按需加载** |

**每个 Skill 都是一种税。** 没有某条指令 Agent 也会做对，就不要放进去——所有人每时每刻都在为此买单。

## 何时需要 Skill？

**需要：** Agent 没有特殊上下文会出错；需要跨运行高度一致；你的知识不在训练数据中（品味判断、企业工作流）。

**不需要：** 模型已经知道该怎么做；重复系统 prompt；远程端点频繁变化（会导致 drift）。

## 如何构建 Skill

**Step 0**: 先写 Evals。负例极其强大。

**Step 1**: 写 description。**这是最难的一行。** 不是"这个 Skill 做什么"，而是"何时加载"。应该是工程师沮丧时会说的话："babysit"、"watch CI"、"make sure this lands"。

**Step 2**: 写 body。**不要写一串命令。** 模型在后者上做得比前者好得多。

不好的：`git log; git checkout main; git cherry-pick <commit>`

好的：`Cherry-pick the commit onto a clean branch. Resolve conflicts preserving intent. If it can't land cleanly, explain why.`

**Step 3**: 使用目录结构。按需渐进加载。

**Step 4**: 迭代。先无 Skill 做几轮，收集 hero queries，跑 evals。

**Step 5**: 发布。

## 如何维护 Skill

**Gotchas Flywheel**——Skill 是几乎是"只追加的"：

- Agent 在某事上失败 → 加一个 gotcha
- Agent 错误加载 Skill → 收紧 description + 加负例
- Agent 应该加载没加载 → 加关键词 + 正例

**跨模型测试**——Sonnet 和 GPT 在 Skill 行为上相当不同。

## 关键结论

> "Self-generated Skills provide no benefit on average, showing that models cannot reliably author the procedural knowledge they benefit from consuming."

- 写 Evals 先于 Skill
- Description 是最难的部分：每个词都有成本
- Gotchas 是极高价值的内容
- 从薄开始，随 agent 失败而增长
- **注意远距效应**：加新 Skill 可能破坏已有 Skill（没碰它也会）

---

![](https://framerusercontent.com/images/hr7cGJptEmhQmgDCyPXWQMxamIk.png)

![](https://framerusercontent.com/images/StL77jSrvpQypM4nJ5omvZdkHQ.png)