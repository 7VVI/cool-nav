# 导航系统优化实现计划

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 为内部服务导航系统添加暗色主题、视觉区分度、视图切换、在线状态检测等功能

**Architecture:** 前端 Vue 3 + Pinia + Tailwind CSS，后端 Express.js + SQLite (better-sqlite3)，主题通过 CSS 变量切换，在线状态通过后端定时任务检测

**Tech Stack:** Vue 3, Pinia, Tailwind CSS, Express.js, better-sqlite3, node-cron

---

## 文件结构

### 新增文件
- `src/stores/themeStore.ts` - 主题状态管理
- `src/components/ServiceListRow.vue` - 列表视图行组件
- `src/utils/emojiRecommend.ts` - Emoji 推荐算法
- `src/utils/colorUtils.ts` - 颜色处理工具函数
- `server/tasks/statusChecker.ts` - 在线状态检测定时任务

### 修改文件
- `server/database.js` - 新增数据库字段和操作
- `server/routes/services.js` - 服务创建/更新逻辑增强
- `server/routes/groups.js` - 新增视图模式接口
- `server/index.js` - 启动定时任务
- `src/style.css` - 暗色主题 CSS 变量
- `src/types/index.ts` - 类型定义更新
- `src/components/Sidebar.vue` - 主题切换按钮
- `src/components/ServiceCard.vue` - 渐变色条、在线状态、emoji 显示
- `src/components/ServiceModal.vue` - emoji 推荐、accent_color 编辑
- `src/views/dashboard/index.vue` - 视图切换逻辑
- `src/stores/navStore.ts` - 视图模式状态
- `src/api/services.ts` - 新增状态 API
- `src/api/groups.ts` - 新增视图模式 API

---

## Task 1: 数据库 Schema 变更

**Files:**
- Modify: `server/database.js`

- [ ] **Step 1: 添加 services 表新字段**

在 `server/database.js` 中，找到 `CREATE TABLE IF NOT EXISTS services` 语句后，添加新字段的迁移代码：

```javascript
// 在现有 ALTER TABLE tags 代码块后添加：

// 添加 accent_color 列到 services 表（如果不存在）
try {
  db.exec('ALTER TABLE services ADD COLUMN accent_color TEXT DEFAULT NULL');
} catch (e) {
  // 列已存在，忽略错误
}

// 添加 is_online 列到 services 表（如果不存在）
try {
  db.exec('ALTER TABLE services ADD COLUMN is_online INTEGER DEFAULT 1');
} catch (e) {
  // 列已存在，忽略错误
}

// 添加 last_checked_at 列到 services 表（如果不存在）
try {
  db.exec('ALTER TABLE services ADD COLUMN last_checked_at DATETIME DEFAULT NULL');
} catch (e) {
  // 列已存在，忽略错误
}

// 添加 view_mode 列到 groups 表（如果不存在）
try {
  db.exec('ALTER TABLE groups ADD COLUMN view_mode TEXT DEFAULT "card"');
} catch (e) {
  // 列已存在，忽略错误
}
```

- [ ] **Step 2: 更新 serviceOps.create 方法**

修改 `serviceOps.create` 函数，增加 `accent_color` 字段自动生成：

```javascript
// 在 serviceOps 对象中，修改 create 方法：

// 颜色池
const ACCENT_COLORS = [
  '#4ade80', '#f472b6', '#fbbf24', '#38bdf8',
  '#a78bfa', '#fb923c', '#34d399', '#f87171',
  '#22d3ee', '#6366f1', '#ec4899', '#14b8a6'
];

// 生成 accent_color 的函数
function generateAccentColor(id) {
  return ACCENT_COLORS[id % ACCENT_COLORS.length];
}

create: (data) => {
  const tagsJson = JSON.stringify(data.tags || []);
  // 生成 accent_color（基于时间戳模拟 ID，实际使用 lastInsertRowid）
  const tempColor = data.accent_color || ACCENT_COLORS[Math.floor(Math.random() * ACCENT_COLORS.length)];
  const stmt = db.prepare(`
    INSERT INTO services (group_id, name, url, username, password, description, icon, tags, sort_order, accent_color, is_online)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 1)
  `);
  const result = stmt.run(
    data.group_id,
    data.name,
    data.url,
    data.username || null,
    data.password || null,
    data.description || null,
    data.icon || null,
    tagsJson,
    data.sort_order || 0,
    tempColor
  );
  // 使用真实 ID 更新为确定性颜色
  const finalColor = generateAccentColor(result.lastInsertRowid);
  db.prepare('UPDATE services SET accent_color = ? WHERE id = ?').run(finalColor, result.lastInsertRowid);
  return { id: result.lastInsertRowid, tags: data.tags || [], accent_color: finalColor, is_online: true, ...data };
},
```

- [ ] **Step 3: 更新 serviceOps.update 方法**

修改 `serviceOps.update` 函数，支持 `accent_color` 和 `icon` 更新：

```javascript
update: (id, data) => {
  const tagsJson = JSON.stringify(data.tags || []);
  const stmt = db.prepare(`
    UPDATE services SET group_id = ?, name = ?, url = ?, username = ?, password = ?,
    description = ?, icon = ?, tags = ?, sort_order = ?, accent_color = ?, updated_at = CURRENT_TIMESTAMP WHERE id = ?
  `);
  stmt.run(
    data.group_id,
    data.name,
    data.url,
    data.username || null,
    data.password || null,
    data.description || null,
    data.icon || null,
    tagsJson,
    data.sort_order || 0,
    data.accent_color || null,
    id
  );
  return { id, tags: data.tags || [], ...data };
},
```

- [ ] **Step 4: 更新 serviceOps.getById 和 getAll 方法**

