import { AlertTriangle, Database, Gauge, RefreshCw, Save, SlidersHorizontal, Sparkles, Zap } from "lucide-react";
import { useState } from "react";
import { Loading } from "../components/Loading";
import { Card } from "../components/ui";
import { tr, uiLocale } from "../i18n";
import { KIND_LABEL, timeAgo, type ProjectKind } from "../lib/projects";
import { DB_FREE_BYTES, DEFAULT_LIMITS, getLimits, getUsageStats, saveLimits, toolLabel, type AiLimits } from "../lib/usage";
import { useLoad } from "../lib/useLoad";

const pct = (a: number, b: number) => (b > 0 ? Math.min(100, Math.round((a / b) * 100)) : 0);
const tone = (p: number) => (p >= 85 ? "bg-rose-500" : p >= 60 ? "bg-amber-500" : "bg-emerald-500");
const mb = (bytes: number) => `${(bytes / 1024 / 1024).toFixed(bytes < 100 * 1024 * 1024 ? 1 : 0)} MB`;

function Meter({ value, max }: { value: number; max: number }) {
  const p = pct(value, max);
  return (
    <div className="mt-3 h-2 overflow-hidden rounded-full bg-slate-100" role="meter" aria-valuenow={value} aria-valuemin={0} aria-valuemax={max}>
      <div className={`h-full rounded-full ${tone(p)}`} style={{ width: `${Math.max(p, value ? 3 : 0)}%` }} />
    </div>
  );
}

function LimitInput({ label, hint, value, min = 1, onChange }: { label: string; hint: string; value: number; min?: number; onChange: (v: number) => void }) {
  return (
    <label className="block">
      <span className="mb-1.5 block text-[13px] font-semibold text-slate-600">{label}</span>
      <input
        type="number"
        min={min}
        max={100000}
        value={value}
        onChange={(e) => onChange(Math.max(min, Math.floor(Number(e.target.value) || 0)))}
        className="w-full rounded-lg border border-slate-200 bg-slate-50 px-3 py-2 text-sm text-slate-800 outline-none focus:border-violet-500"
      />
      <span className="mt-1 block text-[12px] text-slate-500">{hint}</span>
    </label>
  );
}

