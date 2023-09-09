---
title: C++'s most vexing parse
tags:
  - C++
category:
  - C++
date: 2023-08-09 15:48:06
---

C++'s most vexing parse 是 Scott Meyers 在其名著《Effective STL》中创造的一个术语。Scott 用这个术语来形容 C++ 标准对于 declaration 语句的消歧义（ambiguity resolution）约定与常人的认知相悖。

**最令人烦恼的解析** （**most vexing parse**）是C++中的一种反直觉的二义性解析形式。 在一些场景下，编译器无法区分某语句是初始化时某对象的参数，还是声明一个函数时指定参数类型。在这些情况下，编译器将该行解释为函数声明。

形如 `Type()` 或 `Type(name)` 的表达在某些情况下具有歧义（syntax ambiguity）。


 ### C风格强制类型转换
```cpp
void f(double my_dbl) {
  int i(int(my_dbl));
}
```
上面的第 2 行是有歧义的。一种可能的解释是声明一个变量` i `，初始值通过转换`my_dbl` 到一个`int`而来。但是，`C` 允许在函数参数声明周围使用多余的括号；因此，声明的i实际上等同于以下代码：

```cpp
// A function named i takes an integer and returns an integer.
int i(int my_dbl);
```
 ### 未命名的临时对象

```cpp
struct Timer {};
struct TimeKeeper {
  explicit TimeKeeper(Timer t);
  int get_time();
};

int main() {
  TimeKeeper time_keeper(Timer());
  return time_keeper.get_time();
}
```

其中

```cpp
TimeKeeper time_keeper(Timer());
```

是有歧义的，它可以被解释为：

1.  一个变量：定义为类`TimeKeeper`的变量`time_keeper`，用类`Timer`的匿名实例初始化。
2.  一个函数声明：声明了一个函数`time_keeper`，返回一个`TimeKeeper`，有一个（未命名的）参数。参数的类型是一个（指向）不接受输入并返回`Timer`对象的函数（的指针）。

[C ++标准]采取第二种解释，这与上面的第9行不一致。例如，`Clang++`警告第9行存在最令人烦恼的解析，并报错：
```shell
$ clang++ time_keeper.cc
**timekeeper.cc:9:25: warning: parentheses were disambiguated as a function declaration**
      **[-Wvexing-parse]**
  TimeKeeper time_keeper(Timer());
                        **^~~~~~~~~**
**timekeeper.cc:9:26: note:** add a pair of parentheses to declare a variable
  TimeKeeper time_keeper(Timer());
                         ^
                         (      )
**timekeeper.cc:10:21: error: member reference base type 'TimeKeeper (Timer (*)())' is not a**
      **structure or union**
  return time_keeper.get_time();
         **~~~~~~~~~~~^~~~~~~~~**

```

### 解决方案

这些有歧义的声明往往不会被解析为程序员所期望的语句。C++ 中的函数类型通常隐藏在`typedef`之后，并且通常具有显式引用或指针限定符。要强制扭转解析的结果，**常见做法是换一种不同的对象创建或转换语法**。

在类型转换的示例中，有两种替代语法：“C 风格强制类型转换”
```c++
// declares a variable of type int
int i((int)my_dbl);
```

或一个static_cast转换：
```c++
int i(static_cast<int>(my_dbl));
```

在变量声明的示例中，首选方法（自 C++11 起）是统一（大括号）初始化。 这也允许完全省略类型名称：
```cpp
//Any of the following work:
TimeKeeper time_keeper(Timer{});
TimeKeeper time_keeper{Timer()};
TimeKeeper time_keeper{Timer{}};
TimeKeeper time_keeper(     {});
TimeKeeper time_keeper{     {}};
```
在 C++11 之前，强制获得预期解释的常用手段是使用额外的括号或拷贝初始化：
```c++
TimeKeeper time_keeper( /*Avoid MVP*/ (Timer())); // 增加一个括号
TimeKeeper time_keeper = TimeKeeper(Timer());  // c++ 17 拷贝运算可以被优化
```