修改返回数据包含新字段：

```javascript
getById: (id) => {
  const service = db.prepare('SELECT * FROM services WHERE id = ?').get(id);
  if (service) {
    return {
      ...service,
      tags: service.tags ? JSON.parse(service.tags) : [],
      is_online: service.is_online === 1
    };
  }
  return service;
},

getAll: (groupId = null) => {
  let services;
  if (groupId) {
    services = db.prepare('SELECT * FROM services WHERE group_id = ? ORDER BY sort_order, id').all(groupId);
  } else {
    services = db.prepare('SELECT * FROM services ORDER BY sort_order, id').all();
  }
  return services.map(s => ({
    ...s,
    tags: s.tags ? JSON.parse(s.tags) : [],
    is_online: s.is_online === 1
  }));
},
```

- [ ] **Step 5: 添加 groupOps.updateViewMode 方法**

在 `groupOps` 对象中添加新方法：

```javascript
updateViewMode: (id, viewMode) => {
  db.prepare('UPDATE groups SET view_mode = ?, updated_at = CURRENT_TIMESTAMP WHERE id = ?').run(viewMode, id);
  return { id, view_mode: viewMode };
},
```

- [ ] **Step 6: 更新 groupOps.getById 和 getAll 方法**

修改返回数据包含 `view_mode` 字段：

```javascript
// 在 getAll 和 getById 返回时确保包含 view_mode 字段（ALTER TABLE 已添加）
// 无需额外代码，SELECT * 会自动包含新列
```

- [ ] **Step 7: 导出 generateAccentColor 函数**

在文件末尾导出颜色生成函数供其他模块使用：

```javascript
export { generateAccentColor };
```

- [ ] **Step 8: 提交数据库变更**

```bash
git add server/database.js
git commit -m "feat(db): add accent_color, is_online, view_mode fields"

Co-Authored-By: Claude Opus 4.6 <noreply@anthropic.com>
```

---

## Task 2: 后端 API 增强

**Files:**
- Modify: `server/routes/services.js`
- Modify: `server/routes/groups.js`

- [ ] **Step 1: 修改 services.js 创建接口**

修改 POST `/` 路由，自动生成 accent_color 和推荐 icon：

```javascript
// 在文件顶部导入
import { generateAccentColor } from '../database.js';

// Emoji 推荐映射表
const EMOJI_MAP = {
  'crm': '📊', '农机': '🚜', '文档': '📄', 'erp': '🏢',
  'mqtt': '📶', '物联网': '📡', '水文': '💧', '成本': '💰',
  '应收': '💵', '售后': '🔧', '平台': '🌐', '后台': '⚙️',
  'admin': '🔐', 'api': '🔗', '日志': '🗂', '监控': '👁',
  '地图': '🗺', 'gps': '📍', '定位': '🎯', '博客': '📝',
  '文章': '📰', '媒体': '📣', 'fms': '📦', '仓库': '🏭',
  '测试': '🧪', '开发': '💻', '生产': '🟢', '预生产': '🟡',
};

function recommendEmoji(name) {
  const lowerName = name.toLowerCase();
  for (const [keyword, emoji] of Object.entries(EMOJI_MAP)) {
    if (lowerName.includes(keyword.toLowerCase())) {
      return emoji;
    }
  }
  return '🖥️';
}

// 修改 POST '/' 路由
router.post('/', (req, res) => {
  const { group_id, name, url, username, password, description, icon, tags } = req.body;
  if (!group_id || !name || !url) {
    return res.status(400).json({ success: false, message: '分组、名称和URL不能为空' });
  }
  // 自动生成 accent_color 和推荐 icon
  const recommendedIcon = icon || recommendEmoji(name);
  const service = serviceOps.create({
    group_id, name, url,
    username: username || null,
    password: password || null,
    description: description || null,
    icon: recommendedIcon,
    tags: tags || []
  });
  res.status(201).json({ success: true, data: service });
});
```

- [ ] **Step 2: 修改 services.js 更新接口**

修改 PUT `/:id` 路由，支持 accent_color 更新：

```javascript
router.put('/:id', (req, res) => {
  const { group_id, name, url, username, password, description, icon, tags, sort_order, accent_color } = req.body;
  if (!group_id || !name || !url) {
    return res.status(400).json({ success: false, message: '分组、名称和URL不能为空' });
  }
  const service = serviceOps.update(parseInt(req.params.id), {
    group_id, name, url,
    username: username || null,
    password: password || null,
    description: description || null,
    icon: icon || null,
    tags: tags || [],
    sort_order: sort_order || 0,
    accent_color: accent_color || null
  });
  res.json({ success: true, data: service });
});
```

- [ ] **Step 3: 添加 services.js 状态批量查询接口**

添加 GET `/status` 路由：

```javascript
// 在 reorder 路由后添加
router.get('/status', (req, res) => {
  const services = serviceOps.getAll();
  const statusData = services.map(s => ({
    id: s.id,
    is_online: s.is_online,
    last_checked_at: s.last_checked_at
  }));
  res.json({ success: true, data: statusData });
});
```

- [ ] **Step 4: 添加 groups.js 视图模式更新接口**

在 `server/routes/groups.js` 添加 PUT `/:id/view-mode` 路由：

```javascript
// 在 reorder 路由后添加
import { groupOps } from '../database.js';

router.put('/:id/view-mode', (req, res) => {
  const { view_mode } = req.body;
  if (!view_mode || !['card', 'list'].includes(view_mode)) {
    return res.status(400).json({ success: false, message: '视图模式必须是 card 或 list' });
  }
  const group = groupOps.updateViewMode(parseInt(req.params.id), view_mode);
  res.json({ success: true, data: group });
});
```

- [ ] **Step 5: 提交 API 变更**

