---
title:  subset_sum
date:   2019-3-18
tags: 
  - Algorithm
  - Dynamic Planing
  - DP
  - leetcode
  - back tracking
  - 回溯
---

# 问题描述

子集和问题（Subset sum problem），又称子集合加总问题，是计算复杂度理论和密码学中一个很重要的问题。
问题可以描述为：
>给一个整数集合，问是否存在某个非空子集，使得子集内中的数字和为0。
>例：给定集合{−7, −3, −2, 5, 8}，答案是YES，因为子集{−3, −2, 5}的数字和是0。

这个问题是NP完全问题，且或许是最容易描述的NP完全问题。

等价的问题
>给一个整数集合L和另一个整数target，问是否存在某个非空子集，使得子集中的数字和为s。
>*子集合加总问题可以想成是**背包问题**的一个特例*。

#求解思路

## 暴力搜索

>求解集合A 所有的排列组合，一共有2的n次方种可能，然后逐一对组合求和判断是否等于target。
>这种思路属于暴力求解法，当集合元素非常多的时候，计算时间会指数级增长，该算法的时间复杂度为O(2^n)。

## 回溯法
可以使用一个bit vector 表示得到的solution，如果某个元素被选中了，那么在bit vector 对应的索引下记为1，否则，没有选中记为0.接下来可以创建一个二叉树，其中level i 代表权重wi。 每一个节点引出两个branch，一个branch标记为0，一个标记为1. 标记为0的意思是这个branch引出的孩子节点对应的weight不再答案选中，标记为1表示引出的child选中。所以向量（1，0，1）表示从节点开始，选中left branch，然后右边branch，然后再左边的branch。要找到所有可能的答案，就得遍历这棵树，然后只要和为M，就打印出从根节点到这条路径所有的节点即可。

```python
def subsetSum(nums:List[int], path:List[int])-> int:
    res = 0
    for item,w in zip(nums, path):
        if w == -1:
            return res
        res += w*item
    return res

def subset(nums:List[int], target:int)->List[int]:
    nums = sorted(nums)
    path = [-1] * len(nums)
    idx = 0
    while idx < len(nums):
        tmp_sum = subsetSum(nums, path)
        if  tmp_sum == target:
            return path
        elif tmp_sum + nums[idx] <= targetSum:
            path[idx] = 1
        if idx < len(nums)-1 and  tmp_sum + nums[idx+1] <= targetSum:
            path[idx] = 0
    return None
```

## 递归

假设给定数组是有序的，必然有$sum(L[i,j]) == target, L[j] \leq target$
递推公式：


## 动态规划


#ref
1. [更快的subset sum的伪多项式时间算法](https://zhuanlan.zhihu.com/p/20106964)