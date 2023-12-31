---
title: 122.Best Time to Buy and Sell Stock II
date:   2018-09-06
mathjax: true 
category: 
  - 技术
tags: 
   - leetcode
---


> 与[121](./Best_Time_to_Buy_and_Sell_Stock)不同的在于，121只能操作一次，而这个是可以操作任意次。
>
> ```
> Input: [7,1,5,3,6,4]
> Output: 7
> Explanation: Buy on day 2 (price = 1) and sell on day 3 (price = 5), profit = 5-1 = 4.Then buy on day 4 (price = 3) and sell on day 5 (price = 6), profit = 6-3 = 3.
> ```

----

**brute force**

> 暴力搜索，没什么好说的
>
> 当前位置 $i$ ，搜索其后所有的可能答案，取最大的

```python
def brute_force(arr, start):
  if start >= len(arr):
    return 0
  max_profit = 0
  for i in range(start, len(arr)):
    tmp_max_profit = 0
    for j in range(start+1, len(arr)):
      if arr[j] > arr[i]:
        profit = brute_force(arr, j+1) + arr[j] - arr[i]
        if profit > tmp_max_profit:
          tmp_max_profit = profit
    if tmp_max_profit>max_profit:
      max_profit = tmp_max_profit
  return max_profit
```

时间复杂度$O(n^n)$ ， 空间复杂度$O(n)$

-----

 **Peak Valley Approach**

> 给定的`price`数组为$[7, 1, 5, 3, 6, 4]$. 绘制图片有（来自[leetcode](https://leetcode.com/media/original_images/122_maxprofit_1.PNG)）
>
> ![](https://leetcode.com/media/original_images/122_maxprofit_1.PNG)
>
> 显然有，最终的收益来自于所有的峰值减去谷值之和
>
> $Total\_Profit = \sum_i(height(peak_i)-height(valley_i))$

```python
def Peak_Valley(prices):
  valley = prices[0]
  peak  = prices[0]
  idx = 0
  max_profit = 0
  while idx < len(prices)-1:
    while idx < len(prices)-1 and prices[idx+1] <= prices[idx]:
      idx+=1
    vally = prices[idx]
    while idx < len(prices)-1 and prices[idx+1] > prices[idx]:
      idx+=1
    peak = prices[idx]
    max_profit += peak-vally
  return max_profit
```

时间复杂度$O(n)$, 空间复杂度$O(1)$

---

**Simple One Pass**

> 跟上面略微不同的是，只要斜率是正的，就一直买入卖出就可以获得最大利润
>
> ![Profit Graph](https://leetcode.com/media/original_images/122_maxprofit_2.PNG)

```python
def One_Pass(prices):
  max_profit = 0
  for idx, price in enumerate(prices):
    if idx > 0 and price > prices[idx-1]:
      max_profit += price-prices[idx-1]
  return max_profit
        
```

时间复杂度$O(n)$, 空间复杂度$O(1)$