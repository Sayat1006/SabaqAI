import { $, api, esc, initials, initPage, timeAgo, toast } from './common.js';
import { renderProjects, emptyProjects } from './projects-ui.js';

const { user } = await initPage();

const hour = Number(new Intl.DateTimeFormat('en-US', { hour: 'numeric', hour12: false, timeZone: 'Asia/Almaty' }).format(new Date()));
const part = hour < 5 ? 'Қайырлы түн' : hour < 12 ? 'Қайырлы таң' : hour < 18 ? 'Қайырлы күн' : 'Қайырлы кеш';
// "Айгерім Нұрланқызы" → Айгерім; "Айтбаев Саят" → Саят (surname-first order).
const words = user.name.trim().split(/\s+/);
const surnameFirst = words.length > 1 && /(ов|ев|ова|ева|ин|ина)$/i.test(words[0]);
const firstName = surnameFirst ? words[1] : words[0];
$('#greeting').textContent = `${part}, ${firstName}!`;
$('#side-avatar').textContent = initials(user.name);
$('#side-name').textContent = user.name;
$('#side-sub').textContent = user.role === 'admin' ? 'Әкімші' : (user.subject ? `${user.subject} мұғалімі` : 'Мұғалім');
if (user.role === 'admin') $('#admin-link').hidden = false;

async function loadStats() {
  const s = await api('/api/stats');
  $('#st-qmz').textContent = s.qmz;
  $('#st-slides').textContent = s.slides;
  $('#st-images').textContent = s.image;
}

async function loadRecent(q = '') {
  const { projects } = await api(`/api/projects?limit=${q ? 30 : 6}${q ? `&q=${encodeURIComponent(q)}` : ''}`);
  $('#recent-title').textContent = q ? `Іздеу нәтижесі: «${q}»` : 'Соңғы жобалар';
  renderProjects($('#recent'), projects, {
    emptyHtml: emptyProjects(q ? 'Ештеңе табылмады.' : undefined),
    onChange: loadStats,
  });
}

let searchTimer;
$('#search').addEventListener('input', (e) => {
  clearTimeout(searchTimer);
  searchTimer = setTimeout(() => loadRecent(e.target.value.trim()).catch((err) => toast(err.message, 'error')), 250);
});
$('#search-form').addEventListener('submit', (e) => e.preventDefault());

/* notifications drawer */
const drawer = $('#drawer');
const backdrop = $('#drawer-backdrop');
async function loadNotifications() {
  const { notifications, unread } = await api('/api/notifications');
  $('#notif-dot').hidden = unread === 0;
  $('#notif-list').innerHTML = notifications.length
    ? notifications.map((n) => `<div class="notif ${n.read ? '' : 'unread'}"><div class="notif-title">${esc(n.title)}</div><div class="notif-body">${esc(n.body)}</div><div class="notif-time">${timeAgo(n.createdAt)}</div></div>`).join('')
    : '<div class="muted">Хабарландыру жоқ.</div>';
  return unread;
}
async function openDrawer(open) {
  drawer.classList.toggle('open', open);
  drawer.setAttribute('aria-hidden', String(!open));
  backdrop.hidden = !open;
  if (open) {
    $('#drawer-close').focus();
    const unread = await loadNotifications();
    if (unread) {
      await api('/api/notifications/read', { method: 'POST', body: {} });
      $('#notif-dot').hidden = true;
    }
  }
}
$('#notif-btn').addEventListener('click', () => openDrawer(true));
$('#drawer-close').addEventListener('click', () => openDrawer(false));
backdrop.addEventListener('click', () => openDrawer(false));
document.addEventListener('keydown', (e) => { if (e.key === 'Escape') openDrawer(false); });

await Promise.all([loadStats(), loadRecent(), loadNotifications()]).catch((err) => toast(err.message, 'error'));
