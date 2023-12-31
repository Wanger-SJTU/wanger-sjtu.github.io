---
title: 516.最长回文子序列
date:   2018-09-15
mathjax: true 
category: 
  - 技术
tags: 
   - leetcode
---

**题目**

> 给定字符串s，求其最长回文子序列（可以非连续）的长度

----

**DP**

>当已知一个序列是回文时，添加首尾元素后的序列存在两种情况，一种是首尾元素相等，则最长回文的长度加2，当首尾元素不相等，则最长回文序列为仅添加首元素时的最长回文与仅添加尾元素时的最长回文之间的最大值。我们可以用$dp[i][j]$表示$s[i…j]$中的最长回文序列，而状态转移方程则是 
>1. $i > j，dp[i][j] = 0；$ 
>2. $i == j，dp[i][j] = 1；$ 
>3. $i < j且s[i] == s[j]，dp[i][j] = dp[i + 1][j - 1] + 2； $
>4. $i < j且s[i]！= s[j]，dp[i][j] = max(dp[i + 1][j]，dp[i][j - 1])；$
>
>从状态转移方程可以看出，计算$dp[i][j]$时需要用到$dp[i+1][j - 1]$和$dp[i + 1][j]$，所以对于$i$的遍历应该从尾部开始，最后返回$dp[0][s.length() - 1]$就行。

```python
class Solution:
	def longestPalindromeSubseq(self, s):
		memo = [[None for i in range(len(s))] for j in range(len(s))]
		return self.__shrink_recursion(s, 0, len(s)-1, memo)

	def __shrink_recursion(self, s, left, right,  memo):
		if (memo[left][right] is not None):
			return memo[left][right]
		if (left > right):
			memo[left][right] = 0
			return 0
		if (left == right):
			memo[left][right] = 1
			return 1

		if (s[left] == s[right]):
			memo[left][right] = self.__shrink(s, left+1, right-1, memo) + 2
		else:
			memo[left][right] = max(self.__shrink_recursion(s, left+1, right, memo),\
                                    self.__shrink_recursion(s, left, right-1, memo))
		# print(memo)
		return memo[left][right]
   
	def DP_iter(self, s):
		lens = len(s)
		i = j = lens // 2
		memo = [[0 for i in range(len(s))] for j in range(len(s))]
		
		for i in range(lens-1, -1, -1):
			memo[i][i] = 1
			for j in range(i+1, lens):
				if s[i] == s[j]:
					memo[i][j] = memo[i+1][j-1]+2
				else:
					memo[i][j] = max(memo[i][j-1], memo[i+1][j])
		return memo[0][-1]
   
```

时间复杂度是$O(n^2)$，空间复杂度是$O(n^2)$。

---

**改进**

>上述的算法，从状态转移方程来看，计算$dp[i][x]$时，只用到了$dp[i][y]$和$dp[i + 1][z]$，即计算当前行时，只用到了当前行和下一行，因此可以对上一个算法进行改进，需要用两行空间存储就能完成计算。
>
>用一个变量cur表示当前行的下标，cur的取值为0或1，1 - cur表示的就是另外一行，因此状态转移方程变成了： 
>
>1. $i > j，dp[cur][j] = 0； $
>2. $i == j，dp[cur][j] = 1； $
>3. $i < j且s[i] == s[j]，dp[cur][j] = dp[1 - cur][j - 1] + 2；$
>4. $i < j且s[i]！= s[j]，dp[cur][j] = max(dp[1 - cur][j]，dp[cur][j - 1])； $
>
>注意每次计算完一个$i$后需要更新$cur$的值，即$cur = 1 - cur$。因为循环执行最后一次之后会多更新一次cur，所以返回的是$dp[1 - cur][s.length() - 1]$的值。

```c++
class Solution {
public:
    int longestPalindromeSubseq(string s) {
        int n = s.length(), cur = 0;
        vector<vector<int>> dp(2, vector<int>(n, 0));

        for (int i = n - 1; i >= 0; i--) {
            dp[cur][i] = 1;
            for (int j = i + 1; j < n; j++) {
                if (s[i] == s[j]) {
                    dp[cur][j] = dp[1 - cur][j - 1] + 2;
                } else {
                    dp[cur][j] = max(dp[1 - cur][j], dp[cur][j - 1]);
                }
            }
            cur = 1 - cur;
        }

        return dp[1 - cur][n - 1];
    }
};
```



