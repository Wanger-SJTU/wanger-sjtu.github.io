---
title: "Virtual Memory: Page Tables, TLBs, and Linux Internals"
title_color: blue
date: 2026-05-20
mathjax: true
tags: [操作系统, 虚拟内存, Linux, 性能优化]
source: https://blog.codingconfessions.com/p/virtual-memory
---

*原文约 25,000 字，作者 Abhinav Upadhyay，讲述了一个新创建进程 Alloca 与 Kernel 对话的叙事方式，深入讲解虚拟内存、页表、TLB 和 Linux 内部机制。这是一篇接近小册子长度的深度技术文章。*

---

## 核心主题

虚拟内存在现代计算中至关重要，特别是在构建和调试高性能数据密集型系统时。虚拟内存不仅仅是提供进程间的内存隔离，它还做了更多：

- **延迟分配（Lazy Allocation）**：通过需求分页按需分配物理内存
- **写时复制（Copy-on-Write）**：进程间共享内存，实现快速 fork
- **内存映射 I/O（mmap）**：避免 page cache 到 user buffer 的拷贝
- **页回收、Swap、页缓存**
- **性能影响**：访问模式、大页、TLB shootdowns、NUMA 布局

## 关键概念速览

### 为什么需要虚拟内存

两个核心问题：1）每个进程能访问内存而不必担心地址被其他进程占用；2）内存访问要安全但不牺牲性能。通过给每个进程独立的虚拟地址空间，内核确保进程间隔离。

### 虚拟地址空间大小

在 x86-64 上，虽然地址存储在 64 位寄存器中，但只有 48 位参与地址转换。这意味着 2^48 = 256 TiB 的可寻址空间。用户空间占 128 TiB（低半区），内核占 128 TiB（高半区）。

### 虚拟地址空间布局

从低地址到高地址：
- **Text Segment**（代码段）：可执行指令
- **Data Segment**（数据段）：已初始化的全局/静态变量
- **BSS Segment**：未初始化的全局/静态变量（节省二进制文件大小，加载时填充零）
- **Heap**（堆）：动态分配，向上增长
- **Stack**（栈）：向下增长
- **共享库 & 文件映射**：浮动在中间大块区域

### 物理内存与虚拟内存的解耦

虚拟地址空间完全独立于实际安装的物理 RAM。即使机器只有 16GB RAM，虚拟地址空间仍然是 256 TiB。内核负责将虚拟地址映射到物理地址。

> *The beauty of virtual memory: your virtual address space is completely independent of how much physical RAM is installed.*

### 后续内容（原文更深入）

原文约 25,000 字，还包含以下章节：

- **Address Translation**: 层级页表（4级/5级）、页表项结构
- **TLB (Translation Lookaside Buffer)**: MMU 如何加速地址转换、TLB miss 处理
- **Demand Paging**: 物理内存延迟分配、page fault 处理流程
- **Memory Types**: Anonymous、File-backed、Shared、tmpfs 页面及其回收策略
- **Copy-on-Write**: fork 如何实现几乎瞬时的进程创建
- **Memory-mapped I/O**: mmap 如何映射文件到进程地址空间
- **Performance Implications**: 页大小、TLB reach、内存访问模式对性能的影响
- **NUMA Topology**: NUMA 架构下的内存布局与性能
- **Observability on Linux**: 如何检查 VMA、RSS/PSS、page fault、TLB 行为、NUMA 布局

---

*原文链接：https://blog.codingconfessions.com/p/virtual-memory*

*作者还提供了 60 页精美排版的 PDF 版本，售价支持作者工作。*