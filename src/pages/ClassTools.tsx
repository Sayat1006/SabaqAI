import { Maximize, Minimize, Pause, Play, Plus, RotateCcw, Shuffle, Sparkles, Trash2, Users } from "lucide-react";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { PageHeader } from "../components/PageHeader";
import { useFullscreen } from "../lib/useFullscreen";
import { tr } from "../i18n";

// Сабақ кезінде тақтаға (проекторға) шығаратын құралдар: таймер, кездейсоқ оқушы, топқа бөлу,
// бағдаршам, шу өлшегіш, рефлексия.
// Сынып тізімдері тек осы құрылғының браузерінде сақталады.

const card = "rounded-3xl border border-slate-200 bg-surface p-5 sm:p-6";
const btn = "inline-flex items-center justify-center gap-2 rounded-[12px] border border-slate-200 bg-surface px-3.5 py-2.5 text-sm font-semibold hover:border-violet-500 disabled:opacity-50";
const primary = "inline-flex items-center justify-center gap-2 rounded-[12px] bg-violet-600 px-4 py-2.5 text-sm font-semibold text-white disabled:opacity-60";
const field = "w-full rounded-xl border border-slate-200 bg-slate-50 px-3 py-2.5 text-sm outline-none focus:border-violet-500";

/* ------------------------------------------------------------ толық экран */

function FullButton({ full, onClick }: { full: boolean; onClick: () => void }) {
  return (
    <button type="button" onClick={onClick} className={btn} aria-label={full ? tr("Толық экраннан шығу") : tr("Толық экран")}>
      {full ? <Minimize size={15} /> : <Maximize size={15} />}
      <span className="hidden sm:inline">{full ? tr("Шығу") : tr("Толық экран")}</span>
    </button>
  );
}

/* ------------------------------------------------------------------ таймер */

function beep() {
  try {
    const Ctx = window.AudioContext ?? (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext;
    const ctx = new Ctx();
    [0, 0.35, 0.7].forEach((t) => {
      const o = ctx.createOscillator();
      const g = ctx.createGain();
      o.frequency.value = 880;
      o.connect(g);
      g.connect(ctx.destination);
      g.gain.setValueAtTime(0.25, ctx.currentTime + t);
      g.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + t + 0.3);
      o.start(ctx.currentTime + t);
      o.stop(ctx.currentTime + t + 0.3);
    });
    window.setTimeout(() => void ctx.close(), 1500);
  } catch {
    // дыбыс қолжетімсіз — үнсіз
  }
}

const fmt = (ms: number) => {
  const s = Math.max(0, Math.ceil(ms / 1000));
  return `${String(Math.floor(s / 60)).padStart(2, "0")}:${String(s % 60).padStart(2, "0")}`;
};

