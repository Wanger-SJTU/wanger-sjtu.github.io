---
title: "了解下 FlashInfer SKILLS 写法"
date: 2026-05-05
tags: [FlashInfer, SKILL, CUDA, AI-infra]
source: https://mp.weixin.qq.com/s/rb9-m1IiuzOdZQfNU1nSIA
mathjax: true
---

> 来源：机器之心

## 0x0. 背景

FlashInfer 仓库的 `.claude/skills/` 目录下维护了三个 SKILL 文件。SKILL 允许开发者在项目仓库中放置结构化的指引文档（通常是 SKILL.md 文件），供 AI 代码助手在执行任务时读取和遵循。

核心思路：将项目特有的开发流程、调试方法、最佳实践等知识编码成文档，这样当开发者在 Claude Code/Cursor 中让 AI 帮忙完成相关任务时，AI 会先读取对应的 SKILL 文件，然后按照其中的步骤来执行，而不是靠通用知识去猜测。

举个例子，如果你在 Cursor 中让 AI "帮我给 FlashInfer 添加一个新的 CUDA kernel"，AI 会自动读取 `add-cuda-kernel/SKILL.md`，然后严格按照 FlashInfer 项目自身定义的文件结构、命名规范、测试要求来生成代码。

FlashInfer 目前维护了三个 SKILL：

- **debug-cuda-crash**：CUDA crash 调试教程
- **benchmark-kernel**：Kernel 性能基准测试指南
- **add-cuda-kernel**：添加新 CUDA kernel 的完整流程

---

## 0x1. debug-cuda-crash：CUDA Crash 调试

这个 SKILL 的核心是围绕 FlashInfer 的 `@flashinfer_api` 日志装饰器来做 CUDA crash 调试。

### 问题背景

CUDA 错误（非法内存访问、越界、NaN/Inf 等）经常会直接让程序崩溃，崩溃后没有留下任何调试信息。FlashInfer 的 `@flashinfer_api` 装饰器的做法是在 API 执行之前就把输入信息记录下来，这样即使程序崩溃了，也能看到最后一次调用的输入是什么。

### 使用方式

通过环境变量控制日志级别和输出目标：

| 变量 | 值 | 说明 |
|------|-----|------|
| FLASHINFER_LOGLEVEL | 0 | 不记录（默认） |
| | 1 | 只记录函数名 |
| | 3 | 记录输入/输出的元信息（shape, dtype, device 等） |
| | 5 | 额外记录 tensor 统计信息（min/max/mean/nan_count/inf_count） |
| FLASHINFER_LOGDEST | stdout | 输出到控制台（默认） |
| | stderr | 输出到 stderr |
| | `<path>` | 输出到文件 |
| | log_%i.txt | 多进程模式，%i 会被替换为进程 ID |

典型调试流程：

```bash
export FLASHINFER_LOGLEVEL=3
export FLASHINFER_LOGDEST=debug.log
python my_script.py
```

### 常见错误排查

- **Illegal Memory Access**：用 Level 3 检查 tensor shape、是否在 CUDA 上、stride 是否合理、是否 contiguous
- **NaN/Inf**：用 Level 5 查看 nan_count、inf_count、min/max 是否异常。常见原因包括除零、溢出、未初始化内存
- **Out of Memory**：用 Level 3 检查 tensor shape 是否意外过大
- **Wrong Dtype**：用 Level 3 直接看 dtype 字段

---

## 0x2. benchmark-kernel：Kernel 基准测试

### 计时方法

FlashInfer 支持两种计时方式：

- **CUPTI（推荐）**：硬件级别的 profiling，测量纯 GPU 计算时间，没有 host-device 同步开销
- **CUDA Events（回退）**：标准的 CUDA event 计时

### 使用 flashinfer_benchmark.py

支持的测试 routine 包括：

- **Attention**：BatchDecodeWithPagedKVCacheWrapper、BatchPrefillWithPagedKVCacheWrapper 等
- **GEMM**：bmm_fp8、gemm_fp8_nt_groupwise、group_gemm_fp8_nt_groupwise、mm_fp4
- **MOE**：trtllm_fp4_block_scale_moe、trtllm_fp8_block_scale_moe 等

一个 decode attention 的基准测试示例：

```bash
python benchmarks/flashinfer_benchmark.py \
  --routine BatchDecodeWithPagedKVCacheWrapper \
  --backends fa2 fa2_tc cudnn \
  --page_size 16 --batch_size 32 \
  --s_qo 1 --s_kv 2048 \
  --num_qo_heads 32 --num_kv_heads 8 \
  --head_dim_qk 128 --head_dim_vo 128 \
  --q_dtype bfloat16 --kv_dtype bfloat16 \
  --num_iters 30 --dry_run_iters 5 \
  --refcheck -vv
```

