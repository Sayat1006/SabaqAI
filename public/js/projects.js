import { $, api, chipGroup, initPage, toast } from './common.js';
import { renderProjects, emptyProjects } from './projects-ui.js';

await initPage();
const state = { kind: new URLSearchParams(location.search).get('kind') || '', q: '' };
chipGroup($('#kinds'), [
  { value: '', label: 'Барлығы' }, { value: 'qmz', label: 'ҚМЖ' }, { value: 'presentation', label: 'Презентация' }, { value: 'image', label: 'Сурет' },
], state.kind, (v) => { state.kind = v; load(); });

async function load() {
  try {
    const params = new URLSearchParams({ limit: '200' });
    if (state.kind) params.set('kind', state.kind);
    if (state.q) params.set('q', state.q);
    const { projects } = await api(`/api/projects?${params}`);
    renderProjects($('#list'), projects, { emptyHtml: emptyProjects(state.q || state.kind ? 'Ештеңе табылмады.' : undefined) });
  } catch (err) {
    toast(err.message, 'error');
  }
}

let timer;
$('#q').addEventListener('input', (e) => {
  clearTimeout(timer);
  timer = setTimeout(() => { state.q = e.target.value.trim(); load(); }, 250);
});
load();
