---
title: 【TVM教程】 自定义relay算子
tags:
  - TVM
category:
  - TVM
date: 2023-08-09 15:52:02
---

本文为tvm 教程的翻译版。这部分介绍了如何在tvm中添加新的relay算子，具体的是以一个累乘（cumprod）算子为例进行介绍。

新增relay算子基本是下面几个步骤：
1. 定义新增算子的属性节点（Attribute Node），声明在编译时已知的固定参数
2. 为新增算子编写类型关系，以集成到relay的类型系统中
3. 使用C++`RELAY_REGISTER_OP`宏，为新增算子注册生命参数数量、类型、提示信息
4. 算子的compute
5. 注册算子的compute、schedule
6. 定义C++函数，为新增算子生成调用节点，并为该函数注册 Python API hook
7. 将上面的 Python API hook 封装成简洁的调用方式
8. 为新的relay 算子编写测试

## 新增算子的属性节点

算子属性是编译期已知的参数。以卷积算子为例，strid、dilation就属于卷积算子的属性。这部分算子属性定义在`include/tvm/relay/attrs/`下。
最终来说，我们期望定义有如下属性说明的算子，其python侧的接口如下所示

```python
def cumprod(data, axis=None, dtype=None, exclusive=None):
    """Numpy style cumprod op. Return the cumulative inclusive product of the elements along
    a given axis.
    Parameters
    ----------
    data : relay.Expr
        The input data to the operator.
    axis : int, optional
        Axis along which the cumulative product is computed. The default (None) is to compute
        the cumprod over the flattened array.
    dtype : string, optional
        Type of the returned array and of the accumulator in which the elements are multiplied.
        If dtype is not specified, it defaults to the dtype of data.
    exclusive : bool, optional
        If true will return exclusive product in which the first element is not
        included. In other terms, if true, the j-th output element would be
        the product of the first (j-1) elements. Otherwise, it would be the product of
        the first j elements. The product of zero elements will be 1.
    Returns
    -------
    result : relay.Expr
        The result has the same size as data, and the same shape as data if axis is not None.
        If axis is None, the result is a 1-d array.
    """
```
`.cumsum()`有类似的接口。


因此，在定义我们新增算子（cumprod）属性时，需要选择操作的轴、数据类型和排他性作为属性字段。`include/tvm/relay/attrs/transform.h`


ScanopAttrs 这里定义了对累加、累乘等操作的属性定义。对累乘来说就不需要额外定义了。

```cpp
/*! \brief Attributes used in cumsum and cumprod operator */
struct ScanopAttrs : public tvm::AttrsNode<ScanopAttrs> {
  Integer axis;
  DataType dtype;
  Bool exclusive = Bool(false);
  TVM_DECLARE_ATTRS(ScanopAttrs, "relay.attrs.ScanopAttrs") {
    TVM_ATTR_FIELD(axis).describe("The axis to operate over").set_default(NullValue<Integer>());
    TVM_ATTR_FIELD(dtype).describe("Output data type").set_default(NullValue<DataType>());
    TVM_ATTR_FIELD(exclusive)
        .describe("The first element is not included")
        .set_default(Bool(false));
  }
};
```

但是如果是其他的算子，需要自己定义相应的属性节点。如`BiasAdd`就需要单独定义
```c++
struct BiasAddAttrs : public tvm::AttrsNode<BiasAddAttrs> {
  int axis;

  TVM_DECLARE_ATTRS(BiasAddAttrs, "relay.attrs.BiasAddAttrs") {
    TVM_ATTR_FIELD(axis).describe("The axis to add the bias").set_default(1);
  }
};
```

## 类型推导 Type Relation

为了算子注册的灵活性以及relay算子有更好的泛化能力，relay算子通过输入输出之间的类型关系来实例化。
这些关系通过一系列的函数进行表示（这些函数是以算子输入输出类型为参数，返回满足类型关系的输入输出列表）， 、、？
这包括编译期已知的输入输出的shape 信息
本质上，算子relation除了推到输出类型外，还能够强制指定类型规则（检查输入类型）。

然后就是官网教程的给的例子`src/relay/op/tensor/transform.cc`。这里依旧是`ScanopAttrs`

```cpp
TVM_REGISTER_NODE_TYPE(ScanopAttrs);
bool ScanopRel(const Array<Type>& types, int num_inputs, const Attrs& attrs, const TypeReporter& reporter) {
    // types: [data, output]
    ICHECK_EQ(types.size(), 2) << "Expects two types, one for the input and another for the output";
    const auto* data = types[0].as<TensorTypeNode>(); //输入的tensor信息
    if (data == nullptr) {
        ICHECK(types[0].as<IncompleteTypeNode>())
        << "Scanop: expect input type to be TensorType but get " << types[0];
        return false;
    }

    const auto* param = attrs.as<ScanopAttrs>(); //算子属性

    auto dtype = param->dtype;
    if (dtype.is_void()) {
        dtype = data->dtype;
    }
    //设置输出tensor属性
    if (param->axis.defined()) {
        reporter->Assign(types[1], TensorType(data->shape, dtype));
    } else {
        auto prod = data->shape[0];
        for (size_t i = 1; i < data->shape.size(); ++i) {
            prod = prod * data->shape[i];
        }
        reporter->Assign(types[1], TensorType({prod}, dtype));
    }

    return true;
}
```
从上面的例子可以看出 XXXOpRel 的主要功能是根据输入类型确定输出类型。特别的， `TensorType`的构造函数可以看出，需要指定输出的shape信息，这部分主要目的就是infershape和infertype。


