// server/index.js
import express from 'express';
import cors from 'cors';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';
import groupsRouter from './routes/groups.js';
import servicesRouter from './routes/services.js';
import exportRouter from './routes/export.js';
import importRouter from './routes/import.js';
import tagsRouter from './routes/tags.js';
import accountsRouter from './routes/accounts.js';
import authRouter from './routes/auth.js';
import todosRouter from './routes/todos.js';
import { authMiddleware } from './middleware/auth.js';
import errorHandler from './middleware/errorHandler.js';
import { startStatusChecker } from './tasks/statusChecker.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

const app = express();
const PORT = process.env.PORT || 3000;

// 中间件
app.use(cors());
app.use(express.json());

// 鉴权路由（无需验证）
app.use('/api/auth', authRouter);

// 受保护的 API 路由
app.use('/api/groups', authMiddleware, groupsRouter);
app.use('/api/services', authMiddleware, servicesRouter);
app.use('/api/export', authMiddleware, exportRouter);
app.use('/api/import', authMiddleware, importRouter);
app.use('/api/tags', authMiddleware, tagsRouter);
app.use('/api/todos', authMiddleware, todosRouter);
app.use('/api/services/:serviceId/accounts', authMiddleware, accountsRouter);

// 静态文件托管（生产环境）
app.use(express.static(join(__dirname, '..', 'dist')));

// SPA 回退
app.get('*', (req, res) => {
  res.sendFile(join(__dirname, '..', 'dist', 'index.html'));
});

// 错误处理
app.use(errorHandler);

app.listen(PORT, () => {
  console.log(`Server running at http://localhost:${PORT}`);
  startStatusChecker();
});