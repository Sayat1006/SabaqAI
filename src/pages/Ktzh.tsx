import { ArrowDown, ArrowUp, CalendarDays, ClipboardList, Download, Plus, Printer, RefreshCw, Save, Sparkles, Trash2, X } from "lucide-react";
import { useEffect, useState } from "react";
import { useLocation, useNavigate } from "react-router-dom";
import { LangPicker } from "../components/LangPicker";
import { PageHeader } from "../components/PageHeader";
import { useAuth } from "../context/useAuth";
import { tr } from "../i18n";
import { GRADES } from "../lib/catalog";
import { allowedSubjects, pickSubject } from "../lib/subjects";
import { assignDates, DEFAULT_WEEKS, defaultStart, generateKtzh, kindLabel, KTZH_PERIODS, ktzhTotalHours, parseDate, WEEKDAYS, type KtzhData, type KtzhRow } from "../lib/ktzh";
import { defaultMaterialLang, type Lang } from "../lib/lang";
import { deleteProject, getKtzh, getKtzhList, saveKtzh, timeAgo, updateKtzh, type SavedKtzh } from "../lib/projects";
import { scrollToResult } from "../lib/scrollToResult";

const fieldClass = "w-full rounded-xl border border-slate-200 bg-slate-50 px-3.5 py-3 text-sm outline-none focus:border-violet-500";
const cellInput = "w-full min-w-0 rounded-md bg-transparent px-1.5 py-1 text-[13px] outline-none focus:bg-violet-50";
const ghost =
  "inline-flex items-center gap-2 rounded-[11px] border border-slate-200 bg-surface px-3.5 py-2.5 text-sm font-semibold hover:border-violet-500 hover:text-violet-600 disabled:opacity-60";
const chip = (on: boolean) =>
  `min-h-9 rounded-xl border px-2.5 text-[13px] transition ${on ? "border-violet-600 bg-violet-600 text-white" : "border-slate-200 bg-surface text-slate-600 hover:border-violet-500"}`;

/** Аптасына сағат санына қарай әдепкі сабақ күндері. */
const defaultDays = (h: number) => ({ 1: [1], 2: [1, 3], 3: [1, 3, 5], 4: [1, 2, 4, 5], 5: [1, 2, 3, 4, 5], 6: [1, 2, 3, 4, 5, 6] })[h] ?? [1, 3];

function FormField({ label, hint, children }: { label: React.ReactNode; hint?: string; children: React.ReactNode }) {
  return (
    <label className="block">
      <span className="mb-2 block text-[13px] font-semibold text-slate-500">{label}</span>
      {children}
      {hint && <span className="mt-1.5 block text-xs text-slate-500">{hint}</span>}
    </label>
  );
}

