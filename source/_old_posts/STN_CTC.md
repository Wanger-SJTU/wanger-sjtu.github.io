---
title:  STN_CTC
date:   2019-06-13
tags: 
  - 
---

STN（spatial transformer network， 空间变换网络）目的在于增强CNN的旋转不变性以及对于仿射变换的鲁棒性。最终让网络模型学习了对平移、尺度变换、旋转和更多常见的扭曲的不变性。
![](../assets/post/stn.jpg)

ST的结构如上图所示,每一个ST模块由Localisation net, Grid generator和Sample组成, Localisation net决定输入所需变换的参数 $θ$, Grid generator通过$θ$和定义的变换方式寻找输出与输入特征的映射$T(θ)$, Sample结合位置映射和变换参数对输入特征进行选择并结合双线性插值进行输出,下面对于每一个组成部分进行具体介绍。

## Localisation net

Localisation net输入为一张Feature map: $U\in R^{H\times W\times C}$ 。经过若干卷积或全链接操作后接一个**回归层**回归输出变换参数$θ$。$θ$的维度取决于网络选择的具体变换类型,如选择仿射变换则 $\theta\in R^{2\times 3}$ 。如选择投影变换则 $\theta\in R^{3\times 3}$ 。$θ$的值决定了网络选择的空间变换的**幅度大小**。

## Grid generator

Grid generator利用localisation层输出的$θ$, 对于Feature map进行相应的空间变换。设输入Feature map U每个像素位置的坐标为$( x_{i}^{s} , y_{i}^{s} )$,经过ST后输出Feature map每个像素位置的坐标为$( x_{i}^{t}，y_{i}^{t} )$, 那么输入和输出Feature map的映射关系便为(选择变换方式为仿射变换)

$$ 
\left(\begin{array}{c}{x_{i}^{s}} \\ {y_{i}^{s}}\end{array}\right)=\tau_{\theta}\left(G_{i}\right)=A_{\theta}\left(\begin{array}{c}{x_{i}^{t}} \\ {y_{i}^{t}} \\ {1}\end{array}\right)=\left[\begin{array}{ccc}{\theta_{11}} & {\theta_{12}} & {\theta_{13}} \\ {\theta_{21}} & {\theta_{22}} & {\theta_{23}}\end{array}\right]\left(\begin{array}{c}{x_{i}^{t}} \\ {y_{i}^{t}} \\ {1}\end{array}\right)
 $$

也就是说,对于输出Feature map的每一个位置,我们对其进行空间变换(仿射变换)寻找其对应与输入Feature map的空间位置,到目前为止,如果这一步的输出为整数值(往往不可能),也就是经过变换后的坐标可以刚好对应原图的某些空间位置,那么ST的任务便完成了,既输入图像在Localisation net和Grid generator后先后的确定了空间变换方式和映射关系。

但是一些读者看到这可能有一个疑问,这个嵌入的ST网路如何通过反向传播进行参数的训练?没错,如果仅仅包含上述的两个过程,那么ST网络是无法进行反向传播的,原因就是我们上述的操作并不是直接对Feature map进行操作,而是对feature position进行计算,从而寻找输入到输出的对应关系。而feature position对应到feature score是离散的,即feature position进行微小变化时,输出O[x+△x,y]值是无法求解的(图像的计算机存储为离散的矩阵存储)。这里论文作者使用了笔者认为STN最精髓算法,双线性插值算法。

Sample:
经过以上的两步操作后,输出的Feature map上每一个像素点都会通过空间变换对应到输入Feature map的某个像素位置,但是由于feature score对于feature position的偏导数无法计算,因而我们需要构造一种position->score的映射,且该映射具有可导的性质,从而满足反向传播的条件。即每一个输出的位置i,都有:


其中 U_{nm} 为输入位置(n,m)对应的score值,k为某种可导函数, Φ为可导函数参数,通过如上的构造方式,我们便可以实现对于 \frac{\partial U}{\partial Xis^{’}} ， \frac{\partial U}{\partial \theta} 等网络参数的求导,从而满足反向传播的要求。如

论文使用的双线性插值法公式如下:


我们可以看到,通过max函数选择与输出(x_{i}^{s} ,y_{i}^{s} )距离小于1的像素位置,距离(x_{i}^{s} ,y_{i}^{s})越近的点被分配了越高的权重,实现了使用(x_{i}^{s} ,y_{i}^{s})周围四个点的score计算最终score,由于max函数可导,我们可以有如下偏导数计算公式:

对于y_{i}^{s}的求导与x_{i}^{s}类似,因而我们可以求得对于的偏导:

到目前为止,我们证明了ST模块可以通过反向传播完成对于网络梯度的计算与参数的更新。

算法分析(STN)

(1) STN作为一种独立的模块可以在不同网络结构的任意节点插入任意个数并具有运算速度快的特点,它几乎没有增加原网络的运算负担,甚至在一些attentive model中实现了一定程度上的加速。
(2) STN模块同样使得网络在训练过程中学习到如何通过空间变换来减少损失函数,使得模型的损失函数有着可观的减少。
(3) STN模块决定如何进行空间变换的因素包含在Localisation net以及之前的所有网络层中。
(4) 网络除了可以利用STN输出的Feature map外,同样可以将变换参数作为后面网络的输入,由于其中包含着变换的方式和尺度,因而可以从中得到原本特征的某些姿势或角度信息等。
(5) 同一个网络结构中,不同的网络位置均可以插入STN模块,从而实现对与不同feature map的空间变换。
(6) 同一个网络层中也可以插入多个STN来对于多个物体进行不同的空间变换,但这同样也是STN的一个问题:由于STN中包含crop的功能,所以往往同一个STN模块仅用于检测单个物体并会对其他信息进行剔除。同一个网络层中的STN模块个数在一定程度上影响了网络可以处理的最大物体数量。
