// server/routes/tags.js
import { Router } from 'express';
import { tagOps } from '../database.js';

const router = Router();

// 获取所有标签
router.get('/', (req, res) => {
  const tags = tagOps.getAll();
  res.json({ success: true, data: tags });
});

// 创建标签
router.post('/', (req, res) => {
  const { name, value, color } = req.body;
  if (!name || !value) {
    return res.status(400).json({ success: false, message: '标签名称和值不能为空' });
  }

  // 检查是否已存在
  const existing = tagOps.getByValue(value);
  if (existing) {
    return res.status(400).json({ success: false, message: '标签值已存在' });
  }

  const tag = tagOps.create({ name, value, color });
  res.status(201).json({ success: true, data: tag });
});

// 更新标签
router.put('/:id', (req, res) => {
  const { name, value, color } = req.body;
  if (!name || !value) {
    return res.status(400).json({ success: false, message: '标签名称和值不能为空' });
  }

  const existing = tagOps.getByValue(value);
  if (existing && existing.id !== parseInt(req.params.id)) {
    return res.status(400).json({ success: false, message: '标签值已存在' });
  }

  const tag = tagOps.update(parseInt(req.params.id), { name, value, color });
  res.json({ success: true, data: tag });
});

// 删除标签
router.delete('/:id', (req, res) => {
  tagOps.delete(parseInt(req.params.id));
  res.json({ success: true, message: '删除成功' });
});

export default router;