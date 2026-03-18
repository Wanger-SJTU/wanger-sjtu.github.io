---
title: 数学公式渲染测试
date: 2026-03-10 06:38:00
tags: [测试, 数学, MathJax]
categories: [测试]
math: true
---

## 行内公式测试

这是一个行内公式：<script type="math/tex">E = mc^2</script>，爱因斯坦的质能方程。

另一个行内公式：<script type="math/tex">\alpha + \beta = \gamma</script>，希腊字母测试。

## 独立公式测试

这是一个独立公式：

<script type="math/tex; mode=display">
\int_0^\infty e^{-x^2} dx = \frac{\sqrt{\pi}}{2}
</script>

这是另一个独立公式：

<script type="math/tex; mode=display">
\sum_{i=1}^n i = \frac{n(n+1)}{2}
</script>

## 复杂公式测试

### 矩阵

<script type="math/tex; mode=display">
\begin{bmatrix}
a & b \\
c & d
\end{bmatrix}
</script>

### 分数

<script type="math/tex; mode=display">
\frac{\partial f}{\partial x} = \lim_{h \to 0} \frac{f(x+h) - f(x)}{h}
</script>

### 积分

<script type="math/tex; mode=display">
\oint_C \vec{F} \cdot d\vec{r} = \iint_S (\nabla \times \vec{F}) \cdot d\vec{S}
</script>

### 求和

<script type="math/tex; mode=display">
\prod_{i=1}^n x_i = x_1 \cdot x_2 \cdots x_n
</script>

### 极限

<script type="math/tex; mode=display">
\lim_{n \to \infty} \left(1 + \frac{1}{n}\right)^n = e
</script>

## 代码块中的 $ 符号测试

以下代码块中的 `$` 符号不应该被渲染为公式：

```javascript
const price = $100;
const total = price * 2; // $200
console.log(`Price: <script type="math/tex; mode=display">{price}`);
```

```python
price = 100  # $100
total = price * 2  # $200
print(f"Price: ${price}")
```

## 混合测试

在文本中混合行内公式 <script type="math/tex">\alpha</script> 和普通文本，以及独立公式：

</script>
f(x) = x^2 + 2x + 1
$$

然后继续文本，包含另一个行内公式 <script type="math/tex">\beta</script>。

## 希腊字母测试

- <script type="math/tex">\alpha, \beta, \gamma, \delta, \epsilon</script>
- <script type="math/tex">\Alpha, \Beta, \Gamma, \Delta, \Epsilon</script>

## 数学符号测试

- <script type="math/tex">\pm, \times, \div, \cdot</script>
- <script type="math/tex">\leq, \geq, \neq, \approx</script>
- <script type="math/tex">\infty, \partial, \nabla</script>

## 测试总结

如果以上所有公式都能正确渲染，说明 MathJax 功能工作正常！
