---
title:  Pyramid Scene Parsing Network
date:   2018-08-20
catalog: true
tags: 
   - paper notes
---

解决的问题：(FCN)

- Mismatched Relationship: 匹配关系错误，如将在水中的船识别为车。
- Confusion Categories: 模糊的分类，如 hill 和 mountain的区分。
- Inconspicuous classes: 无视小尺寸物品。

这些错误与语义间的关系以及不同感知区域的全局信息有关。

通常情况下，我们可以粗略认为，卷积层卷积核大小（感知域）能够表示结构考虑了多大范围的context。然而，在研究中表面，卷积层实际感知域小于理论。因此，很多结构并不能很好地表现全局信息。（即进行分割任务的时候，不能很好的利用全局信息来约束分割效果） 

**PSPNet 结构**

![PSPnet](https://tuchuang-1259359185.cos.ap-chengdu.myqcloud.com/_asserts/PSP-Network/1.jpg)

- 上图结构首先将输入图片(a)用`ResNet`提取成特征图(b)。
- 通过pyramid pooling modules 来进行不同尺寸的池化。文章中将特征图大小分别池化为：`1x1,2x2,3x3,6x6`。并通过一个卷积层将每个特征通道数变为feature map通道数的`1/N`，其中N为级数，此时N=4。
- 最后将池化结果上采样(文中使用了双线性插值)，与特征图(b)连接后，通过卷积层输出结果。

 这个结构与FCN不同的是，它**通过pyramid的池化层考虑了不同尺寸的全局信息**。而在FCN中只考虑了某一个池化层，如FCN-16s 只考虑pool4。 

![](https://tuchuang-1259359185.cos.ap-chengdu.myqcloud.com/_asserts/PSP-Network/2.jpg)



**辅助loss**

文中还提到了为了训练使用了一个辅助的loss，**网络越深性能越好，但是也越难训练.**(ResNet solves this problem with skip connection in each block”。作者在网络中间引入了一个额外的loss函数，这个loss函数和网络输出层的loss pass through all previous layers，图示如下 

![loss](https://tuchuang-1259359185.cos.ap-chengdu.myqcloud.com/_asserts/PSP-Network/3.jpg)

其中loss1是最终的分割loss（softmax_loss），loss2是添加的辅助loss，二类分交叉熵函数，（多分类问题）

**实现细节**

- 图片输入的CNN是ResNet，使用了dilated convolution
- Pyramid Pooling Module中的conv是１×１的卷积层，为了减小维度和维持全局特征的权重
- Pyramid Pooling Module中的pooling的数量以及尺寸都是可以调节的
- 上采样使用的双线性插值
- poly learning rate policy
- 数据扩增用了：random mirror, random resize(0.5-2), random rotation(-10到10度), random Gaussian blur
- 选取合适的batchsize