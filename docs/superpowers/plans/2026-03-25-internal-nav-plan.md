# 内部系统导航页 - 实现计划

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 构建一个轻量级的内部系统导航管理工具，支持分组管理、服务导航、凭据复制、拖拽排序和导出功能。

**Architecture:** 单体应用架构，Node.js + Express 后端提供 API 并托管前端静态文件。前端使用 Vue 3 + Vben Admin + Tailwind CSS，数据库使用 SQLite。

**Tech Stack:** Vue 3, Vben Admin, Tailwind CSS, Node.js, Express, better-sqlite3

---

## 文件结构

```
cool-bav/
├── server/
│   ├── index.js              # 入口，Express 配置，静态文件托管
│   ├── database.js           # SQLite 数据库初始化和操作
│   ├── routes/
│   │   ├── groups.js         # 分组 API 路由
│   │   ├── services.js       # 服务 API 路由
│   │   └── export.js         # 导出 API 路由
│   └── middleware/
│       └── errorHandler.js   # 错误处理中间件
├── src/
│   ├── main.ts               # Vue 入口
│   ├── App.vue               # 根组件
│   ├── api/
│   │   ├── groups.ts         # 分组 API 调用
│   │   └── services.ts       # 服务 API 调用
│   ├── views/
│   │   └── dashboard/
│   │       └── index.vue     # 主页面
│   ├── components/
│   │   ├── Sidebar.vue       # 左侧分组列表
│   │   ├── ServiceCard.vue   # 服务卡片
│   │   ├── ServiceModal.vue  # 服务编辑弹窗
│   │   ├── GroupModal.vue    # 分组编辑弹窗
│   │   └── ExportModal.vue   # 导出弹窗
│   ├── stores/
│   │   └── navStore.ts       # 状态管理
│   └── types/
│       └── index.ts          # TypeScript 类型定义
├── data/
│   └── nav.db                # SQLite 数据库文件
├── package.json
├── vite.config.ts
├── tailwind.config.js
└── tsconfig.json
```

---

## Task 1: 项目初始化

**Files:**
- Create: `package.json`
- Create: `.gitignore`

- [ ] **Step 1: 创建 package.json**

```json
{
  "name": "internal-nav",
  "version": "1.0.0",
  "description": "内部系统导航页",
  "type": "module",
  "scripts": {
    "dev": "concurrently \"npm run dev:server\" \"npm run dev:client\"",
    "dev:server": "node --watch server/index.js",
    "dev:client": "vite",
    "build": "vite build",
    "start": "node server/index.js"
  },
  "dependencies": {
    "express": "^4.18.2",
    "better-sqlite3": "^9.4.3",
    "cors": "^2.8.5"
  },
  "devDependencies": {
    "vite": "^5.1.0",
    "vue": "^3.4.0",
    "@vitejs/plugin-vue": "^5.0.0",
    "tailwindcss": "^3.4.0",
    "postcss": "^8.4.35",
    "autoprefixer": "^10.4.17",
    "typescript": "^5.3.0",
    "vue-tsc": "^2.0.0",
    "concurrently": "^8.2.2",
    "@types/node": "^20.11.0",
    "vuedraggable": "^4.1.0",
    "pinia": "^2.1.7",
    "axios": "^1.6.7"
  }
}
```

- [ ] **Step 2: 创建 .gitignore**

```
node_modules/
dist/
data/*.db
*.log
.DS_Store
```

- [ ] **Step 3: 初始化 Git 仓库**

Run: `git init`
Expected: Git 仓库初始化成功

- [ ] **Step 4: 安装依赖**

Run: `npm install`
Expected: 依赖安装成功

- [ ] **Step 5: Commit**

```bash
git add package.json .gitignore
git commit -m "chore: init project with dependencies"
```

---

## Task 2: 后端数据库层

**Files:**
- Create: `server/database.js`

- [ ] **Step 1: 创建数据库模块**

```javascript
// server/database.js
import Database from 'better-sqlite3';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

const dbPath = join(__dirname, '..', 'data', 'nav.db');
const db = new Database(dbPath);

// 初始化表
db.exec(`
  CREATE TABLE IF NOT EXISTS groups (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    name TEXT NOT NULL,
    parent_id INTEGER REFERENCES groups(id),
    sort_order INTEGER DEFAULT 0,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
  );

  CREATE TABLE IF NOT EXISTS services (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    group_id INTEGER NOT NULL REFERENCES groups(id),
    name TEXT NOT NULL,
    url TEXT NOT NULL,
    username TEXT,
    password TEXT,
    description TEXT,
    icon TEXT,
    sort_order INTEGER DEFAULT 0,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
  );

  CREATE INDEX IF NOT EXISTS idx_groups_parent ON groups(parent_id);
  CREATE INDEX IF NOT EXISTS idx_groups_sort ON groups(sort_order);
  CREATE INDEX IF NOT EXISTS idx_services_group ON services(group_id);
  CREATE INDEX IF NOT EXISTS idx_services_sort ON services(sort_order);
`);

// 分组操作
export const groupOps = {
  getAll: () => db.prepare('SELECT * FROM groups ORDER BY sort_order, id').all(),

  getById: (id) => db.prepare('SELECT * FROM groups WHERE id = ?').get(id),

  create: (data) => {
    const stmt = db.prepare('INSERT INTO groups (name, parent_id, sort_order) VALUES (?, ?, ?)');
    const result = stmt.run(data.name, data.parent_id || null, data.sort_order || 0);
    return { id: result.lastInsertRowid, ...data };
  },

  update: (id, data) => {
    const stmt = db.prepare('UPDATE groups SET name = ?, parent_id = ?, sort_order = ?, updated_at = CURRENT_TIMESTAMP WHERE id = ?');
    stmt.run(data.name, data.parent_id || null, data.sort_order || 0, id);
    return { id, ...data };
  },

  delete: (id) => {
    // 删除分组下的所有服务
    db.prepare('DELETE FROM services WHERE group_id = ?').run(id);
    // 删除子分组的服务
    const childGroups = db.prepare('SELECT id FROM groups WHERE parent_id = ?').all(id);
    childGroups.forEach(g => {
      db.prepare('DELETE FROM services WHERE group_id = ?').run(g.id);
    });
    // 删除子分组
    db.prepare('DELETE FROM groups WHERE parent_id = ?').run(id);
    // 删除分组
    return db.prepare('DELETE FROM groups WHERE id = ?').run(id);
  },

  reorder: (items) => {
    const stmt = db.prepare('UPDATE groups SET sort_order = ? WHERE id = ?');
    items.forEach((item, index) => {
      stmt.run(index, item.id);
    });
    return items;
  }
};

// 服务操作
export const serviceOps = {
  getAll: (groupId = null) => {
    if (groupId) {
      return db.prepare('SELECT * FROM services WHERE group_id = ? ORDER BY sort_order, id').all(groupId);
    }
    return db.prepare('SELECT * FROM services ORDER BY sort_order, id').all();
  },

  getById: (id) => db.prepare('SELECT * FROM services WHERE id = ?').get(id),

  create: (data) => {
    const stmt = db.prepare(`
      INSERT INTO services (group_id, name, url, username, password, description, icon, sort_order)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?)
    `);
    const result = stmt.run(
      data.group_id,
      data.name,
      data.url,
      data.username || null,
      data.password || null,
      data.description || null,
      data.icon || null,
      data.sort_order || 0
    );
    return { id: result.lastInsertRowid, ...data };
  },

  update: (id, data) => {
    const stmt = db.prepare(`
      UPDATE services SET group_id = ?, name = ?, url = ?, username = ?, password = ?,
      description = ?, icon = ?, sort_order = ?, updated_at = CURRENT_TIMESTAMP WHERE id = ?
    `);
    stmt.run(
      data.group_id,
      data.name,
      data.url,
      data.username || null,
      data.password || null,
      data.description || null,
      data.icon || null,
      data.sort_order || 0,
      id
    );
    return { id, ...data };
  },

  delete: (id) => db.prepare('DELETE FROM services WHERE id = ?').run(id),

  reorder: (items) => {
    const stmt = db.prepare('UPDATE services SET sort_order = ?, group_id = ? WHERE id = ?');
    items.forEach((item, index) => {
      stmt.run(index, item.group_id, item.id);
    });
    return items;
  },

  search: (keyword) => {
    const pattern = `%${keyword}%`;
    return db.prepare(`
      SELECT * FROM services WHERE name LIKE ? OR url LIKE ? OR description LIKE ?
      ORDER BY sort_order, id
    `).all(pattern, pattern, pattern);
  }
};

export default db;
```

