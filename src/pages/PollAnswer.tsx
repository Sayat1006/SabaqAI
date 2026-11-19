import { CheckCircle2, Send } from "lucide-react";
import { useEffect, useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { Logo } from "../components/Logo";
import type { Lang } from "../lib/lang";
import { answerPoll, deviceId, getPublicPoll, OPTION_TONES, PollError, type PublicPoll } from "../lib/polls";

// Оқушы беті: мұғалім тақтаға шығарған QR-ды сканерлеп, телефоннан жауап береді.
// Тіркелу қажет емес. Бір телефоннан бір жауап — қайта жіберсе, жауабы жаңартылады.

const TEXT = {
  kk: {
    title: { traffic: "Бағдаршам", self: "Өзін-өзі бағалау", reflection: "Рефлексия" },
    poll: "Сабақтағы сауалнама",
    code: "Код",
    codePh: "6 таңбалы код",
    enter: "Кіру",
    name: "Аты-жөнің",
    namePh: "мыс.: Аружан С.",
    send: "Жіберу",
    sent: "Рахмет! Жауабың жіберілді",
    change: "Жауапты өзгерту",
    closed: "Сауалнама аяқталды. Рахмет!",
    anon: "Жауабың аноним — мұғалім атыңды көрмейді.",
    named: "Мұғалім атыңды көреді.",
    yourChoice: "Сенің жауабың:",
    pick: "Бір жауапты таңда",
    write: "Жауабыңды жаз…",
    errors: {
      not_found: "Сауалнама табылмады. Кодты тексер.",
      closed: "Сауалнама жабылған.",
      full: "Сауалнамаға жауап саны толды.",
      bad_name: "Аты-жөніңді жаз (кемінде 2 әріп).",
      bad_answer: "Кемінде бір сұраққа жауап жаз.",
      network: "Интернет байланысын тексер.",
      setup: "Сауалнама әлі қосылмаған.",
      unknown: "Қате шықты. Қайталап көр.",
    } as Record<string, string>,
  },
  ru: {
    title: { traffic: "Светофор", self: "Самооценка", reflection: "Рефлексия" },
    poll: "Опрос на уроке",
    code: "Код",
    codePh: "6-значный код",
    enter: "Войти",
    name: "Имя и фамилия",
    namePh: "напр.: Аружан С.",
    send: "Отправить",
    sent: "Спасибо! Ответ отправлен",
    change: "Изменить ответ",
    closed: "Опрос завершён. Спасибо!",
    anon: "Ответ анонимный — учитель не видит твоё имя.",
    named: "Учитель увидит твоё имя.",
    yourChoice: "Твой ответ:",
    pick: "Выбери один ответ",
    write: "Напиши ответ…",
    errors: {
      not_found: "Опрос не найден. Проверь код.",
      closed: "Опрос закрыт.",
      full: "Достигнут предел ответов.",
      bad_name: "Напиши имя (не менее 2 букв).",
      bad_answer: "Ответь хотя бы на один вопрос.",
      network: "Проверь подключение к интернету.",
      setup: "Опросы ещё не подключены.",
      unknown: "Произошла ошибка. Попробуй ещё раз.",
    } as Record<string, string>,
  },
  en: {
    title: { traffic: "Traffic light", self: "Self-assessment", reflection: "Reflection" },
    poll: "Class poll",
    code: "Code",
    codePh: "6-digit code",
    enter: "Join",
    name: "Your name",
    namePh: "e.g. Aruzhan S.",
    send: "Send",
    sent: "Thank you! Your answer was sent",
    change: "Change answer",
    closed: "The poll is over. Thank you!",
    anon: "Your answer is anonymous — the teacher can't see your name.",
    named: "The teacher will see your name.",
    yourChoice: "Your answer:",
    pick: "Choose one answer",
    write: "Write your answer…",
    errors: {
      not_found: "Poll not found. Check the code.",
      closed: "The poll is closed.",
      full: "The poll has reached its answer limit.",
      bad_name: "Enter your name (at least 2 letters).",
      bad_answer: "Answer at least one question.",
      network: "Check your internet connection.",
      setup: "Polls are not set up yet.",
      unknown: "Something went wrong. Try again.",
    } as Record<string, string>,
  },
} satisfies Record<Lang, unknown>;

const guessLang = (): Lang => {
  const l = navigator.language?.toLowerCase() ?? "";
  return l.startsWith("ru") ? "ru" : l.startsWith("en") ? "en" : "kk";
};

const field = "w-full rounded-2xl border-2 border-slate-200 bg-surface px-4 py-3.5 text-lg outline-none focus:border-violet-500";

export default function PollAnswerPage() {
  const params = useParams();
  const navigate = useNavigate();
  const code = (params.code ?? "").replace(/\D/g, "").slice(0, 6);
  const [device] = useState(deviceId);
  const [poll, setPoll] = useState<PublicPoll | null>(null);
  const [codeInput, setCodeInput] = useState("");
  const [name, setName] = useState("");
  const [choice, setChoice] = useState<number | null>(null);
  const [texts, setTexts] = useState<string[]>([]);
  const [sent, setSent] = useState(false);
  const [busy, setBusy] = useState(false);
  const [loading, setLoading] = useState(!!code);
  const [error, setError] = useState("");

  const T = TEXT[poll?.lang ?? guessLang()];
  const errText = (e: unknown) => (e instanceof PollError ? (T.errors[e.code] ?? e.message) : T.errors.unknown);

  useEffect(() => {
    if (!code) return;
    let alive = true;
    getPublicPoll(code, device)
      .then((p) => {
        if (!alive) return;
        setPoll(p);
        setError("");
        if (p.answer) {
          setSent(true);
          setName(p.answer.name ?? "");
          setChoice(p.answer.choice);
        }
        setTexts(p.prompts.map((_, i) => p.answer?.texts?.[i] ?? ""));
      })
      .catch((e) => alive && setError(errText(e)))
      .finally(() => alive && setLoading(false));
    return () => {
      alive = false;
    };
    // errText тек тілге тәуелді — кодты қайта сұраудың қажеті жоқ
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [code, device]);

  async function submit(nextChoice?: number) {
    if (!poll || busy) return;
    const c = nextChoice ?? choice;
    if (poll.ask_name && name.trim().length < 2) return setError(T.errors.bad_name);
    if (poll.kind === "reflection" ? !texts.some((t) => t.trim()) : c === null) return setError(poll.kind === "reflection" ? T.errors.bad_answer : T.pick);
    setBusy(true);
    setError("");
    try {
      await answerPoll(code, device, poll.kind === "reflection" ? { name, texts } : { name, choice: c! });
      setChoice(c);
      setSent(true);
    } catch (e) {
      setError(errText(e));
      if (e instanceof PollError && e.code === "closed") setPoll((p) => (p ? { ...p, is_open: false } : p));
    } finally {
      setBusy(false);
    }
  }

  const shell = (children: React.ReactNode) => (
    <div className="flex min-h-[100dvh] flex-col bg-slate-50">
      <header className="flex items-center justify-between gap-2 px-4 py-3">
        <div className="flex items-center gap-2">
          <Logo className="h-8 w-8" />
          <span className="font-bold">AI Nur</span>
        </div>
        {poll && <span className="rounded-full bg-surface/80 px-3 py-1.5 font-mono text-sm font-semibold tracking-widest">{code}</span>}
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
  if (!code || (!loading && !poll)) {
    return shell(
      <form
        onSubmit={(e) => {
          e.preventDefault();
          const c = codeInput.replace(/\D/g, "");
          if (c.length === 6) {
            setLoading(true);
            navigate(`/p/${c}`);
          } else setError(T.errors.not_found);
        }}
        className="flex flex-col gap-4 rounded-[28px] bg-surface p-6 shadow-[0_24px_48px_-30px_rgba(28,27,46,.35)]"
      >
        <h1 className="text-center text-2xl font-bold">📊 {T.poll}</h1>
        <input value={codeInput} onChange={(e) => setCodeInput(e.target.value)} inputMode="numeric" autoComplete="off" placeholder={T.codePh} aria-label={T.code} className={`${field} text-center font-mono text-3xl tracking-[0.3em]`} />
        <button type="submit" className="rounded-2xl bg-violet-600 py-4 text-lg font-bold text-white">
          {T.enter}
        </button>
        {errorBox}
      </form>,
    );
  }

  if (!poll) return shell(<div className="animate-pulse text-center text-slate-500">…</div>);

  const heading = poll.title || T.title[poll.kind];

  // 2. Сауалнама жабылған
  if (!poll.is_open) {
    return shell(
      <div className="flex flex-col items-center gap-4 text-center">
        <div className="text-6xl">🙏</div>
        <h1 className="text-2xl font-bold">{T.closed}</h1>
        {poll.answer && poll.kind !== "reflection" && poll.answer.choice !== null && (
          <p className="text-slate-600">
            {T.yourChoice} {poll.options[poll.answer.choice]?.emoji} {poll.options[poll.answer.choice]?.label}
          </p>
        )}
      </div>,
    );
  }

  // 3. Жауап жіберілді
  if (sent) {
    const picked = choice !== null ? poll.options[choice] : null;
    return shell(
      <div className="flex flex-col items-center gap-4 text-center">
        <CheckCircle2 size={72} className="text-emerald-500" />
        <h1 className="text-2xl font-bold">{T.sent}</h1>
        {picked && (
          <p className="text-lg text-slate-600">
            {T.yourChoice} <span className="font-semibold">{picked.emoji} {picked.label}</span>
          </p>
        )}
        <button type="button" onClick={() => setSent(false)} className="rounded-2xl border-2 border-slate-200 bg-surface px-5 py-3 font-semibold">
          {T.change}
        </button>
      </div>,
    );
  }

  const tones = OPTION_TONES[poll.kind === "traffic" ? "traffic" : poll.method] ?? OPTION_TONES.traffic;

  // 4. Сұрақ
  return shell(
    <>
      <div className="text-center">
        <div className="text-sm font-semibold uppercase tracking-wider text-violet-600">{T.title[poll.kind]}</div>
        <h1 className="mt-1 text-2xl leading-snug font-bold">{heading}</h1>
      </div>
      {poll.ask_name && (
        <label className="flex flex-col gap-1.5">
          <span className="text-sm font-semibold text-slate-600">{T.name}</span>
          <input value={name} onChange={(e) => setName(e.target.value)} maxLength={40} placeholder={T.namePh} autoComplete="name" className={field} />
        </label>
      )}
      {poll.kind === "reflection" ? (
        <form
          onSubmit={(e) => {
            e.preventDefault();
            void submit();
          }}
          className="flex flex-col gap-4"
        >
          {poll.prompts.map((p, i) => (
            <label key={i} className="flex flex-col gap-1.5">
              <span className="font-semibold">{p}</span>
              <textarea
                value={texts[i] ?? ""}
                onChange={(e) => setTexts((t) => t.map((x, j) => (j === i ? e.target.value : x)))}
                maxLength={300}
                rows={2}
                placeholder={T.write}
                className={`${field} resize-y text-base`}
              />
            </label>
          ))}
          <button type="submit" disabled={busy} className="inline-flex items-center justify-center gap-2 rounded-2xl bg-violet-600 py-4 text-lg font-bold text-white disabled:opacity-60">
            <Send size={20} /> {T.send}
          </button>
        </form>
      ) : (
        <div className="grid gap-3">
          {poll.options.map((o, i) => (
            <button
              key={i}
              type="button"
              disabled={busy}
              onClick={() => void submit(i)}
              className={`flex min-h-16 items-center gap-4 rounded-2xl px-5 py-4 text-left text-lg font-bold text-white transition active:scale-[0.97] disabled:opacity-70 ${tones[i % tones.length]}`}
            >
              <span className="text-3xl" aria-hidden>
                {o.emoji}
              </span>
              <span className="flex-1">{o.label}</span>
            </button>
          ))}
        </div>
      )}
      <p className="text-center text-xs text-slate-500">{poll.ask_name ? T.named : T.anon}</p>
      {errorBox}
    </>,
  );
}
