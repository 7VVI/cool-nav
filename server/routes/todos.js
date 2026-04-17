// server/routes/todos.js
import { Router } from 'express';
import { todoOps } from '../database.js';

const router = Router();

// 获取所有待办
router.get('/', (req, res) => {
  const todos = todoOps.getAll();
  res.json({ success: true, data: todos });
});

// 创建待办
router.post('/', (req, res) => {
  const { title, desc, priority, status, tag } = req.body;
  if (!title) {
    return res.status(400).json({ success: false, message: '标题不能为空' });
  }
  const todo = todoOps.create({
    title,
    desc: desc || '',
    priority: priority || 'medium',
    status: status || 'todo',
    tag: tag || ''
  });
  res.status(201).json({ success: true, data: todo });
});

// 更新待办
router.put('/:id', (req, res) => {
  const { title, desc, priority, status, tag } = req.body;
  const todo = todoOps.update(parseInt(req.params.id), {
    title,
    desc,
    priority,
    status,
    tag
  });
  res.json({ success: true, data: todo });
});

// 删除待办
router.delete('/:id', (req, res) => {
  todoOps.delete(parseInt(req.params.id));
  res.json({ success: true, message: '删除成功' });
});

// 批量更新排序/状态
router.put('/', (req, res) => {
  const { items } = req.body;
  if (!Array.isArray(items)) {
    return res.status(400).json({ success: false, message: '参数错误' });
  }
  todoOps.batchUpdate(items);
  res.json({ success: true });
});

export default router;