```bash
git add server/routes/services.js server/routes/groups.js
git commit -m "feat(api): add accent_color auto-gen, emoji recommend, view-mode API"

Co-Authored-By: Claude Opus 4.6 <noreply@anthropic.com>
```

---

## Task 3: 在线状态检测定时任务

**Files:**
- Create: `server/tasks/statusChecker.ts`

- [ ] **Step 1: 创建 statusChecker.js 文件**

创建 `server/tasks/statusChecker.js`（注意使用 .js 后缀与项目一致）：

```javascript
// server/tasks/statusChecker.js
import db from '../database.js';

const STATUS_CHECK_INTERVAL = 5 * 60 * 1000; // 5 分钟
const FAILURE_THRESHOLD = 3;

// 存储连续失败次数
const failureCount = new Map();

async function checkServiceStatus(service) {
  try {
    const response = await fetch(service.url, {
      method: 'GET',
      signal: AbortSignal.timeout(5000) // 5 秒超时
    });
    
    if (response.ok || response.status < 500) {
      // 2xx, 3xx, 4xx 都算在线（服务在响应）
      return true;
    }
    return false;
  } catch (error) {
    return false;
  }
}

async function checkAllServices() {
  console.log('[StatusChecker] Starting status check...');
  const services = db.prepare('SELECT id, url FROM services WHERE url IS NOT NULL').all();
  
  for (const service of services) {
    const isOnline = await checkServiceStatus(service);
    const currentFailures = failureCount.get(service.id) || 0;
    
    if (isOnline) {
      failureCount.set(service.id, 0);
      db.prepare('UPDATE services SET is_online = 1, last_checked_at = CURRENT_TIMESTAMP WHERE id = ?').run(service.id);
    } else {
      const newFailures = currentFailures + 1;
      failureCount.set(service.id, newFailures);
      
      if (newFailures >= FAILURE_THRESHOLD) {
        db.prepare('UPDATE services SET is_online = 0, last_checked_at = CURRENT_TIMESTAMP WHERE id = ?').run(service.id);
      }
    }
  }
  
  console.log(`[StatusChecker] Checked ${services.length} services`);
}

export function startStatusChecker() {
  // 启动时立即检查一次
  checkAllServices().catch(err => console.error('[StatusChecker] Error:', err));
  
  // 定时检查
  const intervalId = setInterval(() => {
    checkAllServices().catch(err => console.error('[StatusChecker] Error:', err));
  }, STATUS_CHECK_INTERVAL);
  
  console.log('[StatusChecker] Started, interval: 5 minutes');
  return intervalId;
}

export default { startStatusChecker, checkAllServices };
```

- [ ] **Step 2: 在 server/index.js 启动定时任务**

修改 `server/index.js`：

```javascript
// 在文件顶部导入
import { startStatusChecker } from './tasks/statusChecker.js';

// 在 app.listen 后启动定时任务
app.listen(PORT, () => {
  console.log(`Server running at http://localhost:${PORT}`);
  startStatusChecker();
});
```

- [ ] **Step 3: 提交定时任务代码**

```bash
git add server/tasks/statusChecker.js server/index.js
git commit -m "feat(status): add service online status checker task"

Co-Authored-By: Claude Opus 4.6 <noreply@anthropic.com>
```

---

## Task 4: 前端类型定义更新

**Files:**
- Modify: `src/types/index.ts`

- [ ] **Step 1: 更新 Service 类型**

```typescript
export interface Service {
  id: number;
  group_id: number;
  name: string;
  url: string;
  username: string | null;
  password: string | null;
  description: string | null;
  icon: string | null;
  tags: string[] | null;
  accent_color: string | null;  // 新增
  is_online: boolean;           // 新增
  last_checked_at: string | null; // 新增
  sort_order: number;
  created_at: string;
  updated_at: string;
}
```

- [ ] **Step 2: 更新 Group 类型**

```typescript
export interface Group {
  id: number;
  name: string;
  color: string;
  parent_id: number | null;
  view_mode: 'card' | 'list';  // 新增
  sort_order: number;
  created_at: string;
  updated_at: string;
  serviceCount?: number;
}
```

- [ ] **Step 3: 提交类型更新**

```bash
git add src/types/index.ts
git commit -m "feat(types): add accent_color, is_online, view_mode types"

Co-Authored-By: Claude Opus 4.6 <noreply@anthropic.com>
```

---

## Task 5: 前端 API 更新

**Files:**
- Modify: `src/api/services.ts`
- Modify: `src/api/groups.ts`

- [ ] **Step 1: 更新 services.ts 添加状态 API**

```typescript
// 在现有 API 函数后添加

async getStatus(): Promise<ApiResponse<{ id: number; is_online: boolean; last_checked_at: string | null }[]>> {
  const res = await request.get('/services/status');
  return res.data;
}
```

- [ ] **Step 2: 更新 groups.ts 添加视图模式 API**

```typescript
// 在现有 API 函数后添加

async updateViewMode(id: number, viewMode: 'card' | 'list'): Promise<ApiResponse<Group>> {
  const res = await request.put(`/groups/${id}/view-mode`, { view_mode: viewMode });
  return res.data;
}
```

- [ ] **Step 3: 提交 API 更新**

```bash
git add src/api/services.ts src/api/groups.ts
git commit -m "feat(api): add getStatus and updateViewMode APIs"

