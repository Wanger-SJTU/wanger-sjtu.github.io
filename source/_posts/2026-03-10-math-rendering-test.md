---
title: 数学公式渲染测试
date: 2026-03-10 06:38:00
tags: [测试, 数学, MathJax]
categories: [测试]
math: true
---

## 行内公式测试

这是一个行内公式：$E = mc^2$，爱因斯坦的质能方程。

另一个行内公式：$\alpha + \beta = \gamma$，希腊字母测试。

## 独立公式测试

这是一个独立公式：

$$
\int_0^\infty e^{-x^2} dx = \frac{\sqrt{\pi}}{2}
$$

这是另一个独立公式：

$$
\sum_{i=1}^n i = \frac{n(n+1)}{2}
$$

## 复杂公式测试

### 矩阵

$$
\begin{bmatrix}
a & b \\
c & d
\end{bmatrix}
$$

### 分数

$$
\frac{\partial f}{\partial x} = \lim_{h \to 0} \frac{f(x+h) - f(x)}{h}
$$

### 积分

$$
\oint_C \vec{F} \cdot d\vec{r} = \iint_S (\nabla \times \vec{F}) \cdot d\vec{S}
$$

### 求和

$$
\prod_{i=1}^n x_i = x_1 \cdot x_2 \cdots x_n
$$

### 极限

$$
\lim_{n \to \infty} \left(1 + \frac{1}{n}\right)^n = e
$$

## 代码块中的 $ 符号测试

以下代码块中的 `$` 符号不应该被渲染为公式：

```javascript
const price = $100;
const total = price * 2; // $200
console.log(`Price: $${price}`);
```

```python
price = 100  # $100
total = price * 2  # $200
print(f"Price: ${price}")
```

## 混合测试

在文本中混合行内公式 $\alpha$ 和普通文本，以及独立公式：

$$
f(x) = x^2 + 2x + 1
$$

然后继续文本，包含另一个行内公式 $\beta$。

## 希腊字母测试

- $\alpha, \beta, \gamma, \delta, \epsilon$
- $\Alpha, \Beta, \Gamma, \Delta, \Epsilon$

## 数学符号测试

- $\pm, \times, \div, \cdot$
- $\leq, \geq, \neq, \approx$
- $\infty, \partial, \nabla$

## 测试总结

如果以上所有公式都能正确渲染，说明 MathJax 功能工作正常！