- [ ] **Step 2: 创建 data 目录**

Run: `mkdir -p data`
Expected: data 目录创建成功

- [ ] **Step 3: Commit**

```bash
git add server/database.js data/
git commit -m "feat: add database layer with groups and services operations"
```

---

## Task 3: 后端 API - 分组路由

**Files:**
- Create: `server/routes/groups.js`

- [ ] **Step 1: 创建分组路由**

```javascript
// server/routes/groups.js
import { Router } from 'express';
import { groupOps, serviceOps } from '../database.js';

const router = Router();

// 获取分组树（带服务数量）
router.get('/', (req, res) => {
  const groups = groupOps.getAll();
  const services = serviceOps.getAll();

  // 计算每个分组的服务数量
  const groupCounts = {};
  services.forEach(s => {
    groupCounts[s.group_id] = (groupCounts[s.group_id] || 0) + 1;
  });

  const result = groups.map(g => ({
    ...g,
    serviceCount: groupCounts[g.id] || 0
  }));

  res.json({ success: true, data: result });
});

// 获取单个分组
router.get('/:id', (req, res) => {
  const group = groupOps.getById(parseInt(req.params.id));
  if (!group) {
    return res.status(404).json({ success: false, message: '分组不存在' });
  }
  res.json({ success: true, data: group });
});

// 创建分组
router.post('/', (req, res) => {
  const { name, parent_id } = req.body;
  if (!name) {
    return res.status(400).json({ success: false, message: '分组名称不能为空' });
  }
  const group = groupOps.create({ name, parent_id });
  res.status(201).json({ success: true, data: group });
});

// 更新分组
router.put('/:id', (req, res) => {
  const { name, parent_id, sort_order } = req.body;
  if (!name) {
    return res.status(400).json({ success: false, message: '分组名称不能为空' });
  }
  const group = groupOps.update(parseInt(req.params.id), { name, parent_id, sort_order });
  res.json({ success: true, data: group });
});

// 删除分组
router.delete('/:id', (req, res) => {
  groupOps.delete(parseInt(req.params.id));
  res.json({ success: true, message: '删除成功' });
});

// 批量更新排序
router.put('/reorder', (req, res) => {
  const { items } = req.body;
  if (!Array.isArray(items)) {
    return res.status(400).json({ success: false, message: '参数错误' });
  }
  groupOps.reorder(items);
  res.json({ success: true, message: '排序更新成功' });
});

export default router;
```

- [ ] **Step 2: Commit**

```bash
git add server/routes/groups.js
git commit -m "feat: add groups API routes"
```

---

## Task 4: 后端 API - 服务路由

**Files:**
- Create: `server/routes/services.js`

- [ ] **Step 1: 创建服务路由**

```javascript
// server/routes/services.js
import { Router } from 'express';
import { serviceOps } from '../database.js';

const router = Router();

// 获取服务列表
router.get('/', (req, res) => {
  const { group_id, search } = req.query;
  let services;
  if (search) {
    services = serviceOps.search(search);
  } else {
    services = serviceOps.getAll(group_id ? parseInt(group_id) : null);
  }
  res.json({ success: true, data: services });
});

// 获取单个服务
router.get('/:id', (req, res) => {
  const service = serviceOps.getById(parseInt(req.params.id));
  if (!service) {
    return res.status(404).json({ success: false, message: '服务不存在' });
  }
  res.json({ success: true, data: service });
});

// 创建服务
router.post('/', (req, res) => {
  const { group_id, name, url, username, password, description, icon } = req.body;
  if (!group_id || !name || !url) {
    return res.status(400).json({ success: false, message: '分组、名称和URL不能为空' });
  }
  const service = serviceOps.create({ group_id, name, url, username, password, description, icon });
  res.status(201).json({ success: true, data: service });
});

// 更新服务
router.put('/:id', (req, res) => {
  const { group_id, name, url, username, password, description, icon, sort_order } = req.body;
  if (!group_id || !name || !url) {
    return res.status(400).json({ success: false, message: '分组、名称和URL不能为空' });
  }
  const service = serviceOps.update(parseInt(req.params.id), {
    group_id, name, url, username, password, description, icon, sort_order
  });
  res.json({ success: true, data: service });
});

// 删除服务
router.delete('/:id', (req, res) => {
  serviceOps.delete(parseInt(req.params.id));
  res.json({ success: true, message: '删除成功' });
});

// 批量更新排序（支持跨分组移动）
router.put('/reorder', (req, res) => {
  const { items } = req.body;
  if (!Array.isArray(items)) {
    return res.status(400).json({ success: false, message: '参数错误' });
  }
  serviceOps.reorder(items);
  res.json({ success: true, message: '排序更新成功' });
});

// 复制凭据到剪贴板（返回凭据供前端使用）
router.post('/:id/copy', (req, res) => {
  const service = serviceOps.getById(parseInt(req.params.id));
  if (!service) {
    return res.status(404).json({ success: false, message: '服务不存在' });
  }
  if (!service.username && !service.password) {
    return res.json({ success: true, data: { hasCredentials: false } });
  }
  res.json({
    success: true,
    data: {
      hasCredentials: true,
      username: service.username,
      password: service.password
    }
  });
});

export default router;
```

