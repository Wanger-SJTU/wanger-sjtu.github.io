
---
title: 熵和交叉熵
date:   2018-04-13
catalog: true
tags: 
   - Deep Learning
---

熵的本质是香农信息量 $\log(1/p)$ 的期望。

现有关于样本集的2个概率分布 $p$ 和 $q$ ，其中$p$为真实分布，$q$非真实分布。按照真实分布$p$来衡量识别一个样本的所需要的编码长度的期望(即平均编码长度)为：$H(p)=\sum_{i}p(i)*\log(1/p(i))$。如果使用错误分布$q$来表示来自真实分布$p$的平均编码长度，则应该是：
$$H(p,q)=\sum_{i} p(i)* \log(1/q(i))$$ 。因为用$q$来编码的样本来自分布$p$，所以期望$H(p,q)$中概率是$p(i)$。
$H(p,q)$我们称之为**交叉熵**

交叉熵公式
$$
J(\theta)=-\frac{1}{N}\sum_{i=1}^N y^{(i)}\log(h_{\theta}(x^{(i)}))+(1-y^{(i)})\log(1-h_{\theta}(x^{(i)}))
$$



### KL散度(Kullback–Leibler divergence，KLD)

根据非真实分布$q$得到的平均编码长度$H(p,q)$大于根据真实分布$p$得到的平均编码长度$H(p)$。事实上，根据[Gibbs' inequality](https://en.wikipedia.org/wiki/Gibbs%27_inequality)可知，$H(p,q)>=H(p)$恒成立，当$q$为真实分布$p$时取等号。我们将由$q$得到的平均编码长度比由$p$得到的平均编码长度多出的bit数称为“相对熵”：
$$
\begin{aligned}
	D(p||q) &= H(p,q)-H(p) \\
			       &=\sum_i p(i)  \times \log \frac{p(i)}{q(i)}
\end{aligned}
$$
其又被称为KL散度( [Kullback–Leibler divergence](https://en.wikipedia.org/wiki/Kullback%E2%80%93Leibler_divergence)，KLD)。它表示2个函数或概率分布的差异性：差异越大则相对熵越大，差异越小则相对熵越小，特别地，若2者相同则熵为0。

### sigmoid cross-entropy



### softmax cross-entropy

#### softmax

$$
y^{(i)}=\frac{e^{a_i}}{\sum_{k=1}^C e^{a_k}}
$$

#### softmax cross-entropy

$$
loss = - \sum_{i=1}^N \log(y^{(i)})
$$

