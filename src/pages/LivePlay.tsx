import { LogIn } from "lucide-react";
import { useCallback, useEffect, useRef, useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { Logo } from "../components/Logo";
import { getPlayerState, joinLive, LIVE_TEXT, LiveError, OPTION_STYLES, sendLiveAnswer, type Lang, type LiveSeat, type PlayerState } from "../lib/live";

// Оқушы беті: жүйеге кірусіз, 6 таңбалы код және атымен тірі викторинаға қосылады.
// Орын (player + token) осы құрылғыда сақталады — бет жаңартылса да ойыннан шықпайды.

const seatKey = (code: string) => `ainur-live-${code}`;

function loadSeat(code: string): LiveSeat | null {
  try {
    const raw = localStorage.getItem(seatKey(code));
    return raw ? (JSON.parse(raw) as LiveSeat) : null;
  } catch {
    return null;
  }
}

function saveSeat(code: string, seat: LiveSeat | null) {
  try {
    if (seat) localStorage.setItem(seatKey(code), JSON.stringify(seat));
    else localStorage.removeItem(seatKey(code));
  } catch {
    // жеке режим — орын тек осы бетте қалады
  }
}

const guessLang = (): Lang => (navigator.language?.toLowerCase().startsWith("ru") ? "ru" : "kk");
const field = "w-full rounded-2xl border-2 border-slate-200 bg-surface px-4 py-3.5 text-center text-lg outline-none focus:border-violet-500";

export default function LivePlayPage() {
  const params = useParams();
  const navigate = useNavigate();
  const code = (params.code ?? "").replace(/\D/g, "").slice(0, 6);
  const [lang, setLang] = useState<Lang>(guessLang);
  const [codeInput, setCodeInput] = useState("");
  const [name, setName] = useState("");
  const [seat, setSeat] = useState<LiveSeat | null>(() => (code ? loadSeat(code) : null));
  const [st, setSt] = useState<PlayerState | null>(null);
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);
  const [picked, setPicked] = useState<{ q: number; choice: number } | null>(null);
  const [left, setLeft] = useState<number | null>(null);
  const deadline = useRef<number | null>(null);

  const T = LIVE_TEXT[st?.lang ?? lang];
  const errText = (e: unknown) => (e instanceof LiveError ? (T.errors[e.code] ?? e.message) : T.errors.unknown);

  const leave = useCallback(() => {
    saveSeat(code, null);
    setSeat(null);
    setSt(null);
    navigate("/l");
  }, [code, navigate]);

  // Ойын күйін секунд сайын сұраймыз.
  useEffect(() => {
    if (!code || !seat) return;
    let alive = true;
    let timer = 0;
    const loop = async () => {
      try {
        const s = await getPlayerState(code, seat);
        if (!alive) return;
        setSt(s);
        setError("");
        deadline.current = s.state === "question" && s.remaining !== null ? Date.now() + s.remaining * 1000 : null;
      } catch (e) {
        if (!alive) return;
        if (e instanceof LiveError && e.code === "not_found") {
          // Ойын өшірілген немесе орын жарамсыз — қайта кіруді ұсынамыз.
          saveSeat(code, null);
          setSeat(null);
          setError(LIVE_TEXT[lang].errors.not_found);
          return;
        }
        setError(errText(e));
      }
      if (alive) timer = window.setTimeout(loop, 1000);
    };
    void loop();
    return () => {
      alive = false;
      window.clearTimeout(timer);
    };
    // errText тіл ауысқанда ғана өзгереді — циклді қайта бастаудың қажеті жоқ
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [code, seat]);

  useEffect(() => {
    const t = window.setInterval(() => {
      setLeft(deadline.current === null ? null : Math.max(0, Math.ceil((deadline.current - Date.now()) / 1000)));
    }, 250);
    return () => window.clearInterval(t);
  }, []);

  async function join(e: React.FormEvent) {
    e.preventDefault();
    if (busy) return;
    if (name.trim().length < 2) return setError(T.errors.bad_name);
    setBusy(true);
    setError("");
    try {
      const s = await joinLive(code, name.trim());
      saveSeat(code, s);
      setSeat(s);
    } catch (err) {
      setError(errText(err));
    } finally {
      setBusy(false);
    }
  }

  async function answer(choice: number) {
    if (!seat || !st || busy) return;
    setPicked({ q: st.current, choice });
    try {
      await sendLiveAnswer(code, seat, st.current, choice);
    } catch (e) {
      if (!(e instanceof LiveError && e.code === "closed")) {
        setPicked(null);
        setError(errText(e));
      }
    }
  }

  const shell = (children: React.ReactNode, tone = "bg-slate-50") => (
    <div className={`flex min-h-[100dvh] flex-col ${tone} transition-colors`}>
      <header className="flex items-center justify-between gap-2 px-4 py-3">
        <div className="flex items-center gap-2">
          <Logo className="h-8 w-8" />
          <span className="font-bold">AI Nur</span>
        </div>
        {st ? (
          <span className="max-w-[55%] truncate rounded-full bg-surface/80 px-3 py-1.5 text-sm font-semibold">{st.name}</span>
        ) : (
          <div className="flex rounded-full border border-slate-200 bg-surface p-0.5 text-xs font-semibold" role="group" aria-label="Тіл / Язык">
            {(["kk", "ru"] as const).map((l) => (
              <button key={l} type="button" aria-pressed={lang === l} onClick={() => setLang(l)} className={`rounded-full px-3 py-1 ${lang === l ? "bg-violet-600 text-white" : "text-slate-500"}`}>
                {l === "kk" ? "Қаз" : "Рус"}
              </button>
            ))}
          </div>
        )}
      </header>
      <main className="mx-auto flex w-full max-w-[560px] flex-1 flex-col justify-center gap-5 px-4 pb-8">{children}</main>
    </div>
  );

  const errorBox = error && (
    <p role="alert" className="rounded-2xl bg-rose-50 px-4 py-3 text-center text-sm text-rose-700">
      {error}
    </p>
  );

  // 1. Код енгізу
  if (!code) {
    return shell(
      <form
        onSubmit={(e) => {
          e.preventDefault();
          const c = codeInput.replace(/\D/g, "");
          if (c.length === 6) navigate(`/l/${c}`);
          else setError(T.errors.not_found);
        }}
        className="flex flex-col gap-4 rounded-[28px] bg-surface p-6 shadow-[0_24px_48px_-30px_rgba(28,27,46,.35)]"
      >
        <h1 className="text-center text-2xl font-bold">🎮 {T.liveQuiz}</h1>
        <input value={codeInput} onChange={(e) => setCodeInput(e.target.value)} inputMode="numeric" autoComplete="off" placeholder={T.codePh} aria-label={T.code} className={`${field} font-mono text-3xl tracking-[0.3em]`} />
        <button type="submit" className="rounded-2xl bg-violet-600 py-4 text-lg font-bold text-white">
          {T.enter}
        </button>
        {errorBox}
      </form>,
    );
  }

  // 2. Атын жазу
  if (!seat) {
    return shell(
      <form onSubmit={join} className="flex flex-col gap-4 rounded-[28px] bg-surface p-6 shadow-[0_24px_48px_-30px_rgba(28,27,46,.35)]">
        <div className="text-center">
          <div className="text-sm text-slate-500">{T.code}</div>
          <div className="font-mono text-3xl font-bold tracking-[0.25em]">{code}</div>
        </div>
        <label className="flex flex-col gap-2">
          <span className="text-center text-sm font-semibold text-slate-600">{T.name}</span>
          <input value={name} onChange={(e) => setName(e.target.value)} maxLength={30} autoFocus placeholder={T.namePh} className={field} />
        </label>
        <button type="submit" disabled={busy} className="inline-flex items-center justify-center gap-2 rounded-2xl bg-violet-600 py-4 text-lg font-bold text-white disabled:opacity-60">
          <LogIn size={20} /> {T.enter}
        </button>
        {errorBox}
        <button type="button" onClick={() => navigate("/l")} className="text-sm text-slate-500 underline">
          {T.leave}
        </button>
      </form>,
    );
  }

  if (!st) return shell(<div className="text-center text-slate-500">...</div>);

  // 3. Күту
  if (st.state === "lobby") {
    return shell(
      <div className="flex flex-col items-center gap-4 text-center">
        <div className="text-6xl">🙌</div>
        <h1 className="text-3xl font-bold">{T.youAreIn}</h1>
        <p className="text-lg text-slate-600">{T.waitStart}</p>
        <div className="mt-2 animate-pulse rounded-full bg-surface px-4 py-2 text-sm text-slate-500">
          {T.players}: {st.players}
        </div>
        {errorBox}
      </div>,
    );
  }

  // 4. Сұрақ
  if (st.state === "question" && st.question) {
    const mine = st.answer?.choice ?? (picked?.q === st.current ? picked.choice : null);
    if (mine !== null) {
      return shell(
        <div className="flex flex-col items-center gap-4 text-center">
          <div className={`flex h-24 w-24 items-center justify-center rounded-3xl text-5xl text-white ${OPTION_STYLES[mine % OPTION_STYLES.length].bg}`}>{OPTION_STYLES[mine % OPTION_STYLES.length].shape}</div>
          <h1 className="text-2xl font-bold">{T.accepted}</h1>
          <p className="animate-pulse text-slate-500">{T.waitOthers}</p>
        </div>,
      );
    }
    if (left === 0) {
      return shell(
        <div className="flex flex-col items-center gap-3 text-center">
          <div className="text-6xl">⏰</div>
          <h1 className="text-2xl font-bold">{T.timeUp}</h1>
        </div>,
      );
    }
    return shell(
      <>
        <div className="flex items-center justify-between text-sm font-semibold text-slate-500">
          <span>
            {T.question} {st.current + 1}/{st.total}
          </span>
          <span className={`flex h-11 w-11 items-center justify-center rounded-full text-lg font-bold text-white tabular-nums ${left !== null && left <= 5 ? "bg-rose-500" : "bg-violet-600"}`}>{left ?? st.timeLimit}</span>
        </div>
        <h1 className="rounded-3xl bg-surface px-5 py-5 text-center text-xl leading-snug font-bold">{st.question.question}</h1>
        <div className="grid gap-3">
          {st.question.options.map((o, i) => {
            const s = OPTION_STYLES[i % OPTION_STYLES.length];
            return (
              <button key={i} type="button" onClick={() => void answer(i)} className={`flex min-h-16 items-center gap-3 rounded-2xl px-4 py-4 text-left text-lg font-bold text-white transition active:scale-[0.97] ${s.bg}`}>
                <span className="text-2xl" aria-hidden>
                  {s.shape}
                </span>
                <span className="flex-1">{o}</span>
              </button>
            );
          })}
        </div>
        {errorBox}
      </>,
    );
  }

  // 5. Жауап көрсетілді
  if (st.state === "reveal" && st.question) {
    const a = st.answer;
    const ok = a?.correct === true;
    const tone = !a ? "bg-slate-100" : ok ? "bg-emerald-100" : "bg-rose-100";
    const correctText = st.correct !== null ? st.question.options[st.correct] : "";
    return shell(
      <div className="flex flex-col items-center gap-4 text-center">
        <div className="text-7xl">{!a ? "⏰" : ok ? "🎉" : "😕"}</div>
        <h1 className={`text-3xl font-bold ${ok ? "text-emerald-700" : a ? "text-rose-700" : ""}`}>{!a ? T.noAnswer : ok ? T.correct : T.wrong}</h1>
        {ok && <div className="text-2xl font-bold text-emerald-700">+{a?.points}</div>}
        {!ok && correctText && (
          <p className="rounded-2xl bg-surface px-4 py-3 text-lg">
            {T.correctWas}: <b>{correctText}</b>
          </p>
        )}
        <div className="flex gap-3">
          <span className="rounded-2xl bg-surface px-4 py-3 text-lg font-bold">
            {st.score ?? 0} <span className="text-sm font-normal text-slate-500">{T.points}</span>
          </span>
          {st.rank !== null && (
            <span className="rounded-2xl bg-surface px-4 py-3 text-lg font-bold">
              {st.rank}-{T.place} <span className="text-sm font-normal text-slate-500">/ {st.players}</span>
            </span>
          )}
        </div>
      </div>,
      tone,
    );
  }

  // 6. Ойын аяқталды
  const medal = st.rank === 1 ? "🥇" : st.rank === 2 ? "🥈" : st.rank === 3 ? "🥉" : "🏁";
  return shell(
    <div className="flex flex-col items-center gap-4 text-center">
      <div className="text-7xl">{medal}</div>
      <h1 className="text-3xl font-bold">{T.finished}</h1>
      {st.rank !== null && (
        <p className="text-2xl font-bold">
          {st.rank}-{T.place} <span className="text-base font-normal text-slate-500">/ {st.players}</span>
        </p>
      )}
      <p className="text-lg">
        {T.yourScore}: <b>{st.score ?? 0}</b>
      </p>
      <p className="text-slate-500">{T.thanks}</p>
      <button type="button" onClick={leave} className="mt-2 rounded-2xl border border-slate-200 bg-surface px-5 py-3 font-semibold">
        {T.leave}
      </button>
    </div>,
  );
}
