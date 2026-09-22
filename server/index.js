import express from 'express';
import cookieParser from 'cookie-parser';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { db, seedAdmin, notify } from './db.js';
import {
  hashPassword, verifyPassword, generateTempPassword, newSessionToken, loginRateLimited, resetLoginAttempts,
} from './auth.js';
import { catalog, SUBJECTS, VALUES, PRESENTATION_STYLES, SLIDE_COUNTS, IMAGE_STYLES } from './catalog.js';
import { aiEnabled, AIError, generateQmz, generatePresentation, generateImage } from './ai.js';
import { qmzToDocx, presentationToPptx } from './export.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const PUBLIC = path.join(__dirname, '..', 'public');
const COOKIE = 'sabaq_session';
const SESSION_DAYS_REMEMBER = 30;
const SESSION_HOURS_DEFAULT = 12;
const secureCookies = process.env.COOKIE_SECURE === '1';

export const app = express();
app.disable('x-powered-by');
if (process.env.TRUST_PROXY) app.set('trust proxy', process.env.TRUST_PROXY);
app.use(express.json({ limit: '200kb' }));
app.use(cookieParser());

app.use((req, res, next) => {
  res.set({
    'X-Content-Type-Options': 'nosniff',
    'Referrer-Policy': 'same-origin',
    'X-Frame-Options': 'DENY',
    'Content-Security-Policy': "default-src 'self'; img-src 'self' data: blob:; style-src 'self' 'unsafe-inline'; script-src 'self'; object-src 'none'; frame-ancestors 'none'; base-uri 'self'",
  });
  next();
});

/* ---------------------------------------------------------------- helpers */

const publicUser = (u) => u && ({
  id: u.id, name: u.name, email: u.email, role: u.role, subject: u.subject, status: u.status,
  mustChangePassword: Boolean(u.must_change_password), createdAt: u.created_at, lastLoginAt: u.last_login_at,
});

function loadSession(req) {
  const token = req.cookies?.[COOKIE];
  if (!token) return null;
  const row = db.prepare(`SELECT u.* FROM sessions s JOIN users u ON u.id = s.user_id
                          WHERE s.token = ? AND s.expires_at > datetime('now')`).get(token);
  if (!row || row.status === 'blocked') return null;
  return row;
}

const wrap = (fn) => (req, res, next) => Promise.resolve(fn(req, res, next)).catch(next);

function requireUser(req, res, next) {
  const user = loadSession(req);
  if (!user) return res.status(401).json({ error: 'Жүйеге кіру қажет.' });
  req.user = user;
  next();
}

function requireAdmin(req, res, next) {
  requireUser(req, res, () => {
    if (req.user.role !== 'admin') return res.status(403).json({ error: 'Бұл бөлім тек әкімшіге арналған.' });
    next();
  });
}

/** State-changing API calls must be JSON (blocks simple cross-site form posts together with SameSite cookies). */
app.use('/api', (req, res, next) => {
  if (['POST', 'PATCH', 'PUT', 'DELETE'].includes(req.method) && !req.is('application/json')) {
    return res.status(415).json({ error: 'Content-Type: application/json қажет.' });
  }
  next();
});

const str = (v, max = 500) => (typeof v === 'string' ? v.trim().slice(0, max) : '');
const isEmail = (v) => /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(v);

function todayKz() {
  return new Intl.DateTimeFormat('ru-RU', { timeZone: 'Asia/Almaty', day: '2-digit', month: '2-digit', year: 'numeric' }).format(new Date());
}

function projectRow(row, { full = false } = {}) {
  const p = {
    id: row.id, kind: row.kind, title: row.title, subject: row.subject,
    meta: row.meta ? JSON.parse(row.meta) : {}, createdAt: row.created_at,
  };
  if (full) p.data = JSON.parse(row.data);
  return p;
}

