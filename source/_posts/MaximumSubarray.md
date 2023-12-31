---
title: 53.最大子序列和
date:   2018-09-07
mathjax: true  
category: 
  - 技术
tags: 
   - leetcode
---


>对于给定序列，得到最大和的子序列
>
>**Example:**
>
>```
>Input: [-2,1,-3,4,-1,2,1,-5,4],
>Output: 6
>Explanation: [4,-1,2,1] has the largest sum = 6.
>```

**brute force**

> 遍历所有的可能答案，得到最大子序列和。

```python
def brute_force(nums):
    max_sum = 0 
    for L in range(len(nums)):# 左边界
        for R in range(L,len(nums)):# 右边界
            cur_sum = 0
            for i in range(L,R):
                cur_sum+=nums[i]
            if cur_sum > max_sum:
                max_sum = cur_sum
    return max_sum
```

时间复杂度 $O(n^3)$

**改进版穷举**

> 上面的方法，可以改进，去掉最内层的循环。以左边界为起点，记录连续的求和，只取最大的即可。

```python
def brute_force(nums):
    max_sum = 0 
    for L in range(len(nums)):# 左边界
        cur_sum = 0
        for R in range(L,len(nums)):
            cur_sum+=nums[R]
            if cur_sum > max_sum:
                max_sum = cur_sum
    return max_sum
```

此时时间复杂度 $O(n^2)$

**分治**

> 这个问题可以递归求解，
>
> 在例子中，最大子序列的和只可能出现在3个地方：
>
> 1. 出现在输入数据的左半部分
> 2. 出现在输入数据的右半部分
> 3. 跨越输入数据的中部而位于左右两个部分
>
> 前两种情况可以递归求解，第三种情况的最大和可以通过求出前半部分（包含前半部分的最后一个元素）的最大和以及后半部分（包括后半部分的第一个元素）的最大和，再将二者相加得到。

```python
def Devided_Conquer(nums, left, right):
  if left == right:
    return nums[left] #if nums[left] > 0 else 0
  
  center = (left+right) // 2
  max_left  = Devided_Conquer(nums, left, center)
  max_right = Devided_Conquer(nums, center+1, right)
  
  left_Sum = 0
  maxLeft_Sum = nums[center]

  for i in range(center, left-1, -1):
    left_Sum += nums[i]
    if left_Sum > maxLeft_Sum:
      maxLeft_Sum = left_Sum
  
  right_sum = 0
  max_right_sum = nums[center+1] 

  for i in range(center+1, right+1):
    right_sum += nums[i]
    if right_sum > max_right_sum:
      max_right_sum = right_sum
  return max(max_left, max_right, maxLeft_Sum+max_right_sum)
```

时间复杂度 $O (N\log N)$

**One-Pass**

> 考虑

```python
def One_Pass(nums):
    max_sum = nums[0]
    this_sum = nums[0]
    for num in nums[1:]:
        this_sum = max(num, this_sum+num)
        if this_sum > max_sum:
            max_sum = this_sum
    return max_sum
```