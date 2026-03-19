// 文章页面的知识图谱按钮和浮窗功能
console.log('=== Knowledge Graph Feature ===');

(function() {
  'use strict';

  // 获取所有文章数据
  async function fetchAllPosts() {
    try {
      const response = await fetch('/search.xml');
      const xmlText = await response.text();
      const parser = new DOMParser();
      const doc = parser.parseFromString(xmlText, 'text/xml');
      const entries = doc.querySelectorAll('entry');
      const posts = [];

      entries.forEach(entry => {
        const title = entry.querySelector('title');
        const url = entry.querySelector('url');
        const tags = entry.querySelector('tags');

        if (title && url) {
          posts.push({
            title: title.textContent.trim(),
            url: url.textContent.trim(),
            tags: tags ? tags.textContent.split(',').filter(t => t.trim()) : []
          });
        }
      });

      return posts;
    } catch (error) {
      console.error('Failed to fetch posts:', error);
      return [];
    }
  }

  // 构建图谱数据（与小图保持一致：只显示相关文章）
  function buildGraphData(posts, currentUrl) {
    const currentNode = currentUrl.replace(/\/$/, '') || '/';
    const nodes = [];
    const links = [];
    const nodeMap = new Map();

    // 找到当前文章
    const currentPost = posts.find(post => {
      const postUrl = post.url.replace(/\/$/, '');
      return postUrl === currentNode || postUrl === currentNode + 'index.html';
    });

    if (!currentPost) {
      return { nodes: [], links: [] };
    }

    const currentTags = currentPost.tags || [];

    // 找出与当前文章有共同标签的文章
    const relatedPostsMap = new Map();

    posts.forEach(post => {
      const postUrl = post.url.replace(/\/$/, '');
      if (postUrl === currentNode || postUrl === currentNode + 'index.html') {
        return; // 跳过当前文章
      }

      const postTags = post.tags || [];
      const commonTags = currentTags.filter(tag => postTags.includes(tag));

      if (commonTags.length > 0) {
        relatedPostsMap.set(postUrl, {
          post: post,
          commonTags: commonTags
        });
      }
    });

    // 当前文章节点
    nodes.push({
      id: 0,
      title: currentPost.title,
      url: currentPost.url,
      tags: currentTags,
      isCurrent: true
    });

    // 相关文章节点
    let index = 1;
    relatedPostsMap.forEach((data, url) => {
      nodes.push({
        id: index,
        title: data.post.title,
        url: data.post.url,
        tags: data.post.tags,
        isCurrent: false
      });

      // 建立连接（从当前文章到相关文章）
      links.push({
        source: 0,
        target: index,
        tags: data.commonTags
      });

      index++;
    });

    return { nodes, links };
  }

  // 创建图谱浮窗
  function createGraphModal(posts, graphData) {
    // 移除已存在的浮窗
    const existingModal = document.getElementById('knowledge-graph-modal');
    if (existingModal) {
      existingModal.remove();
    }

    // 检测当前主题
    const isDarkMode = document.documentElement.getAttribute('data-theme') === 'dark';

    const modal = document.createElement('div');
    modal.id = 'knowledge-graph-modal';
    modal.style.cssText = `
      position: fixed;
      top: 0;
      left: 0;
      right: 0;
      bottom: 0;
      background: rgba(0, 0, 0, 0.6);
      display: flex;
      justify-content: center;
      align-items: center;
      z-index: 10000;
      opacity: 0;
      transition: opacity 0.3s;
    `;

    const content = document.createElement('div');
    content.className = 'graph-modal-content';
    content.setAttribute('data-graph-modal', 'true');
    content.style.cssText = `
      background: ${isDarkMode ? '#1e1e1e' : '#ffffff'};
      border-radius: 12px;
      padding: 24px;
      width: 95vw;
      max-width: 1600px;
      max-height: 90vh;
      overflow: auto;
      position: relative;
      box-shadow: 0 8px 32px rgba(0, 0, 0, ${isDarkMode ? 0.5 : 0.2});
    `;

    // 标题栏
    const header = document.createElement('div');
    header.innerHTML = `
      <div style="display:flex; justify-content:space-between; align-items:center; margin-bottom:20px;">
        <h2 class="graph-modal-title" style="margin:0; font-size:1.5rem; color:${isDarkMode ? '#e0e0e0' : '#333'};">🕸️ 知识图谱</h2>
        <button id="close-graph-modal" class="graph-modal-close" style="background:none; border:none; font-size:28px; cursor:pointer; padding:0; color:${isDarkMode ? '#e0e0e0' : '#333'};">×</button>
      </div>
      <hr class="graph-modal-hr" style="border:1px solid ${isDarkMode ? '#333' : '#e0e0e0'}; margin:0;">
    `;
    content.appendChild(header);

    // 图谱容器
    const graphContainer = document.createElement('div');
    graphContainer.id = 'knowledge-graph-container';
    graphContainer.setAttribute('data-graph-container', 'true');
    graphContainer.style.cssText = `
      width: 100%;
      height: 600px;
      border: 1px solid ${isDarkMode ? '#333' : '#e0e0e0'};
      border-radius: 8px;
      background: ${isDarkMode ? '#2d2d2d' : '#fafafa'};
      margin: 20px 0;
      overflow: hidden;
    `;
    content.appendChild(graphContainer);

    // 相关文章列表
    const relatedSection = document.createElement('div');
    relatedSection.innerHTML = `<h3 class="graph-modal-section-title" style="margin:20px 0 10px; font-size:1.1rem; color:${isDarkMode ? '#e0e0e0' : '#333'};">相关文章</h3>`;

    const relatedList = document.createElement('div');
    relatedList.style.cssText = `
      display: grid;
      grid-template-columns: repeat(auto-fill, minmax(280px, 1fr));
      gap: 12px;
      max-height: 300px;
      overflow-y: auto;
      padding: 4px;
    `;

    // 找出与当前文章相关的文章
    const currentNode = window.location.pathname.replace(/\/$/, '') || '/';
    const relatedPosts = graphData.links
      .filter(link => {
        const sourceUrl = graphData.nodes[link.source].url.replace(/\/$/, '');
        const targetUrl = graphData.nodes[link.target].url.replace(/\/$/, '');
        return sourceUrl === currentNode || targetUrl === currentNode;
      })
      .map(link => {
        const relatedNode = link.source === graphData.nodes.findIndex(n => n.url.replace(/\/$/, '') === currentNode) ?
          graphData.nodes[link.target] : graphData.nodes[link.source];
        return { ...relatedNode, commonTags: link.tags };
      })
      .sort((a, b) => b.commonTags.length - a.commonTags.length)
      .slice(0, 8);

    if (relatedPosts.length > 0) {
      relatedPosts.forEach(post => {
        const item = document.createElement('a');
        item.href = post.url;
        item.setAttribute('data-related-item', 'true');
        item.style.cssText = `
          display: block;
          padding: 12px;
          border: 1px solid ${isDarkMode ? '#333' : '#e0e0e0'};
          border-radius: 8px;
          text-decoration: none;
          color: ${isDarkMode ? '#b0b0b0' : '#555'};
          transition: all 0.2s;
          background: ${isDarkMode ? '#252525' : '#f5f5f5'};
        `;
        item.innerHTML = `
          <div style="font-weight:600; margin-bottom:6px; color:${isDarkMode ? '#e0e0e0' : '#333'};">${post.title}</div>
          <div style="font-size:12px; color:${isDarkMode ? '#888' : '#999'};">
            共同标签: ${post.commonTags.map(t => '#' + t).join(' ')}
          </div>
        `;
        item.addEventListener('mouseenter', () => {
          const currentDark = document.documentElement.getAttribute('data-theme') === 'dark';
          item.style.background = currentDark ? '#333' : '#e8e8e8';
          item.style.borderColor = currentDark ? '#555' : '#ccc';
        });
        item.addEventListener('mouseleave', () => {
          const currentDark = document.documentElement.getAttribute('data-theme') === 'dark';
          item.style.background = currentDark ? '#252525' : '#f5f5f5';
          item.style.borderColor = currentDark ? '#333' : '#e0e0e0';
        });
        relatedList.appendChild(item);
      });
    } else {
      relatedList.innerHTML = `<div style="color:${isDarkMode ? '#888' : '#999'}; padding:20px; text-align:center;">暂无相关文章</div>`;
    }

    relatedSection.appendChild(relatedList);
    content.appendChild(relatedSection);

    modal.appendChild(content);
    document.body.appendChild(modal);

    // 显示浮窗
    requestAnimationFrame(() => {
      modal.style.opacity = '1';
    });

    // 渲染图谱
    renderGraph(graphContainer, graphData);

    // 关闭事件
    document.getElementById('close-graph-modal').addEventListener('click', () => {
      modal.style.opacity = '0';
      setTimeout(() => modal.remove(), 300);
    });

    modal.addEventListener('click', (e) => {
      if (e.target === modal) {
        modal.style.opacity = '0';
        setTimeout(() => modal.remove(), 300);
      }
    });

    document.addEventListener('keydown', (e) => {
      if (e.key === 'Escape' && modal.style.opacity === '1') {
        modal.style.opacity = '0';
        setTimeout(() => modal.remove(), 300);
      }
    });

    // 监听主题切换
    const themeObserver = new MutationObserver((mutations) => {
      mutations.forEach((mutation) => {
        if (mutation.attributeName === 'data-theme') {
          const isDark = document.documentElement.getAttribute('data-theme') === 'dark';

          // 更新浮窗背景
          content.style.background = isDark ? '#1e1e1e' : '#ffffff';
          content.style.boxShadow = `0 8px 32px rgba(0, 0, 0, ${isDark ? 0.5 : 0.2})`;

          // 更新标题
          const title = content.querySelector('.graph-modal-title');
          if (title) title.style.color = isDark ? '#e0e0e0' : '#333';

          // 更新关闭按钮
          const closeBtn = content.querySelector('.graph-modal-close');
          if (closeBtn) closeBtn.style.color = isDark ? '#e0e0e0' : '#333';

          // 更新分割线
          const hr = content.querySelector('.graph-modal-hr');
          if (hr) hr.style.border = `1px solid ${isDark ? '#333' : '#e0e0e0'}`;

          // 更新相关文章标题
          const sectionTitle = content.querySelector('.graph-modal-section-title');
          if (sectionTitle) sectionTitle.style.color = isDark ? '#e0e0e0' : '#333';

          // 更新图谱容器
          const container = content.querySelector('[data-graph-container]');
          if (container) {
            container.style.background = isDark ? '#2d2d2d' : '#fafafa';
            container.style.border = `1px solid ${isDark ? '#333' : '#e0e0e0'}`;
          }

          // 更新相关文章列表项
          const items = content.querySelectorAll('[data-related-item]');
          items.forEach(item => {
            item.style.borderColor = isDark ? '#333' : '#e0e0e0';
            item.style.color = isDark ? '#b0b0b0' : '#555';
            item.style.background = isDark ? '#252525' : '#f5f5f5';

            const titleDiv = item.querySelector('div:first-child');
            if (titleDiv) titleDiv.style.color = isDark ? '#e0e0e0' : '#333';

            const tagsDiv = item.querySelector('div:last-child');
            if (tagsDiv) tagsDiv.style.color = isDark ? '#888' : '#999';
          });

          // 重新渲染图谱以更新颜色
          const network = window.graphNetwork;
          if (network) {
            network.destroy();
            renderGraph(graphContainer, graphData);
          }

          // 更新图例
          const legend = graphContainer.querySelector('[data-graph-legend]');
          if (legend) {
            legend.style.background = isDark ? '#1e1e1e' : '#fff';
            legend.style.border = `1px solid ${isDark ? '#333' : '#e0e0e0'}`;
            legend.style.color = isDark ? '#b0b0b0' : '#666';
          }
        }
      });
    });

    themeObserver.observe(document.documentElement, { attributes: true });
  }

  // 使用 vis.js Network 渲染图谱
  function renderGraph(container, data) {
    // 确保 vis.js 已加载
    if (typeof vis === 'undefined') {
      container.innerHTML = '<div style="display:flex; justify-content:center; align-items:center; height:100%; color:#888;">加载中...</div>';
      // 等待 vis.js 加载
      const checkVis = setInterval(() => {
        if (typeof vis !== 'undefined') {
          clearInterval(checkVis);
          renderVisGraph(container, data);
        }
      }, 100);
      setTimeout(() => clearInterval(checkVis), 5000);
      return;
    }
    renderVisGraph(container, data);
  }

  function renderVisGraph(container, data) {
    // 检测当前主题
    const isDarkMode = document.documentElement.getAttribute('data-theme') === 'dark';

    // Obsidian 风格颜色
    const colors = [
      '#ff6b6b', '#4ecdc4', '#45b7d1', '#96ceb4', '#ffeaa7',
      '#dfe6e9', '#fd79a8', '#a29bfe', '#6c5ce7', '#00b894',
      '#e17055', '#0984e3', '#b2bec3', '#636e72', '#fab1a0'
    ];

    // 当前文章节点颜色
    const currentArticleColor = '#4ecdc4';

    // 转换数据格式为 vis.js 格式
    const nodes = data.nodes.map((node, index) => {
      const connectionCount = data.links.filter(l =>
        l.source === node.id || l.target === node.id
      ).length;

      const colorIndex = node.id % colors.length;
      const color = node.isCurrent ? currentArticleColor : colors[colorIndex];

      return {
        id: node.id,
        label: node.title,
        title: node.title + (node.tags.length > 0 ? '\n标签: ' + node.tags.join(', ') : ''),
        value: node.isCurrent ? 30 : 10 + connectionCount * 3,
        color: {
          background: color,
          border: node.isCurrent ? (isDarkMode ? '#fff' : '#fff') : color,
          highlight: {
            background: color,
            border: '#fff'
          },
          hover: {
            background: color,
            border: '#fff'
          }
        },
        font: {
          color: isDarkMode ? '#e0e0e0' : '#333',
          size: node.isCurrent ? 16 : 12,
          face: 'Arial'
        },
        shape: node.isCurrent ? 'dot' : 'dot',
        url: node.isCurrent ? null : node.url
      };
    });

    const edges = data.links.map(link => ({
      from: link.source,
      to: link.target,
      title: '共同标签: ' + link.tags.join(', '),
      value: link.tags.length,
      color: {
        color: isDarkMode ? 'rgba(255, 255, 255, 0.15)' : 'rgba(0, 0, 0, 0.15)',
        highlight: isDarkMode ? 'rgba(255, 255, 255, 0.3)' : 'rgba(0, 0, 0, 0.3)',
        hover: isDarkMode ? 'rgba(255, 255, 255, 0.25)' : 'rgba(0, 0, 0, 0.25)'
      },
      width: Math.max(0.5, link.tags.length * 0.5)
    }));

    // 创建 vis.js 数据集
    const nodesDataset = new vis.DataSet(nodes);
    const edgesDataset = new vis.DataSet(edges);

    // 配置选项
    const options = {
      nodes: {
        shape: 'dot',
        borderWidth: 2,
        borderWidthSelected: 3,
        shadow: {
          enabled: true,
          color: 'rgba(0,0,0,0.5)',
          size: 5,
          x: 0,
          y: 0
        }
      },
      edges: {
        smooth: {
          type: 'continuous',
          forceDirection: 'none',
          roundness: 0.5
        },
        width: 0.5
      },
      physics: {
        stabilization: true,
        barnesHut: {
          gravitationalConstant: -3000,
          centralGravity: 0.3,
          springLength: 120,
          springConstant: 0.04,
          damping: 0.09,
          avoidOverlap: 0.2
        },
        maxVelocity: 50,
        solver: 'barnesHut',
        timestep: 0.5,
        adaptiveTimestep: true
      },
      interaction: {
        hover: true,
        tooltipDelay: 100,
        zoomView: true,
        dragView: true,
        navigationButtons: false,
        keyboard: true,
        multiselect: false
      }
    };

    // 创建网络
    const network = new vis.Network(container, {
      nodes: nodesDataset,
      edges: edgesDataset
    }, options);

    // 保存到全局变量以便主题切换时重新渲染
    window.graphNetwork = network;

    // 点击节点跳转
    network.on('click', function(params) {
      if (params.nodes.length > 0) {
        const nodeId = params.nodes[0];
        const node = nodesDataset.get(nodeId);
        if (node.url) {
          window.location.href = node.url;
        }
      }
    });

    // 聚焦到当前文章
    const currentNode = data.nodes.find(n => n.isCurrent);
    if (currentNode) {
      network.once('stabilizationIterationsDone', function() {
        network.focus(currentNode.id, {
          scale: 0.8,
          animation: true
        });
      });
    }

    // 图例
    const legend = document.createElement('div');
    legend.setAttribute('data-graph-legend', 'true');
    legend.style.cssText = `
      position: absolute;
      bottom: 10px;
      left: 10px;
      padding: 8px 12px;
      background: ${isDarkMode ? '#1e1e1e' : '#fff'};
      border: 1px solid ${isDarkMode ? '#333' : '#e0e0e0'};
      border-radius: 4px;
      font-size: 12px;
      color: ${isDarkMode ? '#b0b0b0' : '#666'};
      z-index: 10;
    `;
    legend.innerHTML = '🟢 当前文章 &nbsp; ⚪ 相关文章';
    container.appendChild(legend);
  }

  // 暴露函数到全局，供侧边栏按钮调用
  window.openKnowledgeGraphModal = async function() {
    const posts = await fetchAllPosts();
    if (posts.length === 0) {
      console.log('No posts found');
      return;
    }
    const graphData = buildGraphData(posts, window.location.pathname);
    createGraphModal(posts, graphData);
  };

  // 初始化 - 只给侧边栏按钮添加事件
  async function init() {
    console.log('Initializing knowledge graph feature...');

    // 只在文章页面执行
    if (!/\/\d{4}\/\d{2}\/\d{2}\//.test(window.location.pathname)) {
      console.log('Not a post page');
      return;
    }

    // 等待侧边栏按钮加载完成
    const checkButton = setInterval(() => {
      const sidebarBtn = document.getElementById('sidebar-graph-btn');
      if (sidebarBtn) {
        clearInterval(checkButton);
        sidebarBtn.addEventListener('click', () => {
          window.openKnowledgeGraphModal();
        });
        console.log('✅ Knowledge graph sidebar button initialized');
      }
    }, 100);

    // 5秒后停止检查
    setTimeout(() => clearInterval(checkButton), 5000);
  }

  // 初始化
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
  } else {
    setTimeout(init, 100);
  }

  console.log('=== Knowledge Graph Ready ===');
})();
