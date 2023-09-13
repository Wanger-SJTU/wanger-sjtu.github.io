---
title: 【TVM模型编译】2. relay算子构造.md 
tags:
  - TVM
category:
  - 技术
date: 2023-08-09 15:51:21
---


从TVM的官方[Tutorial](https://www.cnblogs.com/wanger-sjtu/p/15046641.html)里面，介绍了如何新增自定义算子。(这是我翻译的)

之前的文章讲到了[onnx 算子转换到Relay IR](https://www.cnblogs.com/wanger-sjtu/p/15018035.html)的过程
下面以Conv2d算子介绍，编译过程中 Relay IR是如何被调用的。

## relay 算子调用

上面的`get_relay_op`实际上是查找所有 relay ir算子，其代码在`python/tvm/relay/frontend/common.py`中的`get_relay_op`。继续以conv卷积算子为例介绍。上文所述的转换算子中，有下面的语句

```python
for candidate in (_op, _op.nn, _op.image, _op.vision, _op.contrib):
    op = getattr(candidate, op_name, None)
    if op is not None:
        break
```

对于`conv2d`算子，在`_op.nn`中，找到conv2d实现。

```python
def conv2d(
    data,
    weight,
    strides=(1, 1),
    padding=(0, 0),
    dilation=(1, 1),
    groups=1,
    channels=None,
    kernel_size=None,
    data_layout="NCHW",
    kernel_layout="OIHW",
    out_layout="",
    out_dtype="",
):
    if isinstance(kernel_size, int):
        kernel_size = (kernel_size, kernel_size)
    if isinstance(strides, int):
        strides = (strides, strides)
    if isinstance(dilation, int):
        dilation = (dilation, dilation)
    padding = get_pad_tuple2d(padding)
    return _make.conv2d( data, weight, strides, padding, dilation, groups, channels, kernel_size, data_layout, kernel_layout, out_layout, out_dtype,
    )
```

这里的`_make.conv2d`是通过下面的PackFunc注册得到的

```python
tvm._ffi._init_api("relay.op.nn._make", __name__)
```
在`src/relay/op/nn/convolution.cc`找到conv2d的注册函数

```cpp
TVM_REGISTER_GLOBAL("relay.op.nn._make.conv2d")
    .set_body_typed([](Expr data, Expr weight, Array<IndexExpr> strides, Array<IndexExpr> padding,
                       Array<IndexExpr> dilation, int groups, IndexExpr channels,
                       Array<IndexExpr> kernel_size, String data_layout, String kernel_layout,
                       String out_layout, DataType out_dtype) {
      return MakeConv<Conv2DAttrs>(data, weight, strides, padding, dilation, groups, channels,
                                   kernel_size, data_layout, kernel_layout, out_layout, out_dtype,
                                   "nn.conv2d");
    });
```

MakeConv 是对所有卷积的模板，根据参数实例化相应的函数

```cpp
template <typename T>
inline Expr MakeConv(Expr data, Expr weight, Array<IndexExpr> strides, Array<IndexExpr> padding,
                     Array<IndexExpr> dilation, int groups, IndexExpr channels,
                     Array<IndexExpr> kernel_size, std::string data_layout,
                     std::string kernel_layout, std::string out_layout, DataType out_dtype,
                     std::string op_name) {
  auto attrs = make_object<T>();
  attrs->strides = std::move(strides);
  attrs->padding = std::move(padding);
  attrs->dilation = std::move(dilation);
  attrs->groups = groups;
  attrs->channels = std::move(channels);
  attrs->kernel_size = std::move(kernel_size);
  attrs->data_layout = std::move(data_layout);
  attrs->kernel_layout = std::move(kernel_layout);
  attrs->out_layout = std::move(out_layout);
  attrs->out_dtype = std::move(out_dtype);
  const Op& op = Op::Get(op_name);
  return Call(op, {data, weight}, Attrs(attrs), {});
}
```
这里通过`Op::Get(op_name);` 获取对应relay算子，在`Op::Get`函数中发现是通过查表得到。
```cpp
// find operator by name
const Op& Op::Get(const String& name) {
  const OpRegEntry* reg = OpRegistry::Global()->Get(name);
  ICHECK(reg != nullptr) << "AttributeError: Operator " << name << " is not registered";
  return reg->op();
}
```

注册是通过C++的`RELAY_REGISTER_OP("nn.conv2d")`宏注册到`OpRegistry::Global()`中。宏展开为

```cpp
static __attribute__((unused))::tvm::OpRegEntry& __make_Op230 =
    ::tvm::OpRegEntry::RegisterOrGet("nn.conv2d").set_name()
```

注册过程：
```cpp
RELAY_REGISTER_OP("nn.conv2d")
    .describe(R"code(2D convolution layer (e.g. spatial convolution over images).

This layer creates a convolution kernel that is convolved
with the layer input to produce a tensor of outputs.

- **data**: This depends on the `layout` parameter. Input is 4D array of shape
            (batch_size, in_channels, height, width) if `layout` is `NCHW`.
- **weight**: (channels, in_channels, kernel_size[0], kernel_size[1])
- **out**:  This depends on the `layout` parameter. Output is 4D array of shape
            (batch_size, channels, out_height, out_width) if `layout` is `NCHW`.

)code" TVM_ADD_FILELINE)
    .set_attrs_type<Conv2DAttrs>()
    .set_num_inputs(2)
    .add_argument("data", "Tensor", "The input tensor.")
    .add_argument("weight", "Tensor", "The weight tensor.")
    .set_support_level(2)
    .add_type_rel("Conv2D", Conv2DRel<Conv2DAttrs>)
    .set_attr<FInferCorrectLayout>("FInferCorrectLayout", ConvInferCorrectLayout<Conv2DAttrs>);

```
返回的是`OpRegEntry`，后续的`set_name`等，则是通过`OpRegEntry`的get接口（返回的是OpNode），构造对应的Relay op