import { Check, Copy, Sparkles, X } from "lucide-react";
import { useState } from "react";
import type { SavedTest, TestLevel, TestSubmission } from "../lib/projects";
import { analyzeClassResults, type ClassAnalysis, generatePersonalTasks, levelBadge, levelLabel, type PersonalPlan } from "../lib/studio";

const letter = (i: number) => String.fromCharCode(65 + i);
const aiBtn = "inline-flex items-center gap-2 rounded-[11px] bg-violet-600 px-3.5 py-2.5 text-sm font-semibold text-white disabled:opacity-70";

/** Нәтиже бойынша топ: C — жоғары (85%+), B — орта (50–84%), A — қолдау қажет (<50%). */
const groupOf = (s: TestSubmission): TestLevel => {
  const p = s.total ? (s.score / s.total) * 100 : 0;
  return p >= 85 ? "C" : p >= 50 ? "B" : "A";
};

const GROUP_TITLES: Record<TestLevel, string> = {
  C: "Жоғары деңгей (85%+)",
  B: "Орта деңгей (50–84%)",
  A: "Қолдау қажет (<50%)",
};

function CopyButton({ text }: { text: string }) {
  const [done, setDone] = useState(false);
  return (
    <button
      type="button"
      onClick={() =>
        navigator.clipboard.writeText(text).then(
          () => {
            setDone(true);
            window.setTimeout(() => setDone(false), 2000);
          },
          () => {},
        )
      }
      className="inline-flex items-center gap-1.5 rounded-[10px] border border-slate-200 bg-white px-3 py-2 text-[13px] font-semibold hover:border-violet-500"
    >
      {done ? <Check size={14} /> : <Copy size={14} />} {done ? "Көшірілді" : "Көшіру"}
    </button>
  );
}

/** Бір оқушының жауаптары және оның қателеріне қарай AI құрастырған жеке тапсырмалар. */
export function StudentDetail({ test, sub }: { test: SavedTest; sub: TestSubmission }) {
  const [plan, setPlan] = useState<PersonalPlan | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");

  async function makeTasks() {
    setBusy(true);
    setError("");
    try {
      setPlan(await generatePersonalTasks(test, sub.answers));
    } catch (e) {
      setError(e instanceof Error ? e.message : "Тапсырма жасау мүмкін болмады.");
    } finally {
      setBusy(false);
    }
  }

  const planText = plan
    ? `${sub.studentName}, ${plan.feedback}\n\n` +
      plan.tasks.map((t, i) => `${i + 1}. ${t.title} (${t.level} — ${levelLabel(t.level)})\n${t.text}`).join("\n\n")
    : "";

  return (
    <div className="flex flex-col gap-3 rounded-2xl bg-slate-50 p-4">
      <div className="flex flex-wrap gap-1.5" aria-label="Сұрақтар бойынша жауаптары">
        {test.questions.map((q, i) => {
          const a = sub.answers[i];
          const ok = a === q.correctIndex;
          return (
            <span
              key={i}
              title={`${q.question}\nЖауабы: ${a === null || a === undefined ? "жоқ" : q.options[a]}\nДұрысы: ${q.options[q.correctIndex]}`}
              className={`inline-flex items-center gap-1 rounded-lg px-2 py-1 text-xs font-semibold ${ok ? "bg-fuchsia-100 text-fuchsia-800" : "bg-rose-50 text-rose-700"}`}
            >
              {ok ? <Check size={12} /> : <X size={12} />}
              {i + 1}
              {q.level ? ` · ${q.level}` : ""}
              {!ok && ` · ${a === null || a === undefined ? "—" : letter(a)}`}
            </span>
          );
        })}
      </div>
      {!plan && (
        <div>
          <button type="button" onClick={makeTasks} disabled={busy} className={aiBtn}>
            <Sparkles size={15} className={busy ? "animate-spin" : ""} /> {busy ? "AI құрастыруда..." : "AI: жеке тапсырма құрастыру"}
          </button>
          <p className="mt-1.5 text-xs text-slate-500">Қателеріне және деңгейіне қарай 3 тапсырма мен кері байланыс дайындалады.</p>
        </div>
      )}
      {error && <p className="rounded-xl bg-rose-50 px-3 py-2 text-sm text-rose-700">{error}</p>}
      {plan && (
        <div className="flex flex-col gap-3 rounded-xl border border-slate-200 bg-white p-4">
          <div className="text-[14.5px]">
            <b>Кері байланыс:</b> {plan.feedback}
          </div>
          <ol className="flex flex-col gap-2.5">
            {plan.tasks.map((t, i) => (
              <li key={i} className="rounded-xl border border-slate-200 p-3">
                <div className="flex items-center gap-2 font-semibold">
                  <span className={`rounded-md px-1.5 py-0.5 text-[11px] font-bold ${levelBadge(t.level)}`}>{t.level}</span>
                  {i + 1}. {t.title}
                </div>
                <div className="mt-1 text-[14.5px]">{t.text}</div>
                {t.answer && <div className="mt-1 text-[13px] text-slate-500">Жауабы (мұғалімге): {t.answer}</div>}
              </li>
            ))}
          </ol>
          <div className="flex flex-wrap gap-2">
            <CopyButton text={planText} />
            <button type="button" onClick={makeTasks} disabled={busy} className="rounded-[10px] border border-slate-200 px-3 py-2 text-[13px] font-semibold hover:border-violet-500 disabled:opacity-60">
              {busy ? "Құрастырылуда..." : "Басқа нұсқа"}
            </button>
          </div>
          <p className="text-xs text-slate-500">«Көшіру» — жауаптарсыз мәтін, оқушыға WhatsApp арқылы жіберуге болады.</p>
        </div>
      )}
    </div>
  );
}

