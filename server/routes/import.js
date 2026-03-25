// server/routes/import.js
import { Router } from 'express';
import { groupOps, serviceOps } from '../database.js';

const router = Router();

// 导入数据
router.post('/', (req, res) => {
  const { groups, services } = req.body;

  if (!Array.isArray(groups) || !Array.isArray(services)) {
    return res.status(400).json({ success: false, message: '数据格式错误' });
  }

  try {
    // 清空现有数据
    const existingGroups = groupOps.getAll();
    existingGroups.forEach(g => groupOps.delete(g.id));

    // 创建 ID 映射（旧ID -> 新ID）
    const groupIdMap = {};

    // 导入分组
    groups.forEach(g => {
      const oldId = g.id;
      const newGroup = groupOps.create({
        name: g.name,
        color: g.color || '#3b6ef8',
        parent_id: g.parent_id ? groupIdMap[g.parent_id] : null,
        sort_order: g.sort_order || 0
      });
      groupIdMap[oldId] = newGroup.id;
    });

    // 导入服务
    services.forEach(s => {
      serviceOps.create({
        group_id: groupIdMap[s.group_id] || s.group_id,
        name: s.name,
        url: s.url,
        username: s.username || null,
        password: s.password || null,
        description: s.description || null,
        icon: s.icon || s.emoji || null,
        sort_order: s.sort_order || 0
      });
    });

    res.json({ success: true, message: '导入成功' });
  } catch (error) {
    console.error('Import error:', error);
    res.status(500).json({ success: false, message: '导入失败' });
  }
});

export default router;