Co-Authored-By: Claude Opus 4.6 <noreply@anthropic.com>
```

---

## Task 6: 暗色主题 CSS 变量

**Files:**
- Modify: `src/style.css`

- [ ] **Step 1: 添加暗色主题 CSS 变量**

在 `src/style.css` 的 `:root` 块后添加暗色主题变量：

```css
/* 暗色主题 */
[data-theme="dark"] {
  --bg: #0d0f14;
  --surface: #13161e;
  --surface2: #1a1e28;
  --surface3: #22272e;
  --border: rgba(255,255,255,0.07);
  --border2: rgba(255,255,255,0.12);

  --text: #e8eaf0;
  --text2: #9ca3af;
  --text3: #6b7280;

  --accent: #38bdf8;
  --accent2: #7dd3fc;
  --accent-bg: rgba(56,189,248,0.1);
  --accent-border: rgba(56,189,248,0.2);

  --green: #4ade80;
  --green-bg: rgba(74,222,128,0.12);
  --green-border: rgba(74,222,128,0.2);

  --red: #f87171;
  --red-bg: rgba(248,113,113,0.12);
  --red-border: rgba(248,113,113,0.2);

  --amber: #fbbf24;
  --amber-bg: rgba(251,191,36,0.12);
  --amber-border: rgba(251,191,36,0.2);

  --purple: #a78bfa;
  --purple-bg: rgba(167,139,250,0.12);
  --purple-border: rgba(167,139,250,0.2);

  --cyan: #22d3ee;
  --cyan-bg: rgba(34,211,238,0.12);
  --cyan-border: rgba(34,211,238,0.2);

  --shadow-xs: 0 1px 2px rgba(0,0,0,.3);
  --shadow-sm: 0 1px 4px rgba(0,0,0,.4), 0 1px 2px rgba(0,0,0,.3);
  --shadow: 0 4px 16px rgba(0,0,0,.5), 0 1px 4px rgba(0,0,0,.3);
  --shadow-lg: 0 12px 40px rgba(0,0,0,.6), 0 4px 12px rgba(0,0,0,.4);
  --shadow-card: 0 0 0 1px var(--border), 0 2px 8px rgba(0,0,0,.4);
}

/* 在线状态脉冲动画 */
@keyframes pulse {
  0%, 100% { opacity: 1; box-shadow: 0 0 0 0 rgba(74,222,128,0.4); }
  50% { opacity: 0.8; box-shadow: 0 0 0 4px rgba(74,222,128,0); }
}

.pulse-dot {
  width: 6px;
  height: 6px;
  border-radius: 50%;
  background: var(--green);
  animation: pulse 2s infinite;
}
```

- [ ] **Step 2: 提交 CSS 变更**

```bash
git add src/style.css
git commit -m "feat(css): add dark theme CSS variables"

Co-Authored-By: Claude Opus 4.6 <noreply@anthropic.com>
```

---

## Task 7: 主题状态管理

**Files:**
- Create: `src/stores/themeStore.ts`

- [ ] **Step 1: 创建 themeStore.ts**

```typescript
// src/stores/themeStore.ts
import { defineStore } from 'pinia';
import { ref, computed, watch } from 'vue';

export type ThemeMode = 'light' | 'dark' | 'system';

export const useThemeStore = defineStore('theme', () => {
  const mode = ref<ThemeMode>((localStorage.getItem('theme-mode') as ThemeMode) || 'system');

  // 计算实际生效的主题
  const effectiveTheme = computed(() => {
    if (mode.value === 'system') {
      return window.matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light';
    }
    return mode.value;
  });

  // 应用主题到 DOM
  function applyTheme() {
    document.documentElement.setAttribute('data-theme', effectiveTheme.value);
  }

  // 设置主题模式
  function setMode(newMode: ThemeMode) {
    mode.value = newMode;
    localStorage.setItem('theme-mode', newMode);
    applyTheme();
  }

  // 初始化：监听系统主题变化
  function init() {
    applyTheme();
    
    // 监听系统主题变化
    const mediaQuery = window.matchMedia('(prefers-color-scheme: dark)');
    mediaQuery.addEventListener('change', (e) => {
      if (mode.value === 'system') {
        applyTheme();
      }
    });

    // 监听本地模式变化
    watch(mode, () => {
      applyTheme();
    });
  }

  // 切换主题（快捷切换）
  function toggle() {
    const current = effectiveTheme.value;
    setMode(current === 'dark' ? 'light' : 'dark');
  }

  return {
    mode,
    effectiveTheme,
    setMode,
    toggle,
    init
  };
});
```

- [ ] **Step 2: 在 main.ts 初始化主题**

修改 `src/main.ts`：

```typescript
// 在现有导入后添加
import { useThemeStore } from '@/stores/themeStore';

// 在 app.mount('#app') 后添加
const themeStore = useThemeStore();
themeStore.init();
```

- [ ] **Step 3: 提交主题 Store**

```bash
git add src/stores/themeStore.ts src/main.ts
git commit -m "feat(theme): add theme store with system follow support"

Co-Authored-By: Claude Opus 4.6 <noreply@anthropic.com>
```

---

## Task 8: 侧边栏主题切换按钮

**Files:**
- Modify: `src/components/Sidebar.vue`

- [ ] **Step 1: 导入 themeStore**

在 Sidebar.vue script 部分添加：

```typescript
import { useThemeStore } from '@/stores/themeStore';

const themeStore = useThemeStore();
```

- [ ] **Step 2: 在侧边栏底部添加主题切换按钮**

在 sidebar-footer 区域的导入/导出/退出按钮后添加主题切换按钮：

```vue
<!-- 在 sidebar-footer 内，退出按钮后添加 -->
<button
  @click="themeStore.toggle()"
  class="footer-btn theme-btn"
  :title="themeStore.effectiveTheme === 'dark' ? '切换到亮色' : '切换到暗色'"
