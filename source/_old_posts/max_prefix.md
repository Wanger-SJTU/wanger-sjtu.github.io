---
title:  Longest Common Prefix
date:   2019-4-2
tags: 
  - leetcode 
---

编写一个函数来查找字符串数组中的最长公共前缀。

如果不存在公共前缀，返回空字符串 ""。

示例 1:

>输入: ["flower","flow","flight"]
输出: "fl"
示例 2:

>输入: ["dog","racecar","car"]
输出: ""
解释: 输入不存在公共前缀。

```python
class Solution:
    def longestCommonPrefix(self, strs: List[str]) -> str:
        if not strs:
            return ""
        res = ""
        for chars in zip(*strs):
            if len(set(chars)) ==1:
                res += chars[0]
            else:
                break
        return res
```