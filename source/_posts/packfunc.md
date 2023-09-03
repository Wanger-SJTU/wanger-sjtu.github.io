---
title: packfunc
date: 2023-09-03 20:52:39
tags:
    - tvm
    - c++
---


为实现多种语言支持，需要满足以下几点：
- 部署：编译结果可以从`python/javascript/c++`调用。
- Debug: 在python中定义一个函数，在编译函数中调用。
- 链接：编写驱动程序以调用设备特定代码（如CUDA），可以在编译的host侧调用
- 原型：python侧定义IR PASS，并从C++后端调用该代码
- 接口暴露：c++后端代码暴露到python侧
- 实验：将编译的函数运送到嵌入式设备，可以直接在嵌入式设备上运行

tvm希望在任何一个语言中定义的函数，可以在其他的语言中都可以调用。同样希望runtime尽可能的轻量化，以方便在嵌入式设备上部署。


# PackedFunc
`PackedFunc`是解决上述问题的一个优雅的方案。一个`PackedFunc`对象对应着一个函数调用，即使定义与调用分散在不同语言之间也可以满足。下面展示一个C++的例子。

```cpp
#include <tvm/runtime/packed_func.h>

void MyAdd(TVMArgs args, TVMRetValue* rv) {
  // automatically convert arguments to desired type.
  int a = args[0];
  int b = args[1];
  // automatically assign value return to rv
  *rv = a + b;
}

void CallPacked() {
  PackedFunc myadd = PackedFunc(MyAdd);
  // get back 3
  int c = myadd(1, 2);
}
```
上面的例子中，定义了一个`MyAdd`的`PackedFunc`，接受两个参数，`args`表示输入参数， `rv`表示返回值。这个参数是类型无关的(type-erased)，这意味着函数签名中对输入输出参数的类型没有限制。这样，当调用这个函数的时候， 从栈上获取输入参数（TVMArgs），通过TVMRetValue返回函数返回值。

通过C++的模板技巧，可以像正常函数一样调用`PackedFunc`。由于类型无关的特性，可以在像python这样的动态类型的语言中调用`PackedFunc`，而无需插入额外其他的胶水代码。下面展示了`PackedFunc` 的注册及其在python端的调用。
```cpp
// register a global packed function in c++
TVM_REGISTER_GLOBAL("myadd")
.set_body(MyAdd);
```

```python
import tvm

myadd = tvm.get_global_func("myadd")
# prints 3
print(myadd(1, 2))
```

多数的`PackedFunc`技巧依赖于`TVMArgs`和`TVMRetValue`，我们限制其中的参数类型，下面是主要用的类型：

- int, float and string
- PackedFunc itself
- Module for compiled modules
- DLTensor* for tensor object exchange
- TVM Object to represent any object in IR

这个限制，使得实现及其简单而且无需序列化操作。虽然增加了限制，但对于DL开发来说，大多数场景下仅仅需要传递`DLTensor`和数字就够了。

既然`PackedFunc`可以将另外的PackedFunc作为函数参数，那就可以在python与c++之间传递函数。

```cpp
TVM_REGISTER_GLOBAL("callhello")
.set_body([](TVMArgs args, TVMRetValue* rv) {
  PackedFunc f = args[0];
  f("hello world");
});
```

```python
import tvm

def callback(msg):
  print(msg)

# convert to PackedFunc
f = tvm.convert(callback)
callhello = tvm.get_global_func("callhello")
# prints hello world
callhello(f)
```

TVM 提供了极简的C API，使得将PackedFunc可以方便地嵌入到其他的语言中。除python外，还支持java、JavaScript。

PackFunction不仅用于tvm编译器中，同样也用于开发的技术栈中。在tvm中所有的PASS函数都通过PackedFunc暴露给前端的。编译结果同样是通过PackedFunc打包的。

为了保证runtime尽可能的小，runtime中隔离了IR对象的支持。这使得runtime大小只有200~600k，具体的大小取决于平台驱动部分。

PackedFunc带来的调用开销很小，仅仅是通过栈传递了一些参数对象，只要不通过它包装较小的函数，就是OK的。总之，PackedFunc是tvm中通用的胶水代码，支持了tvm的编译部署。


