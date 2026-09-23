import { CheckCircle2, RotateCcw, Send, XCircle } from "lucide-react";
import { useEffect, useState } from "react";
import { useParams } from "react-router-dom";
import { Logo } from "../components/Logo";
import { getSharedTest, type SharedTest, submitSharedTest, type SubmitResult } from "../lib/projects";
import { levelBadge, TEST_LEVELS } from "../lib/studio";

const letter = (i: number) => String.fromCharCode(65 + i);
const fieldClass = "w-full rounded-xl border border-slate-200 bg-white px-3.5 py-3 text-[15px] outline-none focus:border-violet-500";

/** Оқушы беті: мұғалім жіберген сілтеме арқылы жүйеге кірмей тест тапсырады. */
export default function TakeTestPage() {
  const { code = "" } = useParams();
  const [test, setTest] = useState<SharedTest | null>(null);
  const [state, setState] = useState<"loading" | "missing" | "ready" | "error">("loading");
  const [name, setName] = useState("");
  const [className, setClassName] = useState("");
  const [answers, setAnswers] = useState<(number | null)[]>([]);
  const [sending, setSending] = useState(false);
  const [error, setError] = useState("");
  const [result, setResult] = useState<SubmitResult | null>(null);
  const [practice, setPractice] = useState(false);

  useEffect(() => {
    getSharedTest(code)
      .then((t) => {
        if (!t || !t.questions?.length) return setState("missing");
        setTest(t);
        setAnswers(t.questions.map(() => null));
        setState("ready");
      })
      .catch(() => setState("error"));
  }, [code]);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!test || sending) return;
    if (name.trim().length < 2) {
      setError("Аты-жөніңізді жазыңыз.");
      document.getElementById("student-name")?.focus();
      return;
    }
    const empty = answers.filter((a) => a === null).length;
    if (empty > 0 && !window.confirm(`${empty} сұраққа жауап берілмеді. Сонда да жіберу керек пе?`)) return;
    setSending(true);
    setError("");
    try {
      setResult(await submitSharedTest(code, name.trim(), className.trim(), answers));
      window.scrollTo({ top: 0, behavior: "smooth" });
    } catch (err) {
      setError(err instanceof Error ? err.message : "Жіберу мүмкін болмады. Қайталап көріңіз.");
    } finally {
      setSending(false);
    }
  }

  function nextStudent() {
    setResult(null);
    setPractice(false);
    setName("");
    setClassName("");
    setAnswers(test ? test.questions.map(() => null) : []);
  }

  const answered = answers.filter((a) => a !== null).length;

  return (
    <div className="min-h-screen px-4 py-8 sm:py-12">
      <div className="mx-auto flex max-w-[760px] flex-col gap-6">
        <header className="flex items-center gap-2.5">
          <Logo className="h-9 w-9" />
          <span className="text-lg font-bold">AI Nur</span>
          <span className="text-sm text-slate-500">· Онлайн тест</span>
        </header>

        {state === "loading" && <div className="rounded-3xl border border-slate-200 bg-white p-8 text-center text-slate-500">Тест жүктелуде...</div>}
        {(state === "missing" || state === "error") && (
          <div className="rounded-3xl border border-slate-200 bg-white p-8 text-center">
            <div className="text-lg font-bold">{state === "missing" ? "Тест табылмады немесе жабық" : "Тестті ашу мүмкін болмады"}</div>
            <p className="mt-2 text-slate-500">
              {state === "missing" ? "Мұғалім жауап қабылдауды тоқтатқан болуы мүмкін. Сілтемені мұғаліміңізден қайта сұраңыз." : "Интернетті тексеріп, бетті жаңартыңыз."}
            </p>
          </div>
        )}

        {test && result && (
          <>
            <div className="flex flex-col items-center gap-3 rounded-3xl border border-slate-200 bg-white p-8 text-center">
              <CheckCircle2 size={48} className="text-fuchsia-600" />
              <div className="text-lg font-bold">Жауаптарыңыз мұғалімге жіберілді!</div>
              <div className="text-[44px] font-bold leading-none text-violet-600">
                {result.score} / {result.total}
              </div>
              <div className="text-slate-500">{percentOf(result)}% дұрыс</div>
              <p className="max-w-[520px] rounded-xl bg-slate-50 px-4 py-3 text-[14.5px]">{advice(percentOf(result))}</p>
              {result.review && <LevelBreakdown test={test} answers={answers} review={result.review} />}
              <div className="mt-2 flex flex-wrap justify-center gap-2.5">
                {result.review && result.score < result.total && !practice && (
                  <button type="button" onClick={() => setPractice(true)} className="inline-flex items-center gap-2 rounded-[12px] bg-violet-600 px-4 py-2.5 text-sm font-semibold text-white">
                    <RotateCcw size={15} /> Қатемен жұмыс
                  </button>
                )}
                <button type="button" onClick={nextStudent} className="rounded-[12px] border border-slate-200 px-4 py-2.5 text-sm font-semibold hover:border-violet-500">
                  Келесі оқушы тапсырады
                </button>
              </div>
            </div>
            {result.review && (practice ? <MistakePractice test={test} answers={answers} review={result.review} /> : <Review test={test} answers={answers} review={result.review} />)}
          </>
        )}

        {test && !result && (
          <form onSubmit={handleSubmit} noValidate className="flex flex-col gap-5">
            <div className="rounded-3xl border border-slate-200 bg-white p-6">
              <h1 className="text-[22px] font-bold">Тест: {test.topic || test.title}</h1>
              <div className="mt-1 text-slate-500">
                {[test.subject, test.grade].filter(Boolean).join(" · ")} · {test.questions.length} сұрақ
              </div>
              {test.objective && (
                <div className="mt-1.5 text-[13.5px]">
                  <b>Оқу мақсаты:</b> {test.objective}
                </div>
              )}
              <div className="mt-5 grid gap-3 sm:grid-cols-[1fr_160px]">
                <label className="block">
                  <span className="mb-1.5 block text-[13px] font-semibold text-slate-500">Аты-жөніңіз</span>
                  <input id="student-name" value={name} onChange={(e) => setName(e.target.value)} maxLength={80} autoComplete="name" placeholder="мыс.: Айгерім Сейітова" className={fieldClass} />
                </label>
                <label className="block">
                  <span className="mb-1.5 block text-[13px] font-semibold text-slate-500">Сынып</span>
                  <input value={className} onChange={(e) => setClassName(e.target.value)} maxLength={40} placeholder="мыс.: 7А" className={fieldClass} />
                </label>
              </div>
            </div>

            <ol className="flex flex-col gap-4">
              {test.questions.map((q, qi) => (
                <li key={qi} className="rounded-[18px] border border-slate-200 bg-white p-5">
                  <fieldset>
                    <legend className="font-semibold">
                      {qi + 1}. {q.question}
                      {q.level && <span className={`ml-2 rounded-md px-1.5 py-0.5 align-middle text-[11px] font-bold ${levelBadge(q.level)}`}>{q.level}</span>}
                    </legend>
                    <div className="mt-3 grid gap-2">
                      {q.options.map((opt, oi) => {
                        const checked = answers[qi] === oi;
                        return (
                          <label
                            key={oi}
                            className={`flex cursor-pointer items-start gap-3 rounded-xl border px-3.5 py-3 text-[15px] transition ${
                              checked ? "border-violet-600 bg-violet-100" : "border-slate-200 hover:border-violet-500"
                            }`}
                          >
                            <input
                              type="radio"
                              name={`q${qi}`}
                              checked={checked}
                              onChange={() => setAnswers((a) => a.map((v, i) => (i === qi ? oi : v)))}
                              className="mt-1 h-4 w-4 accent-violet-600"
                            />
                            <span>
                              <b>{letter(oi)})</b> {opt}
                            </span>
                          </label>
                        );
                      })}
                    </div>
                  </fieldset>
                </li>
              ))}
            </ol>

            {error && (
              <p role="alert" className="rounded-xl bg-rose-50 px-3.5 py-2.5 text-sm text-rose-700">
                {error}
              </p>
            )}
            <div className="sticky bottom-3 flex items-center justify-between gap-3 rounded-2xl border border-slate-200 bg-white/90 p-3 pl-5 shadow-lg backdrop-blur">
              <span className="text-sm text-slate-500">
                Жауап берілді: <b className="text-slate-900">{answered}</b> / {test.questions.length}
              </span>
              <button type="submit" disabled={sending} className="inline-flex items-center gap-2 rounded-[12px] bg-violet-600 px-5 py-3 font-semibold text-white disabled:opacity-70">
                <Send size={16} /> {sending ? "Жіберілуде..." : "Жіберу"}
              </button>
            </div>
          </form>
        )}
      </div>
    </div>
  );
}

