// 9-сынып: еңіс жазықтық бойымен дененің үдемелі қозғалысы, a = g(sin α − μ cos α).

import { useFrame } from "@react-three/fiber";
import { useEffect, useRef, useState } from "react";
import * as THREE from "three";
import { tr } from "../../i18n";
import { Arrow, Label, type Vec3 } from "../equipment/LabScene";
import { LabShell, Slider, Status } from "../LabShell";
import { btn, primary } from "../styles";
import { useMeasurements } from "../useMeasurements";
import { round, useInclinedPlane, useStopwatch } from "../physicsEngine";
import type { LabWork } from "../types";

const HINGE: Vec3 = [0.5, 0.02, 0];
const RAMP = 1.12;
const TRACK = 1.0;
const BLOCK: Vec3 = [0.08, 0.04, 0.06];

const SURFACES = [
  { label: "Мұз", mu: 0.03 },
  { label: "Металл", mu: 0.15 },
  { label: "Ағаш", mu: 0.3 },
  { label: "Резеңке", mu: 0.6 },
];

interface RampProps {
  alpha: number;
  mu: number;
  a: number;
  moves: boolean;
  running: boolean;
  forces: boolean;
  onFinish: (t: number) => void;
}

function Ramp({ alpha, mu, a, moves, running, forces, onFinish }: RampProps) {
  const rad = (alpha * Math.PI) / 180;
  const block = useRef<THREE.Group>(null);
  const t = useRef(0);
  const finished = useRef(false);
  const [s, setS] = useState(TRACK);

  // Жаңа жіберу: блок бастапқы орнына.
  useEffect(() => {
    t.current = 0;
    finished.current = false;
  }, [running, alpha, mu]);

  useFrame((_, delta) => {
    let pos = TRACK;
    if (running && moves) {
      if (!finished.current) t.current += Math.min(delta, 0.05);
      pos = TRACK - (a * t.current * t.current) / 2;
      if (pos <= 0 && !finished.current) {
        finished.current = true;
        onFinish(Math.sqrt((2 * TRACK) / a));
      }
      pos = Math.max(0, pos);
    }
    if (block.current) block.current.position.x = -pos - BLOCK[0] / 2;
    if (Math.abs(pos - s) > 0.02 || (pos === 0 && s !== 0) || (pos === TRACK && s !== TRACK)) setS(pos);
  });

  const topX = HINGE[0] - RAMP * Math.cos(rad);
  const topY = HINGE[1] + RAMP * Math.sin(rad);
  // Күш векторлары: блоктың центрінен (әлемдік координатада).
  const cx = HINGE[0] - (s + BLOCK[0] / 2) * Math.cos(rad) - (BLOCK[1] / 2) * Math.sin(rad);
  const cy = HINGE[1] + (s + BLOCK[0] / 2) * Math.sin(rad) + (BLOCK[1] / 2) * Math.cos(rad);
  const c: Vec3 = [cx, cy, BLOCK[2] / 2 + 0.01];
  const along: Vec3 = [Math.cos(rad), -Math.sin(rad), 0]; // төмен қарай
  const normal: Vec3 = [Math.sin(rad), Math.cos(rad), 0];
  const scale = 0.16;
  const fric = moves ? mu * Math.cos(rad) : Math.sin(rad);

  return (
    <group>
      {/* Тірек */}
      <mesh position={[topX, topY / 2, -0.05]} castShadow>
        <cylinderGeometry args={[0.008, 0.008, topY, 12]} />
        <meshStandardMaterial color="#cbd5e1" metalness={0.9} roughness={0.2} />
      </mesh>
      <mesh position={[topX, 0.01, -0.05]}>
        <boxGeometry args={[0.12, 0.02, 0.12]} />
        <meshStandardMaterial color="#334155" />
      </mesh>
      {/* Жазықтық */}
      <group position={HINGE} rotation={[0, 0, -rad]}>
        <mesh position={[-RAMP / 2, -0.01, 0]} castShadow receiveShadow>
          <boxGeometry args={[RAMP, 0.02, 0.14]} />
          <meshStandardMaterial color={mu < 0.1 ? "#bfdbfe" : mu < 0.2 ? "#9ca3af" : mu < 0.45 ? "#c08a52" : "#3f3f46"} roughness={0.6 + mu / 2} metalness={mu < 0.2 ? 0.4 : 0} />
        </mesh>
        {/* Бастау және мәре сызықтары */}
        <mesh position={[-TRACK, 0.001, 0]} rotation={[-Math.PI / 2, 0, 0]}>
          <planeGeometry args={[0.006, 0.14]} />
          <meshBasicMaterial color="#22c55e" />
        </mesh>
        <mesh position={[0, 0.001, 0]} rotation={[-Math.PI / 2, 0, 0]}>
          <planeGeometry args={[0.006, 0.14]} />
          <meshBasicMaterial color="#ef4444" />
        </mesh>
        <group ref={block} position={[-TRACK - BLOCK[0] / 2, BLOCK[1] / 2, 0]}>
          <mesh castShadow>
            <boxGeometry args={BLOCK} />
            <meshStandardMaterial color="#b45309" roughness={0.7} />
          </mesh>
        </group>
      </group>
      <Label position={[HINGE[0] - 0.12, 0.05, 0.1]} tone="light">
        α = {alpha}°
      </Label>
      <Label position={[HINGE[0] - (TRACK / 2) * Math.cos(rad), HINGE[1] + (TRACK / 2) * Math.sin(rad) + 0.08, -0.08]} tone="dark">
        L = {TRACK.toFixed(2)} м
      </Label>
      {forces && (
        <>
          <Arrow from={c} dir={[0, -1, 0]} length={scale} color="#2563eb" label="mg" />
          <Arrow from={c} dir={normal} length={scale * Math.cos(rad)} color="#16a34a" label="N" />
          <Arrow from={c} dir={[-along[0], -along[1], 0]} length={scale * fric} color="#dc2626" label="Fүйк" />
        </>
      )}
    </group>
  );
}

