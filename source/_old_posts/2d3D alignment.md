---
title:  Marr Revisited 2D-3D Alignment via Surface Normal Prediction
date:   2019-03-14
tags: 
  - Deep Learning
  - Pose Estimation
---
论文是15年CVPR。论文提出了一种2D 3D图像匹配对准的方法，首先对RGB图像预测表面法向，然后结合法向信息做CAD模型搜索进而得到模型的 pose 信息。

效果如下：
![image](https://tuchuang-1259359185.cos.ap-chengdu.myqcloud.com/_asserts/2d3D-alignment/1.jpg)

## Surface Norm
模型结构如下：
![image](https://tuchuang-1259359185.cos.ap-chengdu.myqcloud.com/_asserts/2d3D-alignment/2.jpg)

论文使用VGG-16作为特征提取工具，然后将获得的卷积特征交给后面的全连接层，回归得到法向信息。
不同于一般的利用方法，这里使用的是`hypercolumn`的方法，因为预测的是每一像素点的法向信息，考虑使用使用多层的卷积特征。给定图像 $I$, 位置 $p$ 处的特征定义为 $h_p(I)$, 不同的卷积层输出记为 $C_p^{ji},\quad i = 0\rightarrow \alpha$。 所以有 $h_p(I) = [C_p^{j1}, \cdots, C_p^{j\alpha}]$。 考虑到不同层的特征图大小有所区别，就将其resize 到同样大小（image）。

后面回归网络，loss 函数为

$$ 
\min _{\theta} \sum_{i=1}^{N} \sum_{p}\left\|n_{p}\left(I_{i} ; \theta\right)-\hat{n}_{i, p}\right\|^{2}
$$

## Pose and Style

![image](https://tuchuang-1259359185.cos.ap-chengdu.myqcloud.com/_asserts/2d3D-alignment/3.jpg)

### PoseNet

这部分是对目标的姿态进行估计，在这部分中将姿态估计问题转化为视角分类问题。将视角离散化为36类，然后利用修改过的AlexNet 作为分类网络进行估计。这个网络没有什么好说的，就是两边输入分别为Image和Norms，pool5以后的feature map 合在一起进行分类。
该论文使用了 `Render CNN` 将渲染图与真实场景结合到一起进行训练。而非直接利用渲染图训练。

### StyleNet

上述网络仅仅分类了Pose的信息，没有用到关于目标本身形状信息。因此提出使用StyleNet分析目标与CAD模型之间的Style关系。
该部分使用的仍然是AlexNet，不同的是这里用的是孪生网络。用来判断两个输入对象的匹配程度。为此，手工标注了图像与CAD模型之间的风格匹配关系，将匹配的记作$(p,q)$， 差异比较大的记作$(q,n)$。 优化判别loss

$$ 
\begin{aligned}
L(\Theta)&=\sum_{(q, p)} L_{p}\left(f_{q}, f_{p}\right)+\sum_{(q, n)} L_{n}\left(f_{q}, f_{n}\right)\\
L_{p}\left(f_{q}, f_{p}\right)&=\left\|f_{q}-f_{p}\right\|_{2} \\   
L_{n}\left(f_{q}, f_{n}\right)&=\max \left(m-\left\|f_{q}-f_{n}\right\|_{2}, 0\right) \quad m=1
\end{aligned} 
$$

## Retrival

检索方面，PoseNet和StyleNet都是依靠boundingBox来优化的。

### based on Norm

在给定boundingBox里面，变换CAD模型来确定模型旋转角度与大小。

使用了两种方法评价角度问题：
 - 计算点积
 - >compute the angular error between the two, and then compute the percentage of pixels within 30° angular error (we call this criteria ‘Geom’)

### based on PoseNet and StyleNet
基于`pool5`特征的检索。

## 关于这篇论文
这篇论文相对于之前的文章，改动创新不大。实验很充分，检索方面倒是缺少跟不同物体的模型输出。

启发主要有以下几点：
- 关于表面法向对于姿态估计的影响能有多大
- 能否有一个End2End框架解决这个问题，（包括分割、法向估计，精确位姿）