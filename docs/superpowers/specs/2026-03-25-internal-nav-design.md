# 内部系统导航页 - 设计文档

## 项目概述

一个轻量级的内部系统导航管理工具，用于集中管理和快速访问各类内部系统的登录入口及凭据信息。

**核心功能：**
- 树形分组管理（支持无限层级嵌套）
- 服务卡片展示，包含名称、URL、用户名、密码（凭据可选）
- 拖拽排序（分组和服务均可拖拽，支持跨分组移动）
- 一键打开并复制凭据到剪贴板（有凭据时）
- 纯导航链接支持（无需凭据的常用链接）
- 导出为 Markdown 表格格式

**技术栈：**
- 前端：Vue 3 + Vben Admin + Tailwind CSS
- 后端：Node.js + Express/Koa
- 数据库：SQLite（better-sqlite3）
- 部署：前后端不分离，单一服务

---

## 界面设计

### 整体布局

```
┌─────────────────────────────────────────────────────────────┐
│  顶部导航栏（标题 + 全局操作）                                  │
├──────────────┬──────────────────────────────────────────────┤
│              │                                              │
│   左侧边栏    │              右侧内容区                      │
│   (200px)    │                                              │
│              │   ┌──────────┐ ┌──────────┐ ┌──────────┐     │
│   搜索框      │   │ 服务卡片  │ │ 服务卡片  │ │ 服务卡片  │     │
│              │   └──────────┘ └──────────┘ └──────────┘     │
│   分组列表    │                                              │
│   ├─ 运维系统  │   ┌──────────┐ ┌──────────┐ ┌──────────┐     │
│   ├─ 开发工具  │   │ 服务卡片  │ │ 服务卡片  │ │ 服务卡片  │     │
│   ├─ 内部服务  │   └──────────┘ └──────────┘ └──────────┘     │
│   └─ 测试环境  │                                              │
│              │                                              │
│   [+ 新建分组] │                                              │
└──────────────┴──────────────────────────────────────────────┘
```

### 配色方案（白色简洁主题）

- 背景：`#f8fafc` (浅灰)
- 卡片背景：`#ffffff` (纯白)
- 主色调：`#3b82f6` (蓝色)
- 文字主色：`#1e293b` (深灰)
- 文字次色：`#64748b` (中灰)
- 边框：`#e2e8f0`
- 成功状态：`#22c55e`
- 错误状态：`#ef4444`

### 左侧边栏

- 搜索框：模糊搜索分组和服务名称
- 分组列表：显示分组名称 + 服务数量标记
- 选中分组高亮（蓝色背景）
- 支持拖拽排序分组
- 底部：新建分组按钮

### 右侧内容区

**标题栏：**
- 当前分组名称
- 服务数量
- 添加服务按钮

**服务卡片：**
- 图标（可选，支持 emoji 或 URL）
- 服务名称
- 描述
- 状态指示灯（可扩展健康检查）
- 打开按钮（蓝色主按钮）
  - 有凭据：打开 + 复制凭据
  - 无凭据：仅打开链接
- 编辑按钮（灰色次要按钮）

**卡片网格：**
- 自适应列数（minmax(220px, 1fr)）
- 支持 16px 间距
- 支持拖拽排序
- 支持跨分组拖拽：拖拽服务到左侧分组即移动到该分组

### 交互流程

**打开服务：**
1. 用户点击卡片"打开"按钮
2. 新标签页打开服务 URL
3. 如果有凭据（用户名/密码）：
   - 系统将 username + password 复制到剪贴板（换行分隔格式）
   - 显示 Toast 提示："已复制 xxx 的用户名和密码到剪贴板"
   - 用户在登录页粘贴凭据（需粘贴两次：先用户名，再密码）
4. 如果无凭据（纯导航链接）：
   - 显示 Toast 提示："已打开 xxx"

**剪贴板格式（有凭据时）：**
```
admin
admin123
```

**导出功能：**
1. 点击导出按钮
2. 弹窗显示分组复选框列表
3. 用户勾选要导出的分组
4. 点击确认导出
5. 下载 Markdown 文件

---

## 数据模型

### 表结构

