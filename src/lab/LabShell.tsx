// Зертханалық жұмыс беті: сол жақта — теория мен нұсқаулық, ортада — 3D сахна,
// оң жақта — басқару және құралдар панелі (сызғыш, секундомер), төменде — деректер кестесі мен график.

import { BookOpen, Download, Maximize2, Minimize2, Pause, Play, RotateCcw, Ruler, Table2, Target, Trash2 } from "lucide-react";
import { useState, type ReactNode } from "react";
import { tr } from "../i18n";
import { downloadBlob } from "../lib/downloadBlob";
import { useFullscreen } from "../lib/useFullscreen";
import { LabScene, type Vec3 } from "./equipment/LabScene";
import { useStopwatch } from "./physicsEngine";
import { btn, panel, primary } from "./styles";
import type { LabWork, Measurement, MeasurementColumn } from "./types";
import type { useMeasurements } from "./useMeasurements";

type Stopwatch = ReturnType<typeof useStopwatch>;

/* ───────── Басқару элементтері ───────── */

export function Slider({ label, value, min, max, step, unit, onChange, digits = 1 }: { label: string; value: number; min: number; max: number; step: number; unit: string; onChange: (v: number) => void; digits?: number }) {
  return (
    <label className="block">
      <div className="mb-1 flex items-baseline justify-between text-[13px]">
        <span className="font-semibold text-slate-700">{label}</span>
        <span className="font-mono text-violet-700">
          {value.toFixed(digits)} {unit}
        </span>
      </div>
      <input type="range" min={min} max={max} step={step} value={value} onChange={(e) => onChange(Number(e.target.value))} className="w-full accent-violet-600" />
    </label>
  );
}

export function Status({ tone, children }: { tone: "ok" | "warn" | "error" | "info"; children: ReactNode }) {
  const tones = {
    ok: "border-emerald-300 bg-emerald-50 text-emerald-800 dark:bg-emerald-950/40 dark:text-emerald-300",
    warn: "border-amber-300 bg-amber-50 text-amber-800 dark:bg-amber-950/40 dark:text-amber-300",
    error: "border-red-300 bg-red-50 text-red-800 dark:bg-red-950/40 dark:text-red-300",
    info: "border-slate-200 bg-slate-50 text-slate-700",
  } as const;
  return (
    <div role="status" className={`rounded-xl border px-3 py-2 text-[13px] leading-snug ${tones[tone]}`}>
      {children}
    </div>
  );
}

function StopwatchCard({ sw }: { sw: Stopwatch }) {
  return (
    <div className="flex items-center justify-between gap-2 rounded-xl border border-slate-200 bg-slate-50 px-3 py-2">
      <span className="font-mono text-[22px] font-bold tabular-nums">{sw.elapsed.toFixed(2)} с</span>
      <div className="flex gap-1.5">
        {sw.running ? (
          <button type="button" className={btn} onClick={sw.stop} aria-label={tr("Тоқтату")}>
            <Pause size={15} />
          </button>
        ) : (
          <button type="button" className={btn} onClick={sw.start} aria-label={tr("Бастау")}>
            <Play size={15} />
          </button>
        )}
        <button type="button" className={btn} onClick={sw.reset} aria-label={tr("Нөлдеу")}>
          <RotateCcw size={15} />
        </button>
      </div>
    </div>
  );
}

/* ───────── Деректер кестесі ───────── */

function fmt(v: number | undefined, digits = 2) {
  if (v === undefined || Number.isNaN(v)) return "—";
  if (!Number.isFinite(v)) return "∞";
  return v.toFixed(digits);
}

const head = (c: MeasurementColumn) => (c.unit ? `${c.symbol}, ${c.unit}` : c.symbol);

