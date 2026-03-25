// server/database.js
import Database from 'better-sqlite3';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

const dbPath = join(__dirname, '..', 'data', 'nav.db');
const db = new Database(dbPath);

// 初始化表
db.exec(`
  CREATE TABLE IF NOT EXISTS groups (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    name TEXT NOT NULL,
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

// 分组操作
export const groupOps = {
  getAll: () => db.prepare('SELECT * FROM groups ORDER BY sort_order, id').all(),

  getById: (id) => db.prepare('SELECT * FROM groups WHERE id = ?').get(id),

  create: (data) => {
    const stmt = db.prepare('INSERT INTO groups (name, parent_id, sort_order) VALUES (?, ?, ?)');
    const result = stmt.run(data.name, data.parent_id || null, data.sort_order || 0);
    return { id: result.lastInsertRowid, ...data };
  },

  update: (id, data) => {
    const stmt = db.prepare('UPDATE groups SET name = ?, parent_id = ?, sort_order = ?, updated_at = CURRENT_TIMESTAMP WHERE id = ?');
    stmt.run(data.name, data.parent_id || null, data.sort_order || 0, id);
    return { id, ...data };
  },

  delete: (id) => {
    // 删除分组下的所有服务
    db.prepare('DELETE FROM services WHERE group_id = ?').run(id);
    // 删除子分组的服务
    const childGroups = db.prepare('SELECT id FROM groups WHERE parent_id = ?').all(id);
    childGroups.forEach(g => {
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
  }
};

// 服务操作
export const serviceOps = {
  getAll: (groupId = null) => {
    if (groupId) {
      return db.prepare('SELECT * FROM services WHERE group_id = ? ORDER BY sort_order, id').all(groupId);
    }
    return db.prepare('SELECT * FROM services ORDER BY sort_order, id').all();
  },

  getById: (id) => db.prepare('SELECT * FROM services WHERE id = ?').get(id),

  create: (data) => {
    const stmt = db.prepare(`
      INSERT INTO services (group_id, name, url, username, password, description, icon, sort_order)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?)
    `);
    const result = stmt.run(
      data.group_id,
      data.name,
      data.url,
      data.username || null,
      data.password || null,
      data.description || null,
      data.icon || null,
      data.sort_order || 0
    );
    return { id: result.lastInsertRowid, ...data };
  },

  update: (id, data) => {
    const stmt = db.prepare(`
      UPDATE services SET group_id = ?, name = ?, url = ?, username = ?, password = ?,
      description = ?, icon = ?, sort_order = ?, updated_at = CURRENT_TIMESTAMP WHERE id = ?
    `);
    stmt.run(
      data.group_id,
      data.name,
      data.url,
      data.username || null,
      data.password || null,
      data.description || null,
      data.icon || null,
      data.sort_order || 0,
      id
    );
    return { id, ...data };
  },

  delete: (id) => db.prepare('DELETE FROM services WHERE id = ?').run(id),

  reorder: (items) => {
    const stmt = db.prepare('UPDATE services SET sort_order = ?, group_id = ? WHERE id = ?');
    items.forEach((item, index) => {
      stmt.run(index, item.group_id, item.id);
    });
    return items;
  },

  search: (keyword) => {
    const pattern = `%${keyword}%`;
    return db.prepare(`
      SELECT * FROM services WHERE name LIKE ? OR url LIKE ? OR description LIKE ?
      ORDER BY sort_order, id
    `).all(pattern, pattern, pattern);
  }
};

export default db;