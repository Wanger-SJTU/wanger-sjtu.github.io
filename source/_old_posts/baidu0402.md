---
title:  baidu 4月2号笔试
date:   2019-4-2
tags: 
  - algorithm
---

1. 

>描述
给定一个仅由小写字母组成的长度不超过1e6的字符串，将首字母移动到末尾并记录所得的字符串，不断重复操作，虽然记录了无限个字符串，但其中不同的字符串数目是有限的，问不同的字符串有多少个？

>输入：
abab
输出
2

```python
def getNext(s):
    Next = [-1]
    j, k = 0, -1
    while j < len(s):
        if k == -1 or s[j] == s[k]:
            j+=1
            k+=1
            Next.append(k)
        else:
            k = Next[k]
    return Next

def main():
    s = "ababc"
    Next = getNext(s)
    ans = len(s) - Next[len(s)]
    if (len(s) % ans == 0):
        print(ans)
    else:
        print(len(s))

if __name__ == "__main__":
    main()
```

2. 



```python


import sys
import pdb

def kmp_match(s, p):
    m = len(s);
    n = len(p)
    cur = 0  # 起始指针cur
    table = partial_table(p)
    while cur <= m - n:     #只去匹配前m-n个
        for i in range(n):
            if s[i + cur] != p[i]:
                cur += max(i - table[i - 1], 1)  # 有了部分匹配表,我们不只是单纯的1位1位往右移,可以一次移动多位
                break
        else:           #for 循环中，如果没有从任何一个 break 中退出，则会执行和 for 对应的 else
                        #只要从 break 中退出了，则 else 部分不执行。
            return cur
    return None


# 部分匹配表
def partial_table(p):
    prefix = set()
    postfix = set()
    ret = [0]
    for i in range(1, len(p)):
        prefix.add(p[:i])
        postfix = {p[j:i + 1] for j in range(1, i + 1)}
        ret.append(len((prefix & postfix or {''}).pop()))
    return ret


def kmp(src, pattern):
    count = 0
    while len(src) > len(pattern):
        res = kmp_match(src, pattern)
        if res is None:
            return count
        else:
            src = src[res+len(pattern)-1:]
            count += 1
    return count

def main():
    line1 = sys.stdin.readline().strip()
    pattern = sys.stdin.readline().strip()
    num = int(sys.stdin.readline().strip())
    for _ in range(num):
        line = sys.stdin.readline().strip().split(' ')
        l,r = list(map(int, line))
        print(kmp(src[l:r+1], pattern))



if __name__ == "__main__":
    main()
```