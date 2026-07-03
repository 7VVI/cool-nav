# 短链文档分享功能设计

**日期**: 2026-07-03
**状态**: 已批准，待实现
**变更范围**: 替换现有「服务链路」页面，新增 HTML/MD 文档短链分享功能

---

## 背景与目标

当前项目存在「服务链路」(`chain`) 页面用于服务依赖可视化编辑。用户希望移除该页面，替换为一个新的功能页：

- 用户上传 HTML 或 MD 文档（或直接粘贴文本）
- 系统为每份文档生成一个短链接
- 任何人拿到短链即可在浏览器中预览文档内容（无需登录）

核心诉求：**点击短链即可预览**。

---

## 决策记录

| 决策项 | 选择 | 理由 |
|---|---|---|
| 访问模型 | 公开访问（无需登录） | 便于分享给外部同事/客户 |
| 文件存储 | SQLite 数据库 | 与现有架构一致、备份简单、HTML/MD 体量小 |
| 管理功能 | 上传 + 列表管理 | 体验完整但不臃肿；不含图表统计 |
| 上传方式 | 文件上传 + 粘贴文本 | 兼顾正式文档与临时记录 |
| MD 预览 | 服务端渲染（marked） | 访客零 JS 负担、链接预览友好 |
| 整体架构 | 混合（方案 C） | 管理走 SPA，预览走独立 HTML |

---

## §1. URL 与路由

| 路径 | 方法 | 鉴权 | 用途 |
|---|---|---|---|
| `/s/:code` | GET | **公开** | 预览页（服务端直接返回完整 HTML 文档） |
| `/api/docs` | GET | 需登录 | 列出已上传文档 |
| `/api/docs` | POST | 需登录 | 上传新文档（文件或粘贴文本） |
| `/api/docs/:id` | DELETE | 需登录 | 删除文档 |

**短链格式**: `{origin}/s/{code}`
- `code` 为 6 位 base62（`[A-Za-z0-9]`），约 568 亿组合
- 生成时检查碰撞，碰撞则重生成（最多 5 次）

**SPA 路由**: dashboard 内 `currentPage` 状态切换 tab，将 `'chain'` 替换为 `'docs'`。

---

## §2. 数据模型

新建表 `shared_docs`：

```sql
CREATE TABLE IF NOT EXISTS shared_docs (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  code TEXT NOT NULL UNIQUE,              -- 短链码，6 位 base62
  name TEXT NOT NULL,                     -- 显示名（文件名或粘贴时输入的标题）
  content TEXT NOT NULL,                  -- 文件正文
  content_type TEXT NOT NULL,             -- 'html' | 'md'
  size_bytes INTEGER NOT NULL DEFAULT 0,  -- 内容字节数
  views INTEGER NOT NULL DEFAULT 0,       -- 访问次数
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
);
CREATE INDEX IF NOT EXISTS idx_shared_docs_code ON shared_docs(code);
CREATE INDEX IF NOT EXISTS idx_shared_docs_created ON shared_docs(created_at DESC);
```

- 不绑定用户 ID（项目当前为单 admin 模型，与现有 `todos` / `groups` 表一致）
- 不设过期时间（YAGNI）
- `code` 唯一索引保证碰撞检测

`sharedDocOps` 暴露：`getAll / getByCode / create / delete / incrementViews`。

---

## §3. 后端实现

### 新文件

**`server/routes/docs.js`** — 管理接口（走 `authMiddleware`）

- `POST /api/docs`
  - body: `{ name, content, content_type }`，`content_type ∈ ['html','md']`
  - 生成 `code`、写入 DB、返回 `{ id, code, url, name, content_type, size_bytes, created_at }`
  - `url` 字段由后端拼装：`${req.protocol}://${req.get('host')}/s/${code}`
  - 校验：`content.length ≤ 2MB`（413）；`name` 非空（兜底 `未命名文档.{ext}`）；`content_type` 合法
- `GET /api/docs`
  - 返回列表 `[{ id, code, url, name, content_type, size_bytes, views, created_at }]`，按 `created_at DESC`
  - `url` 字段同样由后端拼装后返回
  - **不返回 `content`**（避免大 payload）
- `DELETE /api/docs/:id`
  - 删除文档

**`server/routes/share.js`** — 公开预览（不走 `authMiddleware`）

- `GET /s/:code`
  1. 查 DB → 找不到返回 404 HTML 页面
  2. 异步自增 `views`（不阻塞响应、失败静默）
  3. 根据 `content_type` 拼 HTML：
     - `html`: 直接返回原始 `content`，`Content-Type: text/html`
     - `md`: `marked(content)` → 包一层简洁阅读模板（白底、最大宽度 800px、系统字体、暗色支持 via `prefers-color-scheme`）→ 返回 `text/html`
  4. `Cache-Control: no-store`

### 修改 `server/index.js`

- 新增 `app.use('/api/docs', authMiddleware, docsRouter)`
- 新增 `app.use('/', shareRouter)` —— **必须在 SPA 回退 `app.get('*')` 之前注册**，否则 `/s/:code` 会被吞
- 移除 `app.use('/api/chains', authMiddleware, chainsRouter)` 与对应 import

### 修改 `server/database.js`

- 新增 `shared_docs` 建表
- 新增 `sharedDocOps`
- 移除 `chainOps`（链路表保留不删，避免破坏数据；只移除代码入口）

### MD 渲染

复用项目已依赖的 `marked`，配置 `breaks: true, gfm: true`（与 todos 一致）。

---

## §4. 前端实现

### 新文件

**`src/api/docs.ts`** — 复用 `request.ts` axios 实例

