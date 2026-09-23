import { ClipboardList, Download, ListChecks, Pencil, Presentation, Printer, RotateCcw, Sparkles, X } from "lucide-react";
import { useEffect, useState } from "react";
import { useLocation, useNavigate } from "react-router-dom";
import { LangPicker } from "../components/LangPicker";
import { PageHeader } from "../components/PageHeader";
import { QmzhEditor } from "../components/QmzhEditor";
import { PlanningTable, ResourcesSection, TaskBlock, VocabularyTable } from "../components/QmzhSections";
import { useAuth } from "../context/useAuth";
import { GRADES, SUBJECTS } from "../lib/catalog";
import { qmzhLabels } from "../lib/docLabels";
import { generateLessonPlan, LESSON_TYPES, TASK_KINDS, type LessonPlan } from "../lib/generators";
import { gradeIn, subjectIn, type Lang } from "../lib/lang";
import { deleteProject, getQmzh, getQmzhList, saveQmzh, timeAgo, updateQmzh, type SavedQmzh } from "../lib/projects";
import type { QmzhResource } from "../lib/resources";
import { scrollToResult } from "../lib/scrollToResult";

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
  const [planId, setPlanId] = useState<string | null>(null);
  const [lessonType, setLessonType] = useState<string>(LESSON_TYPES[0]);
  const [taskKinds, setTaskKinds] = useState<string[]>(["Жұптық жұмыс", "Топтық жұмыс", "Функционалдық сауаттылық"]);
  const [taskCount, setTaskCount] = useState(3);
  const [notes, setNotes] = useState("");
  const [lang, setLang] = useState<Lang>("kk");
  const [savingResources, setSavingResources] = useState(false);
  const [editing, setEditing] = useState(false);
  const [savingPlan, setSavingPlan] = useState(false);

  async function saveEdited(next: LessonPlan) {
    setSavingPlan(true);
    setError("");
    try {
      if (planId) {
        await updateQmzh(planId, next);
        setHistory((h) => h.map((x) => (x.id === planId ? { ...x, plan: next } : x)));
      } else {
        const saved = await saveQmzh(next);
        setPlanId(saved.id);
        setHistory((h) => [saved, ...h].slice(0, 8));
      }
      setPlan(next);
      setTopic(next.topic);
      setEditing(false);
      window.scrollTo({ top: 0, behavior: "smooth" });
    } catch (err) {
      setError(err instanceof Error ? err.message : "Өзгерістер сақталмады.");
    } finally {
      setSavingPlan(false);
    }
  }
  const [exportingDocx, setExportingDocx] = useState(false);
  const [generating, setGenerating] = useState(false);
  const [error, setError] = useState("");
  const [history, setHistory] = useState<SavedQmzh[]>([]);

  function fillForm(p: LessonPlan, id: string | null = null) {
    setPlanId(id);
    setEditing(false);
    if (p.lessonType) setLessonType(p.lessonType);
    setLang(p.lang ?? "kk");
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
  // «Жобалар» тізімінен (state) немесе Telegram боттағы сілтемеден (?id=) ашылады.
  const openedId = (location.state as { qmzhId?: string } | null)?.qmzhId ?? new URLSearchParams(location.search).get("id") ?? undefined;
  useEffect(() => {
    if (!openedId) return;
    getQmzh(openedId)
      .then((entry) => entry && fillForm(entry.plan, entry.id))
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
    scrollToResult();
    setError("");
    try {
      const newPlan = await generateLessonPlan(subject, grade, topic.trim(), duration, teacherName.trim(), date.trim(), objectivesInput.trim(), {
        lessonType,
        taskKinds,
        taskCount,
        notes: notes.trim(),
        lang,
      });
      setPlan(newPlan);
      setPlanId(null);
      setEditing(false);
      try {
        const saved = await saveQmzh(newPlan);
        setPlanId(saved.id);
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

  async function changeResources(next: QmzhResource[]) {
    if (!plan) return;
    const updated = { ...plan, resources: next };
    setPlan(updated);
    if (!planId) return;
    setSavingResources(true);
    try {
      await updateQmzh(planId, updated);
      setHistory((h) => h.map((x) => (x.id === planId ? { ...x, plan: updated } : x)));
    } catch (err) {
      setError(err instanceof Error ? err.message : "Сілтемелер сақталмады.");
    } finally {
      setSavingResources(false);
    }
  }

  function toggleKind(k: string) {
    setTaskKinds((list) => (list.includes(k) ? list.filter((x) => x !== k) : [...list, k]));
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
  const L = qmzhLabels(plan?.lang);

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
            <LangPicker value={lang} onChange={setLang} />
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
            <FormField label="Сабақ түрі">
              <select value={lessonType} onChange={(e) => setLessonType(e.target.value)} className={fieldClass}>
                {LESSON_TYPES.map((t) => (
                  <option key={t}>{t}</option>
                ))}
              </select>
            </FormField>
            <fieldset>
              <legend className="mb-2 block text-[13px] font-semibold text-slate-500">Тапсырма түрлері</legend>
              <div className="flex flex-wrap gap-1.5">
                {TASK_KINDS.map((k) => {
                  const on = taskKinds.includes(k);
                  return (
                    <button
                      key={k}
                      type="button"
                      aria-pressed={on}
                      onClick={() => toggleKind(k)}
                      className={`rounded-full border px-3 py-1.5 text-[12.5px] transition ${on ? "border-violet-600 bg-violet-600 text-white" : "border-slate-200 bg-white text-slate-600 hover:border-violet-500"}`}
                    >
                      {k}
                    </button>
                  );
                })}
              </div>
              <span className="mt-1.5 block text-xs text-slate-500">Таңдамасаңыз, AI өзі әртүрлі жұмыс түрлерін ұсынады.</span>
            </fieldset>
            <FormField label="Тапсырма саны">
              <div className="grid grid-cols-4 gap-2">
                {[2, 3, 4, 5].map((n) => (
                  <button
                    key={n}
                    type="button"
                    aria-pressed={taskCount === n}
                    onClick={() => setTaskCount(n)}
                    className={`min-h-10 rounded-xl border text-[13.5px] ${taskCount === n ? "border-violet-600 bg-violet-600 text-white" : "border-slate-200 bg-white text-slate-500 hover:border-violet-500"}`}
                  >
                    {n}
                  </button>
                ))}
              </div>
            </FormField>
            <FormField label="Қосымша тілек" hint="Міндетті емес: мыс. «STEM элементі болсын», «ерекше білім беру қажеттілігі бар оқушы бар».">
              <textarea rows={2} value={notes} onChange={(e) => setNotes(e.target.value)} maxLength={500} className={`${fieldClass} resize-y`} />
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
                      onClick={() => fillForm(entry.plan, entry.id)}
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

        <section id="result" className="min-w-0 flex-[1_1_560px] scroll-mt-28" aria-live="polite">
          {generating ? (
            <div className="flex min-h-[420px] flex-col items-center justify-center gap-3 rounded-3xl border border-slate-200 bg-white">
              <Sparkles size={34} className="animate-spin text-violet-500" />
              <div className="text-base">ҚМЖ дайындалуда...</div>
              <div className="text-[12.5px] text-slate-500">Әдетте 20–60 секунд алады</div>
            </div>
          ) : plan && editing ? (
            <>
              {error && (
                <p role="alert" className="mb-3 rounded-xl bg-rose-50 px-3.5 py-2.5 text-sm text-rose-700">
                  {error}
                </p>
              )}
              <QmzhEditor plan={plan} saving={savingPlan} onSave={saveEdited} onCancel={() => setEditing(false)} />
            </>
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
                  <h2 className="text-[22px] font-bold">{L.docTitle}</h2>
                  <div className="mt-1 text-slate-500">
                    {subjectIn(plan.subject, plan.lang)} · {gradeIn(plan.grade, plan.lang)}
                  </div>
                </div>
                <div className="flex items-center gap-2 print:hidden">
                  <span className="rounded-full bg-fuchsia-100 px-3 py-1.5 text-xs font-semibold text-fuchsia-700">Ресми үлгі бойынша</span>
                  <button type="button" onClick={() => setEditing(true)} className="inline-flex items-center gap-1.5 rounded-full border border-violet-300 px-3 py-1.5 text-xs font-semibold text-violet-700 hover:bg-violet-100">
                    <Pencil size={13} /> Өңдеу
                  </button>
                </div>
              </div>

              <div className="mb-8 overflow-hidden rounded-lg border border-violet-100">
                <table className="w-full">
                  <tbody>
                    <InfoRow label={L.section}>{plan.section}</InfoRow>
                    <InfoRow label={L.teacher}>{plan.teacherName}</InfoRow>
                    <InfoRow label={L.date}>{plan.date}</InfoRow>
                    <tr className="border-t border-violet-100">
                      <th className="w-1/3 bg-violet-50/60 px-3 py-2 text-left text-sm font-semibold text-slate-700">{L.grade(plan.gradeNumber)}</th>
                      <td className="px-3 py-2 text-sm text-slate-800">{L.attendance}</td>
                    </tr>
                    <InfoRow label={L.topic}>{plan.topic}</InfoRow>
                    <InfoRow label={L.objectives}>
                      {plan.objectiveCode} — {plan.objectiveText}
                    </InfoRow>
                    <InfoRow label={L.goals}>
                      <ul className="list-disc space-y-1 pl-4">
                        {plan.goals.map((g, i) => (
                          <li key={i}>{g}</li>
                        ))}
                      </ul>
                    </InfoRow>
                    <InfoRow label={L.values}>{plan.valuesText}</InfoRow>
                  </tbody>
                </table>
              </div>

              {plan.vocabulary && <VocabularyTable items={plan.vocabulary} lang={plan.lang} />}

              <h3 className="mb-2 text-center text-lg font-bold">{L.flow}</h3>
              <div className="mb-4 overflow-x-auto rounded-lg border border-violet-100">
                <table className="w-full text-sm">
                  <thead className="bg-violet-50 text-slate-600">
                    <tr>
                      <th className="px-3 py-2 text-left font-semibold">{L.stageTime}</th>
                      <th className="px-3 py-2 text-left font-semibold">{L.teacherAction}</th>
                      <th className="px-3 py-2 text-left font-semibold">{L.studentAction}</th>
                      <th className="px-3 py-2 text-left font-semibold">{L.assessment}</th>
                      <th className="px-3 py-2 text-left font-semibold">{L.resources}</th>
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
                <TaskBlock key={i} task={task} index={i} lang={plan.lang} />
              ))}

              {plan.planning && <PlanningTable planning={plan.planning} lang={plan.lang} />}

              {(plan.reflection?.length || plan.homework) && (
                <div className="mt-8 grid gap-4 sm:grid-cols-2">
                  {plan.reflection && plan.reflection.length > 0 && (
                    <div className="rounded-xl border border-violet-100 p-4">
                      <div className="mb-1.5 font-semibold text-violet-700">{L.reflection}</div>
                      <ul className="list-disc space-y-1 pl-4 text-sm">
                        {plan.reflection.map((r, i) => (
                          <li key={i}>{r}</li>
                        ))}
                      </ul>
                    </div>
                  )}
                  {plan.homework && (
                    <div className="rounded-xl border border-violet-100 p-4">
                      <div className="mb-1.5 font-semibold text-violet-700">{L.homework}</div>
                      <p className="text-sm">{plan.homework}</p>
                    </div>
                  )}
                </div>
              )}

              <ResourcesSection resources={plan.resources ?? []} onChange={changeResources} saving={savingResources} lang={plan.lang} />

              <div className="mt-8 flex flex-wrap gap-2.5 border-t border-slate-200 pt-5 print:hidden">
                <button type="button" onClick={() => setEditing(true)} className="inline-flex items-center gap-2 rounded-[11px] bg-violet-600 px-3.5 py-2.5 text-sm font-semibold text-white">
                  <Pencil size={15} /> Өңдеу
                </button>
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
                  <ListChecks size={15} /> Тапсырма жасау
                </button>
                <button
                  type="button"
                  onClick={() => {
                    setPlan(null);
                    setPlanId(null);
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
