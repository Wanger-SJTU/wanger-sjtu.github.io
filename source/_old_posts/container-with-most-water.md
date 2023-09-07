---
title:  container with most water
date:   2019-4-2
tags: 
  - leetcode

---

>给定一组非负整数，$[a_1,a_2,...,a_n]$, 其中$[i,a_i]$代表了一个坐标。位置$i$处，有高为$a_i$的柱子。 两根柱子连同x轴，构成了一个水池，求可以盛最大体积水的容器坐标。
 **注**:柱子不可倾斜，n至少为2

![image](https://s3-lc-upload.s3.amazonaws.com/uploads/2018/07/17/question_11.jpg)


>TODO 解释


```python
class Solution:
    def maxArea(self, height: List[int]) -> int:
        start,end, area = 0,len(height)-1,0
        while start < end:
            new_area = max(area, min(height[start], height[end])*(end-start))
            if new_area > area:
                area = new_area
            if height[start]>height[end]:
                end -= 1
            else:
                start += 1
        return area
        
```