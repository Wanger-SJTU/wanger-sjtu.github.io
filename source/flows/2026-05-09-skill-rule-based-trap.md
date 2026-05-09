---
title: "Skill构建的Rule-Based陷阱"
date: 2026-05-09
tags: ["随笔"]
---

最近在优化一个文档维护的 skill。经过几轮的优化迭代，发现模型在创建/优化 skill 时，即使多次强调这个 skill 的调用方是 Agent，但仍然在开发设计时容易陷入基于 rule-based 的模式去。

这背后折射出一个问题：LLM 或者由 LLM 为基础的 Agent，当前并不能认知到自我能力的边界，并通过工具构建来拓展边界，生长出可被内化的技能。而构建工具的任务，就容易 fallback 到一个 rule-based 的确定态解决方案上去。

所以至少目前，即使有了 skill-creator，但做出好的 skill 仍然需要大量的人工介入，它并不容易。