## 关联算子的参数数目、属性

这一步的操作，为自定义算子注册算子名称，通过调用接口增加算子注释。这里需要用到C++的宏`RELAY_REGISTER_OP`
涉及的参数含义如下：

- Arity（参数数量）
- 位置参数的名称和描述
- 支持级别（1 表示内部实现;较高的数字表示较少的内部支持或外部支持的算子）
- 算子的类型关系
- 优化算子时有用的其他注释。
`src/relay/op/tensor/transform.cc`

```c++
RELAY_REGISTER_OP("cumsum")
    .describe(
        R"doc(Return the cumulative sum of the elements along a given axis.)doc" TVM_ADD_FILELINE)
    .set_num_inputs(1)
    .add_argument("data", "Tensor", "The input tensor.")
    .set_support_level(3)
    .add_type_rel("Cumsum", ScanopRel)
    .set_attr<TOpPattern>("TOpPattern", kOpaque);

RELAY_REGISTER_OP("cumprod")
    .describe(
        R"doc(Return the cumulative product of the elements along a given axis.)doc" TVM_ADD_FILELINE)
    .set_num_inputs(1)
    .add_argument("data", "Tensor", "The input tensor.")
    .set_support_level(3)
    .add_type_rel("Cumprod", ScanopRel)
    .set_attr<TOpPattern>("TOpPattern", kOpaque);// 不融合
```
注：`set_attr<TOpPattern>("TOpPattern", );`此处表示融合算子是，跳过此算子。


## 编写的算子compute

到现在，我们已经实现了算子的接口，但是还缺少算子的compute逻辑。这部分内容超出了这个教程的范围。
对于`cumprod`和`cumsum`，CPU实现可以参考`python/tvm/topi/scan.py`，GPU实现可以参考`python/tvm/topi/cuda/scan.py`。
这里这两个的实现，直接在TIR基础上实现得到的。

```python
def scanop(
    data: tvm.te.Tensor,
    binop: Callable[["tvm.Expr", "tvm.Expr"], "tvm.Expr"],
    identity_value: "tvm.Expr",
    op_name: str,
    axis: Optional[int] = None,
    dtype: Optional[str] = None,
    exclusive: Optional[bool] = None,
) -> tvm.te.Tensor:
   
    if dtype is None or dtype == "":
        dtype = data.dtype

    if exclusive is None:
        exclusive = False

    def maybe_cast(x):
        if dtype != data.dtype:
            return cast(x, dtype)
        return x

    axis_mul_before = 1
    axis_mul_after = 1

    if axis is None:
        axis = 0
        cumsum_axis_len = prod(data.shape)
        shape = (cumsum_axis_len,)
    else:
        if not isinstance(axis, int):
            axis = get_const_int(axis)

        shape = data.shape
        cumsum_axis_len = shape[axis]

        if axis < 0:
            axis = len(shape) + axis

        for i, value in enumerate(shape, 0):
            if i < axis:
                axis_mul_before *= value
            elif i > axis:
                axis_mul_after *= value

    def gen_ir(data_buf, out_buf):
        ib = ir_builder.create()
        data_buf = ib.buffer_ptr(data_buf)
        out_buf = ib.buffer_ptr(out_buf)

        with ib.for_range(0, axis_mul_before * axis_mul_after, "fused", kind="parallel") as fused:
            i = fused // axis_mul_after
            j = fused % axis_mul_after
            base_idx = i * cumsum_axis_len * axis_mul_after + j
            if exclusive:
                out_buf[base_idx] = cast(identity_value, dtype)
            else:
                out_buf[base_idx] = maybe_cast(data_buf[base_idx])
            with ib.for_range(0, cumsum_axis_len - 1, "_k") as _k:
                k = _k + 1
                cur_idx = base_idx + k * axis_mul_after
                prev_idx = base_idx + (k - 1) * axis_mul_after
                if exclusive:
                    out_buf[cur_idx] = binop(out_buf[prev_idx], maybe_cast(data_buf[prev_idx]))
                else:
                    out_buf[cur_idx] = binop(out_buf[prev_idx], maybe_cast(data_buf[cur_idx]))

        return ib.get()

    out_buf = decl_buffer(shape, dtype, "out_buf")

    return extern(
        [shape],
        [data],
        lambda ins, outs: gen_ir(ins[0], outs[0]),
        dtype=dtype,
        out_buffers=[out_buf],
        name=op_name,
        tag=op_name,
    )

def cumsum(
    data: tvm.te.Tensor,
    axis: Optional[int] = None,
    dtype: Optional[int] = None,
    exclusive: Optional[bool] = None,
) -> tvm.te.Tensor:
    return scanop(
        data=data,
        binop=generic.add,
        identity_value=0,
        op_name="cumsum_generic",
        axis=axis,
        dtype=dtype,
        exclusive=exclusive,
    )

```