- [ ] **Step 2: Commit**

```bash
git add server/routes/services.js
git commit -m "feat: add services API routes with copy credentials"
```

---

## Task 5: 后端 API - 导出路由

**Files:**
- Create: `server/routes/export.js`

- [ ] **Step 1: 创建导出路由**

```javascript
// server/routes/export.js
import { Router } from 'express';
import { groupOps, serviceOps } from '../database.js';

const router = Router();

// 导出为 Markdown
router.post('/', (req, res) => {
  const { groupIds } = req.body;

  if (!Array.isArray(groupIds) || groupIds.length === 0) {
    return res.status(400).json({ success: false, message: '请选择要导出的分组' });
  }

  let markdown = '# 内部系统导航\n\n';

  groupIds.forEach(groupId => {
    const group = groupOps.getById(groupId);
    if (!group) return;

    const services = serviceOps.getAll(groupId);
    if (services.length === 0) return;

    markdown += `## ${group.name}\n\n`;
    markdown += '| 平台 | URL | 用户名 | 密码 |\n';
    markdown += '|------|-----|--------|------|\n';

    services.forEach(service => {
      const username = service.username || '-';
      const password = service.password || '-';
      markdown += `| ${service.name} | ${service.url} | ${username} | ${password} |\n`;
    });

    markdown += '\n';
  });

  res.json({
    success: true,
    data: {
      content: markdown,
      filename: `internal-nav-${new Date().toISOString().split('T')[0]}.md`
    }
  });
});

export default router;
```

- [ ] **Step 2: Commit**

```bash
git add server/routes/export.js
git commit -m "feat: add export markdown API route"
```

---

## Task 6: 后端入口和中间件

**Files:**
- Create: `server/middleware/errorHandler.js`
- Create: `server/index.js`

- [ ] **Step 1: 创建错误处理中间件**

```javascript
// server/middleware/errorHandler.js
export default (err, req, res, next) => {
  console.error('Error:', err);
  res.status(err.status || 500).json({
    success: false,
    message: err.message || '服务器内部错误'
  });
};
```

- [ ] **Step 2: 创建服务器入口**

```javascript
// server/index.js
import express from 'express';
import cors from 'cors';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';
import groupsRouter from './routes/groups.js';
import servicesRouter from './routes/services.js';
import exportRouter from './routes/export.js';
import errorHandler from './middleware/errorHandler.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

const app = express();
const PORT = process.env.PORT || 3000;

// 中间件
app.use(cors());
app.use(express.json());

// API 路由
app.use('/api/groups', groupsRouter);
app.use('/api/services', servicesRouter);
app.use('/api/export', exportRouter);

// 静态文件托管（生产环境）
app.use(express.static(join(__dirname, '..', 'dist')));

// SPA 回退
app.get('*', (req, res) => {
  res.sendFile(join(__dirname, '..', 'dist', 'index.html'));
});

// 错误处理
app.use(errorHandler);

app.listen(PORT, () => {
  console.log(`Server running at http://localhost:${PORT}`);
});
```

- [ ] **Step 3: 测试后端启动**

Run: `node server/index.js`
Expected: 服务器启动成功，显示 "Server running at http://localhost:3000"

- [ ] **Step 4: Commit**

```bash
git add server/
git commit -m "feat: add server entry and error handler middleware"
```

---

## Task 7: 前端配置

**Files:**
- Create: `vite.config.ts`
- Create: `tailwind.config.js`
- Create: `postcss.config.js`
- Create: `tsconfig.json`
- Create: `index.html`

- [ ] **Step 1: 创建 Vite 配置**

```typescript
// vite.config.ts
import { defineConfig } from 'vite';
import vue from '@vitejs/plugin-vue';
import { resolve } from 'path';

export default defineConfig({
  plugins: [vue()],
  resolve: {
    alias: {
      '@': resolve(__dirname, 'src')
    }
  },
  server: {
    port: 5173,
    proxy: {
      '/api': {
        target: 'http://localhost:3000',
        changeOrigin: true
      }
    }
  }
});
```

- [ ] **Step 2: 创建 Tailwind 配置**

```javascript
// tailwind.config.js
/** @type {import('tailwindcss').Config} */
export default {
  content: [
    './index.html',
    './src/**/*.{vue,js,ts,jsx,tsx}'
  ],
  theme: {
    extend: {
      colors: {
        primary: '#3b82f6',
        'bg-main': '#f8fafc',
        'text-main': '#1e293b',
        'text-sub': '#64748b',
        'border-main': '#e2e8f0'
      }
    }
  },
  plugins: []
};
```

- [ ] **Step 3: 创建 PostCSS 配置**

```javascript
// postcss.config.js
export default {
  plugins: {
    tailwindcss: {},
    autoprefixer: {}
  }
};
```

- [ ] **Step 4: 创建 TypeScript 配置**

```json
// tsconfig.json
{
  "compilerOptions": {
    "target": "ES2020",
    "useDefineForClassFields": true,
    "module": "ESNext",
    "lib": ["ES2020", "DOM", "DOM.Iterable"],
    "skipLibCheck": true,
    "moduleResolution": "bundler",
    "allowImportingTsExtensions": true,
    "resolveJsonModule": true,
    "isolatedModules": true,
    "noEmit": true,
    "jsx": "preserve",
    "strict": true,
    "noUnusedLocals": true,
    "noUnusedParameters": true,
    "noFallthroughCasesInSwitch": true,
    "baseUrl": ".",
    "paths": {
      "@/*": ["src/*"]
    }
  },
  "include": ["src/**/*.ts", "src/**/*.tsx", "src/**/*.vue"],
  "references": [{ "path": "./tsconfig.node.json" }]
}
```

- [ ] **Step 5: 创建 tsconfig.node.json**

```json
// tsconfig.node.json
{
  "compilerOptions": {
    "composite": true,
    "skipLibCheck": true,
    "module": "ESNext",
    "moduleResolution": "bundler",
    "allowSyntheticDefaultImports": true
  },
  "include": ["vite.config.ts"]
}
```

- [ ] **Step 6: 创建 index.html**

```html
<!DOCTYPE html>
<html lang="zh-CN">
  <head>
    <meta charset="UTF-8" />
    <link rel="icon" type="image/svg+xml" href="/favicon.svg" />
    <meta name="viewport" content="width=device-width, initial-scale=1.0" />
    <title>内部系统导航</title>
  </head>
  <body class="bg-bg-main">
    <div id="app"></div>
    <script type="module" src="/src/main.ts"></script>
  </body>
