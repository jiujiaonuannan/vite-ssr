import express, { RequestHandler, Express } from 'express';
import React from 'react';
import fs from 'fs'
import path from 'path';
import { renderToString } from 'react-dom/server';
import { ViteDevServer } from 'vite';
import serve from 'serve-static';

const isProd = process.env.NODE_ENV === 'production';
const cwd = process.cwd();

async function loadSsrEntryModule(vite: ViteDevServer | null) {
  // 生产模式下直接 require 打包后的产物
  if (isProd) {
    const entryPath = path.join(cwd, 'dist/server/entry-server.js');
    return require(entryPath);
  } 
  // 开发环境下通过 no-bundle 方式加载
  else {
    const entryPath = path.join(cwd, 'src/entry-server.tsx');
    return vite!.ssrLoadModule(entryPath);
  }
}

function resolveTemplatePath() {
  return isProd ?
    path.join(cwd, 'dist/client/index.html') :
    path.join(cwd, 'index.html');
}

// 过滤出页面请求
function matchPageUrl(url: string) {
  if (url === '/') {
    return true;
  }
  return false;
}

async function createSsrMiddleware(app: Express): Promise<RequestHandler> {
  let vite: ViteDevServer | null = null;
  if (!isProd) { 
    vite = await (await import('vite')).createServer({
      root: process.cwd(),
      server: {
        middlewareMode: 'ssr',
      }
    })
    // 注册 Vite Middlewares
    // 主要用来处理客户端资源
    app.use(vite.middlewares);
  }
  return async (req, res, next) => {
    try {
      const url = req.originalUrl;
      if (!matchPageUrl(url)) {
        return await next();
      }
      // 1. 加载服务端入口组件模块
      const { ServerEntry, fetchData } = await loadSsrEntryModule(vite);
      // 2. 数据预取
      const data = await fetchData();
      // 3. 「核心」: 渲染服务端组件 -> 字符串
      performance.mark('render-start');
      const appHtml = renderToString(React.createElement(ServerEntry, { data }));
      performance.mark('render-end');
      performance.measure('renderToString', 'render-start', 'render-end');
      // console.log('renderToString 执行时间: ', renderTime.duration.toFixed(2), 'ms');
   
      // 4. 拼接完整 HTML 字符串，返回客户端
      const templatePath = resolveTemplatePath();
      let template = await fs.readFileSync(templatePath, 'utf-8');
      if (!isProd && vite) {
        template = await vite.transformIndexHtml(url, template);
      }
      const html = template
        .replace('<!-- SSR_APP -->', appHtml)
        .replace(
          '<!-- SSR_DATA -->',
          `<script>window.__SSR_DATA__=${JSON.stringify(data)}</script>`
        );
      // TODO: preload links
      res.status(200).setHeader('Content-Type', 'text/html').end(html);
    } catch (e: any) {
      vite?.ssrFixStacktrace(e);
      console.error(e);
      res.status(500).end(e.message);
    }
  };
}

async function createServer() {
  const app = express();
  // 加入 Vite SSR 中间件
  app.use(await createSsrMiddleware(app));

	 // 注册中间件，生产环境端处理客户端资源
	 if (isProd) {
    app.use(serve(path.join(cwd, 'dist/client')))
  }

  app.listen(3000, () => {
    console.log('Node 服务器已启动~')
    console.log('http://localhost:3000');
  });
}

createServer();
