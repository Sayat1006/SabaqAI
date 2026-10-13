// 11-сынып: жинағыш линзаның фокус аралығын анықтау.
// Шам мен экранды оптикалық скамья бойымен жылжытып, анық кескін ізделеді.
// Экрандағы кескін линза формуласымен есептеледі; экран кескін жазықтығынан ауытқыса, бұлдыр шығады.

import { Line } from "@react-three/drei";
import { useFrame } from "@react-three/fiber";
import { useEffect, useMemo, useRef, useState } from "react";
import * as THREE from "three";
import { tr } from "../../i18n";
import { Draggable } from "../equipment/Draggable";
import { Label, type Vec3 } from "../equipment/LabScene";
import { LabShell, Slider, Status } from "../LabShell";
import { btn } from "../styles";
import { useMeasurements } from "../useMeasurements";
import { focalFromDistances, round, useThinLens } from "../physicsEngine";
import type { LabWork } from "../types";

const AXIS = 0.17;
const OBJ_H = 0.07; // жалын ұшының оптикалық осьтен биіктігі, м
const APERTURE = 0.05; // линза диаметрі, м
const SCREEN = 0.22;
const BENCH = 0.68;

function benchTexture() {
  const W = 2048;
  const H = 64;
  const c = document.createElement("canvas");
  c.width = W;
  c.height = H;
  const g = c.getContext("2d")!;
  g.fillStyle = "#f5f5f4";
  g.fillRect(0, 0, W, H);
  g.fillStyle = "#1c1b2e";
  g.strokeStyle = "#1c1b2e";
  g.font = "bold 20px Arial, sans-serif";
  g.textAlign = "center";
  const cm = Math.round(BENCH * 100);
  for (let i = -cm; i <= cm; i++) {
    const x = ((i + cm) / (2 * cm)) * W;
    const big = i % 10 === 0;
    const mid = i % 5 === 0;
    g.lineWidth = big ? 3 : 1.5;
    g.beginPath();
    g.moveTo(x, 0);
    g.lineTo(x, big ? 30 : mid ? 22 : 12);
    g.stroke();
    if (big) g.fillText(String(Math.abs(i)), x, 56);
  }
  const t = new THREE.CanvasTexture(c);
  t.colorSpace = THREE.SRGBColorSpace;
  t.anisotropy = 8;
  return t;
}

/** Экрандағы кескін: төңкерілген шам, бұлдырлығы мен жарықтығы есептелген. */
function drawScreen(state: { real: boolean; mag: number; blurM: number; virtual: boolean }) {
  const c = document.createElement("canvas");
  c.width = 256;
  c.height = 256;
  const g = c.getContext("2d")!;
  const px = 256 / SCREEN; // пиксель / метр
  // Қараңғы зертханадағы экран — сұрғылт; кескін жарқырап көрінеді.
  g.fillStyle = "#b9b5ab";
  g.fillRect(0, 0, 256, 256);
  if (state.real) {
    const blurPx = Math.min(40, (state.blurM / 2) * px);
    const dim = Math.max(0.15, 1 / (1 + (state.blurM / 0.01) ** 2));
    g.save();
    g.filter = blurPx > 0.3 ? `blur(${blurPx.toFixed(1)}px)` : "none";
    g.globalAlpha = dim;
    g.translate(128, 128);
    // Кескін төңкерілген: оптикалық осьтен төмен қарай салынады.
    const s = state.mag * px;
    const flameH = 0.025 * s;
    const bodyH = 0.05 * s;
    const w = 0.012 * s;
    const halo = g.createRadialGradient(0, bodyH + flameH * 0.55, 1, 0, bodyH + flameH * 0.55, flameH * 2.2);
    halo.addColorStop(0, "rgba(255,214,120,0.55)");
    halo.addColorStop(1, "rgba(255,214,120,0)");
    g.fillStyle = halo;
    g.fillRect(-flameH * 2.2, bodyH - flameH * 1.7, flameH * 4.4, flameH * 4.4);
    g.fillStyle = "#f5f1e6";
    g.fillRect(-w / 2, 0, w, bodyH);
    const grad = g.createRadialGradient(0, bodyH + flameH * 0.55, 1, 0, bodyH + flameH * 0.55, flameH);
    grad.addColorStop(0, "#fff7cc");
    grad.addColorStop(0.5, "#fbbf24");
    grad.addColorStop(1, "rgba(234,88,12,0)");
    g.fillStyle = grad;
    g.beginPath();
    g.ellipse(0, bodyH + flameH * 0.55, w * 0.45, flameH * 0.6, 0, 0, Math.PI * 2);
    g.fill();
    g.restore();
  } else if (state.virtual) {
    g.fillStyle = "rgba(251,191,36,0.18)";
    g.beginPath();
    g.arc(128, 128, 90, 0, Math.PI * 2);
    g.fill();
  }
  const t = new THREE.CanvasTexture(c);
  t.colorSpace = THREE.SRGBColorSpace;
  return t;
}

