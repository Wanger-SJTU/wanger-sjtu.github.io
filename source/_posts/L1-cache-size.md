---
title: L1 data 缓存为什么一般只有32K或者64K
tags:
  - 体系结构
  - CPU
category:
  - 技术
date: 2023-09-09 22:16:32
---
L1 data缓存为什么一般只有32K或者64K？为什么不能更大一点？更大不是更好吗？

至少有这么两个原因。L1缓存因为会频繁被访问，所以优化目标是hit time，缓存size越大，hit time越长。另外现代CPU普遍采用virtually index physically tagged（VIPT）的L1缓存，所以L1数据缓存的大小实际上就是page size * associativity。譬如linux-x86上page size一般是4K，那L1d缓存每一个way就只能放4K大小的数据，想缓存总大小大一点就得增加associativity，譬如如果associativity是8，L1d就能是32K。但是associativity太大也会导致hit time上去。再譬如像Mac OS上page size是16K，L1d缓存就能做得更大一点。

注：实际VIPT做缓存查找时，虚拟地址的部分就是页表项，所以实际上虚拟地址部分就对应了page size。为什么跟associativity有关，因为associativity决定了一个页表项的虚拟地址可以映射到几个cacheline，为了最大化利用associativity也就是page size*associativity