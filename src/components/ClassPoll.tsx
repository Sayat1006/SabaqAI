import QRCode from "qrcode";
import { Eye, EyeOff, Lock, LockOpen, QrCode, RotateCcw, Smartphone, Square } from "lucide-react";
import { useCallback, useEffect, useState } from "react";
import { tr, uiLang } from "../i18n";
import { createPoll, getPollState, OPTION_TONES, pollControl, PollError, pollLink, pollsChanged, rubricMax, rubricRows, wordCloud, type Descriptor, type PollKind, type PollOption, type PollState } from "../lib/polls";

// Мұғалімнің QR сауалнамасы: тақтаға QR мен код шығады, оқушылар телефоннан жауап береді,
// нәтиже 2 секунд сайын жаңарады. Белсенді сауалнама осы браузерде есте қалады —
// бетті жаңартсаңыз да жоғалмайды.

const btn = "inline-flex items-center justify-center gap-2 rounded-[12px] border border-slate-200 bg-surface px-3.5 py-2.5 text-sm font-semibold hover:border-violet-500 disabled:opacity-50";
const primary = "inline-flex items-center justify-center gap-2 rounded-[12px] bg-violet-600 px-4 py-2.5 text-sm font-semibold text-white disabled:opacity-60";

const activeKey = (slot: string) => `ainur-poll-active-${slot}`;
function readActive(slot: string): string | null {
  try {
    return localStorage.getItem(activeKey(slot));
  } catch {
    return null;
  }
}
function writeActive(slot: string, id: string | null) {
  try {
    if (id) localStorage.setItem(activeKey(slot), id);
    else localStorage.removeItem(activeKey(slot));
  } catch {
    // жеке режим — белсенді сауалнама тек осы бетте қалады
  }
}

const errText = (e: unknown) =>
  e instanceof PollError
    ? e.code === "setup" || e.code === "unknown"
      ? e.message
      : e.code === "network"
        ? tr("Интернет байланысын тексеріңіз.")
        : e.code === "too_many"
          ? tr("Бір тәулікте тым көп сауалнама жасалды. Ертең қайталаңыз.")
          : tr("Сауалнама табылмады.")
    : tr("Қате шықты. Қайталап көріңіз.");

function QrImage({ url, size }: { url: string; size: number }) {
  const [src, setSrc] = useState("");
  useEffect(() => {
    let alive = true;
    QRCode.toDataURL(url, { width: 640, margin: 1, errorCorrectionLevel: "M", color: { dark: "#1C1B2E", light: "#FFFFFF" } })
      .then((d) => alive && setSrc(d))
      .catch(() => alive && setSrc(""));
    return () => {
      alive = false;
    };
  }, [url]);
  return src ? <img src={src} alt={tr("QR-код: {url}", { url })} width={size} height={size} className="rounded-xl bg-white" /> : <div style={{ width: size, height: size }} />;
}

/* ------------------------------------------------------------ нәтижелер */

