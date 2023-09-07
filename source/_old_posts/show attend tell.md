---
title:  show attention tell 
date:   2018-10-11
catalog: true
tags: 
   - paper notes
---

## 模型结构

![show_attention_tell](https://tuchuang-1259359185.cos.ap-chengdu.myqcloud.com/_asserts/show-attend-tell/1.jpg)



流程大致如下：

**Encoder**

通过CNN的结构得到一个low level features $[a_0, \dots, a_L]$，这里得到的就是$L$个向量。

**Decoder : LSTM**

最终要得到的为$ [y_1,\dots, y_c]\quad y_i \in \mathcal{R}^K$

LSTM的输入输出为
$$
\begin{pmatrix}\textbf{i}_t \\\textbf{f}_t \\\textbf{o}_t \\\textbf{g}_t \\\end{pmatrix}=\begin{pmatrix}\sigma\\ \sigma\\ \sigma\\ \tanh \end{pmatrix}T_{D+m+n, n} \ \begin{pmatrix}E\textbf{y}_{t-1}\\ \textbf{h}_{t-1}\\ \hat{\textbf z}_t \end{pmatrix}
$$

$$
\textbf{c}_t=\textbf{f}_t \odot \textbf{c}_{t-1} + \textbf{i}_t \odot \textbf{g}_t
$$

$$
\textbf{h}_t = \textbf{o}_t \odot \tanh(\textbf{c}_t)
$$

 最右边括号里的三个量是四个式子共有的三个输入量：$Ey_{t−1}$ 是look-up得到词 $y_{t−1}$ 的 m 维词向量；$h_t−1$ 是上一时刻的隐状态；**$z^t∈R^D$ 是LSTM真正意义上的“输入”，**代表的是捕捉了特定区域视觉信息的上下文向量，既然它和时刻 `t `有关，就说明它是一个动态变化的量，在不同的时刻将会捕捉到与本时刻相对应的相关图像区域。这个量将由attention机制计算得到。

 第二个式子是更新旧的细胞状态，element-wise 的运算表示三个门控将对各自控制的向量的每个元素做“取舍”：0 到 1 分别代表完全抛弃到完全保留。

第三个式子是得到隐状态。

> 作者给出了隐状态和细胞状态的初始值的计算方式，使用两个独立的多层感知机，感知机的输入是各个图像区域特征的平均
> $$
> \textbf c_0=f_{\text{init,c}}(\frac1L\sum_{i=1}^L\textbf a_i)
> $$
>
> $$
> \textbf h_0=f_{\text{init,h}}(\frac1L\sum_{i=1}^L\textbf a_i)
> $$
>
>

有了隐状态，就可以计算词表中各个词的概率值，那么取概率最大的那个作为当前时刻生成的词，并将作为下一时刻的输入。其实就是个**全连接层(deep output layer)**：
$$
\begin{aligned}
p(\textbf{y}_t|\textbf{a}, \textbf y_1,...,\textbf y_{t-1}) \propto \exp (L_o (E \textbf{y}_{t-1} + L_h \textbf{h}_t + L_z \hat{\textbf{z}}_t))\\
\\
 L_o \in R^{K\times m}, L_h \in R^{m\times n}, L_z \in R^{m\times D}
\end{aligned}
$$
**Attention**

上面介绍了最后要得到 $[y_0,\dots, y_c]$，需要输入 $z_i$ ，上下文信息。那么就是如何从encoder得到的feature map得到最终的$z_i$.

 通过attention机制计算出的$z_t$ 被称为 context vector，是捕捉了特定区域视觉信息的上下文向量。

 需要明确，attention要实现的是在解码的不同时刻可以关注不同的图像区域，进而可以生成更合理的词。那么，在attention中就有两个比较关键的量，一个是和时刻 t 相关，对应于解码时刻；另一个是输入序列的区域  $a_i $，对应图像的一个区域。

实现这种机制的方式就是在时刻$ t$ ，为输入序列的各个区域$ i$ 计算出一个权重 $α_{ti}$ 。因为需要满足输入序列的各个区域的权重是加和为一的，使用`Softmax`来实现这一点。至于`Softmax`需要输入的信息，则如上所讲，需要包含两个方面：一个是被计算的区域 $a_i$ ，另一个就是上一时刻 t-1 的信息 $h_{t−1}$ 
$$
e_{ti}=f_{\text{att}}(\textbf a_i,\textbf h_{t-1})
$$

$$
\alpha_{ti}=\frac{\exp(e_{ti})}{\sum_{k=1}^L\exp(e_{tk})}
$$

式中的 $f_{att} $是耦合计算区域 i 和时刻 t 这两个信息的打分函数。文中使用**多层感知机**(MLP)

有了权重，就可以计算 $z_t$ 了：
$$
\hat{\textbf z}_t=\phi(\{\textbf a_i\},\{\alpha_{ti}\})
$$
这个函数 $ϕ$ 就代指文中提出的两种attention机制，对应于将权重施加到图像区域到两种不同的策略。

**soft attention**
$$
\text{E}_{p(s_t|a)}[\hat{z}_t]=\sum_{i=1}^{L}\alpha_{t,i}a_i
$$

![soft](https://tuchuang-1259359185.cos.ap-chengdu.myqcloud.com/_asserts/show-attend-tell/2.png)

**hard attention**

在soft attention中，我们采用的是加权求和的方式得到$z_t$的。前面我们得到的$\sum \alpha_i=1$，因此可以把$\alpha_i$解释为我们注意到第$i$个特征区域的可能性（置信度）。所以在hard attention中，我们是把$\alpha_i$看作从$x_i$中的采样率.

![](https://tuchuang-1259359185.cos.ap-chengdu.myqcloud.com/_asserts/show-attend-tell/3.jpg)

hard attention 使用采样的方法替代了确定性的计算方法。反向传播过程中使用MC（蒙特卡洛）方法采样平均我们的计算梯度。

> Soft attention is more popular because the backpropagation seems more effective.

---

ref:

1. https://jhui.github.io/2017/03/15/Soft-and-hard-attention/