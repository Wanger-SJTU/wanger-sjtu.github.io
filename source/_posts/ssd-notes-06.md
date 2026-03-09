---
title: SSD筆記 - 第六篇 結論
tags:
  - ssd
category:
  - 转载
date: 2024-09-22 21:30:31
---

# 前情提要

第六篇，這篇就是把五篇的重點做個摘錄。

## 基礎
1. SSD（solid state drive) 是基於 flash NAND memory 製作的儲存裝置。資料（Bits)儲存在不同種類的 cell 裡，當時有 SLC, MLC, TLC，分別代表一個 cell 裡面可存 1, 2, 3 個 bit(s)，並有不同的讀寫時間、壽命等特性。
2. 每個 Cell 有 P/E (Program/Erase) cycles 次數限制，超過了該 Cell 就不能用了。意味著 SSD 裝置會隨著使用過程損耗、有“可預期”的使用年限。
3. 效能評定 (Benchmarking) 很難做。原廠及第三方的報告都要多看多比較，別輕易相信他們的數字。可以的話自己買了做一次效能測試。並確定你了解效能指標的意義，且該數據有達到你的需求。

## Pages and blocks
1. 鄰近的cell會再組成可被讀寫的最小單位 page, nand-flash 的 page/分頁 大小 2, 4, 8, 16 KB 不等。 鄰近的 page 則會組成 block，通常是 128, 256 個 page 為一 block，因而 block 大小有 256 KB 到 4MB 不等。如 Sxxsung SSD 840 block = 2048 KB, 由 256 個 8 KB page 組成。


2. 即便你只在作業系統讀了一個 byte，SSD 的低消還是要讀一個 page。
3. 寫入/write 一個 page 也稱為 program，上面提到的為寫一點資料要寫一堆的現象也稱為 write amplification / 寫入放大。
4. page 不能直接被複寫。nand-flash 只有在進入 “free” state 才能被寫。在我們寫入一筆資料的時候我們需要先讀出現有內容到暫存器/register，然後再寫到其他的 free 的 page 裡，原先的 page 會被進入 "stale" state，並等待被清理，這種操作模式稱為 "copy-modify-write"
> zfs 以及一些作業系統也有類似的術語 [copy-on-write](https://en.wikipedia.org/wiki/Copy-on-write)，沒什麼相關就是了。
5. erase 必須以 block 為單位 (Erases are aligned on block size):
page stale 之後必須要清除/erase 才能回到 free 狀態

## SSD 控制器與其原理

1. FTL Flash Translation layer
FTL 是 SSD controller 工作之一，負責把 host interface 的 Logical Block Addresses (LBA) 轉 Physical Block Addresses (PBA)。最近很多 controller 實作 hybrid log-block mapping，讓隨機寫入的行為像是 log-structured file systems ，寫入行為像是 循序寫入 (sequential write)。

2. internel parallelism
controller 內有同時寫入許多 block 到不同的 nand-flash 晶片的機制，此寫入機制/單位 clustered block。

3. Wear leveling
FTL 的一個功能是讓各個 block 的 P/E cycle 接近，大家約在同個時間壞掉。

4. GC / Garbage collection 處理垃圾
controller 的 GC 流程會把 stale page 清除，回到 free state, 以備下次資料寫入。

5. background/ 背景作業的 GC 會影響前台 (foreground) 的寫入效能

## 建議的 SSD 操作姿勢
1. 避免多次寫入小於 page size 的資料。避免 read-modify-write, write amplification. page size 愈大愈好

2. align write, 盡量寫入以 page size 為單位的資料
3. 為提升 throughput 盡量把小的寫入 cache 到記憶體，在適當實際一次批次寫入。
> 這個應該是設計資料庫或是有極端效能考量的系統時的需求
4. 讀取效率跟寫入行為有關，當我們批次寫入資料時 SSD controller 會把資料平行寫入、四散在各個 nand flash chip 之間。寫入資料時將日後可能會一起讀取的資料排在一起寫會有助於讀取效能
> 感覺有點難，所以規劃架構的時候用 VM 來區分各個應用程式，如資料庫、web server 分離可以較有效運用到這點。 你說 docker, k8s container? 可能也有吧... 我不太確定(TODO)
5. 讀寫分離
當我們在 SSD 上進行大量小的讀寫穿插 (interleaved) 的操作時會讓 controller 內有的 cache, readahead 機制失效，效能低落。例如如果你有 1000 個 檔案需要讀寫，一個個讀寫跟一次讀 1000 個完了以後再寫，後者效能較好。 
> zfs 也有 zil, l2arc 讀寫 cache 分離的機制。  "the L2ARC for random reads, and the ZIL for writes." [2](#zfs cache-l2arc)
6. 當你要刪資料的時候最好是批次、一次性刪，好讓 controller GC 有更多空間可以操作，降低 SSD 內部資料碎片化 fragmentation。

7. 隨機寫入不一定比循序寫入慢
寫入的檔案小的時候會慢，但檔案跟 clustered block 同大時可以利用到 ssd 內部的平行機制，效能跟 sequential weite 差不多好

8. 單執行緒、一次讀很多資料的操作比同時跑很多 thread 的讀取操作更能利用到 readahead 的機制。因為有可能 LBA 剛好都在同個 flash chip，還是要排隊才能拿到資料。很多時候反而單執行緒讀取可以更好的運用到 readahead buffer
 
9. 寫入情況同上面一條，single threaded large write is better

10. 如果大量小的資料沒辦法批次或是快取寫入的操作，那還是用多執行緒來寫

11. 冷熱分離
常改的資料（熱的）放在一起，因為 read-modify-write 特性的關係，冷資料會跟熱的混在一塊，wear leveling 也會一起做，盡可能分開兩類資料能讓 GC 更好做事。

12. 熱資料、常改的 metadata 最好有做緩存(buffered) cache 在記憶體裡，並避免寫到 SSD 裡。

## 系統最佳化
1. PCI Express, 企業級的 SAS 比 SATA 效能好，host interface 先天限制。
> 可是最近 HPE SAS [爆了一次](ttps://blocksandfiles.com/2019/11/25/hpe-issues-firmware-fix-to-to-stop-ssd-failure/)

2. Over-provisioning 分割硬碟的時候別把空間全用完，例如留 10~15% 給 GC 運作空間可以提升使用壽命，controller 還是會把那個空間拿來做 wear leveling 等事。如果有更大量寫入需求可以考慮拉大到 25 %

3. 開啟 trim 指令，作業系統核心、檔案系統可以通知 SSD controller 某個 block 沒在用，讓 controller 進行 GC 作業。

4. align the partition
確定硬碟格式化時確定分割區與 實體 page 的位置有對齊很重要 [ref](https://tytso.livejournal.com/2009/02/20/)


# 結論
想了解更多的話，作者建議可以再去看 2-5 的參考資料。另外 FAST conference（USENIX conference on file and storage) 也可以看看，了解時事動態。

# 參考資料
#### coding for ssd part6
http://codecapsule.com/2014/02/12/coding-for-ssds-part-6-a-summary-what-every-programmer-should-know-about-solid-state-drives/

#### zfs cache-l2arc
http://www.brendangregg.com/blog/2008-07-22/zfs-l2arc.html