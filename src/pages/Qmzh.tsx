import { ClipboardList, Download, ListChecks, Presentation, Printer, RotateCcw, Sparkles, X } from "lucide-react";
import { useEffect, useState } from "react";
import { useLocation, useNavigate } from "react-router-dom";
import { PageHeader } from "../components/PageHeader";
import { useAuth } from "../context/useAuth";
import { GRADES, SUBJECTS } from "../lib/catalog";
import { generateLessonPlan, type LessonPlan, type QmzhTask } from "../lib/generators";
import { deleteProject, getQmzh, getQmzhList, saveQmzh, timeAgo, type SavedQmzh } from "../lib/projects";

const fieldClass = "w-full rounded-xl border border-slate-200 bg-slate-50 px-3.5 py-3 text-sm outline-none focus:border-violet-500";

function FormField({ label, hint, children }: { label: React.ReactNode; hint?: string; children: React.ReactNode }) {
  return (
    <label className="block">
      <span className="mb-2 block text-[13px] font-semibold text-slate-500">{label}</span>
      {children}
      {hint && <span className="mt-1.5 block text-xs text-slate-500">{hint}</span>}
    </label>
  );
}

function InfoRow({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <tr className="border-t border-violet-100 align-top">
      <th className="w-1/3 bg-violet-50/60 px-3 py-2 text-left text-sm font-semibold text-slate-700">
        {label}
      </th>
      <td className="px-3 py-2 text-sm text-slate-800">{children}</td>
    </tr>
  );
}

function ActionList({ items }: { items: string[] }) {
  return (
    <ol className="list-decimal space-y-1 pl-4">
      {items.map((t, i) => (
        <li key={i}>{t}</li>
      ))}
    </ol>
  );
}

