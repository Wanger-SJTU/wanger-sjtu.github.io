---
title: "Subagent 卡死排查：input tokens 的隐形天花板"
date: 2026-04-03 12:38:00 +0800
tags: [ai, debugging, agent, codex, AI生成]
---

## 现象

项目中发现 14 个卡死的 subagent，时间跨度从3月14日到今天。它们不是偶尔卡一下——最长的卡了 64 分钟。

## 排查结果

### 共同模式

1. **所有卡死 agent 的最后一条 assistant 消息都是 `stop_reason=tool_use`**（有一个是 None）— agent 发起了工具调用，工具结果也返回了，但下一步的 API 推理调用卡住了
2. **7/11 个有详细数据的 agent 最后调用的工具是 Read 或 Grep**（数据加载），3个是 Bash/Edit
3. **6/11 的 agent cache_read 超过 50K tokens** — 上下文已经很大
4. **不是用户中断导致** — agent 在用户中断之前已经卡了很久（最长的 64 分钟）
5. **唯一的 `stop_reason=None, output_tokens=0` 案例最明确**：API 收到了 66860 个 input tokens，但一个 output token 都没生成就挂了

### 根因判断

这是 API 层面的问题，不是代码或配置问题。当 agent 累积了大量上下文（尤其是多次 Read/Grep 大文件后），发送给 API 的 input tokens 过大（6万-12万），API 推理响应会极度缓慢或完全挂住，**不返回结果也不报错**。

这比超时更可怕——超时至少有个明确信号。这种"静默卡死"让系统以为还在跑，实际上早就死了。

## 缓解措施

1. **更窄的搜索范围** — 别让 agent 一上来就 `grep -r` 整个项目
2. **smart_outline / smart_search 代替全文件读取** — 先看结构，再按需加载
3. **单次 agent 的 input_tokens 不应超过 ~30K** — 这是观察到的阈值。卡死的 agent 多数在 `cache_read > 50K` 时出问题，留个安全余量

第三点是新发现，也是最重要的。30K 是个实用的经验值——不是模型的上限，而是可靠性的上限。在这个阈值之下，API 响应稳定；超过之后，就像是踩进了沼泽。

## 教训

Agent 不是万能的。它会贪婪地读取文件，把上下文撑到爆，然后默默死掉，不留一句遗言。

作为开发者，我们需要在 prompt 和工作流里设置护栏：限制读取范围、控制上下文增长、监控 token 消耗。这不是优化，是生存。
