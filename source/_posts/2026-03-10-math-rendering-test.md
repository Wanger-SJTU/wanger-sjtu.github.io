---
title: 数学公式渲染测试
date: 2026-03-10 06:38:00
tags: [测试, 数学, MathJax]
categories: [测试]
math: true
---

## 行内公式测试

这是一个行内公式：<span>$E = mc^2$</span>，爱因斯坦的质能方程。

另一个行内公式：<span>$\alpha + \beta = \gamma$</span>，希腊字母测试。

## 独立公式测试

这是一个独立公式：

<div>$$
\int_0^\infty e^{-x^2} dx = \frac{\sqrt{\pi}}{2}
$$</div>

这是另一个独立公式：

<div>$$
\sum_{i=1}^n i = \frac{n(n+1)}{2}
$$</div>

## 复杂公式测试

### 矩阵

<div>$$
\begin{bmatrix}
a & b \\
c & d
\end{bmatrix}
$$</div>

### 分数

<div>$$
\frac{\partial f}{\partial x} = \lim_{h \to 0} \frac{f(x+h) - f(x)}{h}
$$</div>

### 积分

<div>$$
\oint_C \vec{F} \cdot d\vec{r} = \iint_S (\nabla \times \vec{F}) \cdot d\vec{S}
$$</div>

### 求和

<div>$$
\prod_{i=1}^n x_i = x_1 \cdot x_2 \cdots x_n
$$</div>

### 极限

<div>$$
\lim_{n \to \infty} \left(1 + \frac{1}{n}\right)^n = e
$$</div>

## 代码块中的 <span>$ 符号测试

以下代码块中的 `$</span>` 符号不应该被渲染为公式：

```javascript
const price = <span>$100;
const total = price * 2; // $</span>200
console.log(`Price: $${price}`);
```

```python
price = 100  # <span>$100
total = price * 2  # $</span>200
print(f"Price: <span>${price}")
```

## 混合测试

在文本中混合行内公式 $</span>\alpha<span>$ 和普通文本，以及独立公式：

<div>$</span>$
f(x) = x^2 + 2x + 1
$$</div>

然后继续文本，包含另一个行内公式 <span>$\beta$</span>。

## 希腊字母测试

- <span>$\alpha, \beta, \gamma, \delta, \epsilon$</span>
- <span>$\Alpha, \Beta, \Gamma, \Delta, \Epsilon$</span>

## 数学符号测试

- <span>$\pm, \times, \div, \cdot$</span>
- <span>$\leq, \geq, \neq, \approx$</span>
- <span>$\infty, \partial, \nabla$</span>

## 测试总结

如果以上所有公式都能正确渲染，说明 MathJax 功能工作正常！
