// Физикалық есептеу модулі: тек визуализация емес, нақты формулалар.
// Барлық функциялар таза (pure) — кіріс өзгерсе, React-та useMemo арқылы шығыс бірден жаңарады.
// Бірліктер — SI (м, кг, с, В, А, Ом, Па, К), тек қажет жерде басқаша көрсетілген.

import { useEffect, useMemo, useRef, useState } from "react";

export const G_EARTH = 9.81;
export const G_MOON = 1.62;
export const R_GAS = 8.314;
const deg = Math.PI / 180;

/* ───────────── 1. Механика ───────────── */

export interface InclineResult {
  /** Үдеу, м/с² (0 — дене қозғалмайды). */
  a: number;
  moves: boolean;
  /** Жазықтық бойымен ауырлық күшінің құраушысы, Н. */
  fParallel: number;
  /** Үйкеліс күші, Н. */
  fFriction: number;
  /** Тірек реакциясы, Н. */
  normal: number;
  /** Жазықтық ұзындығы L болса, түсу уақыты, с. */
  time: (length: number) => number;
}

/** Еңіс жазықтық: a = g(sin α − μ cos α). */
export function inclinedPlane(alphaDeg: number, mu: number, mass = 1, g = G_EARTH): InclineResult {
  const s = Math.sin(alphaDeg * deg);
  const c = Math.cos(alphaDeg * deg);
  const raw = g * (s - mu * c);
  const moves = raw > 0;
  const a = moves ? raw : 0;
  const normal = mass * g * c;
  const fParallel = mass * g * s;
  return {
    a,
    moves,
    fParallel,
    normal,
    fFriction: moves ? mu * normal : fParallel,
    time: (L) => (moves ? Math.sqrt((2 * L) / a) : Infinity),
  };
}

/** Математикалық маятник периоды: T = 2π √(l / g). */
export const pendulumPeriod = (length: number, g = G_EARTH) => 2 * Math.PI * Math.sqrt(length / g);

/** Өлшенген периодтан еркін түсу үдеуі: g = 4π² l / T². */
export const gFromPendulum = (length: number, period: number) => (4 * Math.PI ** 2 * length) / period ** 2;

/** Серіппелі маятник периоды: T = 2π √(m / k). */
export const springPeriod = (mass: number, k: number) => 2 * Math.PI * Math.sqrt(mass / k);

/** Гук заңы: F = k·x → x = F / k. */
export const hookeExtension = (force: number, k: number) => force / k;

/** Ауырлық күші: F = m·g. */
export const weight = (mass: number, g = G_EARTH) => mass * g;

/** Тығыздық: ρ = m / V. */
export const density = (mass: number, volume: number) => mass / volume;

/** Архимед күші: F = ρ·g·V. */
export const archimedes = (fluidDensity: number, volume: number, g = G_EARTH) => fluidDensity * g * volume;

/**
 * Маятниктің бір қадамы (θ'' = −(g/l)·sin θ − b·θ'), 4-ретті Рунге–Кутта.
 * Кіші бұрыштарға ғана емес, кез келген амплитудаға дұрыс.
 */
export function pendulumStep(theta: number, omega: number, dt: number, length: number, g = G_EARTH, damping = 0) {
  const f = (th: number, w: number) => -(g / length) * Math.sin(th) - damping * w;
  const k1t = omega;
  const k1w = f(theta, omega);
  const k2t = omega + (dt / 2) * k1w;
  const k2w = f(theta + (dt / 2) * k1t, omega + (dt / 2) * k1w);
  const k3t = omega + (dt / 2) * k2w;
  const k3w = f(theta + (dt / 2) * k2t, omega + (dt / 2) * k2w);
  const k4t = omega + dt * k3w;
  const k4w = f(theta + dt * k3t, omega + dt * k3w);
  return {
    theta: theta + (dt / 6) * (k1t + 2 * k2t + 2 * k3t + k4t),
    omega: omega + (dt / 6) * (k1w + 2 * k2w + 2 * k3w + k4w),
  };
}