export default function InclineLab({ lab }: { lab: LabWork }) {
  const m = useMeasurements(lab.id);
  const sw = useStopwatch();
  const [alpha, setAlpha] = useState(30);
  const [mu, setMu] = useState(0.3);
  const [mass, setMass] = useState(0.2);
  const [running, setRunning] = useState(false);
  const [forces, setForces] = useState(true);
  const [time, setTime] = useState<number | null>(null);
  const res = useInclinedPlane(alpha, mu, mass);

  function start() {
    setTime(null);
    setRunning(false);
    requestAnimationFrame(() => {
      setRunning(true);
      sw.reset();
      if (res.moves) sw.start();
    });
  }

  function stop() {
    setRunning(false);
    setTime(null);
    sw.reset();
  }

  function onFinish(t: number) {
    sw.set(t);
    setTime(t);
  }

  function record() {
    if (time === null) return;
    const t = round(time, 2);
    m.add({ alpha, mu, t, a: (2 * TRACK) / (t * t), a0: res.a });
  }

  const change = (fn: (v: number) => void) => (v: number) => {
    fn(v);
    stop();
  };

  const controls = (
    <>
      <Slider label={tr("Еңіс бұрышы α")} value={alpha} min={5} max={60} step={1} unit="°" digits={0} onChange={change(setAlpha)} />
      <Slider label={tr("Үйкеліс коэффициенті μ")} value={mu} min={0} max={0.8} step={0.01} unit="" digits={2} onChange={change(setMu)} />
      <div className="grid grid-cols-4 gap-1">
        {SURFACES.map((s) => (
          <button key={s.label} type="button" onClick={() => change(setMu)(s.mu)} className={`${btn} !px-1 ${Math.abs(mu - s.mu) < 0.005 ? "border-violet-500 bg-violet-50 text-violet-700" : ""}`}>
            {tr(s.label)}
          </button>
        ))}
      </div>
      <Slider label={tr("Брусок массасы m")} value={mass} min={0.1} max={1} step={0.05} unit="кг" digits={2} onChange={change(setMass)} />
      <label className="flex items-center gap-2 text-[13px] text-slate-600">
        <input type="checkbox" className="accent-violet-600" checked={forces} onChange={(e) => setForces(e.target.checked)} />
        {tr("Күш векторларын көрсету")}
      </label>
      <div className="grid grid-cols-2 gap-1.5">
        <button type="button" className={primary} onClick={start}>
          ▶ {tr("Жіберу")}
        </button>
        <button type="button" className={btn} onClick={stop}>
          {tr("Басына қайтару")}
        </button>
      </div>
      <div className="rounded-xl bg-slate-50 p-3 font-mono text-[12.5px] leading-6">
        <div>
          a = g(sin α − μ cos α) = <b>{res.a.toFixed(2)}</b> м/с²
        </div>
        <div>
          mg∥ = <b>{res.fParallel.toFixed(2)}</b> Н, Fүйк = <b>{res.fFriction.toFixed(2)}</b> Н
        </div>
        <div>
          tg α = <b>{Math.tan((alpha * Math.PI) / 180).toFixed(2)}</b> {Math.tan((alpha * Math.PI) / 180) > mu ? ">" : "≤"} μ
        </div>
      </div>
    </>
  );

  const status =
    running && !res.moves ? (
      <Status tone="warn">{tr("Брусок қозғалмайды: tg α ≤ μ, тыныштық үйкеліс күші оны ұстап тұр. Бұрышты арттырыңыз.")}</Status>
    ) : time !== null ? (
      <Status tone="ok">{tr("Брусок {L} м жолды {t} с ішінде жүрді. Нәтижені кестеге жазыңыз.", { L: TRACK.toFixed(1), t: time.toFixed(2) })}</Status>
    ) : (
      <Status tone="info">{tr("Бұрыш пен беттің түрін таңдап, «Жіберу» батырмасын басыңыз.")}</Status>
    );

  return (
    <LabShell
      lab={lab}
      scene={<Ramp alpha={alpha} mu={mu} a={res.a} moves={res.moves} running={running} forces={forces} onFinish={onFinish} />}
      controls={controls}
      status={status}
      onRecord={record}
      recordDisabled={time === null}
      measurements={m}
      stopwatch={sw}
      chart={{ x: "alpha", y: "a" }}
      camera={[-0.05, 0.6, 1.35]}
      target={[0, 0.3, 0]}
    />
  );
}
