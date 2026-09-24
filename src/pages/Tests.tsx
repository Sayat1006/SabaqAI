import { BookOpenCheck, Check, Download, Eye, EyeOff, FileText, GraduationCap, Globe2, Layers, PenLine, Printer, Sparkles, X, type LucideIcon } from "lucide-react";
import { useCallback, useEffect, useRef, useState } from "react";
import { Link, useLocation } from "react-router-dom";
import { PageHeader } from "../components/PageHeader";
import { TestSharePanel } from "../components/TestSharePanel";
import { LiveLauncher } from "../components/LiveLauncher";
import { LangPicker } from "../components/LangPicker";
import { useAuth } from "../context/useAuth";
import { GRADES, SUBJECTS } from "../lib/catalog";
import type { LessonPlan } from "../lib/generators";
import type { Lang } from "../lib/lang";
import { getTest, saveTest, type SavedTest, type TaskType } from "../lib/projects";
import { scrollToResult } from "../lib/scrollToResult";
import {
  DIFFICULTIES,
  generateTest,
  generateWrittenTasks,
  isQuizType,
  levelBadge,
  levelLabel,
  objectiveSuggestions,
  planToContext,
  TASK_TYPES,
  taskTypeOf,
  TEST_LEVELS,
} from "../lib/studio";
import { tr } from "../i18n";
import { defaultMaterialLang } from "../lib/lang";

const letter = (i: number) => String.fromCharCode(65 + i);

const TYPE_ICONS: Record<TaskType, LucideIcon> = {
  levels: Layers,
  pisa: Globe2,
  ubt: GraduationCap,
  bzb: BookOpenCheck,
  open: PenLine,
};

function chipClass(active: boolean) {
  return `min-h-10 rounded-xl border px-2 py-2.5 text-[13.5px] transition hover:-translate-y-px ${
    active ? "border-violet-600 bg-violet-600 text-white" : "border-slate-200 bg-surface text-slate-500 hover:border-violet-500"
  }`;
}

const fieldClass = "w-full rounded-xl border border-slate-200 bg-slate-50 px-3.5 py-3 text-sm outline-none focus:border-violet-500";
const ghostBtn =
  "inline-flex items-center gap-2 rounded-[11px] border border-slate-200 bg-surface px-3.5 py-2.5 text-sm font-semibold hover:border-violet-500 hover:text-violet-600";