>
  <svg v-if="themeStore.effectiveTheme === 'dark'" width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round">
    <circle cx="12" cy="12" r="5"/>
    <line x1="12" y1="1" x2="12" y2="3"/>
    <line x1="12" y1="21" x2="12" y2="23"/>
    <line x1="4.22" y1="4.22" x2="5.64" y2="5.64"/>
    <line x1="18.36" y1="18.36" x2="19.78" y2="19.78"/>
    <line x1="1" y1="12" x2="3" y2="12"/>
    <line x1="21" y1="12" x2="23" y2="12"/>
    <line x1="4.22" y1="19.78" x2="5.64" y2="18.36"/>
    <line x1="18.36" y1="5.64" x2="19.78" y2="4.22"/>
  </svg>
  <svg v-else width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round">
    <path d="M21 12.79A9 9 0 1 1 11.21 3 7 7 0 0 0 21 12.79z"/>
  </svg>
  <span>{{ themeStore.effectiveTheme === 'dark' ? '亮色' : '暗色' }}</span>
</button>
```

- [ ] **Step 3: 添加按钮样式**

在 scoped style 中添加：

```css
.theme-btn {
  flex-shrink: 0;
}

.sidebar.collapsed .theme-btn {
  display: none;
}
```

- [ ] **Step 4: 提交主题切换按钮**

```bash
git add src/components/Sidebar.vue
git commit -m "feat(ui): add theme toggle button in sidebar"

Co-Authored-By: Claude Opus 4.6 <noreply@anthropic.com>
```

---

## Task 9: ServiceCard 渐变色条和在线状态

**Files:**
- Modify: `src/components/ServiceCard.vue`

- [ ] **Step 1: 添加渐变色条计算函数**

在 script setup 中添加：

```typescript
// 计算渐变色条
const accentGradient = computed(() => {
  const color = props.service.accent_color || '#3b6ef8';
  // 转换为稍深色
  const r = parseInt(color.slice(1, 3), 16);
  const g = parseInt(color.slice(3, 5), 16);
  const b = parseInt(color.slice(5, 7), 16);
  const darkerColor = `#${Math.max(0, r - 30).toString(16).padStart(2, '0')}${Math.max(0, g - 30).toString(16).padStart(2, '0')}${Math.max(0, b - 30).toString(16).padStart(2, '0')}`;
  return `linear-gradient(90deg, ${color}, ${darkerColor})`;
});
```

- [ ] **Step 2: 在卡片顶部添加渐变色条**

在 ServiceCard.vue template 中，在卡片容器 div 内部最顶部添加：

```vue
<!-- 在 <div class="service-card"> 内部最顶部添加 -->
<div
  class="accent-bar"
  :style="{ background: accentGradient }"
></div>
```

- [ ] **Step 3: 添加在线状态显示**

在卡片头部区域（icon 后面）添加在线状态指示：

```vue
<!-- 在 card-header div 内，meta div 后添加 -->
<div v-if="service.is_online" class="online-badge">
  <span class="pulse-dot"></span>
  <span class="online-text">在线</span>
</div>
```

- [ ] **Step 4: 更新图标显示**

确保 icon 显示正确（已有 getDisplayIcon 函数），修改 template 中 icon 显示：

```vue
<!-- icon 区域 -->
<div
  class="service-icon"
  :style="{ background: hexToRgba(props.service.accent_color || groupColor, 0.1) }"
>
  {{ service.icon || '🖥️' }}
</div>
```

- [ ] **Step 5: 添加相关样式**

在 scoped style 中添加：

```css
.accent-bar {
  height: 3px;
  width: 100%;
  border-radius: 16px 16px 0 0;
  flex-shrink: 0;
}

.service-card {
  border-radius: 16px;
  /* 确保圆角正确 */
}

.service-icon {
  width: 40px;
  height: 40px;
  border-radius: 10px;
  display: flex;
  align-items: center;
  justify-content: center;
  font-size: 20px;
  flex-shrink: 0;
}

.online-badge {
  display: flex;
  align-items: center;
  gap: 4px;
  font-size: 10px;
  color: var(--green);
  flex-shrink: 0;
}

.online-text {
  font-weight: 500;
}
```

- [ ] **Step 6: 提交 ServiceCard 变更**

```bash
git add src/components/ServiceCard.vue
git commit -m "feat(card): add accent gradient bar and online status indicator"

Co-Authored-By: Claude Opus 4.6 <noreply@anthropic.com>
```

---

## Task 10: 列表视图组件

**Files:**
- Create: `src/components/ServiceListRow.vue`

- [ ] **Step 1: 创建 ServiceListRow.vue**

```vue
<script setup lang="ts">
import { computed } from 'vue';
import type { Service } from '@/types';
import { useNavStore } from '@/stores/navStore';
import { tagsApi, type Tag } from '@/api/tags';
import { ref, onMounted } from 'vue';

const props = defineProps<{
  service: Service;
  selectable?: boolean;
  selected?: boolean;
}>();

const emit = defineEmits<{
  edit: [service: Service];
  delete: [service: Service];
  toggleSelect: [service: Service];
}>();

const store = useNavStore();
const allTags = ref<Tag[]>([]);

onMounted(async () => {
  try {
    const res = await tagsApi.getAll();
    allTags.value = res.data || [];
  } catch (error) {
    console.error('Failed to load tags:', error);
  }
});

const hasCredentials = computed(() => {
  return props.service.username || props.service.password;
});

const serviceTags = computed(() => {
  const tags = props.service.tags || [];
  return tags.map(tagValue => {
    const tag = allTags.value.find(t => t.value === tagValue);
    return tag || { value: tagValue, name: tagValue, color: '#6b7280' };
  });
});

function trimUrl(url: string) {
  try {
    return new URL(url).hostname;
  } catch {
    return url.slice(0, 40);
  }
}

