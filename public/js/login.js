import { $, $$, api, modal } from './common.js';

let role = 'teacher';
const hints = {
  teacher: ['Кіру', 'Аккаунтыңыз жоқ па? Мектеп әкімшісіне хабарласыңыз — аккаунтты тек әкімші ашады.'],
  admin: ['Әкімші панеліне кіру', 'Тек мектеп әкімшілігіне арналған кіру.'],
};

$$('.role-tab').forEach((tab) => tab.addEventListener('click', () => {
  role = tab.dataset.role;
  $$('.role-tab').forEach((t) => t.setAttribute('aria-selected', String(t === tab)));
  $('#submit-label').textContent = hints[role][0];
  $('#role-hint').textContent = hints[role][1];
  $('#error').textContent = '';
}));

$('#forgot').addEventListener('click', () => {
  modal(`<h2>Құпия сөзді қалпына келтіру</h2>
    <div class="muted">Қауіпсіздік үшін құпия сөзді тек мектеп әкімшісі қалпына келтіреді. Әкімшіге хабарласыңыз — ол сізге жаңа уақытша құпия сөз береді, алғаш кіргенде оны өзіңіздікіне ауыстырасыз.</div>
    <div class="modal-actions"><button class="btn-primary" data-close>Түсінікті</button></div>`);
});

$('#login-form').addEventListener('submit', async (e) => {
  e.preventDefault();
  const email = $('#email').value.trim();
  const password = $('#password').value;
  if (!email || !password) {
    $('#error').textContent = 'Пошта мен құпия сөзді енгізіңіз.';
    return;
  }
  const btn = $('#submit');
  btn.disabled = true;
  $('#error').textContent = '';
  try {
    const res = await api('/api/auth/login', { method: 'POST', body: { email, password, role, remember: $('#remember').checked } });
    location.href = res.redirect;
  } catch (err) {
    $('#error').textContent = err.message;
    btn.disabled = false;
  }
});
