/**
 * Wiki Links Plugin
 * 支持使用 [[文章名]] 格式创建内部链接
 */

// 在生成前构建标题-URL映射
hexo.extend.filter.register('before_generate', function() {
  const posts = this.locals.get('posts');
  const titleMap = new Map();

  posts.forEach(post => {
    const normalizedTitle = post.title.trim();
    titleMap.set(normalizedTitle, post.permalink);
  });

  // 将映射存储到全局对象
  hexo.wiki_links_titleMap = titleMap;

  console.log(`[Wiki Links] Built title map with ${titleMap.size} entries`);
}, 1);

hexo.extend.filter.register('before_post_render', function(data) {
  if (!data.content) return data;

  const titleMap = hexo.wiki_links_titleMap;

  if (!titleMap || titleMap.size === 0) {
    console.log('[Wiki Links] No title map available');
    return data;
  }

  // 匹配 [[文章名]] 格式
  const wikiLinkRegex = /\[\[([^\]]+)\]\]/g;
  let matchCount = 0;

  data.content = data.content.replace(wikiLinkRegex, (match, title) => {
    // 跳过纯数字的引用（如 [[1]], [[1,5]]）
    if (/^[\d\s,]+$/.test(title)) {
      return match;
    }

    matchCount++;
    const trimmedTitle = title.trim();
    const url = titleMap.get(trimmedTitle);

    if (url) {
      console.log(`[Wiki Links] Found link: [[${trimmedTitle}]] -> ${url}`);
      // 找到匹配的文章，直接生成 HTML
      return `<a href="${url}" class="wiki-link">${trimmedTitle}</a>`;
    } else {
      // 未找到匹配的文章
      console.warn(`[Wiki Links] Not found: [[${trimmedTitle}]]`);
      return match;
    }
  });

  if (matchCount > 0) {
    console.log(`[Wiki Links] Processed ${matchCount} wiki links in: ${data.title}`);
  }

  return data;
});
