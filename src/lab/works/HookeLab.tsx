// 7-сынып: серіппенің қатаңдығын анықтау (Гук заңы).
// Жүктерді тышқанмен динамометрдің ілгегіне апарады; серіппе x'' = g − (k/m)x − βx' заңымен тербеліп барып тоқтайды.

import { useFrame } from "@react-three/fiber";
import { useRef, useState } from "react";
import { tr } from "../../i18n";
import { Draggable } from "../equipment/Draggable";
import { Dynamometer } from "../equipment/Dynamometer";
import { dynamometerHookY } from "../equipment/shared";
import { Label, type Vec3 } from "../equipment/LabScene";
import { LabShell, Slider, Status } from "../LabShell";
import { btn } from "../styles";
import { useMeasurements } from "../useMeasurements";
import { G_EARTH, round } from "../physicsEngine";
import type { LabWork } from "../types";

const TOP: Vec3 = [0, 0.74, 0];
const HOOK_X = TOP[0] - 0.012;

interface Weight {
  id: string;
  mass: number;
  home: Vec3;
  color: string;
}

const WEIGHTS: Weight[] = [
  { id: "w50", mass: 0.05, home: [0.14, 0, 0.1], color: "#a1a1aa" },
  { id: "w100a", mass: 0.1, home: [0.22, 0, 0.1], color: "#b45309" },
  { id: "w100b", mass: 0.1, home: [0.3, 0, 0.1], color: "#b45309" },
  { id: "w200", mass: 0.2, home: [0.22, 0, 0.2], color: "#78716c" },
];

const heightOf = (m: number) => 0.012 + m * 0.16;

function WeightMesh({ w }: { w: Weight }) {
  const h = heightOf(w.mass);
  return (
    <group>
      <mesh position={[0, h / 2, 0]} castShadow>
        <cylinderGeometry args={[0.017, 0.017, h, 24]} />
        <meshStandardMaterial color={w.color} metalness={0.7} roughness={0.35} />
      </mesh>
      <mesh position={[0, h + 0.008, 0]} rotation={[0, 0, 0]}>
        <torusGeometry args={[0.006, 0.0014, 8, 16]} />
        <meshStandardMaterial color="#9ca3af" metalness={0.9} roughness={0.2} />
      </mesh>
      <Label position={[0, h + 0.03, 0]} tone="light">
        {Math.round(w.mass * 1000)} г
      </Label>
    </group>
  );
}

function Spring({ k, hanging, onDetach, onState }: { k: number; hanging: Weight[]; onDetach: () => void; onState: (x: number, v: number) => void }) {
  const st = useRef({ x: 0, v: 0 });
  const [x, setX] = useState(0);
  const M = hanging.reduce((s, w) => s + w.mass, 0);

  useFrame((_, delta) => {
    const s = st.current;
    const dt = Math.min(delta, 0.05);
    const steps = 20;
    const mEff = M + 0.005; // ілгек пен серіппенің аз массасы
    for (let i = 0; i < steps; i++) {
      const h = dt / steps;
      const a = (M * G_EARTH - k * s.x) / mEff - 3.2 * s.v;
      s.v += a * h;
      s.x += s.v * h;
    }
    if (Math.abs(s.x - x) > 1e-5) setX(s.x);
    onState(s.x, s.v);
  });

  const hookY = TOP[1] + dynamometerHookY(Math.max(0, x));
  // Әр жүктің төменгі жиегі: алдыңғыларының биіктігі мен ілгектерін ескереміз.
  const tops = hanging.map((_, i) => hanging.slice(0, i + 1).reduce((s, w) => s + heightOf(w.mass) + 0.016, 0));
  return (
    <group>
      {/* Штатив */}
      <mesh position={[0, 0.015, -0.1]} castShadow receiveShadow>
        <boxGeometry args={[0.26, 0.03, 0.16]} />
        <meshStandardMaterial color="#334155" />
      </mesh>
      <mesh position={[0, 0.41, -0.12]} castShadow>
        <cylinderGeometry args={[0.008, 0.008, 0.8, 16]} />
        <meshStandardMaterial color="#cbd5e1" metalness={0.9} roughness={0.2} />
      </mesh>
      <mesh position={[0, 0.78, -0.06]} rotation={[Math.PI / 2, 0, 0]}>
        <cylinderGeometry args={[0.006, 0.006, 0.13, 12]} />
        <meshStandardMaterial color="#cbd5e1" metalness={0.9} roughness={0.2} />
      </mesh>
      <mesh position={[0, 0.765, 0]}>
        <cylinderGeometry args={[0.0012, 0.0012, 0.03, 6]} />
        <meshStandardMaterial color="#9ca3af" />
      </mesh>
      <Dynamometer position={TOP} extension={Math.max(0, x)} k={k} maxForce={5} />
      {/* Ілулі жүктер (басса — ең төменгісі алынады) */}
      <group
        onClick={(e) => {
          e.stopPropagation();
          onDetach();
        }}
        onPointerOver={(e) => {
          e.stopPropagation();
          document.body.style.cursor = "pointer";
        }}
        onPointerOut={() => (document.body.style.cursor = "")}
      >
        {hanging.map((w, i) => (
          <group key={w.id} position={[HOOK_X, hookY - 0.006 - tops[i], 0]}>
            <WeightMesh w={w} />
          </group>
        ))}
      </group>
      {/* Ілгекке тастау аймағы */}
      <mesh position={[HOOK_X, 0.032, 0]} rotation={[-Math.PI / 2, 0, 0]}>
        <ringGeometry args={[0.05, 0.06, 32]} />
        <meshBasicMaterial color="#facc15" transparent opacity={0.5} />
      </mesh>
    </group>
  );
}

