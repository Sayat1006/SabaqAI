import { useEffect, useState } from "react";
import { useLocation, useNavigate } from "react-router-dom";
import { PageHeader } from "../components/PageHeader";
import { useAuth } from "../context/useAuth";
import { GRADES, SUBJECTS } from "../lib/catalog";
import { Button, Card, Field, PrintButton, Select, Textarea, TextInput } from "../components/ui";
import { generateLessonPlan, type LessonPlan, type QmzhTask } from "../lib/generators";
import { getQmzhHistory, pushQmzhHistory, removeQmzhHistory, type SavedPlan } from "../lib/planHistory";

function timeAgo(ts: number): string {
  const diffMin = Math.round((Date.now() - ts) / 60000);
  if (diffMin < 1) return "жаңа ғана";
  if (diffMin < 60) return `${diffMin} мин бұрын`;
  const diffHour = Math.round(diffMin / 60);
  if (diffHour < 24) return `${diffHour} сағ бұрын`;
  return `${Math.round(diffHour / 24)} күн бұрын`;
}

const subjects = SUBJECTS;
const grades = GRADES;

function InfoRow({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <tr className="border-t border-violet-100 align-top dark:border-violet-900/40">
      <th className="w-1/3 bg-violet-50/60 px-3 py-2 text-left text-sm font-semibold text-slate-700 dark:bg-violet-950/40 dark:text-slate-200">
        {label}
      </th>
      <td className="px-3 py-2 text-sm text-slate-800 dark:text-slate-100">{children}</td>
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
    <div className="mt-8 border-t-2 border-violet-200 pt-6 print:break-before-page dark:border-violet-800">
      <h3 className="mb-3 text-xl font-semibold text-slate-900 dark:text-white">{task.title}</h3>

      <p className="mb-1 font-semibold text-violet-700 dark:text-violet-300">Шарты:</p>
      <div className="mb-4 space-y-1 text-sm text-slate-700 dark:text-slate-200">
        {task.condition.map((c, i) => (
          <p key={i}>{c}</p>
        ))}
      </div>

      <p className="mb-1 text-xs font-semibold uppercase tracking-wide text-slate-500 dark:text-slate-400">{task.tableTitle}</p>
      <div className="mb-4 overflow-x-auto rounded-lg border border-violet-100 dark:border-violet-900/50">
        <table className="w-full text-sm">
          <thead className="bg-violet-50 text-slate-600 dark:bg-violet-950/60 dark:text-slate-300">
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
              <tr key={ri} className="border-t border-violet-50 dark:border-violet-900/30">
                {row.map((cell, ci) => (
                  <td key={ci} className="px-3 py-2 text-slate-700 dark:text-slate-200">
                    {cell || " "}
                  </td>
                ))}
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <p className="mb-1 font-semibold text-violet-700 dark:text-violet-300">Орындау қадамдары:</p>
      <div className="mb-4 text-sm text-slate-700 dark:text-slate-200">
        <ActionList items={task.steps} />
      </div>

      <p className="mb-1 font-semibold text-violet-700 dark:text-violet-300">Бағалау критерийлері мен дескрипторлары</p>
      <div className="mb-4 overflow-x-auto rounded-lg border border-violet-100 dark:border-violet-900/50">
        <table className="w-full text-sm">
          <thead className="bg-violet-50 text-slate-600 dark:bg-violet-950/60 dark:text-slate-300">
            <tr>
              <th className="px-3 py-2 text-left font-medium">Бағалау критерийі</th>
              <th className="px-3 py-2 text-left font-medium">Дескрипторлар</th>
              <th className="w-16 px-3 py-2 text-left font-medium">Ұпай</th>
            </tr>
          </thead>
          <tbody>
            {task.criteria.map((c, ci) =>
              c.descriptors.map((d, di) => (
                <tr key={`${ci}-${di}`} className="border-t border-violet-50 dark:border-violet-900/30">
                  {di === 0 && (
                    <td
                      className="px-3 py-2 align-top text-slate-800 dark:text-slate-100"
                      rowSpan={c.descriptors.length}
                    >
                      {c.criterion}
                    </td>
                  )}
                  <td className="px-3 py-2 text-slate-700 dark:text-slate-200">{d}</td>
                  <td className="px-3 py-2 text-slate-400"></td>
                </tr>
              )),
            )}
          </tbody>
        </table>
      </div>

      <p className="mb-1 font-semibold text-violet-700 dark:text-violet-300">Саралау</p>
      <p className="mb-4 text-sm text-slate-700 dark:text-slate-200">{task.differentiation}</p>

      <p className="mb-1 font-semibold text-violet-700 dark:text-violet-300">Күтілетін нәтиже</p>
      <div className="mb-2 overflow-x-auto rounded-lg border border-violet-100 dark:border-violet-900/50">
        <table className="w-full text-sm">
          <thead className="bg-violet-50 text-slate-600 dark:bg-violet-950/60 dark:text-slate-300">
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
              <tr key={ri} className="border-t border-violet-50 dark:border-violet-900/30">
                {row.map((cell, ci) => (
                  <td key={ci} className="px-3 py-2 text-slate-700 dark:text-slate-200">
                    {cell || " "}
                  </td>
                ))}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <p className="text-sm text-slate-700 dark:text-slate-200">{task.expectedConclusion}</p>
    </div>
  );
}