额外的部分：

## c++ 注册，python调用
上文中介绍注册时，使用到了一个C++宏`TVM_REGISTER_GLOBAL`，这里介绍中间是如何链接起来的。

```cpp
TVM_REGISTER_GLOBAL("callhello")
.set_body([](TVMArgs args, TVMRetValue* rv) {
  PackedFunc f = args[0];
  f("hello world");
});

//展开就是
TVM_STR_CONCAT(TVM_FUNC_REG_VAR_DEF, __COUNTER__) = ::tvm::runtime::Registry::Register("callhello").set_body([](TVMArgs args, TVMRetValue* rv) {
  PackedFunc f = args[0];
  f("hello world");
});
```

这里的`::tvm::runtime::Registry::Register`
```cpp
Registry& Registry::Register(const std::string& name, bool can_override) {  // NOLINT(*)
  Manager* m = Manager::Global();//这是个静态对象，Manager持有一个map来记录注册对象
  std::lock_guard<std::mutex> lock(m->mutex);
  if (m->fmap.count(name)) {
    ICHECK(can_override) << "Global PackedFunc " << name << " is already registered";
  }

  Registry* r = new Registry();
  r->name_ = name;
  m->fmap[name] = r;
  return *r;
}
```
下面看下Registry的实现。

```cpp
/*! \brief Registry for global function */
class Registry {
 public:
  //设置函数体
  TVM_DLL Registry& set_body(PackedFunc f);  // NOLINT(*)
  Registry& set_body(PackedFunc::FType f) {  // NOLINT(*)
    return set_body(PackedFunc(f));
  }
  
  //给一个任意函数，萃取函数签名
  template <typename FLambda>
  Registry& set_body_typed(FLambda f) {
    using FType = typename detail::function_signature<FLambda>::FType;
    return set_body(TypedPackedFunc<FType>(std::move(f), name_).packed());
  }
  //给一个类成员函数、返回值、参数，使用lambda包装
  template <typename T, typename R, typename... Args>
  Registry& set_body_method(R (T::*f)(Args...)) {
    auto fwrap = [f](T target, Args... params) -> R {
      // call method pointer
      return (target.*f)(params...);
    };
    return set_body(TypedPackedFunc<R(T, Args...)>(fwrap, name_));
  }

  template <typename T, typename R, typename... Args>
  Registry& set_body_method(R (T::*f)(Args...) const) {
    auto fwrap = [f](const T target, Args... params) -> R {
      // call method pointer
      return (target.*f)(params...);
    };
    return set_body(TypedPackedFunc<R(const T, Args...)>(fwrap, name_));
  }
  //
  template <typename TObjectRef, typename TNode, typename R, typename... Args,
            typename = typename std::enable_if<std::is_base_of<ObjectRef, TObjectRef>::value>::type>
  Registry& set_body_method(R (TNode::*f)(Args...)) {
    auto fwrap = [f](TObjectRef ref, Args... params) {
      TNode* target = ref.operator->();
      // call method pointer
      return (target->*f)(params...);
    };
    return set_body(TypedPackedFunc<R(TObjectRef, Args...)>(fwrap, name_));
  }

  template <typename TObjectRef, typename TNode, typename R, typename... Args,
            typename = typename std::enable_if<std::is_base_of<ObjectRef, TObjectRef>::value>::type>
  Registry& set_body_method(R (TNode::*f)(Args...) const) {
    auto fwrap = [f](TObjectRef ref, Args... params) {
      const TNode* target = ref.operator->();
      // call method pointer
      return (target->*f)(params...);
    };
    return set_body(TypedPackedFunc<R(TObjectRef, Args...)>(fwrap, name_));
  }

  TVM_DLL static Registry& Register(const std::string& name, bool override = false);  // NOLINT(*)
  
  TVM_DLL static bool Remove(const std::string& name);
  
  TVM_DLL static const PackedFunc* Get(const std::string& name); 
  TVM_DLL static std::vector<std::string> ListNames();

  struct Manager;

 protected:
  std::string name_;
  PackedFunc func_;
  friend struct Manager;
};
```
上面注册以后是在一个全局对象中，下一部就看python侧如何调用的。


