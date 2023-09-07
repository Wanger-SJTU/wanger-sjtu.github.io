---
title: CYCADA CYCLE-CONSISTENT ADVERSARIAL DOMAIN ADAPTATION
date:   2018-07-16
catalog: true
tags: 
   - paper notes
---

[github code](https://github.com/jhoffman/cycada_release)

`CyCADA`论文中，定义了一种问题——无监督适配，即仅提供源数据 $X_S$ 和源标签 $Y_S$，以及源域目标数据$X_T$，没有目标标签或者不利用它。问题的目的是学习一个模型 $f$，它可以正确预测目标数据的标签。 

![CYCADA](https://tuchuang-1259359185.cos.ap-chengdu.myqcloud.com/_asserts/CYCADA/1.jpg)

`CYCADA` 的模型基本如上图所示，论文的主要思路来自于`cycleGAN`, 利用`cycle GAN`来完成image-level的适配问题。通过讲图像变换到目标域来实现域适配的问题。

源域训练模型的loss函数

![src_loss](http://ww1.sinaimg.cn/mw690/007arC1sly1g0whdz9yqtj30n802ywen.jpg)

其中$\sigma$ 是`softmax`

在论文中，加入语义一致性（semantic consistency）是一个贡献，因为已知源标签。语义损失为： 

$$
L_{sem}(G_{S \rightarrow T}， G_{T \rightarrow S}, X_S, X_T, f_S) = L_{task}(f_S, G_{T \rightarrow S}(X_T), p(f_S, X_T)) + L_{task}(f_S, G_{S \rightarrow T}(X_S), p(f_S, X_S))
$$

损失函数如下：

$$
\begin{aligned}
& L_{CyCADA}(f_T, ,X_S, X_T, Y_S, G_{S \rightarrow T}, G_{T \rightarrow S}, D_S, D_T) \\
&= L_{task}(f_T, G_{S \rightarrow T}(X_S), Y_S)\\
&+ L_{GAN}(G_{S \rightarrow T}, D_T, X_T, X_S) \\
&+ L_{GAN}(G_{T \rightarrow S}, D_S, X_S, X_T)\\
& + L_{GAN}(f_T, D_{feat}, f_S(G_{S \rightarrow T}(X_S)), X_T)\\
& + L_{cyc}(G_{S \rightarrow T}, G_{T \rightarrow S}, X_S, X_T)\\
& + L_{sem}(G_{S \rightarrow T}, G_{T \rightarrow S}, X_S, X_T, f_S)
\end{aligned}
$$

第一项 $L_{task}(f_T,G_S→T(X_S),Y_S)$ 表示，源图像 $X_S$ 经过变换（全卷积网络？）$G_S→T$ 伪目标图像， 然后该图像经过分割网络得到源预测结果，与源标签$Y_S$ 得到$L_{task}$ 损失；

第二项$L_{GAN}(G_S→T,D_T,X_T,X_S)$ 表示，变换 $G_S→T$ 根据源图像$X_S$ 生成伪目标图像去fool对抗判别器 $D_T$， 并且该判别器尝试从源目标数据（source target data）（生成？）中识别出真实目标数据（real target data）。 

![](http://ww1.sinaimg.cn/large/007arC1sly1g0wheejup4j30rr01i3yn.jpg)

第三项类似于第二项，然后就是`CyCleGAN`的思路。

第四项为特征水平的GAN损失，如图1中橙色部分。

第五项为`CyCleGAN`中的重建损失。第六项为语义一致性，如图1中黑色部分。  