export default function QmzhPage() {
  const navigate = useNavigate();
  const { user } = useAuth();
  const [subject, setSubject] = useState(() => (user?.subject && subjects.includes(user.subject) ? user.subject : subjects[0]));
  const [grade, setGrade] = useState(grades[4]);
  const [topic, setTopic] = useState("");
  const [duration, setDuration] = useState(45);
  const [teacherName, setTeacherName] = useState(() => user?.name ?? "");
  const [date, setDate] = useState("");
  const [objectivesInput, setObjectivesInput] = useState("");
  const [plan, setPlan] = useState<LessonPlan | null>(null);
  const [exportingDocx, setExportingDocx] = useState(false);
  const [generating, setGenerating] = useState(false);
  const [generateError, setGenerateError] = useState("");
  const [history, setHistory] = useState<SavedPlan<LessonPlan>[]>(() => getQmzhHistory());

  async function handleGenerate(e: React.FormEvent) {
    e.preventDefault();
    if (!topic.trim()) return;
    setGenerating(true);
    setGenerateError("");
    try {
      const newPlan = await generateLessonPlan(
        subject,
        grade,
        topic.trim(),
        duration,
        teacherName.trim(),
        date.trim(),
        objectivesInput.trim(),
      );
      setPlan(newPlan);
      setHistory(pushQmzhHistory(newPlan));
    } catch (err) {
      setGenerateError(err instanceof Error ? err.message : "ҚМЖ жасау мүмкін болмады.");
    } finally {
      setGenerating(false);
    }
  }

  function loadFromHistory(entry: SavedPlan<LessonPlan>) {
    const p = entry.data;
    setSubject(p.subject);
    setGrade(p.grade);
    setTopic(p.topic);
    setDuration(p.duration);
    setTeacherName(p.teacherName === "Мұғалімнің аты-жөні" ? "" : p.teacherName);
    setDate(p.date);
    setObjectivesInput(p.objectiveCode ? `${p.objectiveCode} - ${p.objectiveText}` : "");
    setPlan(p);
  }

  // Басты беттегі «Соңғы жобалар» тізімінен ашылғанда сақталған жоспарды жүктейміз.
  const location = useLocation();
  const openedHistoryId = (location.state as { historyId?: string } | null)?.historyId;
  useEffect(() => {
    if (!openedHistoryId) return;
    const entry = getQmzhHistory().find((h) => h.id === openedHistoryId);
    // eslint-disable-next-line react/set-state-in-effect -- навигация күйінен бір рет жүктеу
    if (entry) loadFromHistory(entry);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [openedHistoryId]);

  function handleDeleteHistory(id: string) {
    setHistory(removeQmzhHistory(id));
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

  function handleOpenPresentation() {
    if (!plan) return;
    navigate("/presentation", { state: { plan } });
  }

  return (
    <div className="mx-auto max-w-5xl px-4 py-10 sm:px-6">
      <PageHeader
        crumb="ҚМЖ жоспарлау"
        title="Қысқа мерзімді жоспар (ҚМЖ)"
        subtitle="Формасын толтырыңыз — ресми үлгі бойынша кестелермен толық рәсімделген ҚМЖ дайын болады. Нәтижені Word немесе PDF түрінде жүктей аласыз."
      />

      <Card className="mt-8 print:hidden">
        <form onSubmit={handleGenerate} className="grid gap-1 sm:grid-cols-2 sm:gap-x-6">
          <Field>
            Пән
            <Select value={subject} onChange={(e) => setSubject(e.target.value)}>
              {subjects.map((s) => (
                <option key={s}>{s}</option>
              ))}
            </Select>
          </Field>
          <Field>
            Сынып
            <Select value={grade} onChange={(e) => setGrade(e.target.value)}>
              {grades.map((g) => (
                <option key={g}>{g}</option>
              ))}
            </Select>
          </Field>
          <Field className="sm:col-span-2">
            Сабақтың тақырыбы
            <TextInput
              placeholder="мысалы: Квадрат теңдеулер"
              value={topic}
              onChange={(e) => setTopic(e.target.value)}
              required
            />
          </Field>
          <Field>
            Педагогтің аты-жөні (міндетті емес)
            <TextInput placeholder="мысалы: Айтбаев Саят" value={teacherName} onChange={(e) => setTeacherName(e.target.value)} />
          </Field>
          <Field>
            Күні (міндетті емес)
            <TextInput placeholder="кк.аа.жжжж" value={date} onChange={(e) => setDate(e.target.value)} />
          </Field>
          <Field>
            Ұзақтығы (минут)
            <TextInput
              type="number"
              min={20}
              max={90}
              value={duration}
              onChange={(e) => setDuration(Number(e.target.value))}
            />
          </Field>
          <Field className="sm:col-span-2">
            Оқу бағдарламасына сәйкес оқыту мақсаттары (міндетті емес)
            <Textarea
              rows={3}
              placeholder={"мысалы: 7.2.1.4 - физикалық шамаларды олардың SI жүйесіндегі өлшем бірліктерімен сәйкестендіру"}
              value={objectivesInput}
              onChange={(e) => setObjectivesInput(e.target.value)}
            />
            <span className="mt-1 block text-xs text-slate-500 dark:text-slate-400">
              Толтырсаңыз, ЖИ дәл осы оқу мақсаттарын басшылыққа алып, сабақтың барлық кезеңі мен тапсырмасын соған
              бағыттап құрады. Бос қалдырсаңыз, мақсатты тақырыпқа қарай өзі таңдайды.
            </span>
          </Field>
          <div className="flex items-end pb-4">
            <Button type="submit" className="w-full" disabled={generating}>
              {generating ? "ЖИ жасап жатыр..." : "ҚМЖ құру"}
            </Button>
          </div>
          {generateError && (
            <p className="mb-4 text-sm text-rose-600 dark:text-rose-400 sm:col-span-2">{generateError}</p>
          )}
        </form>
      </Card>

      {history.length > 0 && (
        <Card className="mt-4 print:hidden">
          <h3 className="mb-2 text-sm font-semibold text-slate-700 dark:text-slate-200">Соңғы жоспарлар</h3>
          <div className="flex flex-wrap gap-2">
            {history.map((entry) => (
              <div
                key={entry.id}
                className="flex items-center gap-1.5 rounded-full border border-violet-200 py-1 pl-3 pr-1.5 text-xs text-violet-700 dark:border-violet-800 dark:text-violet-300"
              >
                <button type="button" onClick={() => loadFromHistory(entry)} className="hover:underline">
                  {entry.label} · {timeAgo(entry.savedAt)}
                </button>
                <button
                  type="button"
                  onClick={() => handleDeleteHistory(entry.id)}
                  className="rounded-full px-1 text-rose-500 hover:bg-rose-50 dark:hover:bg-rose-900/30"
                  aria-label="Жоспарды жою"
                >
                  ✕
                </button>
              </div>
            ))}
          </div>
        </Card>
      )}

      {plan && (
        <Card className="print-card mt-6 text-left">
          <div className="mb-4 flex flex-wrap items-start justify-between gap-3">
            <h2 className="text-2xl font-semibold text-slate-900 dark:text-white">
              Қысқа мерзімді сабақ жоспары — {plan.subject}
            </h2>
            <div className="flex flex-wrap gap-2 print:hidden">
              <Button variant="ghost" type="button" onClick={handleOpenPresentation}>
                🖥️ Слайд-презентация жасау
              </Button>
              <Button variant="ghost" type="button" onClick={handleExportDocx} disabled={exportingDocx}>
                {exportingDocx ? "Дайындалуда..." : "📄 Word-ке экспорттау"}
              </Button>
              <PrintButton />
            </div>
          </div>

          <div className="mb-8 overflow-hidden rounded-lg border border-violet-100 dark:border-violet-900/50">
            <table className="w-full">
              <tbody>
                <InfoRow label="Бөлім">{plan.section}</InfoRow>
                <InfoRow label="Педагогтің тегі, аты, әкесінің аты (болған жағдайда)">{plan.teacherName}</InfoRow>
                <InfoRow label="Күні">{plan.date}</InfoRow>
                <tr className="border-t border-violet-100 dark:border-violet-900/40">
                  <th className="w-1/3 bg-violet-50/60 px-3 py-2 text-left text-sm font-semibold text-slate-700 dark:bg-violet-950/40 dark:text-slate-200">
                    Сынып {plan.gradeNumber}
                  </th>
                  <td className="px-3 py-2 text-sm text-slate-800 dark:text-slate-100">
                    Қатысушылар саны ______ &nbsp;&nbsp; Қатыспағандар саны ______
                  </td>
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

          <h3 className="mb-2 text-center text-lg font-semibold text-slate-900 dark:text-white">Сабақтың барысы</h3>
          <div className="mb-4 overflow-x-auto rounded-lg border border-violet-100 dark:border-violet-900/50">
            <table className="w-full text-sm">
              <thead className="bg-violet-50 text-slate-600 dark:bg-violet-950/60 dark:text-slate-300">
                <tr>
                  <th className="px-3 py-2 text-left font-medium">Сабақтың кезеңі / Уақыт</th>
                  <th className="px-3 py-2 text-left font-medium">Педагогтің әрекеті</th>
                  <th className="px-3 py-2 text-left font-medium">Оқушының әрекеті</th>
                  <th className="px-3 py-2 text-left font-medium">Бағалау</th>
                  <th className="px-3 py-2 text-left font-medium">Ресурстар</th>
                </tr>
              </thead>
              <tbody>
                {plan.stages.flatMap((stage) =>
                  stage.rows.map((row, ri) => (
                    <tr key={`${stage.name}-${ri}`} className="border-t border-violet-50 align-top dark:border-violet-900/30">
                      {ri === 0 && (
                        <td
                          className="px-3 py-2 align-top font-medium text-slate-900 dark:text-white"
                          rowSpan={stage.rows.length}
                        >
                          {stage.name}
                          <br />
                          <span className="text-xs font-normal text-slate-500 dark:text-slate-400">{stage.timeRange}</span>
                        </td>
                      )}
                      <td className="px-3 py-2 text-slate-700 dark:text-slate-200">
                        <ActionList items={row.teacherAction} />
                      </td>
                      <td className="px-3 py-2 text-slate-700 dark:text-slate-200">
                        <ActionList items={row.studentAction} />
                      </td>
                      <td className="px-3 py-2 text-slate-700 dark:text-slate-200">
                        <p className="font-medium">{row.assessmentType}</p>
                        <p className="text-xs text-slate-500 dark:text-slate-400">{row.assessmentDetail}</p>
                      </td>
                      <td className="px-3 py-2 text-slate-700 dark:text-slate-200">{row.resources}</td>
                    </tr>
                  )),
                )}
              </tbody>
            </table>
          </div>

          {plan.tasks.map((task, i) => (
            <TaskBlock key={i} task={task} />
          ))}
        </Card>
      )}
    </div>
  );
}
