import { ArrowRight } from "lucide-react";
import { useState } from "react";
import { useLocation, useNavigate } from "react-router-dom";
import { Logo } from "../components/Logo";
import { useAuth } from "../context/useAuth";
import "./login.css";

type Role = "teacher" | "admin";

const reasonMessages: Record<string, string> = {
  not_found: "Аккаунт әлі толық орнатылмаған. Әкімшіге хабарласыңыз.",
  wrong_password: "Пошта немесе құпия сөз қате.",
  disabled: "Аккаунтыңыз бұғатталған. Мектеп әкімшісіне хабарласыңыз.",
};

const roleCopy: Record<Role, { button: string; hint: string }> = {
  teacher: {
    button: "Кіру",
    hint: "Аккаунтыңыз жоқ па? Мектеп әкімшісіне хабарласыңыз — аккаунтты тек әкімші ашады.",
  },
  admin: { button: "Әкімші панеліне кіру", hint: "Тек мектеп әкімшілігіне арналған кіру." },
};

function Robot() {
  return (
    <svg className="robot-svg" viewBox="0 0 140 220" aria-hidden>
      <g className="robot-body-g">
        <g className="robot-antenna">
          <line x1="70" y1="10" x2="70" y2="30" stroke="#F7DFCB" strokeWidth="4" strokeLinecap="round" />
          <circle cx="70" cy="9" r="7" fill="#E0733D" />
        </g>
        <rect x="28" y="28" width="84" height="62" rx="20" fill="#F4F1EA" />
        <rect x="38" y="40" width="64" height="38" rx="13" fill="#1B2438" />
        <circle className="robot-eye" cx="56" cy="58" r="6" fill="#7FE0D2" />
        <circle className="robot-eye" cx="84" cy="58" r="6" fill="#7FE0D2" />
        <path d="M60 70q10 6 20 0" stroke="#7FE0D2" strokeWidth="3" fill="none" strokeLinecap="round" />
        <rect x="62" y="90" width="16" height="8" fill="#C9C3B5" />
        <rect x="34" y="96" width="72" height="70" rx="18" fill="#E0733D" />
        <rect x="50" y="112" width="40" height="26" rx="6" fill="#F7DFCB" />
        <text x="70" y="131" fontFamily="Times New Roman, serif" fontSize="16" fontWeight="700" textAnchor="middle" fill="#1B2438">
          AI
        </text>
        <g className="robot-arm-l">
          <rect x="14" y="100" width="16" height="50" rx="8" fill="#F4F1EA" />
          <circle cx="22" cy="154" r="9" fill="#2F7D74" />
        </g>
        <g className="robot-arm-r">
          <rect x="110" y="100" width="16" height="50" rx="8" fill="#F4F1EA" />
          <circle cx="118" cy="154" r="9" fill="#2F7D74" />
        </g>
        <g className="robot-leg-l">
          <rect x="46" y="164" width="18" height="36" rx="8" fill="#F4F1EA" />
          <rect x="40" y="196" width="28" height="12" rx="6" fill="#2F7D74" />
        </g>
        <g className="robot-leg-r">
          <rect x="76" y="164" width="18" height="36" rx="8" fill="#F4F1EA" />
          <rect x="72" y="196" width="28" height="12" rx="6" fill="#2F7D74" />
        </g>
      </g>
    </svg>
  );
}

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
      setError(reasonMessages[result.reason] ?? "Кіру мүмкін болмады.");
      return;
    }
    if (role === "admin" && result.user.role !== "admin") {
      await logout();
      setSubmitting(false);
      setError("Бұл аккаунтта әкімші құқығы жоқ. «Мұғалім» қойындысын таңдаңыз.");
      return;
    }
    const from = (location.state as { from?: { pathname: string } } | null)?.from;
    navigate(role === "admin" ? "/admin" : (from?.pathname ?? "/"), { replace: true });
  }

  const tabClass = (r: Role) =>
    `flex-1 rounded-[11px] py-2.5 text-sm font-semibold transition-all ${
      role === r ? "bg-white text-slate-900 shadow-[0_8px_18px_-10px_rgba(27,26,46,.25)]" : "text-slate-500"
    }`;

  return (
    <div className="flex min-h-screen">
      <section className="flex flex-[1_1_44%] items-center justify-center px-4 py-10">
        <form
          onSubmit={handleSubmit}
          noValidate
          className="flex w-full max-w-[380px] animate-[fadeUp_.6s_cubic-bezier(.16,1,.3,1)_both] flex-col gap-5"
        >
          <div className="flex items-center gap-3">
            <Logo className="h-[42px] w-[42px]" />
            <span className="text-[19px] font-bold">AI Nur</span>
          </div>
          <div>
            <h1 className="text-[26px] leading-snug font-bold">Қайта қош келдіңіз</h1>
            <p className="mt-1.5 text-sm text-slate-500">Жүйеге кіру үшін деректеріңізді енгізіңіз.</p>
          </div>

          <div role="tablist" aria-label="Кіру түрі" className="flex gap-1 rounded-[14px] border border-slate-200 bg-slate-50 p-1">
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
                {r === "teacher" ? "Мұғалім" : "Әкімші"}
              </button>
            ))}
          </div>

          <label className="block">
            <span className="mb-2 block text-[13px] font-semibold text-slate-500">Электрондық пошта</span>
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
            <span className="mb-2 block text-[13px] font-semibold text-slate-500">Құпия сөз</span>
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
              Құпия сөзді ұмыттыңыз ба?
            </button>
          </div>
          {showForgot && (
            <p className="-mt-2 rounded-xl bg-violet-100 px-3.5 py-3 text-[13px] text-violet-800">
              Қауіпсіздік үшін құпия сөзді тек мектеп әкімшісі қалпына келтіреді. Әкімшіге хабарласыңыз — ол сізге жаңа
              құпия сөз береді.
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
            {submitting ? "Тексерілуде..." : roleCopy[role].button}
            <ArrowRight size={16} />
          </button>
          <p className="text-center text-[13px] text-slate-500">{roleCopy[role].hint}</p>
        </form>
      </section>

      <section
        aria-hidden
        className="relative hidden flex-[1_1_56%] flex-col items-center justify-center gap-7 overflow-hidden bg-[radial-gradient(circle_at_30%_20%,#28324c,#1b2438_60%)] p-10 text-[#f4f1ea] lg:flex"
      >
        <div className="stars" />
        <div className="robot-scene">
          <div className="robot-glow" />
          <span className="note" style={{ left: 40, top: 60 }}>♪</span>
          <span className="note" style={{ right: 40, top: 40, animationDelay: ".8s" }}>♫</span>
          <span className="note" style={{ left: 70, top: 20, animationDelay: "1.6s" }}>♪</span>
          <Robot />
          <div className="robot-shadow" />
        </div>
        <div className="max-w-[420px] text-center">
          <h2 className="text-3xl font-bold">AI-мұғалім көмекшісі</h2>
          <p className="mt-2.5 mb-5 text-[15.5px] text-[#c7c4da]">
            ҚМЖ, КТЖ, презентация және сабақ суреттерін бірнеше минутта дайындаңыз.
          </p>
          <div className="flex flex-wrap justify-center gap-2">
            {["ҚМЖ", "Презентация", "Сурет", "Дода"].map((t) => (
              <span key={t} className="rounded-full border border-navy-700 px-3.5 py-1.5 text-[13px] text-[#e6e3f0]">
                {t}
              </span>
            ))}
          </div>
        </div>
      </section>
    </div>
  );
}
