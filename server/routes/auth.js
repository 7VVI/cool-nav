// server/routes/auth.js
import { Router } from 'express';
import { generateToken, verifyAuthSecret, verifyToken, getAuthSecret } from '../middleware/auth.js';

const router = Router();

// 登录验证
router.post('/login', (req, res) => {
  const { secret } = req.body;

  if (!secret) {
    return res.status(400).json({ success: false, message: '请输入鉴权秘钥' });
  }

  if (!verifyAuthSecret(secret)) {
    return res.status(401).json({ success: false, message: '鉴权秘钥错误' });
  }

  const token = generateToken();
  res.json({
    success: true,
    data: {
      token,
      expiresIn: 30 * 24 * 60 * 60 * 1000 // 30天
    }
  });
});

// 验证 token
router.post('/verify', (req, res) => {
  const { token } = req.body;

  if (!token) {
    return res.json({ success: false, valid: false });
  }

  const result = verifyToken(token);
  res.json({ success: true, valid: result.valid, reason: result.reason });
});

// 检查是否需要登录（用于前端初始化）
router.get('/check', (req, res) => {
  const token = req.headers.authorization?.replace('Bearer ', '');

  if (!token) {
    return res.json({ success: true, needLogin: true });
  }

  const result = verifyToken(token);
  res.json({
    success: true,
    needLogin: !result.valid,
    reason: result.reason
  });
});

// 获取当前鉴权秘钥（仅用于开发/演示，生产环境应移除）
router.get('/secret', (req, res) => {
  res.json({ success: true, secret: getAuthSecret() });
});

export default router;