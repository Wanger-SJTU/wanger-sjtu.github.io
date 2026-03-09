---
title: SSD笔记-第二篇SSD结构与性能评估概述
tags:
  - ssd
category:
  - 转载
date: 2024-09-22 21:18:46
---
本文转载自：https://www.owlfox.org/blog/2019-11-25-coding-for-SSD-part-2/
# 緣由


這篇主要談論 Nand flash 的不同 cell type，基本的 SSD 系統架構，及如何做 SSD 效能評定（Benchmarking）。作者是在 booking.com 上班的軟體工程師。有用過應該就知道這是很大的旅遊訂房行程規劃服務網站，在這類工作環境可能需要對底層的效能有深入解快，才能解決工作上的實務問題。我覺得這類軟體從業人員提供的觀點對自己來說幫助很大，所以翻譯/兼做做筆記。

# SSD ？
Solid state drives，顧名思義 SSD 設計裡去除了傳統硬碟裡不 solid，會動的部分，改善了噪音、震動、讀寫速度慢、易損壞及資料分散時需要硬碟重組來改善讀取時間等缺點。
SSD 作為儲存裝置：
* 優點：
  * 隨機存取快、且存取時間固定，HDD 的 seek time ？ 沒這毛病！
  * 體積小，看看這些愈來愈小的筆記型電腦、移動裝置、SD卡
  * 少了傳統硬碟機械故障、硬碟重組等煩惱。
* 缺點：
  * Cell 有讀寫次數限制(wearing off/wear-out)
  > 但對於 IT 人員來說， HDD 也是有看人品、需買高階型號跟擺乖乖才能保證資料安全的問題。 ![乖乖 LOGO, kuai.com.tw](https://comet.noonspace.com/w61NoonSpace/kuai/MsgInfo/LogoKuai.png)
  * bit/$ 較高, (TODO)

## NAND flash 種類
依各個 block 可儲存的資料多寡，可分為：
SLC, MLC, eMLC, TLC, QLC, 3D NAND, see this [link](https://searchstorage.techtarget.com/definition/flash-memory) for ref

關於製程資訊（floating gate, charge trap) 見 [3
](#快閃記憶體的路線之爭)

> 關於 IC / PCB / SMT 的製程可能要補文章（TODO）


## 存取介面
目前看到的 SSD 架構 =  SSD controller 晶片 + RAM + NAND flash
controll 支援多種不同的 host interface 指令格式
* Serial ATA (SATA), 3.0 ~ 6GBit/s
* PCI Express (PCIe), 3.0 ~ 8Gbit/s per lane, 4 lanes max
* [nvme](https://nvmexpress.org/)
* Serial Attached SCSI interface (SAS), ~ 12 Gbit/s

> 也有看到 open channel SSD 將主控權交給作業系統，詳情可見 [2](#lightnvm, linux implementation of open channel SSD)。我覺得有點像是 zfs 捨棄 raid 卡讓檔案系統透過 HBA 卡接管硬碟所有資訊的作法。我覺的軟體定義的方式應該是終端用戶最後的選擇，畢竟免了 vendor lock in 的問題。
 
controller 把 NAND flash 的 block, page size, GC(garbage collection) 等細節藏起來，讓 host interface 及其上層作業系統有跟 HDD 一樣的存取介面。


## 效能評定 Benchmarking
原文作者有發現當時的 SSD 效能報告[亂象](http://blog.zorinaq.com/many-ssd-benchmark-reviews-contain-flaws/)，例如不同的 [LBA](https://gerardnico.com/io/drive/lba), 過於簡單的 [queue size](https://www.userbenchmark.com/Faq/What-is-queue-depth/41) 測試情節。文中也提到 SSD 的讀寫測試其實要在寫入一定的隨機資料[pre-conditioning, warm up](https://searchstorage.techtarget.com/feature/The-truth-about-SSD-performance-benchmarks)才有測出 controller GC 能力並具參考價值。而非當時很多資料是拿了新的 SSD 測了 happy path 很開心就把資料放出來這樣，文中舉的比較好的範例是這篇關於 samsung 840 pro 做的[評測](https://www.storagereview.com/samsung_ssd_840_pro_review)，可以很明顯看到讀寫效能(IOPS, Read/Write at different sizes/order)在一定的讀寫後明顯下降，文中也對其拿實際的應用案例如資料庫、網頁伺服器做了分析，並得到其在前述企業應用環境效能較差的結論。

> `圖一堆，真是很有心 XD`

目前不確定儲存裝置是否有個明確的效能評定規範（針對不同應用情境、不同裝置、不同 host interface）。但作者提出一套他的原則（2.3內容）：
* workload type ，確定你的應用環境是哪種讀寫操作居多
* percentage of read / write, 設定同步進行的讀寫操作比例，如 30% 讀 70% 寫
* queue length，你有多少同步執行的執行緒(thread)在對儲存裝置下指令
* size of data chunk, 你的應用環境的檔案讀寫大小（4KB, 8KB 之類的)

> 最後一點不太確定怎麼定義，如果你是跑 postgresql, mysql 那要怎麼知道大小？

以及需要觀測的指標：
* Throughput: KB/s, MB/s 資料轉換的效率，一般是 sequential 的評定會看
* IOPS: 每秒可完成的 Input/Output（IO） 操作，這是以作業系統的觀點來看，通常是拿 4KB 的寫入來測，用來評定隨機操作的效能。
> 應該是因為 4KB 是大部分作業系統 virtual memory 預設的 page size, 這也要因應使用情節而調整。
* latency:  下指令到完成指令回傳結果需要的時間 μs, ms 

IOPS 也可以換算成 throughput, 如 1000 IOPS 在 4KB 檔案大小下 就是 4 MB/s. 作者也舉了個可能的 logging 系統案例， 10k IOPS, log 檔四散各地，可能的 throughput 會是 20 MB/s 

另外 throughput 不等同於效能，假設你有個伺服器裝了個 10G 網卡，偏偏你的系統每次作業要跟 25 個 Database 拿資料，每個連線要花 20 ms 好死不死你還寫成 single blocked thread，每次處理一個網頁頁面至少都要多花 500 ms，這個就偏人的問題，而非系統效能瓶頸。

> 所以我想一般都是在系統發展到一定規模，要做大、或是遇上應用程式端無法解決瓶頸時才會多考慮底層儲存系統選擇與設定。

在確保自己的系統架構不會對儲存系統造成不必要的負擔之後，這三項指標（一起）是系統管理員、軟體工程師在評估自己的硬體是否符合需求時的常用指標。



# 參考資料
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

## 快閃記憶體的路線之爭
https://www.digitimes.com.tw/col/article.asp?id=717