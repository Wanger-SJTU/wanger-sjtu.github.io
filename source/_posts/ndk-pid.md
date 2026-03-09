---
title: ndk std_thread 获取pid
tags:
  - TVM
  - CPP
  - NDK
category:
  - 技术
date: 2023-09-09 15:49:36
---



最近在解决tvm绑核问题时，发现android下绑核只有`sched_setaffinity`函数，这导致无法使用标准库中的`td::thread::native_handle_type thread` 进行绑核操作。虽然在ndk 21以上的版本提供了`pthread_gettid_np`函数获取线程相应的pid，但在较低版本中，还是没办法直接使用。

看下ndk 中 std 标准库上thread 的实现。

```cpp
class _LIBCPP_TYPE_VIS thread
{
    __libcpp_thread_t __t_;
   ...

public:
    typedef __thread_id id;
    typedef __libcpp_thread_t native_handle_type;
  ...
};

typedef pthread_t __libcpp_thread_t;
typedef long pthread_t;
```

上面可以看出，在ndk的实现中`native_handle_type` 等价于`pthread_t`, 再根据`pthread_gettid_np`的实现，可以发现 ，`pthread_t` 其实就是`pthread_internal_t`的地址。在`pthread_internal_t`中保存了线程的`tid` 


```cpp

pid_t pthread_gettid_np(pthread_t t) {
return __pthread_internal_gettid(t, "pthread_gettid_np");
}

pid_t __pthread_internal_gettid(pthread_t thread_id, const char* caller) {
pthread_internal_t* thread = __pthread_internal_find(thread_id, caller);
return thread ? thread->tid : -1;

}

```

```cpp
typedef struct pthread_internal_t

{

struct pthread_internal_t* next;

struct pthread_internal_t* prev;

pthread_attr_t attr;

pid_t tid;

bool allocated_on_heap;

pthread_cond_t join_cond;

int join_count;

void* return_value;

int internal_flags;

__pthread_cleanup_t* cleanup_stack;

void** tls; /* thread-local storage area */

/*

* The dynamic linker implements dlerror(3), which makes it hard for us to implement this

* per-thread buffer by simply using malloc(3) and free(3).

*/

#define __BIONIC_DLERROR_BUFFER_SIZE 512

char dlerror_buffer[__BIONIC_DLERROR_BUFFER_SIZE];

} pthread_internal_t;
```