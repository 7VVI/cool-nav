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
  const service = serviceOps.create({ group_id, name, url, username, password, description, icon, tags });
  res.status(201).json({ success: true, data: service });
});

// 更新服务
router.put('/:id', (req, res) => {
  const { group_id, name, url, username, password, description, icon, tags, sort_order } = req.body;
  if (!group_id || !name || !url) {
    return res.status(400).json({ success: false, message: '分组、名称和URL不能为空' });
  }
  const service = serviceOps.update(parseInt(req.params.id), {
    group_id, name, url, username, password, description, icon, tags, sort_order
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