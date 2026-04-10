// server/database.js
import Database from 'better-sqlite3';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

const dbPath = join(__dirname, '..', 'data', 'nav.db');
const db = new Database(dbPath);

// 启用外键约束
db.pragma('journal_mode = WAL');
db.pragma('foreign_keys = ON');

// 初始化表
db.exec(`
  CREATE TABLE IF NOT EXISTS groups (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    name TEXT NOT NULL,
    color TEXT DEFAULT '#3b6ef8',
    parent_id INTEGER REFERENCES groups(id),
    sort_order INTEGER DEFAULT 0,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
  );

  CREATE TABLE IF NOT EXISTS services (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    group_id INTEGER NOT NULL REFERENCES groups(id),
    name TEXT NOT NULL,
    url TEXT NOT NULL,
    username TEXT,
    password TEXT,
    description TEXT,
    icon TEXT,
    sort_order INTEGER DEFAULT 0,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
  );

  CREATE INDEX IF NOT EXISTS idx_groups_parent ON groups(parent_id);
  CREATE INDEX IF NOT EXISTS idx_groups_sort ON groups(sort_order);
  CREATE INDEX IF NOT EXISTS idx_services_group ON services(group_id);
  CREATE INDEX IF NOT EXISTS idx_services_sort ON services(sort_order);
`);

// 添加 color 列（如果不存在）
try {
  db.exec('ALTER TABLE groups ADD COLUMN color TEXT DEFAULT "#3b6ef8"');
} catch (e) {
  // 列已存在，忽略错误
}

// 添加 tags 列到 services 表（如果不存在）
try {
  db.exec('ALTER TABLE services ADD COLUMN tags TEXT DEFAULT "[]"');
} catch (e) {
  // 列已存在，忽略错误
}

// 添加 accent_color 列到 services 表（如果不存在）
try {
  db.exec('ALTER TABLE services ADD COLUMN accent_color TEXT DEFAULT NULL');
} catch (e) {
  // 列已存在，忽略错误
}

// 添加 is_online 列到 services 表（如果不存在）
try {
  db.exec('ALTER TABLE services ADD COLUMN is_online INTEGER DEFAULT 1');
} catch (e) {
  // 列已存在，忽略错误
}

// 添加 last_checked_at 列到 services 表（如果不存在）
try {
  db.exec('ALTER TABLE services ADD COLUMN last_checked_at DATETIME DEFAULT NULL');
} catch (e) {
  // 列已存在，忽略错误
}

// 添加 view_mode 列到 groups 表（如果不存在）
try {
  db.exec('ALTER TABLE groups ADD COLUMN view_mode TEXT DEFAULT "card"');
} catch (e) {
  // 列已存在，忽略错误
}

// 创建标签表
db.exec(`
  CREATE TABLE IF NOT EXISTS tags (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    name TEXT NOT NULL UNIQUE,
    value TEXT NOT NULL UNIQUE,
    color TEXT NOT NULL DEFAULT '#3b6ef8',
    sort_order INTEGER DEFAULT 0,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP
  )
`);

// 创建服务账号表
db.exec(`
  CREATE TABLE IF NOT EXISTS service_accounts (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    service_id INTEGER NOT NULL REFERENCES services(id) ON DELETE CASCADE,
    name TEXT NOT NULL,
    username TEXT NOT NULL,
    password TEXT DEFAULT '',
    is_default INTEGER DEFAULT 0,
    sort_order INTEGER DEFAULT 0,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
  );
  CREATE INDEX IF NOT EXISTS idx_accounts_service ON service_accounts(service_id);
`);

// 插入默认标签（如果不存在）
const defaultTags = [
  { name: '生产', value: 'production', color: '#059669', sort_order: 1 },
  { name: '预生产', value: 'staging', color: '#7c3aed', sort_order: 2 },
  { name: '开发', value: 'development', color: '#2563eb', sort_order: 3 },
  { name: '测试', value: 'testing', color: '#d97706', sort_order: 4 },
  { name: '重要', value: 'important', color: '#dc2626', sort_order: 5 },
  { name: '内网', value: 'internal', color: '#0891b2', sort_order: 6 }
];

const insertTag = db.prepare('INSERT OR IGNORE INTO tags (name, value, color, sort_order) VALUES (?, ?, ?, ?)');
defaultTags.forEach(tag => {
  insertTag.run(tag.name, tag.value, tag.color, tag.sort_order);
});

