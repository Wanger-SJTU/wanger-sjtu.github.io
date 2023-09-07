> 本章内容为6.S081课程，工具环境准备操作。由于笔者实验主要在ubuntu 20.04上实现的，下面的操作暂时只介绍ubuntu环境下的设置流程。


在本课程中，需要RISC-V版本的开发工具：QEMU5.1、GDB8.3、GCC和Binutils。

## 通过APT 安装（Debian/Ubuntu）

通过以下命令安装

```bash
sudo apt-get install git build-essential gdb-multiarch qemu-system-misc gcc-riscv64-linux-gnu binutils-riscv64-linux-gnu 
```

据说低版本的qemu有坑，官方建议安装版本为5.1。这里选择通过源码安装。


```bash
git clone https://github.com/mit-pdos/6.828-qemu.git qemu

sudo apt install python libsdl1.2-dev libtool-bin libglib2.0-dev libz-dev libpixman-1-dev

./configure --disable-kvm --disable-werror --target-list="i386-softmmu x86_64-softmmu"

```

执行make报错
```
/usr/bin/ld: qga/commands-posix.o: in function `dev_major_minor':
mit/qemu/qga/commands-posix.c:633: undefined reference to `major'
/usr/bin/ld: mit/qemu/qga/commands-posix.c:634: undefined reference to `minor'
```

解决方法是在`qemu/qga/commands-posix.c`开始加上
#include <sys/sysmacros.h>

make && make install