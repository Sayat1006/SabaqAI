// 7-сынып: математикалық маятниктің тербеліс периоды.
// Қозғалыс θ'' = −(g/l)·sin θ теңдеуімен нақты уақытта модельденеді (Рунге–Кутта), тербелістер автоматты саналады.

import { useFrame } from "@react-three/fiber";
import { useRef, useState } from "react";
import * as THREE from "three";
import { tr } from "../../i18n";
import { Label } from "../equipment/LabScene";
import { LabShell, Slider, Status } from "../LabShell";
import { btn, primary } from "../styles";
import { useMeasurements } from "../useMeasurements";
import { G_EARTH, G_MOON, gFromPendulum, pendulumPeriod, pendulumStep, round, useStopwatch } from "../physicsEngine";
import type { LabWork } from "../types";

const PIVOT = new THREE.Vector3(0, 1.15, 0.02);
const PLANETS = [
  { id: "earth", label: "Жер", g: G_EARTH },
  { id: "moon", label: "Ай", g: G_MOON },
  { id: "mars", label: "Марс", g: 3.71 },
  { id: "jupiter", label: "Юпитер", g: 24.79 },
];

interface SimProps {
  length: number;
  theta0: number;
  g: number;
  running: boolean;
  target: number | null;
  onPeriod: (count: number, time: number) => void;
}

function Pendulum({ length, theta0, g, running, target, onPeriod }: SimProps) {
  const arm = useRef<THREE.Group>(null);
  // Жаңа жіберу немесе параметр өзгерсе, компонент key арқылы қайта құрылады — күй басынан басталады.
  const st = useRef({ theta: theta0, omega: 0, t: 0, count: 0 });
  const [count, setCount] = useState(0);

  useFrame((_, delta) => {
    const s = st.current;
    if (running && (target === null || s.count < target)) {
      const total = Math.min(delta, 0.05);
      const h = 0.001;
      let left = total;
      while (left > 1e-9) {
        const dt = Math.min(h, left);
        const prev = s.omega;
        const next = pendulumStep(s.theta, s.omega, dt, length, g);
        // Толық тербеліс: бұрыштық жылдамдық «+»-тен «−»-ке ауысады (бастапқы шеткі нүктеге оралу).
        if (prev > 0 && next.omega <= 0) {
          const frac = prev / (prev - next.omega);
          s.count += 1;
          onPeriod(s.count, s.t + frac * dt);
          setCount(s.count);
        }
        s.theta = next.theta;
        s.omega = next.omega;
        s.t += dt;
        left -= dt;
        if (target !== null && s.count >= target) break;
      }
    }
    if (arm.current) arm.current.rotation.z = s.theta;
  });

  return (
    <group>
      {/* Штатив */}
      <mesh position={[0.0, 0.015, -0.12]} castShadow receiveShadow>
        <boxGeometry args={[0.3, 0.03, 0.18]} />
        <meshStandardMaterial color="#334155" metalness={0.3} roughness={0.6} />
      </mesh>
      <mesh position={[0, 0.6, -0.15]} castShadow>
        <cylinderGeometry args={[0.009, 0.009, 1.2, 16]} />
        <meshStandardMaterial color="#cbd5e1" metalness={0.9} roughness={0.2} />
      </mesh>
      <mesh position={[0, PIVOT.y, -0.065]} rotation={[Math.PI / 2, 0, 0]} castShadow>
        <cylinderGeometry args={[0.006, 0.006, 0.18, 12]} />
        <meshStandardMaterial color="#cbd5e1" metalness={0.9} roughness={0.2} />
      </mesh>
      <mesh position={[0, PIVOT.y, -0.15]}>
        <boxGeometry args={[0.035, 0.035, 0.035]} />
        <meshStandardMaterial color="#1e293b" />
      </mesh>
      {/* Тербелетін бөлік */}
      <group ref={arm} position={PIVOT}>
        <mesh position={[0, -length / 2, 0]}>
          <cylinderGeometry args={[0.0012, 0.0012, length, 6]} />
          <meshStandardMaterial color="#f8fafc" />
        </mesh>
        <mesh position={[0, -length, 0]} castShadow>
          <sphereGeometry args={[0.022, 32, 32]} />
          <meshStandardMaterial color="#b45309" metalness={0.6} roughness={0.3} />
        </mesh>
      </group>
      {/* Тепе-теңдік сызығы */}
      <mesh position={[0, PIVOT.y - length / 2 - 0.02, -0.002]}>
        <boxGeometry args={[0.0008, length + 0.04, 0.0008]} />
        <meshBasicMaterial color="#64748b" transparent opacity={0.6} />
      </mesh>
      <Label position={[0.09, PIVOT.y - length / 2, 0.02]} tone="light">
        l = {length.toFixed(2)} м
      </Label>
      <Label position={[0, PIVOT.y + 0.06, 0.02]} tone="accent">
        N = {count}
      </Label>
    </group>
  );
}

