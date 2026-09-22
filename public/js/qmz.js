import { $, api, chipGroup, setChip, download, esc, getCatalog, initPage, setBusy, toast, ICONS } from './common.js';

const [{ user }, catalog] = await Promise.all([initPage(), getCatalog()]);

const state = { grade: 5, quarter: 1 };
$('#subject').innerHTML = catalog.subjects.map((s) => `<option ${s === user.subject ? 'selected' : ''}>${esc(s)}</option>`).join('');
$('#value').insertAdjacentHTML('beforeend', catalog.values.map((v) => `<option value="${v.key}">${esc(v.label)}</option>`).join(''));
chipGroup($('#grades'), Array.from({ length: 11 }, (_, i) => ({ value: i + 1, label: String(i + 1) })), state.grade, (v) => { state.grade = Number(v); });
chipGroup($('#quarters'), ['I', 'II', 'III', 'IV'].map((l, i) => ({ value: i + 1, label: l })), state.quarter, (v) => { state.quarter = Number(v); });

const list = (items) => (items || []).map((t) => `<div class="doc-bullet">${esc(t)}</div>`).join('');

function render(project) {
  const d = project.data;
  const m = project.meta;
  $('#result').innerHTML = `
  <article class="doc">
    <div class="doc-head">
      <div>
        <h2>Қысқа мерзімді сабақ жоспары</h2>
        <div class="muted" style="margin-top:4px">${esc(m.subject)} · ${esc(m.grade)}-сынып · ${esc(m.quarter)}-тоқсан</div>
      </div>
      <span class="doc-badge">${m.demo ? 'Демо үлгі' : 'Ресми үлгі бойынша'}</span>
    </div>
    <div class="doc-table">
      <div class="doc-label">Бөлім</div><div class="doc-val">${esc(d.section)}</div>
      <div class="doc-label">Педагог</div><div class="doc-val">${esc(m.teacher)}</div>
      <div class="doc-label">Күні / Сынып</div><div class="doc-val">${esc(m.date)} · ${esc(m.grade)}-сынып</div>
      <div class="doc-label">Сабақтың тақырыбы</div><div class="doc-val">${esc(d.topic)}</div>
      <div class="doc-label">Оқу мақсаттары</div><div class="doc-val">${list(d.learning_objectives)}</div>
      <div class="doc-label">Сабақтың мақсаты</div><div class="doc-val">${list(d.lesson_objectives)}</div>
      <div class="doc-label">Бағалау критерийлері</div><div class="doc-val">${list(d.assessment_criteria)}</div>
      <div class="doc-label">Құндылықтарды дарыту</div><div class="doc-val">${esc(d.value_integration)}</div>
      <div class="doc-label">Пәнаралық байланыс</div><div class="doc-val">${esc(d.cross_curricular)}</div>
      <div class="doc-label">Алдыңғы білім</div><div class="doc-val">${esc(d.prior_knowledge)}</div>
    </div>
    <div>
      <div class="doc-section-title">Сабақтың барысы</div>
      ${d.stages.map((s, i) => `
        <div class="stage" style="animation-delay:${i * 0.06}s">
          <div><div class="stage-name">${esc(s.name)}</div><div class="stage-time">${esc(s.time)}</div></div>
          <div><div class="col-title">Педагог</div>${list(s.teacher)}</div>
          <div><div class="col-title">Оқушы</div>${list(s.students)}</div>
          <div><div class="col-title">Бағалау / Ресурс</div><div>${esc(s.assessment)}</div><div class="muted" style="margin-top:6px">${esc(s.resources)}</div></div>
        </div>`).join('')}
    </div>
    <div>
      <div class="doc-section-title">Тапсырмалар</div>
      <div class="tasks">${d.tasks.map((t) => `
        <div class="task"><div class="task-code">${esc(t.code)} · ${esc(t.level)}</div><div class="task-title">${esc(t.title)}</div>
        <div>${esc(t.description)}</div><div class="col-title" style="margin-top:10px">Дескрипторлар</div>${list(t.descriptors)}</div>`).join('')}
      </div>
    </div>
    <div><div class="doc-section-title">Саралау</div><div>${esc(d.differentiation)}</div></div>
    <div class="note-box"><div class="doc-section-title" style="margin-bottom:6px">Күтілетін нәтиже</div>${esc(d.expected_result)}</div>
    <div><div class="doc-section-title">Оқыту әдістері</div>
      <div class="methods">${d.methods.map((mm) => `<div class="method"><b>${esc(mm.name)}</b><br>${esc(mm.description)}</div>`).join('')}</div></div>
    <div><div class="doc-section-title">Рефлексия</div><div>${esc(d.reflection)}</div></div>
    <div><div class="doc-section-title">Үй тапсырмасы</div><div>${esc(d.homework)}</div></div>
    <div class="doc-actions no-print">
      <button class="btn-ghost" id="dl-docx">${ICONS.download} Word түрінде жүктеу</button>
      <button class="btn-ghost" id="dl-pdf">${ICONS.download} PDF / басып шығару</button>
      <button class="btn-ghost" id="again">Жаңа ҚМЖ</button>
    </div>
  </article>`;
  $('#dl-docx').addEventListener('click', () => download(`/api/projects/${project.id}/docx`));
  $('#dl-pdf').addEventListener('click', () => {
    toast('Басып шығару терезесінде «PDF ретінде сақтау» таңдаңыз.');
    setTimeout(() => window.print(), 300);
  });
  $('#again').addEventListener('click', () => {
    history.replaceState(null, '', '/qmz');
    $('#topic').focus();
    window.scrollTo({ top: 0, behavior: 'smooth' });
  });
  document.title = `ҚМЖ — ${d.topic}`;
}

