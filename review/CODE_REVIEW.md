# Code Review Report - Hexo Custom Theme

**审查者**: Tom  
**审查日期**: 2026-03-08  
**工作目录**: `/root/hiclaw-fs/shared/tasks/hexo-init/workspace/themes/custom/`

---

## 📋 审查概要

| 类别 | 数量 |
|------|------|
| 🔴 必须修改 | 2 |
| 🟡 建议修改 | 3 |
| 🟢 可选优化 | 3 |
| ✅ 良好实践 | 6 |

**总体评价**: 代码质量良好，结构清晰，但存在 2 个安全性问题需要修复后才能部署。

---

## 🔴 必须修改

### 1. XSS 漏洞 - 搜索结果高亮 (高危)

**文件**: `layout/_partial/search-modal.ejs`  
**位置**: 第 65-67 行

```javascript
var highlightedTitle = item.title.replace(
  new RegExp('(' + query + ')', 'gi'),
  '<mark>$1</mark>'
);
// ...
searchResults.innerHTML = html;
```

**问题**: 用户输入的搜索关键词直接用于构建正则表达式，且搜索结果通过 `innerHTML` 插入 DOM。如果 `search.xml` 包含恶意内容，可能导致 XSS 攻击。

**修复方案**:
```javascript
// 转义 HTML 特殊字符
function escapeHtml(text) {
  var div = document.createElement('div');
  div.textContent = text;
  return div.innerHTML;
}

// 安全高亮
function safeHighlight(text, query) {
  var escaped = escapeHtml(text);
  return escaped.replace(
    new RegExp('(' + escapeHtml(query) + ')', 'gi'),
    '<mark>$1</mark>'
  );
}
```

---

### 2. URL 注入风险 (中危)

**文件**: `layout/resume.ejs`  
**位置**: 第 14、17 行

```ejs
<a href="<%= page.website %>" class="contact-item" target="_blank">
<a href="https://github.com/<%= page.github %>" class="contact-item" target="_blank">
```

**文件**: `layout/_partial/footer.ejs`  
**位置**: 第 12 行

```ejs
<a href="https://weibo.com/<%= theme.social.weibo %>" target="_blank" rel="noopener">
```

**问题**: 用户提供的 URL 未经验证直接插入 `href` 属性，可能被利用注入 `javascript:` 协议链接。

**修复方案**:
```ejs
<% 
function safeUrl(url, base) {
  if (!url) return '#';
  var fullUrl = base ? base + url : url;
  if (/^(https?:|mailto:|\/)/.test(fullUrl)) {
    return fullUrl;
  }
  return '#';
}
%>
<a href="<%= safeUrl(page.website) %>" class="contact-item" target="_blank" rel="noopener">
```

---

## 🟡 建议修改

### 3. 布局模板重复

**文件**: `layout/layout.ejs` 与 `layout/_partial/header.ejs` + `footer.ejs`

**问题**: 这两组文件存在大量重复代码：
- 完整的 HTML 骨架在 `layout.ejs` 中
- `header.ejs` 和 `footer.ejs` 也包含完整的 `<html>`, `<head>`, `<body>` 标签

**建议**: 采用以下结构之一：
- 方案 A: 保留 `layout.ejs` 作为主布局，`header.ejs` 只包含 `<header>` 部分
- 方案 B: 移除 `layout.ejs`，使用 `header.ejs` + `body` + `footer.ejs` 组合

---

### 4. CSS 文件扩展名不一致

**文件**: `source/css/style.styl`

**问题**: 文件内容为纯 CSS 语法，但扩展名为 `.styl`（Stylus 预处理器）。虽然 Hexo 可以处理，但会造成混淆。

**建议**: 
- 如果使用 Stylus，应使用 Stylus 语法（变量、嵌套等）
- 如果使用纯 CSS，将文件重命名为 `style.css`

---

### 5. 搜索功能缺少错误处理

