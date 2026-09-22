import { DatabaseSync } from 'node:sqlite';
import fs from 'node:fs';
import path from 'node:path';
import { hashPassword } from './auth.js';

const DB_PATH = process.env.DB_PATH || path.resolve('data', 'sabaq.db');
if (DB_PATH !== ':memory:') fs.mkdirSync(path.dirname(DB_PATH), { recursive: true });

export const db = new DatabaseSync(DB_PATH);
db.exec('PRAGMA journal_mode = WAL; PRAGMA foreign_keys = ON;');

db.exec(`
CREATE TABLE IF NOT EXISTS users (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  name TEXT NOT NULL,
  email TEXT NOT NULL UNIQUE COLLATE NOCASE,
  password_hash TEXT NOT NULL,
  role TEXT NOT NULL CHECK (role IN ('teacher','admin')),
  subject TEXT,
  status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('active','pending','blocked')),
  must_change_password INTEGER NOT NULL DEFAULT 1,
  created_at TEXT NOT NULL DEFAULT (datetime('now')),
  last_login_at TEXT
);
CREATE TABLE IF NOT EXISTS sessions (
  token TEXT PRIMARY KEY,
  user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  expires_at TEXT NOT NULL
);
CREATE TABLE IF NOT EXISTS projects (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  kind TEXT NOT NULL CHECK (kind IN ('qmz','presentation','image')),
  title TEXT NOT NULL,
  subject TEXT,
  meta TEXT,
  data TEXT NOT NULL,
  created_at TEXT NOT NULL DEFAULT (datetime('now'))
);
CREATE INDEX IF NOT EXISTS idx_projects_user ON projects(user_id, created_at DESC);
CREATE TABLE IF NOT EXISTS notifications (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  title TEXT NOT NULL,
  body TEXT NOT NULL,
  is_read INTEGER NOT NULL DEFAULT 0,
  created_at TEXT NOT NULL DEFAULT (datetime('now'))
);
CREATE INDEX IF NOT EXISTS idx_notif_user ON notifications(user_id, created_at DESC);
`);

/** Creates the first administrator from env (or defaults) when the DB has none. */
export function seedAdmin() {
  const exists = db.prepare("SELECT id FROM users WHERE role = 'admin' LIMIT 1").get();
  if (exists) return null;
  const email = process.env.ADMIN_EMAIL || 'admin@sabaq.ai';
  const password = process.env.ADMIN_PASSWORD || 'admin12345';
  db.prepare(`INSERT INTO users (name, email, password_hash, role, status, must_change_password)
              VALUES (?, ?, ?, 'admin', 'active', ?)`)
    .run(process.env.ADMIN_NAME || 'Әкімші', email, hashPassword(password), process.env.ADMIN_PASSWORD ? 0 : 1);
  return { email, password };
}

export function notify(userId, title, body) {
  db.prepare('INSERT INTO notifications (user_id, title, body) VALUES (?, ?, ?)').run(userId, title, body);
}
