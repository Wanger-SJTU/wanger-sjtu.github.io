---
title:  kmp算法中的Next数组[转载]
date:   2019-4-4
tags: 
  - algorithm
---

kmp算法重要的的就是Next数组的计算。在kmp算法中，失配时，向右移动的距离为:
>失配字符所在位置 - 失配字符对应的next 值
即：`j - next[j]`，且此值大于等于1

如下图所示：
![image](https://tuchuang-1259359185.cos.ap-chengdu.myqcloud.com/_asserts/kmp_Next/1.jpg)
在D失配时，$j=6， Next[j]=2， pos = 6-2=4$。
![image](https://tuchuang-1259359185.cos.ap-chengdu.myqcloud.com/_asserts/kmp_Next/2.jpg?raw=true)

## 求Next数组

1. 寻找前缀后缀最长公共元素长度
对于$P = [p_0,p_1,...,p_{j-1},p_j]$，寻找模式串$P$中长度最大且相等的前缀和后缀。如果存在$p_0,p_1,...,p_{k-1},p_k = p_{j-k} p_{j-k+1},...p_{j-1}, p_j$，那么在包含$p_j$的模式串中有最大长度为$k+1$的相同前缀后缀。举个例子，如果给定的模式串为“abab”，那么它的各个子串的前缀后缀的公共元素的最大长度如下表格所示：
>![image](https://tuchuang-1259359185.cos.ap-chengdu.myqcloud.com/_asserts/kmp_Next/3.jpg?raw=true)
比如对于字符串aba来说，它有长度为1的相同前缀后缀a；而对于字符串abab来说，它有长度为2的相同前缀后缀ab（相同前缀后缀的长度为k + 1，k + 1 = 2）。
2. 求next数组
next 数组考虑的是当前字符之前的字符串前后缀的相似度，所以通过第①步骤求得各个前缀后缀的公共元素的最大长度后，只要稍作变形即可：将第①步骤中求得的值整体右移一位，然后初值赋为-1，如下表格所示：
>![image](https://tuchuang-1259359185.cos.ap-chengdu.myqcloud.com/_asserts/kmp_Next/4.jpg?raw=true)
比如对于aba来说，第3个字符a之前的字符串ab中有长度为0的相同前缀后缀，所以第3个字符a对应的next值为0；而对于abab来说，第4个字符b之前的字符串aba中有长度为1的相同前缀后缀a，所以第4个字符b对应的next值为1（相同前缀后缀的长度为k，k = 1）。


### 寻找最长前缀后缀
如果给定的模式串是：“ABCDABD”，从左至右遍历整个模式串，其各个子串的前缀后缀分别如下表格所示：
![image](https://tuchuang-1259359185.cos.ap-chengdu.myqcloud.com/_asserts/kmp_Next/5.jpg?raw=true)
也就是说，原模式串子串对应的各个前缀后缀的公共元素的最大长度表为（下简称《最大长度表》）：
![image](https://tuchuang-1259359185.cos.ap-chengdu.myqcloud.com/_asserts/kmp_Next/6.jpg?raw=true)
```python
def partial_table(p):
    prefix = set()
    postfix = set()
    ret = [0]
    for i in range(1, len(p)):
        prefix.add(p[:i])
        postfix = {p[j:i + 1] for j in range(1, i + 1)}
        ret.append(len((prefix & postfix or {''}).pop()))
    return ret
```

### 基于《最大长度表》匹配
>失配时，模式串向右移动的位数为：已匹配字符数 - 失配字符的上一位字符所对应的最大长度值

**根据《最大长度表》求next 数组**
>next 数组相当于“最大长度值” 整体向右移动一位，然后初始值赋为-1

对于给定的模式串：ABCDABD，它的最大长度表及next 数组分别如下：
![image](https://tuchuang-1259359185.cos.ap-chengdu.myqcloud.com/_asserts/kmp_Next/7.jpg?raw=true)

根据最大长度表求出了next 数组后，从而有 

>失配时，模式串向右移动的位数为：失配字符所在位置 - 失配字符对应的next 值

### 通过代码递推计算next 数组（KMP算法的核心部分）

1. 如果对于值`k`，已有 $p_0,p_1, ..., p_{k-1} = p_{j-k}, p_{j-k+1}, ..., p_{j-1}$，相当于`next[j] = k`。
    - 究其本质，`next[j] = k` 代表`p[j]` 之前的模式串子串中，有长度为`k` 的相同前缀和后缀。有了这个`next` 数组，在KMP匹配中，当模式串中j 处的字符失配时，下一步用`next[j]`处的字符继续跟文本串匹配，相当于模式串向右移动`j - next[j]` 位。

2. 已知next [0, ..., j]，如何求出next [j + 1]呢？
对于`P`的前`j+1`个序列字符：

    - 若`p[k] == p[j]`，则`next[j+1] = next[j]+1 = k+1`；
    - 若`p[k] ≠ p[j]`，如果此时`p[next[k]] == p[j]`，则`next[j+1] = next[k]+1`，否则继续递归前缀索引`k = next[k]`，而后重复此过程。（重复找最大的重复前缀后缀）
   
拿前缀 p0 pk-1 pk 去跟后缀pj-k pj-1 pj匹配，如果pk 跟pj失配，下一步就是用`p[next[k]]` 去跟pj 继续匹配，如果`p[next[k]]`跟pj还是不匹配，则需要寻找**长度更短**的相同前缀后缀，即下一步用`p[next[next[k]]]`去跟pj匹配。
此过程相当于模式串的自我匹配，所以不断的递归`k = next[k]`，直到要么找到长度更短的相同前缀后缀，要么没有长度更短的相同前缀后缀。如下图所示：
    
![image](https://tuchuang-1259359185.cos.ap-chengdu.myqcloud.com/_asserts/kmp_Next/8.jpg?raw=true)    
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
```

### Next 数组与有限状态自动机
next 负责把模式串向前移动，且当第j位不匹配的时候，用第`next[j]`位和主串匹配，就像打了张“表”。此外，next 也可以看作有限状态自动机的状态，在已经读了多少字符的情况下，失配后，前面读的若干个字符是有用的。

![image](https://tuchuang-1259359185.cos.ap-chengdu.myqcloud.com/_asserts/kmp_Next/9.jpg?raw=true)


### Next 数组的优化
 如果用之前的next 数组方法求模式串“abab”的next 数组，可得其next 数组为`-1 0 0 1`（`0 0 1 2`整体右移一位，初值赋为`-1`），当它跟下图中的文本串去匹配的时候，发现b跟c失配，于是模式串右移`j - next[j] = 3 - 1 =2`位。

![image](https://tuchuang-1259359185.cos.ap-chengdu.myqcloud.com/_asserts/kmp_Next/10.jpg?raw=true)


右移2位后，b又跟c失配。事实上，因为在上一步的匹配中，已经得知`p[3] = b`，与`s[3] = c`失配，而右移两位之后，让`p[next[3]] = p[1] = b` 再跟`s[3]`匹配时，必然失配。

![image](https://tuchuang-1259359185.cos.ap-chengdu.myqcloud.com/_asserts/kmp_Next/11.jpg?raw=true)
   

问题出在不该出现`p[j] = p[next[j]]`。
理由是：当`p[j] != s[i]` 时，下次匹配必然是`p[next[j]]` 跟`s[i]`匹配，如果`p[j] = p[next[j]]`，必然导致后一步匹配失败（因为`p[j]`已经跟`s[i]`失配，然后你还用跟`p[j]`等同的值`p[next[j]]`去跟`s[i]`匹配，很显然，必然失配），所以不能允许`p[j] = p[next[j]]`。
如果出现了`p[j] = p[next[j]]`咋办呢？
>如果出现了，则需要再次递归，即令`next[j] = next[next[j]]`。
总结即是：
如果a位字符与它的next值(即next[a])指向的b位字符相等（即p[a] == p[next[a]]）,则a位的next值就指向b位的next值即（next[next[a]]）。

```python
def getNextOptimize(s):
    Next = [-1]
    j, k = 0, -1
    while j < len(s):
        if k == -1 or s[j] == s[k]:
            j+=1
            k+=1
            if  s[j] == s[k]:
                Next.append(Next[k])
            else:
                Next.append(k)
        else:
            k = Next[k]
    return Next
```
### 复杂度
如果文本串的长度为n，模式串的长度为m，那么匹配过程的时间复杂度为O(n)，算上计算next的O(m)时间，KMP的整体时间复杂度为O(m + n)。

---
- [从头到尾彻底理解KMP](https://blog.csdn.net/v_july_v/article/details/7041827)