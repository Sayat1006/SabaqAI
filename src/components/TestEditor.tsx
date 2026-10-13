import { ArrowDown, ArrowUp, Check, Plus, Save, Trash2, X } from "lucide-react";
import { useState } from "react";
import { tr } from "../i18n";
import type { TestLevel, TestQuestion } from "../lib/projects";

const LEVELS: TestLevel[] = ["A", "B", "C"];
const letter = (i: number) => String.fromCharCode(65 + i);
const field = "w-full rounded-lg border border-slate-200 bg-slate-50 px-3 py-2 text-sm outline-none focus:border-violet-500";

const blankQuestion = (): TestQuestion => ({ question: "", options: ["", "", "", ""], correctIndex: 0, explanation: "", level: "A" });

/** Сұрақтың толтырылмаған жері (жоқ болса — бос жол). */
function problem(q: TestQuestion): string {
  if (!q.question.trim()) return tr("Сұрақ мәтінін жазыңыз.");
  const filled = q.options.filter((o) => o.trim()).length;
  if (filled < 2) return tr("Кемінде 2 жауап нұсқасын жазыңыз.");
  if (!q.options[q.correctIndex]?.trim()) return tr("Дұрыс жауапты белгілеңіз.");
  return "";
}

/** Бос нұсқаларды алып тастап, дұрыс жауаптың орнын сақтайды. */
function clean(q: TestQuestion): TestQuestion {
  const kept = q.options.map((o, i) => ({ o: o.trim(), i })).filter((x) => x.o);
  return {
    ...q,
    question: q.question.trim(),
    options: kept.map((x) => x.o),
    correctIndex: Math.max(0, kept.findIndex((x) => x.i === q.correctIndex)),
    explanation: q.explanation.trim(),
  };
}

/**
 * Тест сұрақтарын қолмен жазу және түзету: мұғалімнің өз сұрақтары, файлдан алынғандарды
 * тексеру не AI жасаған тестке сұрақ қосу.
 */
