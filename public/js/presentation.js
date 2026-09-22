import { $, $$, api, chipGroup, setChip, download, esc, getCatalog, initPage, setBusy, toast, ICONS } from './common.js';

const [{ user }, catalog] = await Promise.all([initPage(), getCatalog()]);

/* Same palettes as the PowerPoint export (server/export.js). */
const THEMES = {
  minimal: { bg: '#FBF7F0', ink: '#1C1B2E', accent: '#E0733D', accent2: '#2F7D74', dark: '#1B2438' },
  colorful: { bg: '#FFF8EE', ink: '#1C1B2E', accent: '#E0733D', accent2: '#6C4AB6', dark: '#E0733D' },
  science: { bg: '#F4F7FA', ink: '#15202B', accent: '#2F7D74', accent2: '#1B2438', dark: '#1B2438' },
  kids: { bg: '#FFFBEA', ink: '#2A2440', accent: '#F2A33A', accent2: '#2F9D8F', dark: '#2F9D8F' },
};

const state = { style: 'minimal', count: 8, project: null, active: 0 };
$('#subject').insertAdjacentHTML('beforeend', catalog.subjects.map((s) => `<option ${s === user.subject ? 'selected' : ''}>${esc(s)}</option>`).join(''));
chipGroup($('#styles'), catalog.presentationStyles.map((s) => ({ value: s.key, label: s.label })), state.style, (v) => { state.style = v; });
chipGroup($('#counts'), catalog.slideCounts.map((n) => ({ value: n, label: String(n) })), state.count, (v) => { state.count = Number(v); });

const ul = (items, cls = '') => `<ul class="s-list ${cls}">${(items || []).map((b) => `<li>${esc(b)}</li>`).join('')}</ul>`;

function slideHtml(s, theme, extra = '') {
  const t = THEMES[theme] || THEMES.minimal;
  const vars = `--s-bg:${t.bg};--s-ink:${t.ink};--s-accent:${t.accent};--s-accent2:${t.accent2};--s-dark:${t.dark};`;
  const cls = s.layout === 'title' ? 'dark' : s.layout === 'closing' ? 'closing' : '';
  let body;
  if (s.layout === 'title' || s.layout === 'closing') {
    body = `<div class="s-title">${esc(s.heading)}</div>${s.subheading ? `<div class="s-sub">${esc(s.subheading)}</div>` : ''}`;
  } else {
    const head = `<div class="s-rule"></div><div class="s-h">${esc(s.heading)}</div>${s.subheading ? `<div class="s-sub">${esc(s.subheading)}</div>` : ''}`;
    if (s.layout === 'two_column') {
      body = `${head}<div class="s-cols"><div><div class="s-col-t" style="color:${t.accent}">${esc(s.left_title)}</div>${ul(s.left)}</div><div><div class="s-col-t" style="color:${t.accent2}">${esc(s.right_title)}</div>${ul(s.right)}</div></div>`;
    } else if (s.layout === 'highlight') {
      body = `${head}<div class="s-highlight">${esc(s.highlight)}</div>`;
    } else if (s.layout === 'quiz') {
      body = `${head}${ul(s.bullets, 's-quiz')}`;
    } else {
      body = `${head}${ul(s.bullets)}`;
    }
  }
  return `<div class="slide ${cls}" style="${vars}${extra}"><div class="slide-inner">${body}</div></div>`;
}

function place(i) {
  const d = i - state.active;
  const a = Math.abs(d);
  const base = 'transform:translate(-50%,-50%) ';
  if (d === 0) return `${base}scale(1);opacity:1;z-index:10;`;
  if (a === 1) return `${base}translateX(${d * 62}%) scale(.78) rotateY(${d * -30}deg);opacity:.85;z-index:5;`;
  if (a === 2) return `${base}translateX(${d * 52}%) scale(.6) rotateY(${d * -30}deg);opacity:.4;z-index:2;`;
  return `${base}translateX(${d * 45}%) scale(.5);opacity:0;z-index:1;pointer-events:none;`;
}

function updateCarousel() {
  const { slides } = state.project.data;
  $$('.carousel .slide').forEach((el, i) => { el.setAttribute('style', el.dataset.vars + place(i)); });
  $$('.dot').forEach((d, i) => d.setAttribute('aria-current', String(i === state.active)));
  $('#slide-num').textContent = `Слайд ${state.active + 1} / ${slides.length}`;
  const notes = slides[state.active].notes;
  $('#notes').hidden = !notes;
  $('#notes').innerHTML = notes ? `<b>Мұғалімге жазба:</b> ${esc(notes)}` : '';
}

function go(i) {
  const n = state.project.data.slides.length;
  state.active = Math.max(0, Math.min(n - 1, i));
  updateCarousel();
  if (!$('#present').hidden) renderPresenter();
}