/* ───────────── 2. Электр ───────────── */

/** Ом заңы: үш шаманың екеуі белгілі болса, үшіншісін табады. */
export function ohm({ U, I, R }: { U?: number; I?: number; R?: number }) {
  if (U !== undefined && R !== undefined) return { U, R, I: R === 0 ? Infinity : U / R };
  if (I !== undefined && R !== undefined) return { I, R, U: I * R };
  if (U !== undefined && I !== undefined) return { U, I, R: I === 0 ? Infinity : U / I };
  throw new Error("ohm(): екі шама керек");
}

/** Тізбектей қосылу: R = R₁ + R₂ + … */
export const seriesResistance = (rs: number[]) => rs.reduce((s, r) => s + r, 0);

/** Параллель қосылу: 1/R = 1/R₁ + 1/R₂ + … */
export const parallelResistance = (rs: number[]) => {
  if (rs.some((r) => r === 0)) return 0;
  return rs.length ? 1 / rs.reduce((s, r) => s + 1 / r, 0) : Infinity;
};

/** Қуат: P = U·I = I²R. */
export const power = (U: number, I: number) => U * I;

/**
 * Толық тізбек: ЭҚК, ішкі кедергі және тізбектей қосылған жүктемелер.
 * Әр жүктемедегі кернеу мен ток қайтарылады.
 */
export function seriesCircuit(emf: number, loads: number[], internal = 0) {
  const total = seriesResistance(loads) + internal;
  const I = total === 0 ? Infinity : emf / total;
  return { I, total, drops: loads.map((r) => I * r) };
}

/** Тізбек элементі: a және b түйіндері арасында R кедергі және (болса) ЭҚК (a — «+»). */
export interface CircuitElement {
  id: string;
  a: number;
  b: number;
  R: number;
  emf?: number;
}

/**
 * Тізбекті түйіндік потенциалдар әдісімен есептеу (Кирхгоф заңдары).
 * Ток көзі ішкі кедергісі бар Нортон эквиваленті ретінде қосылады.
 * Ешқайда жалғанбаған түйіндер шексіз үлкен кедергі арқылы «жерге» тартылады — матрица әрқашан шешіледі.
 * Нәтиже: түйін потенциалдары және әр элементтегі ток (a → b бағытында, оң — a-дан b-ға).
 */
export function solveCircuit(nodeCount: number, elements: CircuitElement[], ground = 0) {
  const n = nodeCount;
  const G = Array.from({ length: n }, () => new Array<number>(n).fill(0));
  const J = new Array<number>(n).fill(0);
  for (let i = 0; i < n; i++) G[i][i] += 1e-9;
  for (const el of elements) {
    if (el.a === el.b) continue;
    const g = 1 / el.R;
    G[el.a][el.a] += g;
    G[el.b][el.b] += g;
    G[el.a][el.b] -= g;
    G[el.b][el.a] -= g;
    if (el.emf) {
      J[el.a] += el.emf * g;
      J[el.b] -= el.emf * g;
    }
  }
  // Жер түйінін (V = 0) алып тастап, қалғанын Гаусс әдісімен шешеміз.
  const idx = [...Array(n).keys()].filter((i) => i !== ground);
  const m = idx.length;
  const A = idx.map((r) => [...idx.map((c) => G[r][c]), J[r]]);
  for (let col = 0; col < m; col++) {
    let piv = col;
    for (let r = col + 1; r < m; r++) if (Math.abs(A[r][col]) > Math.abs(A[piv][col])) piv = r;
    [A[col], A[piv]] = [A[piv], A[col]];
    const d = A[col][col];
    if (Math.abs(d) < 1e-15) continue;
    for (let r = 0; r < m; r++) {
      if (r === col) continue;
      const k = A[r][col] / d;
      if (k === 0) continue;
      for (let c = col; c <= m; c++) A[r][c] -= k * A[col][c];
    }
  }
  const V = new Array<number>(n).fill(0);
  idx.forEach((node, i) => {
    V[node] = Math.abs(A[i][i]) < 1e-15 ? 0 : A[i][m] / A[i][i];
  });
  const current = (el: CircuitElement) => (el.a === el.b ? 0 : (V[el.a] - V[el.b] - (el.emf ?? 0)) / el.R);
  return { V, current };
}