export function TestEditor({
  initial,
  title,
  hint,
  saving,
  onSave,
  onCancel,
}: {
  initial: TestQuestion[];
  title: string;
  hint?: string;
  saving: boolean;
  onSave: (questions: TestQuestion[]) => void;
  onCancel: () => void;
}) {
  const [items, setItems] = useState<TestQuestion[]>(() => (initial.length ? initial.map((q) => ({ ...q, options: [...q.options] })) : [blankQuestion()]));
  const [error, setError] = useState("");
  const [tried, setTried] = useState(false);

  const patch = (i: number, p: Partial<TestQuestion>) => setItems((list) => list.map((q, j) => (j === i ? { ...q, ...p } : q)));
  const setOption = (i: number, k: number, v: string) => setItems((list) => list.map((q, j) => (j === i ? { ...q, options: q.options.map((o, m) => (m === k ? v : o)) } : q)));
  const addOption = (i: number) => setItems((list) => list.map((q, j) => (j === i && q.options.length < 6 ? { ...q, options: [...q.options, ""] } : q)));
  const removeOption = (i: number, k: number) =>
    setItems((list) =>
      list.map((q, j) => {
        if (j !== i || q.options.length <= 2) return q;
        const correctIndex = q.correctIndex === k ? 0 : q.correctIndex > k ? q.correctIndex - 1 : q.correctIndex;
        return { ...q, options: q.options.filter((_, m) => m !== k), correctIndex };
      }),
    );
  const move = (i: number, d: -1 | 1) =>
    setItems((list) => {
      const j = i + d;
      if (j < 0 || j >= list.length) return list;
      const next = [...list];
      [next[i], next[j]] = [next[j], next[i]];
      return next;
    });
  const remove = (i: number) => setItems((list) => (list.length > 1 ? list.filter((_, j) => j !== i) : [blankQuestion()]));

  function save() {
    setTried(true);
    const bad = items.findIndex((q) => problem(q));
    if (bad >= 0) {
      setError(tr("{n}-сұрақ: {msg}", { n: bad + 1, msg: problem(items[bad]) }));
      document.getElementById(`q-edit-${bad}`)?.scrollIntoView({ behavior: "smooth", block: "center" });
      return;
    }
    setError("");
    onSave(items.map(clean));
  }

  return (
    <div className="rounded-[22px] border border-slate-200 bg-surface p-5 sm:p-7">
      <div className="mb-1 flex flex-wrap items-center justify-between gap-3">
        <h2 className="text-xl font-bold">{title}</h2>
        <span className="rounded-full bg-violet-100 px-3 py-1 text-[13px] font-semibold text-violet-700">{tr("{n} сұрақ", { n: items.length })}</span>
      </div>
      {hint && <p className="mb-4 text-[13.5px] text-slate-500">{hint}</p>}

      <ol className="flex flex-col gap-4">
        {items.map((q, i) => {
          const msg = tried ? problem(q) : "";
          return (
            <li key={i} id={`q-edit-${i}`} className={`rounded-[16px] border p-4 ${msg ? "border-rose-300 bg-rose-50/40" : "border-slate-200 bg-slate-50/60"}`}>
              <div className="mb-2 flex items-center gap-2">
                <span className="text-sm font-bold">{i + 1}.</span>
                <div className="flex gap-1" role="group" aria-label={tr("Деңгейі")}>
                  {LEVELS.map((l) => (
                    <button
                      key={l}
                      type="button"
                      aria-pressed={(q.level ?? "A") === l}
                      onClick={() => patch(i, { level: l })}
                      className={`h-7 w-8 rounded-md text-xs font-bold ${(q.level ?? "A") === l ? "bg-violet-600 text-white" : "bg-surface text-slate-500 ring-1 ring-slate-200"}`}
                    >
                      {l}
                    </button>
                  ))}
                </div>
                <span className="flex-1" />
                <button type="button" onClick={() => move(i, -1)} disabled={i === 0} aria-label={tr("Жоғары жылжыту")} className="rounded-md p-1.5 text-slate-500 hover:bg-slate-100 disabled:opacity-30">
                  <ArrowUp size={15} />
                </button>
                <button type="button" onClick={() => move(i, 1)} disabled={i === items.length - 1} aria-label={tr("Төмен жылжыту")} className="rounded-md p-1.5 text-slate-500 hover:bg-slate-100 disabled:opacity-30">
                  <ArrowDown size={15} />
                </button>
                <button type="button" onClick={() => remove(i)} aria-label={tr("Сұрақты жою")} className="rounded-md p-1.5 text-slate-500 hover:bg-rose-50 hover:text-rose-600">
                  <Trash2 size={15} />
                </button>
              </div>
              <textarea
                value={q.question}
                onChange={(e) => patch(i, { question: e.target.value })}
                rows={2}
                maxLength={1000}
                aria-label={tr("Сұрақ мәтіні")}
                placeholder={tr("Сұрақ мәтіні")}
                className={`${field} resize-y`}
              />
              <div className="mt-2 flex flex-col gap-1.5">
                {q.options.map((o, k) => (
                  <div key={k} className="flex items-center gap-2">
                    <button
                      type="button"
                      onClick={() => patch(i, { correctIndex: k })}
                      aria-pressed={q.correctIndex === k}
                      title={tr("Дұрыс жауап")}
                      aria-label={tr("{l} — дұрыс жауап", { l: letter(k) })}
                      className={`flex h-8 w-8 shrink-0 items-center justify-center rounded-full text-xs font-bold ${
                        q.correctIndex === k ? "bg-emerald-600 text-white" : "bg-surface text-slate-500 ring-1 ring-slate-200 hover:ring-emerald-500"
                      }`}
                    >
                      {q.correctIndex === k ? <Check size={14} /> : letter(k)}
                    </button>
                    <input value={o} onChange={(e) => setOption(i, k, e.target.value)} maxLength={300} aria-label={tr("{l} нұсқасы", { l: letter(k) })} placeholder={tr("{l} нұсқасы", { l: letter(k) })} className={field} />
                    <button type="button" onClick={() => removeOption(i, k)} disabled={q.options.length <= 2} aria-label={tr("Нұсқаны жою")} className="rounded-md p-1.5 text-slate-400 hover:text-rose-600 disabled:opacity-30">
                      <X size={15} />
                    </button>
                  </div>
                ))}
              </div>
              <div className="mt-2 flex flex-wrap items-center gap-3">
                {q.options.length < 6 && (
                  <button type="button" onClick={() => addOption(i)} className="text-[13px] font-semibold text-violet-600 hover:underline">
                    + {tr("Нұсқа қосу")}
                  </button>
                )}
                <span className="text-[12px] text-slate-500">{tr("Дұрыс жауапты әріпті басып белгілеңіз.")}</span>
              </div>
              <input
                value={q.explanation}
                onChange={(e) => patch(i, { explanation: e.target.value })}
                maxLength={500}
                aria-label={tr("Түсіндірме (міндетті емес)")}
                placeholder={tr("Түсіндірме (міндетті емес): оқушы қателессе көреді")}
                className={`${field} mt-2`}
              />
              {msg && <p className="mt-2 text-[13px] text-rose-600">{msg}</p>}
            </li>
          );
        })}
      </ol>

      <button
        type="button"
        onClick={() => {
          setItems((list) => [...list, blankQuestion()]);
          window.setTimeout(() => document.getElementById(`q-edit-${items.length}`)?.scrollIntoView({ behavior: "smooth", block: "center" }), 50);
        }}
        className="mt-4 inline-flex w-full items-center justify-center gap-2 rounded-[14px] border-2 border-dashed border-violet-300 py-3 text-sm font-semibold text-violet-700 hover:bg-violet-50"
      >
        <Plus size={16} /> {tr("Сұрақ қосу")}
      </button>

      {error && (
        <p role="alert" className="mt-4 rounded-xl bg-rose-50 px-3.5 py-2.5 text-sm text-rose-700">
          {error}
        </p>
      )}
      <div className="mt-5 flex flex-wrap gap-2">
        <button
          type="button"
          onClick={save}
          disabled={saving}
          className="inline-flex items-center gap-2 rounded-[12px] bg-violet-600 px-5 py-3 text-sm font-semibold text-white hover:bg-violet-700 disabled:opacity-60"
        >
          <Save size={16} /> {saving ? tr("Сақталуда...") : tr("Тестті сақтау")}
        </button>
        <button type="button" onClick={onCancel} className="inline-flex items-center gap-2 rounded-[12px] border border-slate-200 bg-surface px-5 py-3 text-sm font-semibold hover:border-violet-500">
          {tr("Болдырмау")}
        </button>
      </div>
    </div>
  );
}