```ts
list()          → GET    /api/docs
create(payload) → POST   /api/docs  { name, content, content_type }
remove(id)      → DELETE /api/docs/:id
```

**`src/stores/docStore.ts`** — Pinia store（参照 `todoStore.ts`）
- state: `docs: SharedDoc[]`, `loading: boolean`
- actions: `fetchDocs`, `addDoc`, `removeDoc`

**`src/types/index.ts`** 追加：
```ts
interface SharedDoc {
  id: number; code: string; url: string; name: string;
  content_type: 'html' | 'md'; size_bytes: number;
  views: number; created_at: string;
}
```

**`src/components/share/DocShare.vue`** — 新页主组件（替换 `ServiceChain.vue` 的位置）

页面结构（参考 todos 页面风格）：

- 顶部工具栏：`[+ 新建文档]` + 类型筛选（全部 / HTML / MD）
- 新建 Modal：
  - Tab 切换 `[上传文件] [粘贴文本]`
  - 上传：拖拽/点击 `.html/.md/.htm`
  - 粘贴：标题输入 + 类型选择 + 大文本框
  - 操作按钮 `[取消] [生成短链]`
- 文档列表（卡片网格，复用 `cards-grid` 样式）：
  - 文件名、类型徽章、字节数、访问次数、创建时间
  - 操作：`[复制链接]` `[打开]` `[×]`

### 修改 `src/views/dashboard/index.vue`

- `currentPage` 类型从 `'services' | 'todos' | 'chain'` 改为 `'services' | 'todos' | 'docs'`
- topbar 第三 tab：图标改为文档/链接图标，文字「短链文档」
- `<template v-if="currentPage === 'chain'">` 块替换为 `<template v-if="currentPage === 'docs'"><DocShare /></template>`
- 移除 `import ServiceChain from '@/components/chain/ServiceChain.vue'`
- 清理其他对 `'chain'` 的引用（如 `localStorage` 中遗留值的兼容可忽略）

### 复制链接交互

点击「复制链接」按钮 → `navigator.clipboard.writeText(doc.url)` → 简单 toast 浮层提示「已复制」。不引入新依赖。

### 删除链路相关文件

- `src/components/chain/` 整个目录（8 个文件）
- `src/stores/chainStore.ts`
- `src/api/chains.ts`
- `src/data/nodeTypes.ts`
- `server/routes/chains.js`
- `package.json` 中 `@vue-flow/*` 4 个依赖（已验证仅在 chain 组件中使用）

---

## §5. 边界、错误处理、安全

### 文件上传限制
- 前端：`accept=".html,.htm,.md"`，文件大小 > 2MB 时 `alert` 拒绝
- 后端：`content.length > 2*1024*1024` 返回 413
- 文件名空 → 用 `未命名文档.{ext}` 兜底
- 读取文件用 `FileReader.readAsText`（UTF-8）

### 短链生成
- 6 位 base62（A-Z a-z 0-9）
- 碰撞检测：DB 唯一索引 + 重试，最多 5 次；都失败则 500
- 不做自定义短链（YAGNI）

### 预览页错误
- `code` 不存在 → 返回 404 HTML 页（简洁提示「文档不存在或已删除」）
- DB 异常 → 500 兜底页

### 视图统计
- 每次 `/s/:code` 命中，`UPDATE shared_docs SET views = views + 1` 异步触发（`Promise` 不 `await`，失败静默）

### 安全权衡（明确记录）
- HTML 文件以原始内容返回 — 这是「内容分享」工具的预期行为，但意味着上传者可在 HTML 中嵌入 `<script>`。**用户自己上传、自己分享**，等同于个人 Pastebin。不引入 DOMPurify（会破坏用户 HTML 的意图）。
- MD 经 marked 渲染 — marked 默认会执行内嵌 HTML，行为与 HTML 文件一致。
- 短链码 6 位 base62 提供模糊保护，但本质是「知道链接即可访问」模型，与用户选的「公开访问」一致。

---

## 测试计划（手动）

1. 上传 `.md` → 列表出现 → 点列表中「打开」新窗口看到渲染后内容 → 返回列表 `views` +1
2. 上传 `.html` → 同上 → 看到原始 HTML 渲染
3. 粘贴文本（HTML/MD 两种）→ 同上
4. 复制链接 → 剪贴板含完整 URL → 退出登录后浏览器直接打开仍可访问
5. 删除文档 → 列表消失 → 旧短链返回 404 页
6. 上传 > 2MB 文件 → 前端拒绝 + 后端兜底 413
7. 切换暗色模式 → MD 预览页跟随 `prefers-color-scheme`（预览页是独立 HTML，不读 dashboard 主题）
8. 访问不存在的 code → 404 页

---

## 不实现的范围（YAGNI）

- 编辑文档内容（PATCH 接口先留位不实现）
- 自定义短链码
- 过期时间 / 密码保护
- 访问统计图表
- 二维码生成
- 用户级权限（多用户隔离）

---

## 实现清理清单

新增：
- `server/routes/docs.js`
- `server/routes/share.js`
- `src/api/docs.ts`
- `src/stores/docStore.ts`
- `src/components/share/DocShare.vue`

修改：
- `server/index.js`（路由注册）
- `server/database.js`（新表 + ops，移除 chainOps）
- `src/views/dashboard/index.vue`（tab 替换）
- `src/types/index.ts`（追加 `SharedDoc`）
- `package.json`（移除 `@vue-flow/*`）

删除：
- `src/components/chain/` 目录
- `src/stores/chainStore.ts`
- `src/api/chains.ts`
- `src/data/nodeTypes.ts`
- `server/routes/chains.js`
