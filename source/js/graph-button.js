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
      background: var(--color-bg, #ffffff);
      border-radius: 12px;
      padding: 24px;
      max-width: 90vw;
      max-height: 85vh;
      overflow: auto;
      position: relative;
      box-shadow: 0 8px 32px rgba(0, 0, 0, 0.3);
    `;

    // 标题栏
    const header = document.createElement('div');
    header.innerHTML = `
      <div style="display:flex; justify-content:space-between; align-items:center; margin-bottom:20px;">
        <h2 style="margin:0; font-size:1.5rem;">🕸️ 知识图谱</h2>
        <button id="close-graph-modal" style="background:none; border:none; font-size:28px; cursor:pointer; padding:0; color:var(--color-text);">×</button>
      </div>
      <hr style="border:1px solid var(--color-border); margin:0;">
    `;
    content.appendChild(header);

    // 图谱容器
    const graphContainer = document.createElement('div');
    graphContainer.id = 'knowledge-graph-container';
    graphContainer.style.cssText = `
      width: 100%;
      height: 500px;
      border: 1px solid var(--color-border);
      border-radius: 8px;
      background: var(--color-card-bg, #fafafa);
      margin: 20px 0;
      overflow: hidden;
    `;
    content.appendChild(graphContainer);

    // 相关文章列表
    const relatedSection = document.createElement('div');
    relatedSection.innerHTML = '<h3 style="margin:20px 0 10px; font-size:1.1rem;">相关文章</h3>';

    const relatedList = document.createElement('div');
    relatedList.style.cssText = `
      display: grid;
      grid-template-columns: repeat(auto-fill, minmax(250px, 1fr));
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
          border: 1px solid var(--color-border);
          border-radius: 8px;
          text-decoration: none;
          color: var(--color-text);
          transition: all 0.2s;
        `;
        item.innerHTML = `
          <div style="font-weight:600; margin-bottom:6px;">${post.title}</div>
          <div style="font-size:12px; color:var(--color-text-secondary);">
            共同标签: ${post.commonTags.map(t => '#' + t).join(' ')}
          </div>
        `;
        item.addEventListener('mouseenter', () => {
          item.style.background = 'var(--color-hover, #f5f5f5)';
        });
        item.addEventListener('mouseleave', () => {
          item.style.background = 'transparent';
        });
        relatedList.appendChild(item);
      });
    } else {
      relatedList.innerHTML = '<div style="color:var(--color-text-secondary); padding:20px; text-align:center;">暂无相关文章</div>';
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

  // 渲染简单图谱
  function renderGraph(container, data) {
    const width = container.clientWidth - 40;
    const height = container.clientHeight - 40;
    const centerX = width / 2;
    const centerY = height / 2;
    const radius = Math.min(width, height) * 0.35;

    // 创建SVG
    const svg = document.createElementNS('http://www.w3.org/2000/svg', 'svg');
    svg.setAttribute('width', '100%');
    svg.setAttribute('height', '100%');
    container.appendChild(svg);

    // 绘制连接线
    data.links.forEach(link => {
      const sourceNode = data.nodes[link.source];
      const targetNode = data.nodes[link.target];

      // 计算位置
      const angle1 = (sourceNode.id / data.nodes.length) * 2 * Math.PI - Math.PI / 2;
      const angle2 = (targetNode.id / data.nodes.length) * 2 * Math.PI - Math.PI / 2;

      const x1 = centerX + Math.cos(angle1) * radius;
      const y1 = centerY + Math.sin(angle1) * radius;
      const x2 = centerX + Math.cos(angle2) * radius;
      const y2 = centerY + Math.sin(angle2) * radius;

      const line = document.createElementNS('http://www.w3.org/2000/svg', 'line');
      line.setAttribute('x1', x1);
      line.setAttribute('y1', y1);
      line.setAttribute('x2', x2);
      line.setAttribute('y2', y2);
      line.setAttribute('stroke', 'var(--color-border)');
      line.setAttribute('stroke-width', Math.max(1, link.tags.length * 0.5));
      line.setAttribute('opacity', '0.3');
      svg.appendChild(line);
    });

    // 绘制节点
    data.nodes.forEach((node, index) => {
      const angle = (index / data.nodes.length) * 2 * Math.PI - Math.PI / 2;
      const x = centerX + Math.cos(angle) * radius;
      const y = centerY + Math.sin(angle) * radius;
      const nodeRadius = node.isCurrent ? 18 : 12 + node.tags.length;

      const g = document.createElementNS('http://www.w3.org/2000/svg', 'g');
      g.style.cursor = node.isCurrent ? 'default' : 'pointer';
      g.style.transition = 'transform 0.2s';

      const circle = document.createElementNS('http://www.w3.org/2000/svg', 'circle');
      circle.setAttribute('cx', x);
      circle.setAttribute('cy', y);
      circle.setAttribute('r', nodeRadius);
      circle.setAttribute('fill', node.isCurrent ? 'var(--color-accent)' : `hsl(${200 + index * 30}, 70%, 60%)`);
      circle.setAttribute('stroke', 'white');
      circle.setAttribute('stroke-width', '2');
      g.appendChild(circle);

      // 标题
      if (node.isCurrent || node.tags.length <= 3) {
        const text = document.createElementNS('http://www.w3.org/2000/svg', 'text');
        text.setAttribute('x', x);
        text.setAttribute('y', y + nodeRadius + 14);
        text.setAttribute('text-anchor', 'middle');
        text.setAttribute('fill', 'var(--color-text)');
        text.setAttribute('font-size', '10');
        text.textContent = node.title.length > 12 ? node.title.substring(0, 12) + '...' : node.title;
        g.appendChild(text);
      }

      // 悬停效果
      if (!node.isCurrent) {
        g.addEventListener('mouseenter', () => {
          circle.setAttribute('r', nodeRadius * 1.2);
          circle.setAttribute('fill', 'var(--color-accent)');
        });

        g.addEventListener('mouseleave', () => {
          circle.setAttribute('r', nodeRadius);
          circle.setAttribute('fill', `hsl(${200 + index * 30}, 70%, 60%)`);
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
      background: var(--color-bg);
      border: 1px solid var(--color-border);
      border-radius: 4px;
      font-size: 12px;
      color: var(--color-text-secondary);
    `;
    legend.innerHTML = '🔵 当前文章 &nbsp; ⚪ 相关文章';
    container.appendChild(legend);
  }

  // 添加知识图谱按钮到文章标题下
  async function init() {
    console.log('Initializing knowledge graph feature...');

    // 只在文章页面执行
    if (!/\/\d{4}\/\d{2}\/\d{2}\//.test(window.location.pathname)) {
      console.log('Not a post page');
      return;
    }

    const posts = await fetchAllPosts();
    console.log('Loaded', posts.length, 'posts');

    if (posts.length === 0) {
      console.log('No posts found');
      return;
    }

    // 查找文章标题
    const postTitle = document.querySelector('.post-title');
    if (!postTitle) {
      console.log('Post title not found');
      return;
    }

    // 创建按钮
    const buttonContainer = document.createElement('div');
    buttonContainer.style.cssText = `
      margin: 15px 0;
      display: flex;
      align-items: center;
      gap: 10px;
      flex-wrap: wrap;
    `;

    const button = document.createElement('button');
    button.id = 'knowledge-graph-btn';
    button.innerHTML = '🕸️ 查看知识图谱';
    button.style.cssText = `
      display: inline-flex;
      align-items: center;
      gap: 6px;
      padding: 10px 20px;
      border-radius: 20px;
      background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
      color: white;
      border: none;
      cursor: pointer;
      font-size: 14px;
      font-weight: 500;
      box-shadow: 0 2px 8px rgba(102, 126, 234, 0.3);
      transition: all 0.3s ease;
    `;

    button.addEventListener('mouseenter', () => {
      button.style.transform = 'translateY(-2px)';
      button.style.boxShadow = '0 4px 12px rgba(102, 126, 234, 0.4)';
    });

    button.addEventListener('mouseleave', () => {
      button.style.transform = 'translateY(0)';
      button.style.boxShadow = '0 2px 8px rgba(102, 126, 234, 0.3)';
    });

    // 点击事件
    button.addEventListener('click', async () => {
      button.disabled = true;
      button.textContent = '⏳ 加载中...';

      const graphData = buildGraphData(posts, window.location.pathname);
      createGraphModal(posts, graphData);

      button.disabled = false;
      button.innerHTML = '🕸️ 查看知识图谱';
    });

    buttonContainer.appendChild(button);

    // 插入到 post-header 内部的 meta 信息后面
    const postHeader = document.querySelector('.post-header');
    if (postHeader) {
      postHeader.appendChild(buttonContainer);
    }

    console.log('✅ Knowledge graph button added');
  }

  // 初始化
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
  } else {
    setTimeout(init, 100);
  }

  console.log('=== Knowledge Graph Ready ===');
})();
