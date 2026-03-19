// 知识图谱按钮 - 简化版
(function() {
  'use strict';

  console.log('Graph button script loaded');

  function init() {
    // 检查是否是文章页面
    const article = document.querySelector('article.post-page, .post-page');
    if (!article) {
      console.log('Not a post page, skipping graph button');
      return;
    }

    console.log('Post page detected, creating graph button');

    // 创建图谱按钮
    const graphBtn = document.createElement('button');
    graphBtn.className = 'graph-toggle-btn';
    graphBtn.innerHTML = '🕸️';
    graphBtn.title = '知识图谱';
    graphBtn.setAttribute('aria-label', '查看知识图谱');

    // 添加样式
    graphBtn.style.cssText = `
      position: fixed;
      top: 100px;
      right: 20px;
      width: 44px;
      height: 44px;
      border-radius: 50%;
      background: var(--color-bg, #fff);
      border: 2px solid var(--color-border, #ddd);
      cursor: pointer;
      font-size: 20px;
      display: flex;
      align-items: center;
      justify-content: center;
      box-shadow: 0 2px 8px rgba(0, 0, 0, 0.1);
      transition: all 0.2s;
      z-index: 1000;
    `;

    // 移动端适配
    if (window.innerWidth <= 768) {
      graphBtn.style.top = 'auto';
      graphBtn.style.bottom = '80px';
    }

    // 悬停效果
    graphBtn.addEventListener('mouseenter', function() {
      graphBtn.style.background = 'var(--color-accent, #007acc)';
      graphBtn.style.transform = 'scale(1.1)';
    });

    graphBtn.addEventListener('mouseleave', function() {
      graphBtn.style.background = 'var(--color-bg, #fff)';
      graphBtn.style.transform = 'scale(1)';
    });

    // 点击事件 - 显示简单提示
    graphBtn.addEventListener('click', function() {
      alert('知识图谱功能\n\n图谱可视化正在开发中，敬请期待！\n\n当前文章: ' + document.querySelector('.post-title, h1').textContent);
    });

    // 添加到页面
    document.body.appendChild(graphBtn);
    console.log('Graph button added successfully');
  }

  // 等待DOM加载完成
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
  } else {
    // 延迟一点执行，确保页面渲染完成
    setTimeout(init, 100);
  }
})();