type Review = NonNullable<SubmitResult["review"]>;

const percentOf = (r: SubmitResult) => (r.total ? Math.round((r.score / r.total) * 100) : 0);

function advice(p: number): string {
  if (p >= 85) return "Керемет! Оқу мақсатына толық жеттің. Енді күрделірек (C деңгейлі) тапсырмаларды орындап көр.";
  if (p >= 50) return "Жақсы нәтиже! Негізін білесің, бірақ бірнеше сұрақта қателестің. Төмендегі түсіндірмелерді оқып, қатемен жұмыс жаса.";
  return "Тақырыпты тағы бір рет қайталау керек. Қателеріңнің түсіндірмесін мұқият оқып, «Қатемен жұмыс» арқылы қайта орында.";
}

/** Деңгейлер бойынша нәтиже: оқушы қай ойлау деңгейінде қиналатынын көреді. */
function LevelBreakdown({ test, answers, review }: { test: SharedTest; answers: (number | null)[]; review: Review }) {
  const rows = TEST_LEVELS.map((l) => {
    const idx = test.questions.map((q, i) => (q.level === l.key ? i : -1)).filter((i) => i >= 0);
    return { ...l, total: idx.length, ok: idx.filter((i) => answers[i] === review[i]?.correct).length };
  }).filter((r) => r.total > 0);
  if (!rows.length) return null;
  return (
    <div className="grid w-full max-w-[520px] gap-2 text-left">
      {rows.map((r) => (
        <div key={r.key} className="flex items-center gap-3 text-sm">
          <span className={`w-9 shrink-0 rounded-md py-0.5 text-center text-xs font-bold ${levelBadge(r.key)}`}>{r.key}</span>
          <span className="min-w-0 flex-1 text-slate-500">{r.label}</span>
          <span className="h-2.5 w-24 shrink-0 overflow-hidden rounded-full bg-slate-100 sm:w-40">
            <span className="block h-full rounded-full bg-violet-600" style={{ width: `${(r.ok / r.total) * 100}%` }} />
          </span>
          <b className="w-10 text-right">
            {r.ok}/{r.total}
          </b>
        </div>
      ))}
    </div>
  );
}