/* ───────────── 3. Термодинамика және МКТ ───────────── */

export interface GasState {
  /** Қысым, Па. */
  P: number;
  /** Көлем, м³. */
  V: number;
  /** Температура, К. */
  T: number;
}

export type Isoprocess = "isothermal" | "isobaric" | "isochoric";

/**
 * Изопроцесс: PV/T = const. Бір параметр өзгергенде, процесс түріне қарай екіншісін есептейді.
 * change — жаңа мән берілетін шама (тұрақты шаманы өзгертуге болмайды).
 */
export function isoprocess(state: GasState, kind: Isoprocess, change: Partial<GasState>): GasState {
  const c = (state.P * state.V) / state.T;
  if (kind === "isothermal") {
    const T = state.T;
    if (change.P !== undefined) return { P: change.P, V: (c * T) / change.P, T };
    if (change.V !== undefined) return { P: (c * T) / change.V, V: change.V, T };
  }
  if (kind === "isobaric") {
    const P = state.P;
    if (change.V !== undefined) return { P, V: change.V, T: (P * change.V) / c };
    if (change.T !== undefined) return { P, V: (c * change.T) / P, T: change.T };
  }
  if (kind === "isochoric") {
    const V = state.V;
    if (change.P !== undefined) return { P: change.P, V, T: (change.P * V) / c };
    if (change.T !== undefined) return { P: (c * change.T) / V, V, T: change.T };
  }
  return state;
}

/** Менделеев–Клапейрон теңдеуі: PV = νRT → P. */
export const idealGasPressure = (moles: number, V: number, T: number) => (moles * R_GAS * T) / V;

/** Жылу мөлшері: Q = c·m·Δt. */
export const heat = (c: number, m: number, dt: number) => c * m * dt;

/** Жылу балансы (екі дене): ортақ температура θ = (c₁m₁t₁ + c₂m₂t₂)/(c₁m₁ + c₂m₂). */
export const heatBalance = (a: { c: number; m: number; t: number }, b: { c: number; m: number; t: number }) =>
  (a.c * a.m * a.t + b.c * b.m * b.t) / (a.c * a.m + b.c * b.m);

/* ───────────── 4. Оптика ───────────── */

export interface LensImage {
  /** Кескінге дейінгі қашықтық f (жинағыш линзада оң — нақты кескін). */
  f: number;
  /** Сызықтық үлкейту Γ = f / d (теріс — төңкерілген). */
  magnification: number;
  real: boolean;
  inverted: boolean;
  /** Нәрсе фокуста тұр — кескін жоқ (шексіздікте). */
  atInfinity: boolean;
}

/**
 * Жұқа линза формуласы: 1/F = 1/d + 1/f.
 * F > 0 — жинағыш, F < 0 — шашыратқыш. d > 0 — нақты нәрсе.
 */
export function thinLens(F: number, d: number): LensImage {
  if (Math.abs(d - F) < 1e-9) return { f: Infinity, magnification: Infinity, real: false, inverted: false, atInfinity: true };
  const f = (F * d) / (d - F);
  const magnification = -f / d;
  return { f, magnification, real: f > 0, inverted: magnification < 0, atInfinity: false };
}

/** Өлшенген d мен f арқылы фокус аралығы: F = d·f / (d + f). */
export const focalFromDistances = (d: number, f: number) => (d * f) / (d + f);

/** Оптикалық күш: D = 1 / F (диоптрия, F метрмен). */
export const opticalPower = (F: number) => 1 / F;

/** Снеллиус заңы: n₁ sin α = n₂ sin β. Толық ішкі шағылуда null. */
export function refraction(alphaDeg: number, n1: number, n2: number): number | null {
  const s = (n1 / n2) * Math.sin(alphaDeg * deg);
  if (Math.abs(s) > 1) return null;
  return Math.asin(s) / deg;
}