// 分组操作
export const groupOps = {
  getAll: () => db.prepare('SELECT * FROM groups ORDER BY sort_order, id').all(),

  getById: (id) => db.prepare('SELECT * FROM groups WHERE id = ?').get(id),

  getByName: (name, excludeId = null) => {
    if (excludeId) {
      return db.prepare('SELECT * FROM groups WHERE name = ? AND id != ?').get(name, excludeId);
    }
    return db.prepare('SELECT * FROM groups WHERE name = ?').get(name);
  },

  create: (data) => {
    const stmt = db.prepare('INSERT INTO groups (name, color, parent_id, sort_order) VALUES (?, ?, ?, ?)');
    const result = stmt.run(data.name, data.color || '#3b6ef8', data.parent_id || null, data.sort_order || 0);
    return { id: result.lastInsertRowid, color: data.color || '#3b6ef8', ...data };
  },

  update: (id, data) => {
    const stmt = db.prepare('UPDATE groups SET name = ?, color = ?, parent_id = ?, sort_order = ?, updated_at = CURRENT_TIMESTAMP WHERE id = ?');
    stmt.run(data.name, data.color || '#3b6ef8', data.parent_id || null, data.sort_order || 0, id);
    return { id, color: data.color || '#3b6ef8', ...data };
  },

  delete: (id) => {
    // 先删除分组下所有服务的账号
    const services = db.prepare('SELECT id FROM services WHERE group_id = ?').all(id);
    services.forEach(s => {
      db.prepare('DELETE FROM service_accounts WHERE service_id = ?').run(s.id);
    });
    // 删除分组下的所有服务
    db.prepare('DELETE FROM services WHERE group_id = ?').run(id);
    // 删除子分组的服务及其账号
    const childGroups = db.prepare('SELECT id FROM groups WHERE parent_id = ?').all(id);
    childGroups.forEach(g => {
      const childServices = db.prepare('SELECT id FROM services WHERE group_id = ?').all(g.id);
      childServices.forEach(s => {
        db.prepare('DELETE FROM service_accounts WHERE service_id = ?').run(s.id);
      });
      db.prepare('DELETE FROM services WHERE group_id = ?').run(g.id);
    });
    // 删除子分组
    db.prepare('DELETE FROM groups WHERE parent_id = ?').run(id);
    // 删除分组
    return db.prepare('DELETE FROM groups WHERE id = ?').run(id);
  },

  reorder: (items) => {
    const stmt = db.prepare('UPDATE groups SET sort_order = ? WHERE id = ?');
    items.forEach((item, index) => {
      stmt.run(index, item.id);
    });
    return items;
  },

  updateViewMode: (id, viewMode) => {
    db.prepare('UPDATE groups SET view_mode = ?, updated_at = CURRENT_TIMESTAMP WHERE id = ?').run(viewMode, id);
    return { id, view_mode: viewMode };
  }
};

// 颜色池
const ACCENT_COLORS = [
  '#4ade80', '#f472b6', '#fbbf24', '#38bdf8',
  '#a78bfa', '#fb923c', '#34d399', '#f87171',
  '#22d3ee', '#6366f1', '#ec4899', '#14b8a6'
];

// 生成 accent_color 的函数
function generateAccentColor(id) {
  return ACCENT_COLORS[id % ACCENT_COLORS.length];
}

// 服务操作
export const serviceOps = {
  getAll: (groupId = null) => {
    let services;
    if (groupId) {
      services = db.prepare('SELECT * FROM services WHERE group_id = ? ORDER BY sort_order, id').all(groupId);
    } else {
      services = db.prepare('SELECT * FROM services ORDER BY sort_order, id').all();
    }
    return services.map(s => ({
      ...s,
      tags: s.tags ? JSON.parse(s.tags) : [],
      is_online: s.is_online === 1
    }));
  },

  getById: (id) => {
    const service = db.prepare('SELECT * FROM services WHERE id = ?').get(id);
    if (service) {
      return {
        ...service,
        tags: service.tags ? JSON.parse(service.tags) : [],
        is_online: service.is_online === 1
      };
    }
    return service;
  },

  create: (data) => {
    const tagsJson = JSON.stringify(data.tags || []);
    const tempColor = data.accent_color || ACCENT_COLORS[Math.floor(Math.random() * ACCENT_COLORS.length)];
    const stmt = db.prepare(`
      INSERT INTO services (group_id, name, url, username, password, description, icon, tags, sort_order, accent_color, is_online)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 1)
    `);
    const result = stmt.run(
      data.group_id,
      data.name,
      data.url,
      data.username || null,
      data.password || null,
      data.description || null,
      data.icon || null,
      tagsJson,
      data.sort_order || 0,
      tempColor
    );
    const finalColor = generateAccentColor(result.lastInsertRowid);
    db.prepare('UPDATE services SET accent_color = ? WHERE id = ?').run(finalColor, result.lastInsertRowid);
    return { id: result.lastInsertRowid, tags: data.tags || [], accent_color: finalColor, is_online: true, ...data };
  },

  update: (id, data) => {
    const tagsJson = JSON.stringify(data.tags || []);
    const stmt = db.prepare(`
      UPDATE services SET group_id = ?, name = ?, url = ?, username = ?, password = ?,
      description = ?, icon = ?, tags = ?, sort_order = ?, accent_color = ?, updated_at = CURRENT_TIMESTAMP WHERE id = ?
    `);
    stmt.run(
      data.group_id,
      data.name,
      data.url,
      data.username || null,
      data.password || null,
      data.description || null,
      data.icon || null,
      tagsJson,
      data.sort_order || 0,
      data.accent_color || null,
      id
    );
    return { id, tags: data.tags || [], ...data };
  },

  delete: (id) => {
    db.prepare('DELETE FROM service_accounts WHERE service_id = ?').run(id);
    return db.prepare('DELETE FROM services WHERE id = ?').run(id);
  },

  reorder: (items) => {
    const stmt = db.prepare('UPDATE services SET sort_order = ?, group_id = ? WHERE id = ?');
    items.forEach((item, index) => {
      stmt.run(index, item.group_id, item.id);
    });
    return items;
  },

  search: (keyword) => {
    const pattern = `%${keyword}%`;
    const services = db.prepare(`
      SELECT * FROM services WHERE name LIKE ? OR url LIKE ? OR description LIKE ?
      ORDER BY sort_order, id
    `).all(pattern, pattern, pattern);
    return services.map(s => ({
      ...s,
      tags: s.tags ? JSON.parse(s.tags) : [],
      is_online: s.is_online === 1
    }));
  }
};

