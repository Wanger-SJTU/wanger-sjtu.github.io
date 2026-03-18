---
title: 简历
layout: resume
name: 王二
job_title: AI Infra 工程师 (端侧推理与异构计算)
email: wanger.infra@example.com
wechat: wanger-01
location: 上海
github: [https://github.com/Wanger-SJTU](https://github.com/Wanger-SJTU)
website: [https://wanger-sjtu.github.io/](https://wanger-sjtu.github.io/)
updated: 2026-03-18
---

## 个人简介

深耕端侧 AI 基础设施领域，专注于 **aarch64 架构**下的高性能算子开发与大模型推理优化。拥有扎实的计算机体系结构基础，擅长在受限硬件资源（NPU/GPU/DRAM）下通过软硬协同提升推理吞吐量，具备 **MoE 稀疏激活**与**端侧向量检索加速**的实战经验。

## 技能

- **底层架构**：精通 ARMv8/v9 (aarch64) 指令集、NEON 指令集优化、SoC 内存层次结构 (Cache/TCM/DRAM)
- **AI 部署**：精通量化 (INT8/FP16 PTQ)、算子融合 (Op Fusion)、KV Cache 管理、Mixture-of-Experts (MoE) 推理优化
- **开发工具**：高性能 C++ (14/17)、CMake 交叉编译、SIMD 汇编、GDB/Perf 性能调优
- **系统协议**：熟悉 UFS 4.0 存储协议、M-PHY 物理层交互及高效数据预取策略

## 工作经历

### AI Infra 工程师 | XXX 半导体技术有限公司
*2020.04 - 至今*

- **端侧大模型加速计划**：负责 **OpenClaw MoE** 模型在手机端 NPU 的适配与加速，通过优化专家交换（Expert Swapping）逻辑，将推理时首字延迟（TTFT）降低 **35%**。
- **自研推理引擎开发**：主导 NPU 算子库建设，利用 NEON 手写高性能卷积与矩阵乘法算子，在某旗舰 SoC 上较标准库性能提升 **25%**。
- **工程化链路建设**：优化全栈交叉编译工作流，支持多型号 NPU 自动化部署，将模型上线周期从周级缩短至天级。

## 项目经历

### 端侧向量数据库加速层实现
*技术栈：C++ / aarch64 / SIMD / 磁盘持久化*

- **背景**：针对端侧 RAG 场景，原有检索层内存压力大、无落盘能力。
- **优化**：设计并实现了支持 **CRUD 与持久化** 的向量存储引擎。引入 **Columnar Storage（列式存储）** 架构，大幅提升 SQL-like 字符串过滤性能（如 `age > 20`）。
- **成果**：在资源受限环境下实现了百万级向量的毫秒级检索，成功打通了端侧知识库的闭环。

### MoE 专家激活与 KV 管理视图优化
*技术栈：Python (PyTorch) / C++ / Prefix Tree*

- **背景**：MoE 模型在端侧推理时存在频繁的内存交换与专家激活瓶颈。
- **优化**：设计了基于 **Prefix Tree (前缀树)** 的 KV Cache 管理方案，通过逻辑视图优化降低重复计算；实现了一种基于专家激活频率的预加载算法。
- **成果**：显著减少了推理过程中的 I/O 阻塞，在 8GB 内存机型上实现了 7B 规模 MoE 模型的流畅运行。

## 教育背景

### 计算机科学与技术 | 上海交通大学 (SJTU)
*2017 - 2020*

- 硕士
- 核心课程：计算机体系结构、操作系统原理、并行计算、编译原理

## 其他

- **技术影响力**：长期维护个人技术博客，撰写多篇关于《UFS 4.0 协议分析》及《MoE 推理优化》的深度文章，行业关注度高。
- **开源贡献**：活跃于 GitHub 社区，对某知名端侧推理框架提交过核心算子性能优化 PR。
