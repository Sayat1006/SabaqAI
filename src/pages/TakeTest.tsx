import { CheckCircle2, Send } from "lucide-react";
import { useEffect, useState } from "react";
import { useParams } from "react-router-dom";
import { Logo } from "../components/Logo";
import { getSharedTest, type SharedTest, submitSharedTest } from "../lib/projects";

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
  const [result, setResult] = useState<{ score: number; total: number } | null>(null);

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
          <span className="text-lg font-bold">Sabaq AI</span>
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
          <div className="flex flex-col items-center gap-3 rounded-3xl border border-slate-200 bg-white p-8 text-center">
            <CheckCircle2 size={48} className="text-fuchsia-600" />
            <div className="text-lg font-bold">Жауаптарыңыз мұғалімге жіберілді!</div>
            <div className="text-[44px] font-bold leading-none text-violet-600">
              {result.score} / {result.total}
            </div>
            <div className="text-slate-500">{result.total ? Math.round((result.score / result.total) * 100) : 0}% дұрыс</div>
            <button type="button" onClick={nextStudent} className="mt-3 rounded-[12px] border border-slate-200 px-4 py-2.5 text-sm font-semibold hover:border-violet-500">
              Келесі оқушы тапсырады
            </button>
          </div>
        )}

        {test && !result && (
          <form onSubmit={handleSubmit} noValidate className="flex flex-col gap-5">
            <div className="rounded-3xl border border-slate-200 bg-white p-6">
              <h1 className="text-[22px] font-bold">Тест: {test.topic || test.title}</h1>
              <div className="mt-1 text-slate-500">
                {[test.subject, test.grade].filter(Boolean).join(" · ")} · {test.questions.length} сұрақ
              </div>
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
