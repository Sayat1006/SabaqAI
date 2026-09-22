/* Shared helpers for every page: API calls, current user, header, toasts, modals. */

export const $ = (sel, root = document) => root.querySelector(sel);
export const $$ = (sel, root = document) => [...root.querySelectorAll(sel)];

export function esc(value) {
  return String(value ?? '').replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
}

export async function api(path, { method = 'GET', body } = {}) {
  const res = await fetch(path, {
    method,
    headers: body !== undefined ? { 'Content-Type': 'application/json' } : {},
    body: body !== undefined ? JSON.stringify(body) : undefined,
    credentials: 'same-origin',
  });
  let data = null;
  try { data = await res.json(); } catch { /* empty body */ }
  if (res.status === 401 && !path.startsWith('/api/auth/')) {
    location.href = '/login';
    throw new Error('Сессия аяқталды.');
  }
  if (!res.ok) throw new Error(data?.error || `Қате (${res.status})`);
  return data;
}

export function toast(message, type = 'info') {
  let wrap = $('.toast-wrap');
  if (!wrap) {
    wrap = document.createElement('div');
    wrap.className = 'toast-wrap';
    wrap.setAttribute('role', 'status');
    wrap.setAttribute('aria-live', 'polite');
    document.body.append(wrap);
  }
  const el = document.createElement('div');
  el.className = `toast ${type === 'error' ? 'error' : ''}`;
  el.textContent = message;
  wrap.append(el);
  setTimeout(() => el.remove(), type === 'error' ? 6000 : 3500);
}

/** Opens a modal. `html` is trusted markup built by the caller with esc(). Returns {el, close}. */
export function modal(html, { dismissible = true } = {}) {
  const backdrop = document.createElement('div');
  backdrop.className = 'modal-backdrop';
  backdrop.innerHTML = `<div class="modal" role="dialog" aria-modal="true">${html}</div>`;
  document.body.append(backdrop);
  const close = () => { backdrop.remove(); document.removeEventListener('keydown', onKey); };
  const onKey = (e) => { if (e.key === 'Escape' && dismissible) close(); };
  document.addEventListener('keydown', onKey);
  if (dismissible) backdrop.addEventListener('click', (e) => { if (e.target === backdrop) close(); });
  $$('[data-close]', backdrop).forEach((b) => b.addEventListener('click', close));
  setTimeout(() => $('input, button', backdrop)?.focus(), 30);
  return { el: backdrop, close };
}

export function confirmDialog(title, text, okLabel = 'Иә') {
  return new Promise((resolve) => {
    const m = modal(`<h2>${esc(title)}</h2><div class="muted">${esc(text)}</div>
      <div class="modal-actions"><button class="btn-ghost" data-close>Бас тарту</button><button class="btn-primary" data-ok>${esc(okLabel)}</button></div>`);
    $('[data-ok]', m.el).addEventListener('click', () => { m.close(); resolve(true); });
    $$('[data-close]', m.el).forEach((b) => b.addEventListener('click', () => resolve(false)));
  });
}

export const initials = (name) => String(name || '?').trim().split(/\s+/).slice(0, 2).map((w) => w[0] || '').join('').toUpperCase();

export function timeAgo(sqlDate) {
  const d = new Date(String(sqlDate).replace(' ', 'T') + 'Z');
  const s = Math.max(0, (Date.now() - d.getTime()) / 1000);
  if (s < 60) return 'жаңа ғана';
  if (s < 3600) return `${Math.floor(s / 60)} минут бұрын`;
  if (s < 86400) return `${Math.floor(s / 3600)} сағат бұрын`;
  const days = Math.floor(s / 86400);
  if (days === 1) return 'Кеше';
  if (days < 7) return `${days} күн бұрын`;
  return d.toLocaleDateString('ru-RU');
}

export const KIND_LABEL = { qmz: 'ҚМЖ', presentation: 'Презентация', image: 'Сурет' };
export const KIND_URL = { qmz: '/qmz', presentation: '/presentation', image: '/images' };

let catalogPromise;
export const getCatalog = () => (catalogPromise ||= api('/api/catalog'));

let mePromise;
export const getMe = () => (mePromise ||= api('/api/me'));

export async function logout() {
  await api('/api/auth/logout', { method: 'POST', body: {} }).catch(() => {});
  location.href = '/login';
}

