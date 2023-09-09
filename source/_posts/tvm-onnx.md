---
title: 【TVM模型编译】0.onnx模型优化流程.md
tags:
  - TVM
category:
  - TVM
date: 2023-08-09 15:52:43
---



本文以及后续文章，着重于介绍tvm的完整编译流程。
后续文章将会按照以上流程，介绍tvm源码。其中涉及一些编程技巧、以及tvm概念，不在此部分进行进一步讲解，另有文章进行介绍。


首先介绍一下，从onnx模型转为tvm模型的基本步骤。大致可以分为以下几步：

1. onnx模型转到relay IR
2. 基于Relay IR优化
3. 导出优化模型
4. 加载运行模型

```python
onnx_model = onnx.load(model_path)
target = "llvm"
input_name = "1"
shape_dict = {input_name: x.shape}
# onnx -> relay
mod, params = relay.frontend.from_onnx(onnx_model, shape_dict)
# model build
with tvm.transform.PassContext(opt_level=3):
    lib = relay.build(mod, target=target, params=params)

# Save the library at local temporary directory.
fcompile = ndk.create_shared if not local_demo else None
lib.export_library("net.so", fcompile)
```


```cpp
// cpp load compiled so
tvm::runtime::Module mod_factory = tvm::runtime::Module::LoadFromFile("lib/net.so");
  // create the graph executor module
tvm::runtime::Module gmod = mod_factory.GetFunction("default")(dev);
tvm::runtime::PackedFunc set_input = gmod.GetFunction("set_input");
tvm::runtime::PackedFunc get_output = gmod.GetFunction("get_output");
tvm::runtime::PackedFunc run = gmod.GetFunction("run");

// Use the C++ API
tvm::runtime::NDArray x = tvm::runtime::NDArray::Empty({2, 2}, DLDataType{kDLFloat, 32, 1}, dev);
tvm::runtime::NDArray y = tvm::runtime::NDArray::Empty({2, 2}, DLDataType{kDLFloat, 32, 1}, dev);

for (int i = 0; i < 2; ++i) {
for (int j = 0; j < 2; ++j) {
    static_cast<float*>(x->data)[i * 2 + j] = i * 2 + j;
}
}
// set the right input
set_input("1", x);
// run the code
run();
// get the output
get_output(0, y);

```