/** Тапсырғаннан кейінгі талдау: әр сұрақ бойынша оқушы жауабы, дұрыс жауап және түсіндірме. */
function Review({ test, answers, review }: { test: SharedTest; answers: (number | null)[]; review: Review }) {
  return (
    <section className="flex flex-col gap-3" aria-label="Жауаптарды талдау">
      <h2 className="text-lg font-bold">Жауаптарды талдау</h2>
      {test.questions.map((q, i) => {
        const ok = answers[i] === review[i]?.correct;
        return (
          <div key={i} className={`rounded-[18px] border bg-white p-4 ${ok ? "border-fuchsia-300" : "border-rose-300"}`}>
            <div className="flex items-start gap-2 font-semibold">
              {ok ? <CheckCircle2 size={19} className="mt-0.5 shrink-0 text-fuchsia-600" /> : <XCircle size={19} className="mt-0.5 shrink-0 text-rose-600" />}
              <span>
                {i + 1}. {q.question}
              </span>
            </div>
            <div className="mt-2 grid gap-1 pl-7 text-[14.5px]">
              {!ok && (
                <div className="text-rose-700">
                  Сенің жауабың: {answers[i] === null ? "жауап берілмеді" : `${letter(answers[i]!)}) ${q.options[answers[i]!]}`}
                </div>
              )}
              <div className="text-fuchsia-800">
                Дұрыс жауап: <b>{letter(review[i].correct)}) {q.options[review[i].correct]}</b>
              </div>
              {review[i].explanation && <div className="text-slate-500">💡 {review[i].explanation}</div>}
            </div>
          </div>
        );
      })}
    </section>
  );
}

