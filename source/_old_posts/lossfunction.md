---
title: loss function
date:   2018-07-17
catalog: true
tags: 
   - paper notes
---

损失函数（loss function）是用来估量你模型的预测值f(x)与真实值Y的不一致程度，它是一个非负实值函数,通常使用$L(Y, f(x))$来表示，损失函数越小，模型的鲁棒性就越好。损失函数是**经验风险函数**的核心部分，也是**结构风险函数**重要组成部分。模型的结构风险函数包括了经验风险项和正则项，通常可以表示成如下式子：
$$
θ^∗=\arg \min_{θ} \frac{1}{N}∑_{i=1}^N L(y_i,f(x_i;θ))+λ Φ(θ)
$$
其中，前面的均值函数表示的是经验风险函数，$L$代表的是损失函数，后面的$Φ$是正则化项（regularizer）或者叫惩罚项（penalty term），它可以是L1，也可以是L2，或者其他的正则函数。整个式子表示的意思是**找到使目标函数最小时的$θ$值**。下面主要列出几种常见的损失函数。



## logistic loss function

针对二分类而言,
$$
J(θ)=−\frac{1}{m}∑_{i=1}^m[y(i)\log h_θ(x^{(i)})+(1−y^{(i)})\log(1−h_θ(x^{(i)}))]
$$

## Cross Entropy(交叉熵)

交叉熵越小，就证明算法所产生的策略越接近最优策略，也就间接证明我们的算法所计算出的非真实分布越接近真实分布

 交叉熵损失函数从信息论的角度来说，其实来自于KL散度，只不过最后推导的新式等价于交叉熵的计算公式：

$$
H(p,q)=−\sum_{k=1}^N(p_k∗\log q_k) H(p,q)=−\sum_{k=1}^N(p_k∗\log q_k)
$$

**最大似然估计、Negative Log Liklihood(NLL)、KL散度与Cross Entropy其实是等价的**，都可以进行互相推导，当然MSE也可以用Cross Entropy进行对到出（详见Deep Learning Book P132）。