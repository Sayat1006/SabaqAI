import { ExternalLink, Link2, Plus, Trash2 } from "lucide-react";
import { useState } from "react";
import type { LessonPlan, QmzhTask } from "../lib/generators";
import { customResource, platformKind, platformLabel, type QmzhResource, safeUrl } from "../lib/resources";
import { qmzhLabels } from "../lib/docLabels";
import type { Lang } from "../lib/lang";
import { levelBadge, levelLabel } from "../lib/studio";

const th = "px-3 py-2 text-left font-medium";
const td = "px-3 py-2 text-slate-700";

function ActionList({ items }: { items: string[] }) {
  return (
    <ol className="list-decimal space-y-1 pl-4">
      {items.map((t, i) => (
        <li key={i}>{t}</li>
      ))}
    </ol>
  );
}

function DataTable({ headers, rows }: { headers: string[]; rows: string[][] }) {
  return (
    <div className="mb-4 overflow-x-auto rounded-lg border border-violet-100">
      <table className="w-full text-sm">
        <thead className="bg-violet-50 text-slate-600">
          <tr>
            {headers.map((h, i) => (
              <th key={i} className={th}>
                {h}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {rows.map((row, ri) => (
            <tr key={ri} className="border-t border-violet-50">
              {headers.map((_, ci) => (
                <td key={ci} className={`${td} h-9`}>
                  {row[ci] || " "}
                </td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

export function TaskBlock({ task, index, lang }: { task: QmzhTask; index: number; lang?: Lang }) {
  const L = qmzhLabels(lang);
  const hasTable = task.tableHeaders.length > 0 && task.tableRows.length > 0;
  const hasResult = task.tableHeaders.length > 0 && task.expectedResultRows.length > 0;
  return (
    <div className="mt-8 border-t-2 border-violet-200 pt-6 print:break-inside-avoid">
      <div className="mb-3 flex flex-wrap items-start justify-between gap-3">
        <h3 className="text-xl font-semibold text-slate-900">
          {L.taskRe.test(task.title) ? task.title : `${L.taskN(index + 1)}. ${task.title}`}
        </h3>
        <div className="flex flex-wrap gap-1.5 text-xs font-semibold">
          {task.kind && <span className="rounded-full bg-violet-100 px-2.5 py-1 text-violet-700">{task.kind}</span>}
          {task.method && <span className="rounded-full bg-slate-100 px-2.5 py-1 text-slate-700">{L.method}: {task.method}</span>}
          {task.level && (
            <span title={levelLabel(task.level)} className={`rounded-full px-2.5 py-1 ${levelBadge(task.level)}`}>
              {L.level(task.level)}
            </span>
          )}
          {task.time && <span className="rounded-full bg-slate-100 px-2.5 py-1 text-slate-700">⏱ {task.time}</span>}
        </div>
      </div>

      <p className="mb-1 font-semibold text-violet-700">{L.condition}:</p>
      <div className="mb-4 space-y-1 text-sm text-slate-700">
        {task.condition.map((c, i) => (
          <p key={i}>{c}</p>
        ))}
      </div>

      {hasTable && (
        <>
          <p className="mb-1 text-xs font-semibold uppercase tracking-wide text-slate-500">{task.tableTitle}</p>
          <DataTable headers={task.tableHeaders} rows={task.tableRows} />
        </>
      )}

      {task.steps.length > 0 && (
        <>
          <p className="mb-1 font-semibold text-violet-700">{L.steps}:</p>
          <div className="mb-4 text-sm text-slate-700">
            <ActionList items={task.steps} />
          </div>
        </>
      )}

      <p className="mb-1 font-semibold text-violet-700">{L.criteriaTitle}</p>
      <div className="mb-4 overflow-x-auto rounded-lg border border-violet-100">
        <table className="w-full text-sm">
          <thead className="bg-violet-50 text-slate-600">
            <tr>
              <th className={th}>{L.criterion}</th>
              <th className={th}>{L.descriptors}</th>
              <th className={`w-16 ${th}`}>{L.points}</th>
            </tr>
          </thead>
          <tbody>
            {task.criteria.map((c, ci) =>
              c.descriptors.map((d, di) => (
                <tr key={`${ci}-${di}`} className="border-t border-violet-50">
                  {di === 0 && (
                    <td className="px-3 py-2 align-top text-slate-800" rowSpan={c.descriptors.length}>
                      {c.criterion}
                    </td>
                  )}
                  <td className={td}>{d}</td>
                  <td className="px-3 py-2 text-slate-400">1</td>
                </tr>
              )),
            )}
          </tbody>
        </table>
      </div>

      {task.differentiation && (
        <>
          <p className="mb-1 font-semibold text-violet-700">{L.differentiation}</p>
          <p className="mb-4 text-sm text-slate-700">{task.differentiation}</p>
        </>
      )}

      <p className="mb-1 font-semibold text-violet-700">{L.expected}</p>
      {hasResult && <DataTable headers={task.tableHeaders} rows={task.expectedResultRows} />}
      <p className="text-sm text-slate-700">{task.expectedConclusion}</p>
    </div>
  );
}

/** Пәндік терминдер кестесі. */
export function VocabularyTable({ items, lang }: { items: NonNullable<LessonPlan["vocabulary"]>; lang?: Lang }) {
  if (!items.length) return null;
  const L = qmzhLabels(lang);
  return (
    <div className="mb-8">
      <h3 className="mb-2 text-lg font-bold">{L.vocabulary}</h3>
      <DataTable headers={[L.term, L.definition]} rows={items.map((v) => [v.term, v.definition])} />
    </div>
  );
}

/** Ресми үлгідегі қорытынды кесте: саралау, бағалау, денсаулық және қауіпсіздік. */
export function PlanningTable({ planning, lang }: { planning: NonNullable<LessonPlan["planning"]>; lang?: Lang }) {
  const L = qmzhLabels(lang);
  return (
    <div className="mt-8">
      <div className="overflow-x-auto rounded-lg border border-violet-100">
        <table className="w-full text-sm">
          <thead className="bg-violet-50 text-slate-600">
            <tr>
              <th className={th}>{L.planDiff}</th>
              <th className={th}>{L.planAssess}</th>
              <th className={th}>{L.planSafety}</th>
            </tr>
          </thead>
          <tbody>
            <tr className="border-t border-violet-50 align-top">
              <td className={td}>{planning.differentiation}</td>
              <td className={td}>{planning.assessment}</td>
              <td className={td}>{planning.safety}</td>
            </tr>
          </tbody>
        </table>
      </div>
    </div>
  );
}

/** Ресурстар мен сілтемелер: AI ұсынған сенімді платформалар + мұғалім қосқан сілтемелер. */
export function ResourcesSection({
  resources,
  onChange,
  saving,
  lang,
}: {
  resources: QmzhResource[];
  onChange?: (next: QmzhResource[]) => void;
  saving?: boolean;
  lang?: Lang;
}) {
  const L = qmzhLabels(lang);
  const [title, setTitle] = useState("");
  const [url, setUrl] = useState("");
  const [error, setError] = useState("");

  function add(e: React.FormEvent) {
    e.preventDefault();
    const r = customResource(title, url);
    if (!r) {
      setError("Сілтемені дұрыс жазыңыз (мыс.: https://bilimland.kz/...).");
      return;
    }
    setError("");
    setTitle("");
    setUrl("");
    onChange?.([...resources, r]);
  }

  return (
    <div className="mt-8">
      <h3 className="mb-1 text-lg font-bold">{L.resourcesTitle}</h3>
      <p className="mb-3 text-[12.5px] text-slate-500 print:hidden">
        Сілтемелер сенімді платформалардағы іздеу беттерін ашады — сабаққа сай материалды таңдап алыңыз. Өз сілтемеңізді де қоса аласыз.
      </p>
      {resources.length > 0 ? (
        <div className="overflow-x-auto rounded-lg border border-violet-100">
          <table className="w-full text-sm">
            <thead className="bg-violet-50 text-slate-600">
              <tr>
                <th className={`w-8 ${th}`}>№</th>
                <th className={th}>{L.resource}</th>
                <th className={th}>{L.platform}</th>
                <th className={th}>{L.usage}</th>
                {onChange && <th className="w-10 print:hidden" />}
              </tr>
            </thead>
            <tbody>
              {resources.map((r, i) => (
                <tr key={i} className="border-t border-violet-50 align-top">
                  <td className="px-3 py-2 text-slate-500">{i + 1}</td>
                  <td className="px-3 py-2">
                    <a href={safeUrl(r.url)} target="_blank" rel="noopener noreferrer" className="inline-flex items-start gap-1 font-semibold text-violet-700 hover:underline">
                      {r.title}
                      <ExternalLink size={13} className="mt-1 shrink-0 print:hidden" />
                    </a>
                    <div className="hidden break-all text-[11px] text-slate-500 print:block">{r.url}</div>
                  </td>
                  <td className="px-3 py-2 text-slate-600">
                    {platformLabel(r.platform)}
                    <div className="text-xs text-slate-500">{platformKind(r.platform)}</div>
                  </td>
                  <td className={td}>{r.note || "—"}</td>
                  {onChange && (
                    <td className="px-2 py-2 print:hidden">
                      <button
                        type="button"
                        onClick={() => onChange(resources.filter((_, j) => j !== i))}
                        aria-label={`Өшіру: ${r.title}`}
                        className="rounded-lg p-1.5 text-slate-500 hover:bg-rose-50 hover:text-rose-700"
                      >
                        <Trash2 size={14} />
                      </button>
                    </td>
                  )}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      ) : (
        <p className="text-sm text-slate-500">Ресурстар әлі қосылмаған.</p>
      )}

      {onChange && (
        <form onSubmit={add} className="mt-3 flex flex-wrap gap-2 print:hidden">
          <input
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            maxLength={200}
            placeholder="Атауы (мыс.: BilimLand видеосабағы)"
            className="min-w-0 flex-[1_1_180px] rounded-xl border border-slate-200 bg-slate-50 px-3 py-2.5 text-sm outline-none focus:border-violet-500"
          />
          <input
            value={url}
            onChange={(e) => setUrl(e.target.value)}
            maxLength={1000}
            inputMode="url"
            placeholder="https://..."
            aria-label="Сілтеме"
            className="min-w-0 flex-[2_1_220px] rounded-xl border border-slate-200 bg-slate-50 px-3 py-2.5 text-sm outline-none focus:border-violet-500"
          />
          <button type="submit" disabled={saving} className="inline-flex items-center gap-1.5 rounded-xl bg-violet-600 px-3.5 py-2.5 text-sm font-semibold text-white disabled:opacity-60">
            <Plus size={15} /> <Link2 size={14} /> Сілтеме қосу
          </button>
          {error && <p className="w-full text-sm text-rose-700">{error}</p>}
        </form>
      )}
    </div>
  );
}