function TaskBlock({ task }: { task: QmzhTask }) {
  return (
    <div className="mt-8 border-t-2 border-violet-200 pt-6 print:break-before-page">
      <h3 className="mb-3 text-xl font-semibold text-slate-900">{task.title}</h3>

      <p className="mb-1 font-semibold text-violet-700">Шарты:</p>
      <div className="mb-4 space-y-1 text-sm text-slate-700">
        {task.condition.map((c, i) => (
          <p key={i}>{c}</p>
        ))}
      </div>

      <p className="mb-1 text-xs font-semibold uppercase tracking-wide text-slate-500">{task.tableTitle}</p>
      <div className="mb-4 overflow-x-auto rounded-lg border border-violet-100">
        <table className="w-full text-sm">
          <thead className="bg-violet-50 text-slate-600">
            <tr>
              {task.tableHeaders.map((h) => (
                <th key={h} className="px-3 py-2 text-left font-medium">
                  {h}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {task.tableRows.map((row, ri) => (
              <tr key={ri} className="border-t border-violet-50">
                {row.map((cell, ci) => (
                  <td key={ci} className="px-3 py-2 text-slate-700">
                    {cell || " "}
                  </td>
                ))}
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <p className="mb-1 font-semibold text-violet-700">Орындау қадамдары:</p>
      <div className="mb-4 text-sm text-slate-700">
        <ActionList items={task.steps} />
      </div>

      <p className="mb-1 font-semibold text-violet-700">Бағалау критерийлері мен дескрипторлары</p>
      <div className="mb-4 overflow-x-auto rounded-lg border border-violet-100">
        <table className="w-full text-sm">
          <thead className="bg-violet-50 text-slate-600">
            <tr>
              <th className="px-3 py-2 text-left font-medium">Бағалау критерийі</th>
              <th className="px-3 py-2 text-left font-medium">Дескрипторлар</th>
              <th className="w-16 px-3 py-2 text-left font-medium">Ұпай</th>
            </tr>
          </thead>
          <tbody>
            {task.criteria.map((c, ci) =>
              c.descriptors.map((d, di) => (
                <tr key={`${ci}-${di}`} className="border-t border-violet-50">
                  {di === 0 && (
                    <td
                      className="px-3 py-2 align-top text-slate-800"
                      rowSpan={c.descriptors.length}
                    >
                      {c.criterion}
                    </td>
                  )}
                  <td className="px-3 py-2 text-slate-700">{d}</td>
                  <td className="px-3 py-2 text-slate-400"></td>
                </tr>
              )),
            )}
          </tbody>
        </table>
      </div>

      <p className="mb-1 font-semibold text-violet-700">Саралау</p>
      <p className="mb-4 text-sm text-slate-700">{task.differentiation}</p>

      <p className="mb-1 font-semibold text-violet-700">Күтілетін нәтиже</p>
      <div className="mb-2 overflow-x-auto rounded-lg border border-violet-100">
        <table className="w-full text-sm">
          <thead className="bg-violet-50 text-slate-600">
            <tr>
              {task.tableHeaders.map((h) => (
                <th key={h} className="px-3 py-2 text-left font-medium">
                  {h}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {task.expectedResultRows.map((row, ri) => (
              <tr key={ri} className="border-t border-violet-50">
                {row.map((cell, ci) => (
                  <td key={ci} className="px-3 py-2 text-slate-700">
                    {cell || " "}
                  </td>
                ))}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <p className="text-sm text-slate-700">{task.expectedConclusion}</p>
    </div>
  );
}

export default function QmzhPage() {
  const navigate = useNavigate();
  const location = useLocation();
  const { user } = useAuth();
  const [subject, setSubject] = useState(() => (user?.subject && SUBJECTS.includes(user.subject) ? user.subject : SUBJECTS[0]));
  const [grade, setGrade] = useState(() => user?.grades?.[0] ?? GRADES[4]);
  const [topic, setTopic] = useState("");
  const [duration, setDuration] = useState(45);
  const [teacherName, setTeacherName] = useState(() => user?.name ?? "");
  const [date, setDate] = useState("");
  const [objectivesInput, setObjectivesInput] = useState("");
  const [plan, setPlan] = useState<LessonPlan | null>(null);
  const [exportingDocx, setExportingDocx] = useState(false);
  const [generating, setGenerating] = useState(false);
  const [error, setError] = useState("");
  const [history, setHistory] = useState<SavedQmzh[]>([]);

  function fillForm(p: LessonPlan) {
    setSubject(p.subject);
    setGrade(p.grade);
    setTopic(p.topic);
    setDuration(p.duration);
    setTeacherName(p.teacherName === "Мұғалімнің аты-жөні" ? "" : p.teacherName);
    setDate(p.date);
    setObjectivesInput(p.objectiveCode ? `${p.objectiveCode} - ${p.objectiveText}` : "");
    setPlan(p);
  }

  useEffect(() => {
    getQmzhList()
      .then(setHistory)
      .catch((e) => setError(e instanceof Error ? e.message : "Жоспарлар тізімін жүктеу мүмкін болмады."));
  }, []);

  // Басты беттегі «Соңғы жобалар» тізімінен ашылғанда сақталған жоспарды жүктейміз.
  const openedId = (location.state as { qmzhId?: string } | null)?.qmzhId;
  useEffect(() => {
    if (!openedId) return;
    getQmzh(openedId)
      .then((entry) => entry && fillForm(entry.plan))
      .catch((e) => setError(e instanceof Error ? e.message : "Жоспарды ашу мүмкін болмады."));
  }, [openedId]);

  async function handleGenerate(e: React.FormEvent) {
    e.preventDefault();
    if (generating) return;
    if (topic.trim().length < 3) {
      setError("Сабақтың тақырыбын жазыңыз.");
      return;
    }
    setGenerating(true);
    setError("");
    try {
      const newPlan = await generateLessonPlan(subject, grade, topic.trim(), duration, teacherName.trim(), date.trim(), objectivesInput.trim());
      setPlan(newPlan);
      try {
        const saved = await saveQmzh(newPlan);
        setHistory((h) => [saved, ...h].slice(0, 8));
      } catch (err) {
        setError(err instanceof Error ? `Жоспар дайын, бірақ сақталмады: ${err.message}` : "Жоспар сақталмады.");
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : "ҚМЖ жасау мүмкін болмады.");
    } finally {
      setGenerating(false);
    }
  }

  async function handleDeleteHistory(id: string) {
    try {
      await deleteProject(id);
      setHistory((h) => h.filter((x) => x.id !== id));
    } catch (err) {
      setError(err instanceof Error ? err.message : "Жою мүмкін болмады.");
    }
  }

  async function handleExportDocx() {
    if (!plan) return;
    setExportingDocx(true);
    try {
      const { exportQmzhToDocx } = await import("../lib/exportDocx");
      await exportQmzhToDocx(plan);
    } finally {
      setExportingDocx(false);
    }
  }

  const ghost =
    "inline-flex items-center gap-2 rounded-[11px] border border-slate-200 bg-white px-3.5 py-2.5 text-sm font-semibold hover:border-violet-500 hover:text-violet-600 disabled:opacity-60";

  return (
    <div className="mx-auto max-w-[1360px] px-4 py-9 sm:px-10 print:p-0">
      <PageHeader
        crumb="ҚМЖ жоспарлау"
        title="Қысқа мерзімді жоспар (ҚМЖ)"
        subtitle="Формасын толтырыңыз — ресми үлгі бойынша кестелермен толық рәсімделген ҚМЖ дайын болады. Нәтижені Word немесе PDF түрінде жүктей аласыз."
      />

      <div className="mt-8 flex flex-wrap items-start gap-7">
        <div className="flex w-full flex-col gap-5 lg:sticky lg:top-24 lg:w-[380px] print:hidden">
          <form
            onSubmit={handleGenerate}
            noValidate
            className="flex flex-col gap-5 rounded-3xl border border-white/70 bg-white/75 p-6 shadow-[0_24px_48px_-30px_rgba(27,26,46,.2)] backdrop-blur-xl"
          >
            <div className="grid grid-cols-2 gap-3">
              <FormField label="Пән">
                <select value={subject} onChange={(e) => setSubject(e.target.value)} className={fieldClass}>
                  {SUBJECTS.map((s) => (
                    <option key={s}>{s}</option>
                  ))}
                </select>
              </FormField>
              <FormField label="Сынып">
                <select value={grade} onChange={(e) => setGrade(e.target.value)} className={fieldClass}>
                  {GRADES.map((g) => (
                    <option key={g}>{g}</option>
                  ))}
                </select>
              </FormField>
            </div>
            <FormField label="Сабақтың тақырыбы">
              <input value={topic} onChange={(e) => setTopic(e.target.value)} maxLength={300} placeholder="мыс.: Физика – табиғат туралы ғылым" className={fieldClass} />
            </FormField>
            <FormField label="Оқу мақсаттары" hint="Бос қалдырсаңыз, AI бағдарламаға сай мақсатты өзі ұсынады.">
              <textarea
                rows={3}
                value={objectivesInput}
                onChange={(e) => setObjectivesInput(e.target.value)}
                placeholder="мыс.: 7.1.1.1 — физикалық құбылыстарға мысалдар келтіру"
                className={`${fieldClass} resize-y`}
              />
            </FormField>
            <FormField label="Педагогтің аты-жөні">
              <input value={teacherName} onChange={(e) => setTeacherName(e.target.value)} placeholder="мыс.: Айтбаев Саят" className={fieldClass} />
            </FormField>
            <div className="grid grid-cols-2 gap-3">
              <FormField label="Күні">
                <input value={date} onChange={(e) => setDate(e.target.value)} placeholder="кк.аа.жжжж" className={fieldClass} />
              </FormField>
              <FormField label="Ұзақтығы (мин)">
                <input type="number" min={20} max={90} value={duration} onChange={(e) => setDuration(Number(e.target.value))} className={fieldClass} />
              </FormField>
            </div>
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
              {generating ? "Дайындалуда..." : plan ? "Қайта генерациялау" : "ҚМЖ жасау"}
            </button>
          </form>

          {history.length > 0 && (
            <div className="rounded-[18px] border border-slate-200 bg-white p-5">
              <div className="mb-3 text-sm font-bold">Соңғы жоспарлар</div>
              <ul className="flex flex-col gap-1">
                {history.map((entry) => (
                  <li key={entry.id} className="flex items-center gap-2">
                    <button
                      type="button"
                      onClick={() => fillForm(entry.plan)}
                      className="min-w-0 flex-1 rounded-lg px-2 py-1.5 text-left text-sm hover:bg-slate-50"
                    >
                      <span className="block truncate font-semibold">{entry.plan.topic}</span>
                      <span className="block text-xs text-slate-500">
                        {entry.plan.subject} · {entry.plan.grade} · {timeAgo(entry.savedAt)}
                      </span>
                    </button>
                    <button
                      type="button"
                      onClick={() => handleDeleteHistory(entry.id)}
                      aria-label={`Жою: ${entry.plan.topic}`}
                      className="rounded-lg p-1.5 text-slate-500 hover:bg-rose-50 hover:text-rose-700"
                    >
                      <X size={15} />
                    </button>
                  </li>
                ))}
              </ul>
            </div>
          )}
        </div>

        <section className="min-w-0 flex-[1_1_560px]" aria-live="polite">
          {generating ? (
            <div className="flex min-h-[420px] flex-col items-center justify-center gap-3 rounded-3xl border border-slate-200 bg-white">
              <Sparkles size={34} className="animate-spin text-violet-500" />
              <div className="text-base">ҚМЖ дайындалуда...</div>
              <div className="text-[12.5px] text-slate-500">Әдетте 20–60 секунд алады</div>
            </div>
          ) : !plan ? (
            <div className="flex min-h-[420px] flex-col items-center justify-center gap-3.5 rounded-3xl border-2 border-dashed border-slate-200 p-10 text-center text-slate-500">
              <span className="flex h-[72px] w-[72px] items-center justify-center rounded-[20px] bg-violet-100 text-violet-500">
                <ClipboardList size={32} />
              </span>
              <div className="text-base text-slate-900">Форманы толтырып, «ҚМЖ жасау» батырмасын басыңыз</div>
              <div className="text-[13.5px]">Дайын жоспар осы жерде пайда болады және «Жобалар» бөлімінде сақталады.</div>
            </div>
          ) : (
            <article className="print-card animate-[fadeUp_.5s_cubic-bezier(.16,1,.3,1)_both] rounded-[22px] border border-slate-200 bg-white p-6 text-left sm:p-8 print:border-0 print:p-0">
              <div className="mb-6 flex flex-wrap items-start justify-between gap-4 border-b-2 border-slate-900 pb-4">
                <div>
                  <h2 className="text-[22px] font-bold">Қысқа мерзімді сабақ жоспары</h2>
                  <div className="mt-1 text-slate-500">
                    {plan.subject} · {plan.grade}
                  </div>
                </div>
                <span className="rounded-full bg-fuchsia-100 px-3 py-1.5 text-xs font-semibold text-fuchsia-700 print:hidden">
                  Ресми үлгі бойынша
                </span>
              </div>

              <div className="mb-8 overflow-hidden rounded-lg border border-violet-100">
                <table className="w-full">
                  <tbody>
                    <InfoRow label="Бөлім">{plan.section}</InfoRow>
                    <InfoRow label="Педагогтің тегі, аты, әкесінің аты (болған жағдайда)">{plan.teacherName}</InfoRow>
                    <InfoRow label="Күні">{plan.date}</InfoRow>
                    <tr className="border-t border-violet-100">
                      <th className="w-1/3 bg-violet-50/60 px-3 py-2 text-left text-sm font-semibold text-slate-700">Сынып {plan.gradeNumber}</th>
                      <td className="px-3 py-2 text-sm text-slate-800">Қатысушылар саны ______ &nbsp;&nbsp; Қатыспағандар саны ______</td>
                    </tr>
                    <InfoRow label="Сабақтың тақырыбы">{plan.topic}</InfoRow>
                    <InfoRow label="Оқу бағдарламасына сәйкес оқыту мақсаттары">
                      {plan.objectiveCode} — {plan.objectiveText}
                    </InfoRow>
                    <InfoRow label="Сабақтың мақсаты">
                      <ul className="list-disc space-y-1 pl-4">
                        {plan.goals.map((g, i) => (
                          <li key={i}>{g}</li>
                        ))}
                      </ul>
                    </InfoRow>
                    <InfoRow label="Құндылықтарды дарыту">{plan.valuesText}</InfoRow>
                  </tbody>
                </table>
              </div>

              <h3 className="mb-2 text-center text-lg font-bold">Сабақтың барысы</h3>
              <div className="mb-4 overflow-x-auto rounded-lg border border-violet-100">
                <table className="w-full text-sm">
                  <thead className="bg-violet-50 text-slate-600">
                    <tr>
                      <th className="px-3 py-2 text-left font-semibold">Сабақтың кезеңі / Уақыт</th>
                      <th className="px-3 py-2 text-left font-semibold">Педагогтің әрекеті</th>
                      <th className="px-3 py-2 text-left font-semibold">Оқушының әрекеті</th>
                      <th className="px-3 py-2 text-left font-semibold">Бағалау</th>
                      <th className="px-3 py-2 text-left font-semibold">Ресурстар</th>
                    </tr>
                  </thead>
                  <tbody>
                    {plan.stages.flatMap((stage) =>
                      stage.rows.map((row, ri) => (
                        <tr key={`${stage.name}-${ri}`} className="border-t border-violet-50 align-top">
                          {ri === 0 && (
                            <td className="px-3 py-2 align-top font-semibold" rowSpan={stage.rows.length}>
                              {stage.name}
                              <br />
                              <span className="text-xs font-normal text-violet-600">{stage.timeRange}</span>
                            </td>
                          )}
                          <td className="px-3 py-2 text-slate-700">
                            <ActionList items={row.teacherAction} />
                          </td>
                          <td className="px-3 py-2 text-slate-700">
                            <ActionList items={row.studentAction} />
                          </td>
                          <td className="px-3 py-2 text-slate-700">
                            <p className="font-semibold">{row.assessmentType}</p>
                            <p className="text-xs text-slate-500">{row.assessmentDetail}</p>
                          </td>
                          <td className="px-3 py-2 text-slate-700">{row.resources}</td>
                        </tr>
                      )),
                    )}
                  </tbody>
                </table>
              </div>

              {plan.tasks.map((task, i) => (
                <TaskBlock key={i} task={task} />
              ))}

              <div className="mt-8 flex flex-wrap gap-2.5 border-t border-slate-200 pt-5 print:hidden">
                <button type="button" onClick={handleExportDocx} disabled={exportingDocx} className={ghost}>
                  <Download size={15} /> {exportingDocx ? "Дайындалуда..." : "Word түрінде жүктеу"}
                </button>
                <button type="button" onClick={() => window.print()} className={ghost}>
                  <Printer size={15} /> PDF / басып шығару
                </button>
                <button type="button" onClick={() => navigate("/presentation", { state: { plan } })} className={ghost}>
                  <Presentation size={15} /> Презентация жасау
                </button>
                <button type="button" onClick={() => navigate("/tests", { state: { plan } })} className={ghost}>
                  <ListChecks size={15} /> Тест жасау
                </button>
                <button
                  type="button"
                  onClick={() => {
                    setPlan(null);
                    setTopic("");
                    setObjectivesInput("");
                    window.scrollTo({ top: 0, behavior: "smooth" });
                  }}
                  className={ghost}
                >
                  <RotateCcw size={15} /> Жаңа ҚМЖ
                </button>
              </div>
            </article>
          )}
        </section>
      </div>
    </div>
  );
}
