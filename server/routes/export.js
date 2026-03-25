// server/routes/export.js
import { Router } from 'express';
import { groupOps, serviceOps } from '../database.js';

const router = Router();

// 导出为 Markdown
router.post('/', (req, res) => {
  const { groupIds } = req.body;

  if (!Array.isArray(groupIds) || groupIds.length === 0) {
    return res.status(400).json({ success: false, message: '请选择要导出的分组' });
  }

  let markdown = '# 内部系统导航\n\n';

  groupIds.forEach(groupId => {
    const group = groupOps.getById(groupId);
    if (!group) return;

    const services = serviceOps.getAll(groupId);
    if (services.length === 0) return;

    markdown += `## ${group.name}\n\n`;
    markdown += '| 平台 | URL | 用户名 | 密码 |\n';
    markdown += '|------|-----|--------|------|\n';

    services.forEach(service => {
      const username = service.username || '-';
      const password = service.password || '-';
      markdown += `| ${service.name} | ${service.url} | ${username} | ${password} |\n`;
    });

    markdown += '\n';
  });

  res.type('text/markdown').send(markdown);
});

export default router;