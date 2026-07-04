// server/routes/todos.js
import { Router } from 'express';
import { todoOps } from '../database.js';

const router = Router();

// 获取所有待办
router.get('/', (req, res) => {
  try {
    const todos = todoOps.getAll();
    res.json({ success: true, data: todos });
  } catch (error) {
    res.status(500).json({ success: false, message: '获取待办列表失败' });
  }
});

// 创建待办
router.post('/', (req, res) => {
  try {
    const todo = todoOps.create(req.body);
    res.json({ success: true, data: todo });
  } catch (error) {
    res.status(500).json({ success: false, message: '创建待办失败' });
  }
});

// 更新待办
router.put('/:id', (req, res) => {
  try {
    const id = parseInt(req.params.id);
    const todo = todoOps.update(id, req.body);
    if (!todo) {
      return res.status(404).json({ success: false, message: '待办不存在' });
    }
    res.json({ success: true, data: todo });
  } catch (error) {
    res.status(500).json({ success: false, message: '更新待办失败' });
  }
});

// 删除待办
router.delete('/:id', (req, res) => {
  try {
    const id = parseInt(req.params.id);
    todoOps.delete(id);
    res.json({ success: true });
  } catch (error) {
    res.status(500).json({ success: false, message: '删除待办失败' });
  }
});

export default router;