export default function TestsPage() {
  const { user } = useAuth();
  const location = useLocation();
  const navState = location.state as { testId?: string; plan?: LessonPlan } | null;
  const plan = navState?.plan;
  const [test, setTest] = useState<SavedTest | null>(null);
  const [error, setError] = useState("");
  const [taskType, setTaskType] = useState<TaskType>("levels");
  const [subject, setSubject] = useState(() =>
    plan && SUBJECTS.includes(plan.subject) ? plan.subject : user?.subject && SUBJECTS.includes(user.subject) ? user.subject : SUBJECTS[0],
  );
  const [grade, setGrade] = useState(() => (plan && GRADES.includes(plan.grade) ? plan.grade : (user?.grades?.[0] ?? GRADES[4])));
  const [topic, setTopic] = useState(plan?.topic ?? "");
  // ҚМЖ-дан ашылса, тапсырмалар сол жоспардың мақсаттарына сай құрастырылады.
  const [planContext, setPlanContext] = useState(() => (plan ? planToContext(plan) : ""));
  const [objective, setObjective] = useState(() => (plan?.objectiveCode ? `${plan.objectiveCode} — ${plan.objectiveText}` : ""));
  const [differentiate, setDifferentiate] = useState(true);
  const [count, setCount] = useState<number>(10);
  const [difficulty, setDifficulty] = useState<string>(tr("Орташа"));
  const [notes, setNotes] = useState("");
  const [lang, setLang] = useState<Lang>(plan?.lang ?? defaultMaterialLang);
  const [generating, setGenerating] = useState(false);
  const [showAnswers, setShowAnswers] = useState(false);
  const [exporting, setExporting] = useState(false);
  const typeDef = taskTypeOf(taskType);
  const quiz = isQuizType(taskType);

  function chooseType(t: TaskType) {
    setTaskType(t);
    const counts = taskTypeOf(t).counts;
    if (!counts.includes(count)) setCount(counts[1] ?? counts[0]);
  }

  // «Жобалар» тізімінен ашылса, сақталған тапсырманы жүктейміз.
  const openedId = navState?.testId ?? new URLSearchParams(location.search).get("id") ?? undefined;
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
        setObjective(t.objective ?? "");
        setTaskType(t.taskType ?? "levels");
        setLang(t.lang ?? "kk");
      })
      .catch((e) => setError(e instanceof Error ? e.message : tr("Тапсырманы ашу мүмкін болмады.")));
  }, [openedId]);

  const runGenerate = useCallback(async () => {
    setGenerating(true);
    scrollToResult();
    setError("");
    try {
      const goal = objective.trim();
      const input = {
        subject,
        grade,
        topic: topic.trim(),
        difficulty,
        count,
        notes: notes.trim(),
        planContext: planContext || undefined,
        objective: goal || undefined,
        differentiate,
        taskType,
        lang,
      };
      const base = { subject, grade, topic: topic.trim(), difficulty, objective: goal || undefined, taskType, lang };
      if (isQuizType(taskType)) {
        setTest(await saveTest({ ...base, questions: await generateTest(input) }));
      } else {
        setTest(await saveTest({ ...base, questions: [], tasks: await generateWrittenTasks(input) }));
      }
      setShowAnswers(false);
    } catch (err) {
      setError(err instanceof Error ? err.message : tr("Тапсырма жасау мүмкін болмады."));
    } finally {
      setGenerating(false);
    }
  }, [subject, grade, topic, difficulty, count, notes, planContext, objective, differentiate, taskType, lang]);

  // ҚМЖ бетінен «Тапсырма жасау» басылса — бірден генерациялаймыз.
  const startedFromPlan = useRef(false);
  useEffect(() => {
    if (!plan || startedFromPlan.current || topic.trim().length < 3) return;
    startedFromPlan.current = true;
    void runGenerate();
  }, [plan, topic, runGenerate]);

  function handleGenerate(e: React.FormEvent) {
    e.preventDefault();
    if (generating) return;
    if (topic.trim().length < 3) {
      setError(tr("Тақырыпты жазыңыз."));
      return;
    }
    void runGenerate();
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

  const shownType = taskTypeOf(test?.taskType);
  const written = test?.tasks?.length ? test.tasks : null;

  return (
    <div className="mx-auto max-w-[1360px] px-4 py-9 sm:px-10 print:p-0">
      <PageHeader
        crumb={tr("Тапсырмалар")}
        title={tr("Тапсырмалар")}
        subtitle={tr("Тапсырма түрін таңдаңыз: деңгейлік тест, функционалдық сауаттылық (PISA), ҰБТ сұрақтары, БЖБ/ТЖБ немесе шығармашылық тапсырмалар. AI жауап кілтімен, бағалау критерийлерімен бірге құрастырады.")}
      />

      <div className="mt-8 flex flex-wrap items-start gap-7">
        <form
          onSubmit={handleGenerate}
          noValidate
          className="flex w-full flex-col gap-5 rounded-3xl border border-surface/70 bg-surface/75 p-6 shadow-[0_24px_48px_-30px_rgba(27,26,46,.2)] backdrop-blur-xl lg:sticky lg:top-24 lg:w-[400px] print:hidden"
        >
          {planContext && (
            <div className="flex items-start gap-2 rounded-xl bg-fuchsia-100 px-3.5 py-2.5 text-[13px] text-fuchsia-800">
              <span className="flex-1">
                {tr("ҚМЖ негізінде")}{plan ? <>: <b>{plan.topic}</b></> : ""} — {tr("тапсырмалар сабақ мақсаттарының орындалуын тексереді.")}
              </span>
              <button type="button" aria-label={tr("ҚМЖ-сыз жасау")} title={tr("ҚМЖ-сыз жасау")} onClick={() => setPlanContext("")} className="rounded-md p-0.5 hover:bg-fuchsia-200">
                <X size={15} />
              </button>
            </div>
          )}

          <fieldset>
            <legend className="mb-2 block text-[13px] font-semibold text-slate-500">{tr("Тапсырма түрі")}</legend>
            <div className="flex flex-col gap-2">
              {TASK_TYPES.map((t) => {
                const Icon = TYPE_ICONS[t.key];
                const active = taskType === t.key;
                return (
                  <button
                    key={t.key}
                    type="button"
                    aria-pressed={active}
                    onClick={() => chooseType(t.key)}
                    className={`flex items-start gap-3 rounded-xl border px-3 py-2.5 text-left transition ${
                      active ? "border-violet-600 bg-violet-100" : "border-slate-200 bg-surface hover:border-violet-500"
                    }`}
                  >
                    <span className={`flex h-9 w-9 shrink-0 items-center justify-center rounded-[10px] ${active ? "bg-violet-600 text-white" : "bg-slate-100 text-slate-500"}`}>
                      <Icon size={18} />
                    </span>
                    <span>
                      <span className="block text-[14px] font-semibold">{t.label}</span>
                      <span className="block text-[12px] text-slate-500">{t.description}</span>
                    </span>
                  </button>
                );
              })}
            </div>
          </fieldset>

          <LangPicker value={lang} onChange={setLang} />

          <div className="grid grid-cols-2 gap-3">
            <label className="block">
              <span className="mb-2 block text-[13px] font-semibold text-slate-500">{tr("Пән")}</span>
              <select value={subject} onChange={(e) => setSubject(e.target.value)} className={fieldClass}>
                {SUBJECTS.map((s) => (
                  <option key={s} value={s}>{tr(s)}</option>
                ))}
              </select>
            </label>
            <label className="block">
              <span className="mb-2 block text-[13px] font-semibold text-slate-500">{tr("Сынып")}</span>
              <select value={grade} onChange={(e) => setGrade(e.target.value)} className={fieldClass}>
                {GRADES.map((g) => (
                  <option key={g} value={g}>{tr(g)}</option>
                ))}
              </select>
            </label>
          </div>
          <label className="block">
            <span className="mb-2 block text-[13px] font-semibold text-slate-500">{taskType === "bzb" ? tr("Бөлім / тақырып") : tr("Тақырып")}</span>
            <input value={topic} onChange={(e) => setTopic(e.target.value)} maxLength={300} placeholder={tr("мыс.: Жай бөлшектерді салыстыру")} className={fieldClass} />
          </label>
          <label className="block">
            <span className="mb-2 block text-[13px] font-semibold text-slate-500">
              {tr("Оқу мақсаты")} <span className="font-normal">{tr("(ҮОБ бойынша)")}</span>
            </span>
            <input
              value={objective}
              onChange={(e) => setObjective(e.target.value)}
              list="objective-suggestions"
              maxLength={400}
              placeholder={tr("мыс.: 5.2.1.4 — жай бөлшектерді салыстыру")}
              className={fieldClass}
            />
            <datalist id="objective-suggestions">
              {objectiveSuggestions(subject, grade).map((o) => (
                <option key={o} value={o} />
              ))}
            </datalist>
          </label>
          <div>
            <span className="mb-2 block text-[13px] font-semibold text-slate-500">{typeDef.unit === "сұрақ" ? tr("Сұрақ саны") : tr("Тапсырма саны")}</span>
            <div className="grid grid-cols-4 gap-2">
              {typeDef.counts.map((n) => (
                <button key={n} type="button" aria-pressed={count === n} onClick={() => setCount(n)} className={chipClass(count === n)}>
                  {n}
                </button>
              ))}
            </div>
          </div>
          <div>
            <span className="mb-2 block text-[13px] font-semibold text-slate-500">{tr("Қиындық деңгейі")}</span>
            <div className="grid grid-cols-3 gap-2">
              {DIFFICULTIES.map((d) => (
                <button key={d} type="button" aria-pressed={difficulty === d} onClick={() => setDifficulty(d)} className={chipClass(difficulty === d)}>
                  {tr(d)}
                </button>
              ))}
            </div>
          </div>
          {quiz && (
            <label className="flex cursor-pointer items-start gap-2.5 text-sm">
              <input type="checkbox" checked={differentiate} onChange={(e) => setDifferentiate(e.target.checked)} className="mt-0.5 h-4 w-4 accent-violet-600" />
              <span>
                {tr("Саралау: A / B / C деңгейлері")}
                <span className="block text-xs text-slate-500">{tr("Білу және түсіну → қолдану → жоғары деңгей дағдылары. Сұрақтар біртіндеп күрделенеді.")}</span>
              </span>
            </label>
          )}
          <label className="block">
            <span className="mb-2 block text-[13px] font-semibold text-slate-500">
              {tr("Қосымша тілек")} <span className="font-normal">{tr("(міндетті емес)")}</span>
            </span>
            <textarea
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              maxLength={500}
              rows={2}
              placeholder={tr("мыс.: есептер көбірек болсын, ауыл өмірінен мысалдар алынсын")}
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
            {generating ? tr("Құрастырылуда...") : tr("Тапсырма жасау")}
          </button>
        </form>

        <section id="result" className="min-w-0 flex-[1_1_560px] scroll-mt-28" aria-live="polite">
          {generating ? (
            <div className="flex min-h-[420px] flex-col items-center justify-center gap-3 rounded-3xl border border-slate-200 bg-surface">
              <Sparkles size={34} className="animate-spin text-violet-500" />
              <div className="text-base">{typeDef.label} {tr("құрастырылуда...")}</div>
              <div className="text-[12.5px] text-slate-500">{tr("Әдетте 10–40 секунд алады")}</div>
            </div>
          ) : !test ? (
            <div className="flex min-h-[420px] flex-col items-center justify-center gap-3.5 rounded-3xl border-2 border-dashed border-slate-200 p-10 text-center text-slate-500">
              <span className="flex h-[72px] w-[72px] items-center justify-center rounded-[20px] bg-violet-100 text-violet-500">
                <FileText size={32} />
              </span>
              <div className="text-base text-slate-900">{tr("Тапсырма түрін таңдап, «Тапсырма жасау» батырмасын басыңыз")}</div>
              <div className="text-[13.5px]">{tr("Дайын тапсырмалар осы жерде пайда болады және «Жобалар» бөлімінде сақталады.")}</div>
            </div>
          ) : (
            <article className="flex animate-[fadeUp_.5s_cubic-bezier(.16,1,.3,1)_both] flex-col gap-6 rounded-[22px] border border-slate-200 bg-surface p-6 sm:p-8 print:border-0 print:p-0">
              <div className="flex flex-wrap items-start justify-between gap-4 border-b-2 border-slate-900 pb-4">
                <div>
                  <div className="mb-1 text-[12.5px] font-semibold uppercase tracking-wide text-violet-600">{shownType.label}</div>
                  <h2 className="text-[22px] font-bold">{test.topic}</h2>
                  <div className="mt-1 text-slate-500">
                    {tr(test.subject)} · {tr(test.grade)} · {tr("Қиындығы:")} {tr(test.difficulty)} ·{" "}
                    {written ? tr("{n} тапсырма · {p} балл", { n: written.length, p: written.reduce((s, t) => s + t.points, 0) }) : tr("{n} сұрақ", { n: test.questions.length })}
                  </div>
                  {test.objective && (
                    <div className="mt-1.5 text-[13.5px]">
                      <b>{tr("Оқу мақсаты:")}</b> {test.objective}
                    </div>
                  )}
                  {!written && test.questions.some((q) => q.level) && (
                    <div className="mt-2 flex flex-wrap gap-1.5 print:hidden">
                      {TEST_LEVELS.map((l) => {
                        const n = test.questions.filter((q) => q.level === l.key).length;
                        return n ? (
                          <span key={l.key} className={`rounded-full px-2.5 py-1 text-xs font-semibold ${levelBadge(l.key)}`}>
                            {l.short}: {n}
                          </span>
                        ) : null;
                      })}
                    </div>
                  )}
                </div>
                <span className="rounded-full bg-fuchsia-100 px-3 py-1.5 text-xs font-semibold text-fuchsia-700 print:hidden">
                  {written ? tr("Критерийлерімен") : tr("Жауап кілтімен")}
                </span>
              </div>
              <div className="hidden text-sm print:block">{tr("Оқушының аты-жөні: ______________________ Сынып: ______ Күні: __________")}</div>

              {written ? (
                <WrittenTasksView tasks={written} showAnswers={showAnswers} />
              ) : (
                <>
                  <ol className="flex flex-col gap-4">
                    {test.questions.map((q, i) => (
                      <li key={i} className="break-inside-avoid">
                        {q.context && q.context !== test.questions[i - 1]?.context && (
                          <div className="mb-3 whitespace-pre-line rounded-[14px] border-l-4 border-violet-600 bg-violet-100/50 px-4 py-3 text-[14.5px]">
                            <div className="mb-1 text-[12px] font-bold uppercase tracking-wide text-violet-700">{tr("Жағдаят")}</div>
                            {q.context}
                          </div>
                        )}
                        <div className="rounded-[14px] border border-slate-200 p-4 print:border-0 print:p-0">
                          <div className="flex items-start justify-between gap-3">
                            <div className="font-semibold">
                              {i + 1}. {q.question}
                            </div>
                            {q.level && (
                              <span title={levelLabel(q.level)} className={`shrink-0 rounded-md px-2 py-0.5 text-[11.5px] font-bold ${levelBadge(q.level)}`}>
                                {q.level}
                              </span>
                            )}
                          </div>
                          <div className="mt-2.5 grid gap-1.5 sm:grid-cols-2">
                            {q.options.map((opt, oi) => {
                              const correct = showAnswers && oi === q.correctIndex;
                              return (
                                <div
                                  key={oi}
                                  className={`flex items-start gap-2 rounded-lg px-2.5 py-1.5 text-[14.5px] ${correct ? "bg-fuchsia-100 font-semibold text-fuchsia-800" : ""}`}
                                >
                                  <span className="font-bold">{letter(oi)})</span>
                                  <span>{opt}</span>
                                  {correct && <Check size={16} className="mt-0.5 shrink-0" aria-label={tr("дұрыс жауап")} />}
                                </div>
                              );
                            })}
                          </div>
                          {showAnswers && q.explanation && <div className="mt-2 text-[13.5px] text-slate-500">{q.explanation}</div>}
                        </div>
                      </li>
                    ))}
                  </ol>

                  {showAnswers && (
                    <div className="rounded-[14px] bg-fuchsia-100 px-5 py-4 print:break-before-page print:bg-transparent print:px-0">
                      <div className="mb-2 text-[15px] font-bold">{tr("Жауаптар кілті")}</div>
                      <div className="flex flex-wrap gap-x-5 gap-y-1 text-[14.5px]">
                        {test.questions.map((q, i) => (
                          <span key={i}>
                            {i + 1} — {letter(q.correctIndex)}
                          </span>
                        ))}
                      </div>
                    </div>
                  )}
                </>
              )}

              <div className="flex flex-wrap gap-2.5 border-t border-slate-200 pt-5 print:hidden">
                <button type="button" onClick={() => setShowAnswers((v) => !v)} className={ghostBtn}>
                  {showAnswers ? <EyeOff size={15} /> : <Eye size={15} />}
                  {showAnswers ? tr("Жауаптарды жасыру") : written ? tr("Жауаптар мен дескрипторлар") : tr("Жауаптарды көрсету")}
                </button>
                <button type="button" onClick={handleDocx} disabled={exporting} className={ghostBtn}>
                  <Download size={15} /> {exporting ? tr("Дайындалуда...") : tr("Word түрінде жүктеу")}
                </button>
                <button type="button" onClick={() => window.print()} title={tr("Жауаптар көрсетілсе, олар да басып шығарылады")} className={ghostBtn}>
                  <Printer size={15} /> {tr("PDF / басып шығару")}
                </button>
                <Link to="/projects" className={ghostBtn}>
                  {tr("Барлық жобалар")}
                </Link>
              </div>
            </article>
          )}
          {test && !generating && isQuizType(test.taskType) && <LiveLauncher key={`live-${test.id}`} test={test} />}
          {test && !generating && isQuizType(test.taskType) && <TestSharePanel key={test.id} test={test} />}
        </section>
      </div>
    </div>
  );
}