function Timer() {
  const { ref, full, toggle } = useFullscreen();
  const [total, setTotal] = useState(5 * 60 * 1000);
  const [left, setLeft] = useState(total);
  const [endAt, setEndAt] = useState<number | null>(null);
  const [done, setDone] = useState(false);
  const [custom, setCustom] = useState("");

  useEffect(() => {
    if (endAt === null) return;
    const id = window.setInterval(() => {
      const rest = endAt - Date.now();
      if (rest <= 0) {
        setLeft(0);
        setEndAt(null);
        setDone(true);
        beep();
      } else setLeft(rest);
    }, 200);
    return () => window.clearInterval(id);
  }, [endAt]);

  const set = (ms: number) => {
    setEndAt(null);
    setDone(false);
    setTotal(ms);
    setLeft(ms);
  };
  const start = () => {
    if (left <= 0) return;
    setDone(false);
    setEndAt(Date.now() + left);
  };
  const pause = () => setEndAt(null);
  const addMinute = () => {
    setDone(false);
    setTotal((t) => t + 60000);
    if (endAt) setEndAt(endAt + 60000);
    else setLeft((l) => l + 60000);
  };
  function applyCustom(e: React.FormEvent) {
    e.preventDefault();
    const m = custom.trim().match(/^(\d{1,3})(?::(\d{1,2}))?$/);
    if (!m) return;
    const ms = (Number(m[1]) * 60 + Number(m[2] ?? 0)) * 1000;
    if (ms > 0) set(ms);
  }

  const running = endAt !== null;
  const progress = total ? left / total : 0;
  const warn = left <= 60000 && left > 0;

  return (
    <div ref={ref} className={`${card} flex flex-col gap-4 ${full ? "items-center justify-center !rounded-none !border-0" : ""}`}>
      <div className="flex w-full items-center justify-between gap-2">
        <h2 className="text-lg font-bold">{tr("⏱ Таймер")}</h2>
        <FullButton full={full} onClick={toggle} />
      </div>

      <div className={`relative mx-auto flex aspect-square w-full items-center justify-center ${full ? "max-w-[70vh]" : "max-w-[280px]"}`}>
        <svg viewBox="0 0 100 100" className="absolute inset-0 -rotate-90">
          <circle cx="50" cy="50" r="45" fill="none" stroke="currentColor" strokeWidth="6" className="text-slate-100" />
          <circle
            cx="50"
            cy="50"
            r="45"
            fill="none"
            strokeWidth="6"
            strokeLinecap="round"
            strokeDasharray={2 * Math.PI * 45}
            strokeDashoffset={2 * Math.PI * 45 * (1 - progress)}
            className={`transition-[stroke-dashoffset] duration-200 ${done ? "stroke-rose-500" : warn ? "stroke-fuchsia-500" : "stroke-violet-600"}`}
          />
        </svg>
        <div className={`font-bold tabular-nums ${done ? "animate-pulse text-rose-600" : ""} ${full ? "text-[18vh]" : "text-6xl"}`}>{done ? "00:00" : fmt(left)}</div>
      </div>
      {done && <div className={`text-center font-bold text-rose-600 ${full ? "text-4xl" : "text-lg"}`}>{tr("Уақыт бітті!")}</div>}

      <div className="flex flex-wrap justify-center gap-2">
        {running ? (
          <button type="button" onClick={pause} className={primary}>
            <Pause size={16} /> {tr("Кідірту")}
          </button>
        ) : (
          <button type="button" onClick={start} disabled={left <= 0} className={primary}>
            <Play size={16} /> {left < total && left > 0 ? tr("Жалғастыру") : tr("Бастау")}
          </button>
        )}
        <button type="button" onClick={() => set(total)} className={btn}>
          <RotateCcw size={15} /> {tr("Қайта")}
        </button>
        <button type="button" onClick={addMinute} className={btn}>
          <Plus size={15} /> {tr("1 мин")}
        </button>
      </div>

      {!full && (
        <>
          <div className="flex flex-wrap justify-center gap-2">
            {[1, 2, 3, 5, 7, 10, 15, 20].map((m) => (
              <button
                key={m}
                type="button"
                onClick={() => set(m * 60000)}
                className={`rounded-full border px-3 py-1.5 text-sm ${total === m * 60000 ? "border-violet-600 bg-violet-600 text-white" : "border-slate-200 hover:border-violet-500"}`}
              >
                {tr("{n} мин", { n: m })}
              </button>
            ))}
          </div>
          <form onSubmit={applyCustom} className="flex gap-2">
            <input value={custom} onChange={(e) => setCustom(e.target.value)} placeholder={tr("Өз уақытыңыз: мыс. 4:30")} aria-label={tr("Өз уақытыңыз")} className={field} />
            <button type="submit" className={btn}>
              {tr("Қою")}
            </button>
          </form>
        </>
      )}
    </div>
  );
}

/* ----------------------------------------------------------- сынып тізімі */

interface ClassList {
  id: string;
  name: string;
  students: string[];
}

const STORE_KEY = "ainur-class-lists";

function loadLists(): ClassList[] {
  try {
    const raw = JSON.parse(localStorage.getItem(STORE_KEY) ?? "[]");
    return Array.isArray(raw) ? raw.filter((l) => l && Array.isArray(l.students)) : [];
  } catch {
    return [];
  }
}

function saveLists(lists: ClassList[]) {
  try {
    localStorage.setItem(STORE_KEY, JSON.stringify(lists));
  } catch {
    // сақтау мүмкін емес (жеке режим) — тізім тек осы сессияда қалады
  }
}

const parseNames = (t: string) =>
  t
    .split(/\n|,|;/)
    .map((x) => x.replace(/^\s*\d+[.)]\s*/, "").trim())
    .filter(Boolean)
    .slice(0, 60);

function shuffle<T>(a: T[]): T[] {
  const r = [...a];
  for (let i = r.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [r[i], r[j]] = [r[j], r[i]];
  }
  return r;
}

