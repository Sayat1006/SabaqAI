import {
  ArrowLeft,
  ArrowRight,
  Download,
  FileSpreadsheet,
  FileText,
  Plus,
  Printer,
  Sparkles,
  Upload,
  X,
} from "lucide-react";
import { useRef, useState } from "react";
import { Link } from "react-router-dom";
import { Badge, Button, Card, Field, Select, TextInput } from "../components/ui";
import { useAuth } from "../context/useAuth";
import { generateKtj } from "../lib/generators";
import { pushThematicToCalendar } from "../lib/schedule";
import {
  ASSESSMENT_TYPES,
  CURRICULUM_TYPES,
  emptyCtjPlan,
  emptyCtjRow,
  getCtjPlans,
  LANGUAGES,
  LESSON_KINDS,
  parseCtjFile,
  removeCtjPlan,
  upsertCtjPlan,
  type CtjPlan,
  type CtjRow,
} from "../lib/thematicPlan";

const subjects = ["Математика", "Қазақ тілі", "Ағылшын тілі", "Биология", "Тарих", "Информатика", "Физика", "Химия", "Жаратылыстану"];

function parallelOf(grade: string): string {
  const m = grade.match(/\d+/);
  return m ? m[0] : grade;
}

// ---------- Тізім беті: "Менің КТЖ-ларым" ----------

