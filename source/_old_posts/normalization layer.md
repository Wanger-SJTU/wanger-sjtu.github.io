---
title:      BN及其变体   				# 标题 
catalog: true 						# 是否归档
tags:								#标签
    - Deep Learning
---


1. Batch norm 介绍  [BN](./batch norm.md)
2. IN介绍[IN](./instance norm.md)

## Batch-Renormalization

1. 问题

   batch norm原作者对其的优化，该方法保证了train和inference阶段的等效性，解决了非独立同分布和小minibatch的问题

2. 算法

    ![Batch-Renormalization](https://tuchuang-1259359185.cos.ap-chengdu.myqcloud.com/_asserts/normalization-layer/1.jpg)
   
   `r`和`d`首先通过minibatch计算出，但stop_gradient使得**反传中`r`和`d`不被更新**，因此r和d不被当做训练参数对待。试想如果r和d作为参数来更新，如下式所示：

   ![](http://ww1.sinaimg.cn/large/007arC1sgy1g0wjh15lqkj30f502y0sq.jpg)



   这样一来，就相当于在训练阶段也使用`moving averages`  $μ$和$σ$，这会引起梯度优化和normalization之间的冲突，优化的目的是通过对权重的scale和shift去适应一个minibatch，normalization则会抵消这种影响，
   而moving averages则消除了归一化后的激活对当前minibatch的依赖性，使得minibatch丧失了对每次权重更新方向的调整，从而使得权重尺度因normalization的抵消而无边界的增加却不会降低loss。而在前传中r和d的仿射变换修正了minibatch和普适样本的差异，使得该层的激活在inference阶段能得到更有泛化性的修正。

3. 

## Weight-Normalization

## Layer Norm

## Group Norm

## Ada-BN

Ada-BN提出是为了解决域适应问题（Domain Adaption）问题。作者统计发现，对于源域的数据，通过BN层以后，可以达到很好的白化效果，但是由于目标和源域之间的分布差异，源域的BN层的统计值并不适应于目标域，因此可以通过替换源域模型的参数目标域参数的方法来进行域适应。

## Ada-IN



## IBN

IBN-net 是将`resnet`中的BN替换成BN和IN。





ref:[https://zhuanlan.zhihu.com/p/33173246]