function hexToRgba(hex: string, alpha: number) {
  const r = parseInt(hex.slice(1, 3), 16);
  const g = parseInt(hex.slice(3, 5), 16);
  const b = parseInt(hex.slice(5, 7), 16);
  return `rgba(${r}, ${g}, ${b}, ${alpha})`;
}

function openUrl() {
  if (props.service.url) {
    window.open(props.service.url, '_blank');
  }
}

function handleRowClick() {
  if (props.selectable) {
    emit('toggleSelect', props.service);
  } else {
    openUrl();
  }
}
</script>

<template>
  <div
    class="list-row"
    :class="{ 'row-selected': selected }"
    @click="handleRowClick"
  >
    <!-- 选择框 -->
    <div v-if="selectable" class="select-checkbox">
      <button
        @click.stop="emit('toggleSelect', service)"
        class="checkbox-btn"
        :class="{ checked: selected }"
      >
        <svg v-if="selected" width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="white" stroke-width="3">
          <polyline points="20 6 9 17 4 12"/>
        </svg>
      </button>
    </div>

    <!-- 图标 -->
    <div
      class="list-icon"
      :style="{ background: hexToRgba(service.accent_color || '#3b6ef8', 0.1) }"
    >
      {{ service.icon || '🖥️' }}
    </div>

    <!-- 名称 -->
    <div class="list-name">{{ service.name }}</div>

    <!-- URL -->
    <div class="list-url font-mono">{{ trimUrl(service.url) }}</div>

    <!-- 标签 -->
    <div class="list-tags">
      <span
        v-for="tag in serviceTags.slice(0, 2)"
        :key="tag.value"
        class="list-tag"
        :style="{ background: tag.color + '20', color: tag.color, borderColor: tag.color + '40' }"
      >
        {{ tag.name }}
      </span>
    </div>

    <!-- 凭据状态 -->
    <div class="list-auth">
      <span class="auth-dot" :class="hasCredentials ? 'has-cred' : 'no-cred'"></span>
      <span class="auth-text">{{ hasCredentials ? '有凭据' : '无凭据' }}</span>
    </div>

    <!-- 在线状态 -->
    <div v-if="service.is_online" class="list-online">
      <span class="pulse-dot"></span>
    </div>

    <!-- 操作按钮 -->
    <div class="list-actions">
      <button
        @click.stop="openUrl"
        class="list-open-btn"
        :style="{ background: hexToRgba(service.accent_color || '#3b6ef8', 0.15), color: service.accent_color || '#3b6ef8' }"
      >
        打开
      </button>
      <button
        @click.stop="emit('edit', service)"
        class="list-edit-btn"
        title="编辑"
      >
        <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5">
          <path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"/>
          <path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z"/>
        </svg>
      </button>
      <button
        @click.stop="emit('delete', service)"
        class="list-delete-btn"
        title="删除"
      >
        <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5">
          <polyline points="3 6 5 6 21 6"/>
          <path d="M19 6l-1 14a2 2 0 0 1-2 2H8a2 2 0 0 1-2-2L5 6"/>
        </svg>
      </button>
    </div>
  </div>
</template>

<style scoped>
.list-row {
  display: flex;
  align-items: center;
  gap: 12px;
  padding: 12px 16px;
  background: var(--surface);
  border: 1px solid var(--border);
  border-radius: 12px;
  cursor: pointer;
  transition: all 0.15s ease;
}

.list-row:hover {
  border-color: var(--border2);
  background: var(--surface2);
  transform: translateX(2px);
}

.row-selected {
  border-color: var(--accent);
  box-shadow: 0 0 0 2px var(--accent-bg);
}

.select-checkbox {
  flex-shrink: 0;
}

.checkbox-btn {
  width: 18px;
  height: 18px;
  border-radius: 4px;
  border: 2px solid var(--border2);
  background: var(--surface);
  display: flex;
  align-items: center;
  justify-content: center;
  cursor: pointer;
  transition: all 0.15s;
}

.checkbox-btn.checked {
  background: var(--accent);
  border-color: var(--accent);
}

.list-icon {
  width: 34px;
  height: 34px;
  border-radius: 8px;
  display: flex;
  align-items: center;
  justify-content: center;
  font-size: 16px;
  flex-shrink: 0;
  border: 1px solid var(--border);
}