function DataTable({ columns, rows, onDelete, onClear, fileName }: { columns: MeasurementColumn[]; rows: Measurement[]; onDelete: (id: string) => void; onClear: () => void; fileName: string }) {
  function csv() {
    const lines = [["№", ...columns.map(head)].join(";"), ...rows.map((r, i) => [i + 1, ...columns.map((c) => fmt(r.values[c.key], c.digits).replace(".", ","))].join(";"))];
    downloadBlob(new Blob(["﻿" + lines.join("\n")], { type: "text/csv;charset=utf-8" }), `${fileName}.csv`);
  }
  return (
    <div className={panel}>
      <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
        <h3 className="flex items-center gap-2 text-[15px] font-bold">
          <Table2 size={17} /> {tr("Деректер кестесі")}
        </h3>
        <div className="flex gap-1.5">
          <button type="button" className={btn} onClick={csv} disabled={!rows.length}>
            <Download size={14} /> CSV
          </button>
          <button type="button" className={btn} onClick={onClear} disabled={!rows.length}>
            <Trash2 size={14} /> {tr("Тазалау")}
          </button>
        </div>
      </div>
      <div className="overflow-x-auto">
        <table className="w-full min-w-[420px] border-collapse text-[13px]">
          <thead>
            <tr className="border-b border-slate-200 text-left text-slate-500">
              <th className="px-2 py-1.5 font-semibold">№</th>
              {columns.map((c) => (
                <th key={c.key} className="px-2 py-1.5 font-semibold" title={c.name}>
                  {head(c)}
                </th>
              ))}
              <th />
            </tr>
          </thead>
          <tbody>
            {rows.map((r, i) => (
              <tr key={r.id} className="border-b border-slate-100 font-mono tabular-nums">
                <td className="px-2 py-1.5 text-slate-500">{i + 1}</td>
                {columns.map((c) => (
                  <td key={c.key} className="px-2 py-1.5">
                    {fmt(r.values[c.key], c.digits)}
                  </td>
                ))}
                <td className="px-1 text-right">
                  <button type="button" onClick={() => onDelete(r.id)} className="rounded p-1 text-slate-400 hover:text-red-600" aria-label={tr("Жою")}>
                    <Trash2 size={13} />
                  </button>
                </td>
              </tr>
            ))}
            {!rows.length && (
              <tr>
                <td colSpan={columns.length + 2} className="px-2 py-5 text-center text-slate-500">
                  {tr("Әзірге өлшеу жоқ. «Кестеге жазу» батырмасын басыңыз.")}
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}

/** Нүктелік график + ең кіші квадраттар әдісімен түзу (y = a·x + b). */
function Chart({ rows, x, y }: { rows: Measurement[]; x: MeasurementColumn; y: MeasurementColumn }) {
  const pts = rows.map((r) => [r.values[x.key], r.values[y.key]] as const).filter(([a, b]) => Number.isFinite(a) && Number.isFinite(b));
  const W = 360;
  const H = 230;
  const P = { l: 46, r: 14, t: 14, b: 38 };
  const maxX = Math.max(1e-9, ...pts.map((p) => p[0])) * 1.1;
  const maxY = Math.max(1e-9, ...pts.map((p) => p[1])) * 1.1;
  const sx = (v: number) => P.l + (v / maxX) * (W - P.l - P.r);
  const sy = (v: number) => H - P.b - (v / maxY) * (H - P.t - P.b);
  let fit: { a: number; b: number } | null = null;
  if (pts.length >= 2) {
    const n = pts.length;
    const mx = pts.reduce((s, p) => s + p[0], 0) / n;
    const my = pts.reduce((s, p) => s + p[1], 0) / n;
    const sxx = pts.reduce((s, p) => s + (p[0] - mx) ** 2, 0);
    if (sxx > 1e-12) {
      const a = pts.reduce((s, p) => s + (p[0] - mx) * (p[1] - my), 0) / sxx;
      fit = { a, b: my - a * mx };
    }
  }
  const ticks = [0, 0.25, 0.5, 0.75, 1];
  return (
    <div className={panel}>
      <h3 className="mb-2 text-[15px] font-bold">
        {tr("График")}: {y.symbol}({x.symbol})
      </h3>
      {!pts.length ? (
        <p className="py-10 text-center text-[13px] text-slate-500">{tr("Өлшеулер жазылғанда график осында салынады.")}</p>
      ) : (
      <svg viewBox={`0 0 ${W} ${H}`} className="w-full" role="img" aria-label={`${y.name} / ${x.name}`}>
        {ticks.map((t) => (
          <g key={t}>
            <line x1={P.l} x2={W - P.r} y1={sy(t * maxY)} y2={sy(t * maxY)} stroke="currentColor" className="text-slate-200" />
            <text x={P.l - 6} y={sy(t * maxY)} textAnchor="end" dominantBaseline="middle" fontSize="10" className="fill-slate-500">
              {(t * maxY).toFixed(maxY < 2 ? 2 : 1)}
            </text>
            <text x={sx(t * maxX)} y={H - P.b + 14} textAnchor="middle" fontSize="10" className="fill-slate-500">
              {(t * maxX).toFixed(maxX < 2 ? 2 : 1)}
            </text>
          </g>
        ))}
        <line x1={P.l} x2={P.l} y1={P.t} y2={H - P.b} stroke="currentColor" className="text-slate-400" />
        <line x1={P.l} x2={W - P.r} y1={H - P.b} y2={H - P.b} stroke="currentColor" className="text-slate-400" />
        <text x={(W + P.l) / 2} y={H - 6} textAnchor="middle" fontSize="11" className="fill-slate-600">
          {head(x)}
        </text>
        <text x={12} y={(H - P.b) / 2} textAnchor="middle" fontSize="11" className="fill-slate-600" transform={`rotate(-90 12 ${(H - P.b) / 2})`}>
          {head(y)}
        </text>
        {fit && <line x1={sx(0)} y1={sy(fit.b)} x2={sx(maxX)} y2={sy(fit.a * maxX + fit.b)} stroke="#2f7d74" strokeWidth="2" strokeDasharray="5 4" />}
        {pts.map(([a, b], i) => (
          <circle key={i} cx={sx(a)} cy={sy(b)} r="4.5" fill="#e0733d" stroke="#fff" strokeWidth="1.5" />
        ))}
      </svg>
      )}
      {fit && (
        <p className="mt-1 font-mono text-[12px] text-slate-500">
          {y.symbol} ≈ {fit.a.toFixed(3)}·{x.symbol} {fit.b >= 0 ? "+" : "−"} {Math.abs(fit.b).toFixed(3)}
        </p>
      )}
    </div>
  );
}

/* ───────── Негізгі қабық ───────── */

export interface LabShellProps {
  lab: LabWork;
  /** Canvas ішіндегі 3D құралдар. */
  scene: ReactNode;
  /** Оң жақтағы басқару элементтері. */
  controls: ReactNode;
  /** Сахна үстіндегі қысқа нұсқау немесе күй. */
  status?: ReactNode;
  onRecord: () => void;
  recordDisabled?: boolean;
  measurements: ReturnType<typeof useMeasurements>;
  stopwatch?: Stopwatch;
  chart?: { x: string; y: string };
  camera?: Vec3;
  target?: Vec3;
}

export function LabShell({ lab, scene, controls, status, onRecord, recordDisabled, measurements, stopwatch, chart, camera, target }: LabShellProps) {
  const { ref, full, toggle } = useFullscreen();
  const [ruler, setRuler] = useState(false);
  const [done, setDone] = useState<Set<number>>(new Set());
  const chartX = chart && lab.columns.find((c) => c.key === chart.x);
  const chartY = chart && lab.columns.find((c) => c.key === chart.y);

  return (
    <div className="mt-6 grid gap-4 xl:grid-cols-[300px_minmax(0,1fr)_320px]">
      {/* Сол жақ: теория және нұсқаулық */}
      <aside className="order-2 flex flex-col gap-4 xl:order-1">
        <section className={panel}>
          <h3 className="mb-1.5 flex items-center gap-2 text-[15px] font-bold">
            <Target size={16} /> {tr("Жұмыстың мақсаты")}
          </h3>
          <p className="text-[13.5px] leading-relaxed text-slate-600">{lab.goal}</p>
        </section>
        <section className={panel}>
          <h3 className="mb-1.5 flex items-center gap-2 text-[15px] font-bold">
            <BookOpen size={16} /> {tr("Теория")}
          </h3>
          <p className="text-[13.5px] leading-relaxed text-slate-600">{lab.theory}</p>
          <div className="mt-3 flex flex-col gap-1.5">
            {lab.formulas.map((f) => (
              <div key={f.id} className="flex items-baseline justify-between gap-2 rounded-lg bg-violet-50 px-2.5 py-1.5">
                <span className="font-mono text-[14px] font-bold text-violet-800">{f.expression}</span>
                <span className="text-right text-[11.5px] text-slate-500">{f.description}</span>
              </div>
            ))}
          </div>
        </section>
        <section className={panel}>
          <h3 className="mb-2 text-[15px] font-bold">{tr("Жұмыс барысы")}</h3>
          <ol className="flex flex-col gap-2">
            {lab.steps.map((s, i) => (
              <li key={i}>
                <label className="flex cursor-pointer gap-2 text-[13.5px] leading-snug">
                  <input
                    type="checkbox"
                    className="mt-0.5 accent-violet-600"
                    checked={done.has(i)}
                    onChange={() =>
                      setDone((d) => {
                        const n = new Set(d);
                        if (n.has(i)) n.delete(i);
                        else n.add(i);
                        return n;
                      })
                    }
                  />
                  <span className={done.has(i) ? "text-slate-400 line-through" : "text-slate-700"}>
                    <b>{i + 1}.</b> {s}
                  </span>
                </label>
              </li>
            ))}
          </ol>
        </section>
        <section className={panel}>
          <h3 className="mb-2 text-[15px] font-bold">{tr("Құрал-жабдықтар")}</h3>
          <ul className="flex flex-col gap-1 text-[13px] text-slate-600">
            {lab.equipment.map((e) => (
              <li key={e.id}>
                • {e.name}
                {e.range && (
                  <span className="text-slate-400">
                    {" "}
                    ({e.range.min}–{e.range.max} {e.range.unit}
                    {e.division ? `, ${tr("бөлік құны")} ${e.division}` : ""})
                  </span>
                )}
              </li>
            ))}
          </ul>
        </section>
      </aside>

      {/* Орта: 3D сахна, кесте, график */}
      <div className="order-1 flex min-w-0 flex-col gap-4 xl:order-2">
        <div ref={ref} className="relative overflow-hidden rounded-[20px] border border-slate-200 bg-[#1a2230] shadow-[0_24px_48px_-30px_rgba(27,26,46,.35)]">
          <div className={full ? "h-screen" : "h-[min(64vh,600px)] min-h-[420px]"}>
            <LabScene camera={camera} target={target} rulerActive={ruler}>
              {scene}
            </LabScene>
          </div>
          <div className="pointer-events-none absolute inset-x-3 top-3 flex items-start justify-between gap-2">
            <div className="pointer-events-auto max-w-[70%]">{status}</div>
            <div className="pointer-events-auto flex gap-1.5">
              <button type="button" onClick={() => setRuler((r) => !r)} className={ruler ? btn.replace("bg-surface", "bg-amber-300 text-slate-950 border-amber-400") : btn} title={tr("Сызғыш: екі нүктені басыңыз")}>
                <Ruler size={15} /> <span className="hidden sm:inline">{tr("Сызғыш")}</span>
              </button>
              <button type="button" onClick={toggle} className={btn} aria-label={tr("Толық экран")}>
                {full ? <Minimize2 size={15} /> : <Maximize2 size={15} />}
              </button>
            </div>
          </div>
          <p className="pointer-events-none absolute bottom-2 left-3 text-[11.5px] text-slate-300/80">
            {ruler ? tr("Сызғыш: қашықтықты өлшеу үшін екі нүктені басыңыз.") : tr("Айналдыру — тышқанның сол батырмасы, жақындату — дөңгелек, жылжыту — оң батырма.")}
          </p>
        </div>
        <div className={`grid gap-4 ${chartX && chartY ? "lg:grid-cols-[minmax(0,1fr)_380px]" : ""}`}>
          <DataTable columns={lab.columns} rows={measurements.rows} onDelete={measurements.remove} onClear={measurements.clear} fileName={lab.id} />
          {chartX && chartY && <Chart rows={measurements.rows} x={chartX} y={chartY} />}
        </div>
      </div>

      {/* Оң жақ: басқару және құралдар */}
      <aside className="order-3 flex flex-col gap-4">
        <section className={`${panel} flex flex-col gap-3.5`}>
          <h3 className="text-[15px] font-bold">{tr("Басқару")}</h3>
          {controls}
        </section>
        {stopwatch && (
          <section className={panel}>
            <h3 className="mb-2 text-[15px] font-bold">⏱ {tr("Секундомер")}</h3>
            <StopwatchCard sw={stopwatch} />
          </section>
        )}
        <button type="button" className={`${primary} w-full py-3 text-[15px]`} onClick={onRecord} disabled={recordDisabled}>
          <Table2 size={17} /> {tr("Кестеге жазу")}
        </button>
      </aside>
    </div>
  );
}
