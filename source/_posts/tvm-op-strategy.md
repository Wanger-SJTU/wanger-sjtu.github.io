---
title: 【tvm解析】 Operator Strategy 机制
tags:
  - TVM
category:
  - TVM
date: 2023-08-09 15:50:30
---


Relay Operator Strategy是建立Relay IR与TOPI算子库的桥梁，通过Relay Operator Strategy，每个Relay IR至少与一个compute和一个schedule注册关联起来。至少一个原因在于，一个算子在不同后端设备上有不同的实现，而且一个算子可能有多种计算算法，适应不同场景。

在增加relay IR 的教程里面注册算子的compute、schedule中，就是通过`OpStrategy`关联算子的compute与schedule

```python
@override_native_generic_func("cumsum_strategy")
def cumsum_strategy(attrs, inputs, out_type, target):
    """cumsum generic strategy"""
    strategy = _op.OpStrategy()
    strategy.add_implementation(
        wrap_compute_scanop(topi.cumsum), #上面写的compute
        wrap_topi_schedule(topi.generic.schedule_extern),
        name="cumsum.generic",
    )
    return strategy
```

## Operator Strategy Design

`OpStrategy`的核心为`OpImplementation`，包含了一组compute及对应的schedule，不同实现的名字，选择优先级（参见下文的选择策略）。

OpStrategy中包含一系列的`OpSpecialization`，每个`OpSpecialization`包含一组`SpecializedCondition`（参考`include/tvm/te/schedule.h`）. 如果`SpecializedCondition`为空（null），表示是一个通用的实现，反之则是对于特定情形优化的。`SpecializedCondition`包含了这一算子的多个TE实现，以及实现被调用的条件。


最后一点，对给定的workload，一个strategy 函数或者`FTVMStrategy`,决定了使用哪个compute和schedule，因此这部分需要与relay算子对应起来。
`FTVMStrategy `实现位置在`include/tvm/target/generic_func.h`,是一个通用函数，对于给定硬件平台可以重写。函数签名是
```cpp
OpStrategy(const Attrs& attrs, const Array<Tensor>& inputs, const Type& out_type, const Target& target)
```
对给定算子属性信息、输入、输出类型以及平台设备，这个函数返回相应的`OpStrategy`.


## 手写一个 Strategy 函数
tvm 推荐在python侧来写Strategy 函数，在python侧提供了OpStrategy类，其中包含一个add_implementation方法。
```python
@tvm._ffi.register_object("relay.OpStrategy")
class OpStrategy(Object):
    """Operator strategy"""
    def __init__(self):
        self.__init_handle_by_constructor__(_make.OpStrategy)
    def add_implementation(self, compute, schedule, name="default", plevel=10):
        _OpStrategyAddImplementation(self, compute, schedule, name, plevel)
```

后面以topk的算子为例，介绍了如何手写 Strategy 函数

```python
# 通用的
# add to python/tvm/relay/op/strategy/generic.py
@override_native_generic_func("topk_strategy")
def topk_strategy(attrs, inputs, out_type, target):
    strategy = _op.OpStrategy()
    strategy.add_implementation(
        wrap_compute_topk(topi.topk),
        wrap_topi_schedule(topi.generic.schedule_topk),
        name="topk.generic")
    return strategy

# 针对GPU CUDA的
# add to each target file in python/tvm/relay/op/strategy, e.g., x86.py, cuda.py, etc.
@topk_strategy.register(["cuda", "gpu"])
def topk_strategy_cuda(attrs, inputs, out_type, target):
    strategy = _op.OpStrategy()
    strategy.add_implementation(
        wrap_compute_my_new_op(topi.cuda.topk),
        wrap_topi_schedule(topi.cuda.schedule_topk),
        name="topk.cuda")
    return strategy
```
为了满足Strategy 函数对于函数签名的要求（see `FTVMCompute` and `FTVMSchedule` in `include/tvm/relay/op_attr_types.h`），这里对topk的compute和schedule做了一层封装。由于算子属性不同，通常需要算子开发者自己写这部分的封装函数。

上面的例子比较简单，对于一个设备平台只有一个实现，但对一些其他的复杂算子来说，需要针对不同的算法来写相应的schedule，以卷积算子为例，可以直接写滑窗来计算，也可以使用winograd算法计算。这种情况下有多个implementation：
```python
strategy.add_implementation(
    wrap_compute_conv2d(topi.cuda.conv2d_nchw),
    wrap_topi_schedule(topi.cuda.schedule_conv2d_nchw),
    name="conv2d_nchw.cuda",
    plevel=10)

if winograd_condition:
    strategy.add_implementation(
        wrap_compute_conv2d(topi.cuda.conv2d_nchw_winograd),
        wrap_topi_schedule(topi.cuda.schedule_conv2d_nchw_winograd),
        name="conv2d_nchw_winograd.cuda",
        plevel=15)
```
可以看到这两个是优先级不同，在满足winograd算法的情况下，会优先选择winograd算法。这样也可以新增条件，新增implentation。
同样也可以对不同shape设置不同的优先级策略。下面的例子就是在`m > 16`时，有额外的计算策略：

```python
def dense_strategy(attrs, inputs, out_type, target):
  m = inputs[0].shape[0]
  strategy = _op.OpStrategy()
  strategy.add_implementation(
    wrap_compute_dense(dense_compute1),
    wrap_topi_schedule(dense_schedule1),
    name="dense_common")

  with tvm.te.SpecializedCondition(m > 16):
    strategy.add_implementation(
        wrap_compute_dense(dense_compute2),
        wrap_topi_schedule(dense_schedule2),
        name="dense_for_large_m",
        plevel=15)
  return strategy
```
## 将算子 Strategy 绑定到算子

定义了算子strategy函数以后，需要跟算子绑定在一起。
```python
register_strategy("topk", strategy.topk_strategy)
```
然而，对于一个算子来说，写它的strategy函数是比较困难的，对简单算子来说，这里提供了两种方案。
第一个:算子是单射的、广播、reduce操作时候，可以通过 `register_injective_schedule`, `register_broadcast_schedule`、 `register_reduce_schedule`，这就避免自己手写schedule了。不过这种方式对于任意后端设备都是通用的。

```python
register_broadcast_schedule("add")
```

第二种：对于没有明确pattern的算子，可以用`register_schedule`实现对任意后端的注册。
```python
# 通用兜底的
# add to python/tvm/relay/op/strategy/generic.py
@generic_func
def schedule_pool(attrs, outs, target):
    with target:
        return topi.generic.schedule_pool(outs, attrs.layout)

# 如果特定target的，需要在对应的文件下增加
# add to each target file in python/tvm/relay/op/strategy, e.g., x86.py, cuda.py, etc.
@schedule_pool.register("cpu")
def schedule_pool_cpu(attrs, outs, target):
    ...

register_schedule("nn.max_pool2d", strategy.schedule_pool)
```

## Operator Strategy 选择

一个算子有多个Strategy的时候，选择策略是什么呢？

对于静态shape：首先会根据搜索时候的tune log选择最佳实现，如果tune log中没有或者已有auto TVM模板中有特定的实现，则会根据优先级选择对应的实现。如果多个实现具有相同优先级，选哪个就不确定了。

动态shape场景，则会选择高优先级的情况。