/** Деңгей топтары және AI-дың сынып нәтижесін талдауы. */
export function ClassInsights({ test, subs, perQuestion, average }: { test: SavedTest; subs: TestSubmission[]; perQuestion: number[]; average: number }) {
  const [analysis, setAnalysis] = useState<ClassAnalysis | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");

  const groups: Record<TestLevel, TestSubmission[]> = { C: [], B: [], A: [] };
  subs.forEach((s) => groups[groupOf(s)].push(s));

  async function analyze() {
    setBusy(true);
    setError("");
    try {
      setAnalysis(
        await analyzeClassResults(test, {
          perQuestion,
          students: subs.length,
          average,
          groups: { A: groups.A.length, B: groups.B.length, C: groups.C.length },
        }),
      );
    } catch (e) {
      setError(e instanceof Error ? e.message : "Талдау мүмкін болмады.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="flex flex-col gap-4 border-t border-slate-200 pt-5">
      <div>
        <div className="mb-2 text-[13px] font-semibold text-slate-500">Саралау топтары</div>
        <div className="grid gap-2.5 sm:grid-cols-3">
          {(["C", "B", "A"] as const).map((g) => (
            <div key={g} className="rounded-xl border border-slate-200 p-3">
              <div className="flex items-center gap-2 text-sm font-semibold">
                <span className={`rounded-md px-1.5 py-0.5 text-[11px] font-bold ${levelBadge(g)}`}>{g}</span>
                {GROUP_TITLES[g]}
              </div>
              <div className="mt-1.5 text-[13.5px] text-slate-500">{groups[g].length ? groups[g].map((s) => s.studentName).join(", ") : "—"}</div>
            </div>
          ))}
        </div>
      </div>

      {!analysis && (
        <div>
          <button type="button" onClick={analyze} disabled={busy} className={aiBtn}>
            <Sparkles size={15} className={busy ? "animate-spin" : ""} /> {busy ? "AI талдауда..." : "AI: сынып нәтижесін талдау"}
          </button>
          <p className="mt-1.5 text-xs text-slate-500">Қай ұғымдар нашар меңгерілгенін анықтап, келесі сабаққа ұсыныстар мен топтарға тапсырма береді.</p>
        </div>
      )}
      {error && <p className="rounded-xl bg-rose-50 px-3 py-2 text-sm text-rose-700">{error}</p>}
      {analysis && (
        <div className="flex flex-col gap-3 rounded-2xl bg-violet-100/60 p-5 text-[14.5px]">
          <div className="flex items-center gap-2 text-base font-bold">
            <Sparkles size={17} className="text-violet-600" /> AI талдауы
          </div>
          <p>{analysis.summary}</p>
          {analysis.difficulties.length > 0 && (
            <div>
              <b>Қиындық тудырған ұғымдар:</b>
              <ul className="mt-1 list-disc pl-5">
                {analysis.difficulties.map((d, i) => (
                  <li key={i}>{d}</li>
                ))}
              </ul>
            </div>
          )}
          {analysis.recommendations.length > 0 && (
            <div>
              <b>Келесі сабаққа ұсыныстар:</b>
              <ul className="mt-1 list-disc pl-5">
                {analysis.recommendations.map((d, i) => (
                  <li key={i}>{d}</li>
                ))}
              </ul>
            </div>
          )}
          {analysis.groups.length > 0 && (
            <div>
              <b>Топтарға жұмыс:</b>
              <ul className="mt-1 flex flex-col gap-1">
                {analysis.groups.map((g, i) => (
                  <li key={i}>
                    <span className={`mr-1.5 rounded-md px-1.5 py-0.5 text-[11px] font-bold ${levelBadge(g.level)}`}>{g.level}</span>
                    {g.advice}
                  </li>
                ))}
              </ul>
            </div>
          )}
          <div>
            <button type="button" onClick={analyze} disabled={busy} className="rounded-[10px] border border-slate-300 bg-white px-3 py-2 text-[13px] font-semibold disabled:opacity-60">
              {busy ? "Талдауда..." : "Қайта талдау"}
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
