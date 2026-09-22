import { $, api, confirmDialog, esc, KIND_LABEL, KIND_URL, timeAgo, toast, ICONS } from './common.js';

const TONE = { qmz: 'av-t', presentation: 'av-g', image: 'av-t' };

function detail(p) {
  if (p.kind === 'qmz') return `${esc(p.meta.subject || '')} · ${esc(p.meta.grade)}-сынып · ${esc(p.meta.quarter)}-тоқсан`;
  if (p.kind === 'presentation') return `${esc(p.meta.slideCount || p.meta.count)} слайд`;
  return esc(p.meta.styleLabel || '');
}

export function projectCard(p, i = 0) {
  const href = `${KIND_URL[p.kind]}?id=${p.id}`;
  const letter = esc((p.subject || KIND_LABEL[p.kind])[0]);
  const thumb = p.kind === 'image'
    ? `<div class="proj-thumb"><img src="/api/projects/${p.id}/image.svg" alt="" loading="lazy"></div>` : '';
  return `<article class="proj-card" style="animation-delay:${Math.min(i, 8) * 0.05}s" data-id="${p.id}">
    ${thumb}
    <div style="display:flex;justify-content:space-between;align-items:flex-start">
      <div class="avatar ${TONE[p.kind]}">${letter}</div>
      <span class="status-chip ${p.kind === 'presentation' ? 'st-active' : 'st-pending'}">${KIND_LABEL[p.kind]}</span>
    </div>
    <div>
      <a class="proj-title stretched" href="${href}">${esc(p.title)}</a>
      <div class="muted" style="font-size:13px;margin-top:6px">${detail(p)}</div>
    </div>
    <div class="proj-foot"><span>${timeAgo(p.createdAt)}</span>
      <button class="del-btn" data-del="${p.id}" aria-label="Жою: ${esc(p.title)}">${ICONS.trash}</button></div>
  </article>`;
}

/** Renders project cards into `container` and wires delete buttons. */
export function renderProjects(container, projects, { emptyHtml, onChange } = {}) {
  container.innerHTML = projects.length ? projects.map(projectCard).join('') : (emptyHtml || '');
  container.onclick = async (e) => {
    const btn = e.target.closest('[data-del]');
    if (!btn) return;
    e.preventDefault();
    const ok = await confirmDialog('Жобаны жою', 'Бұл жоба біржола жойылады. Жалғастырасыз ба?', 'Жою');
    if (!ok) return;
    try {
      await api(`/api/projects/${btn.dataset.del}`, { method: 'DELETE' });
      btn.closest('.proj-card').remove();
      toast('Жоба жойылды.');
      onChange?.();
    } catch (err) {
      toast(err.message, 'error');
    }
  };
}

export const emptyProjects = (text = 'Әзірге жоба жоқ. Жоғарыдағы құралдардың бірін таңдап, алғашқы материалыңызды жасаңыз.') =>
  `<div class="card" style="grid-column:1/-1;padding:28px;text-align:center" ><div class="muted">${esc(text)}</div></div>`;

export { $ };