function saveProject(userId, kind, title, subject, meta, data) {
  const info = db.prepare('INSERT INTO projects (user_id, kind, title, subject, meta, data) VALUES (?, ?, ?, ?, ?, ?)')
    .run(userId, kind, title.slice(0, 300), subject || null, JSON.stringify(meta), JSON.stringify(data));
  return projectRow(db.prepare('SELECT * FROM projects WHERE id = ?').get(info.lastInsertRowid), { full: true });
}

/** One generation at a time per user keeps a double click from spending twice. */
const inFlight = new Set();
function generation(handler) {
  return wrap(async (req, res) => {
    if (inFlight.has(req.user.id)) return res.status(429).json({ error: 'Алдыңғы генерация әлі аяқталған жоқ.' });
    inFlight.add(req.user.id);
    try {
      await handler(req, res);
    } finally {
      inFlight.delete(req.user.id);
    }
  });
}

/* ------------------------------------------------------------------- auth */

app.get('/api/health', (_req, res) => res.json({ ok: true, ai: aiEnabled }));
app.get('/api/catalog', (_req, res) => res.json(catalog));

app.post('/api/auth/login', (req, res) => {
  const email = str(req.body?.email, 200).toLowerCase();
  const password = typeof req.body?.password === 'string' ? req.body.password : '';
  const role = req.body?.role === 'admin' ? 'admin' : 'teacher';
  const remember = Boolean(req.body?.remember);
  if (!email || !password) return res.status(400).json({ error: 'Пошта мен құпия сөзді енгізіңіз.' });

  const limitKey = `${req.ip}|${email}`;
  if (loginRateLimited(limitKey)) return res.status(429).json({ error: 'Тым көп әрекет. 15 минуттан соң қайталаңыз.' });

  const user = db.prepare('SELECT * FROM users WHERE email = ?').get(email);
  if (!user || !verifyPassword(password, user.password_hash)) {
    return res.status(401).json({ error: 'Пошта немесе құпия сөз қате.' });
  }
  if (user.status === 'blocked') return res.status(403).json({ error: 'Аккаунтыңыз бұғатталған. Мектеп әкімшісіне хабарласыңыз.' });
  if (role === 'admin' && user.role !== 'admin') return res.status(403).json({ error: 'Бұл аккаунтта әкімші құқығы жоқ. «Мұғалім» қойындысын таңдаңыз.' });
  resetLoginAttempts(limitKey);

  const token = newSessionToken();
  const ms = remember ? SESSION_DAYS_REMEMBER * 864e5 : SESSION_HOURS_DEFAULT * 36e5;
  const expires = new Date(Date.now() + ms);
  db.prepare("DELETE FROM sessions WHERE expires_at <= datetime('now')").run();
  db.prepare('INSERT INTO sessions (token, user_id, expires_at) VALUES (?, ?, ?)')
    .run(token, user.id, expires.toISOString().replace('T', ' ').slice(0, 19));
  const firstLogin = user.status === 'pending';
  db.prepare("UPDATE users SET last_login_at = datetime('now'), status = CASE WHEN status = 'pending' THEN 'active' ELSE status END WHERE id = ?").run(user.id);
  if (firstLogin) notify(user.id, 'Sabaq AI-ға қош келдіңіз!', 'ҚМЖ, презентация және суреттерді бірнеше минутта дайындаңыз.');

  res.cookie(COOKIE, token, {
    httpOnly: true, sameSite: 'lax', secure: secureCookies, path: '/', ...(remember ? { expires } : {}),
  });
  const fresh = db.prepare('SELECT * FROM users WHERE id = ?').get(user.id);
  res.json({ user: publicUser(fresh), redirect: role === 'admin' ? '/admin' : '/' });
});

app.post('/api/auth/logout', (req, res) => {
  const token = req.cookies?.[COOKIE];
  if (token) db.prepare('DELETE FROM sessions WHERE token = ?').run(token);
  res.clearCookie(COOKIE, { path: '/' });
  res.json({ ok: true });
});

app.get('/api/me', requireUser, (req, res) => res.json({ user: publicUser(req.user), ai: aiEnabled }));

