// server/routes/accounts.js
import { Router } from 'express';
import { accountOps } from '../database.js';

const router = Router({ mergeParams: true });

// 获取服务的所有账号
router.get('/', (req, res) => {
  const serviceId = parseInt(req.params.serviceId);
  const accounts = accountOps.getByServiceId(serviceId);
  res.json({ success: true, data: accounts });
});

// 新增账号
router.post('/', (req, res) => {
  const serviceId = parseInt(req.params.serviceId);
  const { name, username, password, is_default } = req.body;
  if (!name) {
    return res.status(400).json({ success: false, message: '名称不能为空' });
  }
  if (!username && !password) {
    return res.status(400).json({ success: false, message: '用户名和密码至少填一个' });
  }
  const account = accountOps.create(serviceId, { name, username: username || '', password, is_default: !!is_default });
  res.status(201).json({ success: true, data: account });
});

// 设为默认账号
router.put('/:id/default', (req, res) => {
  const serviceId = parseInt(req.params.serviceId);
  const id = parseInt(req.params.id);
  accountOps.setDefault(serviceId, id);
  res.json({ success: true, message: '已设为默认' });
});

// 更新账号
router.put('/:id', (req, res) => {
  const serviceId = parseInt(req.params.serviceId);
  const id = parseInt(req.params.id);
  const { name, username, password, is_default } = req.body;
  if (!name) {
    return res.status(400).json({ success: false, message: '名称不能为空' });
  }
  if (!username && !password) {
    return res.status(400).json({ success: false, message: '用户名和密码至少填一个' });
  }
  const account = accountOps.update(serviceId, id, { name, username: username || '', password, is_default: !!is_default });
  res.json({ success: true, data: account });
});

// 删除账号
router.delete('/:id', (req, res) => {
  const serviceId = parseInt(req.params.serviceId);
  const id = parseInt(req.params.id);
  accountOps.delete(serviceId, id);
  res.json({ success: true, message: '删除成功' });
});

export default router;
