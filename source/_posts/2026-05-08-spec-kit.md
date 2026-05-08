---
title: "GitHub Spec Kit 尝鲜：规格驱动开发让 AI 帮你写代码"
description: "用自然语言描述需求，AI 直接生成可运行代码"
author: "浮之静"
source: "https://github.com/github/spec-kit"
date: "2026-05-08"
tags: ["翻译", "AI", "Coding Agent", "GitHub", "Spec-Driven Development"]
mathjax: false
---

# GitHub Spec Kit 尝鲜：规格驱动开发让 AI 帮你写代码

*原文：[github/spec-kit](https://github.com/github/spec-kit)，GitHub 出品*

---

## 核心概念：规格驱动开发（Spec-Driven Development）

**Spec Kit** 是 GitHub 开源的工具包，核心理念一句话：**规格说明成为可执行的东西，代码从"主导"变成"服从"**。

几十年来，软件工程的权力结构是这样的：代码为王，规格说明只是" scaffolding"——搭完就扔。PRD 是为了引导开发，设计文档是为了告知实现，架构图是为了可视化结构。但这些都是代码的从属品。代码即真理，其他不过是美好的愿望。

**规格驱动开发（SDD）把这个权力结构彻底反转**：规格说明不再服务于代码，代码服务于规格说明。

PRD 不是实现的指南，而是生成实现的源头。技术方案不是告知编码的文档，而是精确生成代码的定义。这不是对软件开发方式的渐进改进，而是对"什么驱动开发"的根本反思。

> 当规格说明和实现方案能直接生成代码时，规格和实现之间就没有GAP了——只有转换。

## 为什么现在 SDD 变得可能且必要？

三个趋势叠加：

1. **AI 能力跨越了临界点**：自然语言规格说明现在可以可靠地生成可工作代码。这不是替代开发者，而是通过自动化"规格→实现"的机械翻译来放大他们的效能。

2. **软件复杂度指数增长**：现代系统集成数十个服务、框架和依赖。传统手动流程根本无法保持所有部分与原始意图对齐。SDD 通过规格驱动的生成提供了系统性对齐。

3. **变化速度前所未有**：需求变化比以往任何时候都快。Pivot 不再是例外——而是常态。SDD 把需求变更从障碍变成正常的工作流程。改 PRD 中的核心需求，受影响的技术决策自动标记。

## SDD 工作流：6 步从想法到代码

### 第 1 步：安装 Specify CLI

```bash
# 推荐：用 uv 安装稳定版本（先安装 uv：https://docs.astral.sh/uv/）
uv tool install specify-cli --from git+https://github.com/github/spec-kit.git@vX.Y.Z

# 验证安装
specify version

# 初始化项目
specify init <PROJECT_NAME>
# 或在现有项目中初始化（支持 Copilot 等集成）
specify init . --integration copilot
```

### 第 2 步：建立项目原则宪章

用 `/speckit.constitution` 命令创建项目治理原则和开发指南，后续所有开发都受其指导：

```bash
/speckit.constitution Create principles focused on code quality, testing standards, user experience consistency, and performance requirements
```

### 第 3 步：创建规格说明

用 `/speckit.specify` 命令描述你要构建的内容。**聚焦"是什么"和"为什么"，而非技术栈**：

```bash
/speckit.specify Build an application that can help me organize my photos in separate photo albums. Albums are grouped by date and can be re-organized by dragging and dropping on the main page. Albums are never in other nested albums. Within each album, photos are previewed in a tile-like interface.
```

这个命令会自动：
- 扫描现有 specs 确定下一个功能编号（如 001, 002...）
- 创建语义化分支名并自动切换
- 在 `specs/[分支名]/` 下生成完整的规格文档结构

### 第 4 步：创建技术实现方案

用 `/speckit.plan` 命令提供技术栈和架构选择：

```bash
/speckit.plan The application uses Vite with minimal number of libraries. Use vanilla HTML, CSS, and JavaScript as much as possible. Images are not uploaded anywhere and metadata is stored in a local SQLite database.
```

自动生成：
- `plan.md` — 完整实现方案
- `research.md` — 技术调研（如 WebSocket 库对比）
- `data-model.md` — 数据模型（Message 和 User schema）
- `contracts/` — API 契约和 WebSocket 事件定义
- `quickstart.md` — 关键验证场景

### 第 5 步：拆解任务

用 `/speckit.tasks` 命令从实现方案生成可执行任务清单：

```bash
/speckit.tasks
```

自动分析 `plan.md`、`data-model.md`、`contracts/` 和 `research.md`，生成：
- `tasks.md` — 从方案中派生出的任务列表
- 标记可并行执行的任务 `[P]`
- 输出安全并行组

### 第 6 步：执行实现

用 `/speckit.implement` 命令按方案执行所有任务：

```bash
/speckit.implement
```

## 传统开发 vs SDD：对比有多悬殊

| 传统方式 | SDD + 命令 |
|---|---|
| 写 PRD 文档（2-3 小时）| 描述需求（5 分钟）|
| 创建设计文档（2-3 小时）| 自动生成完整规格说明 |
| 手动搭建项目结构（30 分钟）| 自动创建分支和目录结构 |
| 编写技术规格（3-4 小时）| 自动生成技术方案 + API 契约 |
| 创建测试计划（2 小时）| 规格说明中已包含测试场景 |
| **总计：~12 小时文档工作** | **总计：~15 分钟** |

15 分钟内你就有了：
- 包含用户故事和验收标准的完整功能规格说明
- 包含技术选型和理由的详细实现方案
- 可直接用于代码生成的 API 契约和数据模型
- 自动化和手动测试的全面测试场景
- 全部正确版本化在功能分支中

## 模板的约束力：如何强迫 LLM 输出高质量规格

Spec Kit 的真正力量不只是自动化，而是**模板如何引导 LLM 行为**。

### 1. 防止过早的实现细节

规格模板明确指示：

```
- ✅ 聚焦用户需要什么（WHAT）以及为什么（WHY）
- ❌ 避免如何实现（HOW）—— 不写技术栈、API、代码结构
```

这个约束防止 LLM 跳到"用 React + Redux 实现"，而是聚焦于"用户需要实时数据更新"。

### 2. 强制显式的疑问标记

两个模板都强制使用 `[NEEDS CLARIFICATION]` 标记：

```
当从用户提示创建规格时：
1. 标记所有歧义：用 [NEEDS CLARIFICATION: 具体问题]
2. 不要猜测：如果提示没有指定某事，标记它
```

这防止了 LLM"合理猜测但可能错误"的常见行为。

### 3. 通过检查清单的结构化思维

模板包含综合性检查清单，作为规格的"单元测试"：

```markdown
### 需求完整性
- [ ] 没有剩余的 [NEEDS CLARIFICATION] 标记
- [ ] 需求可测试且无歧义
- [ ] 成功标准可衡量
```

### 4. 通过门控的宪章合规

实现方案模板通过阶段门强制执行架构原则：

```markdown
### 阶段 -1：实现前门控

#### 简洁性门（第 VII 条）
- [ ] 使用 ≤3 个项目？
- [ ] 没有过度前瞻？

#### 反抽象门（第 VIII 条）
- [ ] 直接使用框架？
- [ ] 单一模型表示？
```

这些门防止过度工程，让 LLM 必须明确记录复杂度理由。

### 5. 测试优先思维

模板强制测试优先开发顺序：

```markdown
### 文件创建顺序
1. 用 API 规格创建 `contracts/`
2. 按顺序创建测试文件：契约 → 集成 → e2e → 单元
3. 创建源文件使测试通过
```

## 社区扩展：40+ 扩展覆盖全流程

| 扩展 | 用途 | 类型 |
|---|---|---|
| **MAQA** | 多 Agent + QA 协调工作流，并行基于 worktree 的实现 | 流程 |
| **Jira Integration** | 从 spec-kit 规格创建 Jira Epic、Story 和 Issue | 集成 |
| **Azure DevOps Integration** | 同步用户故事和任务到 Azure DevOps 工作项 | 集成 |
| **CI Guard** | CI/CD 中的规格合规门控，验证规格存在、检查漂移、阻止合并缺口 | 流程 |
| **Fix Findings** | 自动分析-修复-再分析循环，直到规格问题清零 | 代码 |
| **Checkpoint Extension** | 在实现过程中间提交变更，避免最终只有一个巨大提交 | 代码 |
| **Fleet Orchestrator** | 在所有 SpecKit 阶段通过人工门控编排完整功能生命周期 | 流程 |
| **Memory MD** | 仓库原生的 Markdown 记忆，捕获持久决策、bug 和项目上下文 | 文档 |
| **Cost Tracker** | 跨 SDD 工作流追踪真实 LLM 美元成本，按功能预算、按集成对比 | 可视化 |
| **Architect Impact Previewer** | 在实现前预测架构影响、复杂度和风险 | 可视化 |

## 支持的 AI Coding Agent 集成

- **GitHub Copilot**（自然支持）
- **Claude Code**（通过 `/speckit.*` 斜杠命令）
- **OpenAI Codex CLI**（通过 `$speckit-*` 命令）
- 其他兼容 MCP 的 Agent

## 核心理念总结

> **规格即通用语言**：规格说明成为主要产物，代码成为其在特定语言和框架中的表达。维护软件即演进规格。

> **可执行规格**：规格说明必须足够精确、完整和无歧义，以生成可工作的系统。这消除了意图和实现之间的鸿沟。

> **持续精炼**：一致性验证持续进行，而非一次性门控。AI 持续分析规格中的歧义、矛盾和缺口。

> **研究驱动的上下文**：研究 Agent 在规格过程中收集关键上下文——调查技术选项、性能影响和组织约束。

> **双向反馈**：生产现实告知规格演进。指标、故障和运维学习成为规格精炼的输入。

---

一句话总结：**Spec Kit 让"先想清楚再写代码"从情怀变成工程实践**。当你用自然语言描述清楚需求之后，AI 会帮你生成规格、方案、任务清单，最后直接生成代码。你做的更多是审查和决策，而非打字。

链接：[github/spec-kit](https://github.com/github/spec-kit) | [文档](https://github.github.io/spec-kit/) | [视频介绍](https://www.youtube.com/watch?v=a9eR1xsfvHg)
