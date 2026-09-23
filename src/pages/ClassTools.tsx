import { Maximize, Minimize, Pause, Play, Plus, RotateCcw, Shuffle, Sparkles, Trash2, Users } from "lucide-react";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { PageHeader } from "../components/PageHeader";

// Сабақ кезінде тақтаға (проекторға) шығаратын құралдар: таймер, кездейсоқ оқушы, топқа бөлу.
// Сынып тізімдері тек осы құрылғының браузерінде сақталады.

const card = "rounded-3xl border border-slate-200 bg-white p-5 sm:p-6";
const btn = "inline-flex items-center justify-center gap-2 rounded-[12px] border border-slate-200 bg-white px-3.5 py-2.5 text-sm font-semibold hover:border-violet-500 disabled:opacity-50";
const primary = "inline-flex items-center justify-center gap-2 rounded-[12px] bg-violet-600 px-4 py-2.5 text-sm font-semibold text-white disabled:opacity-60";
const field = "w-full rounded-xl border border-slate-200 bg-slate-50 px-3 py-2.5 text-sm outline-none focus:border-violet-500";

/* ------------------------------------------------------------ толық экран */

function useFullscreen() {
  const ref = useRef<HTMLDivElement>(null);
  const [full, setFull] = useState(false);
  useEffect(() => {
    const on = () => setFull(document.fullscreenElement === ref.current);
    document.addEventListener("fullscreenchange", on);
    return () => document.removeEventListener("fullscreenchange", on);
  }, []);
  const toggle = () => {
    if (document.fullscreenElement) void document.exitFullscreen();
    else void ref.current?.requestFullscreen?.();
  };
  return { ref, full, toggle };
}