/** Password change dialog. When `forced`, it cannot be dismissed (first login with a temporary password). */
export function passwordDialog({ forced = false } = {}) {
  const m = modal(`
    <h2>${forced ? 'Жаңа құпия сөз орнатыңыз' : 'Құпия сөзді өзгерту'}</h2>
    ${forced ? '<div class="muted">Әкімші берген уақытша құпия сөзді өзіңіздің құпия сөзіңізге ауыстырыңыз.</div>' : ''}
    <form id="pw-form" style="display:flex;flex-direction:column;gap:14px">
      <div><label class="field-label" for="pw-cur">Қазіргі құпия сөз</label><input class="field-input" id="pw-cur" type="password" autocomplete="current-password" required></div>
      <div><label class="field-label" for="pw-new">Жаңа құпия сөз</label><input class="field-input" id="pw-new" type="password" autocomplete="new-password" minlength="8" required><div class="field-hint">Кемінде 8 таңба</div></div>
      <div><label class="field-label" for="pw-new2">Жаңа құпия сөзді қайталаңыз</label><input class="field-input" id="pw-new2" type="password" autocomplete="new-password" required></div>
      <div class="form-error" id="pw-err"></div>
      <div class="modal-actions">
        ${forced ? '<button type="button" class="btn-ghost" id="pw-logout">Шығу</button>' : '<button type="button" class="btn-ghost" data-close>Бас тарту</button>'}
        <button class="btn-primary" type="submit">Сақтау</button>
      </div>
    </form>`, { dismissible: !forced });
  $('#pw-logout', m.el)?.addEventListener('click', logout);
  $('#pw-form', m.el).addEventListener('submit', async (e) => {
    e.preventDefault();
    const cur = $('#pw-cur', m.el).value;
    const next = $('#pw-new', m.el).value;
    if (next !== $('#pw-new2', m.el).value) { $('#pw-err', m.el).textContent = 'Құпия сөздер сәйкес емес.'; return; }
    try {
      await api('/api/me/password', { method: 'POST', body: { current: cur, next } });
      m.close();
      toast('Құпия сөз сақталды.');
    } catch (err) {
      $('#pw-err', m.el).textContent = err.message;
    }
  });
}

/** Wires the user avatar menu that exists on every signed-in page. */
export function mountUserMenu(user) {
  const holder = $('[data-user-menu]');
  if (!holder) return;
  holder.classList.add('user-menu');
  holder.innerHTML = `
    <button type="button" aria-haspopup="true" aria-expanded="false" aria-label="Профиль мәзірі">${esc(initials(user.name))}</button>
    <div class="menu" hidden>
      <div class="menu-head"><div style="font-weight:700">${esc(user.name)}</div><div class="muted" style="font-size:12.5px">${esc(user.email)}</div></div>
      <a href="/projects">Менің жобаларым</a>
      ${user.role === 'admin' ? '<a href="/admin">Әкімші панелі</a>' : ''}
      <button type="button" data-act="pw">Құпия сөзді өзгерту</button>
      <button type="button" data-act="out">Шығу</button>
    </div>`;
  const btn = $('button', holder);
  const menu = $('.menu', holder);
  const toggle = (open) => { menu.hidden = !open; btn.setAttribute('aria-expanded', String(open)); };
  btn.addEventListener('click', (e) => { e.stopPropagation(); toggle(menu.hidden); });
  document.addEventListener('click', (e) => { if (!holder.contains(e.target)) toggle(false); });
  $('[data-act="pw"]', holder).addEventListener('click', () => { toggle(false); passwordDialog(); });
  $('[data-act="out"]', holder).addEventListener('click', logout);
}

/** Common bootstrap for signed-in pages. */
export async function initPage() {
  const { user, ai } = await getMe();
  mountUserMenu(user);
  if (user.mustChangePassword) passwordDialog({ forced: true });
  const demo = $('[data-demo-banner]');
  if (demo && !ai) demo.hidden = false;
  return { user, ai };
}

export function setBusy(button, busy, label) {
  if (!button) return;
  if (busy) {
    button.dataset.label = button.innerHTML;
    button.disabled = true;
    button.innerHTML = `<svg class="spin" width="17" height="17" viewBox="0 0 24 24" fill="none" stroke="#fff" stroke-width="2.4" stroke-linecap="round"><path d="M12 3a9 9 0 019 9"/></svg><span>${esc(label || 'Дайындалуда...')}</span>`;
  } else {
    button.disabled = false;
    if (button.dataset.label) button.innerHTML = button.dataset.label;
  }
}

export function download(url) {
  const a = document.createElement('a');
  a.href = url;
  a.download = '';
  document.body.append(a);
  a.click();
  a.remove();
}

/** Renders a pressed-state chip group; calls onPick(value). */
export function chipGroup(container, items, current, onPick) {
  container.innerHTML = items.map((it) => `<button type="button" class="chip" data-v="${esc(it.value)}" aria-pressed="${String(it.value) === String(current)}">${esc(it.label)}</button>`).join('');
  container.addEventListener('click', (e) => {
    const b = e.target.closest('.chip');
    if (!b) return;
    $$('.chip', container).forEach((c) => c.setAttribute('aria-pressed', String(c === b)));
    onPick(b.dataset.v);
  });
}

export const ICONS = {
  spark: '<svg width="17" height="17" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M12 3l2.2 5.2L20 10l-5.2 2.2L12 17l-2.2-4.8L4 10l5.8-1.8z"/></svg>',
  download: '<svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M12 3v12m0 0l-4-4m4 4l4-4M4 21h16"/></svg>',
  trash: '<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M3 6h18M8 6V4h8v2M19 6l-1 14H6L5 6"/></svg>',
  arrow: '<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round"><path d="M5 12h14M13 6l6 6-6 6"/></svg>',
};

export function setChip(container, value) {
  $$('.chip', container).forEach((c) => c.setAttribute('aria-pressed', String(c.dataset.v === String(value))));
}
