import { ArrowDownRight, ArrowRight, ArrowUpRight, Copy, FileSpreadsheet, LineChart, Sparkles, X } from "lucide-react";
import { Loading } from "../components/Loading";
import { useEffect, useMemo, useState } from "react";
import { Link } from "react-router-dom";
import { LangPicker } from "../components/LangPicker";
import { PageHeader } from "../components/PageHeader";
import { tr, uiLocale } from "../i18n";
import { defaultMaterialLang, type Lang } from "../lib/lang";
import { band, loadProgress, pctOf, summarizeStudent, type ProgressData, type ProgressTest, type StudentProgress, type StudentSummary } from "../lib/progress";
import { levelBadge, levelLabel } from "../lib/studio";

const ghost =
  "inline-flex items-center gap-2 rounded-[11px] border border-slate-200 bg-surface px-3.5 py-2.5 text-sm font-semibold hover:border-violet-500 hover:text-violet-600 disabled:opacity-60";
const fieldClass = "rounded-xl border border-slate-200 bg-surface px-3 py-2.5 text-sm outline-none focus:border-violet-500";
const BAND_CELL = { high: "bg-emerald-100 text-emerald-800", mid: "bg-amber-100 text-amber-900", low: "bg-rose-100 text-rose-800" } as const;
const shortDate = (ts: number) => new Date(ts).toLocaleDateString(uiLocale, { day: "2-digit", month: "2-digit" });

function Trend({ v }: { v: number }) {
  if (!v) return <span className="text-slate-400">—</span>;
  const up = v > 0;
  return (
    <span className={`inline-flex items-center gap-0.5 font-semibold ${up ? "text-emerald-700" : "text-rose-700"}`}>
      {up ? <ArrowUpRight size={14} /> : <ArrowDownRight size={14} />}
      {up ? "+" : ""}
      {v}
    </span>
  );
}

