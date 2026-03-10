---
title: SSD笔记 - 第四篇 FTL 其他功能及平行机制
tags:
  - ssd
category:
  - 转载
date: 2024-09-22 21:28:36
---

# 前情提要
在了解 FTL 之后，这里将对 TRIM, over-provisioning 作介绍，并探讨 clustered block 以及 SSD 不同层级的平行机制。

# 5 Advanced functionalities

## 5.1 TRIM
依照 HDD 的慣例，档案系统刪除资料时不一定要真的下抹除指令到硬碟去（真的要刪的时候只要直接复写过去就好了）。造成可能有档案系统回報硬碟是空的、里面塞满实质 stale 的资料但 controller 不知情的情况。这会造成 controller 没法有效 GC，到了发现要复写了才开始清出空间，最后导致效能低落。

另外一个问题是，controller 快乐的把那些 controller 应该知道要刪除的资料搬来搬去做 wear leveling，但是这些都是做白工，而且干擾了 foreground 的读写工作。

> 有没有跟職场环jing有点像？

对这个问题的一个解法是 TRIM 指令，由作业系统送出，gao知 SSD controller 某些 page 已经被刪掉了，没有留存在 logical space 的必要。有了这个资讯 SSD 就不用把那些 page 搬来搬去，并适时刪除。这个指令必须要在 SSD controller, 作业系统, 档案系统都有支援的情况下才有用。

維基百科的 TRIM 页面有列出支援的作业系统及档案系统[[16]](#ref)，

> 关心 zfs 的人，freeBSD 9.2 及近期的 [zfsOnLinux 8.0](https://www.phoronix.com/scan.php?page=news_item&px=ZFS-On-Linux-TRIM-Lands) 都有支援 TRIM，愈来愈适合装在笔电上啦。

5.2 Over-provisioning
透过提供更多备用的 physical block 来让 SSD gc 更好做事、提升壽命。大部分的 SSD 都有将 7 ~ 25% 的空间做 over-provisioning[[13]](#ref)。使用者也可以加码在分割硬碟的时候留更多空间，例如 100 GB 的硬碟，切了 90 GB 来用，其他摆著，controller 一样会把那些空间拿来做 GC 等用途。

AnandTech 的一篇关于 over-provisioning 的文章，建议除了制造商原有的之外可以做到 25% 来达到更好的 SSD 存取效能[[34]](#ref)。另外一篇 Percona 的文章指出 Intel 320 SSD 在将满时写入效能低落的现象[[38]](#ref)。

作者对这现象的解释是如果 SSD controller 始终保持在忙碌状态，就会找不到适当实际进行 GC，清出 free state 的 block，直到 free block 用完了才不得不做。在这时候 FTL 已经无法像先前那样有效率的完成 foreground 读写操作，必须等 GC 清出空间才能做，这导致严重的效能下降。 over-provisioning 可以协助减缓此类现象的发生，让 FTL 有更多的空间支应大量的写入操作。至于需要多大的空间来做，作者建议如果需要因应尖峰时段大量随机写入，上看25%，不需要的话 10 ~ 15%即可。

# 5.3 Secure Erase
有部分型号提供 ATA Secure Erase 功能可以让 SSD 所有 block 清为 free，清空各 FTL mapping table。这可以解决资讯安全及使 SSD 效能恢复至出厂状态。不过 [[11]](#ref) 提到很多大部分厂商的实作都有问题。 Stackoverflow 上面有对于资讯安全议题的相关讨论，也可以看到如何更有效的把资料确实从 SSD 上抹除，也有一篇 [paper](https://www.usenix.org/legacy/events/fast11/tech/full_papers/Wei.pdf) 在讨论这件事，，原则上就是挑选有支援加密的型号，或是你直接用有加密的档案系统。 [[48, 49]](#ref)
> 还有把硬碟丟到调理机里面

# 5.4 Native Command Queueing (NCQ)
SATA 让 SSD 可以批次接受多个指令，利用内部平行处理机制的功能[[3]](#ref)。除了降低延遲之外，部分 controller 也提供此机制让 host CPU 可以批次下指令，当 CPU 工作量大的时候有帮助 [[39]](#ref)

## 5.5 断电保護
部分实作利用 supercapacitor 来保持 SSD 在断电之后仍有足夠能量完成 host bus 的指令。不过作者指出这个跟 Secure Erase 一样，各家实作不同，也没有统一规範。

[[72]](#ref) Zheng et al., 2013 在断电壓力测试中测了 15 款 SSD，没透露厂家，但掉资料、系统损毀的比例 13/15。另外一位 Luke Kenneth Casson Leighton 也拿了四款 SSD 来做测试，只有 Intel 没掉资料 [[73]](#ref)。

> 如果是资讯机房的话还是要牢记备份 321 原则，还有上 UPS 跟自动关机机制。

# 6. SSD 内部平行处理机制
## 6.1 有限的 IO 頻寬
因 nand flash 物理限制，单一 package 的 io 頻寬极限是在 32-40 MB [[5]](#ref)。因此能提升存取效能的方法就是 parallelized/平行化 或是 interleaved 解释可见 [[2]](http://csl.skku.edu/papers/CS-TR-2010-329.pdf)的 2.2。
> interleved 类似 pipelined 

藉由结合不同层级的内部平行处理机制，SSD 可以同时 simutaneously  存取多个 block，又称 clustered block. 作者建议想了解細节的人去看 [[2, 3]](#ref)，进阶指令如 copyback, inter-plane transfer 可参考 [[5]](#ref)。

## 6.2 不同层级的平行机制
![](http://codecapsule.com/wp-content/uploads/2014/02/ssd-package.jpg)
上图为 nand flash 的内部结构，所謂的层级即是 channel, package, chip, plane, block, 到 page ，以离 controller 的距离来做分级。
* Channel-level parallelism. 
controller 与 package 透过多个 channel 溝通，各channel 可被獨立运用，也可同步使用，各个 channgel 由多个 package 共用。
* Package-level parallelism. 
在同个 channel 上的 package 可以被同时存取，上面提到的 interleaving 可以用在同 channel 的 package 上。
* Chip-level parallelism. 
一个 package 里有兩个以上的 die/chip 可被平行存取。
* Plane-level parallelism.
一个 chip 里面有兩个以上的 plane, 同个指令（读写抹）可同时下在 chip 的各 plane 上。plane 里面有 block, block 里面有 page。plane 里面还有一些暂存器（小的 RAM 缓存区），用来协助 plane 层级的操作。

# 6.3 Clustered blocks

对分布在不同 chip 的多个 block 的操作也称为 clustered block [[2]](#ref). 跟 HDD raid 的 striping 概念有点像 [[1, 5]](#ref).

批次对 LBA 的存取会被视为 clustered 操作，并同时对不同的 flash package 做存取。多虧了 FTL 的 mapping 演算法/资料结构，即便我们不是做循序的读写，一样可以发揮 FTL 平行运算的超能力。分散 block 到各个 channel 去让我们的读写抹都可以平行处理。意味著当我们 IO 的大小是 clustered block 的倍数，并有把 LBA 对齊，将可充分利用 SSD 内部各层级的平行运作机制。下一篇的 8.2 8.3 有更多介绍


# ref
0. [coding for ssd part 4](http://codecapsule.com/2014/02/12/coding-for-ssds-part-4-advanced-functionalities-and-internal-parallelism/)

其他有編号参考资料请至原文观賞：[link](http://codecapsule.com/2014/02/12/coding-for-ssds-part-3-pages-blocks-and-the-flash-translation-layer/#ref)