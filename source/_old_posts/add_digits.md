---
title:   add digits
date:    2019-4-13
tags: 
  - leetcode
---
Add Digits
Given a non-negative integer num, repeatedly add all its digits until the result has only one digit.

Example:

>Input: 38
Output: 2 

Explanation: The process is like: 3 + 8 = 11, 1 + 1 = 2.  Since 2 has only one digit, return it.

**Follow up**:
Could you do it without any loop/recursion in O(1) runtime?

##迭代方法
```python
class Solution:
    def addDigits(self, num: int) -> int:
        num = str(num)
        while len(num)>1:
            num = sum(int(i) for i in num)
            num = str(num)
        return int(num)
```

## `O(1)`

这个问题在数学成为“树根问题”（Digital root or repeated digital sum）
>数根可以计算模运算的[同余](https://zh.wikipedia.org/wiki/%E5%90%8C%E9%A4%98)，对于非常大的数字的情况下可以节省很多时间。

>当两个整数除以同一个正整数，若得相同余数，则二整数同余。

**同余公式**
$$ 
\operatorname{dr}(n)=\left\{\begin{array}{ll}{0} & {\text { if } n=0} \\ {9} & {\text { if } n \neq 0, n \equiv 0(\bmod 9)} \\ {n \bmod 9} & {\text { if } n \neq 0(\bmod 9)}\end{array}\right.
 $$
更简单表示为：
$$ 
\operatorname{dr}(n)=1+((n-1) \bmod 9)
$$

这里对9取模的原因在于，是10进制的情况。
因为 $10 \equiv 1 \quad(\bmod 9)$， 所以有：$10^{k} \equiv 1^{k} \equiv 1 \quad(\bmod 9)$

$$ 
\operatorname{dr}(a b c) \equiv a \cdot 10^{2}+b \cdot 10+c \cdot 1 \equiv a \cdot 1+b \cdot 1+c \cdot 1 \equiv a+b+c \quad(\bmod 9)
$$

```python
class Solution:
    def addDigits(self, num: int) -> int:
        return 1 + (num - 1) % 9 if num !=0 else 0
```