**文件**: `layout/_partial/search-modal.ejs`  
**位置**: 第 25-35 行

```javascript
return fetch('<%= url_for("/search.xml") %>')
  .then(function(res) { return res.text(); })
  // 没有 .catch() 处理网络错误
```

**建议**: 添加错误处理
```javascript
return fetch('<%= url_for("/search.xml") %>')
  .then(function(res) { 
    if (!res.ok) throw new Error('搜索数据加载失败');
    return res.text(); 
  })
  .catch(function(err) {
    console.error('Search failed:', err);
    searchResults.innerHTML = '<div class="search-error">搜索功能暂时不可用</div>';
  });
```

---

## 🟢 可选优化

### 6. 内联脚本外置化

**位置**: `layout.ejs` 第 11-17 行, `header.ejs` 第 9-16 行

**建议**: 将暗黑模式初始化脚本移至 `main.js`，使用 `document.addEventListener('DOMContentLoaded', ...)` 执行。

---

### 7. 添加搜索加载状态

**建议**: 在搜索时显示加载指示器，提升用户体验。

```javascript
searchResults.innerHTML = '<div class="search-loading">搜索中...</div>';
```

---

### 8. 外链处理增强

**文件**: `source/js/main.js` 第 125-130 行

**当前实现**:
```javascript
document.querySelectorAll('a[href^="http"]').forEach(function(link) {
  if (link.hostname !== window.location.hostname) {
    link.setAttribute('target', '_blank');
    link.setAttribute('rel', 'noopener noreferrer');
  }
});
```

**建议**: 检查是否已有 `rel` 属性，避免覆盖：
```javascript
if (!link.hasAttribute('rel')) {
  link.setAttribute('rel', 'noopener noreferrer');
} else if (!link.getAttribute('rel').includes('noopener')) {
  link.setAttribute('rel', link.getAttribute('rel') + ' noopener noreferrer');
}
```

---

## ✅ 良好实践

1. **CSS 变量系统** - 使用 CSS 自定义属性实现主题切换，结构清晰
2. **暗黑模式实现** - 支持 localStorage 记忆和系统偏好检测
3. **语义化 HTML** - 正确使用 `<article>`, `<header>`, `<footer>`, `<nav>` 等标签
4. **无障碍支持** - 按钮包含 `aria-label`，支持键盘导航
5. **响应式设计** - 合理的断点设置，移动端适配良好
6. **代码复制功能** - 优雅降级处理，支持旧浏览器

---

## 📊 文件清单

| 文件 | 状态 | 备注 |
|------|------|------|
| `layout/layout.ejs` | ⚠️ | 与 partial 重复 |
| `layout/index.ejs` | ✅ | 良好 |
| `layout/post.ejs` | ✅ | 良好 |
| `layout/archive.ejs` | ✅ | 良好 |
| `layout/page.ejs` | ✅ | 良好 |
| `layout/tag.ejs` | ✅ | 良好 |
| `layout/flow.ejs` | ✅ | 良好 |
| `layout/resume.ejs` | 🔴 | URL 注入风险 |
| `layout/_partial/header.ejs` | ⚠️ | 与 layout.ejs 重复 |
| `layout/_partial/footer.ejs` | 🔴 | URL 注入风险 |
| `layout/_partial/search-modal.ejs` | 🔴 | XSS 漏洞 |
| `source/js/main.js` | ✅ | 良好 |
| `source/css/style.styl` | ⚠️ | 扩展名不一致 |
| `_config.yml` | ✅ | 良好 |

---

## 🎯 结论

**审查结果**: ❌ **需修改后通过**

**阻塞问题**:
1. 搜索功能 XSS 漏洞
2. URL 注入风险

**修复后可部署**: 修复上述 2 个安全问题后，代码可以进入部署阶段。其他建议项可在后续迭代中优化。

---

*审查完成于 2026-03-08 15:10 UTC*
