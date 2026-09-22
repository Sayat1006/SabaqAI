import { test, before, after } from 'node:test';
import assert from 'node:assert/strict';
import http from 'node:http';

/* A stand-in for the Anthropic Messages API so the AI code path runs end to end without a real key. */
const captured = [];
let nextOutput = null;
let nextPrefix = [];
const mock = http.createServer((req, res) => {
  let body = '';
  req.on('data', (c) => { body += c; });
  req.on('end', () => {
    const json = JSON.parse(body);
    captured.push({ ...json, beta: req.headers['anthropic-beta'] });
    res.writeHead(200, { 'Content-Type': 'application/json' });
    res.end(JSON.stringify({
      id: 'msg_test', type: 'message', role: 'assistant', model: json.model,
      content: [...nextPrefix, { type: 'text', text: JSON.stringify(nextOutput) }],
      stop_reason: 'end_turn', stop_sequence: null,
      usage: { input_tokens: 10, output_tokens: 10 },
    }));
  });
});

let server;
let base;
const jar = {};

async function call(who, method, path, body) {
  const res = await fetch(base + path, {
    method,
    redirect: 'manual',
    headers: { ...(body ? { 'Content-Type': 'application/json' } : {}), ...(jar[who] ? { Cookie: jar[who] } : {}) },
    body: body ? JSON.stringify(body) : undefined,
  });
  const set = res.headers.get('set-cookie');
  if (set) jar[who] = set.split(';')[0];
  const type = res.headers.get('content-type') || '';
  return { status: res.status, headers: res.headers, data: type.includes('json') ? await res.json() : await res.text() };
}

before(async () => {
  await new Promise((r) => mock.listen(0, r));
  process.env.ANTHROPIC_BASE_URL = `http://127.0.0.1:${mock.address().port}`;
  process.env.ANTHROPIC_API_KEY = 'test-key';
  process.env.DB_PATH = ':memory:';
  const { app } = await import('../server/index.js');
  const { seedAdmin } = await import('../server/db.js');
  seedAdmin();
  server = app.listen(0);
  await new Promise((r) => server.once('listening', r));
  base = `http://127.0.0.1:${server.address().port}`;
});

after(() => {
  server?.close();
  mock.close();
});

test('pages redirect to login when signed out', async () => {
  const r = await call('anon', 'GET', '/qmz');
  assert.equal(r.status, 302);
  assert.equal(r.headers.get('location'), '/login');
});

test('admin creates a teacher who signs in with the temp password', async () => {
  const bad = await call('admin', 'POST', '/api/auth/login', { email: 'admin@sabaq.ai', password: 'wrong', role: 'admin' });
  assert.equal(bad.status, 401);
  const ok = await call('admin', 'POST', '/api/auth/login', { email: 'admin@sabaq.ai', password: 'admin12345', role: 'admin' });
  assert.equal(ok.status, 200);
  assert.equal(ok.data.redirect, '/admin');

  const created = await call('admin', 'POST', '/api/admin/users', { name: 'Айгерім Нұрланқызы', email: 'Aigerim@Sabaq.ai', subject: 'Математика' });
  assert.equal(created.status, 201);
  assert.equal(created.data.user.status, 'pending');
  const dup = await call('admin', 'POST', '/api/admin/users', { name: 'X Y', email: 'aigerim@sabaq.ai' });
  assert.equal(dup.status, 409);

  const asAdmin = await call('teacher', 'POST', '/api/auth/login', { email: 'aigerim@sabaq.ai', password: created.data.tempPassword, role: 'admin' });
  assert.equal(asAdmin.status, 403, 'teacher cannot use the admin tab');
  const login = await call('teacher', 'POST', '/api/auth/login', { email: 'aigerim@sabaq.ai', password: created.data.tempPassword, role: 'teacher' });
  assert.equal(login.status, 200);
  assert.equal(login.data.user.status, 'active');
  assert.equal(login.data.user.mustChangePassword, true);

  const pw = await call('teacher', 'POST', '/api/me/password', { current: created.data.tempPassword, next: 'strongpass1' });
  assert.equal(pw.status, 200);
  const me = await call('teacher', 'GET', '/api/me');
  assert.equal(me.data.user.mustChangePassword, false);

  const forbidden = await call('teacher', 'GET', '/api/admin/users');
  assert.equal(forbidden.status, 403);
});