function useScreenTexture(real: boolean, mag: number, blurM: number, virtual: boolean) {
  const tex = useMemo(() => drawScreen({ real, mag, blurM, virtual }), [real, mag, blurM, virtual]);
  useEffect(() => () => tex.dispose(), [tex]);
  return tex;
}

function Flame({ position }: { position: Vec3 }) {
  const ref = useRef<THREE.Mesh>(null);
  useFrame(({ clock }) => {
    if (ref.current) ref.current.scale.set(1, 1 + 0.08 * Math.sin(clock.elapsedTime * 13) + 0.05 * Math.sin(clock.elapsedTime * 31), 1);
  });
  return (
    <group position={position}>
      <mesh ref={ref} position={[0, 0.011, 0]}>
        <sphereGeometry args={[0.007, 16, 16]} />
        <meshBasicMaterial color="#fbbf24" toneMapped={false} />
      </mesh>
      <pointLight color="#ffb347" intensity={0.25} distance={0.5} />
    </group>
  );
}

function Post({ height }: { height: number }) {
  return (
    <>
      <mesh position={[0, 0.035, 0]}>
        <boxGeometry args={[0.05, 0.02, 0.07]} />
        <meshStandardMaterial color="#1f2937" />
      </mesh>
      <mesh position={[0, 0.045 + height / 2, 0]}>
        <cylinderGeometry args={[0.005, 0.005, height, 12]} />
        <meshStandardMaterial color="#cbd5e1" metalness={0.9} roughness={0.2} />
      </mesh>
    </>
  );
}

