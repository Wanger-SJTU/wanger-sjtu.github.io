---
title: 打印梯度
date:   2018-09-18
catalog: true
tags: 
   - Pytorch
---


[自动求导求梯度机制](https://pytorch.org/docs/stable/notes/autograd.html#autograd-mechanics)相关的一个参数我们应该都熟悉，**requires_grad**。

当在定义一个tensor的时候并且将**requires_grad**设置为**True。**这个tensor就拥有自动求梯度

```python
>>> x = torch.randn(5, 5)  # requires_grad=False by default
>>> y = torch.randn(5, 5)  # requires_grad=False by default
>>> z = torch.randn((5, 5), requires_grad=True)
>>> a = x + y
>>> a.requires_grad
False
>>> b = a + z
>>> b.requires_grad
True
```

这是官方的示例程序，只要有一个tensor的**requires_grad**设置为**True**，那么接下来的计算中所有相关的tensor都会支持自动求导求梯度。

关于自动求导求梯度的一些信息请看这里：<https://oldpan.me/archives/pytroch-torch-autograd-backward>。

## register hook

但是自动求导的机制有个我们需要注意的地方：

```python
In[2]: import torch
In[3]: x = torch.tensor([1,2],dtype=torch.float32,requires_grad=True)
In[4]: y = x * 2
In[5]: z = torch.mean(y)
In[6]: z
Out[6]: tensor(3.)
In[7]: z.backward()
In[8]: x.grad
Out[8]: tensor([ 1.,  1.])
In[9]: y.grad    # 应该为(0.5,0.5) no output
In[10]: z.grad   # 应该为1 no output
```

因为在自动求导机制中只保存叶子节点，也就是中间变量在计算完成梯度后会自动释放以节省空间，所以上面代码我们在计算过程中只得到了z对x的梯度.

这就需要我们的hook函数了：

register hook (*hook*)[[source\]](https://pytorch.org/docs/stable/_modules/torch/tensor.html#Tensor.register_hook) 这个函数属于torch.tensor类，这个函数在与这个tensor梯度计算的时候就会执行，这个函数的参数hook是一个函数，这个函数应该是以下的形式：

 `hook(grad) -> Tensor or None `。grad是这个tensor的梯度，该函数返回grad，我们可以改变这个hook函数的返回值，但是不能改变其参数。

```python
In[2]: import torch
In[3]: x = torch.tensor([1,2],dtype=torch.float32,requires_grad=True)
In[4]: y = x * 2
In[5]: y.requires_grad
Out[5]: True
In[6]: y.register_hook(print)
Out[6]: <torch.utils.hooks.RemovableHandle at 0x7f765e876f60>
In[7]: z = torch.mean(y)
In[8]: z.backward()
tensor([ 0.5000,  0.5000])
```

-----

refer
https://oldpan.me/archives/pytorch-autograd-hook