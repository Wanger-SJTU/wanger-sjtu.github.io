// 知识图谱功能
(function() {
  // 获取所有文章数据
  function getAllPosts() {
    const posts = [];
    const postElements = document.querySelectorAll('.post-card, .post-item');

    postElements.forEach(el => {
      const link = el.querySelector('a');
      const title = el.querySelector('.post-title, h1, h2, h3');
      const tags = el.querySelectorAll('.post-tags .tag');

      if (link && title) {
        const tagList = Array.from(tags).map(tag => tag.textContent.replace('#', ''));
        posts.push({
          url: link.getAttribute('href'),
          title: title.textContent.trim(),
          tags: tagList
        });
      }
    });

    return posts;
  }

  // 构建图谱数据
  function buildGraphData(posts) {
    const nodes = new Map();
    const links = [];

    // 添加文章节点
    posts.forEach(post => {
      nodes.set(post.url, {
        id: post.url,
        label: post.title,
        type: 'post',
        tags: post.tags,
        size: post.tags.length + 1
      });
    });

    // 添加标签节点并建立连接
    posts.forEach(post => {
      post.tags.forEach(tag => {
        const tagId = 'tag-' + tag;

        // 如果标签节点不存在，添加它
        if (!nodes.has(tagId)) {
          nodes.set(tagId, {
            id: tagId,
            label: '#' + tag,
            type: 'tag',
            size: 1
          });
        }

        // 建立文章和标签的连接
        links.push({
          source: post.url,
          target: tagId,
          type: 'tag',
          value: 1
        });
      });
    });

    // 创建URL映射用于wiki链接查找
    const urlToPost = new Map();
    posts.forEach(post => {
      urlToPost.set(post.url, post);
      // 也支持不带末尾斜杠的URL
      const urlWithoutSlash = post.url.replace(/\/$/, '');
      urlToPost.set(urlWithoutSlash, post);
    });

    // 添加文章之间的wiki链接连接
    posts.forEach(post => {
      if (!post.content) return;

      // 解析文章内容中的wiki链接 [[链接]]
      const wikiLinkRegex = /\[\[([^\]]+)\]\]/g;
      let match;

      while ((match = wikiLinkRegex.exec(post.content)) !== null) {
        const linkText = match[1];

        // 尝试找到对应的文章
        // 方法1: 直接URL匹配
        let targetPost = urlToPost.get(linkText);
        // 方法2: 标题匹配
        if (!targetPost) {
          targetPost = posts.find(p => p.title === linkText);
        }
        // 方法3: URL部分匹配
        if (!targetPost) {
          targetPost = posts.find(p => p.url.includes(linkText));
        }

        if (targetPost && targetPost.url !== post.url) {
          // 检查是否已经存在连接
          const linkExists = links.some(l =>
            (l.source === post.url && l.target === targetPost.url && l.type === 'wiki') ||
            (l.source === targetPost.url && l.target === post.url && l.type === 'wiki')
          );

          if (!linkExists) {
            links.push({
              source: post.url,
              target: targetPost.url,
              type: 'wiki',
              value: 1
            });
          }
        }
      }
    });

    return {
      nodes: Array.from(nodes.values()),
      links: links
    };
  }

  // 渲染图谱
  function renderGraph(container, data, currentNode) {
    const width = container.clientWidth - 40;
    const height = Math.min(600, window.innerHeight * 0.7);

    // 清空容器
    container.innerHTML = '';

    // 创建SVG
    const svg = document.createElementNS('http://www.w3.org/2000/svg', 'svg');
    svg.setAttribute('width', width);
    svg.setAttribute('height', height);
    svg.style.position = 'relative';
    container.appendChild(svg);

    // 创建节点位置映射
    const nodePositions = new Map();
    const centerX = width / 2;
    const centerY = height / 2;
    const radius = Math.min(width, height) * 0.35;

    // 计算节点位置（圆形布局）
    data.nodes.forEach((node, i) => {
      const angle = (i / data.nodes.length) * 2 * Math.PI - Math.PI / 2;
      const isCurrent = node.id === currentNode;
      const isTag = node.type === 'tag';

      // 标签节点更小，文章节点根据标签数量调整大小
      const nodeRadius = isCurrent ? 20 : (isTag ? 8 : 12 + node.size * 2);

      nodePositions.set(node.id, {
        x: centerX + Math.cos(angle) * radius * (isCurrent ? 0.3 : 1),
        y: centerY + Math.sin(angle) * radius * (isCurrent ? 0.3 : 1),
        radius: nodeRadius,
        isCurrent: isCurrent,
        isTag: isTag
      });
    });

    // 绘制连接线
    const linksGroup = document.createElementNS('http://www.w3.org/2000/svg', 'g');
    svg.appendChild(linksGroup);

    data.links.forEach(link => {
      const source = nodePositions.get(link.source);
      const target = nodePositions.get(link.target);

      if (source && target) {
        const line = document.createElementNS('http://www.w3.org/2000/svg', 'line');
        line.setAttribute('x1', source.x);
        line.setAttribute('y1', source.y);
        line.setAttribute('x2', target.x);
        line.setAttribute('y2', target.y);

        // 根据连接类型设置不同的样式
        if (link.type === 'wiki') {
          // wiki链接使用更明显的样式
          line.setAttribute('stroke', 'var(--color-accent)');
          line.setAttribute('stroke-width', '2');
          line.setAttribute('opacity', '0.6');
          line.setAttribute('stroke-dasharray', '5,5'); // 虚线
          line.dataset.linkType = 'wiki'; // 存储类型用于恢复
        } else {
          // 标签连接使用普通样式
          line.setAttribute('stroke', 'var(--color-border)');
          line.setAttribute('stroke-width', '1');
          line.setAttribute('opacity', '0.3');
          line.dataset.linkType = 'tag'; // 存储类型用于恢复
        }

        linksGroup.appendChild(line);
      }
    });

    // 绘制节点
    data.nodes.forEach(node => {
      const pos = nodePositions.get(node.id);
      if (!pos) return;

      const g = document.createElementNS('http://www.w3.org/2000/svg', 'g');
      g.style.cursor = 'pointer';
      g.style.transition = 'transform 0.2s';

      // 节点圆圈
      const circle = document.createElementNS('http://www.w3.org/2000/svg', 'circle');
      circle.setAttribute('cx', pos.x);
      circle.setAttribute('cy', pos.y);
      circle.setAttribute('r', pos.radius);

      // 根据节点类型设置颜色
      if (pos.isTag) {
        circle.setAttribute('fill', 'var(--color-text-secondary)');
        circle.setAttribute('opacity', '0.6');
        circle.setAttribute('stroke', 'var(--color-text-secondary)');
      } else {
        circle.setAttribute('fill', pos.isCurrent ? 'var(--color-accent)' :
          `hsl(${Math.random() * 360}, 70%, 60%)`);
        circle.setAttribute('opacity', pos.isCurrent ? '1' : '0.8');
        circle.setAttribute('stroke', pos.isCurrent ? 'var(--color-accent)' : 'white');
      }
      circle.setAttribute('stroke-width', '2');
      g.appendChild(circle);

      // 节点标签（始终显示）
      const text = document.createElementNS('http://www.w3.org/2000/svg', 'text');
      text.setAttribute('x', pos.x);
      text.setAttribute('y', pos.y + pos.radius + 15);
      text.setAttribute('text-anchor', 'middle');
      text.setAttribute('fill', pos.isTag ? 'var(--color-text-secondary)' : 'var(--color-text)');
      text.setAttribute('font-size', pos.isTag ? '10' : '11');
      text.style.opacity = '1';
      text.style.pointerEvents = 'none';

      // 标签节点显示完整标签名，文章节点截断
      if (pos.isTag) {
        text.textContent = node.label;
      } else {
        text.textContent = node.label.length > 15 ?
          node.label.substring(0, 15) + '...' : node.label;
      }
      g.appendChild(text);

      // 鼠标事件
      g.addEventListener('mouseenter', () => {
        circle.setAttribute('fill', 'var(--color-accent)');
        circle.setAttribute('r', pos.radius * 1.2);
        text.style.opacity = '1';

        // 高亮相关连接
        linksGroup.querySelectorAll('line').forEach(line => {
          const x1 = parseFloat(line.getAttribute('x1'));
          const y1 = parseFloat(line.getAttribute('y1'));
          const x2 = parseFloat(line.getAttribute('x2'));
          const y2 = parseFloat(line.getAttribute('y2'));

          if ((x1 === pos.x && y1 === pos.y) || (x2 === pos.x && y2 === pos.y)) {
            line.setAttribute('stroke', 'var(--color-accent)');
            line.setAttribute('opacity', '0.8');
          } else {
            line.setAttribute('opacity', '0.1');
          }
        });
      });

      g.addEventListener('mouseleave', () => {
        if (!pos.isCurrent) {
          if (pos.isTag) {
            circle.setAttribute('fill', 'var(--color-text-secondary)');
          } else {
            circle.setAttribute('fill', `hsl(${Math.random() * 360}, 70%, 60%)`);
          }
        }
        circle.setAttribute('r', pos.radius);

        // 恢复所有连接
        linksGroup.querySelectorAll('line').forEach(line => {
          const linkType = line.dataset.linkType || 'tag';
          if (linkType === 'wiki') {
            line.setAttribute('stroke', 'var(--color-accent)');
            line.setAttribute('stroke-width', '2');
            line.setAttribute('opacity', '0.6');
          } else {
            line.setAttribute('stroke', 'var(--color-border)');
            line.setAttribute('stroke-width', '1');
            line.setAttribute('opacity', '0.3');
          }
        });
      });

      // 点击跳转（仅文章节点可点击）
      g.addEventListener('click', () => {
        if (!pos.isTag && node.id !== currentNode) {
          window.location.href = node.id;
        }
      });

      svg.appendChild(g);
    });

    // 添加图例
    const legend = document.createElement('div');
    legend.style.cssText = `
      position: absolute;
      bottom: 10px;
      left: 10px;
      padding: 10px;
      background: var(--color-bg);
      border: 1px solid var(--color-border);
      border-radius: 4px;
      font-size: 12px;
    `;
    legend.innerHTML = `
      <div style="margin-bottom: 5px; font-weight: 600;">图谱说明</div>
      <div>🔵 当前文章</div>
      <div>🟣 其他文章</div>
      <div>⚫ 标签</div>
      <div>━━ 文章-标签关联</div>
      <div>┄┄ Wiki双链</div>
    `;
    container.appendChild(legend);
  }

  // 创建图谱浮窗
  function createGraphModal(posts, graphData, currentNode) {
    // 移除已存在的浮窗
    const existingModal = document.getElementById('graph-modal');
    if (existingModal) {
      existingModal.remove();
    }

    // 创建浮窗
    const modal = document.createElement('div');
    modal.id = 'graph-modal';
    modal.style.cssText = `
      position: fixed;
      top: 0;
      left: 0;
      right: 0;
      bottom: 0;
      background: rgba(0, 0, 0, 0.5);
      display: none;
      justify-content: center;
      align-items: center;
      z-index: 10000;
    `;

    // 创建内容容器
    const content = document.createElement('div');
    content.className = 'graph-modal-content';
    content.style.cssText = `
      background: var(--color-bg);
      border-radius: 8px;
      padding: 24px;
      max-width: 90vw;
      max-height: 90vh;
      overflow: auto;
      position: relative;
      box-shadow: 0 4px 20px rgba(0, 0, 0, 0.3);
    `;

    // 标题栏
    const header = document.createElement('div');
    header.style.cssText = `
      display: flex;
      justify-content: space-between;
      align-items: center;
      margin-bottom: 20px;
      padding-bottom: 10px;
      border-bottom: 1px solid var(--color-border);
    `;

    const title = document.createElement('h2');
    title.textContent = '知识图谱';
    title.style.margin = '0';
    title.style.fontSize = '1.5rem';

    const closeBtn = document.createElement('button');
    closeBtn.innerHTML = '×';
    closeBtn.style.cssText = `
      background: none;
      border: none;
      font-size: 28px;
      cursor: pointer;
      padding: 0;
      line-height: 1;
      color: var(--color-text);
    `;

    header.appendChild(title);
    header.appendChild(closeBtn);
    content.appendChild(header);

    // 统计信息
    const tagCount = graphData.nodes.filter(n => n.type === 'tag').length;
    const postCount = graphData.nodes.filter(n => n.type === 'post').length;

    const stats = document.createElement('div');
    stats.style.cssText = `
      display: flex;
      gap: 20px;
      margin-bottom: 20px;
      font-size: 14px;
    `;
    stats.innerHTML = `
      <div>📊 <strong>${postCount}</strong> 篇文章</div>
      <div>🏷️ <strong>${tagCount}</strong> 个标签</div>
      <div>🔗 <strong>${graphData.links.length}</strong> 个关联</div>
    `;
    content.appendChild(stats);

    // 图谱容器
    const graphContainer = document.createElement('div');
    graphContainer.id = 'graph-container';
    graphContainer.style.cssText = `
      width: 100%;
      height: 600px;
      border: 1px solid var(--color-border);
      border-radius: 4px;
      background: var(--color-bg-alt, #f5f5f5);
      position: relative;
      overflow: hidden;
    `;
    content.appendChild(graphContainer);

    // 相关文章列表
    const relatedSection = document.createElement('div');
    relatedSection.style.cssText = `
      margin-top: 20px;
    `;
    relatedSection.innerHTML = '<h3 style="margin-bottom: 10px;">相关文章</h3>';

    const relatedList = document.createElement('div');
    relatedList.style.cssText = `
      display: grid;
      gap: 10px;
      max-height: 200px;
      overflow-y: auto;
    `;

    // 找出与当前文章相关的文章（通过共同标签）
    const currentPost = graphData.nodes.find(n => n.id === currentNode);
    const relatedPosts = [];

    if (currentPost && currentPost.tags) {
      // 找到所有包含当前文章标签的其他文章
      graphData.nodes
        .filter(node => node.type === 'post' && node.id !== currentNode)
        .forEach(node => {
          const commonTags = currentPost.tags.filter(tag =>
            node.tags && node.tags.includes(tag)
          );

          if (commonTags.length > 0) {
            relatedPosts.push({
              ...node,
              commonTags: commonTags
            });
          }
        });

      // 按共同标签数量排序
      relatedPosts.sort((a, b) => b.commonTags.length - a.commonTags.length);
    }

    if (relatedPosts.length > 0) {
      relatedPosts.forEach(post => {
        const item = document.createElement('div');
        item.style.cssText = `
          padding: 10px;
          border: 1px solid var(--color-border);
          border-radius: 4px;
          cursor: pointer;
          transition: all 0.2s;
        `;
        item.innerHTML = `
          <div style="font-weight: 600; margin-bottom: 4px;">${post.label}</div>
          <div style="font-size: 12px; color: var(--color-text-secondary);">
            共同标签: ${post.commonTags.map(t => '#' + t).join(' ')}
          </div>
        `;
        item.addEventListener('mouseenter', () => {
          item.style.background = 'var(--color-bg-alt, #f5f5f5)';
        });
        item.addEventListener('mouseleave', () => {
          item.style.background = 'transparent';
        });
        item.addEventListener('click', () => {
          window.location.href = post.id;
        });
        relatedList.appendChild(item);
      });
    } else {
      relatedList.innerHTML = '<div style="color: var(--color-text-secondary);">暂无相关文章</div>';
    }

    relatedSection.appendChild(relatedList);
    content.appendChild(relatedSection);

    modal.appendChild(content);
    document.body.appendChild(modal);

    // 渲染图谱
    renderGraph(graphContainer, graphData, currentNode);

    // 关闭事件
    closeBtn.addEventListener('click', () => {
      modal.style.display = 'none';
    });

    modal.addEventListener('click', (e) => {
      if (e.target === modal) {
        modal.style.display = 'none';
      }
    });

    // ESC键关闭
    document.addEventListener('keydown', function escHandler(e) {
      if (e.key === 'Escape' && modal.style.display === 'flex') {
        modal.style.display = 'none';
      }
    });

    return modal;
  }

  // 初始化
  function init() {
    // 等待页面加载完成
    if (document.readyState === 'loading') {
      document.addEventListener('DOMContentLoaded', init);
      return;
    }

    // 只在文章页面添加图谱按钮
    if (!document.querySelector('.post-page, .post-content, article')) {
      console.log('Graph view: Not a post page, skipping');
      return;
    }

    // 获取当前文章URL
    const currentNode = window.location.pathname.replace(/\/$/, '') || '/';

    // 获取所有文章数据
    fetch('/search.xml')
      .then(response => response.text())
      .then(xml => {
        const parser = new DOMParser();
        const doc = parser.parseFromString(xml, 'text/xml');
        const entries = doc.querySelectorAll('entry');
        const posts = [];

        entries.forEach(entry => {
          const title = entry.querySelector('title').textContent;
          const url = entry.querySelector('url').textContent;
          const tagsEl = entry.querySelector('tags');
          const tags = tagsEl ? tagsEl.textContent.split(',').filter(t => t) : [];
          const content = entry.querySelector('content')?.textContent || '';

          posts.push({ url, title, tags, content });
        });

        return posts;
      })
      .then(posts => {
        console.log('Graph view: Loaded', posts.length, 'posts');

        if (!posts || posts.length === 0) {
          console.log('Graph view: No posts found');
          return;
        }

        // 构建图谱数据
        const graphData = buildGraphData(posts);
        console.log('Graph view: Built graph with', graphData.nodes.length, 'nodes and', graphData.links.length, 'links');

        // 创建图谱按钮
        const graphBtn = document.createElement('button');
        graphBtn.className = 'graph-toggle-btn';
        graphBtn.innerHTML = '🕸️';
        graphBtn.title = '查看知识图谱';
        graphBtn.style.cssText = `
          position: fixed;
          top: 100px;
          right: 20px;
          width: 44px;
          height: 44px;
          border-radius: 50%;
          background: var(--color-bg);
          border: 2px solid var(--color-border);
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
          graphBtn.style.right = '20px';
        }

        graphBtn.addEventListener('mouseenter', () => {
          graphBtn.style.background = 'var(--color-accent)';
          graphBtn.style.transform = 'scale(1.1)';
        });

        graphBtn.addEventListener('mouseleave', () => {
          graphBtn.style.background = 'var(--color-bg)';
          graphBtn.style.transform = 'scale(1)';
        });

        graphBtn.addEventListener('click', () => {
          const modal = createGraphModal(posts, graphData, currentNode);
          modal.style.display = 'flex';
        });

        document.body.appendChild(graphBtn);
        console.log('Graph view: Button added to page');
      })
      .catch(err => {
        console.error('Failed to load graph data:', err);
      });
  }

  init();
})();
