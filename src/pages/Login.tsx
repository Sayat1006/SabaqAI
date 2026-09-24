import { ArrowRight, FileText, ListChecks, Presentation, Timer } from "lucide-react";
import { useState } from "react";
import { useLocation, useNavigate } from "react-router-dom";
import { Logo } from "../components/Logo";
import { PrefsControls } from "../components/PrefsControls";
import { useAuth } from "../context/useAuth";
import { tr } from "../i18n";

type Role = "teacher" | "admin";

const reasonMessages: Record<string, string> = {
  not_found: tr("Аккаунт әлі толық орнатылмаған. Әкімшіге хабарласыңыз."),
  wrong_password: tr("Пошта немесе құпия сөз қате."),
  disabled: tr("Аккаунтыңыз бұғатталған. Мектеп әкімшісіне хабарласыңыз."),
};

const roleCopy: Record<Role, { button: string; hint: string }> = {
  teacher: {
    button: tr("Кіру"),
    hint: tr("Аккаунтыңыз жоқ па? Мектеп әкімшісіне хабарласыңыз — аккаунтты тек әкімші ашады."),
  },
  admin: { button: tr("Әкімші панеліне кіру"), hint: tr("Тек мектеп әкімшілігіне арналған кіру.") },
};

const features = [
  { icon: FileText, label: tr("ҚМЖ") },
  { icon: Presentation, label: tr("Презентация") },
  { icon: ListChecks, label: tr("Тапсырмалар") },
  { icon: Timer, label: tr("Сабақ құралдары") },
];

