---
title: 93. Restore IP Address 
date:   2018-07-28
category: 
  - 技术
tags: 
   - leetcode
---

Given a string containing only digits, restore it by returning all possible valid IP address combinations.

**Example:**

```
Input: "25525511135"
Output: ["255.255.11.135", "255.255.111.35"]
```

给定一个字符串，输出所有可能的IP地址

## 四分法

> 三个点将字符串分成四段，验证每一段是否是有效的。我们只要控制这三个分割点就行了，注意约束条件有两个，一个是一段字符串不超过3个字母，另一个是控制好每段字符串最远结束的位置，比如第一个字符串最多延伸到倒数第4个字母

```python
def restoreIpAddresses(s, res):
    res = []
    for i in range(0,4):
        for j in range(i,i+4):
            if j >= len(s):
                break
            for k in range(j, j+4):
                if k >= len(s):
                    break
                s1 = s[0:i]
                s2 = s[i:j]
                s3 = s[j:k]
                s4 = s[k:]
                if isValid(s1) and isValid(s2) and isVAlid(s3) and isValid(s4):
                    res.append(s1+'.'+s2+'.'+s3+'.'+s4)
     return res
```



## 递归求解

> 因为`ip`地址为4段，每段数值在`0-255`之间。从头开始，判断。只要满足每段在此范围内，即可进入下一段的操作。如果最后一段以后，长度为`0`。则此答案为正确答案。

```python
class Solution(object):
    def restoreIpAddresses(self, s):
        """
        :type s: str
        :rtype: List[str]
        """
        # split the string into 4 part
        res = []
        self.getip(s, 4, "", res)
        return res

    def getip(self, s, k, out, result):
        """
        s ： input str
        out : result str
        result : all possible result
        k      : k-th part
        """
        if k == 0:
            if len(s) == 0:
                result.append(out)
        else:
            # 0-3 每段最长3
            for i in range(4):
                # len(s) >= i 保证足够分的
                if len(s) >= i and self._isValid(s[0:i]):
                    # k==1 即最后一段了
                    if k == 1:
                        self.getip(s[i:], k-1, out+s[0:i], result)
                    else:
                        self.getip(s[i:], k-1, out+s[0:i]+'.', result)
        return result
    def _isValid(self, s):
        if len(s) == 0 or len(s) > 3 or (len(s)>1 and s[0] =='0'):
            return False
        return 0 <= int(s) <= 255
```



