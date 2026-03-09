---
title: SSD筆記 - 第四篇 FTL 其他功能及平行機制
tags:
  - ssd
category:
  - 转载
date: 2024-09-22 21:28:36
---

# 前情提要
在了解 FTL 之後，這裡將對 TRIM, over-provisioning 作介紹，並探討 clustered block 以及 SSD 不同層級的平行機制。

# 5 Advanced functionalities

## 5.1 TRIM
依照 HDD 的慣例，檔案系統刪除資料時不一定要真的下抹除指令到硬碟去（真的要刪的時候只要直接複寫過去就好了）。造成可能有檔案系統回報硬碟是空的、裡面塞滿實質 stale 的資料但 controller 不知情的情況。這會造成 controller 沒法有效 GC，到了發現要複寫了才開始清出空間，最後導致效能低落。

另外一個問題是，controller 快樂的把那些 controller 應該知道要刪除的資料搬來搬去做 wear leveling，但是這些都是做白工，而且干擾了 foreground 的讀寫工作。

> 有沒有跟職場環境有點像？

對這個問題的一個解法是 TRIM 指令，由作業系統送出，告知 SSD controller 某些 page 已經被刪掉了，沒有留存在 logical space 的必要。有了這個資訊 SSD 就不用把那些 page 搬來搬去，並適時刪除。這個指令必須要在 SSD controller, 作業系統, 檔案系統都有支援的情況下才有用。