export default function LoginPage() {
  const { login, logout } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();
  const [role, setRole] = useState<Role>("teacher");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [showForgot, setShowForgot] = useState(false);
  const [submitting, setSubmitting] = useState(false);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError("");
    setSubmitting(true);
    const result = await login(email.trim(), password);
    if (!result.ok) {
      setSubmitting(false);
      setError(reasonMessages[result.reason] ?? tr("Кіру мүмкін болмады."));
      return;
    }
    if (role === "admin" && result.user.role !== "admin") {
      await logout();
      setSubmitting(false);
      setError(tr("Бұл аккаунтта әкімші құқығы жоқ. «Мұғалім» қойындысын таңдаңыз."));
      return;
    }
    const from = (location.state as { from?: { pathname: string } } | null)?.from;
    navigate(role === "admin" ? "/admin" : (from?.pathname ?? "/"), { replace: true });
  }

  const tabClass = (r: Role) =>
    `flex-1 rounded-[11px] py-2.5 text-sm font-semibold transition-all ${
      role === r ? "bg-surface text-slate-900 shadow-[0_8px_18px_-10px_rgba(27,26,46,.25)]" : "text-slate-500"
    }`;

  return (
    <div className="relative flex min-h-screen flex-col items-center justify-center overflow-hidden bg-slate-50 px-4 py-10">
      {/* Жұмсақ түсті дақтар — сайттың терракота және теңіз-жасыл түстері */}
      <div aria-hidden className="pointer-events-none absolute -top-40 -left-32 h-[480px] w-[480px] rounded-full bg-violet-200/60 blur-3xl" />
      <div aria-hidden className="pointer-events-none absolute -right-40 -bottom-48 h-[520px] w-[520px] rounded-full bg-fuchsia-200/60 blur-3xl" />
      <div aria-hidden className="pointer-events-none absolute top-1/3 right-[12%] h-56 w-56 rounded-full bg-violet-100 blur-2xl" />

      <div className="absolute top-4 right-4 z-10 w-[200px]">
        <PrefsControls compact />
      </div>

      <div className="relative w-full max-w-[440px] animate-[fadeUp_.6s_cubic-bezier(.16,1,.3,1)_both]">
        <div className="mb-6 flex flex-col items-center text-center">
          <div className="flex h-16 w-16 items-center justify-center rounded-[20px] border border-slate-200 bg-surface shadow-[0_14px_30px_-18px_rgba(184,90,42,.45)]">
            <Logo className="h-10 w-10" />
          </div>
          <div className="mt-3 text-[22px] font-bold tracking-wide">AI Nur</div>
          <div className="text-sm text-slate-500">{tr("Мұғалімге арналған AI көмекші")}</div>
        </div>

        <form
          onSubmit={handleSubmit}
          noValidate
          className="flex flex-col gap-5 rounded-[26px] border border-surface/80 bg-surface/90 p-6 shadow-[0_30px_60px_-34px_rgba(28,27,46,.35)] backdrop-blur-xl sm:p-8"
        >
          <div className="text-center">
            <h1 className="text-[26px] leading-snug font-bold">{tr("Қайта қош келдіңіз")}</h1>
            <p className="mt-1 text-sm text-slate-500">{tr("Жүйеге кіру үшін деректеріңізді енгізіңіз.")}</p>
          </div>
          <div role="tablist" aria-label={tr("Кіру түрі")} className="flex gap-1 rounded-[14px] border border-slate-200 bg-slate-50 p-1">
            {(["teacher", "admin"] as const).map((r) => (
              <button
                key={r}
                type="button"
                role="tab"
                aria-selected={role === r}
                className={tabClass(r)}
                onClick={() => {
                  setRole(r);
                  setError("");
                }}
              >
                {r === "teacher" ? tr("Мұғалім") : tr("Әкімші")}
              </button>
            ))}
          </div>

          <label className="block">
            <span className="mb-2 block text-[13px] font-semibold text-slate-500">{tr("Электрондық пошта")}</span>
            <input
              type="email"
              autoComplete="username"
              required
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="aigerim@mektep.kz"
              className="w-full rounded-xl border border-slate-200 bg-slate-50 px-3.5 py-3 text-sm outline-none focus:border-violet-500"
            />
          </label>
          <label className="block">
            <span className="mb-2 block text-[13px] font-semibold text-slate-500">{tr("Құпия сөз")}</span>
            <input
              type="password"
              autoComplete="current-password"
              required
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              placeholder="••••••••"
              className="w-full rounded-xl border border-slate-200 bg-slate-50 px-3.5 py-3 text-sm outline-none focus:border-violet-500"
            />
          </label>

          <div className="flex justify-end">
            <button type="button" className="text-[13px] font-semibold text-violet-600" onClick={() => setShowForgot((v) => !v)}>
              {tr("Құпия сөзді ұмыттыңыз ба?")}
            </button>
          </div>
          {showForgot && (
            <p className="-mt-2 rounded-xl bg-violet-100 px-3.5 py-3 text-[13px] text-violet-800">
              {tr("Қауіпсіздік үшін құпия сөзді тек мектеп әкімшісі қалпына келтіреді. Әкімшіге хабарласыңыз — ол сізге жаңа құпия сөз береді.")}
            </p>
          )}

          {error && (
            <p role="alert" className="rounded-xl bg-rose-50 px-3.5 py-2.5 text-sm text-rose-700">
              {error}
            </p>
          )}

          <button
            type="submit"
            disabled={submitting || !email || !password}
            className="flex w-full items-center justify-center gap-2.5 rounded-[14px] bg-violet-600 px-5 py-3.5 text-[15px] font-semibold text-white transition hover:-translate-y-0.5 hover:shadow-[0_14px_26px_-10px_rgba(224,115,61,.4)] disabled:translate-y-0 disabled:opacity-60 disabled:shadow-none"
          >
            {submitting ? tr("Тексерілуде...") : roleCopy[role].button}
            <ArrowRight size={16} />
          </button>
          <p className="text-center text-[13px] text-slate-500">{roleCopy[role].hint}</p>
        </form>

        <div aria-hidden className="mt-6 flex flex-wrap justify-center gap-2 sm:-mx-16">
          {features.map(({ icon: Icon, label }) => (
            <span key={label} className="inline-flex items-center gap-1.5 rounded-full border border-slate-200 bg-surface/70 px-3 py-1.5 text-[12.5px] text-slate-600">
              <Icon size={13} className="text-violet-600" /> {label}
            </span>
          ))}
        </div>
      </div>
    </div>
  );
}