</html>
```

- [ ] **Step 7: Commit**

```bash
git add vite.config.ts tailwind.config.js postcss.config.js tsconfig.json tsconfig.node.json index.html
git commit -m "chore: add frontend config files"
```

---

## Task 8: 前端基础结构

**Files:**
- Create: `src/main.ts`
- Create: `src/App.vue`
- Create: `src/style.css`
- Create: `src/types/index.ts`

- [ ] **Step 1: 创建样式文件**

```css
/* src/style.css */
@tailwind base;
@tailwind components;
@tailwind utilities;

body {
  font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, 'Helvetica Neue', Arial, sans-serif;
}
```

- [ ] **Step 2: 创建类型定义**

```typescript
// src/types/index.ts
export interface Group {
  id: number;
  name: string;
  parent_id: number | null;
  sort_order: number;
  serviceCount?: number;
}

export interface Service {
  id: number;
  group_id: number;
  name: string;
  url: string;
  username: string | null;
  password: string | null;
  description: string | null;
  icon: string | null;
  sort_order: number;
}

export interface ApiResponse<T> {
  success: boolean;
  data: T;
  message?: string;
}
```

- [ ] **Step 3: 创建 Vue 入口**

```typescript
// src/main.ts
import { createApp } from 'vue';
import { createPinia } from 'pinia';
import App from './App.vue';
import './style.css';

const app = createApp(App);
app.use(createPinia());
app.mount('#app');
```

- [ ] **Step 4: 创建根组件**

```vue
<!-- src/App.vue -->
<script setup lang="ts">
import Dashboard from './views/dashboard/index.vue';
</script>

<template>
  <div class="min-h-screen bg-bg-main">
    <Dashboard />
  </div>
</template>
```

- [ ] **Step 5: Commit**

```bash
git add src/
git commit -m "feat: add frontend base structure"
```

---

## Task 9: 前端 API 层

**Files:**
- Create: `src/api/request.ts`
- Create: `src/api/groups.ts`
- Create: `src/api/services.ts`

- [ ] **Step 1: 创建请求封装**

```typescript
// src/api/request.ts
import axios from 'axios';

const request = axios.create({
  baseURL: '/api',
  timeout: 10000
});

request.interceptors.response.use(
  response => response.data,
  error => {
    console.error('API Error:', error);
    return Promise.reject(error);
  }
);

export default request;
```

- [ ] **Step 2: 创建分组 API**

```typescript
// src/api/groups.ts
import request from './request';
import type { Group, ApiResponse } from '@/types';

export const groupsApi = {
  getAll: () => request.get<any, ApiResponse<Group[]>>('/groups'),

  getById: (id: number) => request.get<any, ApiResponse<Group>>(`/groups/${id}`),

  create: (data: Partial<Group>) => request.post<any, ApiResponse<Group>>('/groups', data),

  update: (id: number, data: Partial<Group>) => request.put<any, ApiResponse<Group>>(`/groups/${id}`, data),

  delete: (id: number) => request.delete<any, ApiResponse<void>>(`/groups/${id}`),

  reorder: (items: { id: number }[]) => request.put<any, ApiResponse<void>>('/groups/reorder', { items })
};
```

- [ ] **Step 3: 创建服务 API**

```typescript
// src/api/services.ts
import request from './request';
import type { Service, ApiResponse } from '@/types';

export const servicesApi = {
  getAll: (groupId?: number) => request.get<any, ApiResponse<Service[]>>('/services', { params: { group_id: groupId } }),

  search: (keyword: string) => request.get<any, ApiResponse<Service[]>>('/services', { params: { search: keyword } }),

  getById: (id: number) => request.get<any, ApiResponse<Service>>(`/services/${id}`),

  create: (data: Partial<Service>) => request.post<any, ApiResponse<Service>>('/services', data),

  update: (id: number, data: Partial<Service>) => request.put<any, ApiResponse<Service>>(`/services/${id}`, data),

  delete: (id: number) => request.delete<any, ApiResponse<void>>(`/services/${id}`),

  reorder: (items: { id: number; group_id: number }[]) => request.put<any, ApiResponse<void>>('/services/reorder', { items }),

  copyCredentials: (id: number) => request.post<any, ApiResponse<{ hasCredentials: boolean; username?: string; password?: string }>>(`/services/${id}/copy`)
};
```

- [ ] **Step 4: Commit**

```bash
git add src/api/
git commit -m "feat: add frontend API layer"
```

---

## Task 10: 状态管理

**Files:**
- Create: `src/stores/navStore.ts`

- [ ] **Step 1: 创建状态管理**

```typescript
// src/stores/navStore.ts
import { defineStore } from 'pinia';
import { ref, computed } from 'vue';
import { groupsApi } from '@/api/groups';
import { servicesApi } from '@/api/services';
import type { Group, Service } from '@/types';

export const useNavStore = defineStore('nav', () => {
  const groups = ref<Group[]>([]);
  const services = ref<Service[]>([]);
  const currentGroupId = ref<number | null>(null);
  const loading = ref(false);

  const currentGroup = computed(() => groups.value.find(g => g.id === currentGroupId.value));

  const currentServices = computed(() => {
    if (!currentGroupId.value) return [];
    return services.value.filter(s => s.group_id === currentGroupId.value);
  });

  async function fetchGroups() {
    loading.value = true;
    try {
      const res = await groupsApi.getAll();
      groups.value = res.data;
      if (!currentGroupId.value && groups.value.length > 0) {
        currentGroupId.value = groups.value[0].id;
        await fetchServices();
      }
    } finally {
      loading.value = false;
    }
  }

  async function fetchServices(groupId?: number) {
    const id = groupId || currentGroupId.value;
    if (!id) return;
    const res = await servicesApi.getAll(id);
    services.value = res.data;
  }

  async function addGroup(data: Partial<Group>) {
    const res = await groupsApi.create(data);
    groups.value.push(res.data);
    return res.data;
  }

  async function updateGroup(id: number, data: Partial<Group>) {
    const res = await groupsApi.update(id, data);
    const index = groups.value.findIndex(g => g.id === id);
    if (index > -1) {
      groups.value[index] = { ...groups.value[index], ...res.data };
    }
  }

  async function deleteGroup(id: number) {
    await groupsApi.delete(id);
    groups.value = groups.value.filter(g => g.id !== id);
    if (currentGroupId.value === id) {
      currentGroupId.value = groups.value[0]?.id || null;
    }
  }

  async function addService(data: Partial<Service>) {
    const res = await servicesApi.create(data);
    services.value.push(res.data);
    await fetchGroups(); // 更新服务数量
    return res.data;
  }

  async function updateService(id: number, data: Partial<Service>) {
    const res = await servicesApi.update(id, data);
    const index = services.value.findIndex(s => s.id === id);
    if (index > -1) {
      services.value[index] = res.data;
    }
    await fetchGroups();
  }

  async function deleteService(id: number) {
    await servicesApi.delete(id);
    services.value = services.value.filter(s => s.id !== id);
    await fetchGroups();
  }

  function selectGroup(id: number) {
    currentGroupId.value = id;
    fetchServices();
  }

  return {
    groups,
    services,
    currentGroupId,
    currentGroup,
    currentServices,
    loading,
    fetchGroups,
    fetchServices,
    addGroup,
    updateGroup,
    deleteGroup,
    addService,
    updateService,
    deleteService,
    selectGroup
  };
});
```

- [ ] **Step 2: Commit**

```bash
git add src/stores/
git commit -m "feat: add pinia store for navigation state"
```

---

## Task 11: 侧边栏组件

**Files:**
- Create: `src/components/Sidebar.vue`

- [ ] **Step 1: 创建侧边栏组件**

```vue
<!-- src/components/Sidebar.vue -->
<script setup lang="ts">
import { ref, watch, computed } from 'vue';
import draggable from 'vuedraggable';
import { groupsApi } from '@/api/groups';
import { servicesApi } from '@/api/services';
import { useNavStore } from '@/stores/navStore';
import type { Group } from '@/types';

