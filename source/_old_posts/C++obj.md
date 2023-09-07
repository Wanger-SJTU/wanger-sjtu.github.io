---
title:  C++ 虚函数表以及64位，32系统区别
date:   2019-4-3
tags: 
  - C++
  - 虚函数
---

首先看一下代码,判断代码的输出是什么

```C++
class MyClass
{
public:
	int a;
	int b;
	MyClass(int tmp1 = 0, int tmp2 = 0)
	{
		a = tmp1;
		b = tmp2;
	}
	int getA() { return a; }
	int getB() { return b; }
	~MyClass() {}
};
int main()
{
	MyClass obj = MyClass(5, 10);
	int* pint = (int*)&obj;
	*(pint + 0) = 100;
	*(pint + 1) = 200;
	
	cout << obj.getA() << endl;
	cout << obj.getB() << endl;
    return 0;
}
```
输出为
> 100,200

使用VS编译可以看到内存布局：
![image](https://tuchuang-1259359185.cos.ap-chengdu.myqcloud.com/_asserts/C%2B%2B-obj/1.jpg)

`pint`此时指向的位置即为`obj.a`的地址，`pint+1`此时指向的位置即为`obj.b`的地址。赋值以后，输出即为`100，200`。


C++中内存对象变量的布局与结构体的布局基本一致，内存对齐方式也一样。唯一不同的是，针对虚函数的实现，在类的内存中有一个虚函数表。

下面看有虚函数时候的结果：
```C++
class MyClass
{
public:
	int a;
	int b;
	virtual void func() {};
	MyClass(int tmp1 = 0, int tmp2 = 0)
	{
		a = tmp1;
		b = tmp2;
	}
	int getA() { return a; }
	int getB() { return b; }
	~MyClass() {}
};
int main()
{
	MyClass obj = MyClass(5, 10);
	int* pint = (int*)&obj;
	cout << sizeof(pint) << endl;
	cout << sizeof(int) << endl;
	*(pint + 0) = 100;
	*(pint + 1) = 200;
	
	cout << obj.getA() << endl;
	cout << obj.getB() << endl;
    return 0;
}
```
首先看一下，内存布局：
![image](https://tuchuang-1259359185.cos.ap-chengdu.myqcloud.com/_asserts/C%2B%2B-obj/2.jpg)

使用VS编译（cl.exe）的时候， 在对象头部添加了一个名字为`__vfptr`的指针。这个指针指向的位置就是虚函数表，可以看到这里虚函数表，就包含了我们定义的虚函数`func()`。
因此，此时的`pint`指向的位置就是`__vfptr`，而不是`obj.a`.

当有虚函数的时候，结果就取决于程序是32位还是64位的了。
在**32位系统**中，指针长度是4字节与int的长度一致。`pint+0` 指向的是`__vfptr`, `pint+1` 指向的是`obj.a`。此时结果为
>100, 10

![image](https://tuchuang-1259359185.cos.ap-chengdu.myqcloud.com/_asserts/C%2B%2B-obj/3.jpg)

在**64位系统**中，指针长度是4字节与int的长度一致。`pint+0` 指向的是`__vfptr`, `pint+1` 指向的是`__vfptr的后半部分`。此时结果为
>5, 10

![image](https://tuchuang-1259359185.cos.ap-chengdu.myqcloud.com/_asserts/C%2B%2B-obj/4.jpg)


>（注：指针+1实际地址走过的字节数取决于指针类型, char* 就是2字节， int* 就是4字节）