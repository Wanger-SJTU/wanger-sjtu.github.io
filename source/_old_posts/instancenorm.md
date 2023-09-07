---
title:  instance norm
date:   2018-09-20
catalog: true
tags: 
   - paper notes
---
 

与Batch Norm加快计算收敛不同， IN是在[1]中提出的，目的是提高style transfer的表现。

![](https://tuchuang-1259359185.cos.ap-chengdu.myqcloud.com/_asserts/instance-norm/1.jpg)

计算如下：

$$
IN(x)=\gamma (\frac{x-\mu(x)}{\sigma(x)}+\beta)
$$

其中

$$
\mu_{nc}(x)=\frac{1}{HW}\sum\sum(x_{nchw})
$$

$$
\sigma_{nc}(x)=\sqrt{\frac{1}{HW}\sum\sum(x_{nchw}-\mu_{nc}(x))^2+\epsilon}
$$

可以看到，IN是对每个channel的计算。（感觉上跟layer norm很像。）

**解释**

关于为什么IN在style transfer和Image generation的任务上表现更好，有很多解释。这里只介绍[2]中的解释，因为实验比较充分。

![](https://tuchuang-1259359185.cos.ap-chengdu.myqcloud.com/_asserts/instance-norm/2.jpg)

IN作者认为IN有效的原因在于IN是对图像的对比度进行了Norm，所以效果好，但是[2]的实验表明，并非如此，如图b所示，训练图像事先对比度归一化以后，IN的表现仍然好很多。但是在均统一为一个风格以后（图c），两者差别就很小了。

- IN 可以认为，是一种风格的norm。即可以通过IN将图像在feature space 转化到另一个style。

>  Our results indicate that IN does perform a kind of style normalization.
>
> Since BN normalizes the feature statistics of a batch of samples instead of a single sample, it can be intuitively understood as normalizing a batch of samples to be centered around a single style. Each single sample, however, may still have different styles. This is undesirable when we want to transfer all images to the same style, as is the case in the original feed-forward style transfer algorithm [51].
> Although the convolutional layers might learn to compensate the intra-batch style difference, it poses additional challenges for training. On the other hand, IN can normalize the style of each individual sample to the target style. Training is facilitated because the rest of the network can focus on content manipulation while discarding the original style information. The reason behind the success of CIN also becomes clear: different afﬁne parameters can normalize the feature statistics to different values, thereby normalizing the output image to different styles.

---

**ref**

1. Instance Normalization: The Missing Ingredient for Fast Stylization
2. Arbitrary Style Transfer in Real-time with Adaptive Instance Normalization