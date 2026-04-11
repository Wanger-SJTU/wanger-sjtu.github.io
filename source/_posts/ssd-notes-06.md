---
title: SSD笔记 - 第六篇 结论
tags:
  - SSD
  - 存储
  - ZFS
category:
  - 转载
date: 2024-09-22 21:30:31
---

# 前情提要

第六篇，这篇就是把五篇的重点做个摘录。

## 基礎
1. SSD（solid state drive) 是基于 flash NAND memory 制作的储存装置。资料（Bits)储存在不同种类的 cell 里，当时有 SLC, MLC, TLC，分别代表一个 cell 里面可存 1, 2, 3 个 bit(s)，并有不同的读写时间、壽命等特性。
2. 每个 Cell 有 P/E (Program/Erase) cycles 次数限制，超过了该 Cell 就不能用了。意味著 SSD 装置会随著使用过程损耗、有“可預期”的使用年限。
3. 效能评定 (Benchmarking) 很難做。原厂及第三方的報gao都要多看多比较，别輕易相信他们的数字。可以的话自己买了做一次效能测试。并确定你了解效能指标的意义，且该数据有达到你的需求。

## Pages and blocks
1. 鄰近的cell会再组成可被读写的最小单位 page, nand-flash 的 page/分页 大小 2, 4, 8, 16 KB 不等。 鄰近的 page 则会组成 block，通常是 128, 256 个 page 为一 block，因而 block 大小有 256 KB 到 4MB 不等。如 Sxxsung SSD 840 block = 2048 KB, 由 256 个 8 KB page 组成。


2. 即便你只在作业系统读了一个 byte，SSD 的低消还是要读一个 page。
3. 写入/write 一个 page 也称为 program，上面提到的为写一点资料要写一堆的现象也称为 write amplification / 写入放大。
4. page 不能直接被复写。nand-flash 只有在进入 “free” state 才能被写。在我们写入一笔资料的时候我们需要先读出现有内容到暂存器/register，然后再写到其他的 free 的 page 里，原先的 page 会被进入 "stale" state，并等待被清理，这种操作模式称为 "copy-modify-write"
> zfs 以及一些作业系统也有类似的术语 [copy-on-write](https://en.wikipedia.org/wiki/Copy-on-write)，没什么相关就是了。
5. erase 必须以 block 为单位 (Erases are aligned on block size):
page stale 之后必须要清除/erase 才能回到 free 状态

## SSD 控制器与其原理

1. FTL Flash Translation layer
FTL 是 SSD controller 工作之一，负責把 host interface 的 Logical Block Addresses (LBA) 轉 Physical Block Addresses (PBA)。最近很多 controller 实作 hybrid log-block mapping，让随机写入的行为像是 log-structured file systems ，写入行为像是 循序写入 (sequential write)。

2. internel parallelism
controller 内有同时写入許多 block 到不同的 nand-flash 晶片的机制，此写入机制/单位 clustered block。

3. Wear leveling
FTL 的一个功能是让各个 block 的 P/E cycle 接近，大家約在同个时间坏掉。

4. GC / Garbage collection 处理垃圾
controller 的 GC 流程会把 stale page 清除，回到 free state, 以备下次资料写入。

5. background/ 背景作业的 GC 会影響前台 (foreground) 的写入效能

## 建议的 SSD 操作姿勢
1. 避免多次写入小于 page size 的资料。避免 read-modify-write, write amplification. page size 愈大愈好

2. align write, 盡量写入以 page size 为单位的资料
3. 为提升 throughput 盡量把小的写入 cache 到记忆体，在适当实际一次批次写入。
> 这个应该是设计资料库或是有极端效能考量的系统时的需求
4. 读取效率跟写入行为有关，当我们批次写入资料时 SSD controller 会把资料平行写入、四散在各个 nand flash chip 之间。写入资料时将日后可能会一起读取的资料排在一起写会有助于读取效能
> 感觉有点難，所以规划架构的时候用 VM 来区分各个应用程式，如资料库、web server 分离可以较有效运用到这点。 你说 docker, k8s container? 可能也有吧... 我不太确定(TODO)
5. 读写分离
当我们在 SSD 上进行大量小的读写穿插 (interleaved) 的操作时会让 controller 内有的 cache, readahead 机制失效，效能低落。例如如果你有 1000 个 档案需要读写，一个个读写跟一次读 1000 个完了以后再写，后者效能较好。 
> zfs 也有 zil, l2arc 读写 cache 分离的机制。  "the L2ARC for random reads, and the ZIL for writes." [2](#zfs cache-l2arc)
6. 当你要刪资料的时候最好是批次、一次性刪，好让 controller GC 有更多空间可以操作，降低 SSD 内部资料碎片化 fragmentation。

7. 随机写入不一定比循序写入慢
写入的档案小的时候会慢，但档案跟 clustered block 同大时可以利用到 ssd 内部的平行机制，效能跟 sequential weite 差不多好

8. 单执行绪、一次读很多资料的操作比同时跑很多 thread 的读取操作更能利用到 readahead 的机制。因为有可能 LBA 剛好都在同个 flash chip，还是要排队才能拿到资料。很多时候反而单执行绪读取可以更好的运用到 readahead buffer
 
9. 写入情况同上面一条，single threaded large write is better

10. 如果大量小的资料没辦法批次或是快取写入的操作，那还是用多执行绪来写

11. 冷熱分离
常改的资料（熱的）放在一起，因为 read-modify-write 特性的关系，冷资料会跟熱的混在一块，wear leveling 也会一起做，盡可能分开兩类资料能让 GC 更好做事。

12. 熱资料、常改的 metadata 最好有做缓存(buffered) cache 在记忆体里，并避免写到 SSD 里。

## 系统最佳化
1. PCI Express, 企业级的 SAS 比 SATA 效能好，host interface 先天限制。
> 可是最近 HPE SAS [爆了一次](ttps://blocksandfiles.com/2019/11/25/hpe-issues-firmware-fix-to-to-stop-ssd-failure/)

2. Over-provisioning 分割硬碟的时候别把空间全用完，例如留 10~15% 給 GC 运作空间可以提升使用壽命，controller 还是会把那个空间拿来做 wear leveling 等事。如果有更大量写入需求可以考慮拉大到 25 %

3. 开啟 trim 指令，作业系统核心、档案系统可以通知 SSD controller 某个 block 没在用，让 controller 进行 GC 作业。

4. align the partition
确定硬碟格式化时确定分割区与 实体 page 的位置有对齊很重要 [ref](https://tytso.livejournal.com/2009/02/20/)


# 结论
想了解更多的话，作者建议可以再去看 2-5 的参考资料。另外 FAST conference（USENIX conference on file and storage) 也可以看看，了解时事动态。

# 参考资料
#### coding for ssd part6
http://codecapsule.com/2014/02/12/coding-for-ssds-part-6-a-summary-what-every-programmer-should-know-about-solid-state-drives/

#### zfs cache-l2arc
http://www.brendangregg.com/blog/2008-07-22/zfs-l2arc.html

## 相关阅读

- {% post_link ssd-notes-01 'SSD 笔记 - 第一篇：引言' %}
- {% post_link ssd-notes-02 'SSD 笔记 - 第二篇：SSD 结构与性能评估概述' %}
- {% post_link ssd-notes-03 'SSD 笔记 - 第三篇：读写操作与 FTL' %}
- {% post_link ssd-notes-04 'SSD 笔记 - 第四篇：高级功能与内部并行' %}
- {% post_link ssd-notes-05 'SSD 笔记 - 第五篇：访问模式与系统优化' %}