function ClassListEditor({ lists, activeId, onSelect, onChange }: { lists: ClassList[]; activeId: string; onSelect: (id: string) => void; onChange: (l: ClassList[]) => void }) {
  const active = lists.find((l) => l.id === activeId);
  const [name, setName] = useState(active?.name ?? "");
  const [text, setText] = useState(active?.students.join("\n") ?? "");

  function save() {
    const students = parseNames(text);
    if (!students.length) return;
    const title = name.trim() || tr("Менің сыныбым");
    if (active) onChange(lists.map((l) => (l.id === active.id ? { ...l, name: title, students } : l)));
    else {
      const id = Date.now().toString(36);
      onChange([...lists, { id, name: title, students }]);
      onSelect(id);
    }
  }

  return (
    <div className={`${card} flex flex-col gap-3`}>
      <div className="flex flex-wrap items-center justify-between gap-2">
        <h2 className="flex items-center gap-2 text-lg font-bold">
          <Users size={18} className="text-violet-600" /> {tr("Сынып тізімі")}
        </h2>
        <select value={activeId} onChange={(e) => onSelect(e.target.value)} aria-label={tr("Сыныпты таңдау")} className="rounded-xl border border-slate-200 bg-surface px-3 py-2 text-sm">
          <option value="">{tr("+ Жаңа тізім")}</option>
          {lists.map((l) => (
            <option key={l.id} value={l.id}>
              {l.name} ({l.students.length})
            </option>
          ))}
        </select>
      </div>
      <input value={name} onChange={(e) => setName(e.target.value)} placeholder={tr("Сынып атауы, мыс.: 7А")} aria-label={tr("Сынып атауы")} className={field} />
      <textarea
        value={text}
        onChange={(e) => setText(e.target.value)}
        rows={7}
        placeholder={tr("Оқушылардың аты-жөні — әр жолға біреуден\nАйгерім Сейітова\nБолат Ахметов\n...")}
        aria-label={tr("Оқушылар тізімі")}
        className={`${field} resize-y`}
      />
      <div className="flex flex-wrap gap-2">
        <button type="button" onClick={save} disabled={!parseNames(text).length} className={primary}>
          {tr("Сақтау")}
        </button>
        {active && (
          <button
            type="button"
            onClick={() => {
              if (!window.confirm(tr("«{name}» тізімін өшіру керек пе?", { name: active.name }))) return;
              onChange(lists.filter((l) => l.id !== active.id));
              onSelect("");
            }}
            className={btn}
          >
            <Trash2 size={15} /> {tr("Өшіру")}
          </button>
        )}
      </div>
      <p className="text-xs text-slate-500">{tr("Тізім тек осы құрылғыда сақталады. Excel-ден бағанды көшіріп қоюға болады.")}</p>
    </div>
  );
}

/* ------------------------------------------------------ кездейсоқ оқушы */

function RandomPicker({ students }: { students: string[] }) {
  const { ref, full, toggle } = useFullscreen();
  const [shown, setShown] = useState("");
  const [spinning, setSpinning] = useState(false);
  const [noRepeat, setNoRepeat] = useState(true);
  const [picked, setPicked] = useState<string[]>([]);
  const timer = useRef<number | null>(null);

  const pool = useMemo(() => (noRepeat ? students.filter((s) => !picked.includes(s)) : students), [students, picked, noRepeat]);

  useEffect(() => () => {
    if (timer.current) window.clearTimeout(timer.current);
  }, []);

  const pick = useCallback(() => {
    if (!pool.length || spinning) return;
    const winner = pool[Math.floor(Math.random() * pool.length)];
    setSpinning(true);
    let step = 0;
    const steps = 18;
    const tick = () => {
      step++;
      if (step >= steps) {
        setShown(winner);
        setPicked((p) => [...p, winner]);
        setSpinning(false);
        return;
      }
      setShown(students[Math.floor(Math.random() * students.length)]);
      timer.current = window.setTimeout(tick, 50 + step * step * 1.2);
    };
    tick();
  }, [pool, spinning, students]);

  return (
    <div ref={ref} className={`${card} flex flex-col gap-4 ${full ? "items-center justify-center !rounded-none !border-0" : ""}`}>
      <div className="flex w-full items-center justify-between gap-2">
        <h2 className="text-lg font-bold">{tr("🎯 Кездейсоқ оқушы")}</h2>
        <FullButton full={full} onClick={toggle} />
      </div>
      <div
        aria-live="polite"
        className={`flex w-full items-center justify-center rounded-2xl bg-gradient-to-br from-violet-100 to-fuchsia-100 px-4 text-center font-bold ${full ? "min-h-[45vh] text-[9vh]" : "min-h-[140px] text-3xl"} ${spinning ? "text-slate-500" : "text-slate-900"}`}
      >
        {shown || (students.length ? "?" : tr("Алдымен сынып тізімін енгізіңіз"))}
      </div>
      <div className="flex flex-wrap justify-center gap-2">
        <button type="button" onClick={pick} disabled={!pool.length || spinning} className={primary}>
          <Sparkles size={16} /> {pool.length ? tr("Таңдау") : tr("Барлығы таңдалды")}
        </button>
        <button
          type="button"
          onClick={() => {
            setPicked([]);
            setShown("");
          }}
          className={btn}
        >
          <RotateCcw size={15} /> {tr("Басынан")}
        </button>
      </div>
      {!full && (
        <>
          <label className="flex items-center justify-center gap-2 text-sm">
            <input type="checkbox" checked={noRepeat} onChange={(e) => setNoRepeat(e.target.checked)} className="h-4 w-4 accent-violet-600" />
            {tr("Қайталамау (таңдалған оқушы қайта шықпайды)")}
          </label>
          {picked.length > 0 && (
            <div className="text-center text-sm text-slate-500">
              {tr("Таңдалғандар ({a}/{b}):", { a: picked.length, b: students.length })} {picked.join(", ")}
            </div>
          )}
        </>
      )}
    </div>
  );
}

