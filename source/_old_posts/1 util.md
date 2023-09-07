
本章实验的主要目的是熟悉 xv6 和 system call。

## 启动 xv6

本地计算机完成这个任务的话，需要下载xv6的代码。

```bash
git clone git://g.csail.mit.edu/xv6-labs-2020
cd xv6-labs-2020
git checkout util
```
`xv6-labs-2020`是在`xv6-riscv`基础上增加了一部分文件。可以通过`git log`查看。

在命令行
```bash
make qemu
...

xv6 kernel is booting

hart 2 starting
hart 1 starting
init: starting sh
$ 
```
此时可以通过一些简单指令进行交互，如`ls`。退出`ctrl+a x`

## sleep
> 实现`UNIX`系统的sleep函数，可以暂停指定时长。这个定时功能xv6中已经具有相应的函数了。应在`user/sleep.c`下实现该函数。

提示：
1. 先读一下xv6 book的第一章
2. 参考user目录下其他函数的实现，学习如何实现一个命令行函数。
3. 缺少参数时，应该输出错误信息。
4. 命令行读入参数是字符串，需要`atoi (see user/ulib.c)`函数转为整数。
5. 使用系统调用 sleep
6. `kernel/sysproc.c`下的`sys_sleep`函数，是系统调用函数。`user/user.h` 中定义了用户调用函数声明。`user/usys.S`中完成了用户调用到系统调用的转换。
7. 函数结束应调用`exit`退出
8. 在`Makefile`的`UPROGS`下增加相应的实现。


基本需要做的在hint里面都有了介绍了。Utils这部分实验的主要目的在于熟悉xv6这个操作系统，可以用已有的系统调用完成一部分功能。

这个实验也比较简单

```c

// #include "kernel/stat.h"
#include "kernel/types.h"
#include "user/user.h"

void main(int argc, char *argv[]) {
  if (argc < 2) {
    fprintf(1, "Usage: sleep num_seconds...\n");
    exit(1);
  }
  int num = atoi(argv[1]);
  sleep(num);
  exit(0);
}
```

功能实现以后，结合hint的介绍，就可以测试了。

```bash
$ make qemu
    ...
init: starting sh
$ sleep 10
(nothing happens for a little while)
$
```

如果想单独跑sleep这个功能的单元测试
$ make GRADEFLAGS=sleep grade
   
## pingpang

## primes

## find

## xargs

