import { Check, Download, Eye, EyeOff, FileText, Printer, Sparkles } from "lucide-react";
import { useEffect, useState } from "react";
import { Link, useLocation } from "react-router-dom";
import { PageHeader } from "../components/PageHeader";
import { useAuth } from "../context/useAuth";
import { GRADES, SUBJECTS } from "../lib/catalog";
import { getTest, saveTest, type SavedTest } from "../lib/projects";
import { DIFFICULTIES, generateTest, QUESTION_COUNTS } from "../lib/studio";

const letter = (i: number) => String.fromCharCode(65 + i);

function chipClass(active: boolean) {
  return `min-h-10 rounded-xl border px-2 py-2.5 text-[13.5px] transition hover:-translate-y-px ${
    active ? "border-violet-600 bg-violet-600 text-white" : "border-slate-200 bg-white text-slate-500 hover:border-violet-500"
  }`;
}

const fieldClass = "w-full rounded-xl border border-slate-200 bg-slate-50 px-3.5 py-3 text-sm outline-none focus:border-violet-500";

export default function TestsPage() {
  const { user } = useAuth();
  const location = useLocation();
  const [test, setTest] = useState<SavedTest | null>(null);
  const [error, setError] = useState("");
  const [subject, setSubject] = useState(() => (user?.subject && SUBJECTS.includes(user.subject) ? user.subject : SUBJECTS[0]));
  const [grade, setGrade] = useState(() => user?.grades?.[0] ?? GRADES[4]);
  const [topic, setTopic] = useState("");
  const [count, setCount] = useState<number>(10);
  const [difficulty, setDifficulty] = useState<string>("Орташа");

  // «Жобалар» тізімінен ашылса, сақталған тестті жүктейміз.
  const openedId = (location.state as { testId?: string } | null)?.testId;
  useEffect(() => {
    if (!openedId) return;
    getTest(openedId)
      .then((t) => {
        if (!t) return;
        setTest(t);
        setSubject(t.subject);
        setGrade(t.grade);
        setTopic(t.topic);
        setDifficulty(t.difficulty);
      })
      .catch((e) => setError(e instanceof Error ? e.message : "Тестті ашу мүмкін болмады."));
  }, [openedId]);
  const [notes, setNotes] = useState("");
  const [generating, setGenerating] = useState(false);
  const [showAnswers, setShowAnswers] = useState(false);
  const [exporting, setExporting] = useState(false);

  async function handleGenerate(e: React.FormEvent) {
    e.preventDefault();
    if (generating) return;
    if (topic.trim().length < 3) {
      setError("Тест тақырыбын жазыңыз.");
      return;
    }
    setGenerating(true);
    setError("");
    try {
      const questions = await generateTest({ subject, grade, topic: topic.trim(), difficulty, count, notes: notes.trim() });
      setTest(await saveTest({ subject, grade, topic: topic.trim(), difficulty, questions }));
      setShowAnswers(false);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Тест жасау мүмкін болмады.");
    } finally {
      setGenerating(false);
    }
  }

  async function handleDocx() {
    if (!test) return;
    setExporting(true);
    try {
      const { exportTestToDocx } = await import("../lib/exportDocx");
      await exportTestToDocx(test);
    } finally {
      setExporting(false);
    }
  }

  return (
    <div className="mx-auto max-w-[1360px] px-4 py-9 sm:px-10 print:p-0">
      <PageHeader
        crumb="Тест генерациясы"
        title="Тест генерациясы"
        subtitle="Пән, сынып пен тақырыпты көрсетіңіз — AI жауап кілті бар тест құрастырады. Тестті Word түрінде жүктеп не басып шығара аласыз."
      />

      <div className="mt-8 flex flex-wrap items-start gap-7">
        <form
          onSubmit={handleGenerate}
          noValidate
          className="flex w-full flex-col gap-5 rounded-3xl border border-white/70 bg-white/75 p-6 shadow-[0_24px_48px_-30px_rgba(27,26,46,.2)] backdrop-blur-xl lg:sticky lg:top-24 lg:w-[380px] print:hidden"
        >
          <div className="grid grid-cols-2 gap-3">
            <label className="block">
              <span className="mb-2 block text-[13px] font-semibold text-slate-500">Пән</span>
              <select value={subject} onChange={(e) => setSubject(e.target.value)} className={fieldClass}>
                {SUBJECTS.map((s) => (
                  <option key={s}>{s}</option>
                ))}
              </select>
            </label>
            <label className="block">
              <span className="mb-2 block text-[13px] font-semibold text-slate-500">Сынып</span>
              <select value={grade} onChange={(e) => setGrade(e.target.value)} className={fieldClass}>
                {GRADES.map((g) => (
                  <option key={g}>{g}</option>
                ))}
              </select>
            </label>
          </div>
          <label className="block">
            <span className="mb-2 block text-[13px] font-semibold text-slate-500">Тақырып</span>
            <input
              value={topic}
              onChange={(e) => setTopic(e.target.value)}
              maxLength={300}
              placeholder="мыс.: Жай бөлшектерді салыстыру"
              className={fieldClass}
            />
          </label>
          <div>
            <span className="mb-2 block text-[13px] font-semibold text-slate-500">Сұрақ саны</span>
            <div className="grid grid-cols-4 gap-2">
              {QUESTION_COUNTS.map((n) => (
                <button key={n} type="button" aria-pressed={count === n} onClick={() => setCount(n)} className={chipClass(count === n)}>
                  {n}
                </button>
              ))}
            </div>
          </div>
          <div>
            <span className="mb-2 block text-[13px] font-semibold text-slate-500">Қиындық деңгейі</span>
            <div className="grid grid-cols-3 gap-2">
              {DIFFICULTIES.map((d) => (
                <button key={d} type="button" aria-pressed={difficulty === d} onClick={() => setDifficulty(d)} className={chipClass(difficulty === d)}>
                  {d}
                </button>
              ))}
            </div>
          </div>
          <label className="block">
            <span className="mb-2 block text-[13px] font-semibold text-slate-500">
              Қосымша тілек <span className="font-normal">(міндетті емес)</span>
            </span>
            <textarea
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              maxLength={500}
              rows={2}
              placeholder="мыс.: есептер көбірек болсын, функционалдық сауаттылық сұрақтары қосылсын"
              className={`${fieldClass} resize-y`}
            />
          </label>
          {error && (
            <p role="alert" className="rounded-xl bg-rose-50 px-3.5 py-2.5 text-sm text-rose-700">
              {error}
            </p>
          )}
          <button
            type="submit"
            disabled={generating}
            className="flex w-full items-center justify-center gap-2.5 rounded-[14px] bg-violet-600 px-5 py-3.5 text-[15px] font-semibold text-white transition hover:-translate-y-0.5 disabled:translate-y-0 disabled:opacity-70"
          >
            <Sparkles size={17} className={generating ? "animate-spin" : ""} />
            {generating ? "Тест құрастырылуда..." : "Тест жасау"}
          </button>
        </form>

        <section className="min-w-0 flex-[1_1_560px]" aria-live="polite">
          {generating ? (
            <div className="flex min-h-[420px] flex-col items-center justify-center gap-3 rounded-3xl border border-slate-200 bg-white">
              <Sparkles size={34} className="animate-spin text-violet-500" />
              <div className="text-base">Тест құрастырылуда...</div>
              <div className="text-[12.5px] text-slate-500">Әдетте 10–40 секунд алады</div>
            </div>
          ) : !test ? (
            <div className="flex min-h-[420px] flex-col items-center justify-center gap-3.5 rounded-3xl border-2 border-dashed border-slate-200 p-10 text-center text-slate-500">
              <span className="flex h-[72px] w-[72px] items-center justify-center rounded-[20px] bg-violet-100 text-violet-500">
                <FileText size={32} />
              </span>
              <div className="text-base text-slate-900">Форманы толтырып, «Тест жасау» батырмасын басыңыз</div>
              <div className="text-[13.5px]">Дайын тест осы жерде пайда болады және «Жобалар» бөлімінде сақталады.</div>
            </div>
          ) : (
            <article className="flex animate-[fadeUp_.5s_cubic-bezier(.16,1,.3,1)_both] flex-col gap-6 rounded-[22px] border border-slate-200 bg-white p-6 sm:p-8 print:border-0 print:p-0">
              <div className="flex flex-wrap items-start justify-between gap-4 border-b-2 border-slate-900 pb-4">
                <div>
                  <h2 className="text-[22px] font-bold">Тест: {test.topic}</h2>
                  <div className="mt-1 text-slate-500">
                    {test.subject} · {test.grade} · Қиындығы: {test.difficulty} · {test.questions.length} сұрақ
                  </div>
                </div>
                <span className="rounded-full bg-fuchsia-100 px-3 py-1.5 text-xs font-semibold text-fuchsia-700 print:hidden">
                  Жауап кілтімен
                </span>
              </div>
              <div className="hidden text-sm print:block">
                Оқушының аты-жөні: ______________________ Сынып: ______ Күні: __________
              </div>

              <ol className="flex flex-col gap-4">
                {test.questions.map((q, i) => (
                  <li key={i} className="break-inside-avoid rounded-[14px] border border-slate-200 p-4 print:border-0 print:p-0">
                    <div className="font-semibold">
                      {i + 1}. {q.question}
                    </div>
                    <div className="mt-2.5 grid gap-1.5 sm:grid-cols-2">
                      {q.options.map((opt, oi) => {
                        const correct = showAnswers && oi === q.correctIndex;
                        return (
                          <div
                            key={oi}
                            className={`flex items-start gap-2 rounded-lg px-2.5 py-1.5 text-[14.5px] ${
                              correct ? "bg-fuchsia-100 font-semibold text-fuchsia-800" : ""
                            }`}
                          >
                            <span className="font-bold">{letter(oi)})</span>
                            <span>{opt}</span>
                            {correct && <Check size={16} className="mt-0.5 shrink-0" aria-label="дұрыс жауап" />}
                          </div>
                        );
                      })}
                    </div>
                    {showAnswers && q.explanation && <div className="mt-2 text-[13.5px] text-slate-500">{q.explanation}</div>}
                  </li>
                ))}
              </ol>

              {showAnswers && (
              <div className="rounded-[14px] bg-fuchsia-100 px-5 py-4 print:break-before-page print:bg-transparent print:px-0">
                <div className="mb-2 text-[15px] font-bold">Жауаптар кілті</div>
                <div className="flex flex-wrap gap-x-5 gap-y-1 text-[14.5px]">
                  {test.questions.map((q, i) => (
                    <span key={i}>
                      {i + 1} — {letter(q.correctIndex)}
                    </span>
                  ))}
                </div>
              </div>
              )}

              <div className="flex flex-wrap gap-2.5 border-t border-slate-200 pt-5 print:hidden">
                <button type="button" onClick={() => setShowAnswers((v) => !v)} className="inline-flex items-center gap-2 rounded-[11px] border border-slate-200 bg-white px-3.5 py-2.5 text-sm font-semibold hover:border-violet-500 hover:text-violet-600">
                  {showAnswers ? <EyeOff size={15} /> : <Eye size={15} />}
                  {showAnswers ? "Жауаптарды жасыру" : "Жауаптарды көрсету"}
                </button>
                <button type="button" onClick={handleDocx} disabled={exporting} className="inline-flex items-center gap-2 rounded-[11px] border border-slate-200 bg-white px-3.5 py-2.5 text-sm font-semibold hover:border-violet-500 hover:text-violet-600">
                  <Download size={15} /> {exporting ? "Дайындалуда..." : "Word түрінде жүктеу"}
                </button>
                <button type="button" onClick={() => window.print()} title="Жауаптар көрсетілсе, кілт те басып шығарылады" className="inline-flex items-center gap-2 rounded-[11px] border border-slate-200 bg-white px-3.5 py-2.5 text-sm font-semibold hover:border-violet-500 hover:text-violet-600">
                  <Printer size={15} /> PDF / басып шығару
                </button>
                <Link to="/projects" className="inline-flex items-center gap-2 rounded-[11px] border border-slate-200 bg-white px-3.5 py-2.5 text-sm font-semibold hover:border-violet-500 hover:text-violet-600">
                  Барлық тесттер
                </Link>
              </div>
            </article>
          )}
        </section>
      </div>
    </div>
  );
}
