import { $, api, chipGroup, confirmDialog, download, esc, getCatalog, initPage, modal, setBusy, toast, ICONS } from './common.js';

const [, catalog] = await Promise.all([initPage(), getCatalog()]);
const state = { style: catalog.imageStyles[0].key, images: [] };
chipGroup($('#styles'), catalog.imageStyles.map((s) => ({ value: s.key, label: s.label })), state.style, (v) => { state.style = v; });

const svgUrl = (id) => `/api/projects/${id}/image.svg`;

function card(p, i = 0) {
  const sub = [p.subject, p.meta.styleLabel].filter(Boolean).map(esc).join(' · ');
  return `<article class="g-card" data-id="${p.id}" style="animation-delay:${Math.min(i, 10) * 0.04}s">
    <button class="g-img" data-act="view" aria-label="Үлкейту: ${esc(p.title)}"><img src="${svgUrl(p.id)}" alt="${esc(p.title)}" loading="lazy"></button>
    <div class="g-body">
      <div style="min-width:0"><div class="g-title">${esc(p.title)}</div><div class="g-sub">${sub}</div></div>
      <div class="g-actions">
        <button data-act="png" aria-label="PNG жүктеу" title="PNG жүктеу">${ICONS.download}</button>
        <button data-act="del" class="danger" aria-label="Жою" title="Жою">${ICONS.trash}</button>
      </div>
    </div>
  </article>`;
}

function renderGallery() {
  $('#count').textContent = state.images.length ? `${state.images.length} сурет` : '';
  $('#gallery').innerHTML = state.images.length
    ? state.images.map(card).join('')
    : '<div class="card" style="grid-column:1/-1;padding:28px;text-align:center"><div class="muted">Әзірге сурет жоқ. Жоғарыда сипаттама жазып, алғашқы иллюстрацияңызды жасаңыз.</div></div>';
}

/** Rasterises the SVG in the browser so teachers can paste a PNG into Word or slides. */
async function downloadPng(p) {
  const img = new Image();
  img.src = svgUrl(p.id);
  await img.decode();
  const canvas = document.createElement('canvas');
  canvas.width = 1600;
  canvas.height = 1200;
  canvas.getContext('2d').drawImage(img, 0, 0, canvas.width, canvas.height);
  canvas.toBlob((blob) => {
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `${p.title.replace(/[\\/:*?"<>|]+/g, ' ').trim() || 'sabaq'}.png`;
    a.click();
    setTimeout(() => URL.revokeObjectURL(url), 2000);
  }, 'image/png');
}

function view(p) {
  const m = modal(`<div class="lightbox" style="display:flex;flex-direction:column;gap:14px">
      <img src="${svgUrl(p.id)}" alt="${esc(p.title)}">
      <div><h2>${esc(p.title)}</h2><div class="muted" style="font-size:13.5px;margin-top:4px">${esc(p.meta.prompt || '')}</div></div>
      <div class="modal-actions">
        <button class="btn-ghost" data-svg>${ICONS.download} SVG</button>
        <button class="btn-ghost" data-png>${ICONS.download} PNG</button>
        <button class="btn-primary" data-close>Жабу</button>
      </div></div>`);
  m.el.querySelector('.modal').style.width = 'min(760px, 100%)';
  $('[data-svg]', m.el).addEventListener('click', () => download(`${svgUrl(p.id)}?download=1`));
  $('[data-png]', m.el).addEventListener('click', () => downloadPng(p).catch(() => toast('PNG жасау мүмкін болмады.', 'error')));
}

$('#gallery').addEventListener('click', async (e) => {
  const btn = e.target.closest('[data-act]');
  if (!btn) return;
  const id = Number(btn.closest('.g-card').dataset.id);
  const p = state.images.find((x) => x.id === id);
  if (!p) return;
  if (btn.dataset.act === 'view') view(p);
  if (btn.dataset.act === 'png') downloadPng(p).catch(() => toast('PNG жасау мүмкін болмады.', 'error'));
  if (btn.dataset.act === 'del') {
    if (!(await confirmDialog('Суретті жою', 'Бұл сурет біржола жойылады.', 'Жою'))) return;
    try {
      await api(`/api/projects/${id}`, { method: 'DELETE' });
      state.images = state.images.filter((x) => x.id !== id);
      renderGallery();
      toast('Сурет жойылды.');
    } catch (err) {
      toast(err.message, 'error');
    }
  }
});

$('#form').addEventListener('submit', async (e) => {
  e.preventDefault();
  const prompt = $('#prompt').value.trim();
  if (prompt.length < 3) { toast('Иллюстрация сипаттамасын жазыңыз.', 'error'); $('#prompt').focus(); return; }
  const btn = $('#gen');
  setBusy(btn, true, 'Салынуда...');
  if (!state.images.length) $('#gallery').innerHTML = '';
  $('#gallery').insertAdjacentHTML('afterbegin', `<article class="g-card" id="pending"><div class="g-loading"><svg class="spin" width="30" height="30" viewBox="0 0 24 24" fill="none" stroke="var(--terracotta)" stroke-width="2.4" stroke-linecap="round"><path d="M12 3a9 9 0 019 9"/></svg><div class="muted" style="font-size:13.5px">Сурет салынуда...</div></div><div class="g-body"><div class="g-title">${esc(prompt.slice(0, 50))}</div></div></article>`);
  try {
    const { project } = await api('/api/generate/image', { method: 'POST', body: { prompt, style: state.style } });
    state.images.unshift(project);
    $('#prompt').value = '';
    toast('Сурет дайын.');
  } catch (err) {
    toast(err.message, 'error');
  } finally {
    renderGallery();
    setBusy(btn, false);
  }
});

try {
  const { projects } = await api('/api/projects?kind=image&limit=200');
  state.images = projects;
  renderGallery();
  const id = Number(new URLSearchParams(location.search).get('id'));
  const target = id && state.images.find((p) => p.id === id);
  if (target) view(target);
} catch (err) {
  toast(err.message, 'error');
}
