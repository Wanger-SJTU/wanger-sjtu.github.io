---
title:  最长公共子子序列
date:   2019-4-3
tags: 
  - dynamic programming
---

**题目：**
> 如果字符串一的所有字符按其在字符串中的顺序出现在另外一个字符串二中，则字符串一称之为字符串二的子串。
注意，并不要求子串（字符串一）的字符必须连续出现在字符串二中。

请编写一个函数，输入两个字符串，求它们的最长公共子序列
>例如：输入两个字符串BDCABA和ABCBDAB，字符串BCBA和BDAB都是是它们的最长公共子序列，则输出它们的长度4，并打印任意一个子序列。

![image](https://tuchuang-1259359185.cos.ap-chengdu.myqcloud.com/_asserts/lcs/1.jpg)

## LCS问题具有最优子结构 
令 $X=<x_1,x_2,...,x_m>$ 和 $Y=<y_1,y_2,...,y_n>$ 为两个序列，$Z=<z_1,z_2,z_3,...,z_k>$为$X$和$Y$的任意LCS。则:
- 如果$x_m=y_n$，则$z_k=x_m=y_n$且$Z_{k−1}$是$X_{m−1}$和$Y_{n−1}$的一个LCS。 
- 如果$x_m≠y_n$，$z_k≠x_m$，意味着$Z$是$X_{m−1}$和$Y$的一个LCS。 
- 如果$x_m≠y_n$，$z_k≠y_n$，意味着$Z$是$X$和$Y_{n−1}$的一个LCS。

从上述的结论可以看出，两个序列的LCS问题包含两个序列的前缀的LCS，因此，LCS问题具有最优子结构性质。
在设计递归算法时，不难看出递归算法具有子问题重叠的性质。
  
设 $C[i,j]$ 表示 $X_i$ 和 $Y_j$ 的最长公共子序列LCS的长度。如果 $i=0$ 或 $j=0$,即一个序列长度为$0$时，那么LCS的长度为$0$。根据LCS问题的最优子结构性质，可得如下公式：

$$
C[i,j]=   \begin{cases}
 0， &        当 i=0或j=0\\    
C[i-1,j-1]+1，&当i,j>0 且x_i=y_j \\
MAX(C[i,j-1],C[i-1,j])&当i,j>0且x_i≠y_j
  \end{cases}
$$

## DP method

```python
def LCS(s1, s2):
    l1 = len(s1)
    l2 = len(s2)
    dp = [[0]*(l1+1)]*(l2+1)
    for i in range(1,l1+1):
        for j in range(1, l2+1):
            if s1[i-1] == s[j-1]:
                dp[i][j] = dp[i-1][j-1]+1
            else:
                dp[i][j] = max(dp[i-1][j], dp[i][j-1]) 
    return dp[-1][-1]
```