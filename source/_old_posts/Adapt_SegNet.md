---
title:  Learning to Adapt Structured Output Space for Semantic Segmentation
date:   2018-07-22
catalog: true
tags: 
   - paper notes
---

[github code](https://github.com/wasidennis/AdaptSegNet)

## 网络结构

![adapted SegNet](https://tuchuang-1259359185.cos.ap-chengdu.myqcloud.com/_asserts/Adapt-SegNet/1.jpg).png)

网络结构：

一个segmentation 作为G，还有一个Discriminator分辨feature map来自于哪个域（多尺度）。



**loss function**
$$
L(I_s, I_t) = L_{seg}(I_s) + λ_{adv}L_{adv}(I_t),
$$
这里的$L_{seg}$用的是从cross-entropy, $L_{adv}$是adversarial loss。



## Output Space Adaptation

使用的low-dimensional soft-max output. 作者提到的是，对于segmentation，high layer 存有的是语义信息，（在image-classification 任务中，使用高层信息迁移是足够的）但是**在segmentation 中，使用的不仅仅是语义信息，还有局部的相关性，语义信息等**。**作者认为无论图像来自哪个域，学习到的特征是具有相似性的。局部信息和全局信息都应该是具有相似性的。**

### Single-level Adversarial Learning

**Discriminator Training** 
$$
\mathcal{L}_d(P ) = − \sum_{h,w}(1 − z) \log(D(P )^{(h,w,0)}) +z\log(D(P )^{(h,w,1)})
$$
这里是用cross-entropy 进行的二分类。



**Segmentation Network Training**

***source domain***
$$
\mathcal{L}_{seg}(I_s) = −\sum_{h,w}\sum_{c\in C}Y_s^{(h,w,c)}\log(P_s^{(h,w,c)})
$$
 $Y_s$ is the ground truth annotations for source images and $P_s = G(I_s)$ is the segmentation output.

 ***target domain*** 
$$
\mathcal{L}_{adv}(I_t) = −\sum_{h,w}\log(D(P_t)^{(h,w,1)})
$$
通过将target predication 认为 source predication， 最大化这个概率，可以达到欺骗 Discriminator的目的。



### Multi-level Adversarial Learning

此时考虑不同的层的信息
$$
\mathcal{L}(I_s, I_t) = \sum_i λ^i_{seg}\mathcal{L}^i_{seg}(I_s) + \sum_i λ^i_{adv}\mathcal{L}^i_{adv}(I_t),
$$

## 实现细节

**Discriminator**

5个卷积层，卷积核大小$4*4$，步长为2. 卷积核个数依次为$[64,128,256,512,1]$。激活函数为 leaky ReLU （0.2）.最后一层有一个Upsample层，将大小缩放到与输入一样大小。


**Segmentation Network**

- DeepLab-v2 framework with ResNet-101 [11] model pre-trained on ImageNet
- Remove the last classiﬁcation layer and modify the stride of the last two convolution layers from 2 to 1, making the resolution of the output feature maps effectively 1/8 times the input image size.
-  To enlarge the receptive ﬁeld, we apply dilated convolution layers in conv4 and conv5 layers with a stride of 2 and 4, respectively. 
- After the last layer, we use the Atrous Spatial Pyramid Pooling (ASPP) [2] as the ﬁnal classiﬁer.
-  Finally, we apply an up-sampling layer along with the softmax output to match the size of the input
  image.

