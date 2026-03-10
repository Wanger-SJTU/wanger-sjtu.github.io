---
title: SSD笔记 - 第五篇 access pattern, 系统配置
tags:
  - ssd
category:
  - 转载
date: 2024-09-22 21:29:20
---

# 前情提要
作者在介绍了 SSD 内部运作原理后，为何同时 (concurrent) 进行的读写行为会互相干涉，并介绍如何更好的 SSD 读写手法。此篇也涵盖了一部分可改善效能的档案系统最佳化手段。

# 7 Access Patterns
## 7.1 定义循序及随机 IO 操作
Sequential/循序：一个 IO 操作的 LBA / Logical block address 开頭接著上一个操作 LBA 的结尾。除此之外皆视为随机。
值得注意的是即便我们 LBA 是连續的，经过 FTL 之后实际存在 physical block 的资料还是可能会四散各处。

## 7.2 写
效能评定報gao及厂商规格通常会顯示循序写入速度慢于随机写入。
但作者这类资料是用小于 clustered block size 的资料量（< 32 MB)的测试，没用到平行机制。如果大于还剛好是倍数，写入的效能是可以比擬的。作者的解释是 parallelism 跟 interleaving 同时上场，也就是写入一个 clustered block 可以保证 SSD 完全用上了设计好的机制。下兩图分别是从 [[2, 8]](#ref) 擷取出来，随机写入效率跟循序写入在写入资料大小跟 clustered block 差不多大的时候是差不多的（大約是 16/32 MB)。
![随机跟循序写入比较](http://codecapsule.com/wp-content/uploads/2014/01/writes-random-01.jpg)
![](http://codecapsule.com/wp-content/uploads/2014/01/writes-random-02.jpg)

然而当随机写入小于 page size 如 16 KB 的资料时，除了写入放大，SSD 工作量也会变多，例如必须要把每一笔 LBA 对应的 PBA mapping 都记录下来，而許多 FTL 用类似 tree 之类的资料结构来存，很多的小资料写入会变成对 FTL RAM 的大量更新操作，而且这个 mapping table 必须在断电后留存 / persisted ，结果就是同时帶来对 nand block 的大量写入 [[1, 5]](#ref)。 循序写入可以降低此类更新 metadata 的情形发生，减少对 flash 的写入。

随机大量小资还会造成大量 copy-erase-write 的现象发生。相较 循序写入至少一个 block 大小的资料的情况，switch merge 等 happy path 更容易在后者发生。随机大量小资还会让 stale page 四散在各个 block，而不是集中在某个区域。这现象也称为 internel fragmentation，造成 cleaning efficiency / 清扫效率降低， GC 需要搬动更多次资料来清除一样大的空间。

至于应用层关心的 concurrency ， 单执行绪的大笔资料写入与多执行绪的同步多笔写入差不多快，而且前者较能利用到 SSD 的平行处理机制，因此费工夫写多执行绪的写入并不会对 IO 的效能有帮助[[1,5]](#ref)，反而有害[[3, 26, 27]](#ref)。

> 但是作者最后备注还是写了如果你没辦法把随机大量小资做缓存批次写入，还是用多执行绪会比较快。

## 7.3 读
總的来说，读比写快。但循序跟随机读取孰快孰慢，不一定。FTL 在写入时动态的/ dynamically 将 LBA 写到 PBA 去，其中更涉及上述的平行机制，资料切块写到各个 channel/package 去，这个写入模式也称为 “write-order-based” [[3]](#ref)。如果读取的順序完全随机，跟写入模式无相关，则读取时先前以平行机制写入的资料不保证在读取时有用。很多时候即便 LBA 是连續的，读取效能也不一定好，甚至连續的 LBA 读取被 mapping 到同一个 channel 上，还是要排队等资料。作者提到 Acunu [[47]](#ref) 有篇 blog 测试发现读取资料的模式与写入的模式有直接关聯。
> [47] 的 Acunu 网站已经掛了。[TODO]: 找替代方案

读取效能与写入模式息息相关，作者建议相关聯的资料最好写在同个 page / block / clustered block 里，确保写入时用到平行机制，相关聯资料放一起也较符合日后读取需求与效能提升条件。

下图是 2 channels, 4 chips, 1 plane/chip 的参考配置图。注意通常一个 chip 里面不只有一个 plane，作者做了些簡化以便说明。大写的英文字分别代表一笔 NAND-flash block 大小的资料。这里我们写入四笔连續的 LBA 资料 `[A, B, C, D]`，剛好也是 clustered block 的大小。利用 clustered block 平行机制(parallelism and interleaving)这四笔资料会被分开写到四个 plane 去。即便他们在 logical address 是连續的，为了效能考量他们会被分到不同的 physical plane。

write-order-based FTL 在选擇写入 clustered block 的时候不会要求在各 plane 的 PBN 要相同，所以图例可以看到 结果写到了 1, 23, 11, 51 这四个位置去。
> 我不太确定作者提这个用意为何，先前他也没有介绍 plane 的设计細节 XD

当我们读取 `[A, B, E, F]`, `[A, B, G, H]` 的时候，前者因为部分资料在同个 plane 里，需要读兩次，后者则可利用到平行机制加快读取。

![](http://codecapsule.com/wp-content/uploads/2014/02/ssd-exploiting-parallelism.jpg)

这会直接影響到内部平行机制对应用层读取资料。因为资料可能剛好在同个 physical channel ，当用多执行绪进行读取不一定能帶来效能提升。另外在 [[3]](#ref) 也指出多执行绪的读取会干擾 readahead (prefetchiing buffer) 的运行。
> 类似 FTL 会先猜你接下来要读的资料，先抓好放著。

雖然 SSD 厂商通常不公开 page/block/clustered block 大小，但是透过基本的测试工具可以抓出个大概。[[2, 3]](#ref)这些资讯可以用来作为最佳化读/写暂存区的大小，并当作分割硬碟的参考依据。

## 7.4 同时/concurrent 读写
[[1, 3]](#ref) 提到交错读写对效能的负面影響，主要是因为读写操作同时进行会競争资源、妨礙 SSD 内部快取、readahead 的运作。
因此作者建议将读写活动分开，如果你有 1000 个档案需要頻繁读写，建议一次读完再一次写入，而不是读了又写读了又写读了又写...

# 8. 系统最佳化
## 8.1 Partition alignment 
3.1 提到当除了写入资料大小是 page 大小倍数之外，写入位置也要对，否则还是会佔了兩个 physical page。[[53]](#ref)
![from [53]](http://blog.nuclex-games.com/wp-content/uploads/2009/12/ssd-unaligned-write.png)
因此了解 SSD 的 NAND page 大小是很重要滴，想知道如何正确的分割硬碟，可以参考 [[54,55]](#ref)
> [54] 坏了
Google 搜尋也可以找到 SSD 型号的相关资料，即便找不到你也可以试著用逆向工程的做法来隔空抓藥[[2,3]](#ref)。

[[43]] 的结果顯示正确的分割磁区对效能有帮助。另外 [[44]](#ref) 也指出跳过/by-passing 档案系统，直接对硬碟下指令对效能有些微帮助。
> 
## 8.2 档案系统参数
5.1 及 [[16]](#ref) 提到的 TRIM 需要从 `discard` 指令开啟。除此之外拿掉 `relatime`, 加入 `noatime, nodiratime` 可能也有帮助。 [[40, 55, 56, 57]](#ref)
## 8.3 Operating system I/O scheduler
CFQ scheduler (Completely Fair Queuing) 是 linux 預设的 scheduler，他会把 LBA 相近的 IO 放在一起执行，降低 seek 操作的延遲。这种安排对没有那些会动机构的 SSD 来说并非必要。[[56, 58]](#ref) 以及其他許多的擁護者都建议从 CFQ 換成 NOOP 排程。但从 linux kernel 3.1 开始 CFQ 也有对 SSD 的一些最佳化 [[59]](#ref)，另外許多效能评定也指出排程器/scheduler 的效能与搭配的应用层负载及硬碟本身都有关系 [[40, 60, 61, 62]](#ref)。
作者认为除非你的应用层模式固定、并且更改 scheduler 确定有帮助，否则建议还是用預设的 CFQ。
## 8.4 Swap
swap 把虛擬记忆体 page 写入硬碟时会帶来大量的 IO 请求，会大幅降低 SSD 壽命。 linux kernel 有个 `vm.swappiness` 可以设定写入 swap 的頻率 0-100 由少到多。Ubuntu 的預设是 60，建议设 0 来避免不必要的 swap，提升 SSD 使用年限。另外也有人建议设成 1 ，作者认为基本上是一样的。[[56, 63, 57, 58]](#ref)
另外也可以用 RAM disk 来做 swap，或是就别用 swap 了。
> 有点不太懂拿 ramdisk 来做 swap 的意义...
## 8.5 Temporary files
暂存档不需要被保存下来，写到 SSD 去是浪费 P/E cycle 建议可以用 tmpfs，保存在记忆体即可。 [[56, 57, 58]](#ref)
# ref
#### coding for ssd part 5
http://codecapsule.com/2014/02/12/coding-for-ssds-part-5-access-patterns-and-system-optimizations/

其他有編号参考资料请至原文观賞：[link](http://codecapsule.com/2014/02/12/coding-for-ssds-part-3-pages-blocks-and-the-flash-translation-layer/#ref)