test('ҚМЖ generation calls Claude with a JSON schema and saves the project', async () => {
  nextOutput = {
    section: 'Бөлшектер', topic: 'Жай бөлшектерді салыстыру', learning_objectives: ['5.1.2.7'], lesson_objectives: ['a'],
    assessment_criteria: ['b'], value_integration: 'c', cross_curricular: 'd', prior_knowledge: 'e',
    stages: [{ name: 'Сабақтың басы', time: '1-5 мин', teacher: ['t'], students: ['s'], assessment: 'a', resources: 'r' }],
    tasks: [{ code: 'T1', level: 'БІЛУ', title: 'x', description: 'y', descriptors: ['z'] }],
    differentiation: 'f', expected_result: 'g', methods: [{ name: 'm', description: 'n' }], reflection: 'h', homework: 'i',
  };
  const r = await call('teacher', 'POST', '/api/generate/qmz', {
    subject: 'Математика', grade: 5, quarter: 2, topic: 'Жай бөлшектерді салыстыру', goals: '5.1.2.7', value: 'work',
  });
  assert.equal(r.status, 200, JSON.stringify(r.data));
  assert.equal(r.data.project.data.section, 'Бөлшектер');
  assert.equal(r.data.project.meta.teacher, 'Айгерім Нұрланқызы');

  const req = captured.at(-1);
  assert.equal(req.model, 'claude-opus-5');
  assert.equal(req.output_config.format.type, 'json_schema');
  assert.ok(req.output_config.format.schema.properties.stages);
  assert.match(req.messages[0].content, /Жай бөлшектерді салыстыру/);
  assert.equal(req.fallbacks, 'default');
  assert.match(req.beta, /server-side-fallback-2026-07-01/);

  const docx = await fetch(`${base}/api/projects/${r.data.project.id}/docx`, { headers: { Cookie: jar.teacher } });
  assert.equal(docx.status, 200);
  assert.equal(Buffer.from(await docx.arrayBuffer()).subarray(0, 2).toString(), 'PK');
});

test('validation errors are reported in Kazakh', async () => {
  const r = await call('teacher', 'POST', '/api/generate/qmz', { subject: 'Математика', grade: 5, quarter: 1, topic: '', value: 'work' });
  assert.equal(r.status, 400);
  assert.match(r.data.error, /тақырыбын/);
});

test('presentation generation and PowerPoint export', async () => {
  const blank = { subheading: '', bullets: [], left_title: '', left: [], right_title: '', right: [], highlight: '', notes: '' };
  nextOutput = {
    title: 'Жай бөлшектер', subtitle: '5-сынып',
    slides: [
      { ...blank, layout: 'title', heading: 'Жай бөлшектер' },
      { ...blank, layout: 'two_column', heading: 'Салыстыру', left_title: 'A', left: ['1'], right_title: 'B', right: ['2'] },
      { ...blank, layout: 'highlight', heading: 'Анықтама', highlight: '3/4' },
      { ...blank, layout: 'closing', heading: 'Рахмет!' },
    ],
  };
  // The answer came from the fallback model after a refusal: a fallback block precedes the text.
  nextPrefix = [{ type: 'fallback', from: { model: 'claude-opus-5' }, to: { model: 'claude-opus-4-8' } }];
  const r = await call('teacher', 'POST', '/api/generate/presentation', { topic: 'Жай бөлшектер', style: 'science', count: 5 });
  nextPrefix = [];
  assert.equal(r.status, 200, JSON.stringify(r.data));
  assert.equal(r.data.project.meta.slideCount, 4);
  const pptx = await fetch(`${base}/api/projects/${r.data.project.id}/pptx`, { headers: { Cookie: jar.teacher } });
  assert.equal(pptx.status, 200);
  assert.equal(Buffer.from(await pptx.arrayBuffer()).subarray(0, 2).toString(), 'PK');
});

test('generated SVG is sanitised and served with a locked-down CSP', async () => {
  nextOutput = {
    title: 'Жапырақ', subject: 'Биология',
    svg: '<svg viewBox="0 0 800 600" onload="alert(1)"><script>alert(1)</script><rect width="800" height="600" fill="#fff"/><image href="https://x/y.png"/></svg>',
  };
  const r = await call('teacher', 'POST', '/api/generate/image', { prompt: 'жапырақ', style: 'flat' });
  assert.equal(r.status, 200);
  const svg = await call('teacher', 'GET', `/api/projects/${r.data.project.id}/image.svg`);
  assert.doesNotMatch(svg.data, /script|onload|image/);
  assert.match(svg.headers.get('content-security-policy'), /default-src 'none'/);
});

test('projects are private to their owner', async () => {
  const other = await call('admin', 'GET', '/api/projects/1');
  assert.equal(other.status, 404);
  const mine = await call('teacher', 'GET', '/api/projects');
  assert.equal(mine.data.projects.length, 3);
  const stats = await call('teacher', 'GET', '/api/stats');
  assert.deepEqual([stats.data.qmz, stats.data.presentation, stats.data.image, stats.data.slides], [1, 1, 1, 4]);
});

test('blocking a teacher ends their session', async () => {
  const users = await call('admin', 'GET', '/api/admin/users');
  const t = users.data.users.find((u) => u.email === 'aigerim@sabaq.ai');
  const r = await call('admin', 'PATCH', `/api/admin/users/${t.id}`, { status: 'blocked' });
  assert.equal(r.data.user.status, 'blocked');
  const me = await call('teacher', 'GET', '/api/me');
  assert.equal(me.status, 401);
  const login = await call('teacher', 'POST', '/api/auth/login', { email: 'aigerim@sabaq.ai', password: 'strongpass1', role: 'teacher' });
  assert.equal(login.status, 403);
});

test('state-changing requests must be JSON', async () => {
  const res = await fetch(`${base}/api/auth/logout`, { method: 'POST', headers: { 'Content-Type': 'application/x-www-form-urlencoded' }, body: 'a=b' });
  assert.equal(res.status, 415);
});
