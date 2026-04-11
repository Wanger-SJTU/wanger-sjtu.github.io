// 文章页面的知识图谱按钮和浮窗功能
console.log('=== Knowledge Graph Feature ===');

(function() {
  'use strict';

  // 从 HTML 内容中提取内部链接（双链引用）
  function extractPostLinksFromHTML(htmlContent, currentUrl) {
    const links = [];
    if (!htmlContent) return links;

    // 创建一个临时 DOM 元素来解析 HTML
    const tempDiv = document.createElement('div');
    tempDiv.innerHTML = htmlContent;

    // 查找所有 <a> 标签
    const anchorTags = tempDiv.querySelectorAll('a[href]');

    // 查找"相关阅读"部分
    const allHeadings = tempDiv.querySelectorAll('h2, h3');
    let relatedReadingSection = null;

    for (const heading of allHeadings) {
      if (heading.textContent.includes('相关阅读') || heading.textContent.includes('扩展阅读')) {
        relatedReadingSection = heading;
        break;
      }
    }

    if (relatedReadingSection) {
      // 获取"相关阅读"部分的所有链接
      let nextElement = relatedReadingSection.nextElementSibling;
      while (nextElement) {
        // 如果遇到下一个标题，停止
        if (nextElement.tagName.match(/^H[2-6]$/)) {
          break;
        }

        // 查找这个元素中的链接
        const anchors = nextElement.querySelectorAll('a[href]');
        anchors.forEach(anchor => {
          const href = anchor.getAttribute('href');
          if (href && !href.startsWith('http') && !href.startsWith('//')) {
            // 是内部链接
            links.push(href);
          }
        });

        nextElement = nextElement.nextElementSibling;
      }
    }

    return links;
  }

  // 获取所有文章数据（包括双链）
  async function fetchAllPosts() {
    try {
      const response = await fetch('/search.xml');
      const xmlText = await response.text();
      const parser = new DOMParser();
      const doc = parser.parseFromString(xmlText, 'text/xml');
      const entries = doc.querySelectorAll('entry');
      const posts = [];

      // 构建URL集合用于验证
      const allUrls = new Set();

      entries.forEach(entry => {
        const url = entry.querySelector('url');
        if (url) {
          allUrls.add(url.textContent.trim());
        }
      });

      entries.forEach(entry => {
        const title = entry.querySelector('title');
        const url = entry.querySelector('url');
        const tagsContainer = entry.querySelector('tags');
        const content = entry.querySelector('content');

        if (title && url) {
          // 解析标签：从嵌套的 <tag> 元素中提取
          const tags = [];
          if (tagsContainer) {
            const tagElements = tagsContainer.querySelectorAll('tag');
            tagElements.forEach(tagEl => {
              const tagName = tagEl.textContent.trim();
              if (tagName) {
                tags.push(tagName);
              }
            });
          }

          const urlText = url.textContent.trim();

          // 从 HTML 内容中提取双链引用
          const htmlContent = content ? content.textContent : '';
          const linkedPosts = extractPostLinksFromHTML(htmlContent, urlText);

          const postData = {
            title: title.textContent.trim(),
            url: urlText,
            tags: tags,
            linkedPosts: linkedPosts
          };

          posts.push(postData);
        }
      });

      // 验证并过滤链接
      console.log('🔗 Resolving post links...');
      posts.forEach(post => {
        if (post.linkedPosts && post.linkedPosts.length > 0) {
          // 过滤掉指向自己的链接和不存在的链接
          post.linkedPosts = post.linkedPosts.filter(linkUrl => {
            // 标准化 URL
            const normalizedLink = linkUrl.replace(/\/$/, '');
            const normalizedSelf = post.url.replace(/\/$/, '');

            // 不指向自己
            if (normalizedLink === normalizedSelf) {
              return false;
            }

            // 链接存在
            return allUrls.has(linkUrl) || allUrls.has(normalizedLink);
          });

          if (post.linkedPosts.length > 0) {
            console.log(`  ✅ ${post.title}: ${post.linkedPosts.length} links`);
          }
        }
      });
      console.log(`✅ Resolved links for ${posts.length} posts`);

      return posts;
    } catch (error) {
      console.error('Failed to fetch posts:', error);
      return [];
    }
  }

  // 构建图谱数据（显示所有文章及其关系）
  function buildGraphData(posts, currentUrl) {
    const currentNode = currentUrl.replace(/\/$/, '') || '/';
    const nodes = [];
    const links = [];
    const nodeMap = new Map();

    // 添加所有文章为节点
    posts.forEach((post, index) => {
      const url = post.url.replace(/\/$/, '');
      const isCurrent = url === currentNode || url === currentNode + 'index.html';

      nodeMap.set(url, {
        id: index,
        title: post.title,
        url: post.url,
        tags: post.tags || [],
        linkedPosts: post.linkedPosts || [],
        isCurrent: isCurrent
      });
      nodes.push(nodeMap.get(url));
    });

    // 1. 基于共同标签建立连接（任意两篇有共同标签的文章都连接）
    for (let i = 0; i < nodes.length; i++) {
      for (let j = i + 1; j < nodes.length; j++) {
        const commonTags = nodes[i].tags.filter(tag =>
          nodes[j].tags.includes(tag)
        );

        if (commonTags.length > 0) {
          links.push({
            source: i,
            target: j,
            type: 'tag',  // 标签连接
            tags: commonTags
          });
        }
      }
    }

    // 2. 基于双链引用建立连接
    const linkSet = new Set();  // 用于去重
    nodes.forEach((sourceNode, sourceIndex) => {
      if (sourceNode.linkedPosts && sourceNode.linkedPosts.length > 0) {
        sourceNode.linkedPosts.forEach(targetUrl => {
          // 查找目标文章
          const targetNode = nodes.find(n => {
            const nodeUrl = n.url.replace(/\/$/, '');
            // 尝试多种匹配方式
            return nodeUrl === targetUrl ||
                   nodeUrl === targetUrl.replace(/\/$/, '') ||
                   n.url === targetUrl ||
                   n.url === targetUrl + '/';
          });

          if (targetNode) {
            const targetIndex = targetNode.id;
            // 创建唯一的链接标识（避免重复）
            const linkId = [sourceIndex, targetIndex].sort().join('-');

            if (!linkSet.has(linkId)) {
              linkSet.add(linkId);
              links.push({
                source: sourceIndex,
                target: targetIndex,
                type: 'link',  // 双链连接
                tags: []
              });
            }
          }
        });
      }
    });

    console.log(`📊 Graph: ${nodes.length} nodes, ${links.length} links (${links.filter(l => l.type === 'tag').length} tag-based, ${links.filter(l => l.type === 'link').length} link-based)`);

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

    // 统计信息
    const stats = document.createElement('div');
    stats.style.cssText = `
      display: flex;
      gap: 20px;
      margin: 20px 0;
      font-size: 14px;
      color: ${isDarkMode ? '#b0b0b0' : '#666'};
      flex-wrap: wrap;
    `;

    const tagLinkCount = graphData.links.filter(l => l.type === 'tag').length;
    const directLinkCount = graphData.links.filter(l => l.type === 'link').length;

    stats.innerHTML = `
      <div>📊 <strong>${posts.length}</strong> 篇文章</div>
      <div>🔗 <strong>${graphData.links.length}</strong> 个关联</div>
      <div style="color: ${isDarkMode ? '#4ecdc4' : '#00b8b8'};">📎 <strong>${directLinkCount}</strong> 个双链</div>
      <div>🏷️ <strong>${tagLinkCount}</strong> 个标签关联</div>
    `;
    content.appendChild(stats);

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
        const isSource = graphData.nodes[link.source].url.replace(/\/$/, '') === currentNode;
        const relatedNode = isSource ? graphData.nodes[link.target] : graphData.nodes[link.source];
        return {
          ...relatedNode,
          linkType: link.type,
          commonTags: link.tags || []
        };
      })
      .sort((a, b) => {
        // 双链引用优先，然后按共同标签数量排序
        if (a.linkType === 'link' && b.linkType !== 'link') return -1;
        if (b.linkType === 'link' && a.linkType !== 'link') return 1;
        return b.commonTags.length - a.commonTags.length;
      })
      .slice(0, 8);

    if (relatedPosts.length > 0) {
      relatedPosts.forEach(post => {
        const item = document.createElement('a');
        item.href = post.url;
        item.setAttribute('data-related-item', 'true');
        const isDirectLink = post.linkType === 'link';

        item.style.cssText = `
          display: block;
          padding: 12px;
          border: 2px solid ${isDirectLink ? (isDarkMode ? 'rgba(78, 205, 196, 0.5)' : 'rgba(78, 205, 196, 0.5)') : (isDarkMode ? '#333' : '#e0e0e0')};
          border-radius: 8px;
          text-decoration: none;
          color: ${isDarkMode ? '#b0b0b0' : '#555'};
          transition: all 0.2s;
          background: ${isDarkMode ? '#252525' : '#f5f5f5'};
          ${isDirectLink ? 'box-shadow: 0 2px 8px rgba(78, 205, 196, 0.2);' : ''}
        `;

        const relationIcon = isDirectLink ? '📎' : '🏷️';
        const relationText = isDirectLink ? '双链引用' : `共同标签: ${post.commonTags.map(t => '#' + t).join(' ')}`;

        item.innerHTML = `
          <div style="font-weight:600; margin-bottom:6px; color:${isDarkMode ? '#e0e0e0' : '#333'};">
            ${relationIcon} ${post.title}
          </div>
          <div style="font-size:12px; color:${isDirectLink ? (isDarkMode ? '#4ecdc4' : '#00b8b8') : (isDarkMode ? '#888' : '#999')};">
            ${relationText}
          </div>
        `;
        item.addEventListener('mouseenter', () => {
          const currentDark = document.documentElement.getAttribute('data-theme') === 'dark';
          item.style.background = currentDark ? '#333' : '#e8e8e8';
          item.style.borderColor = isDirectLink ?
            (currentDark ? 'rgba(78, 205, 196, 0.8)' : 'rgba(78, 205, 196, 0.8)') :
            (currentDark ? '#555' : '#ccc');
        });
        item.addEventListener('mouseleave', () => {
          const currentDark = document.documentElement.getAttribute('data-theme') === 'dark';
          item.style.background = currentDark ? '#252525' : '#f5f5f5';
          item.style.borderColor = isDirectLink ?
            (currentDark ? 'rgba(78, 205, 196, 0.5)' : 'rgba(78, 205, 196, 0.5)') :
            (currentDark ? '#333' : '#e0e0e0');
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

    const edges = data.links.map(link => {
      const isTagLink = link.type === 'tag';
      const isDirectLink = link.type === 'link';

      // 双链连接使用更醒目的颜色和粗细
      if (isDirectLink) {
        return {
          from: link.source,
          to: link.target,
          title: '📎 双链引用',
          value: 3,  // 更粗的线
          color: {
            color: isDarkMode ? 'rgba(78, 205, 196, 0.6)' : 'rgba(78, 205, 196, 0.6)',
            highlight: isDarkMode ? 'rgba(78, 205, 196, 0.9)' : 'rgba(78, 205, 196, 0.9)',
            hover: isDarkMode ? 'rgba(78, 205, 196, 0.8)' : 'rgba(78, 205, 196, 0.8)'
          },
          width: 2.5,  // 固定粗细
          dashes: false  // 实线
        };
      }

      // 标签连接使用原来的样式
      return {
        from: link.source,
        to: link.target,
        title: '🏷️ 共同标签: ' + link.tags.join(', '),
        value: link.tags.length,
        color: {
          color: isDarkMode ? 'rgba(255, 255, 255, 0.15)' : 'rgba(0, 0, 0, 0.15)',
          highlight: isDarkMode ? 'rgba(255, 255, 255, 0.3)' : 'rgba(0, 0, 0, 0.3)',
          hover: isDarkMode ? 'rgba(255, 255, 255, 0.25)' : 'rgba(0, 0, 0, 0.25)'
        },
        width: Math.max(0.5, link.tags.length * 0.5),
        dashes: true  // 虚线
      };
    });

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
      top: 10px;
      right: 10px;
      padding: 10px 14px;
      background: ${isDarkMode ? '#1e1e1e' : '#fff'};
      border: 1px solid ${isDarkMode ? '#333' : '#e0e0e0'};
      border-radius: 6px;
      font-size: 12px;
      color: ${isDarkMode ? '#b0b0b0' : '#666'};
      z-index: 10;
      line-height: 1.6;
      max-width: 200px;
    `;
    legend.innerHTML = `
      <div style="margin-bottom: 4px; font-weight: 600;">📊 图谱说明</div>
      <div style="display: flex; align-items: center; gap: 8px;">
        <span style="display: inline-block; width: 12px; height: 12px; background: ${currentArticleColor}; border-radius: 50%;"></span>
        <span>当前文章</span>
      </div>
      <div style="display: flex; align-items: center; gap: 8px;">
        <span style="display: inline-block; width: 12px; height: 12px; background: #999; border-radius: 50%;"></span>
        <span>相关文章</span>
      </div>
      <div style="display: flex; align-items: center; gap: 8px; margin-top: 4px;">
        <span style="display: inline-block; width: 30px; height: 2px; background: rgba(78, 205, 196, 0.6);"></span>
        <span>📎 双链引用</span>
      </div>
      <div style="display: flex; align-items: center; gap: 8px;">
        <span style="display: inline-block; width: 30px; height: 2px; background: ${isDarkMode ? 'rgba(255, 255, 255, 0.3)' : 'rgba(0, 0, 0, 0.3)'}; border-bottom: 1px dashed ${isDarkMode ? '#fff' : '#000'};"></span>
        <span>🏷️ 共同标签</span>
      </div>
    `;
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