function FullButton({ full, onClick }: { full: boolean; onClick: () => void }) {
  return (
    <button type="button" onClick={onClick} className={btn} aria-label={full ? "Толық экраннан шығу" : "Толық экран"}>
      {full ? <Minimize size={15} /> : <Maximize size={15} />}
      <span className="hidden sm:inline">{full ? "Шығу" : "Толық экран"}</span>
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
        <h2 className="text-lg font-bold">⏱ Таймер</h2>
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
      {done && <div className={`text-center font-bold text-rose-600 ${full ? "text-4xl" : "text-lg"}`}>Уақыт бітті!</div>}

      <div className="flex flex-wrap justify-center gap-2">
        {running ? (
          <button type="button" onClick={pause} className={primary}>
            <Pause size={16} /> Кідірту
          </button>
        ) : (
          <button type="button" onClick={start} disabled={left <= 0} className={primary}>
            <Play size={16} /> {left < total && left > 0 ? "Жалғастыру" : "Бастау"}
          </button>
        )}
        <button type="button" onClick={() => set(total)} className={btn}>
          <RotateCcw size={15} /> Қайта
        </button>
        <button type="button" onClick={addMinute} className={btn}>
          <Plus size={15} /> 1 мин
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
                {m} мин
              </button>
            ))}
          </div>
          <form onSubmit={applyCustom} className="flex gap-2">
            <input value={custom} onChange={(e) => setCustom(e.target.value)} placeholder="Өз уақытыңыз: мыс. 4:30" aria-label="Өз уақытыңыз" className={field} />
            <button type="submit" className={btn}>
              Қою
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
    const title = name.trim() || "Менің сыныбым";
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
          <Users size={18} className="text-violet-600" /> Сынып тізімі
        </h2>
        <select value={activeId} onChange={(e) => onSelect(e.target.value)} aria-label="Сыныпты таңдау" className="rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm">
          <option value="">+ Жаңа тізім</option>
          {lists.map((l) => (
            <option key={l.id} value={l.id}>
              {l.name} ({l.students.length})
            </option>
          ))}
        </select>
      </div>
      <input value={name} onChange={(e) => setName(e.target.value)} placeholder="Сынып атауы, мыс.: 7А" aria-label="Сынып атауы" className={field} />
      <textarea
        value={text}
        onChange={(e) => setText(e.target.value)}
        rows={7}
        placeholder={"Оқушылардың аты-жөні — әр жолға біреуден\nАйгерім Сейітова\nБолат Ахметов\n..."}
        aria-label="Оқушылар тізімі"
        className={`${field} resize-y`}
      />
      <div className="flex flex-wrap gap-2">
        <button type="button" onClick={save} disabled={!parseNames(text).length} className={primary}>
          Сақтау
        </button>
        {active && (
          <button
            type="button"
            onClick={() => {
              if (!window.confirm(`«${active.name}» тізімін өшіру керек пе?`)) return;
              onChange(lists.filter((l) => l.id !== active.id));
              onSelect("");
            }}
            className={btn}
          >
            <Trash2 size={15} /> Өшіру
          </button>
        )}
      </div>
      <p className="text-xs text-slate-500">Тізім тек осы құрылғыда сақталады. Excel-ден бағанды көшіріп қоюға болады.</p>
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
        <h2 className="text-lg font-bold">🎯 Кездейсоқ оқушы</h2>
        <FullButton full={full} onClick={toggle} />
      </div>
      <div
        aria-live="polite"
        className={`flex w-full items-center justify-center rounded-2xl bg-gradient-to-br from-violet-100 to-fuchsia-100 px-4 text-center font-bold ${full ? "min-h-[45vh] text-[9vh]" : "min-h-[140px] text-3xl"} ${spinning ? "text-slate-500" : "text-slate-900"}`}
      >
        {shown || (students.length ? "?" : "Алдымен сынып тізімін енгізіңіз")}
      </div>
      <div className="flex flex-wrap justify-center gap-2">
        <button type="button" onClick={pick} disabled={!pool.length || spinning} className={primary}>
          <Sparkles size={16} /> {pool.length ? "Таңдау" : "Барлығы таңдалды"}
        </button>
        <button
          type="button"
          onClick={() => {
            setPicked([]);
            setShown("");
          }}
          className={btn}
        >
          <RotateCcw size={15} /> Басынан
        </button>
      </div>
      {!full && (
        <>
          <label className="flex items-center justify-center gap-2 text-sm">
            <input type="checkbox" checked={noRepeat} onChange={(e) => setNoRepeat(e.target.checked)} className="h-4 w-4 accent-violet-600" />
            Қайталамау (таңдалған оқушы қайта шықпайды)
          </label>
          {picked.length > 0 && (
            <div className="text-center text-sm text-slate-500">
              Таңдалғандар ({picked.length}/{students.length}): {picked.join(", ")}
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
        <h2 className="text-lg font-bold">👥 Топқа бөлу</h2>
        <FullButton full={full} onClick={toggle} />
      </div>
      <div className="flex flex-wrap items-center gap-2">
        <span className="text-sm text-slate-500">Топ саны:</span>
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
          <Shuffle size={16} /> Бөлу
        </button>
      </div>
      {groups.length > 0 ? (
        <div className={`grid gap-3 ${full ? "grid-cols-3" : "sm:grid-cols-2"}`}>
          {groups.map((g, i) => (
            <div key={i} className={`rounded-2xl p-4 ${colors[i % colors.length]}`}>
              <div className={`mb-2 font-bold ${full ? "text-3xl" : ""}`}>
                {i + 1}-топ <span className="text-sm font-normal text-slate-500">({g.length})</span>
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
        <p className="text-sm text-slate-500">{students.length < 2 ? "Алдымен сынып тізімін енгізіңіз." : "«Бөлу» батырмасын басыңыз — оқушылар кездейсоқ топтарға бөлінеді."}</p>
      )}
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
        crumb="Сабақ құралдары"
        title="Сабақ құралдары"
        subtitle="Сабақ кезінде тақтаға шығаратын құралдар: таймер, кездейсоқ оқушы таңдау және топқа бөлу. «Толық экран» батырмасымен проекторға үлкейтіп көрсетіңіз."
      />
      <div className="mt-8 grid items-start gap-6 lg:grid-cols-2">
        <Timer />
        <ClassListEditor key={activeId} lists={lists} activeId={activeId} onSelect={setActiveId} onChange={change} />
        <RandomPicker key={`p-${activeId}`} students={students} />
        <GroupMaker key={`g-${activeId}`} students={students} />
      </div>
    </div>
  );
}
