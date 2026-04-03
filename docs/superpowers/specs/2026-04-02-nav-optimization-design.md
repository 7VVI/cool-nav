# 导航系统优化设计文档

## 概述

优化内部服务导航系统，增加暗色主题、视觉区分度、视图切换、在线状态检测等功能，提升多服务场景下的查找效率和用户体验。

---

## 一、数据模型变更

### Service 表新增字段

| 字段 | 类型 | 说明 |
|------|------|------|
| `accent_color` | VARCHAR(7) | 卡片主题色，如 '#4ade80'，创建时自动生成 |
| `icon` | VARCHAR(10) | emoji 图标，如 '🚜'，创建时智能推荐 |
| `is_online` | BOOLEAN | 在线状态，默认 true |
| `last_checked_at` | DATETIME | 最后检测时间 |

### Group 表新增字段

| 字段 | 类型 | 说明 |
|------|------|------|
| `view_mode` | VARCHAR(10) | 视图模式: 'card' 或 'list'，默认 'card' |

---

## 二、后端实现

### 2.1 API 变更

| 接口 | 方法 | 说明 |
|------|------|------|
| `/api/services` | POST | 创建服务，自动生成 accent_color 和推荐 icon |
| `/api/services/:id` | PUT | 更新服务，用户可修改 accent_color 和 icon |
| `/api/groups/:id/view-mode` | PUT | 更新分组视图偏好，body: `{ view_mode: 'card' | 'list' }` |
| `/api/services/status` | GET | 批量获取服务在线状态 |

### 2.2 定时任务：在线状态检测

- **频率**：每 5 分钟执行一次
- **逻辑**：
  1. 遍历所有服务的 URL
  2. 发送 HTTP GET 请求（超时 5 秒），只关心响应状态码
  3. 状态码 200-299 → `is_online = true`
  4. 失败（超时/错误/非2xx）→ 累计失败次数，连续 3 次失败后 `is_online = false`
  5. 更新 `last_checked_at`
- **启动时机**：应用启动时自动开始，使用 node-cron 或 setInterval

### 2.3 accent_color 生成算法

```js
// 基于服务 ID 生成确定性随机颜色
function generateAccentColor(serviceId) {
  const colors = [
    '#4ade80', '#f472b6', '#fbbf24', '#38bdf8',
    '#a78bfa', '#fb923c', '#34d399', '#f87171',
    '#22d3ee', '#6366f1', '#ec4899', '#14b8a6'
  ];
  const index = serviceId % colors.length;
  return colors[index];
}
```

### 2.4 Emoji 推荐算法

```js
// 关键词映射表
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
    if (lowerName.includes(keyword)) {
      return emoji;
    }
  }
  return '🖥️'; // 默认图标
}
```

---

## 三、前端实现

### 3.1 主题切换

**新增 `useThemeStore`：**

```ts
// src/stores/themeStore.ts
const themeStore = defineStore('theme', {
  state: () => ({
    mode: 'system' as 'light' | 'dark' | 'system',
  }),
  computed: {
    effectiveTheme() {
      if (this.mode === 'system') {
        return window.matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light';
      }
      return this.mode;
    }
  },
  actions: {
    init() {
      const saved = localStorage.getItem('theme-mode');
      if (saved) this.mode = saved;
      this.applyTheme();
      window.matchMedia('(prefers-color-scheme: dark)').addEventListener('change', () => {
        if (this.mode === 'system') this.applyTheme();
      });
    },
    setMode(mode) {
      this.mode = mode;
      localStorage.setItem('theme-mode', mode);
      this.applyTheme();
    },
    applyTheme() {
      document.documentElement.setAttribute('data-theme', this.effectiveTheme);
    }
  }
});
```

**切换按钮位置**：侧边栏底部，与导入/导出/退出按钮同行

### 3.2 CSS 变量扩展

```css
/* 亮色主题 (默认) */
:root, [data-theme="light"] {
  --bg: #f5f6f8;
  --surface: #ffffff;
  --surface2: #f0f1f4;
  --border: #e4e6ec;
  --text: #1c1e26;
  --text2: #5a5f72;
  --text3: #9096aa;
  --accent: #3b6ef8;
  --accent-bg: #eef2ff;
  --green: #22c55e;
  --green-bg: #f0fdf4;
  --red: #ef4444;
  --red-bg: #fef2f2;
  --amber: #f59e0b;
  --amber-bg: #fffbeb;
  --purple: #8b5cf6;
  --purple-bg: #f5f3ff;
}

/* 暗色主题 */
[data-theme="dark"] {
  --bg: #0d0f14;
  --surface: #13161e;
  --surface2: #1a1e28;
  --border: rgba(255,255,255,0.07);
  --text: #e8eaf0;
  --text2: #9ca3af;
  --text3: #6b7280;
  --accent: #38bdf8;
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
  --shadow: 0 4px 16px rgba(0,0,0,0.3);
  --shadow-card: 0 0 0 1px var(--border), 0 2px 8px rgba(0,0,0,0.2);
}
```

### 3.3 ServiceCard 改造

**新增元素：**
1. 卡片顶部渐变色条 (3px)
2. Emoji 图标显示
3. 在线状态指示器（绿色脉冲点 + "在线"文字）
4. 凭据状态标签优化

