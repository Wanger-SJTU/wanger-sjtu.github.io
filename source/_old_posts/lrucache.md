---
title:  lru cache 与缓存机制
date:   2019-3-16
tags: 
  - python
---

函数缓存是：
> 第一次调用时，正常执行，并缓存计算结果。
使用相同的参数，第二次调用时，不执行，直接加载计算结果。


在 Python 的 3.2 版本中，引入了一个非常优雅的缓存机器，即 `functool` 模块中的 `lru_cache` 装饰器
>@functools.lru_cache(maxsize=None, typed=False)

使用functools模块的lur_cache装饰器，可以缓存最多 maxsize 个此函数的调用结果，从而提高程序执行的效率，特别适合于耗时的函数。参数maxsize为最多缓存的次数，如果为None，则无限制，设置为2n时，性能最佳；如果 typed=True（注意，在 functools32 中没有此参数），则不同参数类型的调用将分别缓存，例如 f(3) 和 f(3.0)。

以斐波那契数列计算为例，动态规划的方法是利用两个变量存储`f(n-1)` 和`f(n-2)`
此处可以使用这个函数简化代码

```python
from functools import lru_cache


@lru_cache(maxsize=None)
def fib4(n: int) -> int:  # same definition as fib2()
    if n < 2:  # base case
        return n
    return fib4(n - 2) + fib4(n - 1)  # recursive case

```
