---
title: 一次有趣的 Bug 排查：桌面端深色模式切换失效
date: 2026-03-10 04:35:00
tags:
  - 前端
  - JavaScript
  - Bug 修复
  - Hexo
categories:
  - 技术笔记
---

## 问题描述

今天在测试博客网站时，发现一个有趣的现象：

- **桌面端**：点击导航栏的深色模式切换按钮（☀️/🌙），主题不切换 ❌
- **手机端**：点击汉堡菜单中的切换按钮，主题正常切换 ✅

同一个功能，为什么在不同端表现不一致？

## 诊断过程

### 第一步：检查 HTML 结构

首先检查按钮元素是否正确：

```html
<!-- 桌面端按钮 -->
<button class="header-action-btn theme-toggle" id="theme-toggle">
  <span class="icon-sun">☀️</span>
  <span class="icon-moon">🌙</span>
</button>

<!-- 移动端按钮 -->
<button class="mobile-action-btn theme-toggle-mobile" id="theme-toggle-mobile">
  <span class="icon-sun">☀️</span> 浅色
  <span class="icon-moon">🌙</span> 深色
</button>
```

✅ HTML 结构正确，两个按钮都有独立的 ID。

### 第二步：检查 CSS 样式

检查深色模式的 CSS 变量定义：

```css
:root {
  --color-bg: #ffffff;
  --color-text: #1a1a1a;
}

[data-theme="dark"] {
  --color-bg: #0a0a0a;
  --color-text: #e8e8e8;
}
```

✅ CSS 变量定义正确。

### 第三步：检查 JavaScript 事件

这是关键！我发现了问题所在：

**main.js 中有主题切换代码**：
```javascript
var themeToggle = document.getElementById('theme-toggle');
if (themeToggle) {
  themeToggle.addEventListener('click', function() {
    var currentTheme = document.documentElement.getAttribute('data-theme');
    var newTheme = currentTheme === 'dark' ? 'light' : 'dark';
    document.documentElement.setAttribute('data-theme', newTheme);
    localStorage.setItem('theme', newTheme);
  });
}
```

**navbar.js 中也有主题切换代码**：
```javascript
var themeToggle = document.getElementById('theme-toggle');
if (themeToggle) {
  themeToggle.addEventListener('click', function() {
    var currentTheme = document.documentElement.getAttribute('data-theme');
    var newTheme = currentTheme === 'dark' ? 'light' : 'dark';
    document.documentElement.setAttribute('data-theme', newTheme);
    localStorage.setItem('theme', newTheme);
  });
}
```

🔴 **两个文件都给同一个按钮添加了点击事件监听器！**

## 根本原因

**重复的事件监听器导致冲突！**

- 桌面端按钮（`#theme-toggle`）有两个监听器 → 冲突 → 失效 ❌
- 移动端按钮（`#theme-toggle-mobile`）只有一个监听器（在 navbar.js 中）→ 正常 ✅

这是因为：
1. 最初在 `main.js` 中实现了主题切换
2. 后来在重构导航栏时，又在 `navbar.js` 中实现了同样的功能
3. 忘记移除 `main.js` 中的旧代码
4. 结果同一个按钮绑定了两个相同的事件处理函数

## 修复方案

移除 `main.js` 中重复的代码，保留 `navbar.js` 统一处理：

**修改前**（main.js）：
```javascript
// ============================================
// Theme Toggle
// ============================================
var themeToggle = document.getElementById('theme-toggle');
if (themeToggle) {
  themeToggle.addEventListener('click', function() {
    // ... 主题切换逻辑
  });
}
```

**修改后**（main.js）：
```javascript
// ============================================
// Theme Toggle (handled by navbar.js)
// ============================================
// Theme toggle logic moved to navbar.js to avoid duplicate event listeners
```

## 修复验证

修复后测试：

- ✅ 桌面端点击深色模式按钮可以切换主题
- ✅ 切换后背景色、文字颜色正确变化
- ✅ 图标正确切换（☀️ ↔ 🌙）
- ✅ 刷新页面后主题保持
- ✅ 移动端仍然正常工作

## 根本原因分析

为什么会发生这个问题？

1. **职责不清**：`main.js` 和 `navbar.js` 都涉及主题切换，但没有明确的职责划分
2. **缺乏代码审查**：重构时没有检查是否已有相同功能的代码
3. **文件加载顺序**：两个 JS 文件都会加载，但加载顺序可能导致事件冲突
4. **测试不完整**：只测试了移动端，没有充分测试桌面端

## 经验教训

### 1. 避免重复代码

同一功能应该只在一个地方实现。可以使用注释明确标注：

```javascript
// main.js
// Theme toggle is handled by navbar.js, do not add duplicate listeners here
```

### 2. 职责分离

明确每个文件的职责：
- `main.js`：通用功能（搜索模态框等）
- `navbar.js`：导航栏相关功能（主题切换、移动菜单等）

### 3. 完善测试流程

测试时应该覆盖：
- 桌面端不同浏览器
- 移动端不同设备
- 不同屏幕尺寸
- 所有交互功能

### 4. 代码审查

重构或添加新功能时，先搜索是否已有相同功能的代码：

```bash
grep -r "theme-toggle" themes/custom/source/js/
```

## 总结

这个 Bug 排查过程很有趣：

1. 从现象出发（桌面端不生效，手机端正常）
2. 逐步排除（HTML → CSS → JavaScript）
3. 找到根本原因（重复的事件监听器）
4. 修复并验证

**核心教训**：当某端正常而另一端异常时，优先检查是否有重复的事件监听器或不同的实现逻辑。

希望这篇文章对你有所帮助！如果你也遇到过类似的问题，欢迎分享你的经验。
