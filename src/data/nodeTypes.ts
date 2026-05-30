import type { ModuleNodeType, NodeCategory } from '@/types';

export const categoryLabels: Record<NodeCategory, string> = {
  custom: '自定义',
  triggers: '触发器',
  services: '服务模块',
  logic: '逻辑控制',
  data: '数据存储',
};

export const categoryColors: Record<NodeCategory, string> = {
  custom: '#6366f1',
  triggers: '#e74c3c',
  services: '#3498db',
  logic: '#f39c12',
  data: '#2ecc71',
};

export const moduleNodeTypes: ModuleNodeType[] = [
  // Custom Module (always first)
  { type: 'custom_module', label: '自定义模块', description: '自定义模块，可自由命名', icon: 'box', category: 'custom', color: '#6366f1', defaultConfig: {}, inputs: 1, outputs: 1 },

  // Triggers
  { type: 'http_trigger', label: 'HTTP 请求', description: '通过HTTP请求触发链路执行', icon: 'globe', category: 'triggers', color: '#e74c3c', defaultConfig: { method: 'GET', path: '/api/trigger' }, inputs: 0, outputs: 1 },
  { type: 'webhook_trigger', label: 'Webhook', description: '接收外部Webhook回调触发', icon: 'webhook', category: 'triggers', color: '#e74c3c', defaultConfig: { path: '/webhook', method: 'POST' }, inputs: 0, outputs: 1 },
  { type: 'cron_trigger', label: '定时任务', description: '按Cron表达式定时触发执行', icon: 'clock', category: 'triggers', color: '#e74c3c', defaultConfig: { cron: '0 * * * *' }, inputs: 0, outputs: 1 },
  { type: 'event_trigger', label: '事件监听', description: '监听系统事件消息触发', icon: 'radio', category: 'triggers', color: '#e74c3c', defaultConfig: { eventSource: 'kafka', topic: 'system-events' }, inputs: 0, outputs: 1 },
  { type: 'manual_trigger', label: '手动触发', description: '手动点击按钮触发执行', icon: 'play', category: 'triggers', color: '#e74c3c', defaultConfig: {}, inputs: 0, outputs: 1 },

  // Services
  { type: 'api_gateway', label: 'API 网关', description: 'API请求路由与限流网关', icon: 'shield', category: 'services', color: '#3498db', defaultConfig: { rateLimit: 1000, timeout: 30000 }, inputs: 1, outputs: 1 },
  { type: 'auth_service', label: '认证服务', description: '用户认证与授权校验', icon: 'lock', category: 'services', color: '#3498db', defaultConfig: { authType: 'JWT' }, inputs: 1, outputs: 1 },
  { type: 'user_service', label: '用户服务', description: '用户信息管理微服务', icon: 'users', category: 'services', color: '#3498db', defaultConfig: { endpoint: '/api/users' }, inputs: 1, outputs: 1 },
  { type: 'order_service', label: '订单服务', description: '订单处理与管理微服务', icon: 'shopping-cart', category: 'services', color: '#3498db', defaultConfig: { endpoint: '/api/orders' }, inputs: 1, outputs: 1 },
  { type: 'payment_service', label: '支付服务', description: '支付处理与对账服务', icon: 'credit-card', category: 'services', color: '#3498db', defaultConfig: { provider: 'alipay' }, inputs: 1, outputs: 1 },
  { type: 'notification_service', label: '通知服务', description: '邮件、短信、推送通知', icon: 'bell', category: 'services', color: '#3498db', defaultConfig: { channels: ['email', 'sms'] }, inputs: 1, outputs: 1 },
  { type: 'search_service', label: '搜索服务', description: '全文检索与搜索服务', icon: 'search', category: 'services', color: '#3498db', defaultConfig: { engine: 'elasticsearch' }, inputs: 1, outputs: 1 },
  { type: 'file_service', label: '文件服务', description: '文件上传下载与管理', icon: 'file-text', category: 'services', color: '#3498db', defaultConfig: { storage: 'oss' }, inputs: 1, outputs: 1 },
  { type: 'email_service', label: '邮件服务', description: '发送邮件通知', icon: 'mail', category: 'services', color: '#3498db', defaultConfig: { smtp: 'smtp.example.com' }, inputs: 1, outputs: 1 },

  // Logic
  { type: 'if_condition', label: '条件判断', description: 'IF条件分支判断', icon: 'git-branch', category: 'logic', color: '#f39c12', defaultConfig: { condition: 'data.status === 200' }, inputs: 1, outputs: 2 },
  { type: 'switch', label: 'Switch 分支', description: '多条件Switch分支路由', icon: 'split', category: 'logic', color: '#f39c12', defaultConfig: { routes: ['case1', 'case2'] }, inputs: 1, outputs: 3 },
  { type: 'loop', label: '循环', description: '遍历数组或循环执行', icon: 'refresh-cw', category: 'logic', color: '#f39c12', defaultConfig: { mode: 'forEach' }, inputs: 1, outputs: 1 },
  { type: 'try_catch', label: '异常处理', description: 'Try-Catch异常捕获处理', icon: 'alert-triangle', category: 'logic', color: '#f39c12', defaultConfig: { continueOnError: true }, inputs: 1, outputs: 2 },
  { type: 'delay', label: '延迟等待', description: '等待指定时间后继续执行', icon: 'timer', category: 'logic', color: '#f39c12', defaultConfig: { milliseconds: 1000 }, inputs: 1, outputs: 1 },
  { type: 'merge', label: '合并节点', description: '合并多个输入为单个输出', icon: 'merge', category: 'logic', color: '#f39c12', defaultConfig: { mode: 'append' }, inputs: 2, outputs: 1 },

  // Data Storage
  { type: 'mysql', label: 'MySQL', description: 'MySQL数据库读写操作', icon: 'database', category: 'data', color: '#2ecc71', defaultConfig: { host: 'localhost', port: 3306, operation: 'query' }, inputs: 1, outputs: 1 },
  { type: 'redis', label: 'Redis', description: 'Redis缓存读写操作', icon: 'hard-drive', category: 'data', color: '#2ecc71', defaultConfig: { host: 'localhost', port: 6379 }, inputs: 1, outputs: 1 },
  { type: 'mongodb', label: 'MongoDB', description: 'MongoDB文档数据库操作', icon: 'circle-dot', category: 'data', color: '#2ecc71', defaultConfig: { uri: 'mongodb://localhost:27017' }, inputs: 1, outputs: 1 },
  { type: 'elasticsearch', label: 'Elasticsearch', description: 'ES索引查询与聚合分析', icon: 'server', category: 'data', color: '#2ecc71', defaultConfig: { host: 'http://localhost:9200' }, inputs: 1, outputs: 1 },
  { type: 'kafka', label: 'Kafka', description: 'Kafka消息队列生产/消费', icon: 'radio', category: 'data', color: '#2ecc71', defaultConfig: { brokers: 'localhost:9092' }, inputs: 1, outputs: 1 },
  { type: 'rabbitmq', label: 'RabbitMQ', description: 'RabbitMQ消息队列操作', icon: 'inbox', category: 'data', color: '#2ecc71', defaultConfig: { host: 'localhost', port: 5672 }, inputs: 1, outputs: 1 },
];

export const categories: NodeCategory[] = ['custom', 'triggers', 'services', 'logic', 'data'];

export function getNodeType(type: string): ModuleNodeType | undefined {
  return moduleNodeTypes.find((n) => n.type === type);
}

export function getNodesByCategory(category: NodeCategory): ModuleNodeType[] {
  return moduleNodeTypes.filter((n) => n.category === category);
}
