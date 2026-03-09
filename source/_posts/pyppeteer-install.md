---
title: 国内环境配置pyppeteer
tags:
  - python
category:
  - python
date: 2024-03-29 20:49:25
---

## 前言
pyppeteer 是 puppeteer 的 python 版本，实现了大部分接口，因为使用了异步await等关键字，需要 python3.6+，具体作用自行百度。

因初次运行默认需要从国外下载 chromium 到指定路径，不适合国内，所以写了这篇文章方便小伙伴们在国内进行配置。

附上官方文档，英语好的小伙伴们可自行配置。

windows下的安装和配置

1、使用豆瓣源安装pyppeteer：

```bash
pip install -i https://pypi.douban.com/simple/ pyppeteer
```
2、添加环境变量，更改下载 chromium 的来源网站和执行路径：
```bash
PYPPETEER_DOWNLOAD_HOST，对应值为http://npm.taobao.org/mirrors
```

也可以在`import pyppeteer`之前在代码中设置
```python
import os
os.environ["PYPPETEER_DOWNLOAD_HOST"] = "http://npm.taobao.org/mirrors"
```
3、在cmd终端进入 python/ipython 环境，执行以下代码查看：
```python
import pyppeteer
# chromium执行目录
pyppeteer.chromium_downloader.chromiumExecutable.get('win64')
# 下载chromium的url地址
pyppeteer.chromium_downloader.downloadURLs.get('win64')
```
正常情况下这里会打印出执行目录的地址和下载地址。

用下面的代码测试的话也会自动下载对应的浏览器文件。
```python
import asyncio
from pyppeteer import launch

async def main():
    browser = await launch()
    page = await browser.newPage()
    await page.goto('https://www.baidu.com/')
    await page.screenshot({'path': 'baidu.png'})
    await browser.close()


asyncio.get_event_loop().run_until_complete(main())
```

但是实际并非如此，由于python包中的版本与实际镜像的版本偶尔会出现不一致的情况，会下载失败。
这时候可以看下远程镜像的归档有哪些版本，自己在代码中改成对应的即可。


https://registry.npmmirror.com/binary.html?path=chromium-browser-snapshots/Win_x64/