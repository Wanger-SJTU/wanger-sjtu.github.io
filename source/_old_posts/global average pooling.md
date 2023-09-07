---
title: global average pooling
date:   2018-08-01
catalog: true
tags: 
   - Deep Learning
---


首先需要对深度网络中常见的pooling方式，以及全连接层有大致的了解。（此处略过不提。）

paper: [Network in Network](https://arxiv.org/abs/1312.4400)

### fully connected layer 的缺点

在NIN论文中，提到全连接层参数多，容易陷入过拟合，降低了模型的泛化能力。

### Global Average Pooling

既然全连接网络可以使feature map的维度减少，进而输入到`softmax`，但是又会造成过拟合，是不是可以用pooling来代替全连接。

NIN中提到的 GAP 的是将每一个feature map 得到一个分类的score。

答案是肯定的，Network in Network工作使用GAP来取代了最后的全连接层，直接实现了降维，更重要的是极大地减少了网络的参数(CNN网络中占比最大的参数其实后面的全连接层)。Global average pooling的结构如下图所示: ![gap-structure](https://tuchuang-1259359185.cos.ap-chengdu.myqcloud.com/_asserts/global-average-pooling/1.JPG) 

每个讲到全局池化的都会说**GAP就是把`avg pooling`的窗口大小设置成`feature map`的大小**，这虽然是正确的，但这并不是GAP内涵的全部。**GAP的意义是对整个网络从结构上做正则化防止过拟合**。既要参数少避免全连接带来的过拟合风险，又要能达到全连接一样的转换功能，怎么做呢？直接从feature map的通道上下手，如果我们最终有1000类，那么最后一层卷积输出的feature map就只有1000个channel，然后对这个feature map应用全局池化，输出长度为1000的向量，这就相当于**剔除了全连接层黑箱子操作的特征，直接赋予了每个channel实际的类别意义。**

实验证明，这种方法是非常有效的，

这样做还有另外一个好处：不用在乎网络输入的图像尺寸。

同时需要注意的是，使用gap也有可能造成收敛变慢。

## 思考

1. inception 和Xception的结构其实也可以看作是NIN的一个结构
2. GAP 是一种减小参数的方式，可以获得全局的信息。
3. 

ref:

1. http://blog.leanote.com/post/sunalbert/Global-average-pooling