export default function KtzhPage() {
  const { user } = useAuth();
  const subjects = allowedSubjects(user);
  const navigate = useNavigate();
  const location = useLocation();
  const openedId = (location.state as { ktzhId?: string } | null)?.ktzhId ?? new URLSearchParams(location.search).get("id") ?? undefined;

  const [subject, setSubject] = useState(() => pickSubject(subjects, user?.subject));
  const [grade, setGrade] = useState(user?.grades?.[0] ?? GRADES[4]);
  const [period, setPeriod] = useState(KTZH_PERIODS[0]);
  const [hoursPerWeek, setHoursPerWeek] = useState(2);
  const [weeks, setWeeks] = useState(DEFAULT_WEEKS[KTZH_PERIODS[0]]);
  const [days, setDays] = useState<number[]>(defaultDays(2));
  const [startDate, setStartDate] = useState(defaultStart(KTZH_PERIODS[0]));
  const [lang, setLang] = useState<Lang>(defaultMaterialLang);
  const [notes, setNotes] = useState("");
  const [teacher, setTeacher] = useState(user?.name ?? "");

  const [plan, setPlan] = useState<SavedKtzh | null>(null);
  const [history, setHistory] = useState<SavedKtzh[]>([]);
  const [generating, setGenerating] = useState(false);
  const [dirty, setDirty] = useState(false);
  const [saving, setSaving] = useState(false);
  const [exporting, setExporting] = useState(false);
  const [error, setError] = useState("");

  function fill(p: SavedKtzh) {
    setPlan(p);
    setDirty(false);
    setSubject(p.subject);
    setGrade(p.grade);
    setPeriod(p.period);
    setHoursPerWeek(p.hoursPerWeek);
    setWeeks(p.weeks);
    setDays(p.days);
    setStartDate(p.startDate);
    setLang(p.lang ?? "kk");
    if (p.teacher) setTeacher(p.teacher);
  }

  useEffect(() => {
    getKtzhList()
      .then(setHistory)
      .catch(() => undefined);
  }, []);

  useEffect(() => {
    if (!openedId) return;
    getKtzh(openedId)
      .then((p) => p && fill(p))
      .catch((e) => setError(e instanceof Error ? e.message : tr("КТЖ ашу мүмкін болмады.")));
  }, [openedId]);

  function choosePeriod(p: string) {
    setPeriod(p);
    setWeeks(DEFAULT_WEEKS[p] ?? 8);
    setStartDate(defaultStart(p));
  }
  function chooseHours(h: number) {
    setHoursPerWeek(h);
    setDays(defaultDays(h));
  }
  const toggleDay = (d: number) => setDays((list) => (list.includes(d) ? list.filter((x) => x !== d) : [...list, d].sort()));

  async function handleGenerate(e: React.FormEvent) {
    e.preventDefault();
    if (generating) return;
    if (!parseDate(startDate)) return setError(tr("Басталу күнін кк.аа.жжжж түрінде жазыңыз."));
    if (!days.length) return setError(tr("Сабақ күндерін таңдаңыз."));
    setError("");
    setGenerating(true);
    scrollToResult();
    try {
      const data = await generateKtzh({ subject, grade, period, hoursPerWeek, weeks, days, startDate, teacher: teacher.trim(), lang, notes });
      const saved = await saveKtzh(data).catch((err) => {
        setError(err instanceof Error ? err.message : tr("Сақтау мүмкін болмады."));
        return { ...data, id: "", savedAt: Date.now() } as SavedKtzh;
      });
      setPlan(saved);
      setDirty(false);
      if (saved.id) setHistory((h) => [saved, ...h].slice(0, 12));
    } catch (err) {
      setError(err instanceof Error ? err.message : tr("КТЖ жасау мүмкін болмады."));
    } finally {
      setGenerating(false);
    }
  }

  function change(fn: (rows: KtzhRow[]) => KtzhRow[]) {
    setPlan((p) => (p ? { ...p, rows: fn(p.rows) } : p));
    setDirty(true);
  }
  const setRow = (i: number, patch: Partial<KtzhRow>) => change((rows) => rows.map((r, j) => (j === i ? { ...r, ...patch } : r)));
  const move = (i: number, dir: -1 | 1) =>
    change((rows) => {
      const j = i + dir;
      if (j < 0 || j >= rows.length) return rows;
      const next = [...rows];
      [next[i], next[j]] = [next[j], next[i]];
      return next;
    });

  function redate() {
    if (!plan) return;
    if (!parseDate(startDate)) return setError(tr("Басталу күнін кк.аа.жжжж түрінде жазыңыз."));
    setPlan({ ...plan, startDate, days, rows: assignDates(plan.rows, startDate, days) });
    setDirty(true);
  }

  async function handleSave() {
    if (!plan) return;
    setSaving(true);
    setError("");
    try {
      const data: KtzhData = { ...plan, teacher: teacher.trim() };
      if (plan.id) {
        await updateKtzh(plan.id, data);
        setHistory((h) => h.map((x) => (x.id === plan.id ? { ...plan, ...data } : x)));
      } else {
        const saved = await saveKtzh(data);
        setPlan(saved);
        setHistory((h) => [saved, ...h].slice(0, 12));
      }
      setDirty(false);
    } catch (err) {
      setError(err instanceof Error ? err.message : tr("Сақтау мүмкін болмады."));
    } finally {
      setSaving(false);
    }
  }

  async function handleExport() {
    if (!plan) return;
    setExporting(true);
    try {
      const { exportKtzhToDocx } = await import("../lib/exportDocx");
      await exportKtzhToDocx({ ...plan, teacher: teacher.trim() });
    } catch (err) {
      setError(err instanceof Error ? err.message : tr("Word файлын жасау мүмкін болмады."));
    } finally {
      setExporting(false);
    }
  }

  async function handleDelete(id: string) {
    if (!window.confirm(tr("КТЖ-ны жою керек пе?"))) return;
    try {
      await deleteProject(id);
      setHistory((h) => h.filter((x) => x.id !== id));
      if (plan?.id === id) setPlan(null);
    } catch (err) {
      setError(err instanceof Error ? err.message : tr("Жою мүмкін болмады."));
    }
  }

  function toQmzh(r: KtzhRow) {
    if (!plan) return;
    navigate("/qmzh", {
      state: { prefill: { subject: plan.subject, grade: plan.grade, topic: r.topic, objectives: r.objectives, date: r.date, lang: plan.lang, section: r.section } },
    });
  }

  const target = hoursPerWeek * weeks;
  const total = plan ? ktzhTotalHours(plan) : 0;
  const sorCount = plan?.rows.filter((r) => r.kind === "sor").length ?? 0;
  const sochCount = plan?.rows.filter((r) => r.kind === "soch").length ?? 0;

  return (
    <div className="mx-auto max-w-[1440px] px-4 py-9 sm:px-10 print:p-0">
      <PageHeader
        crumb={tr("КТЖ")}
        title={tr("Күнтізбелік-тақырыптық жоспар (КТЖ)")}
        subtitle={tr("Пән, сынып және тоқсанды таңдаңыз — AI бөлімдер мен сабақ тақырыптарын оқу мақсаттарымен, БЖБ/ТЖБ-мен бірге кестеге түсіреді, күндерін сайт өзі қояды. Әр сабақтан бір батырмамен ҚМЖ жасауға болады.")}
      />

      <div className="mt-8 flex flex-wrap items-start gap-7">
        <div className="flex w-full flex-col gap-5 lg:sticky lg:top-24 lg:w-[380px] print:hidden">
          <form
            onSubmit={handleGenerate}
            noValidate
            className="flex flex-col gap-5 rounded-3xl border border-surface/70 bg-surface/75 p-6 shadow-[0_24px_48px_-30px_rgba(27,26,46,.2)] backdrop-blur-xl"
          >
            <div className="grid grid-cols-2 gap-3">
              <FormField label={tr("Пән")}>
                <select value={subject} onChange={(e) => setSubject(e.target.value)} className={fieldClass}>
                  {(subjects.includes(subject) ? subjects : [subject, ...subjects]).map((s) => (
                    <option key={s} value={s}>
                      {tr(s)}
                    </option>
                  ))}
                </select>
              </FormField>
              <FormField label={tr("Сынып")}>
                <select value={grade} onChange={(e) => setGrade(e.target.value)} className={fieldClass}>
                  {GRADES.map((g) => (
                    <option key={g} value={g}>
                      {tr(g)}
                    </option>
                  ))}
                </select>
              </FormField>
            </div>
            <LangPicker value={lang} onChange={setLang} />
            <fieldset>
              <legend className="mb-2 block text-[13px] font-semibold text-slate-500">{tr("Кезең")}</legend>
              <div className="grid grid-cols-3 gap-2">
                {KTZH_PERIODS.map((p) => (
                  <button key={p} type="button" aria-pressed={period === p} onClick={() => choosePeriod(p)} className={chip(period === p)}>
                    {tr(p)}
                  </button>
                ))}
              </div>
            </fieldset>
            <fieldset>
              <legend className="mb-2 block text-[13px] font-semibold text-slate-500">{tr("Аптасына сағат саны")}</legend>
              <div className="grid grid-cols-6 gap-2">
                {[1, 2, 3, 4, 5, 6].map((h) => (
                  <button key={h} type="button" aria-pressed={hoursPerWeek === h} onClick={() => chooseHours(h)} className={chip(hoursPerWeek === h)}>
                    {h}
                  </button>
                ))}
              </div>
            </fieldset>
            <div className="grid grid-cols-2 gap-3">
              <FormField label={tr("Оқу апталары")}>
                <input type="number" min={1} max={40} value={weeks} onChange={(e) => setWeeks(Math.min(40, Math.max(1, Number(e.target.value) || 1)))} className={fieldClass} />
              </FormField>
              <FormField label={tr("Басталу күні")}>
                <input value={startDate} onChange={(e) => setStartDate(e.target.value)} placeholder={tr("кк.аа.жжжж")} className={fieldClass} />
              </FormField>
            </div>
            <fieldset>
              <legend className="mb-2 block text-[13px] font-semibold text-slate-500">{tr("Сабақ күндері")}</legend>
              <div className="grid grid-cols-6 gap-2">
                {WEEKDAYS.map((d) => (
                  <button key={d.id} type="button" aria-pressed={days.includes(d.id)} onClick={() => toggleDay(d.id)} className={chip(days.includes(d.id))}>
                    {tr(d.label)}
                  </button>
                ))}
              </div>
              <span className="mt-1.5 block text-xs text-slate-500">{tr("Барлығы {n} сағат. Мереке күндерін кестеден қолмен түзетіңіз.", { n: Math.min(target, 140) })}</span>
            </fieldset>
            <FormField label={tr("Бөлімдер мен тақырыптар (міндетті емес)")} hint={tr("Оқу бағдарламасындағы бөлімдерді немесе тақырыптарды қоя салыңыз — AI соларға сүйенеді.")}>
              <textarea rows={4} value={notes} onChange={(e) => setNotes(e.target.value)} maxLength={4000} placeholder={tr("Мыс.: 1-бөлім. Натурал сандар (10 сағат); 2-бөлім. Жай бөлшектер...")} className={`${fieldClass} resize-y`} />
            </FormField>
            <FormField label={tr("Мұғалімнің аты-жөні")}>
              <input value={teacher} onChange={(e) => setTeacher(e.target.value)} maxLength={80} className={fieldClass} />
            </FormField>
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
              {generating ? tr("Дайындалуда...") : tr("КТЖ жасау")}
            </button>
          </form>

          {history.length > 0 && (
            <div className="rounded-[18px] border border-slate-200 bg-surface p-5">
              <div className="mb-3 text-sm font-bold">{tr("Соңғы КТЖ")}</div>
              <ul className="flex flex-col gap-1">
                {history.map((h) => (
                  <li key={h.id} className="flex items-center gap-2">
                    <button type="button" onClick={() => fill(h)} className="min-w-0 flex-1 rounded-lg px-2 py-1.5 text-left text-sm hover:bg-slate-50">
                      <span className="block truncate font-semibold">
                        {tr(h.subject)} · {tr(h.grade)}
                      </span>
                      <span className="block text-xs text-slate-500">
                        {tr(h.period)} · {tr("{n} сағат", { n: h.rows.length })} · {timeAgo(h.savedAt)}
                      </span>
                    </button>
                    <button type="button" onClick={() => handleDelete(h.id)} aria-label={tr("Жою: {title}", { title: `${h.subject} ${h.grade}` })} className="rounded-lg p-1.5 text-slate-500 hover:bg-rose-50 hover:text-rose-700">
                      <X size={15} />
                    </button>
                  </li>
                ))}
              </ul>
            </div>
          )}
        </div>

        <section id="result" className="min-w-0 flex-[1_1_640px] scroll-mt-28" aria-live="polite">
          {generating ? (
            <div className="flex min-h-[420px] flex-col items-center justify-center gap-3 rounded-3xl border border-slate-200 bg-surface">
              <Sparkles size={34} className="animate-spin text-violet-500" />
              <div className="text-base">{tr("КТЖ дайындалуда...")}</div>
              <div className="text-[12.5px] text-slate-500">{tr("Әдетте 20–60 секунд алады")}</div>
            </div>
          ) : !plan ? (
            <div className="flex min-h-[420px] flex-col items-center justify-center gap-3.5 rounded-3xl border-2 border-dashed border-slate-200 p-10 text-center text-slate-500">
              <span className="flex h-[72px] w-[72px] items-center justify-center rounded-[20px] bg-violet-100 text-violet-500">
                <CalendarDays size={32} />
              </span>
              <div className="text-base text-slate-900">{tr("Пән, сынып пен тоқсанды таңдап, «КТЖ жасау» батырмасын басыңыз")}</div>
              <div className="text-[13.5px]">{tr("Дайын жоспар осы жерде пайда болады және «Жобалар» бөлімінде сақталады.")}</div>
            </div>
          ) : (
            <article className="rounded-[22px] border border-slate-200 bg-surface p-4 sm:p-6 print:border-0 print:p-0">
              <div className="mb-4 flex flex-wrap items-start justify-between gap-3">
                <div>
                  <h2 className="text-xl font-bold">
                    {tr(plan.subject)} · {tr(plan.grade)} · {tr(plan.period)}
                  </h2>
                  <div className="mt-1 flex flex-wrap gap-2 text-xs font-semibold">
                    <span className={`rounded-full px-2.5 py-1 ${total === plan.hoursPerWeek * plan.weeks ? "bg-fuchsia-100 text-fuchsia-800" : "bg-amber-100 text-amber-900"}`}>
                      {tr("{n} / {t} сағат", { n: total, t: plan.hoursPerWeek * plan.weeks })}
                    </span>
                    <span className="rounded-full bg-violet-100 px-2.5 py-1 text-violet-700">{tr("БЖБ: {n}", { n: sorCount })}</span>
                    <span className="rounded-full bg-violet-100 px-2.5 py-1 text-violet-700">{tr("ТЖБ: {n}", { n: sochCount })}</span>
                    {plan.lang !== "kk" && <span className="rounded-full bg-slate-100 px-2.5 py-1 text-slate-700">{tr(plan.lang === "en" ? "ағылшынша" : "орысша")}</span>}
                  </div>
                </div>
                <div className="flex flex-wrap gap-2 print:hidden">
                  {dirty && (
                    <button type="button" onClick={handleSave} disabled={saving} className="inline-flex items-center gap-2 rounded-[11px] bg-violet-600 px-3.5 py-2.5 text-sm font-semibold text-white disabled:opacity-60">
                      <Save size={16} /> {saving ? tr("Сақталуда...") : tr("Сақтау")}
                    </button>
                  )}
                  <button type="button" onClick={redate} className={ghost} title={tr("Формадағы басталу күні мен сабақ күндері бойынша")}>
                    <RefreshCw size={16} /> {tr("Күндерді қайта қою")}
                  </button>
                  <button type="button" onClick={handleExport} disabled={exporting} className={ghost}>
                    <Download size={16} /> {exporting ? tr("Дайындалуда...") : tr("Word түрінде жүктеу")}
                  </button>
                  <button type="button" onClick={() => window.print()} className={ghost}>
                    <Printer size={16} /> {tr("PDF / басып шығару")}
                  </button>
                </div>
              </div>

              <div className="overflow-x-auto rounded-xl border border-slate-200">
                <table className="w-full min-w-[860px] text-sm">
                  <thead className="bg-violet-50 text-left text-[12.5px] text-slate-600">
                    <tr>
                      <th className="w-10 px-2 py-2">№</th>
                      <th className="w-[18%] px-2 py-2">{tr("Бөлім")}</th>
                      <th className="px-2 py-2">{tr("Сабақ тақырыбы")}</th>
                      <th className="w-[26%] px-2 py-2">{tr("Оқу мақсаттары")}</th>
                      <th className="w-[108px] px-2 py-2">{tr("Күні")}</th>
                      <th className="w-[12%] px-2 py-2">{tr("Ескерту")}</th>
                      <th className="w-[132px] px-2 py-2 print:hidden" />
                    </tr>
                  </thead>
                  <tbody>
                    {plan.rows.map((r, i) => {
                      const first = i === 0 || plan.rows[i - 1].section !== r.section;
                      const special = r.kind !== "lesson";
                      return (
                        <tr key={i} className={`border-t border-slate-100 align-top ${special ? "bg-amber-50" : ""} ${first && i > 0 ? "border-t-2 border-t-violet-200" : ""}`}>
                          <td className="px-2 py-1.5 text-slate-500">{i + 1}</td>
                          <td className="px-1 py-1">
                            <input value={r.section} onChange={(e) => setRow(i, { section: e.target.value })} aria-label={tr("{n}-жол: бөлім", { n: i + 1 })} className={`${cellInput} ${first ? "font-semibold" : "text-slate-400"}`} />
                          </td>
                          <td className="px-1 py-1">
                            <div className="flex items-start gap-1">
                              {special && <span className="mt-1 shrink-0 rounded bg-amber-200 px-1.5 text-[11px] font-bold text-amber-900">{kindLabel(r.kind, plan.lang)}</span>}
                              <textarea rows={1} value={r.topic} onChange={(e) => setRow(i, { topic: e.target.value })} aria-label={tr("{n}-жол: тақырып", { n: i + 1 })} className={`${cellInput} resize-y [field-sizing:content] ${special ? "font-semibold" : ""}`} />
                            </div>
                          </td>
                          <td className="px-1 py-1">
                            <textarea rows={1} value={r.objectives} onChange={(e) => setRow(i, { objectives: e.target.value })} aria-label={tr("{n}-жол: оқу мақсаттары", { n: i + 1 })} className={`${cellInput} resize-y text-[12.5px] [field-sizing:content]`} />
                          </td>
                          <td className="px-1 py-1">
                            <input value={r.date} onChange={(e) => setRow(i, { date: e.target.value })} aria-label={tr("{n}-жол: күні", { n: i + 1 })} className={`${cellInput} tabular-nums`} />
                          </td>
                          <td className="px-1 py-1">
                            <input value={r.note} onChange={(e) => setRow(i, { note: e.target.value })} aria-label={tr("{n}-жол: ескерту", { n: i + 1 })} className={cellInput} />
                          </td>
                          <td className="px-1 py-1 print:hidden">
                            <div className="flex items-center justify-end gap-0.5">
                              {r.kind === "lesson" && (
                                <button type="button" onClick={() => toQmzh(r)} title={tr("Осы сабаққа ҚМЖ жасау")} aria-label={tr("{n}-сабаққа ҚМЖ жасау", { n: i + 1 })} className="inline-flex items-center gap-1 rounded-lg px-1.5 py-1 text-xs font-semibold text-violet-700 hover:bg-violet-100">
                                  <ClipboardList size={14} /> {tr("ҚМЖ")}
                                </button>
                              )}
                              <button type="button" onClick={() => move(i, -1)} disabled={i === 0} aria-label={tr("Жоғары жылжыту")} className="rounded p-1 text-slate-500 hover:bg-slate-100 disabled:opacity-30">
                                <ArrowUp size={13} />
                              </button>
                              <button type="button" onClick={() => move(i, 1)} disabled={i === plan.rows.length - 1} aria-label={tr("Төмен жылжыту")} className="rounded p-1 text-slate-500 hover:bg-slate-100 disabled:opacity-30">
                                <ArrowDown size={13} />
                              </button>
                              <button
                                type="button"
                                onClick={() => change((rows) => [...rows.slice(0, i + 1), { section: r.section, topic: "", objectives: "", hours: 1, kind: "lesson", date: "", note: "" }, ...rows.slice(i + 1)])}
                                aria-label={tr("Астына жол қосу")}
                                className="rounded p-1 text-slate-500 hover:bg-slate-100"
                              >
                                <Plus size={13} />
                              </button>
                              <button type="button" onClick={() => change((rows) => rows.filter((_, j) => j !== i))} aria-label={tr("Жолды өшіру")} className="rounded p-1 text-slate-500 hover:bg-rose-50 hover:text-rose-700">
                                <Trash2 size={13} />
                              </button>
                            </div>
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
              {dirty && <p className="mt-3 text-sm text-violet-700 print:hidden">{tr("Сақталмаған өзгерістер бар — «Сақтау» батырмасын басыңыз.")}</p>}
            </article>
          )}
        </section>
      </div>
    </div>
  );
}