const store = useNavStore();
const searchKeyword = ref('');
const localGroups = ref<Group[]>([]);
const expandedGroups = ref<Set<number>>(new Set());

// 同步分组数据
watch(() => store.groups, (newGroups) => {
  localGroups.value = [...newGroups];
}, { immediate: true, deep: true });

// 构建树形结构
const rootGroups = computed(() => {
  return localGroups.value.filter(g => !g.parent_id);
});

function getChildGroups(parentId: number) {
  return localGroups.value.filter(g => g.parent_id === parentId);
}

function toggleExpand(id: number) {
  if (expandedGroups.value.has(id)) {
    expandedGroups.value.delete(id);
  } else {
    expandedGroups.value.add(id);
  }
}

function isExpanded(id: number) {
  return expandedGroups.value.has(id);
}

// 拖拽排序后保存
async function onDragEnd() {
  const items = localGroups.value.map((g, i) => ({ id: g.id }));
  await groupsApi.reorder(items);
  await store.fetchGroups();
}

// 搜索功能：搜索分组和服务
const emit = defineEmits<{
  editGroup: [group: Group];
  searchServices: [keyword: string];
}>();

watch(searchKeyword, async (keyword) => {
  if (keyword.trim()) {
    // 搜索服务并通知父组件
    emit('searchServices', keyword);
  } else {
    emit('searchServices', '');
  }
});
</script>

<template>
  <aside class="w-[200px] bg-white border-r border-border-main flex flex-col h-screen">
    <!-- 搜索框 -->
    <div class="p-3 border-b border-border-main">
      <input
        v-model="searchKeyword"
        type="text"
        placeholder="搜索分组或服务..."
        class="w-full px-3 py-2 bg-gray-50 rounded-md text-sm focus:outline-none focus:ring-2 focus:ring-primary"
      />
    </div>

    <!-- 分组列表 -->
    <div class="flex-1 overflow-y-auto p-2">
      <div class="text-xs text-text-sub px-2 py-2">分组</div>
      <draggable
        v-model="localGroups"
        item-key="id"
        @end="onDragEnd"
        class="space-y-1"
      >
        <template #item="{ element: group }">
          <!-- 只渲染根分组，子分组在展开时渲染 -->
          <template v-if="!group.parent_id">
            <div :key="group.id">
              <div
                :class="[
                  'px-3 py-2 rounded-md cursor-pointer flex items-center justify-between group/item',
                  store.currentGroupId === group.id
                    ? 'bg-blue-50 text-primary'
                    : 'text-text-main hover:bg-gray-50'
                ]"
                @click="store.selectGroup(group.id)"
              >
                <span class="flex items-center gap-2 truncate">
                  <span
                    v-if="getChildGroups(group.id).length > 0"
                    class="cursor-pointer text-xs"
                    @click.stop="toggleExpand(group.id)"
                  >
                    {{ isExpanded(group.id) ? '▼' : '▶' }}
                  </span>
                  <span v-else class="w-3"></span>
                  <span>📁</span>
                  <span class="text-sm">{{ group.name }}</span>
                </span>
                <span class="flex items-center gap-1">
                  <span
                    v-if="group.serviceCount"
                    class="text-xs px-1.5 py-0.5 rounded-full"
                    :class="store.currentGroupId === group.id ? 'bg-blue-100 text-primary' : 'bg-gray-100 text-text-sub'"
                  >
                    {{ group.serviceCount }}
                  </span>
                  <button
                    class="opacity-0 group-hover/item:opacity-100 text-text-sub hover:text-primary"
                    @click.stop="emit('editGroup', group)"
                  >
                    ✏️
                  </button>
                </span>
              </div>
              <!-- 子分组 -->
              <div v-if="isExpanded(group.id)" class="ml-4 mt-1 space-y-1">
                <div
                  v-for="child in getChildGroups(group.id)"
                  :key="child.id"
                  :class="[
                    'px-3 py-2 rounded-md cursor-pointer flex items-center justify-between group/item',
                    store.currentGroupId === child.id
                      ? 'bg-blue-50 text-primary'
                      : 'text-text-main hover:bg-gray-50'
                  ]"
                  @click="store.selectGroup(child.id)"
                >
                  <span class="flex items-center gap-2 truncate">
                    <span>📁</span>
                    <span class="text-sm">{{ child.name }}</span>
                  </span>
                  <span class="flex items-center gap-1">
                    <span
                      v-if="child.serviceCount"
                      class="text-xs px-1.5 py-0.5 rounded-full"
                      :class="store.currentGroupId === child.id ? 'bg-blue-100 text-primary' : 'bg-gray-100 text-text-sub'"
                    >
                      {{ child.serviceCount }}
                    </span>
                    <button
                      class="opacity-0 group-hover/item:opacity-100 text-text-sub hover:text-primary"
                      @click.stop="emit('editGroup', child)"
                    >
                      ✏️
                    </button>
                  </span>
                </div>
              </div>
            </div>
          </template>
        </template>
      </draggable>
    </div>

    <!-- 新建分组 -->
    <div class="p-3 border-t border-border-main">
      <button
        @click="emit('editGroup', null)"
        class="w-full px-3 py-2 text-sm text-text-sub hover:text-primary hover:bg-gray-50 rounded-md flex items-center gap-2"
      >
        <span>➕</span>
        <span>新建分组</span>
      </button>
    </div>
  </aside>
</template>
```

- [ ] **Step 2: Commit**

```bash
git add src/components/Sidebar.vue
git commit -m "feat: add sidebar with tree structure, drag reorder, and search"
```

---

## Task 12: 服务卡片组件

**Files:**
- Create: `src/components/ServiceCard.vue`

- [ ] **Step 1: 创建服务卡片组件**

```vue
<!-- src/components/ServiceCard.vue -->
<script setup lang="ts">
import { servicesApi } from '@/api/services';
import type { Service } from '@/types';

