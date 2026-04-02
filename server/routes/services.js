// server/routes/services.js
import { Router } from 'express';
import { serviceOps, generateAccentColor } from '../database.js';

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

// 批量更新排序（支持跨分组移动）
// IMPORTANT: This route must be BEFORE /:id routes to avoid route matching issues
router.put('/reorder', (req, res) => {
  const { items } = req.body;
  if (!Array.isArray(items)) {
    return res.status(400).json({ success: false, message: '参数错误' });
  }
  serviceOps.reorder(items);
  res.json({ success: true, message: '排序更新成功' });
});

// 批量获取服务在线状态
router.get('/status', (req, res) => {
  const services = serviceOps.getAll();
  const statusData = services.map(s => ({
    id: s.id,
    is_online: s.is_online,
    last_checked_at: s.last_checked_at
  }));
  res.json({ success: true, data: statusData });
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
  const { group_id, name, url, username, password, description, icon, tags } = req.body;
  if (!group_id || !name || !url) {
    return res.status(400).json({ success: false, message: '分组、名称和URL不能为空' });
  }
  // 自动生成推荐 icon
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

// 更新服务
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

// 删除服务
router.delete('/:id', (req, res) => {
  serviceOps.delete(parseInt(req.params.id));
  res.json({ success: true, message: '删除成功' });
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