export default function PendulumLab({ lab }: { lab: LabWork }) {
  const m = useMeasurements(lab.id);
  const sw = useStopwatch();
  const [length, setLength] = useState(0.6);
  const [angle, setAngle] = useState(8);
  const [planet, setPlanet] = useState(PLANETS[0]);
  const [running, setRunning] = useState(false);
  const [target, setTarget] = useState<number | null>(null);
  const [N, setN] = useState(10);
  const [measured, setMeasured] = useState<number | null>(null);
  const [run, setRun] = useState(0);

  const T0 = pendulumPeriod(length, planet.g);

  function release(auto: boolean) {
    setMeasured(null);
    setTarget(auto ? N : null);
    setRun((r) => r + 1);
    setRunning(true);
    if (auto) {
      sw.reset();
      sw.start();
    }
  }

  function stop() {
    setRun((r) => r + 1);
    setRunning(false);
  }

  function onPeriod(count: number, time: number) {
    if (target !== null && count >= target) {
      sw.set(time);
      setMeasured(time);
    }
  }

  function record() {
    const t = sw.elapsed;
    if (t <= 0) return;
    const T = t / N;
    m.add({ l: length, N, t: round(t, 2), T, T0, g: gFromPendulum(length, T) });
  }

  const scene = <Pendulum key={`${run}-${length}-${angle}-${planet.id}`} length={length} theta0={(angle * Math.PI) / 180} g={planet.g} running={running} target={target} onPeriod={onPeriod} />;

  const controls = (
    <>
      <Slider label={tr("Жіп ұзындығы l")} value={length} min={0.2} max={1} step={0.05} unit="м" digits={2} onChange={(v) => { setLength(v); stop(); }} />
      <Slider label={tr("Ауытқу бұрышы")} value={angle} min={3} max={30} step={1} unit="°" digits={0} onChange={(v) => { setAngle(v); stop(); }} />
      <div>
        <div className="mb-1 text-[13px] font-semibold text-slate-700">{tr("Планета")}</div>
        <div className="grid grid-cols-4 gap-1">
          {PLANETS.map((p) => (
            <button key={p.id} type="button" onClick={() => { setPlanet(p); stop(); }} className={`${btn} !px-1 ${planet.id === p.id ? "border-violet-500 bg-violet-50 text-violet-700" : ""}`}>
              {tr(p.label)}
            </button>
          ))}
        </div>
        <p className="mt-1 text-[12px] text-slate-500">g = {planet.g} м/с²</p>
      </div>
      <label className="flex items-center justify-between gap-2 text-[13px]">
        <span className="font-semibold text-slate-700">{tr("Тербеліс саны N")}</span>
        <input type="number" min={1} max={30} value={N} onChange={(e) => setN(Math.max(1, Math.min(30, Number(e.target.value) || 1)))} className="w-20 rounded-lg border border-slate-200 bg-surface px-2 py-1.5 text-right" />
      </label>
      <div className="grid grid-cols-2 gap-1.5">
        <button type="button" className={btn} onClick={() => (running ? stop() : release(false))}>
          {running ? tr("Тоқтату") : tr("Жіберу")}
        </button>
        <button type="button" className={primary} onClick={() => release(true)}>
          {tr("{n} тербелісті өлшеу", { n: N })}
        </button>
      </div>
      <div className="rounded-xl bg-slate-50 p-3 font-mono text-[13px] leading-6">
        <div>
          T₀ = 2π√(l/g) = <b>{T0.toFixed(3)}</b> с
        </div>
        {measured !== null && (
          <div>
            t = <b>{measured.toFixed(2)}</b> с → T = <b>{(measured / N).toFixed(3)}</b> с
          </div>
        )}
      </div>
    </>
  );

  const status =
    measured !== null ? (
      <Status tone="ok">{tr("{n} тербеліс {t} с ішінде өтті. Нәтижені кестеге жазыңыз.", { n: N, t: measured.toFixed(2) })}</Status>
    ) : running ? (
      <Status tone="info">{target ? tr("Өлшеу жүріп жатыр…") : tr("Секундомермен N тербеліс уақытын өлшеңіз.")}</Status>
    ) : (
      <Status tone="info">{tr("Маятникті жіберіңіз немесе «тербелісті өлшеу» батырмасын басыңыз.")}</Status>
    );

  return (
    <LabShell
      lab={lab}
      scene={scene}
      controls={controls}
      status={status}
      onRecord={record}
      recordDisabled={sw.elapsed <= 0 || sw.running}
      measurements={m}
      stopwatch={sw}
      chart={{ x: "l", y: "T" }}
      camera={[0.45, 0.95, 1.75]}
      target={[0, 0.6, 0]}
    />
  );
}
