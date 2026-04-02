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
  const { name, color, parent_id } = req.body;
  if (!name || !name.trim()) {
    return res.status(400).json({ success: false, message: '分组名称不能为空' });
  }

  // 检查名称唯一性
  const existingGroup = groupOps.getByName(name.trim());
  if (existingGroup) {
    return res.status(400).json({ success: false, message: '分组名称已存在' });
  }

  const group = groupOps.create({ name: name.trim(), color, parent_id });
  res.status(201).json({ success: true, data: group });
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

// 更新分组视图模式
router.put('/:id/view-mode', (req, res) => {
  const { view_mode } = req.body;
  if (!view_mode || !['card', 'list'].includes(view_mode)) {
    return res.status(400).json({ success: false, message: '视图模式必须是 card 或 list' });
  }
  const group = groupOps.updateViewMode(parseInt(req.params.id), view_mode);
  res.json({ success: true, data: group });
});

// 更新分组
router.put('/:id', (req, res) => {
  const { name, color, parent_id, sort_order } = req.body;
  if (!name || !name.trim()) {
    return res.status(400).json({ success: false, message: '分组名称不能为空' });
  }

  // 检查名称唯一性（排除当前分组）
  const existingGroup = groupOps.getByName(name.trim(), parseInt(req.params.id));
  if (existingGroup) {
    return res.status(400).json({ success: false, message: '分组名称已存在' });
  }

  const group = groupOps.update(parseInt(req.params.id), { name: name.trim(), color, parent_id, sort_order });
  res.json({ success: true, data: group });
});

// 删除分组
router.delete('/:id', (req, res) => {
  groupOps.delete(parseInt(req.params.id));
  res.json({ success: true, message: '删除成功' });
});

export default router;