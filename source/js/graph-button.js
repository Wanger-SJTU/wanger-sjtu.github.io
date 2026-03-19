// 知识图谱按钮 - 直接插入版本
console.log('=== Graph button script loaded ===');

(function() {
  'use strict';

  function addGraphButton() {
    console.log('Attempting to add graph button...');
    console.log('Current page:', window.location.pathname);

    // 只在文章页面执行
    if (!/\/\d{4}\/\d{2}\/\d{2}\//.test(window.location.pathname)) {
      console.log('Not a post page, skipping');
      return;
    }

    // 查找文章标题
    const titleElement = document.querySelector('.post-title');
    if (!titleElement) {
      console.log('Title element not found');
      return;
    }

    console.log('Found title element:', titleElement.textContent);

    // 创建按钮容器
    const buttonHTML = `
      <button id="graph-toggle-btn" onclick="showGraphModal()" style="
        display: inline-flex;
        align-items: center;
        gap: 6px;
        padding: 8px 16px;
        margin-left: 15px;
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
        vertical-align: middle;
      " onmouseover="this.style.transform='translateY(-2px)'; this.style.boxShadow='0 4px 12px rgba(102, 126, 234, 0.4)';"
        onmouseout="this.style.transform='translateY(0)'; this.style.boxShadow='0 2px 8px rgba(102, 126, 234, 0.3)';"
      >
        🕸️ <span>知识图谱</span>
      </button>
      <style>
        @media (max-width: 600px) {
          #graph-toggle-btn {
            margin-left: 0 !important;
            margin-top: 10px;
            width: 100%;
            justify-content: center;
          }
        }
      </style>
    `;

    // 插入按钮到标题后面
    titleElement.insertAdjacentHTML('afterend', buttonHTML);

    // 创建全局函数供按钮调用
    window.showGraphModal = function() {
      const title = titleElement.textContent || '未知文章';
      alert('知识图谱\n\n图谱可视化功能正在开发中！\n\n当前文章：' + title);
    };

    console.log('✅ Graph button added successfully!');
  }

  // 等待页面完全加载
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', function() {
      console.log('DOM loaded, adding button...');
      setTimeout(addGraphButton, 300);
    });
  } else {
    console.log('DOM already loaded');
    setTimeout(addGraphButton, 300);
  }

  // 备用：window.onload
  window.addEventListener('load', function() {
    console.log('Window loaded, adding button (backup)...');
    setTimeout(addGraphButton, 500);
  });

  console.log('=== Graph button script initialized ===');
})();