/* ------------------------------------------------------------ топқа бөлу */

function GroupMaker({ students }: { students: string[] }) {
  const { ref, full, toggle } = useFullscreen();
  const [count, setCount] = useState(4);
  const [groups, setGroups] = useState<string[][]>([]);

  function make() {
    const n = Math.min(Math.max(count, 2), Math.max(2, students.length));
    const out: string[][] = Array.from({ length: n }, () => []);
    shuffle(students).forEach((s, i) => out[i % n].push(s));
    setGroups(out);
  }

  const colors = ["bg-violet-100", "bg-fuchsia-100", "bg-slate-100", "bg-amber-50", "bg-emerald-50", "bg-sky-50"];

  return (
    <div ref={ref} className={`${card} flex flex-col gap-4 ${full ? "!rounded-none !border-0 p-10" : ""}`}>
      <div className="flex items-center justify-between gap-2">
        <h2 className="text-lg font-bold">{tr("👥 Топқа бөлу")}</h2>
        <FullButton full={full} onClick={toggle} />
      </div>
      <div className="flex flex-wrap items-center gap-2">
        <span className="text-sm text-slate-500">{tr("Топ саны:")}</span>
        {[2, 3, 4, 5, 6].map((n) => (
          <button
            key={n}
            type="button"
            aria-pressed={count === n}
            onClick={() => setCount(n)}
            className={`h-9 w-9 rounded-full border text-sm ${count === n ? "border-violet-600 bg-violet-600 text-white" : "border-slate-200 hover:border-violet-500"}`}
          >
            {n}
          </button>
        ))}
        <button type="button" onClick={make} disabled={students.length < 2} className={`${primary} ml-auto`}>
          <Shuffle size={16} /> {tr("Бөлу")}
        </button>
      </div>
      {groups.length > 0 ? (
        <div className={`grid gap-3 ${full ? "grid-cols-3" : "sm:grid-cols-2"}`}>
          {groups.map((g, i) => (
            <div key={i} className={`rounded-2xl p-4 ${colors[i % colors.length]}`}>
              <div className={`mb-2 font-bold ${full ? "text-3xl" : ""}`}>
                {tr("{n}-топ", { n: i + 1 })} <span className="text-sm font-normal text-slate-500">({g.length})</span>
              </div>
              <ul className={`flex flex-col gap-0.5 ${full ? "text-2xl" : "text-sm"}`}>
                {g.map((s) => (
                  <li key={s}>{s}</li>
                ))}
              </ul>
            </div>
          ))}
        </div>
      ) : (
        <p className="text-sm text-slate-500">{students.length < 2 ? tr("Алдымен сынып тізімін енгізіңіз.") : tr("«Бөлу» батырмасын басыңыз — оқушылар кездейсоқ топтарға бөлінеді.")}</p>
      )}
    </div>
  );
}

/* -------------------------------------------------------------- бағдаршам */

