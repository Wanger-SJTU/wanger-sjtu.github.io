# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

This is a personal blog built with Hexo static site generator, using a custom theme. The blog is deployed to GitHub Pages via automated workflow. Content is primarily in Chinese.

## Development Commands

**Package Manager:** This project uses `pnpm` (not npm or yarn)

```bash
# Install dependencies
pnpm install

# Start local development server
pnpm run server
# or: hexo server

# Clean generated files
pnpm run clean
# or: hexo clean

# Build for production
pnpm run build
# or: hexo generate

# Deploy to GitHub Pages
pnpm run deploy
# or: hexo deploy
```

## Creating New Content

```bash
# Create a new post (uses scaffolds/post.md template)
hexo new post <title>

# Create a new page
hexo new page <title>
```

Post files are created in `source/_posts/` by default. The `post_asset_folder: true` setting means asset folders are created alongside posts.

## Architecture

### Directory Structure

```
├── source/              # Content directory
│   ├── _posts/         # Blog posts (markdown)
│   ├── flows/          # "废话" (nonsense/thoughts) timeline entries
│   ├── resume/         # Resume page
│   └── tags/           # Tags index
├── themes/
│   └── custom/         # Custom theme
│       ├── layout/     # EJS templates
│       │   ├── _partial/  # Reusable components (header, footer, search)
│       │   ├── layout.ejs # Main layout wrapper
│       │   ├── index.ejs  # Home page
│       │   ├── post.ejs   # Single post
│       │   ├── flow.ejs   # Timeline/flows page with calendar
│       │   ├── archive.ejs # Archives page
│       │   └── tags.ejs   # Tags listing
│       └── source/     # Theme assets
│           ├── css/style.styl  # Stylus stylesheet
│           └── js/      # JavaScript (main.js, navbar.js)
├── scaffolds/          # Post templates
├── _config.yml         # Hexo configuration
└── .github/workflows/deploy.yml  # CI/CD to GitHub Pages
```

### Custom Theme Architecture

The custom theme uses:
- **EJS** for templating (server-side rendering)
- **Stylus** for CSS preprocessing
- **Vanilla JavaScript** for interactivity

**Layout Hierarchy:**
- `layout.ejs` - Base HTML structure, includes header/footer, handles dark mode initialization and MathJax configuration
- Page templates (`index.ejs`, `post.ejs`, etc.) extend the base layout
- `_partial/` contains reusable components

**Key Features:**
- Dark mode with localStorage persistence and system preference detection
- MathJax for LaTeX rendering (inline: `$...$`, display: `$$...$$`)
- Search functionality via hexo-generator-search
- RSS feed generation
- Responsive design with mobile menu

### Special Feature: "废话" (Flows) Timeline

The `flows/` directory contains a custom timeline feature. The main file is `source/flows/index.md` with front-matter defining flow entries:

```yaml
---
title: 废话
layout: flow
description: 记录一些碎碎念、日常想法和随笔
flows:
  - date: 2026-03-14
    title: Entry title
    text: Entry content
    tags: [tag1, tag2]
---
```

The `flow.ejs` template renders:
- Left sidebar: Interactive calendar that filters timeline entries by date
- Right content: Chronological timeline of entries

## Configuration Files

- `_config.yml` - Main Hexo config (URL, theme, deployment, generators)
- `themes/custom/_config.yml` - Theme-specific config (menu, social links, feature toggles)

## Deployment

GitHub Actions workflow (`.github/workflows/deploy.yml`) automatically:
1. Triggers on push to `main` branch
2. Builds using `pnpm run build`
3. Deploys `public/` directory to GitHub Pages

## Theme Customization Notes

- CSS uses CSS variables for theming (defined in `style.styl`)
- Dark mode toggles `data-theme="dark"` on `<html>` element
- Navigation menu is configured in `themes/custom/_config.yml` under `menu` key
- Stylus files need to be manually compiled (Hexo handles this during build)

## Math Rendering

MathJax is configured to support:
- Inline math: `$E = mc^2$` or `\(...\)`
- Display math: `$$E = mc^2$$` or `\[..., \]`
- Auto-skips script, style, textarea, and pre tags

To disable math rendering on a specific post, add `math: false` to front-matter.