export default function LensLab({ lab }: { lab: LabWork }) {
  const m = useMeasurements(lab.id);
  const [F, setF] = useState(12);
  const [candleX, setCandleX] = useState(-0.3);
  const [screenX, setScreenX] = useState(0.4);
  const [rays, setRays] = useState(true);
  const bench = useMemo(() => benchTexture(), []);

  const d = -candleX; // м
  const s = screenX; // м
  const img = useThinLens(F / 100, d);
  const blurM = img.real ? (APERTURE * Math.abs(s - img.f)) / img.f : Infinity;
  const sharp = img.real ? Math.round(100 * Math.exp(-blurM / 0.004)) : 0;
  const screenTex = useScreenTexture(img.real && Number.isFinite(img.f), s / d, blurM, !img.real);

  const rayLines = useMemo(() => {
    const tip = new THREE.Vector3(candleX, AXIS + OBJ_H, 0);
    const out: { pts: Vec3[]; color: string; dashed?: boolean }[] = [];
    const Fm = F / 100;
    const h = OBJ_H;
    const xEnd = s;
    const at = (p: THREE.Vector3, q: THREE.Vector3, x: number): Vec3 => {
      const k = (x - p.x) / (q.x - p.x);
      return [x, p.y + (q.y - p.y) * k, 0];
    };
    const lensTop = new THREE.Vector3(0, AXIS + h, 0);
    const center = new THREE.Vector3(0, AXIS, 0);
    // 1) оське параллель → линзадан кейін артқы фокус арқылы
    const back = new THREE.Vector3(Fm, AXIS, 0);
    out.push({ pts: [[tip.x, tip.y, 0], [0, lensTop.y, 0], at(lensTop, back, xEnd)], color: "#f59e0b" });
    // 2) оптикалық центр арқылы — сынбайды
    out.push({ pts: [[tip.x, tip.y, 0], at(tip, center, xEnd)], color: "#ef4444" });
    // 3) алдыңғы фокус арқылы → линзадан кейін оське параллель
    if (d > Fm + 1e-3) {
      const y3 = AXIS - (h * Fm) / (d - Fm);
      out.push({ pts: [[tip.x, tip.y, 0], [0, y3, 0], [xEnd, y3, 0]], color: "#22c55e" });
    }
    // Жалған кескін: сәулелердің жалғасы (үзік сызық)
    if (!img.real && !img.atInfinity) {
      const vx = img.f; // теріс
      const vy = AXIS + h * (-img.f / d);
      out.push({ pts: [[0, lensTop.y, 0], [vx, vy, 0]], color: "#f59e0b", dashed: true });
      out.push({ pts: [[0, AXIS, 0], [vx, vy, 0]], color: "#ef4444", dashed: true });
    }
    return out;
  }, [F, d, s, img, candleX]);

  function record() {
    const dc = round(d * 100, 1);
    const fc = round(s * 100, 1);
    const Fc = focalFromDistances(dc, fc);
    m.add({ d: dc, f: fc, F: Fc, D: 100 / Fc, G: fc / dc });
  }

  const scene = (
    <>
      {/* Оптикалық скамья */}
      <mesh position={[0, 0.012, 0]} castShadow receiveShadow>
        <boxGeometry args={[BENCH * 2 + 0.04, 0.024, 0.08]} />
        <meshStandardMaterial color="#475569" metalness={0.5} roughness={0.4} />
      </mesh>
      <mesh position={[0, 0.0245, 0.025]} rotation={[-Math.PI / 2, 0, 0]}>
        <planeGeometry args={[BENCH * 2, 0.03]} />
        <meshBasicMaterial map={bench} toneMapped={false} />
      </mesh>
      {/* Оптикалық ось және фокус нүктелері */}
      <mesh position={[0, AXIS, 0]} rotation={[0, 0, Math.PI / 2]}>
        <cylinderGeometry args={[0.0006, 0.0006, BENCH * 2, 6]} />
        <meshBasicMaterial color="#94a3b8" transparent opacity={0.5} />
      </mesh>
      {[-1, 1, -2, 2].map((k) => (
        <group key={k} position={[(k * F) / 100, AXIS, 0]}>
          <mesh>
            <sphereGeometry args={[0.004, 12, 12]} />
            <meshBasicMaterial color={Math.abs(k) === 1 ? "#38bdf8" : "#a78bfa"} />
          </mesh>
          <Label position={[0, -0.022, 0]} tone="dark" size={0.024}>
            {Math.abs(k) === 1 ? "F" : "2F"}
          </Label>
        </group>
      ))}
      {/* Линза */}
      <group position={[0, 0, 0]}>
        <Post height={AXIS - 0.045 - APERTURE / 2} />
        <mesh position={[0, AXIS, 0]} scale={[0.14, 1, 1]}>
          <sphereGeometry args={[APERTURE / 2 + 0.005, 40, 40]} />
          <meshStandardMaterial color="#bae6fd" emissive="#0ea5e9" emissiveIntensity={0.15} roughness={0.05} metalness={0.1} transparent opacity={0.5} />
        </mesh>
        <mesh position={[0, AXIS, 0]} rotation={[0, Math.PI / 2, 0]}>
          <torusGeometry args={[APERTURE / 2 + 0.005, 0.003, 8, 40]} />
          <meshStandardMaterial color="#334155" />
        </mesh>
      </group>
      {/* Шам */}
      <Draggable position={[candleX, 0, 0]} onChange={(p) => setCandleX(round(p[0], 3))} axis="x" bounds={{ x: [-BENCH + 0.02, -0.04] }}>
        <Post height={AXIS - 0.045} />
        <mesh position={[0, AXIS + 0.025, 0]} castShadow>
          <cylinderGeometry args={[0.009, 0.009, 0.05, 16]} />
          <meshStandardMaterial color="#f8fafc" roughness={0.6} />
        </mesh>
        <Flame position={[0, AXIS + 0.05, 0]} />
        <Label position={[0, AXIS + 0.11, 0]} tone="light">
          d = {(d * 100).toFixed(1)} см
        </Label>
      </Draggable>
      {/* Экран */}
      <Draggable position={[screenX, 0, 0]} onChange={(p) => setScreenX(round(p[0], 3))} axis="x" bounds={{ x: [0.04, BENCH - 0.02] }}>
        <Post height={AXIS - 0.045 - SCREEN / 2} />
        {/* Экран линзаға қарайды, көрерменге қарай сәл бұрылған */}
        <group position={[0, AXIS, 0]} rotation={[0, 0.6, 0]}>
          <mesh position={[0.004, 0, 0]}>
            <boxGeometry args={[0.006, SCREEN + 0.01, SCREEN + 0.01]} />
            <meshStandardMaterial color="#1f2937" />
          </mesh>
          <mesh rotation={[0, -Math.PI / 2, 0]}>
            <planeGeometry args={[SCREEN, SCREEN]} />
            <meshBasicMaterial map={screenTex} toneMapped={false} />
          </mesh>
        </group>
        <Label position={[0, AXIS + SCREEN / 2 + 0.03, 0]} tone="light">
          f = {(s * 100).toFixed(1)} см
        </Label>
      </Draggable>
      {/* Сәулелер */}
      {rays &&
        rayLines.map((r, i) => <Line key={i} points={r.pts} color={r.color} lineWidth={1.6} dashed={r.dashed} dashSize={0.01} gapSize={0.008} transparent opacity={0.9} />)}
    </>
  );

  const controls = (
    <>
      <Slider label={tr("Линзаның фокус аралығы F (мұғалімге)")} value={F} min={8} max={20} step={1} unit="см" digits={0} onChange={setF} />
      <Slider label={tr("Шамнан линзаға дейін d")} value={d * 100} min={4} max={66} step={0.5} unit="см" onChange={(v) => setCandleX(-v / 100)} />
      <Slider label={tr("Линзадан экранға дейін f")} value={s * 100} min={4} max={66} step={0.5} unit="см" onChange={(v) => setScreenX(v / 100)} />
      <div>
        <div className="mb-1 flex justify-between text-[13px]">
          <span className="font-semibold text-slate-700">{tr("Кескіннің анықтығы")}</span>
          <span className="font-mono">{sharp}%</span>
        </div>
        <div className="h-2.5 overflow-hidden rounded-full bg-slate-200">
          <div className={`h-full rounded-full ${sharp > 85 ? "bg-emerald-500" : sharp > 50 ? "bg-amber-400" : "bg-red-400"}`} style={{ width: `${sharp}%` }} />
        </div>
      </div>
      <label className="flex items-center gap-2 text-[13px] text-slate-600">
        <input type="checkbox" className="accent-violet-600" checked={rays} onChange={(e) => setRays(e.target.checked)} />
        {tr("Сәулелер жолын көрсету")}
      </label>
      <button type="button" className={btn} onClick={() => img.real && setScreenX(Math.min(BENCH - 0.02, round(img.f, 3)))} disabled={!img.real || img.f > BENCH - 0.02}>
        {tr("Экранды анық кескінге қою (мұғалімге)")}
      </button>
      <div className="rounded-xl bg-slate-50 p-3 font-mono text-[12.5px] leading-6">
        <div>
          1/F = 1/d + 1/f → F = <b>{focalFromDistances(d * 100, s * 100).toFixed(1)}</b> см
        </div>
        <div>
          Γ = f/d = <b>{(s / d).toFixed(2)}</b>
        </div>
      </div>
    </>
  );

  const status = !img.real ? (
    <Status tone="warn">
      {img.atInfinity ? tr("Шам фокуста тұр: сәулелер параллель шығады, кескін шексіздікте.") : tr("d < F: кескін жалған, тура және үлкейтілген — экранда шықпайды. Шамды линзадан алыстатыңыз.")}
    </Status>
  ) : img.f > BENCH - 0.02 ? (
    <Status tone="warn">{tr("Анық кескін скамьядан тыс. Шамды линзадан сәл алыстатыңыз.")}</Status>
  ) : sharp > 85 ? (
    <Status tone="ok">
      {tr("Кескін анық! Ол нақты, төңкерілген, {kind}. Кестеге жазыңыз.", { kind: s > d ? tr("үлкейтілген") : s < d ? tr("кішірейтілген") : tr("нәрсемен бірдей") })}
    </Status>
  ) : (
    <Status tone="info">{tr("Экранды жылжытып, кескін ең анық болатын орынды табыңыз.")}</Status>
  );

  return (
    <LabShell
      lab={lab}
      scene={scene}
      controls={controls}
      status={status}
      onRecord={record}
      recordDisabled={sharp < 60}
      measurements={m}
      camera={[0.05, 0.42, 0.9]}
      target={[0, 0.15, 0]}
    />
  );
}
