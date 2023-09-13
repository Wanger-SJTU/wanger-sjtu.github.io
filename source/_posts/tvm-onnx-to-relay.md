---
title: 【TVM模型编译】1. onnx2relay.md
tags:
  - TVM
category:
  - 技术
date: 2023-08-09 15:53:17
---

[上一篇](./tvm-onnx.md)介绍了onnx模型在tvm中优化的总体流程。

在这一篇中，介绍onnx模型到relay模型的转换流程，主要涉及了以下几个方面：
- onnx算子到relay算子转换
- relay算子实现

这一篇介绍onnx算子到relay算子转换过程

## onnx算子到relay算子转换

```python
# onnx -> relay
mod, params = relay.frontend.from_onnx(onnx_model, shape_dict)
```

这部分实现是在`python/tvm/relay/frontend/onnx.py`中。实现转换过程的核心在于`GraphProto`这个类。这个类中实现了读取onnx模型各个节点、输入输出，映射onnx算子到relay IR的过程。对外接口为`from_onnx`这个函数。其伪代码可以大致表示为

```python
def from_onnx(self, graph, opset, get_output_expr=False):
    inputs, params = read_model_inputs(graph) # 模型参数
    nodes = read_model_node(graph) # 模型节点、算子信息
    convert_map = _get_convert_map(opset) # 模型转换map
    check_op_support(nodes, convert_map)
    for node in nodes:
        op = self._convert_operator(op_name, inputs, attr, opset)
    return
```

从这里可以知道ONNX前端的每个算子转化与`_get_convert_map`有关。
`_convert_operator`完成了算子转换过程。具体的`convert_map`包含了所有支持算子的转换函数。

```python
def _convert_operator(self, op_name, inputs, attrs, opset):
    convert_map = _get_convert_map(opset)
    if op_name in _identity_list: # 对onnx这里是空的
        sym = get_relay_op(op_name)(*inputs, **attrs)
    elif op_name in convert_map:
        sym = convert_map[op_name](inputs, attrs, self._params)
    else:
        raise NotImplementedError("Operator {} not implemented.".format(op_name))
    return sym
```

以卷积算子为例，介绍具体的转换过程：

```python
"Conv": Conv.get_converter(opset)
```

Conv算子的实际转换操作来自于
```python
class Conv(OnnxOpConverter):
    """Operator converter for Conv."""
    @classmethod
    def _impl_v1(cls, inputs, attr, params):
        # Use shape of input to determine convolution type.
        data = inputs[0]
        input_shape = infer_shape(data)
        ndim = len(input_shape)
        # auto_pad ...

        # construct op from attrs
        out = AttrCvt(
            op_name=dimension_picker("conv"),
            transforms={
                "kernel_shape": "kernel_size",
                "dilations": ("dilation", 1),
                "pads": ("padding", 0),
                "group": ("groups", 1),
            },
            custom_check=dimension_constraint(),
        )([data, inputs[1]], attr, params)

        use_bias = len(inputs) == 3
        if use_bias:
            out = _op.nn.bias_add(out, inputs[2])
        return out
```

这里通过`AttrCvt`类中构建相应的`relay`算子,`python/tvm/relay/frontend/common.py`

`AttrCvt`类包括两部分，`__init__` 和 `__call__`，前者根据收集初始化参数，后者完成Relay IR算子构建。

`__call__`中的实现主要完成了算子属性读取、转换。根据转换后输入构建Relay IR

```python
return get_relay_op(op_name)(*inputs, **new_attrs)
```
