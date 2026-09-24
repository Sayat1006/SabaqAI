import { ArrowDown, ArrowUp, Plus, Save, Trash2, X } from "lucide-react";
import { useState } from "react";
import { TASK_KINDS, type LessonPlan, type QmzhActivityRow, type QmzhStage, type QmzhTask } from "../lib/generators";
import { tr } from "../i18n";

// ҚМЖ өңдегіші: жоспардың көшірмесімен (draft) жұмыс істейді, «Сақтау» басылғанда ғана
// сыртқа береді. Тізім өрістері «әр жол — бір пункт» мәтіні ретінде өңделеді.

const field = "w-full rounded-xl border border-slate-200 bg-slate-50 px-3 py-2.5 text-sm outline-none focus:border-violet-500";
const lines = (t: string) => t.split("\n").map((l) => l.trim()).filter(Boolean);
const cells = (l: string) => l.split("|").map((c) => c.trim());

function Label({ title, hint, children }: { title: string; hint?: string; children: React.ReactNode }) {
  return (
    <label className="block">
      <span className="mb-1.5 block text-[12.5px] font-semibold text-slate-500">
        {title}
        {hint && <span className="font-normal"> — {hint}</span>}
      </span>
      {children}
    </label>
  );
}

function Text({ title, hint, value, onChange, rows = 1 }: { title: string; hint?: string; value: string; onChange: (v: string) => void; rows?: number }) {
  return (
    <Label title={title} hint={hint}>
      {rows > 1 ? (
        <textarea value={value} rows={rows} onChange={(e) => onChange(e.target.value)} className={`${field} resize-y`} />
      ) : (
        <input value={value} onChange={(e) => onChange(e.target.value)} className={field} />
      )}
    </Label>
  );
}

/** Көпжолды өріс: мәтінді өзі сақтайды (курсор секірмеуі үшін), өзгергенде parse арқылы жібереді. */
function Lines<T>({ title, hint = tr("әр жол — бір пункт"), initial, parse, onChange, rows = 3 }: { title: string; hint?: string; initial: string; parse: (t: string) => T; onChange: (v: T) => void; rows?: number }) {
  const [text, setText] = useState(initial);
  return (
    <Label title={title} hint={hint}>
      <textarea
        value={text}
        rows={rows}
        onChange={(e) => {
          setText(e.target.value);
          onChange(parse(e.target.value));
        }}
        className={`${field} resize-y`}
      />
    </Label>
  );
}

function Section({ title, children, open = false }: { title: string; children: React.ReactNode; open?: boolean }) {
  return (
    <details open={open} className="group rounded-2xl border border-slate-200 bg-surface">
      <summary className="cursor-pointer select-none px-4 py-3 font-semibold marker:text-violet-600">{title}</summary>
      <div className="flex flex-col gap-3 border-t border-slate-100 p-4">{children}</div>
    </details>
  );
}

const iconBtn = "rounded-lg border border-slate-200 p-1.5 hover:border-violet-500 disabled:opacity-40";

function move<T>(list: T[], i: number, dir: -1 | 1): T[] {
  const j = i + dir;
  if (j < 0 || j >= list.length) return list;
  const next = [...list];
  [next[i], next[j]] = [next[j], next[i]];
  return next;
}

const emptyRow = (): QmzhActivityRow => ({ teacherAction: [], studentAction: [], assessmentType: "", assessmentDetail: "", resources: "" });
const emptyTask = (): QmzhTask => ({
  title: tr("Жаңа тапсырма"),
  kind: tr("Жеке жұмыс"),
  method: "",
  level: "A",
  time: tr("5 мин"),
  condition: [],
  tableTitle: "",
  tableHeaders: [],
  tableRows: [],
  steps: [],
  criteria: [],
  differentiation: "",
  expectedResultRows: [],
  expectedConclusion: "",
});

