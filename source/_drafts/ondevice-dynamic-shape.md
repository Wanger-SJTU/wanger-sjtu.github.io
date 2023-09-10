---
title: 端侧AI框架动态shape的现状和展望
tags:
  - TVM
  - 框架
category:
  - XX
date: 2023-09-10 12:50:34
---

# 背景
 - 语音场景天然的shape不固定
 - llm的kv cache
 - llm 处理用户输入的prefill
 - 墨水屏局部刷新
 - 
 
主要面对的问题和挑战
 - shape推导
 - 内存分配
 - 最优schedule

场景
1. 动态batch
2. 单一维度可变
3. 多维度可变


当前方案的取舍 

- nimble tvm vm方案，符号shape，内存动态申请，手调shape
- diet code 解决的问题sch生成
- mnn mslite 显示resize
- disc


算子优化难题
- 算子切分
- 算子融合参数

对 sch 约束
- 最大化利用计算单元能力，计算边界在哪儿

设想
- latency优先
- ddr占用