export function PollResults({ st, full = false, hideNames = false }: { st: PollState; full?: boolean; hideNames?: boolean }) {
  const n = st.responses.length;
  if (st.kind === "rubric") return <RubricResults st={st} full={full} hideNames={hideNames} />;
  if (st.kind !== "reflection") {
    const tones = OPTION_TONES[st.kind === "traffic" ? "traffic" : st.method] ?? OPTION_TONES.traffic;
    const counts = st.options.map((_, i) => st.responses.filter((r) => r.choice === i).length);
    const pct = (c: number) => (n ? Math.round((c / n) * 100) : 0);
    const avg = st.method === "scale" && n ? st.responses.reduce((s, r) => s + (r.choice ?? 0) + 1, 0) / n : null;
    // Бағдаршам мен «Бас бармақ»: соңғы екі нұсқа — қиналғандар.
    const struggling = (st.kind === "traffic" || st.method === "thumbs") && n > 0 && counts[1] + counts[2] > counts[0];
    const names = (i: number) => st.responses.filter((r) => r.choice === i && r.name).map((r) => r.name);
    return (
      <div className="flex flex-col gap-2.5" aria-label={tr("Нәтиже")}>
        {st.options.map((o, i) => (
          <div key={i} className="flex flex-col gap-1">
            <div className={`flex items-center gap-3 ${full ? "text-2xl" : "text-sm"}`}>
              <span className={`shrink-0 text-center ${full ? "w-12 text-4xl" : "w-7 text-xl"}`}>{o.emoji}</span>
              <span className={`shrink-0 font-semibold ${full ? "w-80" : "w-36 sm:w-44"} truncate`} title={o.label}>
                {o.label}
              </span>
              <div className={`flex-1 overflow-hidden rounded-full bg-slate-100 ${full ? "h-8" : "h-3.5"}`}>
                <div className={`h-full rounded-full transition-all duration-500 ${tones[i % tones.length]}`} style={{ width: `${pct(counts[i])}%` }} />
              </div>
              <span className={`text-right font-bold tabular-nums ${full ? "w-28" : "w-16"}`}>
                {counts[i]} · {pct(counts[i])}%
              </span>
            </div>
            {!hideNames && st.ask_name && names(i).length > 0 && (
              <div className={`flex flex-wrap gap-1.5 ${full ? "pl-16" : "pl-10"}`}>
                {names(i).map((nm, k) => (
                  <span key={k} className={`rounded-full bg-slate-100 font-semibold text-slate-700 ${full ? "px-3 py-1 text-xl" : "px-2 py-0.5 text-xs"}`}>
                    {nm}
                  </span>
                ))}
              </div>
            )}
          </div>
        ))}
        {avg !== null && <div className={`font-semibold text-violet-700 ${full ? "text-2xl" : "text-sm"}`}>{tr("Орташа баға: {n} / 5", { n: avg.toFixed(1) })}</div>}
        {struggling && !full && <p className="rounded-xl bg-amber-50 px-3 py-2 text-sm text-amber-900">{tr("Оқушылардың көбі әлі толық түсінбеді — тақырыпты басқа мысалмен қайта түсіндірген дұрыс.")}</p>}
      </div>
    );
  }

  // Рефлексия: әр сұраққа жауаптар қабырғасы; «Бір сөзбен» әдісінде — сөз бұлты.
  return (
    <div className={`grid gap-4 ${st.prompts.length > 1 && !full ? "sm:grid-cols-2" : ""} ${full && st.prompts.length > 1 ? "grid-cols-2" : ""}`}>
      {st.prompts.map((p, pi) => {
        const answers = st.responses.map((r) => ({ name: r.name, text: (r.texts?.[pi] ?? "").trim() })).filter((a) => a.text);
        const cloud = st.method === "oneword" ? wordCloud(answers.map((a) => a.text)) : null;
        const max = cloud?.[0]?.[1] ?? 1;
        return (
          <div key={pi} className="flex flex-col gap-2 rounded-2xl border border-slate-200 bg-slate-50 p-3">
            <div className={`font-bold ${full ? "text-2xl" : "text-sm"}`}>
              {p} <span className="font-normal text-slate-500">({answers.length})</span>
            </div>
            {cloud ? (
              <div className="flex flex-wrap items-center justify-center gap-x-4 gap-y-1 py-2">
                {cloud.map(([w, c]) => (
                  <span key={w} className="font-bold text-violet-700" style={{ fontSize: `${(full ? 1.6 : 0.95) + (c / max) * (full ? 2.6 : 1.4)}rem`, opacity: 0.55 + (c / max) * 0.45 }}>
                    {w}
                  </span>
                ))}
              </div>
            ) : (
              <ul className={`flex flex-col gap-1.5 overflow-y-auto ${full ? "max-h-[60vh]" : "max-h-72"}`}>
                {answers.map((a, i) => (
                  <li key={i} className={`rounded-xl bg-surface px-3 py-2 shadow-sm ${full ? "text-xl" : "text-sm"}`}>
                    {!hideNames && a.name && <span className="font-semibold text-violet-700">{a.name}: </span>}
                    {a.text}
                  </li>
                ))}
              </ul>
            )}
          </div>
        );
      })}
    </div>
  );
}

/* ------------------------------------------------------------ сауалнама */

