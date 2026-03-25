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
import errorHandler from './middleware/errorHandler.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

const app = express();
const PORT = process.env.PORT || 3000;

// 中间件
app.use(cors());
app.use(express.json());

// API 路由
app.use('/api/groups', groupsRouter);
app.use('/api/services', servicesRouter);
app.use('/api/export', exportRouter);
app.use('/api/import', importRouter);
app.use('/api/tags', tagsRouter);

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
});