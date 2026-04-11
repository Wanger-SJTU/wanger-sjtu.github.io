---
title: SSD笔记-第二篇SSD结构与性能评估概述
tags:
  - SSD
  - 存储
  - 性能评估
category:
  - 转载
date: 2024-09-22 21:18:46
---
本文转载自：https://www.owlfox.org/blog/2019-11-25-coding-for-SSD-part-2/
# 缘由


这篇主要谈论 Nand flash 的不同 cell type，基本的 SSD 系统架构，及如何做 SSD 效能评定（Benchmarking）。作者是在 booking.com 上班的软体工程师。有用过应该就知道这是很大的旅游订房行程规划服务网站，在这类工作环境可能需要对底层的效能有深入解快，才能解决工作上的实务问题。我觉得这类软体从业人员提供的观点对自己来说帮助很大，所以翻译/兼做做笔记。

# SSD ？
Solid state drives，顾名思义 SSD 设计里去除了传统硬碟里不 solid，会动的部分，改善了噪音、震动、读写速度慢、易损坏及资料分散时需要硬碟重组来改善读取时间等缺点。
SSD 作为储存装置：
* 优点：
  * 随机存取快、且存取时间固定，HDD 的 seek time ？ 没这毛病！
  * 体积小，看看这些愈来愈小的笔记型电脑、移动装置、SD卡
  * 少了传统硬碟机械故障、硬碟重组等烦恼。
* 缺点：
  * Cell 有读写次数限制(wearing off/wear-out)
  > 但对于 IT 人员来说， HDD 也是有看人品、需买高阶型号跟摆乖乖才能保证资料安全的问题。 ![乖乖 LOGO, kuai.com.tw](https://comet.noonspace.com/w61NoonSpace/kuai/MsgInfo/LogoKuai.png)
  * bit/$ 较高, (TODO)

## NAND flash 种类
依各个 block 可储存的资料多寡，可分为：
SLC, MLC, eMLC, TLC, QLC, 3D NAND, see this [link](https://searchstorage.techtarget.com/definition/flash-memory) for ref

关于制程资讯（floating gate, charge trap) 见 [3
](#快闪记忆体的路线之争)

> 关于 IC / PCB / SMT 的制程可能要补文章（TODO）


## 存取介面
目前看到的 SSD 架构 =  SSD controller 晶片 + RAM + NAND flash
controll 支援多种不同的 host interface 指令格式
* Serial ATA (SATA), 3.0 ~ 6GBit/s
* PCI Express (PCIe), 3.0 ~ 8Gbit/s per lane, 4 lanes max
* [nvme](https://nvmexpress.org/)
* Serial Attached SCSI interface (SAS), ~ 12 Gbit/s

> 也有看到 open channel SSD 将主控权交給作业系统，詳情可见 [2](#lightnvm, linux implementation of open channel SSD)。我觉得有点像是 zfs 捨棄 raid 卡让档案系统透过 HBA 卡接管硬碟所有资讯的作法。我觉的软体定义的方式应该是终端用戶最后的选擇，畢竟免了 vendor lock in 的问题。
 
controller 把 NAND flash 的 block, page size, GC(garbage collection) 等細节藏起来，让 host interface 及其上层作业系统有跟 HDD 一样的存取介面。


## 效能评定 Benchmarking
原文作者有发现当时的 SSD 效能報gao[亂象](http://blog.zorinaq.com/many-ssd-benchmark-reviews-contain-flaws/)，例如不同的 [LBA](https://gerardnico.com/io/drive/lba), 过于簡单的 [queue size](https://www.userbenchmark.com/Faq/What-is-queue-depth/41) 测试情节。文中也提到 SSD 的读写测试其实要在写入一定的随机资料[pre-conditioning, warm up](https://searchstorage.techtarget.com/feature/The-truth-about-SSD-performance-benchmarks)才有测出 controller GC 能力并具参考價值。而非当时很多资料是拿了新的 SSD 测了 happy path 很开心就把资料放出来这样，文中舉的比较好的範例是这篇关于 samsung 840 pro 做的[评测](https://www.storagereview.com/samsung_ssd_840_pro_review)，可以很明顯看到读写效能(IOPS, Read/Write at different sizes/order)在一定的读写后明顯下降，文中也对其拿实际的应用案例如资料库、网页伺服器做了分析，并得到其在前述企业应用环境效能较差的结论。

> `图一堆，真是很有心 XD`

目前不确定储存装置是否有个明确的效能评定规範（針对不同应用情jing、不同装置、不同 host interface）。但作者提出一套他的原则（2.3内容）：
* workload type ，确定你的应用环境是哪种读写操作居多
* percentage of read / write, 设定同步进行的读写操作比例，如 30% 读 70% 写
* queue length，你有多少同步执行的执行绪(thread)在对储存装置下指令
* size of data chunk, 你的应用环境的档案读写大小（4KB, 8KB 之类的)

> 最后一点不太确定怎么定义，如果你是跑 postgresql, mysql 那要怎么知道大小？

以及需要观测的指标：
* Throughput: KB/s, MB/s 资料轉換的效率，一般是 sequential 的评定会看
* IOPS: 每秒可完成的 Input/Output（IO） 操作，这是以作业系统的观点来看，通常是拿 4KB 的写入来测，用来评定随机操作的效能。
> 应该是因为 4KB 是大部分作业系统 virtual memory 預设的 page size, 这也要因应使用情节而调整。
* latency:  下指令到完成指令回传结果需要的时间 μs, ms 

IOPS 也可以換算成 throughput, 如 1000 IOPS 在 4KB 档案大小下 就是 4 MB/s. 作者也舉了个可能的 logging 系统案例， 10k IOPS, log 档四散各地，可能的 throughput 会是 20 MB/s 

另外 throughput 不等同于效能，假设你有个伺服器装了个 10G 网卡，偏偏你的系统每次作业要跟 25 个 Database 拿资料，每个连线要花 20 ms 好死不死你还写成 single blocked thread，每次处理一个网页页面至少都要多花 500 ms，这个就偏人的问题，而非系统效能瓶颈。

> 所以我想一般都是在系统发展到一定规模，要做大、或是遇上应用程式端无法解决瓶颈时才会多考慮底层储存系统选擇与设定。

在确保自己的系统架构不会对储存系统造成不必要的负担之后，这三项指标（一起）是系统管理员、软体工程师在评估自己的硬体是否符合需求时的常用指标。



# 参考资料
## coding for ssd part2
[link](http://codecapsule.com/2014/02/12/coding-for-ssds-part-2-architecture-of-an-ssd-and-benchmarking/)

## lightnvm, linux implementation of open channel SSD
links: 
* http://lightnvm.io/
* https://openchannelssd.readthedocs.io/en/latest/
* https://www.usenix.org/conference/fast17/technical-sessions/presentation/bjorling
* https://www.ithome.com.tw/news/122307

## The Myth of HDD Endurance
https://www.micron.com/about/blog/2016/february/the-myth-of-hdd-endurance

## 快闪记忆体的路线之争
https://www.digitimes.com.tw/col/article.asp?id=717

## 相关阅读

- {% post_link ssd-notes-01 'SSD 笔记 - 第一篇：引言' %}
- {% post_link ssd-notes-03 'SSD 笔记 - 第三篇：读写操作与 FTL' %}
- {% post_link ssd-notes-04 'SSD 笔记 - 第四篇：高级功能与内部并行' %}
- {% post_link ssd-notes-05 'SSD 笔记 - 第五篇：访问模式与系统优化' %}
- {% post_link ssd-notes-06 'SSD 笔记 - 第六篇：ZFS 缓存' %}