const props = defineProps<{
  service: Service;
}>();

const emit = defineEmits<{
  edit: [service: Service];
}>();

async function handleOpen() {
  // 打开链接
  window.open(props.service.url, '_blank');

  // 如果有凭据，复制到剪贴板
  if (props.service.username || props.service.password) {
    try {
      const res = await servicesApi.copyCredentials(props.service.id);
      if (res.data.hasCredentials) {
        const text = `${res.data.username}\n${res.data.password}`;
        await navigator.clipboard.writeText(text);
        showToast(`已复制 ${props.service.name} 的用户名和密码到剪贴板`);
      }
    } catch (e) {
      console.error('Copy failed:', e);
    }
  } else {
    showToast(`已打开 ${props.service.name}`);
  }
}

function showToast(message: string) {
  const toast = document.createElement('div');
  toast.className = 'fixed bottom-4 left-1/2 -translate-x-1/2 bg-gray-800 text-white px-4 py-2 rounded-lg text-sm z-50';
  toast.textContent = message;
  document.body.appendChild(toast);
  setTimeout(() => toast.remove(), 3000);
}
</script>

<template>
  <div class="bg-white border border-border-main rounded-xl p-4 hover:shadow-md transition-shadow">
    <div class="flex items-start justify-between mb-3">
      <div
        class="w-10 h-10 rounded-lg flex items-center justify-center text-xl"
        :style="{ background: 'linear-gradient(135deg, #f97316 0%, #ea580c 100%)' }"
      >
        {{ service.icon || '🔗' }}
      </div>
      <div class="w-2 h-2 rounded-full bg-green-500" title="在线"></div>
    </div>

    <div class="text-sm font-semibold text-text-main mb-1">{{ service.name }}</div>
    <div class="text-xs text-text-sub mb-3 line-clamp-1">{{ service.description || service.url }}</div>

    <div class="flex gap-2">
      <button
        @click="handleOpen"
        class="flex-1 px-3 py-2 bg-primary text-white rounded-md text-xs hover:bg-blue-600 transition-colors"
      >
        打开
      </button>
      <button
        @click="emit('edit', service)"
        class="px-3 py-2 bg-gray-100 text-text-sub rounded-md text-xs hover:bg-gray-200 transition-colors"
      >
        ✏️
      </button>
    </div>
  </div>
</template>
```

- [ ] **Step 2: Commit**

```bash
git add src/components/ServiceCard.vue
git commit -m "feat: add service card component"
```

---

## Task 13: 服务编辑弹窗

**Files:**
- Create: `src/components/ServiceModal.vue`

- [ ] **Step 1: 创建服务编辑弹窗**

```vue
<!-- src/components/ServiceModal.vue -->
<script setup lang="ts">
import { ref, watch } from 'vue';
import { useNavStore } from '@/stores/navStore';
import type { Service } from '@/types';

const props = defineProps<{
  show: boolean;
  service?: Service | null;
}>();

const emit = defineEmits<{
  close: [];
  saved: [];
}>();

const store = useNavStore();
const form = ref({
  group_id: 0,
  name: '',
  url: '',
  username: '',
  password: '',
  description: '',
  icon: ''
});

watch(() => props.show, (show) => {
  if (show) {
    if (props.service) {
      form.value = {
        group_id: props.service.group_id,
        name: props.service.name,
        url: props.service.url,
        username: props.service.username || '',
        password: props.service.password || '',
        description: props.service.description || '',
        icon: props.service.icon || ''
      };
    } else {
      form.value = {
        group_id: store.currentGroupId || 0,
        name: '',
        url: '',
        username: '',
        password: '',
        description: '',
        icon: ''
      };
    }
  }
});

async function handleSubmit() {
  if (!form.value.name || !form.value.url) {
    alert('请填写服务名称和URL');
    return;
  }

  const data = {
    ...form.value,
    username: form.value.username || null,
    password: form.value.password || null,
    description: form.value.description || null,
    icon: form.value.icon || null
  };

  if (props.service) {
    await store.updateService(props.service.id, data);
  } else {
    await store.addService(data);
  }

  emit('saved');
  emit('close');
}
</script>

<template>
  <div
    v-if="show"
    class="fixed inset-0 bg-black/50 flex items-center justify-center z-50"
    @click.self="emit('close')"
  >
    <div class="bg-white rounded-xl w-[400px] max-h-[90vh] overflow-y-auto">
      <div class="p-4 border-b border-border-main flex items-center justify-between">
        <h3 class="font-semibold">{{ service ? '编辑服务' : '添加服务' }}</h3>
        <button @click="emit('close')" class="text-text-sub hover:text-text-main">✕</button>
      </div>

      <form @submit.prevent="handleSubmit" class="p-4 space-y-4">
        <div>
          <label class="block text-sm text-text-sub mb-1">所属分组</label>
          <select v-model="form.group_id" class="w-full px-3 py-2 border border-border-main rounded-md text-sm">
            <option v-for="group in store.groups" :key="group.id" :value="group.id">
              {{ group.name }}
            </option>
          </select>
        </div>

        <div>
          <label class="block text-sm text-text-sub mb-1">服务名称 *</label>
          <input
            v-model="form.name"
            type="text"
            placeholder="如：Jenkins"
            class="w-full px-3 py-2 border border-border-main rounded-md text-sm focus:outline-none focus:ring-2 focus:ring-primary"
          />
        </div>

        <div>
          <label class="block text-sm text-text-sub mb-1">URL *</label>
          <input
            v-model="form.url"
            type="url"
            placeholder="https://example.com"
            class="w-full px-3 py-2 border border-border-main rounded-md text-sm focus:outline-none focus:ring-2 focus:ring-primary"
          />
        </div>

        <div>
          <label class="block text-sm text-text-sub mb-1">用户名（可选）</label>
          <input
            v-model="form.username"
            type="text"
            placeholder="登录用户名"
            class="w-full px-3 py-2 border border-border-main rounded-md text-sm focus:outline-none focus:ring-2 focus:ring-primary"
          />
        </div>

        <div>
          <label class="block text-sm text-text-sub mb-1">密码（可选）</label>
          <input
            v-model="form.password"
            type="password"
            placeholder="登录密码"
            class="w-full px-3 py-2 border border-border-main rounded-md text-sm focus:outline-none focus:ring-2 focus:ring-primary"
          />
        </div>

        <div>
          <label class="block text-sm text-text-sub mb-1">描述（可选）</label>
          <input
            v-model="form.description"
            type="text"
            placeholder="简短描述"
            class="w-full px-3 py-2 border border-border-main rounded-md text-sm focus:outline-none focus:ring-2 focus:ring-primary"
          />
        </div>

        <div>
          <label class="block text-sm text-text-sub mb-1">图标（可选）</label>
          <input
            v-model="form.icon"
            type="text"
            placeholder="emoji 如：🔧"
            class="w-full px-3 py-2 border border-border-main rounded-md text-sm focus:outline-none focus:ring-2 focus:ring-primary"
          />
        </div>

        <div class="flex gap-2 pt-2">
          <button
            type="button"
            @click="emit('close')"
            class="flex-1 px-4 py-2 bg-gray-100 text-text-main rounded-md text-sm hover:bg-gray-200"
          >
            取消
          </button>
          <button
            type="submit"
            class="flex-1 px-4 py-2 bg-primary text-white rounded-md text-sm hover:bg-blue-600"
          >
            {{ service ? '保存' : '添加' }}
          </button>
        </div>
      </form>
    </div>
  </div>