export function ClassPoll({
  slot,
  kind,
  method,
  title,
  options,
  prompts,
  full,
  requireNames = false,
  descriptors,
  targets,
  blocked,
  setup,
}: {
  /** Белсенді сауалнаманы есте сақтайтын кілт (карточка бойынша). */
  slot: string;
  kind: PollKind;
  method: string;
  title: string;
  options?: PollOption[];
  prompts?: string[];
  full: boolean;
  /** Оқушылар міндетті түрде аты-жөнін жазады (бағдаршам, рефлексия). */
  requireNames?: boolean;
  /** Дескриптор бойынша бағалау: дескрипторлар мен бағаланатындар (сынып тізімі / топтар). */
  descriptors?: Descriptor[];
  targets?: string[];
  /** Сауалнаманы бастауға болмайтын себеп (мыс. дескриптор жоқ). */
  blocked?: string;
  /** Баптау өрістері: тек сауалнама басталмай тұрғанда көрсетіледі (басталған соң өзгерту әсер етпейді). */
  setup?: React.ReactNode;
}) {
  const [pollId, setPollId] = useState<string | null>(() => readActive(slot));
  const [st, setSt] = useState<PollState | null>(null);
  const [askNameOpt, setAskName] = useState(true);
  const askName = requireNames || askNameOpt;
  const [hideNames, setHideNames] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");

  const setActive = useCallback(
    (id: string | null) => {
      writeActive(slot, id);
      setPollId(id);
      if (!id) setSt(null);
    },
    [slot],
  );

  // Нәтижені 2 секунд сайын жаңартамыз.
  useEffect(() => {
    if (!pollId) return;
    let alive = true;
    let timer = 0;
    const loop = async () => {
      try {
        const s = await getPollState(pollId);
        if (!alive) return;
        setSt(s);
        setError("");
      } catch (e) {
        if (!alive) return;
        if (e instanceof PollError && e.code === "not_found") {
          setActive(null);
          return;
        }
        setError(errText(e));
      }
      if (alive) timer = window.setTimeout(loop, 2000);
    };
    void loop();
    return () => {
      alive = false;
      window.clearTimeout(timer);
    };
  }, [pollId, setActive]);

  async function start() {
    setBusy(true);
    setError("");
    try {
      const p = await createPoll({ kind, method, title: title.trim(), options, prompts, descriptors, targets, askName, lang: uiLang });
      setActive(p.id);
      pollsChanged();
    } catch (e) {
      setError(errText(e));
    } finally {
      setBusy(false);
    }
  }

  async function control(action: "close" | "open" | "reset") {
    if (!pollId) return;
    if (action === "reset" && !window.confirm(tr("Барлық жауапты өшіру керек пе?"))) return;
    setBusy(true);
    try {
      await pollControl(pollId, action);
      setSt(await getPollState(pollId));
    } catch (e) {
      setError(errText(e));
    } finally {
      setBusy(false);
    }
  }

  const errorBox = error && (
    <p role="alert" className="rounded-xl bg-rose-50 px-3 py-2 text-sm text-rose-700">
      {error}
    </p>
  );

  if (!pollId) {
    return (
      <>
      {setup}
      <div className="flex flex-col items-center gap-3 rounded-2xl border-2 border-dashed border-violet-200 bg-violet-50/40 p-5 text-center">
        <Smartphone size={30} className="text-violet-500" />
        <p className="max-w-md text-sm text-slate-600">{tr("Тақтаға QR-код шығады. Оқушылар телефонмен сканерлеп, тіркелусіз жауап береді — нәтиже осы жерде бірден көрінеді.")}</p>
        {requireNames ? (
          <p className="text-sm font-semibold text-violet-800">{tr("Оқушылар аты-жөнін жазып жауап береді — аттары нәтижеде көрінеді.")}</p>
        ) : (
          <label className="flex items-center gap-2 text-sm font-semibold">
            <input type="checkbox" checked={askName} onChange={(e) => setAskName(e.target.checked)} className="h-4 w-4 accent-violet-600" />
            {tr("Аты-жөнін сұрау")}
            <span className="font-normal text-slate-500">({askName ? tr("мұғалім атын көреді") : tr("жауаптар аноним")})</span>
          </label>
        )}
        {blocked && <p className="text-sm font-semibold text-amber-700">{blocked}</p>}
        <button type="button" onClick={() => void start()} disabled={busy || !!blocked} className={primary}>
          <QrCode size={16} /> {busy ? tr("Дайындалуда...") : tr("QR-кодты көрсету")}
        </button>
        {errorBox}
      </div>
      </>
    );
  }

  if (!st) return <div className="animate-pulse py-6 text-center text-slate-500">{errorBox || "…"}</div>;

  const link = pollLink(st.code);
  return (
    <div className="flex flex-col gap-4">
      <div className={`flex flex-col gap-5 ${full ? "lg:flex-row lg:items-start" : "sm:flex-row sm:items-start"}`}>
        <div className="flex shrink-0 flex-col items-center gap-1.5 text-center">
          {st.is_open ? (
            <QrImage url={link} size={full ? 360 : 168} />
          ) : (
            <div className={`flex flex-col items-center justify-center gap-2 rounded-xl bg-slate-100 text-slate-500 ${full ? "h-[360px] w-[360px] text-2xl" : "h-[168px] w-[168px] text-sm"}`}>
              <Lock size={full ? 48 : 28} />
              {tr("Сауалнама жабылды")}
            </div>
          )}
          <div className={`font-mono font-bold tracking-[0.25em] ${full ? "text-5xl" : "text-2xl"}`}>{st.code}</div>
          <div className={`break-all text-slate-500 ${full ? "text-xl" : "text-xs"}`}>{link.replace(/^https?:\/\//, "").replace(/\/p\/\d+$/, "/p")}</div>
        </div>
        <div className="flex min-w-0 flex-1 flex-col gap-3">
          {st.title && <div className={`font-bold ${full ? "text-4xl" : "text-lg"}`}>{st.title}</div>}
          <div className={`inline-flex items-center gap-2 self-start rounded-full bg-violet-100 px-3 py-1 font-semibold text-violet-800 ${full ? "text-2xl" : "text-sm"}`} aria-live="polite">
            <Smartphone size={full ? 24 : 15} /> {tr("Жауап берді: {n}", { n: st.responses.length })}
          </div>
          {st.responses.length ? (
            <PollResults st={st} full={full} hideNames={hideNames} />
          ) : (
            <p className={`text-slate-500 ${full ? "text-2xl" : "text-sm"}`}>{tr("Оқушылардың жауабын күтудеміз…")}</p>
          )}
        </div>
      </div>
      {!full && (
        <div className="flex flex-wrap gap-2">
          {st.is_open ? (
            <button type="button" onClick={() => void control("close")} disabled={busy} className={btn}>
              <Square size={15} /> {tr("Аяқтау")}
            </button>
          ) : (
            <button type="button" onClick={() => void control("open")} disabled={busy} className={btn}>
              <LockOpen size={15} /> {tr("Қайта ашу")}
            </button>
          )}
          <button type="button" onClick={() => void control("reset")} disabled={busy || !st.responses.length} className={btn}>
            <RotateCcw size={15} /> {tr("Жауаптарды тазалау")}
          </button>
          {st.ask_name && (
            <button type="button" onClick={() => setHideNames((v) => !v)} aria-pressed={hideNames} className={btn}>
              {hideNames ? <Eye size={15} /> : <EyeOff size={15} />} {hideNames ? tr("Аттарды көрсету") : tr("Аттарды жасыру")}
            </button>
          )}
          <button
            type="button"
            onClick={() => {
              // Алдыңғы сауалнама жабылады: ескі сілтемемен келгендер «аяқталды» деп көреді.
              if (st.is_open) void pollControl(st.id, "close").catch(() => {});
              setActive(null);
            }}
            className={primary}
          >
            <QrCode size={15} /> {tr("Жаңа сауалнама")}
          </button>
        </div>
      )}
      {errorBox}
    </div>
  );
}

/** Дескриптор бойынша бағалау нәтижесі: бағаланған әр оқушы/топ бойынша кесте және пікірлер. */
function RubricResults({ st, full, hideNames }: { st: PollState; full: boolean; hideNames: boolean }) {
  const d = st.descriptors ?? [];
  const max = rubricMax(d);
  const rows = rubricRows(st);
  const [open, setOpen] = useState<string | null>(null);
  const fmt = (x: number) => (Number.isInteger(x) ? String(x) : x.toFixed(1));
  const tone = (ratio: number) => (ratio >= 0.8 ? "bg-emerald-100 text-emerald-800" : ratio >= 0.5 ? "bg-amber-100 text-amber-900" : "bg-rose-100 text-rose-800");
  const pending = st.method === "group" || st.method === "peer" ? (st.targets ?? []).filter((t) => !rows.some((r) => r.target === t)) : [];
  const who = st.method === "group" ? tr("Топ") : tr("Оқушы");
  return (
    <div className="flex flex-col gap-3">
      <div className="overflow-x-auto rounded-2xl border border-slate-200">
        <table className={`w-full border-collapse ${full ? "text-xl" : "text-sm"}`}>
          <thead className="bg-slate-50 text-left">
            <tr>
              <th className="px-3 py-2 font-semibold">{who}</th>
              {d.map((x, i) => (
                <th key={i} className="px-2 py-2 text-center font-semibold" title={x.text}>
                  D{i + 1}
                </th>
              ))}
              <th className="px-3 py-2 text-center font-semibold">{tr("Балл")}</th>
              {st.method !== "self" && <th className="px-2 py-2 text-center font-semibold">{tr("Бағалады")}</th>}
            </tr>
          </thead>
          <tbody>
            {rows.map((r) => (
              <tr key={r.target} className="border-t border-slate-100">
                <td className="px-3 py-2 font-semibold">
                  <button type="button" onClick={() => setOpen(open === r.target ? null : r.target)} className="text-left hover:text-violet-700" aria-expanded={open === r.target}>
                    {hideNames && st.method !== "group" ? "•••" : r.target}
                  </button>
                </td>
                {d.map((x, i) => (
                  <td key={i} className="px-1.5 py-1.5 text-center">
                    <span className={`inline-block min-w-9 rounded-lg px-1.5 py-0.5 font-bold ${tone(r.avg[i] / x.points)}`}>{fmt(r.avg[i])}</span>
                  </td>
                ))}
                <td className="px-3 py-2 text-center font-bold tabular-nums">
                  {fmt(r.total)} / {max}
                </td>
                {st.method !== "self" && <td className="px-2 py-2 text-center text-slate-500">{r.count}</td>}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <ol className={`flex flex-col gap-0.5 text-slate-600 ${full ? "text-lg" : "text-xs"}`}>
        {d.map((x, i) => (
          <li key={i}>
            <b>D{i + 1}</b> — {x.text} ({x.points} {tr("балл")})
          </li>
        ))}
      </ol>
      {pending.length > 0 && !full && (
        <p className="text-sm text-slate-500">
          {tr("Әлі бағаланбағандар:")} {pending.join(", ")}
        </p>
      )}
      {open &&
        (() => {
          const r = rows.find((x) => x.target === open);
          if (!r) return null;
          return (
            <div className="rounded-2xl border border-violet-200 bg-violet-50/50 p-3">
              <div className={`mb-2 font-bold ${full ? "text-xl" : ""}`}>{r.target}</div>
              <ul className="flex flex-col gap-1.5">
                {r.reviews.map((v, i) => (
                  <li key={i} className={`rounded-xl bg-surface px-3 py-2 ${full ? "text-lg" : "text-sm"}`}>
                    {st.method !== "self" && !hideNames && (
                      <span className="font-semibold text-violet-700">
                        {v.by}
                        {v.group ? ` (${v.group})` : ""}:{" "}
                      </span>
                    )}
                    {v.marks.join(" · ")} = <b>{v.marks.reduce((a, b) => a + b, 0)}</b>
                    {v.comment && <span className="text-slate-600"> — «{v.comment}»</span>}
                  </li>
                ))}
              </ul>
            </div>
          );
        })()}
    </div>
  );
}
