---
title: python多线程
date:   2018-09-01
catalog: true
tags: 
   - python
---
[介绍](http://python.jobbole.com/87498/?repeat=w3tc)

[more ](http://python.jobbole.com/86917/)

**single threading**

```python
import time

def calc_square(numbers):
    print("caculating square numbers")
    for n in numbers:
        time.sleep(0.2)
        print('square:', n**2)
    
 def calc_cube(numbers):
    print("caculating cube of numbers")
    for n in numbers:
        time.sleep(0.2)
        print('cube:', n**3)
        
arr = [2,3,4,5]
calc_sqare(arr)
calc_cube(arr)
```

**multi-threading**

```python
import time
import threading

def calc_square(numbers):
    print("calculating square numbers")
    for n in numbers:
        time.sleep(0.2)
        print('square:', n**2)
    
def calc_cube(numbers):
    print("calculating cube of numbers")
    for n in numbers:
        time.sleep(0.2)
        print('cube:', n**3)
        
arr = [2,3,4,5]

t1 = theading.Thread(target= calc_square, args=(arr,))
t2 = theading.Thread(target= calc_cube, args=(arr,))
t1.start()
t2.start()

t1.join()
t2.join()

calc_sqare(arr)
calc_cube(arr)
```

output

> calculating square numbers
> calculating cube of numbers
> square: 4
> cube: 8
> cube: 27
> square: 9
> cube: 64
> square: 16
> cube: 125
> square: 25

>**no join()**
>
>calculating square numbers
>calculating cube of numbers
>square: 4
>cube: 8
>square: 9
>cube: 27
>square: 16
>cube: 64
>square: 25
>cube: 125

