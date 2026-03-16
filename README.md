# 王二的数字花园

一个简约的个人博客，记录技术与生活的点滴。基于 [Hexo](https://hexo.io/) 静态站点生成器构建，使用自定义主题，部署在 GitHub Pages。

## 技术栈

- **Hexo** - 快速、简洁且高效的博客框架
- **EJS** - 模板引擎
- **Stylus** - CSS 预处理器
- **Vanilla JavaScript** - 无框架的纯 JS 实现交互
- **MathJax** - 数学公式渲染
- **GitHub Pages** - 静态网站托管
- **GitHub Actions** - CI/CD 自动部署

## 功能特性

- 🌓 **深色模式** - 支持系统偏好检测和手动切换
- 🔍 **本地搜索** - 基于 XML 的全文搜索
- 🏷️ **标签系统** - 文章分类和标签云
- 📅 **归档页面** - 按年份整理文章
- 📝 **废话时间线** - 碎碎念和随笔记录
- 🧮 **数学公式** - 支持 LaTeX 数学公式渲染
- 📱 **响应式设计** - 完美适配移动端和桌面端

## 本地开发

### 环境要求

- Node.js >= 18
- pnpm >= 8

### 安装依赖

```bash
pnpm install
```

### 启动开发服务器

```bash
pnpm run server
# 或
hexo server
```

访问 http://localhost:4000 查看博客

### 构建静态文件

```bash
pnpm run build
# 或
hexo generate
```

生成的静态文件在 `public/` 目录

### 清理缓存

```bash
pnpm run clean
# 或
hexo clean
```

## 创建新内容

### 创建新文章

```bash
hexo new post <文章标题>
```

文章会创建在 `source/_posts/` 目录

### 创建新页面

```bash
hexo new page <页面名称>
```

## 目录结构

```
├── source/              # 源文件目录
│   ├── _posts/         # 博客文章
│   ├── flows/          # 废话时间线
│   ├── resume/         # 简历页面
│   └── tags/           # 标签页
├── themes/
│   └── custom/         # 自定义主题
│       ├── layout/     # EJS 模板
│       │   ├── _partial/  # 可复用组件
│       │   ├── layout.ejs # 主布局
│       │   ├── index.ejs  # 首页
│       │   ├── post.ejs   # 文章页
│       │   ├── archive.ejs # 归档页
│       │   ├── tags.ejs   # 标签页
│       │   └── flow.ejs   # 时间线页
│       └── source/     # 主题资源
│           ├── css/style.styl  # 样式文件
│           └── js/      # JavaScript 文件
├── _config.yml         # Hexo 主配置
└── .github/workflows/  # GitHub Actions 工作流
    └── deploy.yml      # 自动部署配置
```

## 部署

本项目使用 GitHub Actions 自动部署到 GitHub Pages：

1. 推送代码到 `main` 分支
2. GitHub Actions 自动触发构建
3. 构建成功后自动部署到 GitHub Pages

部署流程在 `.github/workflows/deploy.yml` 中定义。

## 配置说明

### 网站配置

编辑 `_config.yml` 修改网站基本信息：

```yaml
# Site
title: 王二的数字花园
description: 一个简约的个人博客，记录技术与生活的点滴
author: Your Name

# URL
url: https://wanger-sjtu.github.io
root: /
```

### 主题配置

编辑 `themes/custom/_config.yml` 自定义主题：

```yaml
# 网站菜单
menu:
  首页: /
  简历: /resume
  归档: /archives
  标签: /tags
  废话: /flows

# 功能开关
darkmode: true
search: true
rss: true
math: true
```

## 数学公式

支持 LaTeX 数学公式渲染：

- **行内公式**：`$E = mc^2$` 或 `\(...\)`
- **块级公式**：`$$E = mc^2$$` 或 `\[...\]`

示例：

```markdown
行内公式：$E = mc^2$

块级公式：
$$
\int_0^\infty e^{-x^2} dx = \frac{\sqrt{\pi}}{2}
$$
```

若要禁用某篇文章的数学公式渲染，在 front-matter 中添加：

```yaml
---
math: false
---
```

## License

MIT

## 作者

[wanger-sjtu](https://github.com/Wanger-SJTU)
