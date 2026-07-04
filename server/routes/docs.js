// server/routes/docs.js
import { Router } from 'express';
import { sharedDocOps } from '../database.js';

const router = Router();
const MAX_CONTENT_BYTES = 2 * 1024 * 1024; // 2MB

// 列出所有文档
router.get('/', (req, res) => {
  try {
    const docs = sharedDocOps.getAll().map(d => ({
      ...d,
      url: `${req.protocol}://${req.get('host')}/s/${d.code}`
    }));
    res.json({ success: true, data: docs });
  } catch (error) {
    console.error('Failed to list docs:', error);
    res.status(500).json({ success: false, message: '获取文档列表失败' });
  }
});

// 创建文档
router.post('/', (req, res) => {
  try {
    const { name, content, content_type } = req.body || {};

    if (!content || typeof content !== 'string') {
      return res.status(400).json({ success: false, message: '内容不能为空' });
    }
    if (Buffer.byteLength(content, 'utf8') > MAX_CONTENT_BYTES) {
      return res.status(413).json({ success: false, message: '内容过大（>2MB）' });
    }
    const contentType = typeof content_type === 'string' ? content_type.toLowerCase() : '';
    if (!['html', 'md'].includes(contentType)) {
      return res.status(400).json({ success: false, message: '类型必须是 html 或 md' });
    }

    const trimmedName = typeof name === 'string' ? name.trim() : '';
    const finalName = trimmedName || `未命名文档.${contentType === 'html' ? 'html' : 'md'}`;
    const doc = sharedDocOps.create({ name: finalName, content, content_type: contentType });
    const docWithUrl = {
      ...doc,
      url: `${req.protocol}://${req.get('host')}/s/${doc.code}`
    };
    res.json({ success: true, data: docWithUrl });
  } catch (error) {
    console.error('Failed to create doc:', error);
    if (error.message === 'CODE_GEN_FAILED') {
      return res.status(500).json({ success: false, message: '短链码生成失败，请重试' });
    }
    res.status(500).json({ success: false, message: '创建文档失败' });
  }
});

// 重排文档
router.put('/reorder', (req, res) => {
  try {
    const { items } = req.body || {};
    if (!Array.isArray(items) || items.length === 0) {
      return res.status(400).json({ success: false, message: 'items 必须为非空数组' });
    }
    sharedDocOps.reorder(items);
    res.json({ success: true });
  } catch (error) {
    console.error('Failed to reorder docs:', error);
    res.status(500).json({ success: false, message: '重排文档失败' });
  }
});

// 更新文档名称
router.put('/:id', (req, res) => {
  try {
    const id = parseInt(req.params.id);
    if (isNaN(id)) {
      return res.status(400).json({ success: false, message: '无效的 ID' });
    }
    const { name } = req.body || {};
    if (!name || typeof name !== 'string' || !name.trim()) {
      return res.status(400).json({ success: false, message: '名称不能为空' });
    }
    const doc = sharedDocOps.getById(id);
    if (!doc) {
      return res.status(404).json({ success: false, message: '文档不存在' });
    }
    sharedDocOps.updateName(id, name.trim());
    res.json({ success: true, data: { id, name: name.trim() } });
  } catch (error) {
    console.error('Failed to update doc:', error);
    res.status(500).json({ success: false, message: '更新文档失败' });
  }
});

// 删除文档
router.delete('/:id', (req, res) => {
  try {
    const id = parseInt(req.params.id);
    if (isNaN(id)) {
      return res.status(400).json({ success: false, message: '无效的 ID' });
    }
    sharedDocOps.delete(id);
    res.json({ success: true });
  } catch (error) {
    console.error('Failed to delete doc:', error);
    res.status(500).json({ success: false, message: '删除文档失败' });
  }
});

// 下载源文件
router.get('/:id/download', (req, res) => {
  try {
    const id = parseInt(req.params.id);
    if (isNaN(id)) {
      return res.status(400).json({ success: false, message: '无效的 ID' });
    }
    const doc = sharedDocOps.getById(id);
    if (!doc) {
      return res.status(404).json({ success: false, message: '文档不存在' });
    }

    const ext = doc.content_type === 'html' ? 'html' : 'md';
    const contentType = doc.content_type === 'html'
      ? 'text/html; charset=utf-8'
      : 'text/markdown; charset=utf-8';
    const filename = doc.name.toLowerCase().endsWith(`.${ext}`) ? doc.name : `${doc.name}.${ext}`;

    res.setHeader('Content-Type', contentType);
    res.setHeader('Content-Disposition', `attachment; filename*=UTF-8''${encodeURIComponent(filename)}`);
    res.setHeader('Content-Length', Buffer.byteLength(doc.content, 'utf8'));
    res.send(doc.content);
  } catch (error) {
    console.error('Failed to download doc:', error);
    res.status(500).json({ success: false, message: '下载失败' });
  }
});

export default router;