function PlanListView({
  plans,
  onOpen,
  onDelete,
  onCreate,
}: {
  plans: CtjPlan[];
  onOpen: (id: string) => void;
  onDelete: (id: string) => void;
  onCreate: (plan: CtjPlan) => void;
}) {
  const { user } = useAuth();
  const [parallelFilter, setParallelFilter] = useState("Барлығы");
  const [subjectFilter, setSubjectFilter] = useState("Барлығы");
  const [showCreate, setShowCreate] = useState(false);

  const [newSubject, setNewSubject] = useState(subjects[0]);
  const [newGrade, setNewGrade] = useState("");
  const [newLanguage, setNewLanguage] = useState(LANGUAGES[0]);
  const [newAssessment, setNewAssessment] = useState(ASSESSMENT_TYPES[0]);
  const [newCurriculum, setNewCurriculum] = useState(CURRICULUM_TYPES[0]);

  const parallels = Array.from(new Set(plans.map((p) => parallelOf(p.grade)))).sort();

  const visiblePlans = plans.filter(
    (p) =>
      (parallelFilter === "Барлығы" || parallelOf(p.grade) === parallelFilter) &&
      (subjectFilter === "Барлығы" || p.subject === subjectFilter),
  );

  function handleCreate(e: React.FormEvent) {
    e.preventDefault();
    if (!newGrade.trim()) return;
    const plan = emptyCtjPlan(newSubject, newGrade.trim());
    plan.language = newLanguage;
    plan.assessmentType = newAssessment;
    plan.curriculum = newCurriculum;
    onCreate(plan);
    setNewGrade("");
    setShowCreate(false);
  }

  return (
    <div>
      <Card className="mb-6">
        <div className="mb-4 flex flex-wrap items-end justify-between gap-4">
          <div className="flex flex-wrap items-end gap-3">
            <Field className="!mb-0">
              Параллель
              <Select value={parallelFilter} onChange={(e) => setParallelFilter(e.target.value)} className="!w-auto">
                <option>Барлығы</option>
                {parallels.map((p) => (
                  <option key={p}>{p}</option>
                ))}
              </Select>
            </Field>
            <Field className="!mb-0">
              Пән
              <Select value={subjectFilter} onChange={(e) => setSubjectFilter(e.target.value)} className="!w-auto">
                <option>Барлығы</option>
                {subjects.map((s) => (
                  <option key={s}>{s}</option>
                ))}
              </Select>
            </Field>
          </div>
          <Button type="button" onClick={() => setShowCreate((v) => !v)}>
            <Plus size={15} /> Жаңа КТЖ
          </Button>
        </div>

        {showCreate && (
          <form
            onSubmit={handleCreate}
            className="grid gap-3 rounded-xl border border-violet-100 p-4 sm:grid-cols-5 sm:items-end dark:border-violet-900/40"
          >
            <Field className="!mb-0">
              Пән
              <Select value={newSubject} onChange={(e) => setNewSubject(e.target.value)}>
                {subjects.map((s) => (
                  <option key={s}>{s}</option>
                ))}
              </Select>
            </Field>
            <Field className="!mb-0">
              Сынып
              <TextInput placeholder="мысалы: 7А" value={newGrade} onChange={(e) => setNewGrade(e.target.value)} required />
            </Field>
            <Field className="!mb-0">
              Оқу тілі
              <Select value={newLanguage} onChange={(e) => setNewLanguage(e.target.value)}>
                {LANGUAGES.map((l) => (
                  <option key={l}>{l}</option>
                ))}
              </Select>
            </Field>
            <Field className="!mb-0">
              Бағалау түрі
              <Select value={newAssessment} onChange={(e) => setNewAssessment(e.target.value)}>
                {ASSESSMENT_TYPES.map((a) => (
                  <option key={a}>{a}</option>
                ))}
              </Select>
            </Field>
            <Field className="!mb-0">
              Оқу бағдарламасы
              <Select value={newCurriculum} onChange={(e) => setNewCurriculum(e.target.value)}>
                {CURRICULUM_TYPES.map((c) => (
                  <option key={c}>{c}</option>
                ))}
              </Select>
            </Field>
            <Button type="submit" className="sm:col-span-5 sm:w-auto sm:justify-self-start">
              Құру
            </Button>
          </form>
        )}
      </Card>

      <Card className="overflow-x-auto">
        <h2 className="mb-4 font-semibold text-slate-900 dark:text-white">Менің КТЖ-ларым</h2>
        <table className="w-full min-w-[820px] text-sm">
          <thead className="bg-violet-50 text-slate-600 dark:bg-violet-950/60 dark:text-slate-300">
            <tr>
              <th className="px-3 py-2 text-left font-medium">№</th>
              <th className="px-3 py-2 text-left font-medium">Сынып</th>
              <th className="px-3 py-2 text-left font-medium">Пән</th>
              <th className="px-3 py-2 text-left font-medium">Оқу тілі</th>
              <th className="px-3 py-2 text-left font-medium">Бағалау түрі</th>
              <th className="px-3 py-2 text-left font-medium">Оқу бағдарламасы</th>
              <th className="px-3 py-2 text-left font-medium">Жоспарланған сабақ саны</th>
              <th className="px-3 py-2 text-left font-medium">Іс-әрекет</th>
            </tr>
          </thead>
          <tbody>
            {visiblePlans.map((p, i) => (
              <tr key={p.id} className="border-t border-violet-50 dark:border-violet-900/30">
                <td className="px-3 py-2 text-slate-500 dark:text-slate-400">{i + 1}</td>
                <td className="px-3 py-2 font-medium text-slate-900 dark:text-white">{p.grade}</td>
                <td className="px-3 py-2">{p.subject}</td>
                <td className="px-3 py-2">
                  <span className="rounded bg-violet-50 px-2 py-0.5 text-xs font-medium text-violet-700 dark:bg-violet-900/40 dark:text-violet-200">
                    {p.language}
                  </span>
                </td>
                <td className="px-3 py-2 text-slate-600 dark:text-slate-300">{p.assessmentType}</td>
                <td className="px-3 py-2 text-slate-600 dark:text-slate-300">{p.curriculum}</td>
                <td className="px-3 py-2 text-slate-600 dark:text-slate-300">{p.rows.length}</td>
                <td className="px-3 py-2">
                  <div className="flex items-center gap-2">
                    <Button type="button" variant="ghost" className="!px-2 !py-1.5" onClick={() => onOpen(p.id)} aria-label="Ашу">
                      <ArrowRight size={15} />
                    </Button>
                    <button
                      type="button"
                      onClick={() => onDelete(p.id)}
                      className="rounded px-1.5 py-1 text-rose-500 hover:bg-rose-50 dark:hover:bg-rose-900/30"
                      aria-label="Жою"
                    >
                      <X size={14} />
                    </button>
                  </div>
                </td>
              </tr>
            ))}
            {visiblePlans.length === 0 && (
              <tr>
                <td colSpan={8} className="px-3 py-6 text-center text-slate-400 dark:text-slate-500">
                  Әзірге КТЖ жоқ. «Жаңа КТЖ» батырмасымен бастаңыз.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </Card>

      {!user && (
        <p className="mt-3 text-xs text-slate-400 dark:text-slate-500">
          Мұғалім аты-жөні жаңа сабақ жолдарында автоматты толтырылуы үшін жүйеге кіріңіз.
        </p>
      )}
    </div>
  );
}

// ---------- Егжей-тегжей беті: бір КТЖ-ның сабақтар кестесі ----------

function PlanDetailView({ plan, onChange, onBack }: { plan: CtjPlan; onChange: (plan: CtjPlan) => void; onBack: () => void }) {
  const { user } = useAuth();
  const [showGenerate, setShowGenerate] = useState(false);
  const [hoursPerWeek, setHoursPerWeek] = useState(2);
  const [topicsRaw, setTopicsRaw] = useState("");
  const [generating, setGenerating] = useState(false);
  const [generateError, setGenerateError] = useState("");

  const [saved, setSaved] = useState(true);
  const [importing, setImporting] = useState(false);
  const [importError, setImportError] = useState("");
  const [exportingDocx, setExportingDocx] = useState(false);
  const [exportingXlsx, setExportingXlsx] = useState(false);
  const [pushResult, setPushResult] = useState("");
  const fileInputRef = useRef<HTMLInputElement | null>(null);

  function updateRows(rows: CtjRow[]) {
    onChange({ ...plan, rows });
    setSaved(false);
  }

  function updateRow(id: string, patch: Partial<CtjRow>) {
    updateRows(plan.rows.map((r) => (r.id === id ? { ...r, ...patch } : r)));
  }

  function addRow() {
    updateRows([...plan.rows, emptyCtjRow(user?.name ?? "")]);
  }

  function removeRow(id: string) {
    updateRows(plan.rows.filter((r) => r.id !== id));
  }

  async function handleGenerate(e: React.FormEvent) {
    e.preventDefault();
    const topics = topicsRaw
      .split(",")
      .map((t) => t.trim())
      .filter(Boolean);
    setGenerating(true);
    setGenerateError("");
    try {
      const generated = await generateKtj(plan.subject, plan.grade, hoursPerWeek, topics);
      const newRows: CtjRow[] = generated.weeks.flatMap((week) =>
        week.lessons.map((lesson) => ({ ...emptyCtjRow(user?.name ?? ""), topic: lesson.topic })),
      );
      updateRows(newRows);
      setShowGenerate(false);
    } catch (err) {
      setGenerateError(err instanceof Error ? err.message : "КТЖ жасау мүмкін болмады.");
    } finally {
      setGenerating(false);
    }
  }

  function handleSave() {
    onChange(plan);
    setSaved(true);
  }

  async function handleImportFile(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    setImporting(true);
    setImportError("");
    try {
      const imported = await parseCtjFile(file);
      if (imported.length === 0) {
        setImportError("Файлдан жол таба алмадық — кестенің құрылымын тексеріп, қолмен толтырыңыз.");
      } else {
        updateRows([...plan.rows, ...imported]);
      }
    } catch (err) {
      setImportError(err instanceof Error ? err.message : "Файлды импорттау мүмкін болмады.");
    } finally {
      setImporting(false);
      if (fileInputRef.current) fileInputRef.current.value = "";
    }
  }

  async function handleExportDocx() {
    setExportingDocx(true);
    try {
      const { exportThematicToDocx } = await import("../lib/exportDocx");
      await exportThematicToDocx(plan.subject, plan.grade, plan.rows);
    } finally {
      setExportingDocx(false);
    }
  }

  async function handleExportXlsx() {
    setExportingXlsx(true);
    try {
      const { exportThematicToXlsx } = await import("../lib/exportXlsx");
      await exportThematicToXlsx(plan.subject, plan.grade, plan.rows);
    } finally {
      setExportingXlsx(false);
    }
  }

  function handlePushToCalendar() {
    const count = pushThematicToCalendar(plan.subject, plan.grade, plan.rows);
    setPushResult(
      count > 0
        ? `${count} сабақ күнтізбеге орналастырылды.`
        : "Күнтізбеге орналастыру үшін жолдарда «Сабақ күні» (кк.аа.жжжж) мен тақырып толтырылған болуы керек.",
    );
  }

  const cellInput =
    "w-full rounded border-none bg-transparent px-1.5 py-1 text-sm outline-none focus:bg-violet-50 focus:ring-1 focus:ring-violet-300 dark:focus:bg-violet-950/40";

  return (
    <div>
      <button
        type="button"
        onClick={onBack}
        className="mb-4 inline-flex items-center gap-1.5 text-sm font-medium text-violet-600 hover:underline dark:text-violet-300 print:hidden"
      >
        <ArrowLeft size={15} /> Менің КТЖ-ларыма оралу
      </button>

      <Card className="mb-6 print:hidden">
        <div className="mb-4 flex flex-wrap gap-2">
          <Button type="button" variant="ghost" onClick={() => setShowGenerate((v) => !v)}>
            <Sparkles size={15} /> ЖИ көмегімен толтыру
          </Button>
          <Button type="button" variant="ghost" onClick={addRow}>
            <Plus size={15} /> Жол қосу
          </Button>
          <Button type="button" variant="ghost" onClick={() => fileInputRef.current?.click()} disabled={importing}>
            <Upload size={15} /> {importing ? "Импорттауда..." : "Импорттау"}
          </Button>
          <input ref={fileInputRef} type="file" accept=".docx,.xlsx,.xls" className="hidden" onChange={handleImportFile} />
          <Button type="button" onClick={handleSave}>
            {saved ? "✓ Сақталды" : "Сақтау"}
          </Button>
        </div>

        {showGenerate && (
          <form
            onSubmit={handleGenerate}
            className="mb-2 grid gap-3 rounded-xl border border-violet-100 p-4 sm:grid-cols-[140px_1fr_auto] sm:items-end dark:border-violet-900/40"
          >
            <Field className="!mb-0">
              Апталық сағат
              <TextInput
                type="number"
                min={1}
                max={6}
                value={hoursPerWeek}
                onChange={(e) => setHoursPerWeek(Number(e.target.value))}
              />
            </Field>
            <Field className="!mb-0">
              Негізгі бөлімдер (үтірмен, бос қалдырсаңыз — автоматты ұсынылады)
              <TextInput
                placeholder="мысалы: Натурал сандар, Бөлшектер, Теңдеулер"
                value={topicsRaw}
                onChange={(e) => setTopicsRaw(e.target.value)}
              />
            </Field>
            <Button type="submit" disabled={generating}>
              {generating ? "Жасалуда..." : "Құру"}
            </Button>
            {generateError && <p className="text-sm text-rose-600 dark:text-rose-400 sm:col-span-3">{generateError}</p>}
            <p className="text-xs text-slate-500 dark:text-slate-400 sm:col-span-3">
              Назар аударыңыз: бұл қолданыстағы барлық жолдарды жаңа автоматты бөліністен алынған
              жолдармен алмастырады.
            </p>
          </form>
        )}
        {importError && <p className="text-sm text-rose-600 dark:text-rose-400">{importError}</p>}
      </Card>

      <Card className="print-card text-left">
        <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
          <h2 className="text-xl font-semibold text-slate-900 dark:text-white">
            {plan.subject} — {plan.grade} · {plan.rows.length} сабақ
          </h2>
          <div className="flex flex-wrap gap-2 print:hidden">
            <Button variant="ghost" type="button" onClick={handleExportXlsx} disabled={exportingXlsx || plan.rows.length === 0}>
              <FileSpreadsheet size={15} /> {exportingXlsx ? "Дайындалуда..." : "Excel"}
            </Button>
            <Button variant="ghost" type="button" onClick={handleExportDocx} disabled={exportingDocx || plan.rows.length === 0}>
              <FileText size={15} /> {exportingDocx ? "Дайындалуда..." : "Word"}
            </Button>
            <Button variant="ghost" type="button" onClick={() => window.print()}>
              <Printer size={15} /> PDF
            </Button>
            <Link
              to="/qmzh"
              className="inline-flex items-center gap-1.5 rounded-lg border border-violet-200 px-4 py-2.5 text-sm font-medium text-slate-700 hover:bg-violet-50 dark:border-violet-800 dark:text-slate-200 dark:hover:bg-violet-900/30"
            >
              <Download size={15} /> ҚМЖ үлгісін жасау
            </Link>
          </div>
        </div>

        <div className="overflow-x-auto rounded-lg border border-violet-100 dark:border-violet-900/50">
          <table className="w-full min-w-[1180px] text-sm">
            <thead className="bg-violet-50 text-slate-600 dark:bg-violet-950/60 dark:text-slate-300">
              <tr>
                <th rowSpan={2} className="border-b border-violet-100 px-2 py-2 text-left font-medium align-bottom dark:border-violet-900/40">
                  №
                </th>
                <th colSpan={6} className="border-b border-l border-violet-100 px-2 py-1.5 text-center font-medium dark:border-violet-900/40">
                  Сабақ туралы ақпарат
                </th>
                <th colSpan={2} className="border-b border-l border-violet-100 px-2 py-1.5 text-center font-medium dark:border-violet-900/40">
                  Үй тапсырмасы
                </th>
                <th rowSpan={2} className="border-b border-l border-violet-100 px-2 py-2 text-left font-medium align-bottom dark:border-violet-900/40">
                  Интерактивті сабақ
                </th>
                <th rowSpan={2} className="border-b border-l border-violet-100 px-2 py-2 print:hidden"></th>
              </tr>
              <tr>
                <th className="border-b border-l border-violet-100 px-2 py-1.5 text-left font-medium dark:border-violet-900/40">Сабақ күні</th>
                <th className="border-b border-l border-violet-100 px-2 py-1.5 text-left font-medium dark:border-violet-900/40">Мұғалім</th>
                <th className="border-b border-l border-violet-100 px-2 py-1.5 text-left font-medium dark:border-violet-900/40">Топтар</th>
                <th className="border-b border-l border-violet-100 px-2 py-1.5 text-left font-medium dark:border-violet-900/40">Тақырып</th>
                <th className="border-b border-l border-violet-100 px-2 py-1.5 text-left font-medium dark:border-violet-900/40">Сабақ түрі</th>
                <th className="border-b border-l border-violet-100 px-2 py-1.5 text-left font-medium dark:border-violet-900/40">Тақ. саны</th>
                <th className="border-b border-l border-violet-100 px-2 py-1.5 text-left font-medium dark:border-violet-900/40">Үй тапсырмасы</th>
                <th className="border-b border-l border-violet-100 px-2 py-1.5 text-left font-medium dark:border-violet-900/40">
                  Орындау уақыты (мин)
                </th>
              </tr>
            </thead>
            <tbody>
              {plan.rows.map((row, i) => (
                <tr key={row.id} className="border-t border-violet-50 align-top dark:border-violet-900/30">
                  <td className="px-2 py-1.5 text-slate-500 dark:text-slate-400">{i + 1}</td>
                  <td className="min-w-[130px] px-1 py-1">
                    <input
                      className={cellInput}
                      placeholder="кк.аа.жжжж"
                      value={row.date}
                      onChange={(e) => updateRow(row.id, { date: e.target.value })}
                    />
                    <input
                      className={cellInput}
                      placeholder="сс:мм"
                      value={row.time}
                      onChange={(e) => updateRow(row.id, { time: e.target.value })}
                    />
                  </td>
                  <td className="min-w-[150px] px-1 py-1">
                    <input className={cellInput} value={row.teacher} onChange={(e) => updateRow(row.id, { teacher: e.target.value })} />
                  </td>
                  <td className="min-w-[120px] px-1 py-1">
                    <input className={cellInput} value={row.groups} onChange={(e) => updateRow(row.id, { groups: e.target.value })} />
                  </td>
                  <td className="min-w-[220px] px-1 py-1">
                    <input className={cellInput} value={row.topic} onChange={(e) => updateRow(row.id, { topic: e.target.value })} />
                  </td>
                  <td className="min-w-[150px] px-1 py-1">
                    <select
                      className={cellInput}
                      value={row.lessonKind}
                      onChange={(e) => updateRow(row.id, { lessonKind: e.target.value })}
                    >
                      {LESSON_KINDS.map((k) => (
                        <option key={k}>{k}</option>
                      ))}
                    </select>
                  </td>
                  <td className="w-16 px-1 py-1">
                    <input
                      type="number"
                      min={0}
                      className={cellInput}
                      value={row.topicCount}
                      onChange={(e) => updateRow(row.id, { topicCount: Number(e.target.value) })}
                    />
                  </td>
                  <td className="min-w-[160px] px-1 py-1">
                    <input className={cellInput} value={row.homework} onChange={(e) => updateRow(row.id, { homework: e.target.value })} />
                  </td>
                  <td className="w-20 px-1 py-1">
                    <input
                      type="number"
                      min={0}
                      className={cellInput}
                      value={row.executionMinutes ?? ""}
                      onChange={(e) => updateRow(row.id, { executionMinutes: e.target.value ? Number(e.target.value) : null })}
                    />
                  </td>
                  <td className="px-1 py-1 text-center">
                    <input
                      type="checkbox"
                      className="h-4 w-4 accent-violet-600"
                      checked={row.interactive}
                      onChange={(e) => updateRow(row.id, { interactive: e.target.checked })}
                    />
                  </td>
                  <td className="px-1 py-1 text-center print:hidden">
                    <button
                      type="button"
                      onClick={() => removeRow(row.id)}
                      className="rounded px-1.5 py-0.5 text-rose-500 hover:bg-rose-50 dark:hover:bg-rose-900/30"
                      aria-label="Жолды жою"
                    >
                      <X size={14} />
                    </button>
                  </td>
                </tr>
              ))}
              {plan.rows.length === 0 && (
                <tr>
                  <td colSpan={10} className="px-3 py-6 text-center text-slate-400 dark:text-slate-500">
                    Әзірге жол жоқ. «ЖИ көмегімен толтыру», «Жол қосу» немесе импорттау арқылы бастаңыз.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>

        <div className="mt-4 flex flex-wrap items-center gap-3 print:hidden">
          <Button type="button" variant="ghost" onClick={handlePushToCalendar} disabled={plan.rows.length === 0}>
            📅 Күнтізбеге жүктеу
          </Button>
          <Link to="/schedule" className="text-sm text-violet-600 hover:underline dark:text-violet-300">
            Сабақ кестесін ашу →
          </Link>
        </div>
        {pushResult && <p className="mt-2 text-sm text-emerald-700 print:hidden dark:text-emerald-400">{pushResult}</p>}
      </Card>
    </div>
  );
}

export default function KtjPage() {
  const [plans, setPlans] = useState<CtjPlan[]>(() => getCtjPlans());
  const [activePlanId, setActivePlanId] = useState<string | null>(null);

  const activePlan = plans.find((p) => p.id === activePlanId) ?? null;

  function handleCreate(plan: CtjPlan) {
    setPlans(upsertCtjPlan(plan));
    setActivePlanId(plan.id);
  }

  function handleDelete(id: string) {
    setPlans(removeCtjPlan(id));
    if (activePlanId === id) setActivePlanId(null);
  }

  function handleChangePlan(plan: CtjPlan) {
    setPlans(upsertCtjPlan(plan));
  }

  return (
    <div className="mx-auto max-w-7xl px-4 py-10 sm:px-6">
      <Badge>КТЖ · Күнтізбелік-тақырыптық жоспарлау</Badge>
      <h1 className="mt-3 mb-2 text-3xl font-semibold text-slate-900 dark:text-white">
        Күнтізбелік-тақырыптық жоспар
      </h1>
      <p className="mb-6 text-slate-600 dark:text-slate-300">
        bilimclass.kz-тегі «Менің КТЖ-ларым» құрылымына сай: әр сынып/пән жұбы үшін жеке жоспар, ал әр
        жоспар ішінде — сабақ күні, мұғалім, топтар, тақырып, сабақ түрі мен үй тапсырмасы бар толық
        кесте.
      </p>

      {activePlan ? (
        <PlanDetailView plan={activePlan} onChange={handleChangePlan} onBack={() => setActivePlanId(null)} />
      ) : (
        <PlanListView plans={plans} onOpen={setActivePlanId} onDelete={handleDelete} onCreate={handleCreate} />
      )}
    </div>
  );
}