維基百科的 TRIM 頁面有列出支援的作業系統及檔案系統[[16]](#ref)，

> 關心 zfs 的人，freeBSD 9.2 及近期的 [zfsOnLinux 8.0](https://www.phoronix.com/scan.php?page=news_item&px=ZFS-On-Linux-TRIM-Lands) 都有支援 TRIM，愈來愈適合裝在筆電上啦。

5.2 Over-provisioning
透過提供更多備用的 physical block 來讓 SSD gc 更好做事、提升壽命。大部分的 SSD 都有將 7 ~ 25% 的空間做 over-provisioning[[13]](#ref)。使用者也可以加碼在分割硬碟的時候留更多空間，例如 100 GB 的硬碟，切了 90 GB 來用，其他擺著，controller 一樣會把那些空間拿來做 GC 等用途。

AnandTech 的一篇關於 over-provisioning 的文章，建議除了製造商原有的之外可以做到 25% 來達到更好的 SSD 存取效能[[34]](#ref)。另外一篇 Percona 的文章指出 Intel 320 SSD 在將滿時寫入效能低落的現象[[38]](#ref)。

作者對這現象的解釋是如果 SSD controller 始終保持在忙碌狀態，就會找不到適當實際進行 GC，清出 free state 的 block，直到 free block 用完了才不得不做。在這時候 FTL 已經無法像先前那樣有效率的完成 foreground 讀寫操作，必須等 GC 清出空間才能做，這導致嚴重的效能下降。 over-provisioning 可以協助減緩此類現象的發生，讓 FTL 有更多的空間支應大量的寫入操作。至於需要多大的空間來做，作者建議如果需要因應尖峰時段大量隨機寫入，上看25%，不需要的話 10 ~ 15%即可。

# 5.3 Secure Erase
有部分型號提供 ATA Secure Erase 功能可以讓 SSD 所有 block 清為 free，清空各 FTL mapping table。這可以解決資訊安全及使 SSD 效能恢復至出廠狀態。不過 [[11]](#ref) 提到很多大部分廠商的實作都有問題。 Stackoverflow 上面有對於資訊安全議題的相關討論，也可以看到如何更有效的把資料確實從 SSD 上抹除，也有一篇 [paper](https://www.usenix.org/legacy/events/fast11/tech/full_papers/Wei.pdf) 在討論這件事，，原則上就是挑選有支援加密的型號，或是你直接用有加密的檔案系統。 [[48, 49]](#ref)
> 還有把硬碟丟到調理機裡面

# 5.4 Native Command Queueing (NCQ)
SATA 讓 SSD 可以批次接受多個指令，利用內部平行處理機制的功能[[3]](#ref)。除了降低延遲之外，部分 controller 也提供此機制讓 host CPU 可以批次下指令，當 CPU 工作量大的時候有幫助 [[39]](#ref)

## 5.5 斷電保護
部分實作利用 supercapacitor 來保持 SSD 在斷電之後仍有足夠能量完成 host bus 的指令。不過作者指出這個跟 Secure Erase 一樣，各家實作不同，也沒有統一規範。

[[72]](#ref) Zheng et al., 2013 在斷電壓力測試中測了 15 款 SSD，沒透露廠家，但掉資料、系統損毀的比例 13/15。另外一位 Luke Kenneth Casson Leighton 也拿了四款 SSD 來做測試，只有 Intel 沒掉資料 [[73]](#ref)。

> 如果是資訊機房的話還是要牢記備份 321 原則，還有上 UPS 跟自動關機機制。

# 6. SSD 內部平行處理機制
## 6.1 有限的 IO 頻寬
因 nand flash 物理限制，單一 package 的 io 頻寬極限是在 32-40 MB [[5]](#ref)。因此能提升存取效能的方法就是 parallelized/平行化 或是 interleaved 解釋可見 [[2]](http://csl.skku.edu/papers/CS-TR-2010-329.pdf)的 2.2。
> interleved 類似 pipelined 

藉由結合不同層級的內部平行處理機制，SSD 可以同時 simutaneously  存取多個 block，又稱 clustered block. 作者建議想了解細節的人去看 [[2, 3]](#ref)，進階指令如 copyback, inter-plane transfer 可參考 [[5]](#ref)。

## 6.2 不同層級的平行機制
![](http://codecapsule.com/wp-content/uploads/2014/02/ssd-package.jpg)
上圖為 nand flash 的內部結構，所謂的層級即是 channel, package, chip, plane, block, 到 page ，以離 controller 的距離來做分級。
* Channel-level parallelism. 
controller 與 package 透過多個 channel 溝通，各channel 可被獨立運用，也可同步使用，各個 channgel 由多個 package 共用。
* Package-level parallelism. 
在同個 channel 上的 package 可以被同時存取，上面提到的 interleaving 可以用在同 channel 的 package 上。
* Chip-level parallelism. 
一個 package 裡有兩個以上的 die/chip 可被平行存取。
* Plane-level parallelism.
一個 chip 裡面有兩個以上的 plane, 同個指令（讀寫抹）可同時下在 chip 的各 plane 上。plane 裡面有 block, block 裡面有 page。plane 裡面還有一些暫存器（小的 RAM 緩存區），用來協助 plane 層級的操作。

# 6.3 Clustered blocks

對分布在不同 chip 的多個 block 的操作也稱為 clustered block [[2]](#ref). 跟 HDD raid 的 striping 概念有點像 [[1, 5]](#ref).

批次對 LBA 的存取會被視為 clustered 操作，並同時對不同的 flash package 做存取。多虧了 FTL 的 mapping 演算法/資料結構，即便我們不是做循序的讀寫，一樣可以發揮 FTL 平行運算的超能力。分散 block 到各個 channel 去讓我們的讀寫抹都可以平行處理。意味著當我們 IO 的大小是 clustered block 的倍數，並有把 LBA 對齊，將可充分利用 SSD 內部各層級的平行運作機制。下一篇的 8.2 8.3 有更多介紹


# ref
0. [coding for ssd part 4](http://codecapsule.com/2014/02/12/coding-for-ssds-part-4-advanced-functionalities-and-internal-parallelism/)

其他有編號參考資料請至原文觀賞：[link](http://codecapsule.com/2014/02/12/coding-for-ssds-part-3-pages-blocks-and-the-flash-translation-layer/#ref)