/** Толық ішкі шағылудың шекті бұрышы (n₁ > n₂). */
export const criticalAngle = (n1: number, n2: number) => (n1 <= n2 ? null : Math.asin(n2 / n1) / deg);

/** Шағылу заңы: шағылу бұрышы түсу бұрышына тең. */
export const reflection = (alphaDeg: number) => alphaDeg;

/** Дисперсия: Коши формуласы n(λ) = A + B/λ² (λ нм). Шыны үшін әдепкі мәндер. */
export const cauchyIndex = (lambdaNm: number, A = 1.5046, B = 4200) => A + B / lambdaNm ** 2;

/* ───────────── 5. Кванттық және ядролық физика ───────────── */

export const PLANCK = 6.626e-34;
export const C_LIGHT = 3e8;
export const E_CHARGE = 1.602e-19;

/** Фотоэффект: Eк = hν − A (эВ). Теріс болса — фотоэффект жоқ (0). */
export const photoelectricEnergy = (lambdaNm: number, workFunctionEv: number) =>
  Math.max(0, (PLANCK * C_LIGHT) / (lambdaNm * 1e-9) / E_CHARGE - workFunctionEv);

/** Радиоактивті ыдырау: N = N₀ · 2^(−t/T½). */
export const decay = (n0: number, t: number, halfLife: number) => n0 * 2 ** (-t / halfLife);

/* ───────────── Көмекші: өлшеу дәлдігі ───────────── */

/** Салыстырмалы қателік, %. */
export const relativeError = (measured: number, exact: number) => (exact === 0 ? 0 : (Math.abs(measured - exact) / Math.abs(exact)) * 100);

/** Мәнді n таңбаға дейін дөңгелектеу. */
export const round = (v: number, digits = 2) => {
  if (!Number.isFinite(v)) return v;
  const p = 10 ** digits;
  return Math.round(v * p) / p;
};

/* ───────────── React хуктары ───────────── */

/** Еңіс жазықтық — параметр өзгерсе, нәтиже бірден қайта есептеледі. */
export const useInclinedPlane = (alphaDeg: number, mu: number, mass: number, g = G_EARTH) =>
  useMemo(() => inclinedPlane(alphaDeg, mu, mass, g), [alphaDeg, mu, mass, g]);

export const useOhm = (U: number, R: number) => useMemo(() => ohm({ U, R }), [U, R]);

export const useThinLens = (F: number, d: number) => useMemo(() => thinLens(F, d), [F, d]);

/**
 * Секундомер: start/stop/reset, мс дәлдікпен.
 * Уақыт requestAnimationFrame арқылы жаңарады.
 */
export function useStopwatch() {
  const [elapsed, setElapsed] = useState(0);
  const [running, setRunning] = useState(false);
  const startRef = useRef(0);
  const baseRef = useRef(0);
  // Синхронды белгі: тоқтатқаннан кейін кешіккен кадр уақытты қайта жазбауы үшін.
  const runRef = useRef(false);

  useEffect(() => {
    if (!running) return;
    let raf = 0;
    const tick = () => {
      if (!runRef.current) return;
      setElapsed(baseRef.current + (performance.now() - startRef.current) / 1000);
      raf = requestAnimationFrame(tick);
    };
    raf = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf);
  }, [running]);

  return {
    elapsed,
    running,
    start() {
      if (runRef.current) return;
      runRef.current = true;
      startRef.current = performance.now();
      setRunning(true);
    },
    stop() {
      if (!runRef.current) return;
      runRef.current = false;
      baseRef.current += (performance.now() - startRef.current) / 1000;
      setElapsed(baseRef.current);
      setRunning(false);
    },
    reset() {
      runRef.current = false;
      baseRef.current = 0;
      setElapsed(0);
      setRunning(false);
    },
    /** Тоқтаған секундомерге дәл мән қою (модельдегі уақыт). */
    set(seconds: number) {
      runRef.current = false;
      baseRef.current = seconds;
      setElapsed(seconds);
      setRunning(false);
    },
  };
}