function render(project) {
  state.project = project;
  state.active = 0;
  const { slides } = project.data;
  const theme = project.meta.style;
  $('#result').innerHTML = `
    <div class="carousel-wrap fade-up">
      <div style="text-align:center"><h2 style="font-size:21px">${esc(project.data.title)}</h2><div class="muted" style="font-size:13.5px;margin-top:4px">${slides.length} слайд${project.meta.demo ? ' · демо' : ''}</div></div>
      <div class="carousel" id="carousel">${slides.map((s, i) => slideHtml(s, theme).replace('<div class="slide', `<div data-i="${i}" class="slide`)).join('')}</div>
      <div class="carousel-ctrl">
        <button class="arrow-btn" id="prev" aria-label="Алдыңғы слайд"><svg width="17" height="17" viewBox="0 0 24 24" fill="none" stroke="var(--ink)" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M15 18l-6-6 6-6"/></svg></button>
        <div class="dots">${slides.map((_, i) => `<button class="dot" data-i="${i}" aria-label="${i + 1}-слайдқа өту"></button>`).join('')}</div>
        <button class="arrow-btn" id="next" aria-label="Келесі слайд"><svg width="17" height="17" viewBox="0 0 24 24" fill="none" stroke="var(--ink)" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M9 18l6-6-6-6"/></svg></button>
      </div>
      <div class="muted" style="font-size:13px" id="slide-num"></div>
      <div class="notes" id="notes" hidden></div>
      <div class="pres-actions">
        <button class="btn-primary teal" id="show">▶ Көрсету</button>
        <button class="btn-ghost" id="dl">${ICONS.download} PowerPoint (.pptx)</button>
      </div>
    </div>`;
  $$('.carousel .slide').forEach((el) => { el.dataset.vars = el.getAttribute('style'); });
  $('#carousel').addEventListener('click', (e) => { const s = e.target.closest('.slide'); if (s) go(Number(s.dataset.i)); });
  $('.dots').addEventListener('click', (e) => { const d = e.target.closest('.dot'); if (d) go(Number(d.dataset.i)); });
  $('#prev').addEventListener('click', () => go(state.active - 1));
  $('#next').addEventListener('click', () => go(state.active + 1));
  $('#dl').addEventListener('click', () => download(`/api/projects/${project.id}/pptx`));
  $('#show').addEventListener('click', openPresenter);
  updateCarousel();
  document.title = `Презентация — ${project.data.title}`;
}

/* ---------- full-screen presenter ---------- */
function renderPresenter() {
  const { slides } = state.project.data;
  $('#present-stage').innerHTML = slideHtml(slides[state.active], state.project.meta.style);
  $('#p-count').textContent = `${state.active + 1} / ${slides.length}`;
}
function openPresenter() {
  $('#present').hidden = false;
  renderPresenter();
  document.documentElement.requestFullscreen?.().catch(() => {});
}
function closePresenter() {
  $('#present').hidden = true;
  if (document.fullscreenElement) document.exitFullscreen().catch(() => {});
}
$('#p-prev').addEventListener('click', () => go(state.active - 1));
$('#p-next').addEventListener('click', () => go(state.active + 1));
$('#p-exit').addEventListener('click', closePresenter);
$('#present-stage').addEventListener('click', () => go(state.active + 1));
document.addEventListener('fullscreenchange', () => { if (!document.fullscreenElement) $('#present').hidden = true; });
document.addEventListener('keydown', (e) => {
  if (!state.project || ['INPUT', 'TEXTAREA', 'SELECT'].includes(document.activeElement?.tagName)) return;
  if (e.key === 'ArrowRight' || (e.key === ' ' && !$('#present').hidden)) { e.preventDefault(); go(state.active + 1); }
  if (e.key === 'ArrowLeft') go(state.active - 1);
  if (e.key === 'Escape') closePresenter();
});

$('#form').addEventListener('submit', async (e) => {
  e.preventDefault();
  const topic = $('#topic').value.trim();
  if (topic.length < 3) { toast('Презентация тақырыбын жазыңыз.', 'error'); $('#topic').focus(); return; }
  const btn = $('#gen');
  setBusy(btn, true, 'Слайдтар жасалуда...');
  $('#result').innerHTML = `<div class="loading-state"><svg class="spin" width="36" height="36" viewBox="0 0 24 24" fill="none" stroke="var(--teal)" stroke-width="2.4" stroke-linecap="round"><path d="M12 3a9 9 0 019 9"/></svg><div style="font-size:16px">Слайдтар құрастырылуда...</div><div class="muted" style="font-size:12.5px">Әдетте 20–60 секунд алады</div></div>`;
  try {
    const { project } = await api('/api/generate/presentation', { method: 'POST', body: { topic, style: state.style, count: state.count, subject: $('#subject').value } });
    history.replaceState(null, '', `/presentation?id=${project.id}`);
    render(project);
    toast('Презентация дайын және сақталды.');
  } catch (err) {
    $('#result').innerHTML = `<div class="empty-state"><div style="color:var(--danger);font-size:16px">${esc(err.message)}</div><div>Қайталап көріңіз.</div></div>`;
    toast(err.message, 'error');
  } finally {
    setBusy(btn, false);
  }
});

const id = new URLSearchParams(location.search).get('id');
if (id) {
  try {
    const { project } = await api(`/api/projects/${encodeURIComponent(id)}`);
    if (project.kind === 'presentation') {
      render(project);
      $('#topic').value = project.meta.topic || project.data.title;
      state.style = project.meta.style;
      state.count = project.meta.count;
      setChip($('#styles'), state.style);
      setChip($('#counts'), state.count);
      if (project.subject) $('#subject').value = project.subject;
    }
  } catch (err) {
    toast(err.message, 'error');
  }
}