</template>
```

- [ ] **Step 2: Commit**

```bash
git add src/components/ServiceModal.vue
git commit -m "feat: add service edit modal"
```

---

## Task 14: 分组编辑弹窗

**Files:**
- Create: `src/components/GroupModal.vue`

- [ ] **Step 1: 创建分组编辑弹窗**

```vue
<!-- src/components/GroupModal.vue -->
<script setup lang="ts">
import { ref, watch } from 'vue';
import { useNavStore } from '@/stores/navStore';
import type { Group } from '@/types';

const props = defineProps<{
  show: boolean;
  group?: Group | null;
}>();

const emit = defineEmits<{
  close: [];
  saved: [];
}>();

const store = useNavStore();
const form = ref({
  name: ''
});

watch(() => props.show, (show) => {
  if (show) {
    form.value.name = props.group?.name || '';
  }
});

async function handleSubmit() {
  if (!form.value.name.trim()) {
    alert('请填写分组名称');
    return;
  }

  if (props.group) {
    await store.updateGroup(props.group.id, { name: form.value.name });
  } else {
    await store.addGroup({ name: form.value.name });
  }

  emit('saved');
  emit('close');
}
</script>

<template>
  <div
    v-if="show"
    class="fixed inset-0 bg-black/50 flex items-center justify-center z-50"
    @click.self="emit('close')"
  >
    <div class="bg-white rounded-xl w-[360px]">
      <div class="p-4 border-b border-border-main flex items-center justify-between">
        <h3 class="font-semibold">{{ group ? '编辑分组' : '新建分组' }}</h3>
        <button @click="emit('close')" class="text-text-sub hover:text-text-main">✕</button>
      </div>

      <form @submit.prevent="handleSubmit" class="p-4 space-y-4">
        <div>
          <label class="block text-sm text-text-sub mb-1">分组名称</label>
          <input
            v-model="form.name"
            type="text"
            placeholder="如：运维系统"
            class="w-full px-3 py-2 border border-border-main rounded-md text-sm focus:outline-none focus:ring-2 focus:ring-primary"
          />
        </div>

        <div class="flex gap-2 pt-2">
          <button
            type="button"
            @click="emit('close')"
            class="flex-1 px-4 py-2 bg-gray-100 text-text-main rounded-md text-sm hover:bg-gray-200"
          >
            取消
          </button>
          <button
            type="submit"
            class="flex-1 px-4 py-2 bg-primary text-white rounded-md text-sm hover:bg-blue-600"
          >
            {{ group ? '保存' : '创建' }}
          </button>
        </div>
      </form>
    </div>
  </div>
</template>
```

- [ ] **Step 2: Commit**

```bash
git add src/components/GroupModal.vue
git commit -m "feat: add group edit modal"
```

---

## Task 15: 导出弹窗

**Files:**
- Create: `src/components/ExportModal.vue`

- [ ] **Step 1: 创建导出弹窗**

```vue
<!-- src/components/ExportModal.vue -->
<script setup lang="ts">
import { ref } from 'vue';
import { useNavStore } from '@/stores/navStore';

const props = defineProps<{
  show: boolean;
}>();

const emit = defineEmits<{
  close: [];
}>();

const store = useNavStore();
const selectedGroups = ref<number[]>([]);

function toggleGroup(id: number) {
  const index = selectedGroups.value.indexOf(id);
  if (index > -1) {
    selectedGroups.value.splice(index, 1);
  } else {
    selectedGroups.value.push(id);
  }
}

function selectAll() {
  selectedGroups.value = store.groups.map(g => g.id);
}

function clearAll() {
  selectedGroups.value = [];
}

async function handleExport() {
  if (selectedGroups.value.length === 0) {
    alert('请选择要导出的分组');
    return;
  }

  try {
    const res = await fetch('/api/export', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ groupIds: selectedGroups.value })
    });
    const data = await res.json();

    if (data.success) {
      // 创建下载
      const blob = new Blob([data.data.content], { type: 'text/markdown' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = data.data.filename;
      a.click();
      URL.revokeObjectURL(url);
      emit('close');
    }
  } catch (e) {
    console.error('Export failed:', e);
    alert('导出失败');
  }
}
</script>

<template>
  <div
    v-if="show"
    class="fixed inset-0 bg-black/50 flex items-center justify-center z-50"
    @click.self="emit('close')"
  >
    <div class="bg-white rounded-xl w-[400px]">
      <div class="p-4 border-b border-border-main flex items-center justify-between">
        <h3 class="font-semibold">导出 Markdown</h3>
        <button @click="emit('close')" class="text-text-sub hover:text-text-main">✕</button>
      </div>

      <div class="p-4">
        <div class="flex gap-2 mb-3">
          <button @click="selectAll" class="text-xs text-primary hover:underline">全选</button>
          <button @click="clearAll" class="text-xs text-text-sub hover:underline">清空</button>
        </div>

        <div class="space-y-2 max-h-[300px] overflow-y-auto">
          <label
            v-for="group in store.groups"
            :key="group.id"
            class="flex items-center gap-2 p-2 rounded-md hover:bg-gray-50 cursor-pointer"
          >
            <input
              type="checkbox"
              :checked="selectedGroups.includes(group.id)"
              @change="toggleGroup(group.id)"
              class="w-4 h-4 text-primary rounded border-border-main focus:ring-primary"
            />
            <span class="text-sm">{{ group.name }}</span>
            <span class="text-xs text-text-sub">({{ group.serviceCount || 0 }})</span>
          </label>
        </div>

        <div class="flex gap-2 mt-4">
          <button
            @click="emit('close')"
            class="flex-1 px-4 py-2 bg-gray-100 text-text-main rounded-md text-sm hover:bg-gray-200"
          >
            取消
          </button>
          <button
            @click="handleExport"
            class="flex-1 px-4 py-2 bg-primary text-white rounded-md text-sm hover:bg-blue-600"
          >
            导出
          </button>
        </div>
      </div>
    </div>
  </div>