输出包含四个关键指标：

- **median time**：kernel 执行时间的中位数（越低越好）
- **std**：标准差（越低说明越稳定）
- **achieved tflops**：有效 TFLOPS 吞吐
- **achieved tb_per_sec**：内存带宽利用率

---

## 0x3. add-cuda-kernel：添加新 CUDA Kernel

以一个简单的 element-wise scale 操作（`scale(x, factor) = x * factor`）为例，走了一遍完整流程，一共分 10 步。

### Step 1：在 include/ 定义 CUDA Kernel

创建 `include/flashinfer/scale.cuh`，要求框架无关（不依赖 Torch 头文件）：

```cuda
namespace flashinfer {
template <typename T>
__global__ void ScaleKernel(const T* input, T* output, T factor, int n) {
    int idx = blockIdx.x * blockDim.x + threadIdx.x;
    if (idx < n) { output[idx] = input[idx] * factor; }
}

template <typename T>
cudaError_t ScaleLauncher(const T* input, T* output, T factor, int n, cudaStream_t stream = nullptr) {
    const int threads = 256;
    const int blocks = (n + threads - 1) / threads;
    ScaleKernel<T><<<blocks, threads, 0, stream>>>(input, output, factor, n);
    return cudaGetLastError();
}
} // namespace flashinfer
```

### Step 2：在 csrc/ 创建 Launcher

创建 `csrc/scale.cu`，负责 TVM-FFI 的 TensorView 转换、输入校验、dtype dispatch。

### Step 3：创建 TVM-FFI Binding

创建 `csrc/scale_jit_binding.cu`，用 `TVM_FFI_DLL_EXPORT_TYPED_FUNC(run, scale_launcher)` 导出接口。

### Step 4：创建 JIT Generator

创建 `flashinfer/jit/scale.py`，负责 JIT 编译流程。URI 用于唯一标识模块配置。

通过 `supported_major_versions` 参数指定 kernel 支持的 SM 版本：

| 参数 | 支持的架构 | 使用场景 |
|------|-----------|---------|
| None | 所有可用 GPU | 通用 kernel |
| [9, 10, 11, 12] | SM90, SM100, SM110, SM120 | Hopper 及更新 |
| [10, 11, 12] | SM100, SM110, SM120 | Blackwell 及更新 |

### Step 5：创建 Python API

创建 `flashinfer/scale.py`，关键设计模式：

- **`@functools.cache`**：缓存编译好的模块
- **`@flashinfer_api`**：启用日志功能
- **Destination passing style**：输出 tensor 作为可选参数传入（`out: Optional[torch.Tensor] = None`）
- **`@backend_requirement`** 和 **`@supported_compute_capability`** 装饰器：做输入校验和 backend 选择

### Step 6-10：测试、AOT 注册、导出、运行、Benchmark

- **Step 6**：用 pytest 写单元测试，对比 reference 实现
- **Step 7**：在 `flashinfer/aot.py` 中注册，预编译常用配置
- **Step 8**：在 `flashinfer/__init__.py` 中导出 API
- **Step 9**：直接跑测试，kernel 会在首次使用时自动编译
- **Step 10**：添加 benchmark 脚本

### 最终文件清单

| 文件 | 说明 |
|------|------|
| `include/flashinfer/scale.cuh` | 新增：CUDA kernel 定义 |
| `csrc/scale.cu` | 新增：Launcher |
| `csrc/scale_jit_binding.cu` | 新增：TVM-FFI binding |
| `flashinfer/jit/scale.py` | 新增：JIT generator |
| `flashinfer/scale.py` | 新增：Python API |
| `flashinfer/__init__.py` | 修改：导出 API |
| `flashinfer/aot.py` | 修改：注册 AOT |
| `tests/test_scale.py` | 新增：单元测试 |
| `benchmarks/bench_scale.py` | 新增：Benchmark 脚本 |

---

## 0x4. 总结

FlashInfer 的三个 SKILL 文件把项目中三个最核心的开发场景（调试、性能测试、添加新 kernel）的完整流程和最佳实践都文档化了。

- **add-cuda-kernel** 对想要贡献新 kernel 的开发者帮助最大，涵盖了从 CUDA kernel 定义到 Python API 暴露的整条链路
- **debug-cuda-crash** 和 **benchmark-kernel** 更偏向日常使用

对于添加 kernel 的繁琐流程来说，做成 SKILLS 是很不错的，利好所有人。

---

*AI附注：这是关于 FlashInfer 项目 SKILL 文件设计的文章，和 OpenClaw 的 skill 体系有相似之处——都是让 AI 读取项目特定的指引文档来执行任务，而非靠通用知识猜测。FlashInfer 的 SKILL 涵盖 CUDA 调试、kernel 性能测试、添加新 kernel 三个场景。*
