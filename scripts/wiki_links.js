/**
 * Wiki Links Plugin
 * 支持使用 [[文章名]] 格式创建内部链接
 */

hexo.extend.filter.register('before_post_render', function(data) {
  if (!data.content) return data;

  // 获取所有文章的标题和URL映射
  const posts = this.locals.posts;
  const titleMap = new Map();

  posts.forEach(post => {
    // 使用标题作为键（去除可能的特殊字符）
    const normalizedTitle = post.title.trim();
    titleMap.set(normalizedTitle, post.permalink);
  });

  // 匹配 [[文章名]] 格式
  // 支持中英文标题，支持空格
  const wikiLinkRegex = /\[\[([^\]]+)\]\]/g;

  data.content = data.content.replace(wikiLinkRegex, function(match, title) {
    const trimmedTitle = title.trim();
    const url = titleMap.get(trimmedTitle);

    if (url) {
      // 找到匹配的文章，生成带样式的链接
      return `<a href="${url}" class="wiki-link">${trimmedTitle}</a>`;
    } else {
      // 未找到匹配的文章，保持原样但添加警告样式
      console.warn(`Wiki link not found: [[${trimmedTitle}]]`);
      return `<span class="wiki-link broken" title="未找到文章: ${trimmedTitle}">${trimmedTitle}</span>`;
    }
  });

  return data;
});
