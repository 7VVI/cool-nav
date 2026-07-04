// server/routes/share.js
import { Router } from 'express';
import { marked } from 'marked';
import { sharedDocOps } from '../database.js';

const router = Router();

marked.setOptions({ breaks: true, gfm: true });

function escapeHtml(s) {
  return String(s)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

const NOT_FOUND_HTML = `<!DOCTYPE html>
<html lang="zh-CN">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>文档不存在</title>
<style>
  body { font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif; display: flex; align-items: center; justify-content: center; min-height: 100vh; margin: 0; background: #fafafa; color: #737373; }
  .box { text-align: center; }
  .code { font-size: 64px; font-weight: 200; color: #d4d4d4; margin-bottom: 8px; }
  p { font-size: 14px; }
  @media (prefers-color-scheme: dark) { body { background: #0a0a0a; color: #525252; } .code { color: #262626; } }
</style>
</head>
<body><div class="box"><div class="code">404</div><p>文档不存在或已删除</p></div></body>
</html>`;

const MD_TEMPLATE = (title, body) => `<!DOCTYPE html>
<html lang="zh-CN">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>${title}</title>
<style>
  :root { --bg: #ffffff; --fg: #1a1a1a; --muted: #6b7280; --border: #e5e7eb; --code-bg: #f3f4f6; }
  @media (prefers-color-scheme: dark) {
    :root { --bg: #0a0a0a; --fg: #e5e5e5; --muted: #9ca3af; --border: #1f2937; --code-bg: #1f2937; }
  }
  * { box-sizing: border-box; }
  body { font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', 'PingFang SC', 'Hiragino Sans GB', sans-serif; background: var(--bg); color: var(--fg); margin: 0; padding: 40px 20px; line-height: 1.7; -webkit-font-smoothing: antialiased; }
  .container { max-width: 800px; margin: 0 auto; }
  h1, h2, h3, h4, h5, h6 { line-height: 1.3; margin-top: 1.5em; margin-bottom: 0.5em; font-weight: 600; }
  h1 { font-size: 2em; border-bottom: 1px solid var(--border); padding-bottom: 0.3em; margin-top: 0; }
  h2 { font-size: 1.5em; border-bottom: 1px solid var(--border); padding-bottom: 0.3em; }
  h3 { font-size: 1.25em; }
  p { margin: 0.8em 0; }
  a { color: #2563eb; text-decoration: none; }
  a:hover { text-decoration: underline; }
  ul, ol { padding-left: 2em; }
  li { margin: 0.3em 0; }
  code { background: var(--code-bg); padding: 2px 6px; border-radius: 4px; font-family: 'SF Mono', Menlo, Consolas, monospace; font-size: 0.9em; }
  pre { background: var(--code-bg); padding: 16px; border-radius: 8px; overflow-x: auto; }
  pre code { background: none; padding: 0; }
  blockquote { border-left: 3px solid var(--border); padding-left: 1em; color: var(--muted); margin: 1em 0; }
  table { border-collapse: collapse; width: 100%; }
  th, td { border: 1px solid var(--border); padding: 8px 12px; text-align: left; }
  th { background: var(--code-bg); font-weight: 600; }
  img { max-width: 100%; }
  hr { border: none; border-top: 1px solid var(--border); margin: 2em 0; }
</style>
</head>
<body><div class="container">${body}</div></body>
</html>`;

router.get('/s/:code', (req, res) => {
  const doc = sharedDocOps.getByCode(req.params.code);
  if (!doc) {
    return res.status(404).type('html').send(NOT_FOUND_HTML);
  }

  // 同步自增访问数（better-sqlite3 无异步 API），失败静默不阻塞响应
  try { sharedDocOps.incrementViews(doc.id); } catch (e) { /* ignore */ }

  res.set('Cache-Control', 'no-store');

  if (doc.content_type === 'html') {
    return res.type('html').send(doc.content);
  }
  if (doc.content_type !== 'md') {
    return res.status(404).type('html').send(NOT_FOUND_HTML);
  }
  // md
  try {
    const body = marked.parse(doc.content);
    return res.type('html').send(MD_TEMPLATE(escapeHtml(doc.name), body));
  } catch (e) {
    console.error('Markdown render failed:', e);
    return res.status(500).type('html').send('<!DOCTYPE html><html lang="zh-CN"><head><meta charset="utf-8"><title>渲染失败</title></head><body style="font-family:sans-serif;display:flex;align-items:center;justify-content:center;min-height:100vh;margin:0;background:#fafafa;color:#737373;"><div style="text-align:center;"><p style="font-size:14px;">文档渲染失败</p></div></body></html>');
  }
});

export default router;
