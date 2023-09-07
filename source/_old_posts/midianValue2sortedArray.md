---
title:  MedianofTwoSortedArrays
date:   2017-4-25
tags: 
    - leetcode
    - binarySearch  
---
## 题目描述
> 在两个排序数组中，找到其中位数

### 思路一
可以考虑将两个数组归并排序，然后求得中位数。时间复杂度 $O(m+n)$ ，空间复杂度$O(m+n)$

```python
def merge(nums1, nums2):
    a,b = sorted((nums1,nums2), key=len)
    i,j,m,n = 0,0,len(a),len(b)
    newNums = []
    while i<m and j<n:
        if a[i] < b[j]:
            nums.append(a[i])
            i += 1
        else:
            nums.append(b[j])
            j += 1
    nums.append(a[i:])
    nums.append(b[j:])
    return nums

def getMidian(nums1, nums2):
    nums = merge(nums1, nums2)
    if len(nums)&1 == 1:
        return nums[len(nums)//2]
    else:
        return (nums[len(nums)//2]+nums[len(nums)//2-1])/2
```

### 思路二
二分查找。
>中位数是指数组两边以此分界，两边的元素个数相等。

即  
```
    left_part            |        right_part
A[0], A[1], ..., A[i-1]  |  A[i], A[i+1], ..., A[m-1]
B[0], B[1], ..., B[j-1]  |  B[j], B[j+1], ..., B[n-1]
```
所以如果能把两个数组分别分成两部分，并满足条件

- len(left\_part) = len(right\_part)
- max(left_part) ≤ min(right_part)

那么最终的中位数就是

$$
median= \frac{\max(left\_part)+\min(right\_part)}{2}
$$

所以需要保证：
- $i+j=m−i+n−j$ (or: $m - i + n - j + 1$)
    if $n≥m$, we just need to set: 
    $i=0∼m,j=(m+n+1)/2 −i$
- $B[j−1]≤A[i]$ and $A[i−1]≤B[j]$

```python
def findMedianSortedArrays(self, nums1: List[int],nums2: List[int]) -> float:
  a, b = sorted((nums1, nums2), key=len)
  # a 短数组 b 长数组
  m, n = len(a), len(b)
  after = (m + n - 1) // 2
  lo, hi = 0, m
  while lo < hi:
    i = (lo + hi) // 2
    # b[0:after-i] 长数组 left
    if after-i-1 < 0 or a[i] >= b[after-i-1]:
      hi = i
    else:
      lo = i + 1
  i = lo
  nextfew = sorted(a[i:i+2] + b[after-i:after-i+2])##??
  return (nextfew[0] + nextfew[1 - (m+n)%2]) / 2.0
```