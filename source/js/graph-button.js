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

  // 构建图谱数据
  function buildGraphData(posts, currentUrl) {
    const currentNode = currentUrl.replace(/\/$/, '') || '/';
    const nodes = [];
    const links = [];
    const nodeMap = new Map();

    // 添加所有节点
    posts.forEach((post, index) => {
      const url = post.url.replace(/\/$/, '');
      const isCurrent = url === currentNode;
      nodeMap.set(url, {
        id: index,
        title: post.title,
        url: post.url,
        tags: post.tags,
        isCurrent: isCurrent
      });
      nodes.push(nodeMap.get(url));
    });

    // 基于共同标签建立连接
    for (let i = 0; i < nodes.length; i++) {
      for (let j = i + 1; j < nodes.length; j++) {
        const commonTags = nodes[i].tags.filter(tag =>
          nodes[j].tags.includes(tag)
        );

        if (commonTags.length > 0) {
          links.push({
            source: i,
            target: j,
            tags: commonTags
          });
        }
      }
    }

    return { nodes, links };
  }

  // 创建图谱浮窗
  function createGraphModal(posts, graphData) {
    // 移除已存在的浮窗
    const existingModal = document.getElementById('knowledge-graph-modal');
    if (existingModal) {
      existingModal.remove();
    }

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
    content.style.cssText = `
      background: #1e1e1e;
      border-radius: 12px;
      padding: 24px;
      width: 95vw;
      max-width: 1600px;
      max-height: 90vh;
      overflow: auto;
      position: relative;
      box-shadow: 0 8px 32px rgba(0, 0, 0, 0.5);
    `;

    // 标题栏
    const header = document.createElement('div');
    header.innerHTML = `
      <div style="display:flex; justify-content:space-between; align-items:center; margin-bottom:20px;">
        <h2 style="margin:0; font-size:1.5rem; color:#e0e0e0;">🕸️ 知识图谱</h2>
        <button id="close-graph-modal" style="background:none; border:none; font-size:28px; cursor:pointer; padding:0; color:#e0e0e0;">×</button>
      </div>
      <hr style="border:1px solid #333; margin:0;">
    `;
    content.appendChild(header);

    // 图谱容器
    const graphContainer = document.createElement('div');
    graphContainer.id = 'knowledge-graph-container';
    graphContainer.style.cssText = `
      width: 100%;
      height: 600px;
      border: 1px solid #333;
      border-radius: 8px;
      background: #2d2d2d;
      margin: 20px 0;
      overflow: hidden;
    `;
    content.appendChild(graphContainer);

    // 相关文章列表
    const relatedSection = document.createElement('div');
    relatedSection.innerHTML = '<h3 style="margin:20px 0 10px; font-size:1.1rem; color:#e0e0e0;">相关文章</h3>';

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
        item.style.cssText = `
          display: block;
          padding: 12px;
          border: 1px solid #333;
          border-radius: 8px;
          text-decoration: none;
          color: #b0b0b0;
          transition: all 0.2s;
          background: #252525;
        `;
        item.innerHTML = `
          <div style="font-weight:600; margin-bottom:6px; color:#e0e0e0;">${post.title}</div>
          <div style="font-size:12px; color:#888;">
            共同标签: ${post.commonTags.map(t => '#' + t).join(' ')}
          </div>
        `;
        item.addEventListener('mouseenter', () => {
          item.style.background = '#333';
          item.style.borderColor = '#555';
        });
        item.addEventListener('mouseleave', () => {
          item.style.background = '#252525';
          item.style.borderColor = '#333';
        });
        relatedList.appendChild(item);
      });
    } else {
      relatedList.innerHTML = '<div style="color:#888; padding:20px; text-align:center;">暂无相关文章</div>';
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
    // Obsidian 风格颜色
    const colors = [
      '#ff6b6b', '#4ecdc4', '#45b7d1', '#96ceb4', '#ffeaa7',
      '#dfe6e9', '#fd79a8', '#a29bfe', '#6c5ce7', '#00b894',
      '#e17055', '#0984e3', '#b2bec3', '#636e72', '#fab1a0'
    ];

    // 转换数据格式为 vis.js 格式
    const nodes = data.nodes.map((node, index) => {
      const connectionCount = data.links.filter(l =>
        l.source === node.id || l.target === node.id
      ).length;

      const colorIndex = node.id % colors.length;
      const color = node.isCurrent ? '#4ecdc4' : colors[colorIndex];

      return {
        id: node.id,
        label: node.title,
        title: node.title + (node.tags.length > 0 ? '\n标签: ' + node.tags.join(', ') : ''),
        value: node.isCurrent ? 30 : 10 + connectionCount * 3,
        color: {
          background: color,
          border: node.isCurrent ? '#fff' : color,
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
          color: '#e0e0e0',
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
        color: 'rgba(255, 255, 255, 0.15)',
        highlight: 'rgba(255, 255, 255, 0.3)',
        hover: 'rgba(255, 255, 255, 0.25)'
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
    legend.style.cssText = `
      position: absolute;
      bottom: 10px;
      left: 10px;
      padding: 8px 12px;
      background: #1e1e1e;
      border: 1px solid #333;
      border-radius: 4px;
      font-size: 12px;
      color: #b0b0b0;
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
