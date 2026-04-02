// server/tasks/statusChecker.js
import db from '../database.js';

const STATUS_CHECK_INTERVAL = 5 * 60 * 1000; // 5 分钟
const FAILURE_THRESHOLD = 3;

// 存储连续失败次数
const failureCount = new Map();

async function checkServiceStatus(service) {
  try {
    const response = await fetch(service.url, {
      method: 'GET',
      signal: AbortSignal.timeout(5000) // 5 秒超时
    });

    if (response.ok || response.status < 500) {
      // 2xx, 3xx, 4xx 都算在线（服务在响应）
      return true;
    }
    return false;
  } catch (error) {
    return false;
  }
}

async function checkAllServices() {
  console.log('[StatusChecker] Starting status check...');
  const services = db.prepare('SELECT id, url FROM services WHERE url IS NOT NULL').all();

  for (const service of services) {
    const isOnline = await checkServiceStatus(service);
    const currentFailures = failureCount.get(service.id) || 0;

    if (isOnline) {
      failureCount.set(service.id, 0);
      db.prepare('UPDATE services SET is_online = 1, last_checked_at = CURRENT_TIMESTAMP WHERE id = ?').run(service.id);
    } else {
      const newFailures = currentFailures + 1;
      failureCount.set(service.id, newFailures);

      if (newFailures >= FAILURE_THRESHOLD) {
        db.prepare('UPDATE services SET is_online = 0, last_checked_at = CURRENT_TIMESTAMP WHERE id = ?').run(service.id);
      }
    }
  }

  console.log(`[StatusChecker] Checked ${services.length} services`);
}

export function startStatusChecker() {
  // 启动时立即检查一次
  checkAllServices().catch(err => console.error('[StatusChecker] Error:', err));

  // 定时检查
  const intervalId = setInterval(() => {
    checkAllServices().catch(err => console.error('[StatusChecker] Error:', err));
  }, STATUS_CHECK_INTERVAL);

  console.log('[StatusChecker] Started, interval: 5 minutes');
  return intervalId;
}

export default { startStatusChecker, checkAllServices };