/** Әкімші: AI қолдану статистикасы және тегін лимиттерге жақындығы. */
export default function AdminUsagePage() {
  const { data, error, loading, reload } = useLoad(() => getUsageStats(30));
  const saved = useLoad(getLimits);
  const lim: AiLimits = saved.data?.limits ?? DEFAULT_LIMITS;
  const [draft, setDraft] = useState<AiLimits | null>(null);
  const form = draft ?? lim;
  const [limitMsg, setLimitMsg] = useState<{ ok: boolean; text: string } | null>(null);
  const [savingLimits, setSavingLimits] = useState(false);
  const dayLimit = lim.day;
  const minLimit = lim.minute;

  async function submitLimits() {
    setSavingLimits(true);
    setLimitMsg(null);
    try {
      await saveLimits(form);
      await saved.reload();
      setDraft(null);
      setLimitMsg({ ok: true, text: tr("Лимиттер сақталды.") });
    } catch (e) {
      setLimitMsg({ ok: false, text: e instanceof Error ? e.message : tr("Сақтау мүмкін болмады.") });
    } finally {
      setSavingLimits(false);
    }
  }

  const month = data?.daily.reduce((s, d) => s + d.total, 0) ?? 0;
  const busiest = Math.max(0, ...(data?.daily.map((d) => d.total) ?? [0]));
  // Бағандар ең көп күнге қарай; лимит сызығы сол шкалаға сыйса ғана көрінеді.
  const maxDay = Math.max(1, busiest);
  const warnings: string[] = [];
  if (data) {
    if (pct(data.today.total, dayLimit) >= 80 || pct(busiest, dayLimit) >= 80) warnings.push(tr("Күндік генерация саны тегін лимитке жақындады."));
    if (data.peak_minute_today >= minLimit) warnings.push(tr("Бір минуттағы сұраныс саны лимитке жетті — бірнеше мұғалім қатар генерацияласа, «тым жиі сұраныс» қатесі шығуы мүмкін."));
    if (data.today.failed > 0) warnings.push(tr("Бүгін {n} генерация сәтсіз аяқталды.", { n: data.today.failed }));
    if (pct(data.db_bytes, DB_FREE_BYTES) >= 80) warnings.push(tr("Дерекқор тегін көлемге (500 MB) жақындады."));
  }

  return (
    <div className="mx-auto max-w-[1200px] px-4 py-9 sm:px-10">
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <h1 className="text-[28px] font-bold">{tr("Статистика")}</h1>
          <p className="mt-1.5 max-w-[680px] text-[14.5px] text-slate-500">
            {tr("AI генерациясы қанша қолданылады, кім қанша қолданады және тегін лимиттерге қаншалықты жақынсыз. Лимит сандарын Google AI Studio → Usage / Rate limits бетінен қарап, төменге жазыңыз.")}
          </p>
        </div>
        <button
          type="button"
          onClick={() => void reload()}
          className="inline-flex items-center gap-2 rounded-[11px] border border-slate-200 bg-surface px-3.5 py-2.5 text-sm font-semibold hover:border-violet-500 hover:text-violet-600"
        >
          <RefreshCw size={15} className={loading ? "animate-spin" : ""} /> {tr("Жаңарту")}
        </button>
      </div>

      {loading && !data ? (
        <Loading className="mt-8" />
      ) : error ? (
        <p role="alert" className="mt-8 rounded-xl bg-rose-50 px-4 py-3 text-sm text-rose-700">
          {error}
        </p>
      ) : (
        data && (
          <>
            {warnings.length > 0 && (
              <div role="status" className="mt-7 flex gap-3 rounded-[18px] border border-amber-200 bg-amber-50 px-5 py-4 text-amber-900">
                <AlertTriangle size={20} className="mt-0.5 shrink-0" />
                <div className="text-sm">
                  {warnings.map((w) => (
                    <p key={w}>{w}</p>
                  ))}
                  <p className="mt-1.5 font-semibold">{tr("Ұсыныс: Google AI Studio-да ақылы тарифті (billing) қосыңыз — лимиттер бірден көбейеді, ақысы қолданғанына қарай.")}</p>
                </div>
              </div>
            )}
            {month === 0 && (
              <div className="mt-7 rounded-[18px] border border-violet-200 bg-violet-50 px-5 py-4 text-sm text-violet-900">
                {tr("Әзірге жазба жоқ. Статистика жиналуы үшін Supabase-те ai-generate функциясын жаңа кодпен қайта жариялаңыз (supabase/README.md, 2к-бөлім).")}
              </div>
            )}

            <div className="mt-7 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
              <Card>
                <div className="flex items-center gap-2 text-sm font-semibold text-slate-500">
                  <Sparkles size={16} className="text-violet-600" /> {tr("Бүгін генерация")}
                </div>
                <div className="mt-2 text-[28px] font-bold">
                  {data.today.total} <span className="text-base font-semibold text-slate-400">/ {dayLimit}</span>
                </div>
                <Meter value={data.today.total} max={dayLimit} />
              </Card>
              <Card>
                <div className="flex items-center gap-2 text-sm font-semibold text-slate-500">
                  <Zap size={16} className="text-violet-600" /> {tr("Бір минуттағы ең көбі")}
                </div>
                <div className="mt-2 text-[28px] font-bold">
                  {data.peak_minute_today} <span className="text-base font-semibold text-slate-400">/ {minLimit}</span>
                </div>
                <Meter value={data.peak_minute_today} max={minLimit} />
              </Card>
              <Card>
                <div className="flex items-center gap-2 text-sm font-semibold text-slate-500">
                  <Gauge size={16} className="text-violet-600" /> {tr("Бүгінгі сапа")}
                </div>
                <div className="mt-2 text-[28px] font-bold">
                  {data.today.failed} <span className="text-base font-semibold text-slate-400">{tr("сәтсіз")}</span>
                </div>
                <div className="mt-2 text-[13px] text-slate-500">
                  {tr("Қайта жіберілгені: {n}", { n: data.today.retried })}
                  <br />
                  {tr("Токендер: {n}", { n: data.today.tokens.toLocaleString(uiLocale) })}
                </div>
              </Card>
              <Card>
                <div className="flex items-center gap-2 text-sm font-semibold text-slate-500">
                  <Database size={16} className="text-violet-600" /> {tr("Дерекқор көлемі")}
                </div>
                <div className="mt-2 text-[28px] font-bold">
                  {mb(data.db_bytes)} <span className="text-base font-semibold text-slate-400">/ 500 MB</span>
                </div>
                <Meter value={data.db_bytes} max={DB_FREE_BYTES} />
                <div className="mt-3 text-[12.5px] text-slate-500">{tr("Supabase тегін жоспары")}</div>
              </Card>
            </div>

            <Card className="mt-6">
              <h2 className="mb-1 flex items-center gap-2 text-lg font-bold">
                <SlidersHorizontal size={18} className="text-violet-600" /> {tr("Лимиттер")}
              </h2>
              <p className="mb-4 text-[13px] text-slate-500">
                {tr("Тегін тарифте: 3 модель × тәулігіне 20 = 60 генерация, минутына 15. Ортақ лимитті бір мұғалім тауысып қоймауы үшін әр мұғалімге тәуліктік шек қойыңыз (мыс., 60 ÷ 10 мұғалім = 6).")}
              </p>
              <div className="grid gap-4 sm:grid-cols-3">
                <LimitInput label={tr("Тәуліктік лимит (кілт)")} hint={tr("AI Studio → Rate limits: RPD қосындысы")} value={form.day} onChange={(v) => setDraft({ ...form, day: v })} />
                <LimitInput label={tr("Минуттық лимит (кілт)")} hint={tr("AI Studio → Rate limits: RPM қосындысы")} value={form.minute} onChange={(v) => setDraft({ ...form, minute: v })} />
                <LimitInput label={tr("Бір мұғалімге тәулігіне")} hint={tr("0 — шектеусіз. Әкімшіге қолданылмайды.")} min={0} value={form.perUser} onChange={(v) => setDraft({ ...form, perUser: v })} />
              </div>
              <div className="mt-4 flex flex-wrap items-center gap-3">
                <button
                  type="button"
                  onClick={() => void submitLimits()}
                  disabled={savingLimits || !draft}
                  className="inline-flex items-center gap-2 rounded-[11px] bg-violet-600 px-4 py-2.5 text-sm font-semibold text-white disabled:opacity-50"
                >
                  <Save size={15} /> {savingLimits ? tr("Сақталуда...") : tr("Сақтау")}
                </button>
                {limitMsg && <span className={`text-sm ${limitMsg.ok ? "text-emerald-700" : "text-rose-600"}`}>{limitMsg.text}</span>}
                {saved.data && !saved.data.stored && !limitMsg && (
                  <span className="text-sm text-amber-700">{tr("Лимиттерді сақтау үшін Supabase-те supabase/update-14-ai-limits.sql файлын орындаңыз.")}</span>
                )}
              </div>
            </Card>

            <Card className="mt-6">
              <div className="flex flex-wrap items-baseline justify-between gap-2">
                <h2 className="text-lg font-bold">{tr("Соңғы {n} күн", { n: data.days })}</h2>
                <div className="text-sm text-slate-500">
                  {tr("Барлығы: {n}", { n: month })} · {tr("Ең көп күні: {n}", { n: busiest })}
                </div>
              </div>
              <div className="relative mt-5 flex h-44 items-end gap-[3px]" aria-label={tr("Күндер бойынша генерация")}>
                {dayLimit <= maxDay && (
                  <div className="pointer-events-none absolute inset-x-0 border-t border-dashed border-rose-300" style={{ bottom: `${pct(dayLimit, maxDay)}%` }}>
                    <span className="absolute -top-5 right-0 text-[11px] text-rose-500">{tr("лимит")}</span>
                  </div>
                )}
                {data.daily.map((d) => (
                  <div key={d.day} className="group relative flex h-full flex-1 flex-col justify-end" title={`${d.day.slice(8)}.${d.day.slice(5, 7)}: ${d.total}${d.failed ? ` (${d.failed} ✕)` : ""}`}>
                    <div className="w-full rounded-t-[3px] bg-violet-500/85 group-hover:bg-violet-600" style={{ height: `${pct(d.total - d.failed, maxDay)}%` }} />
                    {d.failed > 0 && <div className="w-full bg-rose-400" style={{ height: `${pct(d.failed, maxDay)}%` }} />}
                  </div>
                ))}
              </div>
              <div className="mt-2 flex justify-between text-[11px] text-slate-400">
                <span>{`${data.daily[0]?.day.slice(8)}.${data.daily[0]?.day.slice(5, 7)}`}</span>
                <span>{tr("Бүгін")}</span>
              </div>
            </Card>

            <div className="mt-6 grid gap-6 lg:grid-cols-[1fr_320px]">
              <Card className="min-w-0">
                <h2 className="mb-4 text-lg font-bold">{tr("Мұғалімдер бойынша")}</h2>
                <div className="overflow-x-auto">
                  <table className="w-full min-w-[520px] text-left text-sm">
                    <thead className="text-[12px] text-slate-500 uppercase">
                      <tr>
                        <th className="py-2 pr-3 font-semibold">{tr("Мұғалім")}</th>
                        <th className="px-2 py-2 text-right font-semibold">{tr("Бүгін")}</th>
                        <th className="px-2 py-2 text-right font-semibold">{tr("7 күн")}</th>
                        <th className="px-2 py-2 text-right font-semibold">{tr("30 күн")}</th>
                        <th className="py-2 pl-3 text-right font-semibold">{tr("Соңғы")}</th>
                      </tr>
                    </thead>
                    <tbody>
                      {data.users.map((u) => (
                        <tr key={u.id} className={`border-t border-slate-100 ${u.status !== "active" ? "opacity-50" : ""}`}>
                          <td className="py-2.5 pr-3">
                            <div className="font-semibold">{u.name}</div>
                            <div className="text-[12px] text-slate-500">{u.email}</div>
                          </td>
                          <td className={`px-2 text-right tabular-nums ${lim.perUser && u.today >= lim.perUser ? "font-bold text-rose-600" : ""}`}>
                            {u.today || "—"}
                            {lim.perUser > 0 && u.today > 0 && <span className="text-[11px] font-normal text-slate-400"> / {lim.perUser}</span>}
                          </td>
                          <td className="px-2 text-right tabular-nums">{u.week || "—"}</td>
                          <td className="px-2 text-right font-semibold tabular-nums">{u.month || "—"}</td>
                          <td className="pl-3 text-right text-[12.5px] whitespace-nowrap text-slate-500">{u.last_at ? timeAgo(new Date(u.last_at).getTime()) : tr("қолданбаған")}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </Card>

              <div className="flex flex-col gap-6">
                <Card>
                  <h2 className="mb-3 text-lg font-bold">{tr("Құралдар бойынша")}</h2>
                  {data.tools.length === 0 ? (
                    <p className="text-sm text-slate-500">—</p>
                  ) : (
                    <ul className="flex flex-col gap-2.5">
                      {data.tools.map((t) => (
                        <li key={t.tool}>
                          <div className="flex justify-between text-sm">
                            <span>{toolLabel(t.tool)}</span>
                            <span className="font-semibold tabular-nums">{t.count}</span>
                          </div>
                          <div className="mt-1 h-1.5 overflow-hidden rounded-full bg-slate-100">
                            <div className="h-full rounded-full bg-violet-500" style={{ width: `${pct(t.count, data.tools[0].count)}%` }} />
                          </div>
                        </li>
                      ))}
                    </ul>
                  )}
                </Card>
                <Card>
                  <h2 className="mb-3 text-lg font-bold">{tr("Жасалған материалдар")}</h2>
                  <ul className="grid grid-cols-2 gap-2 text-sm">
                    {(Object.keys(KIND_LABEL) as ProjectKind[]).map((k) => (
                      <li key={k} className="flex justify-between rounded-lg bg-slate-50 px-3 py-2">
                        <span className="text-slate-600">{KIND_LABEL[k]}</span>
                        <span className="font-semibold tabular-nums">{data.projects[k] ?? 0}</span>
                      </li>
                    ))}
                  </ul>
                  {data.models.length > 0 && (
                    <div className="mt-4 text-[12px] text-slate-500">
                      {tr("Модельдер")}: {data.models.map((m) => `${m.model} (${m.count})`).join(", ")}
                    </div>
                  )}
                </Card>
              </div>
            </div>
          </>
        )
      )}
    </div>
  );
}