/** Қатемен жұмыс: тек қате сұрақтарды қайта орындайды, әр таңдауға бірден кері байланыс береді. */
function MistakePractice({ test, answers, review }: { test: SharedTest; answers: (number | null)[]; review: Review }) {
  const wrong = test.questions.map((_, i) => i).filter((i) => answers[i] !== review[i]?.correct);
  const [picks, setPicks] = useState<Record<number, number[]>>({});
  const solved = wrong.filter((i) => picks[i]?.includes(review[i].correct)).length;

  return (
    <section className="flex flex-col gap-3" aria-label="Қатемен жұмыс">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <h2 className="text-lg font-bold">Қатемен жұмыс</h2>
        <span className="rounded-full bg-violet-100 px-3 py-1 text-sm font-semibold text-violet-700">
          Түзетілді: {solved} / {wrong.length}
        </span>
      </div>
      <p className="text-sm text-slate-500">Қате жіберген сұрақтарыңды қайта шеш. Дұрыс жауапты тапқанша көруге болады — бұл нәтижеге әсер етпейді.</p>
      {wrong.map((i) => {
        const q = test.questions[i];
        const tried = picks[i] ?? [];
        const done = tried.includes(review[i].correct);
        return (
          <div key={i} className="rounded-[18px] border border-slate-200 bg-white p-4">
            <div className="font-semibold">
              {i + 1}. {q.question}
            </div>
            <div className="mt-3 grid gap-2">
              {q.options.map((opt, oi) => {
                const pickedWrong = tried.includes(oi) && oi !== review[i].correct;
                const isRight = done && oi === review[i].correct;
                return (
                  <button
                    key={oi}
                    type="button"
                    disabled={done || pickedWrong}
                    onClick={() => setPicks((p) => ({ ...p, [i]: [...(p[i] ?? []), oi] }))}
                    className={`rounded-xl border px-3.5 py-2.5 text-left text-[15px] transition ${
                      isRight ? "border-fuchsia-500 bg-fuchsia-100 font-semibold" : pickedWrong ? "border-rose-300 bg-rose-50 text-rose-700 line-through" : "border-slate-200 hover:border-violet-500"
                    }`}
                  >
                    <b>{letter(oi)})</b> {opt}
                  </button>
                );
              })}
            </div>
            {tried.length > 0 && !done && <div className="mt-2 text-sm text-rose-700">Қате. Сұрақты мұқият оқып, қайта көр.</div>}
            {done && (
              <div className="mt-2 text-sm text-fuchsia-800">
                ✓ Дұрыс! {review[i].explanation && <span className="text-slate-500">{review[i].explanation}</span>}
              </div>
            )}
          </div>
        );
      })}
      {solved === wrong.length && wrong.length > 0 && (
        <div className="rounded-2xl bg-fuchsia-100 p-4 text-center font-semibold text-fuchsia-800">Жарайсың! Барлық қатеңді түзеттің 🎉</div>
      )}
    </section>
  );
}
