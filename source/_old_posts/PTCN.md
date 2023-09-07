---
title:  Pixel Transposed Convolutional Networks
date:   2019-03-20
tags: 
  - Deep Learning
  - Segmentation
---

论文提出我们常用的 转置卷积（transposed convolutional layer）没有考虑到像素之间的关联性，进而会导致了结果的下降。

![compare](https://tuchuang-1259359185.cos.ap-chengdu.myqcloud.com/_asserts/PTCN/1.jpg)

上图结果对比了使用和不适用Pixel transpose convolutional layer的区别。可以看到作者提出的方法对于像素之间的关联性考虑的更好。

## Convolutional Layers
首先介绍一下卷积操作：

![image](https://tuchuang-1259359185.cos.ap-chengdu.myqcloud.com/_asserts/PTCN/2.jpg)

如图所示,对于一个4\*4的矩阵，卷积核大小为3\*3的时候，输出为矩阵的大小为2\*2。
更一般的我们有：
$$
N'=\frac{N-k+2p}{stride}+1
$$
显然卷积操作对应了一个 `many-to-one` 的映射操作。

其实在实际计算的时候，卷积操作被重构为矩阵乘法问题。依旧以4\*4矩阵，3\*3卷积核为例。

![image](https://tuchuang-1259359185.cos.ap-chengdu.myqcloud.com/_asserts/PTCN/3.jpg)

卷积核可以重塑为

![image](https://tuchuang-1259359185.cos.ap-chengdu.myqcloud.com/_asserts/PTCN/4.jpg)

![image](https://tuchuang-1259359185.cos.ap-chengdu.myqcloud.com/_asserts/PTCN/5.jpg)

卷积操作可以写成矩阵乘法的问题

![image](https://tuchuang-1259359185.cos.ap-chengdu.myqcloud.com/_asserts/PTCN/6.jpg)

## Transposed Convolutional Layers
继续我们上面的讨论，如果将这个操作反过来，输入矩阵中的一个值映射到输出矩阵的9个值，这将是一个一对多`one-to-many`的映射关系。

![image](https://tuchuang-1259359185.cos.ap-chengdu.myqcloud.com/_asserts/PTCN/7.jpg)

那么如何去做？

在上面提到，卷积操作其实可以转化为 $outputs=inputs\times kernel$的矩阵乘法问题。则显然有 $inputs=kernel^T \times outputs$

即：

![image](https://tuchuang-1259359185.cos.ap-chengdu.myqcloud.com/_asserts/PTCN/8.jpg)


在论文中，作者提出，转置卷积操作可以分解为几个卷积操作然后 Upsampling 操作的集合：

$$ 
\begin{aligned} 
F_{1} &=F_{i n} \circledast k_{1} \\ 
F_{2} &=F_{i n} \circledast k_{2} \\
F_{3} &=F_{i n} \circledast k_{3} \\
F_{4} &=F_{i n} \circledast k_{4}  \\
F_{o u t}&=F_{1} \oplus F_{2} \oplus F_{3} \oplus F_{4}
\end{aligned}
$$

![1D](https://tuchuang-1259359185.cos.ap-chengdu.myqcloud.com/_asserts/PTCN/9.jpg)

![2D](https://tuchuang-1259359185.cos.ap-chengdu.myqcloud.com/_asserts/PTCN/10.jpg)




$$ 
\begin{aligned} 
F_{1} &=F_{i n} \circledast k_{1} \\ 
F_{2} &=\left[F_{i n}, F_{1}\right] \circledast k_{2} \\ 
F_{3} &=\left[F_{i n}, F_{1}, F_{2}\right] \circledast k_{3} \\ 
F_{4} &=\left[F_{i n}, F_{1}, F_{2}, F_{3}\right] \circledast k_{4} \\ 
F_{o u t} &=F_{1} \oplus F_{2} \oplus F_{3} \oplus F_{4} \end{aligned}
$$

![image](https://tuchuang-1259359185.cos.ap-chengdu.myqcloud.com/_asserts/PTCN/11.jpg)

![image](https://tuchuang-1259359185.cos.ap-chengdu.myqcloud.com/_asserts/PTCN/12.jpg)

**注：**
1. 关于卷积操作介绍来自于：[CSDN](https://blog.csdn.net/LoseInVain/article/details/81098502)