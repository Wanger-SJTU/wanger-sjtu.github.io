---
title: c++类型推导
date: 2021-04-20 17:41:22
category: 
    - CPP
tags: 
    - CPP11
    - CPP14
---

C++的模板类型推导，主要分为 `template`、`auto`、`decltype`三种情况。

## item-1 理解模板类型推导（template 和 auto）

通常模板函数声明的形式为

```cpp
template<typename T>
void f(ParaType para){}
```

调用的形式通常为 `f(expr)`。实例化模板时候，会推导出两个参数，模板参数 `T`，是函数参数 `ParaType`。后者通常包含了一部分修饰，如 `const `等。具体的推导类型可以分为三种情况：

- `ParaType`是指针或者是引用，但不是万能引用
- `ParaType`是万能引用
- `ParaType`既不是是指针或者是引用，也不是万能引用

对于 `auto` 的类型推导基本与函数模板的推导一致。不一样的地方，在后面额外指出。

### `ParaType`是指针或者是引用，但不是万能引用

> 1. 忽略`expr`的类型
> 2. `expr`的类型与`ParaType`匹配，确定`T`的类型。

以下面的例子

```cpp
template<typename T>
void f(T& para){}

template<typename T>
void g(const T& param) {}  // param is now a ref-to-const
```

对于下面的调用方式

```cpp
int x = 27;         // x is an int
const int cx = x;   // cx is a const int
const int& rx = x;  // rx is a reference to x as a const int
```

| 调用方式  | expr type       | T type        | ParaType        | 备注                 |
| --------- | --------------- | ------------- | --------------- | -------------------- |
| `f(x)`  | `int`         | `int`       | `int &`       |                      |
| `f(cx)` | `const int`   | `const int` | `const int&`  | 常量性保留           |
| `f(rx)` | `const int &` | `const int` | `const int&`  | 常量性保留，引用忽略 |
| `g(x)`  | `int`         | `int`       | `const int &` |                      |
| `g(cx)` | `const int`   | `int`       | `const int&`  |                      |
| `g(rx)` | `const int &` | `int`       | `const int&`  |                      |

### `ParaType`是万能引用

### `ParaType`既不是是指针，也不是引用

## `template`

## `auto`

## `decltype`
