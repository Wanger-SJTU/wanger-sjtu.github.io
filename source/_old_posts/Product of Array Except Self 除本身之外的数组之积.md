---
title: Product of Array Except Self 除本身之外的数组之积
date:   2018-07-29
catalog: true
tags: 
   - leetcode
---

> Given an array of *n* integers where *n* > 1, `nums`, return an array `output` such that `output[i]` is equal to the product of all the elements of `nums` except `nums[i]`. 
>
> Solve it **without division** and in O(*n*).
>
> For example, given `[1,2,3,4]`, return `[24,12,8,6]`.
>
> **Follow up:**
> Could you solve it with constant space complexity? (Note: The output array **does not** count as extra space for the purpose of space complexity analysis.)

给定我们一个数组，让我们返回一个新数组，对于每一个位置上的数是其他位置上数的乘积，时间复杂度O(n)，并且不让我们用除法。

> 先遍历一遍数组求出所有数字之积，然后除以对应位置的上的数字。(除法)

解法：
$$
result_i = \Pi_{j=1}^{i-1}nums_j \times \Pi_{i+1}^{N}nums_j
$$


```python
class Solution:
    def productExceptSelf(self, nums: List[int]) -> List[int]:
        result = [1]*len(nums)
        for idx in range(1, len(nums)):
            result[idx] = result[idx-1]*nums[idx-1]
        right = 1
        for idx in range(len(nums)-1, -1, -1):
            result[idx] = result[idx]*right
            right = right * nums[idx]
        return result
        
```

优化:

```python
class Solution:
    def productExceptSelf(self, nums: List[int]) -> List[int]:
        result = [1]*len(nums)
        left = 1
        right = 1
        for idx in range(len(nums)):
            result[idx] = result[idx] *left
            result[len(nums)-idx-1] = result[len(nums)-idx-1]*right
            left = left*nums[idx]
            right = right*nums[len(nums)-idx-1]
       	return result
```