const LIGHTS = [
  { key: "green", emoji: "🟢", label: tr("Түсіндім"), bar: "bg-emerald-500", tile: "bg-emerald-50 border-emerald-200 hover:border-emerald-400" },
  { key: "yellow", emoji: "🟡", label: tr("Сұрағым бар"), bar: "bg-amber-400", tile: "bg-amber-50 border-amber-200 hover:border-amber-400" },
  { key: "red", emoji: "🔴", label: tr("Көмек керек"), bar: "bg-rose-500", tile: "bg-rose-50 border-rose-200 hover:border-rose-400" },
] as const;

type LightKey = (typeof LIGHTS)[number]["key"];

function TrafficLight() {
  const { ref, full, toggle } = useFullscreen();
  const [counts, setCounts] = useState<Record<LightKey, number>>({ green: 0, yellow: 0, red: 0 });
  const [question, setQuestion] = useState("");
  const total = counts.green + counts.yellow + counts.red;
  const pct = (n: number) => (total ? Math.round((n / total) * 100) : 0);
  const add = (k: LightKey, d: number) => setCounts((c) => ({ ...c, [k]: Math.max(0, c[k] + d) }));

  return (
    <div ref={ref} className={`${card} flex flex-col gap-4 ${full ? "justify-center !rounded-none !border-0 p-10" : ""}`}>
      <div className="flex items-center justify-between gap-2">
        <h2 className="text-lg font-bold">{tr("🚦 Бағдаршам")}</h2>
        <FullButton full={full} onClick={toggle} />
      </div>
      {full ? (
        question && <div className="text-center text-4xl font-bold">{question}</div>
      ) : (
        <input value={question} onChange={(e) => setQuestion(e.target.value)} placeholder={tr("Сұрақ немесе тақырып (міндетті емес)")} aria-label={tr("Бағдаршам сұрағы")} className={field} />
      )}
      <div className="grid grid-cols-3 gap-2 sm:gap-3">
        {LIGHTS.map((l) => (
          <div key={l.key} className="flex flex-col gap-1.5">
            <button
              type="button"
              onClick={() => add(l.key, 1)}
              aria-label={`${l.label}: +1`}
              className={`flex flex-col items-center gap-1 rounded-2xl border-2 px-1 py-3 transition active:scale-95 ${l.tile}`}
            >
              <span className={full ? "text-7xl" : "text-4xl"}>{l.emoji}</span>
              <span className={`font-bold tabular-nums ${full ? "text-7xl" : "text-3xl"}`}>{counts[l.key]}</span>
              <span className={`text-center font-semibold ${full ? "text-2xl" : "text-xs sm:text-sm"}`}>{l.label}</span>
            </button>
            <button type="button" onClick={() => add(l.key, -1)} disabled={!counts[l.key]} aria-label={`${l.label}: −1`} className="rounded-lg py-1 text-sm text-slate-500 hover:bg-slate-100 disabled:opacity-40">
              −1
            </button>
          </div>
        ))}
      </div>
      <div className="flex flex-col gap-2" aria-label={tr("Нәтиже пайызы")}>
        {LIGHTS.map((l) => (
          <div key={l.key} className={`flex items-center gap-3 ${full ? "text-2xl" : "text-sm"}`}>
            <span className="w-6 text-center">{l.emoji}</span>
            <div className={`flex-1 overflow-hidden rounded-full bg-slate-100 ${full ? "h-6" : "h-3"}`}>
              <div className={`h-full rounded-full transition-all duration-300 ${l.bar}`} style={{ width: `${pct(counts[l.key])}%` }} />
            </div>
            <span className="w-12 text-right font-bold tabular-nums">{pct(counts[l.key])}%</span>
          </div>
        ))}
      </div>
      <div className="flex flex-wrap items-center justify-between gap-2">
        <span className="text-sm text-slate-500">{tr("Барлығы:")} {total} {tr("оқушы")}</span>
        <button type="button" onClick={() => setCounts({ green: 0, yellow: 0, red: 0 })} disabled={!total} className={btn}>
          <RotateCcw size={15} /> {tr("Тазалау")}
        </button>
      </div>
      {!full && total > 0 && counts.red + counts.yellow > counts.green && (
        <p className="rounded-xl bg-amber-50 px-3 py-2 text-sm text-amber-900">{tr("Оқушылардың көбі әлі толық түсінбеді — тақырыпты басқа мысалмен қайта түсіндірген дұрыс.")}</p>
      )}
    </div>
  );
}

