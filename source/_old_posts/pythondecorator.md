---
title:  一文搞懂python装饰器
date:   2019-03-25
tags: 
  - python
  - 翻译
---

原文地址来自：[Finally understanding decorators in Python](https://pouannes.github.io/blog/decorators/)

python 装饰器语法

```python
@dec
def func():
  pass
```
**要想理解什么是装饰器，首先要明白装饰器解决了什么问题。**

## 问题定义

首先举一个例子，来模拟装饰器要解决的问题。文件`dec.py`中有一个`add` 函数，第二个参数为默认参数。

```python
# dec.py
def add(x, y=10):
  return x + y
```
调用函数的结果如下:

```python
>>> add(10, 20)
30
>>> add
<function add at 0x7fce0da2fe18>
>>> add.__name__
'add'
>>> add.__module__
'__main__'
>>> add.__defaults__ # default value of the `add` function
(10,)
>>> add.__code__.co_varnames # the variable names of the `add` function
('x', 'y')
```