.list-name {
  font-size: 13px;
  font-weight: 600;
  color: var(--text);
  width: 140px;
  flex-shrink: 0;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.list-url {
  font-size: 11px;
  color: var(--text3);
  flex: 1;
  min-width: 0;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.list-tags {
  display: flex;
  gap: 4px;
  flex-shrink: 0;
}

.list-tag {
  font-size: 10px;
  padding: 2px 6px;
  border-radius: 4px;
  border: 1px solid;
}

.list-auth {
  display: flex;
  align-items: center;
  gap: 4px;
  font-size: 11px;
  flex-shrink: 0;
  width: 70px;
}

.auth-dot {
  width: 6px;
  height: 6px;
  border-radius: 50%;
}

.auth-dot.has-cred {
  background: var(--green);
}

.auth-dot.no-cred {
  background: var(--text3);
}

.auth-text {
  color: var(--text2);
}

.list-online {
  flex-shrink: 0;
  width: 20px;
}

.list-actions {
  display: flex;
  gap: 6px;
  flex-shrink: 0;
}

.list-open-btn {
  padding: 5px 12px;
  border-radius: 6px;
  border: none;
  font-size: 11px;
  font-weight: 600;
  cursor: pointer;
  transition: opacity 0.15s;
}

.list-open-btn:hover {
  opacity: 0.85;
}

.list-edit-btn,
.list-delete-btn {
  width: 28px;
  height: 28px;
  border-radius: 6px;
  border: 1px solid var(--border);
  background: var(--surface);
  color: var(--text3);
  display: flex;
  align-items: center;
  justify-content: center;
  cursor: pointer;
  transition: all 0.15s;
}

.list-edit-btn:hover {
  background: var(--surface2);
  color: var(--text);
}

.list-delete-btn:hover {
  background: var(--red-bg);
  color: var(--red);
  border-color: var(--red-border);
}
</style>
```

- [ ] **Step 2: 提交列表视图组件**

```bash
git add src/components/ServiceListRow.vue
git commit -m "feat(ui): add ServiceListRow component for list view"

Co-Authored-By: Claude Opus 4.6 <noreply@anthropic.com>
```

---

## Task 11: Dashboard 视图切换集成

**Files:**
- Modify: `src/views/dashboard/index.vue`
- Modify: `src/stores/navStore.ts`

- [ ] **Step 1: 导入 ServiceListRow 和 groupsApi**

在 dashboard/index.vue script 中添加导入：

```typescript
import ServiceListRow from '@/components/ServiceListRow.vue';
import { groupsApi } from '@/api/groups';
```

- [ ] **Step 2: 添加视图模式状态**

添加 viewMode 状态变量：

```typescript
const viewMode = ref<'card' | 'list'>('card');
```

- [ ] **Step 3: 添加视图切换逻辑**

添加 setViewMode 函数和监听分组变化：

```typescript
// 切换视图模式
async function setViewMode(mode: 'card' | 'list') {
  viewMode.value = mode;
  if (store.currentGroupId) {
    try {
      await groupsApi.updateViewMode(store.currentGroupId, mode);
      // 更新本地 store
      const group = store.groups.find(g => g.id === store.currentGroupId);
      if (group) {
        group.view_mode = mode;
      }
    } catch (error) {
      console.error('Failed to update view mode:', error);
    }
  }
}

// 监听分组变化，读取视图偏好
watch(() => store.currentGroupId, (id) => {
  if (id) {
    const group = store.groups.find(g => g.id === id);
    viewMode.value = group?.view_mode || 'card';
  }
  // 清除选择
  selectedServices.value.clear();
  selectMode.value = false;
}, { immediate: true });
```

- [ ] **Step 4: 在 header 中添加视图切换按钮**

在 header 的操作按钮区域添加：

```vue
<!-- 在 header div 内，第一个 div 后添加 -->
<div class="view-toggle">
  <button
    @click="setViewMode('card')"
    class="view-btn"
    :class="{ active: viewMode === 'card' }"
  >
    <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5">
      <rect x="3" y="3" width="7" height="7"/>
      <rect x="14" y="3" width="7" height="7"/>
      <rect x="14" y="14" width="7" height="7"/>
      <rect x="3" y="14" width="7" height="7"/>
    </svg>
    卡片
  </button>
  <button
    @click="setViewMode('list')"
    class="view-btn"
    :class="{ active: viewMode === 'list' }"
  >
    <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5">
      <line x1="3" y1="6" x2="21" y2="6"/>
      <line x1="3" y1="12" x2="21" y2="12"/>
      <line x1="3" y1="18" x2="21" y2="18"/>
    </svg>
    列表
  </button>
</div>
```

- [ ] **Step 5: 添加列表视图渲染区域**

在服务网格区域后添加列表视图：

```vue
<!-- 列表视图 -->
<div v-if="viewMode === 'list'" class="list-view-container">
  <div v-if="store.loading || isSearching" class="flex flex-col items-center justify-center py-20">
    <div class="w-8 h-8 border-2 rounded-full animate-spin" style="border-color: var(--border2); border-top-color: var(--accent)"></div>
    <p class="mt-3" style="color: var(--text3)">加载中...</p>
  </div>
  
  <template v-else-if="displayServices.length > 0">
    <ServiceListRow
      v-for="service in displayServices"
      :key="service.id"
      :service="service"
      :selectable="selectMode"
      :selected="selectedServices.has(service.id)"
      @edit="handleEditService"
      @delete="handleDeleteService"
      @toggleSelect="toggleServiceSelection"
    />
  </template>
  
  <div v-else class="flex flex-col items-center justify-center py-16">
    <div class="text-4xl mb-3">🔍</div>
    <h3 class="text-[15px] font-semibold mb-1" style="color: var(--text2)">暂无服务</h3>
  </div>
</div>
```

- [ ] **Step 6: 修改卡片视图条件**

修改现有卡片网格的条件判断：

```vue
<!-- 卡片视图 -->
<div
  v-if="viewMode === 'card' && !store.loading && !isSearching"
  ...
>
```

- [ ] **Step 7: 添加视图切换按钮样式**

在 scoped style 中添加：

```css
.view-toggle {
  display: flex;
  background: var(--surface);
  border: 1px solid var(--border);
  border-radius: 8px;
  overflow: hidden;
}

.view-btn {
  display: flex;
  align-items: center;
  gap: 4px;
  padding: 6px 12px;
  border: none;
  background: transparent;
  color: var(--text3);
  font-size: 12px;
  font-weight: 500;
  cursor: pointer;
  transition: all 0.15s;
}

.view-btn:hover {
  background: var(--surface2);
}

.view-btn.active {
  background: var(--surface2);
  color: var(--text);
}

.list-view-container {
  display: flex;
  flex-direction: column;
  gap: 8px;
}
```

- [ ] **Step 8: 提交视图切换功能**

```bash
git add src/views/dashboard/index.vue
git commit -m "feat(ui): add view toggle (card/list) with per-group preference"

Co-Authored-By: Claude Opus 4.6 <noreply@anthropic.com>
```

---

## Task 12: ServiceModal Emoji 推荐

**Files:**
- Modify: `src/components/ServiceModal.vue`

- [ ] **Step 1: 添加 Emoji 推荐函数**

在 script setup 中添加：

```typescript
// Emoji 推荐映射表
const EMOJI_RECOMMEND_MAP: Record<string, string> = {
  'crm': '📊', '农机': '🚜', '文档': '📄', 'erp': '🏢',
  'mqtt': '📶', '物联网': '📡', '水文': '💧', '成本': '💰',
  '应收': '💵', '售后': '🔧', '平台': '🌐', '后台': '⚙️',
  'admin': '🔐', 'api': '🔗', '日志': '🗂', '监控': '👁',
  '地图': '🗺', 'gps': '📍', '定位': '🎯', '博客': '📝',
  '文章': '📰', '媒体': '📣', 'fms': '📦', '仓库': '🏭',
  '测试': '🧪', '开发': '💻', '生产': '🟢', '预生产': '🟡',
};

function recommendEmoji(name: string): string {
  const lowerName = name.toLowerCase();
  for (const [keyword, emoji] of Object.entries(EMOJI_RECOMMEND_MAP)) {
    if (lowerName.includes(keyword.toLowerCase())) {
      return emoji;
    }
  }
  return '🖥️';
}

// 监听名称变化，自动推荐 emoji
watch(() => formData.value.name, (newName) => {
  if (newName && !isEditing.value) {
    // 新增服务时，根据名称自动推荐
    const recommended = recommendEmoji(newName);
    if (!selectedEmoji.value || selectedEmoji.value === EMOJIS[0]) {
      selectedEmoji.value = recommended;
    }
  }
});
```

- [ ] **Step 2: 扩展 Emoji 列表**

修改 EMOJIS 数组：

```typescript
const EMOJIS = [
  '🖥️','🔧','📊','📦','🔒','🌐','💼','📁','🚀','⚙️',
  '🔗','📋','🗄️','📡','💡','🔑','🏢','📈','🛠️','🎯',
  '🔮','⚡','🧩','🌿','🚜','📄','📶','💧','💰','💵',
  '🗺','📍','🗂','👁','📝','📰','📣','🏭','🧪','💻',
  '🟢','🟡','🔐'
];
```

- [ ] **Step 3: 添加主题色编辑区域**

在表单中添加 accent_color 编辑（可选）：

```vue
<!-- 在 Tags 区域后添加 -->
<div class="mb-4">
  <label class="block text-xs font-semibold mb-1.5" style="color: var(--text2)">主题色</label>
  <div class="flex items-center gap-2">
    <input
      v-model="formData.accent_color"
      type="color"
      class="w-10 h-8 rounded border cursor-pointer"
      style="border-color: var(--border)"
    />
    <input
      v-model="formData.accent_color"
      type="text"
      class="flex-1 px-2.5 py-2 border rounded-lg text-[13px] outline-none font-mono"
      style="border-color: var(--border); color: var(--text); background: var(--surface)"
      placeholder="#3b6ef8"
    />
    <button
      type="button"
      @click="formData.accent_color = ''"
      class="px-2 py-1.5 rounded text-[11px] border"
      style="border-color: var(--border); color: var(--text3)"
    >
      自动
    </button>
  </div>
  <p class="text-[11px] mt-1" style="color: var(--text3)">留空则自动生成独特颜色</p>
</div>
```

- [ ] **Step 4: 更新 formData 和提交逻辑**

修改 formData 添加 accent_color：

```typescript
const formData = ref({
  group_id: 0,
  name: '',
  url: '',
  username: '',
  password: '',
  description: '',
  icon: '',
  accent_color: ''  // 新增
});

// 在 watch props.show 中添加 accent_color 处理
watch(() => props.show, (newVal) => {
  if (newVal) {
    if (props.service) {
      formData.value = {
        ...
        accent_color: props.service.accent_color || ''
      };
    } else {
      formData.value = {
        ...
        accent_color: ''
      };
    }
  }
});

// 在 handleSubmit 中添加 accent_color
const data = {
  ...
  accent_color: formData.value.accent_color.trim() || null
};
```

- [ ] **Step 5: 提交 Emoji 推荐**

```bash
git add src/components/ServiceModal.vue
git commit -m "feat(modal): add emoji recommendation and accent_color editing"

Co-Authored-By: Claude Opus 4.6 <noreply@anthropic.com>
```

---

## Task 13: 最终测试与提交

- [ ] **Step 1: 启动开发服务器测试**

```bash
npm run dev
```

检查：
1. 主题切换按钮是否正常工作
2. 卡片是否显示渐变色条和在线状态
3. 视图切换是否正常
4. 列表视图是否正确渲染
5. 新服务创建时 emoji 是否自动推荐

- [ ] **Step 2: 运行构建**

```bash
npm run build
```

确保构建成功无错误。

- [ ] **Step 3: 最终提交**

```bash
git add -A
git status
git commit -m "feat(nav): complete navigation optimization with dark theme, visual distinction, view toggle, and online status

- Add dark theme with system follow support
- Add accent gradient bar on service cards
- Add emoji recommendation based on service name
- Add online status indicator with backend checker
- Add card/list view toggle with per-group preference
- Add ServiceListRow component for list view

Co-Authored-By: Claude Opus 4.6 <noreply@anthropic.com>"
```

---

## 验收清单

- [ ] 主题切换支持 light/dark/system 三种模式
- [ ] 卡片顶部显示独特渐变色条
- [ ] 服务图标使用 emoji 显示
- [ ] 在线状态显示绿色脉冲点
- [ ] 卡片/列表视图可切换
- [ ] 每个分组独立保存视图偏好
- [ ] 创建服务时根据名称智能推荐 emoji
- [ ] 列表视图紧凑布局正常显示
- [ ] 暗色主题下所有元素正确显示