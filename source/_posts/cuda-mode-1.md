---
title: cuda_mode_1
tags:
  - cuda
  - lecture
category:
  - 技术
date: 2024-09-11 22:14:15
---

# hello load inline

这个是torch加载C++扩展的简单demo。代码比较简单
``` python
import torch
from torch.utils.cpp_extension import load_inline

cpp_source = """
std::string hello() {
  return "Hello World!";
}
"""

my_module = load_inline(
    name='my_module',
    cpp_sources=[cpp_source],
    functions=['hello'],
    verbose=True,
    build_directory='./tmp'
)

print(my_module.hello())
```
执行输出：
```
Emitting ninja build file ./tmp/build.ninja...
Building extension module my_module...
Allowing ninja to set a default number of workers... (overridable by setting the environment variable MAX_JOBS=N)
ninja: warning: build log version is too old; starting over
[1/2] c++ -MMD -MF main.o.d -DTORCH_EXTENSION_NAME=my_module -DTORCH_API_INCLUDE_EXTENSION_H -DPYBIND11_COMPILER_TYPE=\"_gcc\" -DPYBIND11_STDLIB=\"_libstdcpp\" -DPYBIND11_BUILD_ABI=\"_cxxabi1011\" -isystem /home/anaconda3/lib/python3.12/site-packages/torch/include -isystem /home/anaconda3/lib/python3.12/site-packages/torch/include/torch/csrc/api/include -isystem /home/anaconda3/lib/python3.12/site-packages/torch/include/TH -isystem /home/anaconda3/lib/python3.12/site-packages/torch/include/THC -isystem /home/anaconda3/include/python3.12 -D_GLIBCXX_USE_CXX11_ABI=0 -fPIC -std=c++17 -c /mnt/e/cuda_mode_notes/lecture_001/tmp/main.cpp -o main.o 
[2/2] c++ main.o -shared -L/home/anaconda3/lib/python3.12/site-packages/torch/lib -lc10 -ltorch_cpu -ltorch -ltorch_python -o my_module.so
Loading extension module my_module...
Hello World!
```

这个需要创建好tmp文件夹。然后创建编译、加载
```
-rwxrwxrwx  .ninja_deps
-rwxrwxrwx  .ninja_log
-rwxrwxrwx  build.ninja
-rwxrwxrwx  main.cpp
-rwxrwxrwx  main.o
-rwxrwxrwx  my_module.so
```
这里完成了完整的编译流程，把C++代码放在main.cpp中，编译到.o文件，链接到so。然后在python侧加载运行。
需要注意的是，这里底层依赖的是pybind11的库。
```c++
#include <torch/extension.h>

std::string hello() {
  return "Hello World!";
}

PYBIND11_MODULE(TORCH_EXTENSION_NAME, m) {
m.def("hello", torch::wrap_pybind_function(hello), "hello");
}
```

# load_inline.py

这里是上面同样的操作，不同的是这里实现的是CUDA代码，定义了一个平方运算的CUDA程序 。
```python

import torch
from torch.utils.cpp_extension import load_inline

# Define the CUDA kernel and C++ wrapper
cuda_source = '''

__global__ void square_matrix_kernel(const float* matrix, float* result, int width, int height) {
    int row = blockIdx.y * blockDim.y + threadIdx.y;
    int col = blockIdx.x * blockDim.x + threadIdx.x;

    if (row < height && col < width) {
        int idx = row * width + col;
        result[idx] = matrix[idx] * matrix[idx];
    }
}

#include <sys/types.h>
#include <unistd.h>

torch::Tensor square_matrix(torch::Tensor matrix) {
    const auto height = matrix.size(0);
    const auto width = matrix.size(1);
    pid_t pid = getpid();
    printf("pid %d " , pid);
    auto result = torch::empty_like(matrix);

    dim3 threads_per_block(16, 16);
    dim3 number_of_blocks((width + threads_per_block.x - 1) / threads_per_block.x,
                          (height + threads_per_block.y - 1) / threads_per_block.y);

    square_matrix_kernel<<<number_of_blocks, threads_per_block>>>(
        matrix.data_ptr<float>(), result.data_ptr<float>(), width, height);

    return result;
}
'''

cpp_source = "torch::Tensor square_matrix(torch::Tensor matrix);"

# Load the CUDA kernel as a PyTorch extension
square_matrix_extension = load_inline(
    name='square_matrix_extension',
    cpp_sources=cpp_source,
    cuda_sources=cuda_source,
    functions=['square_matrix'],
    with_cuda=True,
    extra_cuda_cflags=["-O2"],
    build_directory='./load_inline_cuda',
    # extra_cuda_cflags=['--expt-relaxed-constexpr']
)

a = torch.tensor([[1., 2., 3.], [4., 5., 6.]], device='cuda')
print(square_matrix_extension.square_matrix(a))
```


运行下来可以正常运行，没啥问题。
```shell
$ python load_inline.py
/home/wanger/anaconda3/lib/python3.12/site-packages/torch/utils/cpp_extension.py:1965: UserWarning: TORCH_CUDA_ARCH_LIST is not set, all archs for visible cards are included for compilation. 
If this is not desired, please set os.environ['TORCH_CUDA_ARCH_LIST'].
  warnings.warn(
tensor([[ 1.,  4.,  9.],
        [16., 25., 36.]], device='cuda:0')
pid 17133 
```

`ncu python load_inline.py ` 这个倒没有跟代码一样报错。不过也没任何输出

```shell
$ ncu python load_inline.py 
==PROF== Connected to process 17416 (/home/wanger/anaconda3/bin/python3.12)
/home/wanger/anaconda3/lib/python3.12/site-packages/torch/utils/cpp_extension.py:1965: UserWarning: TORCH_CUDA_ARCH_LIST is not set, all archs for visible cards are included for compilation. 
If this is not desired, please set os.environ['TORCH_CUDA_ARCH_LIST'].
  warnings.warn(
==ERROR== Unknown Error on device 0.
tensor([[ 1.,  4.,  9.],
        [16., 25., 36.]], device='cuda:0')
pid 17416 
==PROF== Disconnected from process 17416
```