## 注册算子的compute、schedule
在实现了算子compute逻辑以后，需要与我们实现的算子接口绑定在一起。在TVM中，这就需要不仅实现算子的compute接口，还要实现对应的schedule。而strategy就是对compute选择合适的schedule。
以卷积算子为例，算子编译时，可能会发现这是一个depthwise卷积，进而去选择更高效的schedule实现。

一般情况下，仅仅考虑CPU、GPU版本即可。
`python/tvm/relay/op/strategy/generic.py` `python/tvm/relay/op/strategy/cuda.py`

```python
def wrap_compute_scanop(topi_compute):
    """Wrap scanop style topi compute"""
    def _compute_scanop(attrs, inputs, _):
        return [topi_compute(inputs[0], attrs.axis, attrs.dtype, attrs.exclusive)]
    return _compute_scanop

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

@cumsum_strategy.register(["cuda", "gpu"])
def cumsum_strategy_cuda(attrs, inputs, out_type, target):
    """cumsum cuda strategy"""
    strategy = _op.OpStrategy()
    strategy.add_implementation(
        wrap_compute_scanop(topi.cuda.cumsum),
        wrap_topi_schedule(topi.cuda.schedule_scan),
        name="cumsum.cuda",
    )
    return strategy
```

对于每个strategy，与对应的compute、schedule通过`add_implementation`关联起来。
这里的shape_func时对输入时动态shape厂家推导有用。

```python
# cumsum
@_reg.register_compute("cumsum")
def compute_cumsum(attrs, inputs, output_type):
    """Compute definition of cumsum"""
    return [topi.cumsum(inputs[0], attrs.axis, attrs.dtype, attrs.exclusive)]

_reg.register_strategy("cumsum", strategy.cumsum_strategy)
_reg.register_shape_func("cumsum", False, elemwise_shape_func)
```

## 定义C++函数，为新增算子生成调用节点，并为该函数注册 Python API hook

现在我们有一个可以调用的relay算子了，下一步就是如何通过relay call node调用。这就需要实现一个函数，传递相应的参数给对于的relay算子，并且返回对应算子的Call Node（这个算子最终在Relay表达式的AST里面）。

当前不支持直接调用 Attrs和参数。所以需要在函数中构造对应的AttrsNode，传递给对应的Call Node。
```cpp
Expr MakeCumsum(Expr data, Integer axis, DataType dtype, Bool exclusive) {
    auto attrs = make_object<ScanopAttrs>();
    attrs->dtype = dtype;
    attrs->axis = axis;
    attrs->exclusive = exclusive;
    static const Op& op = Op::Get("cumsum");
    return Call(op, {data}, Attrs(attrs), {});
}

TVM_REGISTER_GLOBAL("relay.op._make.cumsum").set_body_typed(MakeCumsum);
```

`Op::Get("cumsum")`的实现如下。具体怎么注册到`OpRegistry`的，TODO
```cpp
const Op& Op::Get(const String& name) {
  const OpRegEntry* reg = OpRegistry::Global()->Get(name);
  ICHECK(reg != nullptr) << "AttributeError: Operator " << name << " is not registered";
  return reg->op();
}
```

这里看一下Call的实现，实际上是得到一个call Node，里面保存了算子及其属性信息。
```cpp
Call::Call(Expr op, Array<Expr> args, Attrs attrs, Array<Type> type_args, Span span) {
  ObjectPtr<CallNode> n = make_object<CallNode>();
  n->op = std::move(op);
  n->args = std::move(args);
  n->attrs = std::move(attrs);
  n->type_args = std::move(type_args);
  n->span = std::move(span);
  data_ = std::move(n);
}
```

`Op::Get` `src/relay/op/tensor/transform.cc`

相关接口暴露到python侧，是通过`.TVM_REGISTER_GLOBAL` `MakeCumsum` `MakeCumprod` `relay.op._make.cumsum(...)` `relay.op._make.cumsum(...)`实现的。

细节TODO


## 将上面的 Python API hook 封装成简洁的调用方式

为更方便的使用，通常的做法是构造单独的函数，因此最好封装成更简洁的python接口。教程的例子，定义在
`TVM_REGISTER_GLOBAL` `python/tvm/relay/op/transform.py`

```python
def cumsum(data, axis=None, dtype=None, exclusive=None):
    return _make.cumsum(data, axis, dtype, exclusive)

def cumprod(data, axis=None, dtype=None, exclusive=None):
    return _make.cumprod(data, axis, dtype, exclusive)
```

特别的，如果不定参数的，需要包成Tuple形式进行传递。
```python
def concat(*args):
    """Concatenate the input tensors along the zero axis.

    Parameters
    ----------
    args: list of Tensor

    Returns
    -------
    tensor: The concatenated tensor.
    """
    tup = Tuple(list(args))
    return _make.concat(tup)
```


## 为新的relay 算子编写测试

参考 `tests/python/relay/test_op_level3.py`



ref: https://tvm.apache.org/docs/dev/relay_add_op.html