/* ------------------------------------------------------------ шу өлшегіш */

// Микрофон дыбысы тек осы құрылғыда өлшенеді, еш жерге жазылмайды және жіберілмейді.
function NoiseMeter() {
  const { ref, full, toggle } = useFullscreen();
  const [on, setOn] = useState(false);
  const [level, setLevel] = useState(0);
  const [limit, setLimit] = useState(60);
  const [loud, setLoud] = useState(false);
  const [error, setError] = useState("");
  const stop = useRef<(() => void) | null>(null);
  const limitRef = useRef(limit);

  useEffect(() => {
    limitRef.current = limit;
  }, [limit]);
  useEffect(() => () => stop.current?.(), []);

  async function start() {
    setError("");
    if (!navigator.mediaDevices?.getUserMedia) {
      setError(tr("Бұл браузер микрофонды қолдамайды. Chrome немесе Safari-дің жаңа нұсқасын қолданыңыз."));
      return;
    }
    let stream: MediaStream;
    try {
      stream = await navigator.mediaDevices.getUserMedia({ audio: { echoCancellation: false, noiseSuppression: false, autoGainControl: false } });
    } catch (e) {
      const name = e instanceof DOMException ? e.name : "";
      setError(
        name === "NotAllowedError" || name === "SecurityError"
          ? tr("Микрофонға рұқсат берілмеді. Браузердің мекенжай жолағындағы 🔒 белгісін басып, микрофонға рұқсат беріңіз.")
          : name === "NotFoundError"
            ? tr("Микрофон табылмады. Құрылғыға микрофон жалғаңыз.")
            : tr("Микрофонды қосу мүмкін болмады."),
      );
      return;
    }
    const Ctx = window.AudioContext ?? (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext;
    const ctx = new Ctx();
    // Кейбір браузерлер (әсіресе iOS Safari) AudioContext-ті тоқтатулы күйде ашады.
    if (ctx.state === "suspended") await ctx.resume().catch(() => undefined);
    const analyser = ctx.createAnalyser();
    analyser.fftSize = 2048;
    ctx.createMediaStreamSource(stream).connect(analyser);
    const buf = new Float32Array(analyser.fftSize);
    let smooth = 0;
    let over = 0;
    const id = window.setInterval(() => {
      analyser.getFloatTimeDomainData(buf);
      let sum = 0;
      for (const v of buf) sum += v * v;
      const db = 20 * Math.log10(Math.sqrt(sum / buf.length) || 1e-8);
      // −70 дБ (тыныш) … −10 дБ (өте шулы) → 0…100
      const value = Math.min(100, Math.max(0, ((db + 70) / 60) * 100));
      smooth = smooth * 0.7 + value * 0.3;
      setLevel(Math.round(smooth));
      over = smooth > limitRef.current ? Math.min(over + 1, 20) : Math.max(over - 1, 0);
      setLoud(over >= 6);
    }, 100);
    stop.current = () => {
      window.clearInterval(id);
      stream.getTracks().forEach((t) => t.stop());
      void ctx.close();
      stop.current = null;
    };
    setOn(true);
  }

  function turnOff() {
    stop.current?.();
    setOn(false);
    setLevel(0);
    setLoud(false);
  }

  const face = !on ? "🎙️" : loud ? "🙉" : level > limit * 0.75 ? "😐" : "😊";
  const barColor = level > limit ? "bg-rose-500" : level > limit * 0.75 ? "bg-amber-400" : "bg-emerald-500";

  return (
    <div
      ref={ref}
      className={`${card} flex flex-col gap-4 transition-colors ${loud ? "!border-rose-300 !bg-rose-50" : ""} ${full ? "items-center justify-center !rounded-none !border-0" : ""}`}
    >
      <div className="flex w-full items-center justify-between gap-2">
        <h2 className="text-lg font-bold">{tr("🔊 Шу өлшегіш")}</h2>
        <FullButton full={full} onClick={toggle} />
      </div>
      <div className={`text-center ${full ? "text-[22vh]" : "text-7xl"}`} aria-hidden>
        {face}
      </div>
      <div className={`text-center font-bold ${loud ? "animate-pulse text-rose-600" : "text-slate-700"} ${full ? "text-6xl" : "text-xl"}`} aria-live="polite">
        {!on ? tr("Микрофон өшірулі") : loud ? tr("Тынышырақ, өтінем!") : level > limit * 0.75 ? tr("Сәл тынышырақ") : tr("Жақсы, тыныш")}
      </div>
      <div className={`relative w-full overflow-hidden rounded-full bg-slate-100 ${full ? "h-12 max-w-[80vw]" : "h-6"}`} role="meter" aria-valuemin={0} aria-valuemax={100} aria-valuenow={level} aria-label={tr("Шу деңгейі")}>
        <div className={`h-full rounded-full transition-[width] duration-100 ${barColor}`} style={{ width: `${level}%` }} />
        <div className="absolute top-0 h-full w-1 bg-slate-800" style={{ left: `${limit}%` }} title={tr("Шек")} />
      </div>
      <div className="flex flex-wrap justify-center gap-2">
        {on ? (
          <button type="button" onClick={turnOff} className={primary}>
            <Pause size={16} /> {tr("Тоқтату")}
          </button>
        ) : (
          <button type="button" onClick={start} className={primary}>
            <Play size={16} /> {tr("Бастау")}
          </button>
        )}
      </div>
      {!full && (
        <>
          <label className="flex items-center gap-3 text-sm">
            <span className="shrink-0 text-slate-500">{tr("Шек:")} {limit}</span>
            <input type="range" min={20} max={95} value={limit} onChange={(e) => setLimit(Number(e.target.value))} className="w-full accent-violet-600" aria-label={tr("Шу шегі")} />
          </label>
          {error ? (
            <p className="rounded-xl bg-rose-50 px-3 py-2 text-sm text-rose-700">{error}</p>
          ) : (
            <p className="text-xs text-slate-500">{tr("Сынып шуы қара сызықтан асса, экран қызарып ескертеді. Дыбыс жазылмайды және ешқайда жіберілмейді.")}</p>
          )}
        </>
      )}
    </div>
  );
}

/* -------------------------------------------------------------- рефлексия */

const REFLECTIONS = [
  { name: tr("Екі жұлдыз, бір тілек"), prompts: [tr("⭐ Сабақта маған ұнағаны…"), tr("⭐ Бүгін мен жақсы орындадым…"), tr("🙏 Келесі сабақта қалайтыным…")] },
  { name: tr("Аяқталмаған сөйлем"), prompts: [tr("Бүгін мен білдім…"), tr("Маған қиын болды…"), tr("Енді мен … аламын"), tr("Мені таң қалдырғаны…")] },
  { name: "3-2-1", prompts: [tr("3️⃣ Бүгін білген үш жаңа нәрсе"), tr("2️⃣ Маған қызық болған екі дерек"), tr("1️⃣ Әлі де қойғым келетін бір сұрақ")] },
  {
    name: tr("Бес саусақ"),
    prompts: [tr("👍 Бас бармақ — маған не ұнады?"), tr("☝️ Сұқ саусақ — не үйрендім?"), tr("✋ Ортаңғы саусақ — көңіл-күйім қандай болды?"), tr("💍 Атсыз саусақ — кімге көмектестім, маған кім көмектесті?"), tr("🤙 Шынашақ — әлі не білгім келеді?")],
  },
  { name: tr("Бағдаршам"), prompts: [tr("🟢 Бәрін түсіндім, өзгелерге түсіндіре аламын"), tr("🟡 Түсіндім, бірақ сұрақтарым бар"), tr("🔴 Түсінбедім, көмек керек")] },
  { name: tr("Бір сөзбен"), prompts: [tr("Бүгінгі сабақты бір сөзбен сипаттаңыз"), tr("Бүгінгі көңіл-күйіңізді бір сөзбен айтыңыз")] },
];

const QUESTIONS = [
  tr("Бүгінгі сабақтың ең маңызды ойы не болды?"),
  tr("Бүгінгі білімді өмірде қай жерде қолданасыз?"),
  tr("Қай тапсырма ең қиын болды? Неліктен?"),
  tr("Бүгін сыныптасыңыздан не үйрендіңіз?"),
  tr("Тақырыпты інішегіңізге қалай түсіндірер едіңіз?"),
  tr("Сабақта өзіңізді қалай бағалайсыз: 1-ден 5-ке дейін? Неге?"),
  tr("Келесі сабақта нені қайталағыңыз келеді?"),
  tr("Бүгінгі сабақта не сізді таң қалдырды?"),
  tr("Қателескен жеріңіз болды ма? Одан не түйдіңіз?"),
  tr("Бүгінгі тақырып бойынша өзіңізге бір сұрақ қойыңыз."),
  tr("Бүгін қандай дағдыңыз дамыды?"),
  tr("Сабақты жақсарту үшін мұғалімге не ұсынар едіңіз?"),
];

function Reflection() {
  const { ref, full, toggle } = useFullscreen();
  const [idx, setIdx] = useState(0);
  const [question, setQuestion] = useState("");
  const tech = REFLECTIONS[idx];

  function randomQuestion() {
    const rest = QUESTIONS.filter((q) => q !== question);
    setQuestion(rest[Math.floor(Math.random() * rest.length)]);
  }

  return (
    <div ref={ref} className={`${card} flex flex-col gap-4 lg:col-span-2 ${full ? "justify-center !rounded-none !border-0 p-12" : ""}`}>
      <div className="flex items-center justify-between gap-2">
        <h2 className="text-lg font-bold">{tr("💬 Рефлексия")}</h2>
        <FullButton full={full} onClick={toggle} />
      </div>
      {!full && (
        <div className="flex flex-wrap gap-2" role="group" aria-label={tr("Рефлексия әдісі")}>
          {REFLECTIONS.map((r, i) => (
            <button
              key={r.name}
              type="button"
              aria-pressed={idx === i}
              onClick={() => {
                setIdx(i);
                setQuestion("");
              }}
              className={`rounded-full border px-3 py-1.5 text-sm ${idx === i ? "border-violet-600 bg-violet-600 text-white" : "border-slate-200 hover:border-violet-500"}`}
            >
              {r.name}
            </button>
          ))}
        </div>
      )}
      {question ? (
        <div className={`rounded-2xl bg-gradient-to-br from-violet-100 to-fuchsia-100 px-5 py-8 text-center font-bold ${full ? "text-6xl leading-tight" : "text-2xl"}`} aria-live="polite">
          {question}
        </div>
      ) : (
        <div className="flex flex-col gap-3">
          <div className={`text-center font-bold text-violet-700 ${full ? "text-5xl" : "text-xl"}`}>«{tech.name}»</div>
          <div className={`grid gap-3 ${tech.prompts.length > 3 ? "sm:grid-cols-2" : ""}`}>
            {tech.prompts.map((p) => (
              <div key={p} className={`rounded-2xl border border-slate-200 bg-slate-50 px-5 py-4 font-semibold ${full ? "text-4xl" : "text-lg"}`}>
                {p}
              </div>
            ))}
          </div>
        </div>
      )}
      <div className="flex flex-wrap justify-center gap-2">
        <button type="button" onClick={randomQuestion} className={primary}>
          <Shuffle size={16} /> {tr("Кездейсоқ сұрақ")}
        </button>
        {question && (
          <button type="button" onClick={() => setQuestion("")} className={btn}>
            {tr("«{name}» әдісіне оралу", { name: tech.name })}
          </button>
        )}
      </div>
    </div>
  );
}

/* ---------------------------------------------------------------- бет */

export default function ClassToolsPage() {
  const [lists, setLists] = useState<ClassList[]>(loadLists);
  const [activeId, setActiveId] = useState(() => loadLists()[0]?.id ?? "");
  const students = lists.find((l) => l.id === activeId)?.students ?? [];

  const change = (next: ClassList[]) => {
    setLists(next);
    saveLists(next);
  };

  return (
    <div className="mx-auto max-w-[1360px] px-4 py-9 sm:px-10">
      <PageHeader
        crumb={tr("Сабақ құралдары")}
        title={tr("Сабақ құралдары")}
        subtitle={tr("Сабақ кезінде тақтаға шығаратын құралдар: таймер, кездейсоқ оқушы, топқа бөлу, бағдаршам, шу өлшегіш және рефлексия. «Толық экран» батырмасымен проекторға үлкейтіп көрсетіңіз.")}
      />
      <div className="mt-8 grid items-start gap-6 lg:grid-cols-2">
        <Timer />
        <ClassListEditor key={activeId} lists={lists} activeId={activeId} onSelect={setActiveId} onChange={change} />
        <RandomPicker key={`p-${activeId}`} students={students} />
        <GroupMaker key={`g-${activeId}`} students={students} />
        <TrafficLight />
        <NoiseMeter />
        <Reflection />
      </div>
    </div>
  );
}