```vue
<!-- ServiceCard.vue 结构 -->
<div class="service-card">
  <!-- 渐变色条 -->
  <div class="accent-bar" :style="{ background: gradient }"></div>

  <div class="card-body">
    <!-- 头部：图标 + 名称 + URL + 在线状态 -->
    <div class="card-header">
      <div class="icon-box">{{ service.icon || '🖥️' }}</div>
      <div class="meta">
        <div class="name">{{ service.name }}</div>
        <div class="url">{{ trimmedUrl }}</div>
      </div>
      <div v-if="service.is_online" class="online-status">
        <span class="pulse-dot"></span>在线
      </div>
    </div>

    <!-- 简介 -->
    <p class="description">{{ service.description }}</p>

    <!-- 标签 -->
    <div class="tags">...</div>

    <!-- 凭据状态 -->
    <div class="auth-indicator">...</div>

    <!-- 操作按钮 -->
    <div class="card-footer">...</div>
  </div>
</div>
```

**渐变色条计算：**
```js
const gradient = computed(() => {
  const color = props.service.accent_color || '#3b6ef8';
  const darker = adjustColor(color, -20); // 稍深色
  return `linear-gradient(90deg, ${color}, ${darker})`;
});
```

### 3.4 视图切换

**Dashboard 顶部新增切换按钮：**
```vue
<div class="view-toggle">
  <button :class="{ active: viewMode === 'card' }" @click="setViewMode('card')">卡片</button>
  <button :class="{ active: viewMode === 'list' }" @click="setViewMode('list')">列表</button>
</div>
```

**切换逻辑：**
```js
async function setViewMode(mode) {
  viewMode.value = mode;
  if (store.currentGroupId) {
    await groupsApi.updateViewMode(store.currentGroupId, mode);
  }
}

// 切换分组时读取视图偏好
watch(() => store.currentGroupId, async (id) => {
  if (id) {
    const group = store.groups.find(g => g.id === id);
    viewMode.value = group?.view_mode || 'card';
  }
});
```

### 3.5 列表视图组件

**ServiceListRow.vue：**
```vue
<div class="list-row">
  <div class="icon">{{ service.icon || '🖥️' }}</div>
  <div class="name">{{ service.name }}</div>
  <div class="url font-mono">{{ trimmedUrl }}</div>
  <div class="tags">
    <span v-for="tag in tags">{{ tag.name }}</span>
  </div>
  <div class="auth">
    <span class="dot" :class="hasCredentials ? 'yes' : 'no'"></span>
    {{ hasCredentials ? '有凭据' : '无凭据' }}
  </div>
  <button class="open-btn">打开</button>
</div>
```

### 3.6 Emoji 选择器

**ServiceModal.vue 中新增：**
- emoji 输入框旁边添加选择按钮
- 点击弹出 emoji 选择面板（约 50 个常用 emoji）
- 创建服务时自动填充推荐 emoji，用户可修改

---

## 四、文件变更清单

### 新增文件

| 文件 | 说明 |
|------|------|
| `src/stores/themeStore.ts` | 主题状态管理 |
| `src/components/ServiceListRow.vue` | 列表视图行组件 |
| `src/components/EmojiPicker.vue` | Emoji 选择器弹窗 |
| `server/tasks/statusChecker.ts` | 在线状态检测定时任务 |

### 修改文件

| 文件 | 变更内容 |
|------|------|
| `src/style.css` | 新增暗色主题 CSS 变量 |
| `src/components/Sidebar.vue` | 新增主题切换按钮 |
| `src/components/ServiceCard.vue` | 渐变色条、emoji、在线状态 |
| `src/components/ServiceModal.vue` | emoji 选择器、accent_color 编辑 |
| `src/views/dashboard/index.vue` | 视图切换按钮、列表视图渲染 |
| `src/types/index.ts` | Service/Group 类型新增字段 |
| `src/api/services.ts` | 新增 API 调用 |
| `src/api/groups.ts` | 新增 viewMode API |
| `server/routes/services.js` | 创建服务时生成 accent_color/icon |
| `server/routes/groups.js` | 新增 view-mode 接口 |
| `server/db/schema.sql` | 数据库字段变更 |

---

## 五、实现顺序

1. **第一阶段：数据层**
   - 数据库 schema 变更
   - 后端 API 修改
   - 定时任务实现

2. **第二阶段：主题系统**
   - CSS 变量扩展
   - themeStore 实现
   - 主题切换按钮

3. **第三阶段：卡片改造**
   - ServiceCard 渐变色条
   - emoji 显示
   - 在线状态指示

4. **第四阶段：视图切换**
   - 列表视图组件
   - Dashboard 切换逻辑
   - 分组视图偏好持久化

5. **第五阶段：Emoji 编辑**
   - EmojiPicker 组件
   - ServiceModal 集成
   - accent_color 编辑

---

## 六、验收标准

1. 主题切换：支持 light/dark/system 三种模式，系统跟随自动生效
2. 卡片视觉：每个卡片顶部有独特渐变色条，图标为 emoji
3. 在线状态：服务在线显示绿色脉冲点，离线无显示
4. 视图切换：卡片/列表视图可切换，每个分组独立保存偏好
5. Emoji 推荐：创建服务时根据名称智能推荐，用户可修改
6. 列表视图：紧凑布局，显示图标+名称+URL+标签+凭据+操作