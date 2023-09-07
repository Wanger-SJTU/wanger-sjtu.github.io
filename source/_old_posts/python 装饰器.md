---
title: python 装饰器
date:   2018-09-14
catalog: true
tags: 
   - python
---

关于python 闭包、装饰器的介绍，可以先看廖雪峰的[介绍](https://www.liaoxuefeng.com/wiki/0014316089557264a6b348958f449949df42a6d3a2e542c000/0014318435599930270c0381a3b44db991cd6d858064ac0000)

这里主要介绍上文中没有提到的部分。

**利用装饰器，来完成类和函数的自动注册。**

看下面的代码：

```python
class Test:
    def __init__(self):
        print("test created")
    def __call__(self):
        print("test called")
A = Test()
```

>```
>test created
>```

但是我们很多时候需要根据情形来选择实例化的类，就希望类可以自动完成注册，以方便调用。

```python
#装饰器代码
models = {}
def register_model(model):
    def decorator(**args):
        models[model.__name__] = model
        return model
    return decorator

def get_model(name,**args):
    net = models[name](**args)
    return net
```

这时候有

```python
@register_model
class Test:
    def __init__(self):
        print("test created")
    def __call__(self):
        print("test called")
```

这样通过实例化Test的时候，就完成了自动注册。

​    需要注意的是，

- 当实例化注册的时候，`a = Test()`，类并没有立刻实例化，而是延迟的。
- 上面的装饰器的代码是针对单例的。

此时：

```python
a = Test() #没有任何输出
print(models)
func =get_model("Test")
```

> ```
> {'Test': <class '__main__.Test'>}# print
> test created
> ```

#####  一种我还没搞懂的方式

`models.py`

```python
models = {}
def register_model(name):
  def decorator(cls):
    models[name] = cls
    return cls
  return decorator

def get_object(name, **args):
  net = models[name](**args)
  return net
```

`Test.py`

```python
from models import register_model, get_object
@register_model("Test")
class Test:
  def __init__(self):
    print("test created")
  def __call__(self):
    print("test called")
    return 0
```

`main.py`

```python
from models import get_object
from testclass import Test
get_object('Test')()
```

> test created
> test called