export default function HookeLab({ lab }: { lab: LabWork }) {
  const meas = useMeasurements(lab.id);
  const [k, setK] = useState(40);
  const [hanging, setHanging] = useState<Weight[]>([]);
  const [pos, setPos] = useState<Record<string, Vec3>>(() => Object.fromEntries(WEIGHTS.map((w) => [w.id, w.home])));
  const state = useRef({ x: 0, v: 0 });
  const [settled, setSettled] = useState(true);

  const M = hanging.reduce((s, w) => s + w.mass, 0);
  const F = M * G_EARTH;
  const onTable = WEIGHTS.filter((w) => !hanging.some((h) => h.id === w.id));

  function onState(x: number, v: number) {
    state.current = { x, v };
    const now = Math.abs(v) < 0.003 && Math.abs(k * x - F) < 0.02;
    if (now !== settled) setSettled(now);
  }

  function drop(w: Weight, p: Vec3) {
    if (Math.hypot(p[0] - HOOK_X, p[2]) < 0.1) {
      if ((M + w.mass) * G_EARTH > 5) return setPos((s) => ({ ...s, [w.id]: w.home }));
      setHanging((h) => [...h, w]);
      setPos((s) => ({ ...s, [w.id]: w.home }));
    }
  }

  function detach() {
    setHanging((h) => h.slice(0, -1));
  }

  function record() {
    const x = state.current.x;
    if (M <= 0 || x <= 0) return;
    const Fr = round(k * x, 2);
    const xCm = round(x * 100, 1);
    meas.add({ m: M, F: Fr, x: xCm, k: Fr / (xCm / 100) });
  }

  const scene = (
    <>
      <Spring k={k} hanging={hanging} onDetach={detach} onState={onState} />
      {onTable.map((w) => (
        <Draggable key={w.id} position={pos[w.id]} onChange={(p) => setPos((s) => ({ ...s, [w.id]: p }))} onDrop={(p) => drop(w, p)} bounds={{ x: [-0.7, 0.7], z: [-0.35, 0.35] }}>
          <WeightMesh w={w} />
        </Draggable>
      ))}
    </>
  );

  const overload = (M + Math.min(...onTable.map((w) => w.mass), Infinity)) * G_EARTH > 5 && onTable.length > 0;

  const controls = (
    <>
      <Slider label={tr("Серіппе қатаңдығы k (мұғалімге)")} value={k} min={30} max={80} step={5} unit="Н/м" digits={0} onChange={setK} />
      <div className="rounded-xl bg-slate-50 p-3 font-mono text-[13px] leading-6">
        <div>
          m = <b>{Math.round(M * 1000)}</b> г
        </div>
        <div>
          F = m·g = <b>{F.toFixed(2)}</b> Н
        </div>
      </div>
      <button type="button" className={btn} onClick={detach} disabled={!hanging.length}>
        {tr("Соңғы жүкті алу")}
      </button>
      <button type="button" className={btn} onClick={() => setHanging([])} disabled={!hanging.length}>
        {tr("Барлық жүкті алу")}
      </button>
      <p className="text-[12px] leading-snug text-slate-500">{tr("Кеңес: созылуды x сызғышпен де өлшеуге болады — тілшенің нөлдік және соңғы орнын басыңыз.")}</p>
    </>
  );

  const status = !hanging.length ? (
    <Status tone="info">{tr("Жүкті тышқанмен сүйреп, динамометрдің астындағы сары шеңберге апарыңыз.")}</Status>
  ) : !settled ? (
    <Status tone="warn">{tr("Серіппе тербеліп тұр — тоқтағанын күтіңіз.")}</Status>
  ) : (
    <Status tone="ok">
      {tr("Тепе-теңдік: динамометр көрсетуі мен созылуды кестеге жазыңыз.")}
      {overload ? " " + tr("(Келесі жүк динамометрдің шегінен асады.)") : ""}
    </Status>
  );

  return (
    <LabShell
      lab={lab}
      scene={scene}
      controls={controls}
      status={status}
      onRecord={record}
      recordDisabled={!hanging.length || !settled}
      measurements={meas}
      chart={{ x: "x", y: "F" }}
      camera={[0.35, 0.55, 1.15]}
      target={[0.1, 0.38, 0]}
    />
  );
}
