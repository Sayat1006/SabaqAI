import { $, api, confirmDialog, esc, getCatalog, initials, initPage, modal, timeAgo, toast } from './common.js';

const [{ user: me }, catalog] = await Promise.all([initPage(), getCatalog()]);
$('#subject').insertAdjacentHTML('beforeend', catalog.subjects.map((s) => `<option>${esc(s)}</option>`).join(''));

const STATUS = { active: ['Белсенді', 'st-active'], pending: ['Күтуде', 'st-pending'], blocked: ['Бұғатталған', 'st-blocked'] };
let users = [];

function showPassword(u, password, title) {
  const text = `Sabaq AI\nКіру: ${location.origin}/login\nПошта: ${u.email}\nУақытша құпия сөз: ${password}`;
  const m = modal(`<h2>${esc(title)}</h2>
    <div class="muted">${esc(u.name)} үшін уақытша құпия сөз. Бұл терезе жабылғаннан кейін құпия сөз қайта көрсетілмейді.</div>
    <div class="secret">${esc(password)}</div>
    <div class="muted" style="font-size:13px">Пошта: <b>${esc(u.email)}</b></div>
    <div class="modal-actions"><button class="btn-ghost" data-copy>Көшіру</button><button class="btn-primary" data-close>Дайын</button></div>`);
  $('[data-copy]', m.el).addEventListener('click', async () => {
    try { await navigator.clipboard.writeText(text); toast('Кіру деректері көшірілді.'); } catch { toast('Көшіру мүмкін болмады — қолмен көшіріңіз.', 'error'); }
  });
}

function render() {
  const q = $('#q').value.trim().toLowerCase();
  const st = $('#f-status').value;
  const list = users.filter((u) => (!st || u.status === st) && (!q || u.name.toLowerCase().includes(q) || u.email.includes(q)));
  $('#list').innerHTML = list.length ? list.map((u, i) => {
    const [label, cls] = STATUS[u.status];
    const self = u.id === me.id;
    const meta = [u.email, u.role === 'admin' ? 'Әкімші' : u.subject, `${u.projectCount} материал`, u.lastLoginAt ? `соңғы кіру: ${timeAgo(u.lastLoginAt)}` : 'әлі кірмеген'].filter(Boolean).map(esc).join(' · ');
    return `<div class="acc-card" data-id="${u.id}" style="animation-delay:${Math.min(i, 10) * 0.04}s">
      <div class="acc-main">
        <div class="avatar ${u.role === 'admin' ? 'av-g' : (i % 2 ? 'av-g' : 'av-t')}" style="width:42px;height:42px;border-radius:12px">${esc(initials(u.name))}</div>
        <div style="min-width:0"><div class="acc-name">${esc(u.name)}${self ? ' <span class="muted" style="font-weight:400">(сіз)</span>' : ''}</div><div class="acc-meta">${meta}</div></div>
      </div>
      <div class="acc-actions">
        <span class="status-chip ${cls}">${label}</span>
        ${self ? '' : `<button class="btn-ghost" data-act="toggle">${u.status === 'blocked' ? 'Белсендіру' : 'Бұғаттау'}</button>
        <button class="btn-ghost" data-act="reset">Құпия сөз</button>
        <button class="btn-ghost danger" data-act="delete">Жою</button>`}
      </div>
    </div>`;
  }).join('') : '<div class="card" style="padding:24px;text-align:center"><div class="muted">Аккаунт табылмады.</div></div>';
}

async function load() {
  const res = await api('/api/admin/users');
  users = res.users;
  $('#s-total').textContent = res.stats.total;
  $('#s-active').textContent = res.stats.active;
  $('#s-pending').textContent = res.stats.pending;
  $('#s-projects').textContent = res.stats.projects;
  render();
}

$('#q').addEventListener('input', render);
$('#f-status').addEventListener('change', render);

$('#list').addEventListener('click', async (e) => {
  const btn = e.target.closest('[data-act]');
  if (!btn) return;
  const u = users.find((x) => x.id === Number(btn.closest('.acc-card').dataset.id));
  try {
    if (btn.dataset.act === 'toggle') {
      await api(`/api/admin/users/${u.id}`, { method: 'PATCH', body: { status: u.status === 'blocked' ? 'active' : 'blocked' } });
      toast(u.status === 'blocked' ? 'Аккаунт белсендірілді.' : 'Аккаунт бұғатталды.');
    } else if (btn.dataset.act === 'reset') {
      if (!(await confirmDialog('Құпия сөзді жаңарту', `${u.name} үшін жаңа уақытша құпия сөз жасалады, ескісі жарамсыз болады.`, 'Жаңарту'))) return;
      const res = await api(`/api/admin/users/${u.id}/reset-password`, { method: 'POST', body: {} });
      showPassword(u, res.tempPassword, 'Жаңа уақытша құпия сөз');
    } else if (btn.dataset.act === 'delete') {
      if (!(await confirmDialog('Аккаунтты жою', `${u.name} аккаунты мен оның барлық материалдары біржола жойылады.`, 'Жою'))) return;
      await api(`/api/admin/users/${u.id}`, { method: 'DELETE' });
      toast('Аккаунт жойылды.');
    }
    await load();
  } catch (err) {
    toast(err.message, 'error');
  }
});

$('#create').addEventListener('submit', async (e) => {
  e.preventDefault();
  const body = { name: $('#name').value.trim(), email: $('#email').value.trim(), subject: $('#subject').value, role: $('#role').value };
  $('#create-err').textContent = '';
  const btn = $('#create-btn');
  btn.disabled = true;
  try {
    const res = await api('/api/admin/users', { method: 'POST', body });
    $('#name').value = '';
    $('#email').value = '';
    showPassword(res.user, res.tempPassword, 'Аккаунт ашылды');
    await load();
  } catch (err) {
    $('#create-err').textContent = err.message;
  } finally {
    btn.disabled = false;
  }
});

load().catch((err) => toast(err.message, 'error'));