python端最终会调用到 `_get_global_func`函数，具体实现如下。


```python
def _get_global_func(name, allow_missing=False):
    handle = PackedFuncHandle()
    check_call(_LIB.TVMFuncGetGlobal(c_str(name), ctypes.byref(handle)))

    if handle.value:
        return _make_packed_func(handle, False)

    if allow_missing:
        return None

    raise ValueError("Cannot find global function %s" % name)
```

进而会调用到`TVMFuncGetGlobal`
```cpp
int TVMFuncGetGlobal(const char* name, TVMFunctionHandle* out) {
  API_BEGIN();
  const tvm::runtime::PackedFunc* fp = tvm::runtime::Registry::Get(name);
  if (fp != nullptr) {
    *out = new tvm::runtime::PackedFunc(*fp);  // NOLINT(*)
  } else {
    *out = nullptr;
  }
  API_END();
}
```
这里既可以发现`tvm::runtime::Registry::Get(name)`来查找相关注册函数的。


## python注册，c++ 调用

如下面的函数，通过装饰器注册。
```python
@tvm._ffi.register_func("relay.backend.lower_call")
```
在c++中调用
```c++
static auto flower_call = tvm::runtime::Registry::Get("relay.backend.lower_call");
```

下面介绍以下python的注册。
```python
def register_func(func_name, f=None, override=False):
    if callable(func_name):
        f = func_name
        func_name = f.__name__

    if not isinstance(func_name, str):
        raise ValueError("expect string function name")

    ioverride = ctypes.c_int(override)

    def register(myf):
        """internal register function"""
        if not isinstance(myf, PackedFuncBase):
            myf = convert_to_tvm_func(myf) #转化为packfunc
        #注册
        check_call(_LIB.TVMFuncRegisterGlobal(c_str(func_name), myf.handle, ioverride))
        return myf

    if f:
        return register(f)
    return register
```

```python
def convert_to_tvm_func(pyfunc):
    local_pyfunc = pyfunc

    def cfun(args, type_codes, num_args, ret, _):
        """ ctypes function """
        num_args = num_args.value if isinstance(num_args, ctypes.c_int) else num_args
        pyargs = (C_TO_PY_ARG_SWITCH[type_codes[i]](args[i]) for i in range(num_args))
        # pylint: disable=broad-except
        try:
            rv = local_pyfunc(*pyargs)
        except Exception:
            msg = traceback.format_exc()
            msg = py2cerror(msg)
            _LIB.TVMAPISetLastError(c_str(msg))
            return -1

        if rv is not None:
            if isinstance(rv, tuple):
                raise ValueError("PackedFunction can only support one return value")
            temp_args = []
            values, tcodes, _ = _make_tvm_args((rv,), temp_args)
            if not isinstance(ret, TVMRetValueHandle):
                ret = TVMRetValueHandle(ret)
            if _LIB.TVMCFuncSetReturn(ret, values, tcodes, ctypes.c_int(1)) != 0:
                raise get_last_ffi_error()
            _ = temp_args
            _ = rv
        return 0

    handle = PackedFuncHandle()
    f = TVMPackedCFunc(cfun)
    # NOTE: We will need to use python-api to increase ref count of the f
    # TVM_FREE_PYOBJ will be called after it is no longer needed.
    pyobj = ctypes.py_object(f)
    ctypes.pythonapi.Py_IncRef(pyobj)
    if _LIB.TVMFuncCreateFromCFunc(f, pyobj, TVM_FREE_PYOBJ, ctypes.byref(handle)) != 0:
        raise get_last_ffi_error()
    return _make_packed_func(handle, False)
```


```c++
int TVMFuncRegisterGlobal(const char* name, TVMFunctionHandle f, int override) {
  API_BEGIN();
  tvm::runtime::Registry::Register(name, override != 0)
      .set_body(*static_cast<tvm::runtime::PackedFunc*>(f));
  API_END();
}
```