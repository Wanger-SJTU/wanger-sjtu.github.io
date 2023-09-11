---
title: 从向量数据库到 ANN search
tags:
  - ANN 
  - 向量检索
category:
  - ANN
date: 2023-09-10 11:54:04
---

LLM的模型的爆火，意外带动了向量数据库的热度。之前名不见经传的一些初创公司也突然备受追捧。最近在分析端侧LLM场景的时候也分析了相关的一些向量数据库的相关知识。

# GPT的缺陷
chatgpt在对话过程中表现出的能力包括了一定的上下文检索能力。但这个能力是基于LLM本身的上下文理解能力完成的，但受限于多数模型是基于kv cache结构的记忆历史对话信息的，kv cache size是有限的，在长程记忆上就天然存在一些缺陷。另一方面，在跨对话的场景下，这些上下文信息也不能使用。如果在端侧作为一个数字助理的场景来看，这显然是不合格的。

不同模型对于 token 的限制也不同，gpt-4 是 32K tokens 的限制，而目前最大的 token 限制是 Claude 模型的 100K，这意味可以输入大约 75000 字的上下文给 GPT，这也意味着 GPT 直接理解一部《哈利波特》的所有内容并回答相关问题。

这时候就可能觉得，那我把上下文信息一起发给LLM模型不就可以了。这就到了向量数据库的场景范畴了。在处理用户输入的时候，先去通过向量查找得到一些相关信息，一起输入给LLM模型，这样就可以正确回答相关信息了。

![](ANN-algo/Embedding.png)

# ANN Search

向量数据库说起来并不是一个新鲜的技术了，在统计机器学习时代，做KNN算法的时候就已经在研究相关的技术了。这里就简要的介绍一下原理和算法。

ANN搜索（Approximate nearest neighbor）, 本质上是在很多稠密向量中，迅速找到目标点的临近点，并认为这认为是相似的节点，主要用于图像检索、高维检索。这里隐含了一个假设，映射在同一向量空间且距离相近的点，具有相似的语义特征，距离越近越相关，反之关系越远。

当前 ANN 搜索的方法大都是对空间进行切分，可以迅速找到子空间，并与子空间的数据进行计算。方法主要有基于树的方法、哈希方法、矢量量化、基于图的方法。

## 基于树的方法
基于树的方法最经典的就是KD树了。
![](ANN-algo/kd-tree.png)

**构建**
KD树构建的过程就是迭代二分空间的过程
经典算法：
选择方差最大的维度,计算中位数点，作为划分点，分为左右子树，迭代上述过程, 直到空间上的点小于阈值

**检索**
因为ANN这个任务并不像关系数据库中那样需要精准的结果，而是得到其中Top-K的候选结果返回。
KD树的检索过程其实就是一个二叉树的回溯搜索过程：

1. 根据目标p的坐标和kd树的结点向下进行搜索，如果树的结点root是以数据集的维度d以来切分的，那么如果p的维度d坐标值小于root，则走左子结点，否则走右子结点。
2. 到达叶子结点时，将其标记为已访问。如果S中不足k个点，则将该结点加入到S中；否则如果S不空且当前结点与p点的距离小于S中最长的距离，则用当前结点替换S中离p最远的点。
3. 如果当前结点不是根节点，执行（a）；否则，结束算法。 
  a.  回退到当前结点的父结点，此时的结点为当前结点（回退之后的结点）。将当前结点标记为已访问，执行（b）和（c）；如果当前结点已经被访过，再次执行（a）。 
  b. 如果此时S中不足k个点，则将当前结点加入到S中；如果S中已有k个点，且当前结点与p点的距离小于S中最长距离，则用当前结点替换S中距离最远的点。 
  c. 计算p点和当前结点切分线的距离。如果该距离大于等于S中距离p最远的距离并且S中已有k个点，执行步骤3；如果该距离小于S中最远的距离或S中没有k个点，从当前结点的另一子节点开始执行步骤1；如果当前结点没有另一子结点，执行步骤3。

## LSH
LSH即 local sensitive hash，局部敏感哈希。不同于sha256、MD5这种避免碰撞的函数，这里我们选取hash函数的时候希望语义相近的向量可以映射到同一个桶里。这里有一个前提在的：
> 原始数据空间中的两个相邻数据点通过相同的映射或投影变换（projection）后，这两个数据点在新的数据空间中仍然相邻的概率很大，而不相邻的数据点被映射到同一个桶的概率很小。

![](ANN-algo/lsh.png)

**构建**
1. 选取一组的LSH hash functions；
2. 将所有数据经过 LSH hash function 哈希到相应的hash码，所有hash数据构成了一个hash table；

**检索**

1. 将查询数据经过LSH hash function哈希得到相应的编码；
2. 通过hamming 距离计算query数据与底库数据的距离，返回最近邻的数据

当然也有其他的实现方案，这里不一一列举了。
## 量化

### PQ量化

### SQ量化

## IVF类方法
## 基于图的方法



### NSW

### HNSW
# 部署加速方案