export default function ProgressPage() {
  const [data, setData] = useState<ProgressData | null>(null);
  const [error, setError] = useState("");
  const [cls, setCls] = useState("");
  const [subject, setSubject] = useState("");
  const [query, setQuery] = useState("");
  const [selected, setSelected] = useState<string | null>(null);
  const [exporting, setExporting] = useState(false);

  useEffect(() => {
    loadProgress()
      .then((d) => {
        setData(d);
        if (d.classes.length === 1) setCls(d.classes[0]);
      })
      .catch((e) => setError(e instanceof Error ? e.message : tr("Нәтижелерді жүктеу мүмкін болмады.")));
  }, []);

  const subjects = useMemo(() => [...new Set((data?.tests ?? []).map((t) => t.subject).filter(Boolean))], [data]);
  const tests = useMemo(() => (data?.tests ?? []).filter((t) => !subject || t.subject === subject), [data, subject]);
  const testIds = useMemo(() => new Set(tests.map((t) => t.id)), [tests]);

  // Сүзгіден кейін әр оқушының тек таңдалған пән тесттері есептеледі.
  const students = useMemo(() => {
    const q = query.trim().toLowerCase();
    return (data?.students ?? [])
      .filter((s) => (!cls || s.cls === cls) && (!q || s.name.toLowerCase().includes(q)))
      .map((s) => {
        const attempts = s.attempts.filter((a) => testIds.has(a.testId));
        const avg = attempts.length ? Math.round(attempts.reduce((x, a) => x + a.pct, 0) / attempts.length) : 0;
        const trend = attempts.length > 1 ? attempts[attempts.length - 1].pct - attempts[0].pct : 0;
        return { ...s, attempts, avg, trend };
      })
      .filter((s) => s.attempts.length > 0);
  }, [data, cls, query, testIds]);

  // Матрицада тек осы оқушылар тапсырған тесттер көрсетіледі.
  const columns = useMemo(() => tests.filter((t) => students.some((s) => s.attempts.some((a) => a.testId === t.id))), [tests, students]);
  const classAvg = students.length ? Math.round(students.reduce((x, s) => x + s.avg, 0) / students.length) : 0;
  const needHelp = students.filter((s) => s.avg < 50).length;
  const current = students.find((s) => s.key === selected) ?? null;

  async function exportExcel() {
    setExporting(true);
    try {
      const { exportProgressToXlsx } = await import("../lib/exportXlsx");
      await exportProgressToXlsx(students, columns, cls);
    } catch (e) {
      setError(e instanceof Error ? e.message : tr("Excel файлын жасау мүмкін болмады."));
    } finally {
      setExporting(false);
    }
  }

  return (
    <div className="mx-auto max-w-[1440px] px-4 py-9 sm:px-10">
      <PageHeader
        crumb={tr("Оқушы прогресі")}
        title={tr("Оқушы прогресі")}
        subtitle={tr("Оқушыларға сілтемемен жіберілген барлық тесттердің нәтижелері бір жерде: сынып кестесі, әр оқушының дамуы, ойлау деңгейлері және AI жазған тоқсандық қорытынды.")}
      />

      {error && <p className="mt-6 rounded-xl bg-rose-50 px-4 py-3 text-sm text-rose-700">{error}</p>}
      {!data && !error && <Loading className="mt-8" />}

      {data && data.students.length === 0 && (
        <div className="mt-8 flex flex-col items-center gap-3 rounded-3xl border-2 border-dashed border-slate-200 p-10 text-center text-slate-500">
          <span className="flex h-[72px] w-[72px] items-center justify-center rounded-[20px] bg-violet-100 text-violet-500">
            <LineChart size={32} />
          </span>
          <div className="text-base text-slate-900">{tr("Әзірге нәтиже жоқ")}</div>
          <p className="max-w-[520px] text-[13.5px]">
            {tr("«Тапсырмалар» бөлімінде тест жасап, «Оқушыларға жіберу» арқылы сілтеме беріңіз. Оқушылар тапсырған сайын нәтижелері осында жиналады.")}
          </p>
          <Link to="/tests" className="mt-1 inline-flex items-center gap-2 rounded-[12px] bg-violet-600 px-4 py-2.5 text-sm font-semibold text-white">
            {tr("Тапсырмаларға өту")} <ArrowRight size={15} />
          </Link>
        </div>
      )}

      {data && data.students.length > 0 && (
        <>
          <div className="mt-8 flex flex-wrap items-center gap-3">
            <select value={cls} onChange={(e) => setCls(e.target.value)} aria-label={tr("Сынып")} className={fieldClass}>
              <option value="">{tr("Барлық сыныптар")}</option>
              {data.classes.map((c) => (
                <option key={c} value={c}>
                  {c}
                </option>
              ))}
            </select>
            {subjects.length > 1 && (
              <select value={subject} onChange={(e) => setSubject(e.target.value)} aria-label={tr("Пән")} className={fieldClass}>
                <option value="">{tr("Барлық пәндер")}</option>
                {subjects.map((s) => (
                  <option key={s} value={s}>
                    {tr(s)}
                  </option>
                ))}
              </select>
            )}
            <input value={query} onChange={(e) => setQuery(e.target.value)} placeholder={tr("Оқушыны іздеу")} aria-label={tr("Оқушыны іздеу")} className={`${fieldClass} min-w-[200px] flex-1 sm:flex-none`} />
            <button type="button" onClick={exportExcel} disabled={exporting || !students.length} className={`${ghost} ml-auto`}>
              <FileSpreadsheet size={16} /> {exporting ? tr("Дайындалуда...") : tr("Excel-ге жүктеу")}
            </button>
          </div>

          <div className="mt-5 grid grid-cols-2 gap-3 lg:grid-cols-4">
            {[
              [students.length, tr("оқушы")],
              [columns.length, tr("тест")],
              [`${classAvg}%`, tr("орташа нәтиже")],
              [needHelp, tr("қолдау қажет (<50%)")],
            ].map(([v, l]) => (
              <div key={String(l)} className="rounded-[18px] border border-slate-200 bg-surface px-5 py-4">
                <div className="text-[26px] font-bold">{v}</div>
                <div className="text-[13px] text-slate-500">{l}</div>
              </div>
            ))}
          </div>

          <div className="mt-5 overflow-x-auto rounded-[18px] border border-slate-200 bg-surface">
            <table className="w-full text-sm">
              <thead className="bg-violet-50 text-left text-[12.5px] text-slate-600">
                <tr>
                  <th className="sticky left-0 z-10 min-w-[180px] bg-violet-50 px-3 py-2.5">{tr("Оқушы")}</th>
                  {columns.map((t) => (
                    <th key={t.id} className="min-w-[88px] px-2 py-2.5 text-center font-semibold" title={`${t.subject} · ${t.topic}`}>
                      <div className="mx-auto max-w-[110px] truncate">{t.topic || tr("Тест")}</div>
                      <div className="font-normal text-slate-500">{shortDate(t.createdAt)}</div>
                    </th>
                  ))}
                  <th className="px-3 py-2.5 text-center">{tr("Орташа")}</th>
                  <th className="px-3 py-2.5 text-center">{tr("Динамика")}</th>
                </tr>
              </thead>
              <tbody>
                {students.map((s) => (
                  <tr key={s.key} className={`border-t border-slate-100 ${selected === s.key ? "bg-violet-50" : "hover:bg-slate-50"}`}>
                    <td className="sticky left-0 z-10 bg-inherit px-3 py-2">
                      <button type="button" onClick={() => setSelected(s.key === selected ? null : s.key)} className="text-left font-semibold text-violet-700 hover:underline">
                        {s.name}
                      </button>
                      {s.cls && <span className="ml-1.5 text-xs text-slate-500">{s.cls}</span>}
                    </td>
                    {columns.map((t) => {
                      const a = s.attempts.find((x) => x.testId === t.id);
                      return (
                        <td key={t.id} className="px-2 py-2 text-center">
                          {a ? <span className={`inline-block min-w-[46px] rounded-lg px-1.5 py-1 text-[12.5px] font-bold ${BAND_CELL[band(a.pct)]}`}>{a.pct}%</span> : <span className="text-slate-300">·</span>}
                        </td>
                      );
                    })}
                    <td className="px-3 py-2 text-center font-bold">{s.avg}%</td>
                    <td className="px-3 py-2 text-center">
                      <Trend v={s.trend} />
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <p className="mt-2 text-xs text-slate-500">
            {tr("Оқушы бір тестті бірнеше рет тапсырса, соңғы нәтижесі алынады. Оқушының атын басып, толық талдауын ашыңыз.")}
          </p>

          {current && <StudentPanel key={current.key} s={current} tests={data.tests} onClose={() => setSelected(null)} />}
        </>
      )}
    </div>
  );
}

/** Бір оқушының графигі, деңгейлері, тесттері және AI қорытындысы. */
function StudentPanel({ s, tests, onClose }: { s: StudentProgress; tests: ProgressTest[]; onClose: () => void }) {
  const byId = useMemo(() => new Map(tests.map((t) => [t.id, t])), [tests]);
  const [lang, setLang] = useState<Lang>(defaultMaterialLang);
  const [summary, setSummary] = useState<StudentSummary | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [copied, setCopied] = useState(false);

  useEffect(() => {
    document.getElementById("student-panel")?.scrollIntoView({ behavior: "smooth", block: "start" });
  }, []);

  async function runSummary() {
    setBusy(true);
    setError("");
    try {
      setSummary(await summarizeStudent(s, tests, lang));
    } catch (e) {
      setError(e instanceof Error ? e.message : tr("Талдау мүмкін болмады."));
    } finally {
      setBusy(false);
    }
  }

  async function copySummary() {
    if (!summary) return;
    const text = [
      `${s.name}${s.cls ? ` (${s.cls})` : ""}`,
      summary.summary,
      ...summary.strengths.map((x) => `+ ${x}`),
      ...summary.weaknesses.map((x) => `− ${x}`),
      ...summary.recommendations.map((x) => `→ ${x}`),
    ].join("\n");
    try {
      await navigator.clipboard.writeText(text);
      setCopied(true);
      window.setTimeout(() => setCopied(false), 1500);
    } catch {
      setError(tr("Көшіру мүмкін болмады — сілтемені белгілеп, қолмен көшіріңіз."));
    }
  }

  // Сызықтық график (SVG): әр тесттің нәтижесі уақыт ретімен.
  const W = 640, H = 200, P = 28;
  const pts = s.attempts.map((a, i) => {
    const x = s.attempts.length === 1 ? W / 2 : P + (i * (W - 2 * P)) / (s.attempts.length - 1);
    const y = H - P - (a.pct / 100) * (H - 2 * P);
    return { x, y, a };
  });
  const weakest = [...s.attempts].sort((a, b) => a.pct - b.pct).slice(0, 3).filter((a) => a.pct < 85);

  return (
    <section id="student-panel" className="mt-6 scroll-mt-24 rounded-[22px] border border-slate-200 bg-surface p-5 sm:p-7">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h2 className="text-xl font-bold">
            {s.name} {s.cls && <span className="text-base font-normal text-slate-500">· {s.cls}</span>}
          </h2>
          <div className="mt-1 flex flex-wrap items-center gap-3 text-sm text-slate-500">
            <span>{tr("Тесттер: {n}", { n: s.attempts.length })}</span>
            <span>
              {tr("Орташа")}: <b className="text-slate-900">{s.avg}%</b>
            </span>
            <span className="inline-flex items-center gap-1">
              {tr("Динамика")}: <Trend v={s.trend} />
            </span>
          </div>
        </div>
        <button type="button" onClick={onClose} aria-label={tr("Жабу")} className="rounded-lg p-1.5 text-slate-500 hover:bg-slate-100">
          <X size={18} />
        </button>
      </div>

      <div className="mt-5 grid gap-5 lg:grid-cols-[1.4fr_1fr]">
        <div className="rounded-2xl border border-slate-200 p-3">
          <svg viewBox={`0 0 ${W} ${H}`} className="w-full" role="img" aria-label={tr("Нәтиже графигі")}>
            {[0, 50, 85, 100].map((v) => {
              const y = H - P - (v / 100) * (H - 2 * P);
              return (
                <g key={v}>
                  <line x1={P} x2={W - P} y1={y} y2={y} className="stroke-slate-200" strokeDasharray={v === 50 || v === 85 ? "4 4" : undefined} />
                  <text x={4} y={y + 4} className="fill-slate-400 text-[10px]">
                    {v}
                  </text>
                </g>
              );
            })}
            {pts.length > 1 && <polyline points={pts.map((p) => `${p.x},${p.y}`).join(" ")} fill="none" className="stroke-violet-500" strokeWidth={3} strokeLinejoin="round" />}
            {pts.map((p) => (
              <g key={p.a.id}>
                <circle cx={p.x} cy={p.y} r={6} className={band(p.a.pct) === "high" ? "fill-emerald-500" : band(p.a.pct) === "mid" ? "fill-amber-500" : "fill-rose-500"} />
                <text x={p.x} y={p.y - 11} textAnchor="middle" className="fill-slate-700 text-[11px] font-bold">
                  {p.a.pct}%
                </text>
                <text x={p.x} y={H - 6} textAnchor="middle" className="fill-slate-500 text-[10px]">
                  {shortDate(p.a.createdAt)}
                </text>
              </g>
            ))}
          </svg>
        </div>

        <div className="flex flex-col gap-3">
          <div className="text-sm font-bold">{tr("Ойлау деңгейлері бойынша")}</div>
          {(["A", "B", "C"] as const).map((l) => {
            const v = s.levels[l];
            const p = v.total ? pctOf(v.ok, v.total) : null;
            return (
              <div key={l} className="flex items-center gap-3 text-sm">
                <span className={`w-8 shrink-0 rounded-md py-0.5 text-center text-xs font-bold ${levelBadge(l)}`}>{l}</span>
                <span className="w-[42%] min-w-0 truncate text-slate-500">{levelLabel(l)}</span>
                <span className="h-2.5 flex-1 overflow-hidden rounded-full bg-slate-100">
                  <span className="block h-full rounded-full bg-violet-600" style={{ width: `${p ?? 0}%` }} />
                </span>
                <b className="w-12 text-right">{p === null ? "—" : `${p}%`}</b>
              </div>
            );
          })}
          {weakest.length > 0 && (
            <div className="mt-2 rounded-xl bg-rose-50 px-3.5 py-3 text-sm">
              <div className="mb-1 font-semibold text-rose-800">{tr("Қайталау керек тақырыптар")}</div>
              <ul className="list-disc pl-5 text-rose-800">
                {weakest.map((a) => (
                  <li key={a.id}>
                    {byId.get(a.testId)?.topic} — {a.pct}%
                  </li>
                ))}
              </ul>
            </div>
          )}
        </div>
      </div>

      <div className="mt-5 overflow-x-auto rounded-xl border border-slate-200">
        <table className="w-full text-sm">
          <thead className="bg-slate-50 text-left text-[12.5px] text-slate-600">
            <tr>
              <th className="px-3 py-2">{tr("Күні")}</th>
              <th className="px-3 py-2">{tr("Пән")}</th>
              <th className="px-3 py-2">{tr("Тақырып")}</th>
              <th className="px-3 py-2 text-center">{tr("Ұпай")}</th>
              <th className="px-3 py-2 text-center">%</th>
            </tr>
          </thead>
          <tbody>
            {s.attempts.map((a) => {
              const t = byId.get(a.testId);
              return (
                <tr key={a.id} className="border-t border-slate-100">
                  <td className="px-3 py-2 tabular-nums">{new Date(a.createdAt).toLocaleDateString(uiLocale)}</td>
                  <td className="px-3 py-2">{t ? tr(t.subject) : ""}</td>
                  <td className="px-3 py-2">
                    <Link to={`/tests?id=${a.testId}`} className="text-violet-700 hover:underline">
                      {t?.topic}
                    </Link>
                  </td>
                  <td className="px-3 py-2 text-center">
                    {a.score}/{a.total}
                  </td>
                  <td className="px-3 py-2 text-center">
                    <span className={`rounded-lg px-1.5 py-0.5 text-xs font-bold ${BAND_CELL[band(a.pct)]}`}>{a.pct}%</span>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>

      <div className="mt-6 rounded-2xl border border-violet-200 bg-violet-50 p-4 sm:p-5">
        <div className="flex flex-wrap items-end justify-between gap-3">
          <div>
            <div className="flex items-center gap-2 font-bold">
              <Sparkles size={17} className="text-violet-600" /> {tr("AI: тоқсандық қорытынды")}
            </div>
            <p className="mt-1 max-w-[560px] text-sm text-slate-600">{tr("Барлық нәтижесі бойынша күшті жақтары, қиындықтары және оқушы мен ата-анаға ұсыныстар. Ата-ана жиналысына немесе мінездемеге ыңғайлы.")}</p>
          </div>
          <div className="flex items-end gap-2">
            <div className="w-[200px]">
              <LangPicker value={lang} onChange={setLang} />
            </div>
            <button type="button" onClick={runSummary} disabled={busy} className="inline-flex items-center gap-2 rounded-[12px] bg-violet-600 px-4 py-2.5 text-sm font-semibold text-white disabled:opacity-60">
              <Sparkles size={16} className={busy ? "animate-spin" : ""} /> {busy ? tr("Талдауда...") : summary ? tr("Қайта талдау") : tr("Қорытынды жасау")}
            </button>
          </div>
        </div>
        {error && <p className="mt-3 rounded-xl bg-rose-50 px-3 py-2 text-sm text-rose-700">{error}</p>}
        {summary && (
          <div lang={lang} className="mt-4 flex flex-col gap-3 rounded-xl bg-surface p-4 text-[14.5px] leading-relaxed">
            <p>{summary.summary}</p>
            <div className="grid gap-3 md:grid-cols-3">
              {[
                [tr("Күшті жақтары"), summary.strengths, "text-emerald-700"],
                [tr("Қиындықтары"), summary.weaknesses, "text-rose-700"],
                [tr("Ұсыныстар"), summary.recommendations, "text-violet-700"],
              ].map(([title, items, tone]) => (
                <div key={title as string}>
                  <div className={`mb-1 text-sm font-bold ${tone as string}`}>{title as string}</div>
                  <ul className="list-disc space-y-1 pl-5 text-sm">
                    {(items as string[]).map((x, i) => (
                      <li key={i}>{x}</li>
                    ))}
                  </ul>
                </div>
              ))}
            </div>
            <div>
              <button type="button" onClick={copySummary} className={ghost}>
                <Copy size={15} /> {copied ? tr("Көшірілді") : tr("Көшіру")}
              </button>
            </div>
          </div>
        )}
      </div>
    </section>
  );
}