/** БЖБ/ТЖБ және ашық тапсырмалар: шарты, деңгейі, балы; мұғалімге — критерий, дескриптор, үлгі жауап. */
function WrittenTasksView({ tasks, showAnswers }: { tasks: NonNullable<SavedTest["tasks"]>; showAnswers: boolean }) {
  const total = tasks.reduce((s, t) => s + t.points, 0);
  return (
    <>
      <ol className="flex flex-col gap-4">
        {tasks.map((t, i) => (
          <li key={i} className="break-inside-avoid rounded-[14px] border border-slate-200 p-4 print:border-0 print:p-0">
            <div className="flex items-start justify-between gap-3">
              <div className="font-semibold">
                {tr("{n}-тапсырма.", { n: i + 1 })} {t.title}
              </div>
              <span className="flex shrink-0 items-center gap-1.5">
                <span title={levelLabel(t.level)} className={`rounded-md px-2 py-0.5 text-[11.5px] font-bold ${levelBadge(t.level)}`}>
                  {t.level}
                </span>
                <span className="rounded-md bg-slate-100 px-2 py-0.5 text-[11.5px] font-bold">{t.points} {tr("балл")}</span>
              </span>
            </div>
            <div className="mt-2 whitespace-pre-line text-[14.5px]">{t.text}</div>
            {showAnswers && (
              <div className="mt-3 flex flex-col gap-2 rounded-xl bg-slate-50 p-3 text-[13.5px]">
                {t.criterion && (
                  <div>
                    <b>{tr("Бағалау критерийі:")}</b> {t.criterion}
                  </div>
                )}
                {t.descriptors.length > 0 && (
                  <div>
                    <b>{tr("Дескрипторлар:")}</b>
                    <ul className="mt-1 list-disc pl-5">
                      {t.descriptors.map((d, di) => (
                        <li key={di}>{d}</li>
                      ))}
                    </ul>
                  </div>
                )}
                {t.answer && (
                  <div className="text-fuchsia-800">
                    <b>{tr("Үлгі жауап:")}</b> {t.answer}
                  </div>
                )}
              </div>
            )}
          </li>
        ))}
      </ol>
      <div className="rounded-[14px] bg-violet-100/60 px-5 py-3 text-[14.5px]">
        {tr("Жалпы балл:")} <b>{total}</b>
      </div>
    </>
  );
}