```sql
-- 分组表
CREATE TABLE groups (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  name TEXT NOT NULL,
  parent_id INTEGER REFERENCES groups(id),
  sort_order INTEGER DEFAULT 0,
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
);

-- 服务表
CREATE TABLE services (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  group_id INTEGER NOT NULL REFERENCES groups(id),
  name TEXT NOT NULL,
  url TEXT NOT NULL,
  username TEXT,              -- 可选，纯导航链接无需填写
  password TEXT,              -- 可选，纯导航链接无需填写
  description TEXT,
  icon TEXT,
  sort_order INTEGER DEFAULT 0,
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
);

-- 索引
CREATE INDEX idx_groups_parent ON groups(parent_id);
CREATE INDEX idx_groups_sort ON groups(sort_order);
CREATE INDEX idx_services_group ON services(group_id);
CREATE INDEX idx_services_sort ON services(sort_order);
```

### API 设计

```
GET    /api/groups              # 获取分组树
POST   /api/groups              # 创建分组
PUT    /api/groups/:id          # 更新分组
DELETE /api/groups/:id          # 删除分组
PUT    /api/groups/reorder      # 批量更新排序

GET    /api/services            # 获取服务列表 (?group_id=)
GET    /api/services/:id        # 获取单个服务
POST   /api/services            # 创建服务
PUT    /api/services/:id        # 更新服务（包括移动到其他分组）
DELETE /api/services/:id        # 删除服务
PUT    /api/services/reorder    # 批量更新排序
POST   /api/services/:id/copy   # 复制凭据到剪贴板（返回凭据）

POST   /api/export              # 导出 Markdown
```

### 导出格式示例

```markdown
# 内部系统导航

## 运维系统

| 平台 | URL | 用户名 | 密码 |
|------|-----|--------|------|
| Jenkins | https://jenkins.internal.com | admin | admin123 |
| Grafana | https://grafana.internal.com | admin | grafana456 |

## 开发工具

| 平台 | URL | 用户名 | 密码 |
|------|-----|--------|------|
| GitLab | https://git.internal.com | dev | gitlab789 |

## 常用链接

| 平台 | URL | 用户名 | 密码 |
|------|-----|--------|------|
| Google | https://google.com | - | - |
| GitHub | https://github.com | - | - |
```

> 注：无凭据的纯导航链接，用户名和密码列显示为 "-"

---

## 项目结构

```
cool-bav/
├── server/                  # 后端代码
│   ├── index.js            # 入口文件
│   ├── routes/             # API 路由
│   │   ├── groups.js
│   │   └── services.js
│   ├── models/             # 数据模型
│   │   └── db.js
│   └── middleware/          # 中间件
├── src/                    # 前端代码 (Vben Admin)
│   ├── views/
│   │   ├── dashboard/      # 主页面
│   │   │   └── index.vue
│   │   └── components/     # 组件
│   │       ├── Sidebar.vue
│   │       ├── ServiceCard.vue
│   │       └── ExportModal.vue
│   ├── api/                # API 调用
│   └── store/              # 状态管理
├── dist/                   # 前端构建产物
├── data/                   # SQLite 数据库文件
│   └── nav.db
├── package.json
└── README.md
```

---

## 部署方式

```bash
# 开发
npm run dev          # 同时启动前后端开发服务器

# 构建
npm run build        # 构建前端到 dist/

# 生产
npm start            # 启动后端，同时托管 dist/ 静态文件
```

单一服务，一个端口（默认 3000），访问 http://localhost:3000 即可。

---

## 功能清单

### P0 核心功能
- [ ] 分组管理（CRUD）
- [ ] 树形结构展示
- [ ] 服务管理（CRUD）
- [ ] 一键打开 + 复制凭据
- [ ] 拖拽排序

### P1 重要功能
- [ ] 导出 Markdown
- [ ] 搜索功能

### P2 可选功能
- [ ] 分组图标
- [ ] 服务图标（emoji 或 URL）
- [ ] 健康检查状态指示
- [ ] 深色模式

---

## 安全说明

密码明文存储在 SQLite 数据库中。适用于：
- 个人使用或小团队内部使用
- 部署在内网环境
- 非敏感系统凭据管理

不建议用于生产环境或存储高敏感凭据。