app.post('/api/me/password', requireUser, (req, res) => {
  const current = typeof req.body?.current === 'string' ? req.body.current : '';
  const next = typeof req.body?.next === 'string' ? req.body.next : '';
  if (!verifyPassword(current, req.user.password_hash)) return res.status(400).json({ error: 'Қазіргі құпия сөз қате.' });
  if (next.length < 8) return res.status(400).json({ error: 'Жаңа құпия сөз кемінде 8 таңбадан тұруы керек.' });
  if (next === current) return res.status(400).json({ error: 'Жаңа құпия сөз ескісінен өзгеше болуы керек.' });
  db.prepare('UPDATE users SET password_hash = ?, must_change_password = 0 WHERE id = ?').run(hashPassword(next), req.user.id);
  db.prepare('DELETE FROM sessions WHERE user_id = ? AND token != ?').run(req.user.id, req.cookies[COOKIE]);
  res.json({ ok: true });
});

/* -------------------------------------------------------------- dashboard */

app.get('/api/stats', requireUser, (req, res) => {
  const rows = db.prepare('SELECT kind, COUNT(*) AS n FROM projects WHERE user_id = ? GROUP BY kind').all(req.user.id);
  const counts = { qmz: 0, presentation: 0, image: 0 };
  for (const r of rows) counts[r.kind] = r.n;
  const slides = db.prepare("SELECT COALESCE(SUM(json_extract(meta, '$.slideCount')), 0) AS n FROM projects WHERE user_id = ? AND kind = 'presentation'").get(req.user.id).n;
  const week = db.prepare("SELECT COUNT(*) AS n FROM projects WHERE user_id = ? AND created_at >= datetime('now', '-7 days')").get(req.user.id).n;
  res.json({ ...counts, slides, week });
});

app.get('/api/projects', requireUser, (req, res) => {
  const kind = ['qmz', 'presentation', 'image'].includes(req.query.kind) ? req.query.kind : null;
  const q = str(req.query.q, 100);
  const limit = Math.min(Math.max(parseInt(req.query.limit, 10) || 50, 1), 200);
  let sql = 'SELECT id, kind, title, subject, meta, created_at FROM projects WHERE user_id = ?';
  const args = [req.user.id];
  if (kind) { sql += ' AND kind = ?'; args.push(kind); }
  if (q) { sql += ' AND (title LIKE ? OR subject LIKE ?)'; args.push(`%${q}%`, `%${q}%`); }
  sql += ' ORDER BY created_at DESC, id DESC LIMIT ?';
  args.push(limit);
  res.json({ projects: db.prepare(sql).all(...args).map((r) => projectRow(r)) });
});

function ownProject(req, res) {
  const row = db.prepare('SELECT * FROM projects WHERE id = ? AND user_id = ?').get(Number(req.params.id), req.user.id);
  if (!row) {
    res.status(404).json({ error: 'Жоба табылмады.' });
    return null;
  }
  return projectRow(row, { full: true });
}

app.get('/api/projects/:id', requireUser, (req, res) => {
  const p = ownProject(req, res);
  if (p) res.json({ project: p });
});

app.delete('/api/projects/:id', requireUser, (req, res) => {
  const info = db.prepare('DELETE FROM projects WHERE id = ? AND user_id = ?').run(Number(req.params.id), req.user.id);
  if (!info.changes) return res.status(404).json({ error: 'Жоба табылмады.' });
  res.json({ ok: true });
});

