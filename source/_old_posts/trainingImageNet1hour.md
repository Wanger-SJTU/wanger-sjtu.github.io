---
title: Training ImageNet 1 hour
date: 2019-03-11
catalog: true
tags:
  - paper notes
  - Deep Learning
  - 调参
---

论文针对的是神经网络的训练技巧，在训练过程中如何应对大数据。在增大batchsize的同时，其他参数如何设置，才能使得训练模型鲁棒性更好，不至于准确度下降。论文首先给出了，一般情况下增大batch对于准确度的影响，可以看到一定程度以后，准确度是下降的。

![Figure 1](https://tuchuang-1259359185.cos.ap-chengdu.myqcloud.com/_asserts/training-ImageNet-1-hour/1.jpg)


## large batchsize

### linear scale

论文中使用SGD作为求解器，通常情况下的loss函数可以写成下面的形式。$X$代表了训练数据集，$w$ 表示网络参数， $x\in X $表示了训练数据。

$$
L(w)=\frac{1}{|X|} \sum_{x \in X} l(x, w)
$$

使用`mini-batch`以后，参数的更新方式如下：

$$
w_{t+1}=w_{t}-\eta \frac{1}{n} \sum_{x \in \mathcal{B}} \nabla l\left(x, w_{t}\right)
$$

其中$\mathcal{B}$是一个`batch`的数据，$n=\vert\mathcal{B}\vert$ , $\eta$ 是`lr`， $t$ 迭代次数。

> When the minibatch size is multiplied by $k$, multiply the learning rate by $k$.
>
> `lr` 扩大倍数与`batchSize`的扩大倍数一致

**解释**：
假设在第$t$次跌打，参数为$w_t$，对照两种方式的更新公式，一种的多次迭代，一种是一次迭代。对于前者，我们假设有$k$次迭代，每次的`batch` 为$\mathcal{B}_j,\quad 0 \leq j < k ,\; |\mathcal{B}_j|=n$。学习率为$\eta$

$$
w_{t+k}=w_{t}-\eta \frac{1}{n} \sum_{j< k} \sum_{x \in \mathcal{B}_{j}} \nabla l\left(x, w_{t+j}\right)
$$

后者一次的`batch`为$\cup_j\mathcal{B}_j, \text{size}=kn​$.学习率为$\hat{\eta}​$

$$
\hat{w}_{t+1}=w_{t}-\hat{\eta} \frac{1}{k n} \sum_{j < k} \sum_{x \in \mathcal{B}_{j}} \nabla l\left(x, w_{t}\right)
$$

显然有，二者不太可能相等。假设$\nabla l\left(x, w_{t}\right) \approx \nabla l\left(x, w_{t+j}\right) \text { for } j< k$,   $\hat{\eta}=k \eta$

但是假设有时候是不成立的，比如在梯度变化比较大的时候，这两个的梯度是相差很大的。因此这就需要`warmup phase`.

### Warmup

**Constant warmup**

在开始阶段使用 一个比较小的常数 `lr`， 作者在实验中发现这种方式对于 Fine-tuning, 分割、检测效果不错。具体就是先4-5个epoch，使用较小的`lr`， 然后增大为 `k`倍。

**Gradual warmup**

线性增加`lr`，然后逐步到`kn`

## Batch Normalization with Large Minibatches

`BatchNorm`的统计信息是依赖于`batch`的大小的。

记 $l_{\mathcal{B}}(x, w)$ 为单个样本数据的`loss`， $L(\mathcal{B}, w)=\frac{1}{n} \sum_{x \in \mathcal{B}} l_{\mathcal{B}}(x, w)$ 为 一个Batch的loss。当包含`BN`的时候，有

$$ 
L(w)=\frac{1}{\left|X^{n}\right|} \sum_{\mathcal{B} \in X^{n}} L(\mathcal{B}, w)
$$

不同batch之间的loss计算是相互独立的，但是由于随着batchSize的改变，统计量的计算也有所不同，那么优化的目标函数也会发生改变。
在多GPU训练时，如果每块GPU上的batch大小为`n`，总的batch为`kn`，那可以看作将`kn`大小的batch以`n`大小的batch `forward`了k次。

$$ 
{w_{t+k}=w_{t}-\eta \sum_{j< k} \nabla L\left(\mathcal{B}_{j}, w_{t+j}\right)} 
 $$

$$
{\hat{w}_{t+1}=w_{t}-\hat{\eta} \frac{1}{k} \sum_{j < k} \nabla L\left(\mathcal{B}_{j}, w_{t}\right)}
$$

可以看出$\hat{\eta}=k n$时。

### 一点补充

batchNorm的计算其实是用的是滑动平均，还有如果保持运算性质的话，可以使用`sync BN`

## Distributed SGD 需要注意的点

### Weight decay

Weight decay 对应着loss里面的`L2`正则化损失。可以写为 $l(x, w)=\frac{\lambda}{2}\|w\|^{2}+\varepsilon(x, w)$， $\varepsilon(x, w)$是与样本相关的偏差量
此时SGD的公式为，

$$ 
w_{t+1}=w_{t}-\eta \lambda w_{t}-\eta \frac{1}{n} \sum_{x \in \mathcal{B}} \nabla \varepsilon\left(x, w_{t}\right)
$$

通常来说，与样本相关的部分$\sum \nabla \varepsilon\left(x, w_{t}\right)$才会在反向传播中被计算，$\lambda w_{t}$是单独计算然后加到梯度当中的。因此，当没有 weight decay时， linear scale 是可行的，注意对$\varepsilon(x, w)$ 缩放即可。 但是对 ce loss, linear scale 是不可行的。
> Remark 1: Scaling the cross-entropy loss is not equivalent to scaling the learning rate.

### Momentum correction

$$ 
\begin{aligned} u_{t+1} &=m u_{t}+\frac{1}{n} \sum_{x \in \mathcal{B}} \nabla l\left(x, w_{t}\right) \\ w_{t+1} &=w_{t}-\eta u_{t+1} \end{aligned}
$$

等价于

$$ 
\begin{aligned} v_{t+1} &=m v_{t}+\eta \frac{1}{n} \sum_{x \in \mathcal{B}} \nabla l\left(x, w_{t}\right) \\ w_{t+1} &=w_{t}-v_{t+1} \end{aligned}
$$

当$\eta$ 改变时，为了保证上面两个式子的等价性，应该有

$$ 
v_{t+1}=m \frac{\eta_{t+1}}{\eta_{t}} v_{t}+\eta_{t+1} \frac{1}{n} \sum \nabla l\left(x, w_{t}\right)
 $$

> Remark 2: Apply momentum correction after changing learning rate if using 
$$ 
\begin{aligned} v_{t+1} &=m v_{t}+\eta \frac{1}{n} \sum_{x \in \mathcal{B}} \nabla l\left(x, w_{t}\right) \\ w_{t+1} &=w_{t}-v_{t+1} \end{aligned}
$$

### Gradient aggregation

> Normalize the per-worker loss by total minibatch size `kn`, not per-worker size `n`

### Data shufﬂing

> Remark 4: Use a single random shufﬂing of the training data (per epoch) that is divided amongst all k workers.