export default db;

// 标签操作
export const tagOps = {
  getAll: () => db.prepare('SELECT * FROM tags ORDER BY sort_order, id').all(),

  getById: (id) => db.prepare('SELECT * FROM tags WHERE id = ?').get(id),

  getByValue: (value) => db.prepare('SELECT * FROM tags WHERE value = ?').get(value),

  create: (data) => {
    const stmt = db.prepare('INSERT INTO tags (name, value, color, sort_order) VALUES (?, ?, ?, ?)');
    const result = stmt.run(data.name, data.value, data.color || '#3b6ef8', data.sort_order || 0);
    return { id: result.lastInsertRowid, ...data };
  },

  update: (id, data) => {
    const stmt = db.prepare('UPDATE tags SET name = ?, value = ?, color = ?, sort_order = ? WHERE id = ?');
    stmt.run(data.name, data.value, data.color || '#3b6ef8', data.sort_order || 0, id);
    return { id, ...data };
  },

  delete: (id) => db.prepare('DELETE FROM tags WHERE id = ?').run(id)
};

// 账号操作
export const accountOps = {
  getByServiceId: (serviceId) => {
    return db.prepare('SELECT * FROM service_accounts WHERE service_id = ? ORDER BY is_default DESC, sort_order, id').all(serviceId)
      .map(a => ({ ...a, is_default: a.is_default === 1 }));
  },

  getById: (id) => {
    const account = db.prepare('SELECT * FROM service_accounts WHERE id = ?').get(id);
    if (account) {
      return { ...account, is_default: account.is_default === 1 };
    }
    return account;
  },

  create: (serviceId, data) => {
    if (data.is_default) {
      db.prepare('UPDATE service_accounts SET is_default = 0 WHERE service_id = ?').run(serviceId);
    }
    const stmt = db.prepare(
      'INSERT INTO service_accounts (service_id, name, username, password, is_default, sort_order) VALUES (?, ?, ?, ?, ?, ?)'
    );
    const result = stmt.run(
      serviceId,
      data.name,
      data.username,
      data.password || '',
      data.is_default ? 1 : 0,
      data.sort_order || 0
    );
    return { id: result.lastInsertRowid, service_id: serviceId, is_default: !!data.is_default, ...data };
  },

  update: (serviceId, id, data) => {
    if (data.is_default) {
      db.prepare('UPDATE service_accounts SET is_default = 0 WHERE service_id = ?').run(serviceId);
    }
    const stmt = db.prepare(
      'UPDATE service_accounts SET name = ?, username = ?, password = ?, is_default = ?, sort_order = ?, updated_at = CURRENT_TIMESTAMP WHERE id = ? AND service_id = ?'
    );
    stmt.run(
      data.name,
      data.username,
      data.password || '',
      data.is_default ? 1 : 0,
      data.sort_order || 0,
      id,
      serviceId
    );
    return { id, service_id: serviceId, is_default: !!data.is_default, ...data };
  },

  delete: (serviceId, id) => {
    return db.prepare('DELETE FROM service_accounts WHERE id = ? AND service_id = ?').run(id, serviceId);
  },

  setDefault: (serviceId, id) => {
    db.prepare('UPDATE service_accounts SET is_default = 0 WHERE service_id = ?').run(serviceId);
    db.prepare('UPDATE service_accounts SET is_default = 1, updated_at = CURRENT_TIMESTAMP WHERE id = ? AND service_id = ?').run(id, serviceId);
    return { id, service_id: serviceId, is_default: true };
  },

  deleteByServiceId: (serviceId) => {
    return db.prepare('DELETE FROM service_accounts WHERE service_id = ?').run(serviceId);
  }
};

export { generateAccentColor };