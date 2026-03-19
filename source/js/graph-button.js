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

    // 在文章标题附近创建图谱按钮
    const postHeader = document.querySelector('.post-header');
    const postTitle = document.querySelector('.post-title');

    if (!postTitle) {
      console.log('Post title not found, skipping button');
      return;
    }

    // 创建图谱按钮容器
    const buttonContainer = document.createElement('div');
    buttonContainer.className = 'graph-button-container';
    buttonContainer.id = 'graph-button-container';
    buttonContainer.style.cssText = `
      display: inline-flex;
      align-items: center;
      gap: 10px;
      margin-left: 15px;
      vertical-align: middle;
    `;

    // 创建图谱按钮
    const graphBtn = document.createElement('button');
    graphBtn.className = 'graph-toggle-btn';
    graphBtn.innerHTML = '🕸️ <span>知识图谱</span>';
    graphBtn.title = '查看文章关系图谱';
    graphBtn.setAttribute('aria-label', '查看文章关系图谱');
    graphBtn.id = 'graph-toggle-btn';

    // 按钮样式
    graphBtn.style.cssText = `
      display: inline-flex;
      align-items: center;
      gap: 6px;
      padding: 8px 16px;
      border-radius: 20px;
      background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
      color: white;
      border: none;
      cursor: pointer;
      font-size: 14px;
      font-weight: 500;
      box-shadow: 0 2px 8px rgba(102, 126, 234, 0.3);
      transition: all 0.3s ease;
      white-space: nowrap;
    `;

    // 图标样式
    const iconStyle = document.createElement('style');
    iconStyle.textContent = `
      #graph-toggle-btn:hover {
        transform: translateY(-2px);
        box-shadow: 0 4px 12px rgba(102, 126, 234, 0.4);
      }
      @media (max-width: 600px) {
        #graph-button-container {
          display: block;
          margin: 10px 0;
        }
        #graph-toggle-btn {
          width: 100%;
          justify-content: center;
        }
      }
    `;

    // 悬停效果
    graphBtn.onmouseenter = function() {
      graphBtn.style.transform = 'translateY(-2px)';
      graphBtn.style.boxShadow = '0 4px 12px rgba(102, 126, 234, 0.4)';
    };

    graphBtn.onmouseleave = function() {
      graphBtn.style.transform = 'translateY(0)';
      graphBtn.style.boxShadow = '0 2px 8px rgba(102, 126, 234, 0.3)';
    };

    // 点击事件
    graphBtn.onclick = function(e) {
      e.preventDefault();
      const title = postTitle.textContent || '未知文章';
      alert('知识图谱\n\n图谱可视化正在开发中！\n\n当前文章: ' + title);
    };

    buttonContainer.appendChild(graphBtn);
    document.head.appendChild(iconStyle);

    // 插入到标题旁边
    if (postHeader) {
      // 在标题后面插入
      const titleParent = postTitle.parentNode;
      if (titleParent) {
        const wrapper = document.createElement('div');
        wrapper.style.cssText = 'display: flex; align-items: center; flex-wrap: wrap; gap: 10px;';
        wrapper.appendChild(postTitle.cloneNode(true));
        wrapper.appendChild(buttonContainer);
        titleParent.replaceChild(wrapper, postTitle);
      }
    }

    console.log('✅ Graph button successfully added to post header!');
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
