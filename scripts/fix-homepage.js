const fs = require('fs');
const path = require('path');

const publicDir = path.join(__dirname, '..', 'public');
const indexPath = path.join(publicDir, 'index.html');

// 创建首页重定向
const content = `<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8">
  <title>鎭二的数字花园</title>
  <meta http-equiv="refresh" content="0; url=/archives/">
  <script>window.location.href='/archives/';</script>
</head>
<body>
  <p>正在跳转到归档页面...</p>
  <p>如果页面没有自动跳转，请<a href="/archives/">点击这里</a>。</p>
</body>
</html>
`;

fs.writeFileSync(indexPath, content);
console.log('Homepage redirect created successfully');
