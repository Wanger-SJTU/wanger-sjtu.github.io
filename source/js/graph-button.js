// 知识图谱按钮 - 完全独立版
console.log('=== Graph button script starting ===');

(function() {
  'use strict';

  function init() {
    console.log('Init function called');
    console.log('Current page:', window.location.pathname);
    console.log('Document ready state:', document.readyState);

    // 检查是否是文章页面 - 匹配所有可能的文章页URL模式
    const path = window.location.pathname;
    const isPostPage = /\/\d{4}\/\d{2}\/\d{2}\//.test(path) ||
                       document.querySelector('article.post-page, .post-page, .post-content');

    console.log('Is post page:', isPostPage);

    if (!isPostPage) {
      console.log('Not a post page, skipping');
      return;
    }

    console.log('Creating graph button...');

    // 创建图谱按钮
    const graphBtn = document.createElement('button');
    graphBtn.className = 'graph-toggle-btn';
    graphBtn.innerHTML = '🕸️';
    graphBtn.title = '知识图谱';
    graphBtn.setAttribute('aria-label', '查看知识图谱');
    graphBtn.id = 'graph-toggle-btn';

    // 使用内联样式，不依赖任何CSS变量
    graphBtn.style.position = 'fixed';
    graphBtn.style.top = '100px';
    graphBtn.style.right = '20px';
    graphBtn.style.width = '44px';
    graphBtn.style.height = '44px';
    graphBtn.style.borderRadius = '50%';
    graphBtn.style.backgroundColor = '#ffffff';
    graphBtn.style.border = '2px solid #e0e0e0';
    graphBtn.style.cursor = 'pointer';
    graphBtn.style.fontSize = '20px';
    graphBtn.style.display = 'flex';
    graphBtn.style.alignItems = 'center';
    graphBtn.style.justifyContent = 'center';
    graphBtn.style.boxShadow = '0 2px 8px rgba(0, 0, 0, 0.1)';
    graphBtn.style.zIndex = '9999';
    graphBtn.style.transition = 'all 0.2s';

    // 移动端适配
    if (window.innerWidth <= 768) {
      graphBtn.style.top = 'auto';
      graphBtn.style.bottom = '80px';
    }

    // 悬停效果
    graphBtn.onmouseenter = function() {
      graphBtn.style.backgroundColor = '#007acc';
      graphBtn.style.transform = 'scale(1.1)';
    };

    graphBtn.onmouseleave = function() {
      graphBtn.style.backgroundColor = '#ffffff';
      graphBtn.style.transform = 'scale(1)';
    };

    // 点击事件
    graphBtn.onclick = function() {
      alert('知识图谱\n\n图谱可视化正在开发中，敬请期待！\n\n当前文章: ' + (document.querySelector('.post-title, h1, .post-title')?.textContent || '未知'));
    };

    // 添加到页面
    try {
      document.body.appendChild(graphBtn);
      console.log('✅ Graph button successfully added to page!');
      console.log('Button element:', graphBtn);
      console.log('Button position:', graphBtn.style.position);
    } catch (error) {
      console.error('❌ Failed to add button:', error);
    }
  }

  // 多种方式确保执行
  console.log('Setting up init function...');

  // 方式1: DOMContentLoaded
  if (document.readyState === 'loading') {
    console.log('Waiting for DOMContentLoaded...');
    document.addEventListener('DOMContentLoaded', function() {
      console.log('DOMContentLoaded fired');
      setTimeout(init, 100);
    });
  } else {
    console.log('DOM already ready, calling init immediately');
    setTimeout(init, 100);
  }

  // 方式2: window.onload (备用)
  window.addEventListener('load', function() {
    console.log('Window load event fired');
    setTimeout(init, 200);
  });

  console.log('=== Graph button script loaded ===');
})();