</template>
```

- [ ] **Step 2: Commit**

```bash
git add src/components/ExportModal.vue
git commit -m "feat: add export modal"
```

---

## Task 16: 主页面

**Files:**
- Create: `src/views/dashboard/index.vue`

- [ ] **Step 1: 创建主页面**

```vue
<!-- src/views/dashboard/index.vue -->
<script setup lang="ts">
import { onMounted, ref, watch, computed } from 'vue';
import draggable from 'vuedraggable';
import { useNavStore } from '@/stores/navStore';
import { servicesApi } from '@/api/services';
import Sidebar from '@/components/Sidebar.vue';
import ServiceCard from '@/components/ServiceCard.vue';
import ServiceModal from '@/components/ServiceModal.vue';
import GroupModal from '@/components/GroupModal.vue';
import ExportModal from '@/components/ExportModal.vue';
import type { Service, Group } from '@/types';

const store = useNavStore();

const showServiceModal = ref(false);
const showGroupModal = ref(false);
const showExportModal = ref(false);
const editingService = ref<Service | null>(null);
const editingGroup = ref<Group | null>(null);
const searchKeyword = ref('');
const searchedServices = ref<Service[]>([]);

onMounted(() => {
  store.fetchGroups();
});

// 本地服务列表，与 store 同步
const localServices = computed(() => {
  if (searchKeyword.value) {
    return searchedServices.value;
  }
  return store.currentServices;
});

// 监听当前服务变化
watch(() => store.currentServices, () => {
  // localServices 会自动更新
}, { immediate: true });

function handleAddService() {
  editingService.value = null;
  showServiceModal.value = true;
}

function handleEditService(service: Service) {
  editingService.value = service;
  showServiceModal.value = true;
}

function handleEditGroup(group: Group | null) {
  editingGroup.value = group;
  showGroupModal.value = true;
}

async function handleDeleteGroup(id: number) {
  if (confirm('确定删除该分组？分组下的服务也会被删除。')) {
    await store.deleteGroup(id);
  }
}

function handleServiceSaved() {
  store.fetchServices();
}

// 搜索服务
async function handleSearchServices(keyword: string) {
  searchKeyword.value = keyword;
  if (keyword.trim()) {
    const res = await servicesApi.search(keyword);
    searchedServices.value = res.data;
  } else {
    searchedServices.value = [];
  }
}

// 拖拽结束后保存排序
async function onServiceDragEnd(event: any) {
  if (!searchKeyword.value) {
    const items = localServices.value.map((s, i) => ({ id: s.id, group_id: s.group_id }));
    await servicesApi.reorder(items);
    store.fetchServices();
  }
}
</script>

<template>
  <div class="flex h-screen">
    <!-- 侧边栏 -->
    <Sidebar
      @editGroup="handleEditGroup"
      @searchServices="handleSearchServices"
    />

    <!-- 主内容区 -->
    <main class="flex-1 overflow-y-auto p-5">
      <!-- 标题栏 -->
      <div class="flex items-center justify-between mb-4">
        <div>
          <h1 class="text-lg font-semibold text-text-main">
            {{ searchKeyword ? `搜索: ${searchKeyword}` : (store.currentGroup?.name || '请选择分组') }}
          </h1>
          <p class="text-xs text-text-sub mt-0.5">
            {{ localServices.length }} 个服务
          </p>
        </div>
        <div class="flex gap-2">
          <button
            @click="showExportModal = true"
            class="px-4 py-2 bg-gray-100 text-text-main rounded-md text-sm hover:bg-gray-200 flex items-center gap-1"
          >
            <span>📤</span>
            <span>导出</span>
          </button>
          <button
            v-if="store.currentGroupId && !searchKeyword"
            @click="handleAddService"
            class="px-4 py-2 bg-primary text-white rounded-md text-sm hover:bg-blue-600 flex items-center gap-1"
          >
            <span>+</span>
            <span>添加服务</span>
          </button>
        </div>
      </div>

      <!-- 服务卡片网格 -->
      <draggable
        :model-value="localServices"
        @update:model-value="() => {}"
        item-key="id"
        @end="onServiceDragEnd"
        class="grid gap-4"
        style="grid-template-columns: repeat(auto-fill, minmax(220px, 1fr));"
        :disabled="!!searchKeyword"
      >
        <template #item="{ element: service }">
          <ServiceCard :service="service" @edit="handleEditService" />
        </template>
      </draggable>

      <!-- 空状态 -->
      <div
        v-if="(store.currentGroupId || searchKeyword) && localServices.length === 0"
        class="text-center py-20"
      >
        <div class="text-4xl mb-4">📭</div>
        <p class="text-text-sub">
          {{ searchKeyword ? '未找到匹配的服务' : '暂无服务，点击"添加服务"开始' }}
        </p>
      </div>
    </main>

    <!-- 弹窗 -->
    <ServiceModal
      :show="showServiceModal"
      :service="editingService"
      @close="showServiceModal = false"
      @saved="handleServiceSaved"
    />
    <GroupModal
      :show="showGroupModal"
      :group="editingGroup"
      @close="showGroupModal = false"
      @saved="store.fetchGroups"
    />
    <ExportModal
      :show="showExportModal"
      @close="showExportModal = false"
    />
  </div>
</template>
```

- [ ] **Step 2: Commit**

```bash
git add src/views/dashboard/index.vue
git commit -m "feat: add main dashboard with search and proper event handling"
```

---

## Task 17: 构建和测试

**Files:**
- Modify: `package.json` (添加脚本)

- [ ] **Step 1: 构建前端**

Run: `npm run build`
Expected: 前端构建成功，产物在 dist/ 目录

- [ ] **Step 2: 启动生产服务器**

Run: `npm start`
Expected: 服务器启动，访问 http://localhost:3000 可正常使用

- [ ] **Step 3: 功能测试**

手动测试以下功能：
1. 创建分组
2. 添加服务（有凭据）
3. 添加服务（无凭据，纯导航）
4. 点击打开服务，验证剪贴板内容
5. 拖拽排序分组和服务
6. 导出 Markdown

- [ ] **Step 4: 最终 Commit**

```bash
git add .
git commit -m "chore: build and test complete"
```

---

## 总结

本计划包含 17 个任务，按顺序实现：

1. **项目初始化** - package.json 和依赖
2. **数据库层** - SQLite 表结构和操作
3. **分组 API** - CRUD 和排序
4. **服务 API** - CRUD、排序、凭据复制
5. **导出 API** - Markdown 导出
6. **后端入口** - Express 服务器
7. **前端配置** - Vite、Tailwind、TypeScript
8. **前端基础** - 入口文件和类型
9. **API 层** - 前端 API 封装
10. **状态管理** - Pinia store
11. **侧边栏** - 分组列表和拖拽
12. **服务卡片** - 展示和操作
13. **服务弹窗** - 编辑服务
14. **分组弹窗** - 编辑分组
15. **导出弹窗** - 选择分组导出
16. **主页面** - 整合所有组件
17. **构建测试** - 验证功能

预计开发时间：2-3 小时