export function QmzhEditor({ plan, saving, onSave, onCancel }: { plan: LessonPlan; saving: boolean; onSave: (p: LessonPlan) => void; onCancel: () => void }) {
  const [d, setD] = useState<LessonPlan>(() => structuredClone(plan));
  // Кезең/тапсырма жылжығанда не өшкенде көпжолды өрістерді қайта құру үшін.
  const [version, setVersion] = useState(0);
  const set = (patch: Partial<LessonPlan>) => setD((p) => ({ ...p, ...patch }));
  const setStage = (si: number, patch: Partial<QmzhStage>) => setD((p) => ({ ...p, stages: p.stages.map((s, i) => (i === si ? { ...s, ...patch } : s)) }));
  const setRow = (si: number, ri: number, patch: Partial<QmzhActivityRow>) =>
    setStage(si, { rows: d.stages[si].rows.map((r, i) => (i === ri ? { ...r, ...patch } : r)) });
  const setTask = (ti: number, patch: Partial<QmzhTask>) => setD((p) => ({ ...p, tasks: p.tasks.map((t, i) => (i === ti ? { ...t, ...patch } : t)) }));
  const structural = (fn: (p: LessonPlan) => LessonPlan) => {
    setD(fn);
    setVersion((v) => v + 1);
  };
  const planning = d.planning ?? { differentiation: "", assessment: "", safety: "" };

  return (
    <div className="flex flex-col gap-3">
      <div className="sticky top-20 z-10 flex flex-wrap items-center justify-between gap-2 rounded-2xl border border-violet-200 bg-violet-100/90 px-4 py-3 backdrop-blur">
        <span className="text-sm font-semibold text-violet-800">{tr("Өңдеу режимі — өзгерістерді «Сақтау» арқылы сақтаңыз")}</span>
        <div className="flex gap-2">
          <button type="button" onClick={onCancel} className="inline-flex items-center gap-1.5 rounded-[10px] border border-slate-300 bg-surface px-3 py-2 text-sm font-semibold">
            <X size={15} /> {tr("Болдырмау")}
          </button>
          <button type="button" onClick={() => onSave(d)} disabled={saving} className="inline-flex items-center gap-1.5 rounded-[10px] bg-violet-600 px-3.5 py-2 text-sm font-semibold text-white disabled:opacity-60">
            <Save size={15} /> {saving ? tr("Сақталуда...") : tr("Сақтау")}
          </button>
        </div>
      </div>

      <Section title={tr("Жалпы мәліметтер")} open>
        <div className="grid gap-3 sm:grid-cols-2">
          <Text title={tr("Бөлім")} value={d.section} onChange={(section) => set({ section })} />
          <Text title={tr("Сабақтың тақырыбы")} value={d.topic} onChange={(topic) => set({ topic })} />
          <Text title={tr("Педагогтің аты-жөні")} value={d.teacherName} onChange={(teacherName) => set({ teacherName })} />
          <Text title={tr("Күні")} value={d.date} onChange={(date) => set({ date })} />
          <Text title={tr("Оқу мақсатының коды")} value={d.objectiveCode} onChange={(objectiveCode) => set({ objectiveCode })} />
        </div>
        <Text title={tr("Оқыту мақсаты")} value={d.objectiveText} onChange={(objectiveText) => set({ objectiveText })} rows={2} />
        <Lines title={tr("Сабақтың мақсаты")} initial={d.goals.join("\n")} parse={lines} onChange={(goals) => set({ goals })} />
        <Text title={tr("Құндылықтарды дарыту")} value={d.valuesText} onChange={(valuesText) => set({ valuesText })} rows={2} />
        <Lines
          title={tr("Пәндік лексика")}
          hint={tr("әр жол: термин — анықтамасы")}
          initial={(d.vocabulary ?? []).map((v) => `${v.term} — ${v.definition}`).join("\n")}
          parse={(t) =>
            lines(t).map((l) => {
              const [term, ...rest] = l.split(/\s+[—–-]\s+/);
              return { term: term.trim(), definition: rest.join(" — ").trim() };
            })
          }
          onChange={(vocabulary) => set({ vocabulary })}
        />
      </Section>

      <Section title={tr("Сабақтың барысы (кезеңдер)")}>
        {d.stages.map((stage, si) => (
          <div key={`${si}-${version}`} className="flex flex-col gap-3 rounded-xl border border-slate-200 p-3">
            <div className="grid gap-3 sm:grid-cols-[1fr_140px]">
              <Text title={tr("Кезең")} value={stage.name} onChange={(name) => setStage(si, { name })} />
              <Text title={tr("Уақыты")} value={stage.timeRange} onChange={(timeRange) => setStage(si, { timeRange })} />
            </div>
            {stage.rows.map((row, ri) => (
              <div key={ri} className="flex flex-col gap-2.5 rounded-lg bg-slate-50 p-3">
                <div className="flex items-center justify-between text-xs font-semibold text-slate-500">
                  {tr("{n}-жол", { n: ri + 1 })}
                  <button
                    type="button"
                    onClick={() => structural((p) => ({ ...p, stages: p.stages.map((s, i) => (i === si ? { ...s, rows: s.rows.filter((_, j) => j !== ri) } : s)) }))}
                    disabled={stage.rows.length <= 1}
                    aria-label={tr("Жолды өшіру")}
                    className={iconBtn}
                  >
                    <Trash2 size={14} />
                  </button>
                </div>
                <div className="grid gap-2.5 sm:grid-cols-2">
                  <Lines title={tr("Педагогтің әрекеті")} initial={row.teacherAction.join("\n")} parse={lines} onChange={(teacherAction) => setRow(si, ri, { teacherAction })} />
                  <Lines title={tr("Оқушының әрекеті")} initial={row.studentAction.join("\n")} parse={lines} onChange={(studentAction) => setRow(si, ri, { studentAction })} />
                  <Text title={tr("Бағалау түрі")} value={row.assessmentType} onChange={(assessmentType) => setRow(si, ri, { assessmentType })} />
                  <Text title={tr("Бағалау сипаттамасы")} value={row.assessmentDetail} onChange={(assessmentDetail) => setRow(si, ri, { assessmentDetail })} />
                </div>
                <Text title={tr("Ресурстар")} value={row.resources} onChange={(resources) => setRow(si, ri, { resources })} />
              </div>
            ))}
            <button
              type="button"
              onClick={() => structural((p) => ({ ...p, stages: p.stages.map((s, i) => (i === si ? { ...s, rows: [...s.rows, emptyRow()] } : s)) }))}
              className="inline-flex w-fit items-center gap-1.5 rounded-[10px] border border-slate-200 px-3 py-1.5 text-[13px] font-semibold hover:border-violet-500"
            >
              <Plus size={14} /> {tr("Жол қосу")}
            </button>
          </div>
        ))}
      </Section>

      <Section title={tr("Тапсырмалар ({n})", { n: d.tasks.length })}>
        {d.tasks.map((task, ti) => (
          <div key={`${ti}-${version}`} className="flex flex-col gap-3 rounded-xl border border-slate-200 p-3">
            <div className="flex items-center justify-between gap-2">
              <span className="font-semibold">{tr("{n}-тапсырма", { n: ti + 1 })}</span>
              <div className="flex gap-1.5">
                <button type="button" onClick={() => structural((p) => ({ ...p, tasks: move(p.tasks, ti, -1) }))} disabled={ti === 0} aria-label={tr("Жоғары")} className={iconBtn}>
                  <ArrowUp size={14} />
                </button>
                <button type="button" onClick={() => structural((p) => ({ ...p, tasks: move(p.tasks, ti, 1) }))} disabled={ti === d.tasks.length - 1} aria-label={tr("Төмен")} className={iconBtn}>
                  <ArrowDown size={14} />
                </button>
                <button
                  type="button"
                  onClick={() => window.confirm(tr("{n}-тапсырманы өшіру керек пе?", { n: ti + 1 })) && structural((p) => ({ ...p, tasks: p.tasks.filter((_, i) => i !== ti) }))}
                  aria-label={tr("Тапсырманы өшіру")}
                  className={`${iconBtn} hover:border-rose-400 hover:text-rose-700`}
                >
                  <Trash2 size={14} />
                </button>
              </div>
            </div>
            <Text title={tr("Атауы")} value={task.title} onChange={(title) => setTask(ti, { title })} />
            <div className="grid gap-3 sm:grid-cols-4">
              <Label title={tr("Жұмыс түрі")}>
                <select value={task.kind ?? ""} onChange={(e) => setTask(ti, { kind: e.target.value })} className={field}>
                  {[...new Set([task.kind ?? "", ...TASK_KINDS])].filter(Boolean).map((k) => (
                    <option key={k}>{k}</option>
                  ))}
                </select>
              </Label>
              <Text title={tr("Әдіс-тәсіл")} value={task.method ?? ""} onChange={(method) => setTask(ti, { method })} />
              <Label title={tr("Деңгейі")}>
                <select value={task.level ?? "A"} onChange={(e) => setTask(ti, { level: e.target.value as QmzhTask["level"] })} className={field}>
                  <option value="A">{tr("A — білу/түсіну")}</option>
                  <option value="B">{tr("B — қолдану")}</option>
                  <option value="C">{tr("C — жоғары деңгей")}</option>
                </select>
              </Label>
              <Text title={tr("Уақыты")} value={task.time ?? ""} onChange={(time) => setTask(ti, { time })} />
            </div>
            <Lines title={tr("Шарты")} initial={task.condition.join("\n")} parse={lines} onChange={(condition) => setTask(ti, { condition })} />
            <Text title={tr("Кесте атауы")} value={task.tableTitle} onChange={(tableTitle) => setTask(ti, { tableTitle })} />
            <Lines title={tr("Кесте бағандары")} hint={tr("| арқылы бөліңіз; кесте керек болмаса, бос қалдырыңыз")} rows={1} initial={task.tableHeaders.join(" | ")} parse={(t) => cells(t.replace(/\n/g, " ")).filter(Boolean)} onChange={(tableHeaders) => setTask(ti, { tableHeaders })} />
            <Lines title={tr("Кесте жолдары")} hint={tr("әр жол — кестенің бір жолы, ұяшықтар | арқылы")} initial={task.tableRows.map((r) => r.join(" | ")).join("\n")} parse={(t) => lines(t).map(cells)} onChange={(tableRows) => setTask(ti, { tableRows })} />
            <Lines title={tr("Орындау қадамдары")} initial={task.steps.join("\n")} parse={lines} onChange={(steps) => setTask(ti, { steps })} />
            <Lines
              title={tr("Бағалау критерийлері")}
              hint={tr("әр жол: Критерий: дескриптор 1; дескриптор 2")}
              initial={task.criteria.map((c) => `${c.criterion}: ${c.descriptors.join("; ")}`).join("\n")}
              parse={(t) =>
                lines(t).map((l) => {
                  const at = l.indexOf(":");
                  const criterion = (at > 0 ? l.slice(0, at) : l).trim();
                  const descriptors = (at > 0 ? l.slice(at + 1) : "").split(";").map((x) => x.trim()).filter(Boolean);
                  return { criterion, descriptors: descriptors.length ? descriptors : [criterion] };
                })
              }
              onChange={(criteria) => setTask(ti, { criteria })}
            />
            <Text title={tr("Саралау")} value={task.differentiation} onChange={(differentiation) => setTask(ti, { differentiation })} rows={2} />
            <Lines title={tr("Күтілетін нәтиже кестесі")} hint={tr("кесте жолдары, ұяшықтар | арқылы")} initial={task.expectedResultRows.map((r) => r.join(" | ")).join("\n")} parse={(t) => lines(t).map(cells)} onChange={(expectedResultRows) => setTask(ti, { expectedResultRows })} />
            <Text title={tr("Күтілетін нәтиже / жауап")} value={task.expectedConclusion} onChange={(expectedConclusion) => setTask(ti, { expectedConclusion })} rows={2} />
          </div>
        ))}
        <button
          type="button"
          onClick={() => structural((p) => ({ ...p, tasks: [...p.tasks, emptyTask()] }))}
          className="inline-flex w-fit items-center gap-1.5 rounded-[10px] border border-slate-200 px-3 py-2 text-[13px] font-semibold hover:border-violet-500"
        >
          <Plus size={14} /> {tr("Тапсырма қосу")}
        </button>
      </Section>

      <Section title={tr("Саралау, бағалау, қауіпсіздік · Рефлексия · Үй тапсырмасы")}>
        <Text title={tr("Саралау")} value={planning.differentiation} onChange={(v) => set({ planning: { ...planning, differentiation: v } })} rows={2} />
        <Text title={tr("Бағалау")} value={planning.assessment} onChange={(v) => set({ planning: { ...planning, assessment: v } })} rows={2} />
        <Text title={tr("Денсаулық және қауіпсіздік")} value={planning.safety} onChange={(v) => set({ planning: { ...planning, safety: v } })} rows={2} />
        <Lines title={tr("Рефлексия сұрақтары")} initial={(d.reflection ?? []).join("\n")} parse={lines} onChange={(reflection) => set({ reflection })} />
        <Text title={tr("Үй тапсырмасы")} value={d.homework ?? ""} onChange={(homework) => set({ homework })} rows={2} />
      </Section>
    </div>
  );
}