function showLoading() {
  const steps = ['Оқу мақсаттарын талдау...', 'Сабақ кезеңдерін құрастыру...', 'Тапсырмалар мен дескрипторлар...', 'Бағалау мен рефлексия...'];
  $('#result').innerHTML = `<div class="loading-state"><svg class="spin" width="36" height="36" viewBox="0 0 24 24" fill="none" stroke="var(--terracotta)" stroke-width="2.4" stroke-linecap="round"><path d="M12 3a9 9 0 019 9"/></svg>
    <div style="font-size:16px">ҚМЖ дайындалуда...</div><div class="steps" id="step">${steps[0]}</div><div class="muted" style="font-size:12.5px">Әдетте 30–90 секунд алады</div></div>`;
  let i = 0;
  return setInterval(() => { const el = $('#step'); if (el) el.textContent = steps[++i % steps.length]; }, 6000);
}

$('#form').addEventListener('submit', async (e) => {
  e.preventDefault();
  const body = {
    subject: $('#subject').value, grade: state.grade, quarter: state.quarter,
    topic: $('#topic').value.trim(), goals: $('#goals').value.trim(), value: $('#value').value, notes: $('#notes').value.trim(),
  };
  if (body.topic.length < 3) { toast('Сабақ тақырыбын жазыңыз.', 'error'); $('#topic').focus(); return; }
  if (!body.value) { toast('Құндылықты таңдаңыз.', 'error'); $('#value').focus(); return; }
  const btn = $('#gen');
  setBusy(btn, true);
  const timer = showLoading();
  try {
    const { project } = await api('/api/generate/qmz', { method: 'POST', body });
    history.replaceState(null, '', `/qmz?id=${project.id}`);
    render(project);
    toast('ҚМЖ дайын және сақталды.');
  } catch (err) {
    $('#result').innerHTML = `<div class="empty-state"><div style="color:var(--danger);font-size:16px">${esc(err.message)}</div><div>Қайталап көріңіз.</div></div>`;
    toast(err.message, 'error');
  } finally {
    clearInterval(timer);
    setBusy(btn, false);
  }
});

const id = new URLSearchParams(location.search).get('id');
if (id) {
  try {
    const { project } = await api(`/api/projects/${encodeURIComponent(id)}`);
    if (project.kind === 'qmz') {
      render(project);
      $('#subject').value = project.meta.subject;
      $('#topic').value = project.data.topic;
      $('#goals').value = project.meta.goals || '';
      $('#value').value = project.meta.value || '';
      state.grade = Number(project.meta.grade);
      state.quarter = ['I', 'II', 'III', 'IV'].indexOf(project.meta.quarter) + 1;
      setChip($('#grades'), state.grade);
      setChip($('#quarters'), state.quarter);
    }
  } catch (err) {
    toast(err.message, 'error');
  }
}
