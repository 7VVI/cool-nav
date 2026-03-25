// server/routes/export.js
import { Router } from 'express';
import { groupOps, serviceOps, tagOps } from '../database.js';

const router = Router();

// 导出为 Markdown
router.post('/', (req, res) => {
  const { groupIds, serviceIds } = req.body;

  // 支持按服务ID导出
  if (Array.isArray(serviceIds) && serviceIds.length > 0) {
    let markdown = '# 内部系统导航\n\n';
    const allTags = tagOps.getAll();

    // 获取所有服务
    const services = serviceIds.map(id => serviceOps.getById(id)).filter(s => s);

    // 按分组分组
    const groupedServices = {};
    services.forEach(service => {
      if (!groupedServices[service.group_id]) {
        groupedServices[service.group_id] = [];
      }
      groupedServices[service.group_id].push(service);
    });

    // 按分组生成表格
    Object.keys(groupedServices).forEach(groupId => {
      const group = groupOps.getById(parseInt(groupId));
      if (!group) return;

      const groupServices = groupedServices[groupId];
      markdown += `## ${group.name}\n\n`;
      markdown += '| 平台 | URL | 用户名 | 密码 | 标签 |\n';
      markdown += '|------|-----|--------|------|------|\n';

      groupServices.forEach(service => {
        const username = service.username || '-';
        const password = service.password || '-';
        const tags = (service.tags || [])
          .map(tagValue => {
            const tag = allTags.find(t => t.value === tagValue);
            return tag ? tag.name : tagValue;
          })
          .join(', ') || '-';
        markdown += `| ${service.name} | ${service.url} | ${username} | ${password} | ${tags} |\n`;
      });

      markdown += '\n';
    });

    const now = new Date();
    const filename = `internal-nav-${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-${String(now.getDate()).padStart(2, '0')}.md`;

    return res.json({ success: true, data: { content: markdown, filename } });
  }

  // 兼容旧的按分组导出
  if (!Array.isArray(groupIds) || groupIds.length === 0) {
    return res.status(400).json({ success: false, message: '请选择要导出的内容' });
  }

  let markdown = '# 内部系统导航\n\n';
  const allTags = tagOps.getAll();

  groupIds.forEach(groupId => {
    const group = groupOps.getById(groupId);
    if (!group) return;

    const services = serviceOps.getAll(groupId);
    if (services.length === 0) return;

    markdown += `## ${group.name}\n\n`;
    markdown += '| 平台 | URL | 用户名 | 密码 | 标签 |\n';
    markdown += '|------|-----|--------|------|------|\n';

    services.forEach(service => {
      const username = service.username || '-';
      const password = service.password || '-';
      const tags = (service.tags || [])
        .map(tagValue => {
          const tag = allTags.find(t => t.value === tagValue);
          return tag ? tag.name : tagValue;
        })
        .join(', ') || '-';
      markdown += `| ${service.name} | ${service.url} | ${username} | ${password} | ${tags} |\n`;
    });

    markdown += '\n';
  });

  const now = new Date();
  const filename = `internal-nav-${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-${String(now.getDate()).padStart(2, '0')}.md`;

  res.json({ success: true, data: { content: markdown, filename } });
});

export default router;