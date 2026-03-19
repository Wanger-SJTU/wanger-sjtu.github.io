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

  // 渲染 Obsidian 风格的力导向图谱
  function renderGraph(container, data) {
    const width = container.clientWidth - 40;
    const height = container.clientHeight - 40;

    // Obsidian 风格颜色
    const colors = [
      '#ff6b6b', '#4ecdc4', '#45b7d1', '#96ceb4', '#ffeaa7',
      '#dfe6e9', '#fd79a8', '#a29bfe', '#6c5ce7', '#00b894',
      '#e17055', '#0984e3', '#b2bec3', '#636e72', '#fab1a0'
    ];

    // 创建SVG
    const svg = document.createElementNS('http://www.w3.org/2000/svg', 'svg');
    svg.setAttribute('width', '100%');
    svg.setAttribute('height', '100%');
    svg.style.background = '#2d2d2d';
    container.appendChild(svg);

    // 计算节点位置（模拟力导向布局）
    const nodePositions = new Map();
    const currentNode = data.nodes.find(n => n.isCurrent);

    // 当前文章放在中心
    if (currentNode) {
      nodePositions.set(currentNode.id, { x: width / 2, y: height / 2 });
    }

    // 其他节点根据连接数分布在周围
    data.nodes.forEach((node, index) => {
      if (node.isCurrent) return;

      const connectionCount = data.links.filter(l =>
        l.source === node.id || l.target === node.id
      ).length;

      // 根据连接数确定距离中心的距离
      const distance = 80 + connectionCount * 40;
      const angle = ((index - (currentNode ? 1 : 0)) / (data.nodes.length - 1)) * 2 * Math.PI;

      const x = width / 2 + Math.cos(angle) * distance;
      const y = height / 2 + Math.sin(angle) * distance;

      nodePositions.set(node.id, { x, y, connectionCount });
    });

    // 绘制连接线
    data.links.forEach(link => {
      const sourcePos = nodePositions.get(link.source);
      const targetPos = nodePositions.get(link.target);

      if (!sourcePos || !targetPos) return;

      const line = document.createElementNS('http://www.w3.org/2000/svg', 'line');
      line.setAttribute('x1', sourcePos.x);
      line.setAttribute('y1', sourcePos.y);
      line.setAttribute('x2', targetPos.x);
      line.setAttribute('y2', targetPos.y);
      line.setAttribute('stroke', '#666');
      line.setAttribute('stroke-width', Math.max(0.5, link.tags.length * 0.3));
      line.setAttribute('opacity', '0.2');
      svg.appendChild(line);
    });

    // 绘制节点
    data.nodes.forEach((node) => {
      const pos = nodePositions.get(node.id);
      if (!pos) return;

      const connectionCount = pos.connectionCount || 0;
      const baseRadius = node.isCurrent ? 20 : 8;
      const nodeRadius = baseRadius + connectionCount * 2;

      const g = document.createElementNS('http://www.w3.org/2000/svg', 'g');
      g.style.cursor = node.isCurrent ? 'default' : 'pointer';
      g.style.transition = 'transform 0.2s';

      // 节点外圈（当前文章更突出）
      if (node.isCurrent) {
        const glow = document.createElementNS('http://www.w3.org/2000/svg', 'circle');
        glow.setAttribute('cx', pos.x);
        glow.setAttribute('cy', pos.y);
        glow.setAttribute('r', nodeRadius + 4);
        glow.setAttribute('fill', 'none');
        glow.setAttribute('stroke', '#4ecdc4');
        glow.setAttribute('stroke-width', '3');
        glow.setAttribute('opacity', '0.3');
        g.appendChild(glow);
      }

      // 主节点
      const circle = document.createElementNS('http://www.w3.org/2000/svg', 'circle');
      circle.setAttribute('cx', pos.x);
      circle.setAttribute('cy', pos.y);
      circle.setAttribute('r', nodeRadius);

      const colorIndex = node.id % colors.length;
      const color = node.isCurrent ? '#4ecdc4' : colors[colorIndex];
      circle.setAttribute('fill', color);
      circle.setAttribute('opacity', node.isCurrent ? '1' : '0.8');
      circle.setAttribute('stroke', node.isCurrent ? '#fff' : color);
      circle.setAttribute('stroke-width', node.isCurrent ? '3' : '2');
      g.appendChild(circle);

      // 节点标题（只在较大的节点或当前文章显示）
      if (node.isCurrent || connectionCount >= 2) {
        const text = document.createElementNS('http://www.w3.org/2000/svg', 'text');
        text.setAttribute('x', pos.x);
        text.setAttribute('y', pos.y + nodeRadius + 16);
        text.setAttribute('text-anchor', 'middle');
        text.setAttribute('fill', '#e0e0e0');
        text.setAttribute('font-size', node.isCurrent ? '13' : '11');
        text.setAttribute('font-weight', node.isCurrent ? '600' : '400');
        text.textContent = node.title.length > 15 ? node.title.substring(0, 15) + '...' : node.title;
        g.appendChild(text);
      }

      // 悬停效果
      if (!node.isCurrent) {
        g.addEventListener('mouseenter', () => {
          circle.setAttribute('r', nodeRadius * 1.2);
          circle.setAttribute('opacity', '1');
        });

        g.addEventListener('mouseleave', () => {
          circle.setAttribute('r', nodeRadius);
          circle.setAttribute('opacity', '0.8');
        });

        g.addEventListener('click', () => {
          window.location.href = node.url;
        });
      }

      svg.appendChild(g);
    });

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
