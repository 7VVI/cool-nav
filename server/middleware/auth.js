// server/middleware/auth.js
import { createHash, randomBytes } from 'crypto';

// 生成 token 的密钥（生产环境应从环境变量读取）
const SECRET_KEY = process.env.AUTH_SECRET || 'cool-nav-secret-key-2024';
const TOKEN_EXPIRY_DAYS = 30;

// 生成鉴权秘钥（首次使用时需要设置）
let authSecret = process.env.AUTH_SECRET_KEY || '88888888';

export function setAuthSecret(secret) {
  authSecret = secret;
}

export function getAuthSecret() {
  return authSecret;
}

// 生成 token
export function generateToken() {
  const payload = {
    timestamp: Date.now(),
    random: randomBytes(16).toString('hex')
  };
  const data = JSON.stringify(payload);
  const hash = createHash('sha256').update(data + SECRET_KEY).digest('hex');
  return Buffer.from(JSON.stringify({ ...payload, hash })).toString('base64');
}

// 验证 token
export function verifyToken(token) {
  try {
    const decoded = JSON.parse(Buffer.from(token, 'base64').toString());
    const { timestamp, random, hash } = decoded;

    // 验证 hash
    const data = JSON.stringify({ timestamp, random });
    const expectedHash = createHash('sha256').update(data + SECRET_KEY).digest('hex');
    if (hash !== expectedHash) {
      return { valid: false, reason: 'invalid' };
    }

    // 验证过期时间
    const expiryMs = TOKEN_EXPIRY_DAYS * 24 * 60 * 60 * 1000;
    if (Date.now() - timestamp > expiryMs) {
      return { valid: false, reason: 'expired' };
    }

    return { valid: true };
  } catch (e) {
    return { valid: false, reason: 'invalid' };
  }
}

// 验证鉴权秘钥
export function verifyAuthSecret(secret) {
  return secret === authSecret;
}

// 鉴权中间件
export function authMiddleware(req, res, next) {
  // 排除鉴权相关的路由
  const publicPaths = ['/api/auth/login', '/api/auth/verify', '/api/auth/check'];
  if (publicPaths.some(path => req.path.startsWith(path))) {
    return next();
  }

  const token = req.headers.authorization?.replace('Bearer ', '');

  if (!token) {
    return res.status(401).json({ success: false, message: '未授权访问', code: 'NO_TOKEN' });
  }

  const result = verifyToken(token);
  if (!result.valid) {
    return res.status(401).json({
      success: false,
      message: result.reason === 'expired' ? '登录已过期，请重新登录' : '无效的凭证',
      code: result.reason === 'expired' ? 'TOKEN_EXPIRED' : 'INVALID_TOKEN'
    });
  }

  next();
}