const safeFileName = (s) => s.replace(/[\\/:*?"<>|\n\r]+/g, ' ').trim().slice(0, 80) || 'sabaq';
const attachment = (res, name, type) => res.set({
  'Content-Type': type,
  'Content-Disposition': `attachment; filename="sabaq.${name.split('.').pop()}"; filename*=UTF-8''${encodeURIComponent(name)}`,
});

app.get('/api/projects/:id/docx', requireUser, wrap(async (req, res) => {
  const p = ownProject(req, res);
  if (!p) return;
  if (p.kind !== 'qmz') return res.status(400).json({ error: 'Word тек ҚМЖ үшін қолжетімді.' });
  const buf = await qmzToDocx(p);
  attachment(res, `ҚМЖ - ${safeFileName(p.title)}.docx`, 'application/vnd.openxmlformats-officedocument.wordprocessingml.document').send(buf);
}));

app.get('/api/projects/:id/pptx', requireUser, wrap(async (req, res) => {
  const p = ownProject(req, res);
  if (!p) return;
  if (p.kind !== 'presentation') return res.status(400).json({ error: 'PowerPoint тек презентация үшін қолжетімді.' });
  const buf = await presentationToPptx(p);
  attachment(res, `${safeFileName(p.title)}.pptx`, 'application/vnd.openxmlformats-officedocument.presentationml.presentation').send(buf);
}));

app.get('/api/projects/:id/image.svg', requireUser, (req, res) => {
  const p = ownProject(req, res);
  if (!p) return;
  if (p.kind !== 'image') return res.status(400).json({ error: 'Бұл сурет емес.' });
  res.set({
    'Content-Type': 'image/svg+xml; charset=utf-8',
    'Content-Security-Policy': "default-src 'none'; style-src 'unsafe-inline'; sandbox",
    'Cache-Control': 'private, max-age=86400',
  });
  if (req.query.download) res.set('Content-Disposition', `attachment; filename="image.svg"; filename*=UTF-8''${encodeURIComponent(safeFileName(p.title) + '.svg')}`);
  res.send(p.data.svg);
});

/* ------------------------------------------------------------- generation */

app.post('/api/generate/qmz', requireUser, generation(async (req, res) => {
  const b = req.body || {};
  const subject = SUBJECTS.includes(b.subject) ? b.subject : null;
  const grade = Number(b.grade);
  const quarter = Number(b.quarter);
  const topic = str(b.topic, 300);
  const goals = str(b.goals, 800);
  const notes = str(b.notes, 800);
  const value = VALUES.find((v) => v.key === b.value);
  if (!subject) return res.status(400).json({ error: 'Пәнді таңдаңыз.' });
  if (!(grade >= 1 && grade <= 11)) return res.status(400).json({ error: 'Сыныпты таңдаңыз.' });
  if (!(quarter >= 1 && quarter <= 4)) return res.status(400).json({ error: 'Тоқсанды таңдаңыз.' });
  if (topic.length < 3) return res.status(400).json({ error: 'Сабақ тақырыбын жазыңыз.' });
  if (!value) return res.status(400).json({ error: 'Құндылықты таңдаңыз.' });

  const data = await generateQmz({ subject, grade, quarter: ['I', 'II', 'III', 'IV'][quarter - 1], topic, goals, notes, value });
  const meta = {
    subject, grade, quarter: ['I', 'II', 'III', 'IV'][quarter - 1], value: value.key, valueLabel: value.label,
    goals, teacher: req.user.name, date: todayKz(), demo: !aiEnabled,
  };
  const project = saveProject(req.user.id, 'qmz', topic, subject, meta, data);
  notify(req.user.id, 'ҚМЖ дайын болды', `«${topic}» жоспары генерацияланды.`);
  res.json({ project });
}));

app.post('/api/generate/presentation', requireUser, generation(async (req, res) => {
  const b = req.body || {};
  const topic = str(b.topic, 500);
  const style = PRESENTATION_STYLES.some((s) => s.key === b.style) ? b.style : 'minimal';
  const count = SLIDE_COUNTS.includes(Number(b.count)) ? Number(b.count) : 8;
  const subject = SUBJECTS.includes(b.subject) ? b.subject : null;
  if (topic.length < 3) return res.status(400).json({ error: 'Презентация тақырыбын жазыңыз.' });

  const data = await generatePresentation({ topic, style, count });
  const meta = { style, count, slideCount: data.slides.length, topic, demo: !aiEnabled };
  const project = saveProject(req.user.id, 'presentation', data.title || topic, subject, meta, data);
  notify(req.user.id, 'Презентация дайын', `«${project.title}» — ${data.slides.length} слайд.`);
  res.json({ project });
}));

app.post('/api/generate/image', requireUser, generation(async (req, res) => {
  const b = req.body || {};
  const prompt = str(b.prompt, 400);
  const style = IMAGE_STYLES.some((s) => s.key === b.style) ? b.style : 'watercolor';
  if (prompt.length < 3) return res.status(400).json({ error: 'Иллюстрация сипаттамасын жазыңыз.' });

  const data = await generateImage({ prompt, style });
  const styleLabel = IMAGE_STYLES.find((s) => s.key === style).label;
  const project = saveProject(req.user.id, 'image', data.title || prompt, data.subject || null,
    { style, styleLabel, prompt, demo: !aiEnabled }, data);
  res.json({ project });
}));

/* ---------------------------------------------------------- notifications */

app.get('/api/notifications', requireUser, (req, res) => {
  const list = db.prepare('SELECT id, title, body, is_read, created_at FROM notifications WHERE user_id = ? ORDER BY id DESC LIMIT 30').all(req.user.id);
  res.json({
    notifications: list.map((n) => ({ id: n.id, title: n.title, body: n.body, read: Boolean(n.is_read), createdAt: n.created_at })),
    unread: list.filter((n) => !n.is_read).length,
  });
});

app.post('/api/notifications/read', requireUser, (req, res) => {
  db.prepare('UPDATE notifications SET is_read = 1 WHERE user_id = ?').run(req.user.id);
  res.json({ ok: true });
});

/* ------------------------------------------------------------------ admin */

function adminUserRow(u) {
  const c = db.prepare('SELECT COUNT(*) AS n FROM projects WHERE user_id = ?').get(u.id).n;
  return { ...publicUser(u), projectCount: c };
}

app.get('/api/admin/users', requireAdmin, (req, res) => {
  const users = db.prepare('SELECT * FROM users ORDER BY created_at DESC, id DESC').all();
  const teachers = users.filter((u) => u.role === 'teacher');
  res.json({
    users: users.map(adminUserRow),
    stats: {
      total: teachers.length,
      active: teachers.filter((u) => u.status === 'active').length,
      pending: teachers.filter((u) => u.status === 'pending').length,
      blocked: teachers.filter((u) => u.status === 'blocked').length,
      projects: db.prepare('SELECT COUNT(*) AS n FROM projects').get().n,
    },
  });
});

app.post('/api/admin/users', requireAdmin, (req, res) => {
  const name = str(req.body?.name, 120);
  const email = str(req.body?.email, 200).toLowerCase();
  const subject = SUBJECTS.includes(req.body?.subject) ? req.body.subject : null;
  const role = req.body?.role === 'admin' ? 'admin' : 'teacher';
  if (name.length < 2) return res.status(400).json({ error: 'Аты-жөнін жазыңыз.' });
  if (!isEmail(email)) return res.status(400).json({ error: 'Электрондық пошта дұрыс емес.' });
  if (db.prepare('SELECT id FROM users WHERE email = ?').get(email)) return res.status(409).json({ error: 'Бұл поштамен аккаунт бұрыннан бар.' });
  const password = generateTempPassword();
  const info = db.prepare(`INSERT INTO users (name, email, password_hash, role, subject, status, must_change_password)
                           VALUES (?, ?, ?, ?, ?, 'pending', 1)`).run(name, email, hashPassword(password), role, subject);
  const user = db.prepare('SELECT * FROM users WHERE id = ?').get(info.lastInsertRowid);
  res.status(201).json({ user: adminUserRow(user), tempPassword: password });
});

app.patch('/api/admin/users/:id', requireAdmin, (req, res) => {
  const id = Number(req.params.id);
  const user = db.prepare('SELECT * FROM users WHERE id = ?').get(id);
  if (!user) return res.status(404).json({ error: 'Пайдаланушы табылмады.' });
  const b = req.body || {};
  if (b.status !== undefined) {
    if (!['active', 'blocked'].includes(b.status)) return res.status(400).json({ error: 'Қате мәртебе.' });
    if (id === req.user.id) return res.status(400).json({ error: 'Өз аккаунтыңызды бұғаттай алмайсыз.' });
    const next = b.status === 'active' && !user.last_login_at ? 'pending' : b.status;
    db.prepare('UPDATE users SET status = ? WHERE id = ?').run(next, id);
    if (next === 'blocked') db.prepare('DELETE FROM sessions WHERE user_id = ?').run(id);
  }
  if (b.name !== undefined) {
    const name = str(b.name, 120);
    if (name.length < 2) return res.status(400).json({ error: 'Аты-жөнін жазыңыз.' });
    db.prepare('UPDATE users SET name = ? WHERE id = ?').run(name, id);
  }
  if (b.subject !== undefined) {
    db.prepare('UPDATE users SET subject = ? WHERE id = ?').run(SUBJECTS.includes(b.subject) ? b.subject : null, id);
  }
  res.json({ user: adminUserRow(db.prepare('SELECT * FROM users WHERE id = ?').get(id)) });
});

app.post('/api/admin/users/:id/reset-password', requireAdmin, (req, res) => {
  const id = Number(req.params.id);
  const user = db.prepare('SELECT * FROM users WHERE id = ?').get(id);
  if (!user) return res.status(404).json({ error: 'Пайдаланушы табылмады.' });
  const password = generateTempPassword();
  db.prepare('UPDATE users SET password_hash = ?, must_change_password = 1 WHERE id = ?').run(hashPassword(password), id);
  db.prepare('DELETE FROM sessions WHERE user_id = ?').run(id);
  res.json({ tempPassword: password, user: adminUserRow(db.prepare('SELECT * FROM users WHERE id = ?').get(id)) });
});

app.delete('/api/admin/users/:id', requireAdmin, (req, res) => {
  const id = Number(req.params.id);
  if (id === req.user.id) return res.status(400).json({ error: 'Өз аккаунтыңызды жоя алмайсыз.' });
  const info = db.prepare('DELETE FROM users WHERE id = ?').run(id);
  if (!info.changes) return res.status(404).json({ error: 'Пайдаланушы табылмады.' });
  res.json({ ok: true });
});

/* ------------------------------------------------------------------ pages */

const page = (file, { admin = false, guest = false } = {}) => (req, res) => {
  const user = loadSession(req);
  if (guest) return user ? res.redirect(user.role === 'admin' ? '/admin' : '/') : res.sendFile(path.join(PUBLIC, 'pages', file));
  if (!user) return res.redirect('/login');
  if (admin && user.role !== 'admin') return res.redirect('/');
  res.set('Cache-Control', 'no-store').sendFile(path.join(PUBLIC, 'pages', file));
};

app.get('/login', page('login.html', { guest: true }));
app.get('/', page('dashboard.html'));
app.get('/qmz', page('qmz.html'));
app.get('/presentation', page('presentation.html'));
app.get('/images', page('images.html'));
app.get('/projects', page('projects.html'));
app.get('/admin', page('admin.html', { admin: true }));
app.use(express.static(PUBLIC, { index: false, maxAge: '1h' }));

app.use('/api', (_req, res) => res.status(404).json({ error: 'Табылмады.' }));

app.use((err, _req, res, _next) => {
  if (err instanceof AIError) return res.status(err.status).json({ error: err.message });
  if (err?.type === 'entity.parse.failed') return res.status(400).json({ error: 'Қате JSON.' });
  console.error(err);
  res.status(500).json({ error: 'Сервер қатесі. Кейінірек қайталап көріңіз.' });
});

/* ------------------------------------------------------------------ start */

if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  const seeded = seedAdmin();
  if (seeded) {
    console.log(`Бірінші әкімші жасалды: ${seeded.email}` + (process.env.ADMIN_PASSWORD ? '' : ` / ${seeded.password} (кіргеннен кейін өзгертіңіз)`));
  }
  const port = Number(process.env.PORT) || 3000;
  app.listen(port, () => {
    console.log(`Sabaq AI → http://localhost:${port}`);
    if (!aiEnabled) console.log('ANTHROPIC_API_KEY орнатылмаған — генерация демо режимінде жұмыс істейді.');
  });
}
