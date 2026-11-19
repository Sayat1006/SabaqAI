import { CheckCircle2, Send } from "lucide-react";
import { useEffect, useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { Logo } from "../components/Logo";
import type { Lang } from "../lib/lang";
import { answerPoll, deviceId, getPublicPoll, OPTION_TONES, PollError, rubricMax, rubricTotal, type PublicPoll } from "../lib/polls";

// Оқушы беті: мұғалім тақтаға шығарған QR-ды сканерлеп, телефоннан жауап береді.
// Тіркелу қажет емес. Бір телефоннан бір жауап — қайта жіберсе, жауабы жаңартылады.

const TEXT = {
  kk: {
    title: { traffic: "Бағдаршам", self: "Өзін-өзі бағалау", reflection: "Рефлексия", rubric: "Дескриптор бойынша бағалау" },
    rubric: {
      self: "Өзіңді бағала",
      peer: "Жұбыңды бағала",
      group: "Басқа топты бағала",
      whom: "Кімді бағалайсың?",
      whomPh: "Жұбыңның аты-жөні",
      choose: "— таңда —",
      yourGroup: "Сенің тобың",
      whichGroup: "Қай топты бағалайсың?",
      done: "Орындады",
      notDone: "Орындамады",
      points: "балл",
      comment: "Пікір, кеңес (міндетті емес)",
      commentPh: "Екі жұлдыз, бір тілек…",
      total: "Жалпы балл",
      morePeer: "Тағы бір оқушыны бағалау",
      moreGroup: "Тағы бір топты бағалау",
      assessed: "Бағаладың:",
      markAll: "Әр дескрипторды бағала.",
      badTarget: "Кімді бағалайтыныңды таңда (өзіңді емес).",
    },
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
    title: { traffic: "Светофор", self: "Самооценка", reflection: "Рефлексия", rubric: "Оценивание по дескрипторам" },
    rubric: {
      self: "Оцени себя",
      peer: "Оцени партнёра",
      group: "Оцени другую группу",
      whom: "Кого ты оцениваешь?",
      whomPh: "Имя партнёра",
      choose: "— выбери —",
      yourGroup: "Твоя группа",
      whichGroup: "Какую группу оцениваешь?",
      done: "Выполнил(а)",
      notDone: "Не выполнил(а)",
      points: "балл",
      comment: "Отзыв, совет (необязательно)",
      commentPh: "Две звезды, одно пожелание…",
      total: "Итого баллов",
      morePeer: "Оценить ещё одного ученика",
      moreGroup: "Оценить ещё одну группу",
      assessed: "Ты оценил(а):",
      markAll: "Оцени каждый дескриптор.",
      badTarget: "Выбери, кого оцениваешь (не себя).",
    },
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
    title: { traffic: "Traffic light", self: "Self-assessment", reflection: "Reflection", rubric: "Assessment by descriptors" },
    rubric: {
      self: "Assess yourself",
      peer: "Assess your partner",
      group: "Assess another group",
      whom: "Who are you assessing?",
      whomPh: "Your partner's name",
      choose: "— choose —",
      yourGroup: "Your group",
      whichGroup: "Which group are you assessing?",
      done: "Done",
      notDone: "Not done",
      points: "pt",
      comment: "Feedback, advice (optional)",
      commentPh: "Two stars and a wish…",
      total: "Total",
      morePeer: "Assess another student",
      moreGroup: "Assess another group",
      assessed: "You assessed:",
      markAll: "Rate every descriptor.",
      badTarget: "Choose who you are assessing (not yourself).",
    },
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

const NAME_KEY = "ainur-poll-name";

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
  // Аты-жөні осы телефонда есте қалады — келесі сауалнамада қайта жазудың қажеті жоқ.
  const [name, setName] = useState(() => {
    try {
      return localStorage.getItem(NAME_KEY) ?? "";
    } catch {
      return "";
    }
  });
  const [choice, setChoice] = useState<number | null>(null);
  const [texts, setTexts] = useState<string[]>([]);
  const [target, setTarget] = useState("");
  const [group, setGroup] = useState("");
  const [marks, setMarks] = useState<(number | null)[]>([]);
  const [comment, setComment] = useState("");
  const [sent, setSent] = useState(false);
  const [busy, setBusy] = useState(false);
  const [loading, setLoading] = useState(!!code);
  const [error, setError] = useState("");

  const T = TEXT[poll?.lang ?? guessLang()];
  const errText = (e: unknown) =>
    e instanceof PollError ? (e.code === "bad_target" ? T.rubric.badTarget : (T.errors[e.code] ?? e.message)) : T.errors.unknown;

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
          if (p.answer.name) setName(p.answer.name);
          setChoice(p.answer.choice);
        }
        setTexts(p.prompts.map((_, i) => p.answer?.texts?.[i] ?? ""));
        setMarks((p.descriptors ?? []).map((_, i) => p.answer?.marks?.[i] ?? null));
        setComment(p.answer?.comment ?? "");
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
    if (poll.kind === "rubric") {
      if (poll.method !== "self" && (!target.trim() || target.trim().toLowerCase() === name.trim().toLowerCase() || (poll.method === "group" && (!group || group === target))))
        return setError(T.rubric.badTarget);
      if (marks.some((m) => m === null)) return setError(T.rubric.markAll);
    } else if (poll.kind === "reflection" ? !texts.some((t) => t.trim()) : c === null) return setError(poll.kind === "reflection" ? T.errors.bad_answer : T.pick);
    setBusy(true);
    setError("");
    try {
      await answerPoll(
        code,
        device,
        poll.kind === "rubric"
          ? { name, target: poll.method === "self" ? undefined : target.trim(), group: poll.method === "group" ? group : undefined, marks: marks.map((m) => m ?? 0), comment }
          : poll.kind === "reflection"
            ? { name, texts }
            : { name, choice: c! },
      );
      if (poll.kind === "rubric" && poll.method !== "self") {
        const t = target.trim();
        setPoll((p) => (p ? { ...p, assessed: [...(p.assessed ?? []).filter((a) => a.target !== t), { target: t, group: group || null, name }] } : p));
      }
      if (poll.ask_name) {
        try {
          localStorage.setItem(NAME_KEY, name.trim());
        } catch {
          // жеке режим — атын келесі жолы қайта жазады
        }
      }
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
  if (sent && poll.kind === "rubric") {
    const max = rubricMax(poll.descriptors);
    return shell(
      <div className="flex flex-col items-center gap-4 text-center">
        <CheckCircle2 size={72} className="text-emerald-500" />
        <h1 className="text-2xl font-bold">{T.sent}</h1>
        <p className="text-lg text-slate-600">
          {poll.method !== "self" && <span className="font-semibold">{target} · </span>}
          {T.rubric.total}: <span className="font-bold">{rubricTotal(marks.map((m) => m ?? 0))} / {max}</span>
        </p>
        {poll.method === "self" ? (
          <button type="button" onClick={() => setSent(false)} className="rounded-2xl border-2 border-slate-200 bg-surface px-5 py-3 font-semibold">
            {T.change}
          </button>
        ) : (
          <button
            type="button"
            onClick={() => {
              setTarget("");
              setMarks((poll.descriptors ?? []).map(() => null));
              setComment("");
              setSent(false);
            }}
            className="rounded-2xl bg-violet-600 px-5 py-3 font-semibold text-white"
          >
            {poll.method === "group" ? T.rubric.moreGroup : T.rubric.morePeer}
          </button>
        )}
      </div>,
    );
  }

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
        <div className="text-sm font-semibold uppercase tracking-wider text-violet-600">
          {poll.kind === "rubric" ? T.rubric[poll.method as "self" | "peer" | "group"] ?? T.title.rubric : T.title[poll.kind]}
        </div>
        <h1 className="mt-1 text-2xl leading-snug font-bold">{heading}</h1>
      </div>
      {poll.ask_name && (
        <label className="flex flex-col gap-1.5">
          <span className="text-sm font-semibold text-slate-600">{T.name}</span>
          <input value={name} onChange={(e) => setName(e.target.value)} maxLength={40} placeholder={T.namePh} autoComplete="name" className={field} />
        </label>
      )}
      {poll.kind === "rubric" ? (
        <RubricForm
          poll={poll}
          T={T}
          name={name}
          target={target}
          setTarget={setTarget}
          group={group}
          setGroup={setGroup}
          marks={marks}
          setMarks={setMarks}
          comment={comment}
          setComment={setComment}
          busy={busy}
          onSubmit={() => void submit()}
        />
      ) : poll.kind === "reflection" ? (
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

type Texts = (typeof TEXT)["kk"];

/** Дескриптор бойынша бағалау формасы: кімді бағалайды, әр дескрипторға балл, пікір. */
function RubricForm({
  poll,
  T,
  name,
  target,
  setTarget,
  group,
  setGroup,
  marks,
  setMarks,
  comment,
  setComment,
  busy,
  onSubmit,
}: {
  poll: PublicPoll;
  T: Texts;
  name: string;
  target: string;
  setTarget: (v: string) => void;
  group: string;
  setGroup: (v: string) => void;
  marks: (number | null)[];
  setMarks: (fn: (m: (number | null)[]) => (number | null)[]) => void;
  comment: string;
  setComment: (v: string) => void;
  busy: boolean;
  onSubmit: () => void;
}) {
  const R = T.rubric;
  const targets = poll.targets ?? [];
  const desc = poll.descriptors ?? [];
  const done = new Set((poll.assessed ?? []).map((a) => a.target));
  const me = name.trim().toLowerCase();
  const select = "w-full rounded-2xl border-2 border-slate-200 bg-surface px-4 py-3.5 text-lg outline-none focus:border-violet-500";
  const total = rubricTotal(marks.map((m) => m ?? 0));
  const set = (i: number, v: number) => setMarks((m) => m.map((x, j) => (j === i ? v : x)));

  return (
    <form
      onSubmit={(e) => {
        e.preventDefault();
        onSubmit();
      }}
      className="flex flex-col gap-4"
    >
      {poll.method === "group" && (
        <label className="flex flex-col gap-1.5">
          <span className="text-sm font-semibold text-slate-600">{R.yourGroup}</span>
          <select value={group} onChange={(e) => setGroup(e.target.value)} className={select}>
            <option value="">{R.choose}</option>
            {targets.map((t) => (
              <option key={t} value={t}>
                {t}
              </option>
            ))}
          </select>
        </label>
      )}
      {poll.method !== "self" && (
        <label className="flex flex-col gap-1.5">
          <span className="text-sm font-semibold text-slate-600">{poll.method === "group" ? R.whichGroup : R.whom}</span>
          {targets.length ? (
            <select value={target} onChange={(e) => setTarget(e.target.value)} className={select}>
              <option value="">{R.choose}</option>
              {targets
                .filter((t) => (poll.method === "group" ? t !== group : t.toLowerCase() !== me))
                .map((t) => (
                  <option key={t} value={t}>
                    {done.has(t) ? `✓ ${t}` : t}
                  </option>
                ))}
            </select>
          ) : (
            <input value={target} onChange={(e) => setTarget(e.target.value)} maxLength={60} placeholder={R.whomPh} className={select} />
          )}
        </label>
      )}
      {done.size > 0 && (
        <p className="text-sm text-slate-500">
          {R.assessed} {[...done].join(", ")}
        </p>
      )}
      <ol className="flex flex-col gap-3">
        {desc.map((d, i) => (
          <li key={i} className="rounded-2xl border-2 border-slate-200 bg-surface p-3.5">
            <div className="mb-2.5 flex items-start justify-between gap-3">
              <span className="font-semibold leading-snug">
                {i + 1}. {d.text}
              </span>
              <span className="shrink-0 rounded-full bg-violet-100 px-2 py-0.5 text-xs font-bold text-violet-700">
                {d.points} {R.points}
              </span>
            </div>
            {d.points === 1 ? (
              <div className="grid grid-cols-2 gap-2">
                <button type="button" aria-pressed={marks[i] === 1} onClick={() => set(i, 1)} className={`rounded-xl py-3 font-bold ${marks[i] === 1 ? "bg-emerald-500 text-white" : "bg-emerald-50 text-emerald-800"}`}>
                  ✓ {R.done}
                </button>
                <button type="button" aria-pressed={marks[i] === 0} onClick={() => set(i, 0)} className={`rounded-xl py-3 font-bold ${marks[i] === 0 ? "bg-rose-500 text-white" : "bg-rose-50 text-rose-800"}`}>
                  ✗ {R.notDone}
                </button>
              </div>
            ) : (
              <div className="flex flex-wrap gap-2" role="group">
                {Array.from({ length: d.points + 1 }, (_, v) => (
                  <button
                    key={v}
                    type="button"
                    aria-pressed={marks[i] === v}
                    onClick={() => set(i, v)}
                    className={`min-w-12 flex-1 rounded-xl py-3 text-lg font-bold ${marks[i] === v ? "bg-violet-600 text-white" : "bg-slate-100 text-slate-700"}`}
                  >
                    {v}
                  </button>
                ))}
              </div>
            )}
          </li>
        ))}
      </ol>
      <label className="flex flex-col gap-1.5">
        <span className="text-sm font-semibold text-slate-600">{R.comment}</span>
        <textarea value={comment} onChange={(e) => setComment(e.target.value)} maxLength={500} rows={2} placeholder={R.commentPh} className={`${select} resize-y text-base`} />
      </label>
      <div className="text-center text-lg">
        {R.total}: <span className="font-bold">{total} / {rubricMax(desc)}</span>
      </div>
      <button type="submit" disabled={busy} className="inline-flex items-center justify-center gap-2 rounded-2xl bg-violet-600 py-4 text-lg font-bold text-white disabled:opacity-60">
        <Send size={20} /> {T.send}
      </button>
    </form>
  );
}
