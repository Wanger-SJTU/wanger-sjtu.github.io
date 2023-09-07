---
title:  PVNet Pixel-wise Voting Network for 6DoF Pose Estimation
date:   2019-3-23
tags: 
  - Deep Learning
  - Pose Estimation
---

该论文针对的是基于RGB图像与已知模型的6D姿态估计。
论文的`pipline` 是2-stage的，利用CNN进行关键点检测，然后再进行`PnP`求解。

![image](https://tuchuang-1259359185.cos.ap-chengdu.myqcloud.com/_asserts/PVnet/1.jpg)

## Voting-based keypoint localization

模型结构关键点检测如下图：
![image](https://tuchuang-1259359185.cos.ap-chengdu.myqcloud.com/_asserts/PVnet/2.jpg)

这部分网络主要完成了两部分工作，一个是语义分割，一个矢量估计。这里矢量指的是分割图像中的像素点到关键点的方向。作者提到比起直接回归关键点，这个方法有两个好处：

- 模型能够更关注于局部特征，能不被背景影响。
- 对于遮挡，以及仅有部分图像的情形也能很好的预测关键点位置。

对于像素点 $\mathbf{p}$ ， 其到关键点   $\mathbf{x}_k$ 矢量 $\mathbf{v}_k(p)$表示为 

$$ 
\mathbf{v}_{k}(\mathbf{p})=\frac{\mathbf{x}_{k}-\mathbf{p}}{\left\|\mathbf{x}_{k}-\mathbf{p}\right\|_{2}}
$$

**key-point hypotheses**

key-point关键点的选取是基于RANSAC的投票方法：具体如下：

- 根据语义分割结果随机选取两个点，这两个点对应向量的交集 $\mathbf{h}_{k,i}$ 记为 $\mathbf{x}_k$ 的一个潜在选择。
- 重复上述步骤N次，得到N个假设。
- 根据RANSAC方法投票得到最终的关键点。
- 其中,每个点的voting score $w_{k,i}$ 定义为：

  $$ 
  w_{k, i}=\sum_{\mathbf{p} \in O} \mathbb{I}\left(\frac{\left(\mathbf{h}_{k, i}-\mathbf{p}\right)^{T}}{\left\|\mathbf{h}_{k, i}-\mathbf{p}\right\|_{2}} \mathbf{v}_{k}(\mathbf{p}) \geq \theta\right)
  $$

  $\mathbb{I}$ 是指示函数, $\theta$ 是阈值(0.99 in all experiments), and $p \in O$ 目标 $O$ 的所有像素 $p$。

最终的关键点假设表示为空间概率分布的形式：

其中均值和方差 $\boldsymbol{\mu}_{k} \;\text{、}\boldsymbol{\Sigma}_{k}$ 分别为：

$$ 
{\boldsymbol{\mu}_{k}=\frac{\sum_{i=1}^{N} w_{k, i} \mathbf{h}_{k, i}}{\sum_{i=1}^{N} w_{k, i}}} 
$$

$$
{\boldsymbol{\Sigma}_{k}=\frac{\sum_{i=1}^{N} w_{k, i}\left(\mathbf{h}_{k, i}-\boldsymbol{\mu}_{k}\right)\left(\mathbf{h}_{k, i}-\boldsymbol{\mu}_{k}\right)^{T}}{\sum_{i=1}^{N} w_{k, i}}}
$$

**注**：这个结果在后面的`PnP`求解过程中用得到。

**Keypoint selection**

为保证PnP的求解问题，特征点的选择必须分散在物体表面。为此，作者提出使用 farthest point sampling (FPS) algorithm来进行特征点的选择。

- 首先把特征点选在目标中心
- 然后选取距离上一个点最远点作为下一个特征点，重复直到选取了K个点。 

实验中，作者对比了实验结果，K=8

**Multiple instances**

对于每类对象，使用提出的投票方案生成对象中心的假设及其投票得分。 然后，在假设中找到模式，并将这些模式标记为不同实例的中心。 最后，通过将像素分配给他们投票的最近的实例中心来获得实例掩码。


## Uncertainty-driven PnP

$$ 
\begin{array}{c}
{
  \operatorname{minimize} \sum_{k=1}^{K}\left(\tilde{\mathbf{x}}_{k}-\boldsymbol{\mu}_{k}\right)^{T} \mathbf{\Sigma}_{k}^{-1}\left(\tilde{\mathbf{x}}_{k}-\boldsymbol{\mu}_{k}\right)
} \\ \\
{\tilde{\mathbf{x}}_{k}=\pi\left(R \mathbf{X}_{k}+\mathbf{t}\right)}\end{array}
 $$


$X_k$ 为关键点的3D坐标，$ \tilde{x}_k$ 是$X_k$ 的2D投影, $\pi$ 为投影函数. $ R $ 和 $t$ 的参数根据我们迹最小的4个关键点由 EPnP 取得，最后使用 Levenberg-Marquardt 算法求解上述方程。

最小化重构误差。


## 实现细节

假设有$C$个类，每个类有$K$个关键点。图片大小为$H×W×3$，输出为 $H ×W ×(K ×2×C)$ 的Tensor（预测向量） 与 $H×W ×(C+1)$ 的 Tensor（语义分割）。

> We use a pretrained ResNet-18 [16] as the backbone network, and we make three revisions on it. First, when the feature map of the network has the size H/8 × W/8, we do not downsample the feature map anymore by discarding the subsequent pooling layers. Second, to keep the receptive ﬁelds unchanged, the subsequent convolutions are replaced with suitable dilated convolutions [45]. Third, the fully connected layers in the original ResNet-18 are replaced with convolution layers. Then, we repeatedly perform skip connection, convolution and upsampling on the feature map, until its size reaches H × W , as shown in Figure 2(b). By applying a 1 × 1 convolution on the ﬁnal feature map, we obtain the unit vectors and class probabilities

> We implement hypothesis generation, pixel-wise voting and density estimation using CUDA. The EPnP [24] used to initialize the pose is implemented in OpenCV [5]. To obtain the ﬁnal pose, we use the iterative solver Ceres [1] to mini-mize the Mahalanobis distance (5). For symmetric objects, there are ambiguities of keypoint locations. To eliminate the ambiguities, we rotate the symmetric object to a canonical pose during training, as suggested by [33].

### Training strategy

训练过程使用的是Fast-rcnn中的`l1_loss`。

$$ 
\begin{aligned} \ell(\mathbf{w})&=\sum_{k=1}^{K} \sum_{\mathbf{p} \in O} \ell_{1}\left(\boldsymbol{\Delta} \mathbf{v}_{k}\left.(\mathbf{p} ; \mathbf{w})\right|_{x}\right)+\ell_{1}\left(\boldsymbol{\Delta} \mathbf{v}_{k}\left.(\mathbf{p} ; \mathbf{w})\right|_{y}\right) \\ \boldsymbol{\Delta} \mathbf{v}_{k}(\mathbf{p} ; \mathbf{w}) &=\tilde{\mathbf{v}}_{k}(\mathbf{p} ; \mathbf{w})-\mathbf{v}_{k}(\mathbf{p}) \end{aligned}
 $$


$w$ 为 PVNet 的参数, $\tilde{v}_k$ 为预测的向量, $v_k$ 是其ground truth, $\Delta v_k\vert x $ 和 $\Delta v_k\vert y$ 代表了 $\Delta v_k$的两部分。

训练语义分割部分时，使用的是交叉熵函数。 

测试阶段，不再需要将输出的矢量单位化了，因为仅仅需要方向信息。

> We set the initial learning rate as 0.001 and halve it every 20 epochs. All models are trained for 200 epochs.

##其他的

![image](https://tuchuang-1259359185.cos.ap-chengdu.myqcloud.com/_asserts/PVnet/3.jpg)

作者没有采用3D bounding box 作为特征点。是基于点距离模型本身太远，不足以表示模型特征。
实验对比可以发现， 作者的方式是方差更小，贴合在表面。