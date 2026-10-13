// 8-сынып: «Тізбектің бөлігі үшін Ом заңын тексеру».
// Оқушы резисторды ұяға сүйреп қояды, қысқыштарды сымдармен жалғайды, кілтті тұйықтайды.
// Тізбек Кирхгоф заңдарымен нақты есептеледі — қате жиналса, құралдар да «шынайы» қате көрсетеді.

import { useMemo, useState } from "react";
import { tr } from "../../i18n";
import { Draggable } from "../equipment/Draggable";
import { Bulb, PowerSupply, Resistor, ResistorHolder, Switch, Terminal, Wire } from "../equipment/Electric";
import type { Vec3 } from "../equipment/LabScene";
import { Meter } from "../equipment/Meter";
import { LabShell, Slider, Status } from "../LabShell";
import { btn } from "../styles";
import { useMeasurements } from "../useMeasurements";
import { round, solveCircuit, type CircuitElement } from "../physicsEngine";
import type { LabWork } from "../types";

type Comp = "src" | "K" | "A" | "V" | "L" | "slot";
type TerminalId = "src+" | "src-" | "K1" | "K2" | "A+" | "A-" | "V+" | "V-" | "L1" | "L2" | "R1" | "R2";

const RESISTORS = [2, 5, 10] as const;
const R_BULB = 4;
const R_AMMETER = 0.02;
const R_VOLTMETER = 1e6;
const R_INTERNAL = 0.05;
const TRIP_CURRENT = 6;

const TERMINALS: Record<TerminalId, { comp: Comp; offset: Vec3; polarity: "+" | "-" | null }> = {
  "src+": { comp: "src", offset: [-0.075, 0.13, 0.045], polarity: "+" },
  "src-": { comp: "src", offset: [-0.035, 0.13, 0.045], polarity: "-" },
  K1: { comp: "K", offset: [-0.052, 0.03, 0.017], polarity: null },
  K2: { comp: "K", offset: [0.052, 0.03, 0.017], polarity: null },
  "A+": { comp: "A", offset: [-0.05, 0.1, 0.045], polarity: "+" },
  "A-": { comp: "A", offset: [0.05, 0.1, 0.045], polarity: "-" },
  "V+": { comp: "V", offset: [-0.05, 0.1, 0.045], polarity: "+" },
  "V-": { comp: "V", offset: [0.05, 0.1, 0.045], polarity: "-" },
  L1: { comp: "L", offset: [-0.038, 0.027, 0.018], polarity: null },
  L2: { comp: "L", offset: [0.038, 0.027, 0.018], polarity: null },
  R1: { comp: "slot", offset: [-0.065, 0.03, 0], polarity: null },
  R2: { comp: "slot", offset: [0.065, 0.03, 0], polarity: null },
};

const START: Record<Comp, Vec3> = {
  src: [-0.55, 0, -0.12],
  K: [-0.3, 0, 0.13],
  A: [-0.05, 0, -0.2],
  V: [0.28, 0, -0.22],
  L: [0.52, 0, 0.02],
  slot: [0.16, 0, 0.1],
};

const TRAY: Record<number, Vec3> = { 2: [-0.16, 0, 0.33], 5: [0, 0, 0.33], 10: [0.16, 0, 0.33] };

const SAMPLE: [TerminalId, TerminalId][] = [
  ["src+", "K1"],
  ["K2", "A+"],
  ["A-", "R1"],
  ["R2", "L1"],
  ["L2", "src-"],
  ["V+", "R1"],
  ["V-", "R2"],
];

const COLORS = ["#ef4444", "#3b82f6", "#f59e0b", "#10b981", "#a855f7", "#ec4899", "#14b8a6", "#eab308"];

const add = (a: Vec3, b: Vec3): Vec3 => [a[0] + b[0], a[1] + b[1], a[2] + b[2]];
const near = (a: Vec3, b: Vec3, d: number) => Math.hypot(a[0] - b[0], a[2] - b[2]) < d;

type Diagnosis = { tone: "ok" | "warn" | "error" | "info"; text: string };

export default function OhmLab({ lab }: { lab: LabWork }) {
  const m = useMeasurements(lab.id);
  const [U, setU] = useState(6);
  const [closed, setClosed] = useState(false);
  const [pos, setPos] = useState(START);
  const [rPos, setRPos] = useState<Record<number, Vec3>>(TRAY);
  const [slotted, setSlotted] = useState<number | null>(null);
  const [wires, setWires] = useState<[TerminalId, TerminalId][]>([]);
  const [selected, setSelected] = useState<TerminalId | null>(null);
  const [digital, setDigital] = useState(true);

  const tPos = (id: TerminalId) => add(pos[TERMINALS[id].comp], TERMINALS[id].offset);

  function clickTerminal(id: TerminalId) {
    if (!selected) return setSelected(id);
    if (selected === id) return setSelected(null);
    const dup = wires.some(([a, b]) => (a === selected && b === id) || (a === id && b === selected));
    if (!dup) setWires((w) => [...w, [selected, id]]);
    setSelected(null);
  }

  function dropResistor(ohms: number, p: Vec3) {
    if (near(p, pos.slot, 0.09)) {
      if (slotted !== null && slotted !== ohms) setRPos((r) => ({ ...r, [slotted]: TRAY[slotted] }));
      setSlotted(ohms);
    } else {
      if (slotted === ohms) setSlotted(null);
      setRPos((r) => ({ ...r, [ohms]: p }));
    }
  }

  /* ───── Тізбекті есептеу ───── */
  const sim = useMemo(() => {
    // Сымдар арқылы қосылған қысқыштарды бір түйінге біріктіреміз (union–find).
    const ids = Object.keys(TERMINALS) as TerminalId[];
    const parent = new Map<TerminalId, TerminalId>(ids.map((i) => [i, i]));
    const find = (x: TerminalId): TerminalId => {
      while (parent.get(x) !== x) x = parent.get(x)!;
      return x;
    };
    for (const [a, b] of wires) parent.set(find(a), find(b));
    const roots = [...new Set(ids.map(find))];
    const net = (t: TerminalId) => roots.indexOf(find(t));

    const build = (emf: number) => {
      const els: CircuitElement[] = [
        { id: "src", a: net("src+"), b: net("src-"), R: R_INTERNAL, emf },
        { id: "A", a: net("A+"), b: net("A-"), R: R_AMMETER },
        { id: "V", a: net("V+"), b: net("V-"), R: R_VOLTMETER },
        { id: "L", a: net("L1"), b: net("L2"), R: R_BULB },
      ];
      if (closed) els.push({ id: "K", a: net("K1"), b: net("K2"), R: 0.001 });
      if (slotted !== null) els.push({ id: "R", a: net("R1"), b: net("R2"), R: slotted });
      const res = solveCircuit(roots.length, els, net("src-"));
      const cur = (id: string) => {
        const el = els.find((e) => e.id === id);
        return el ? res.current(el) : 0;
      };
      return { V: res.V, cur };
    };

    let r = build(U);
    // Сыммен тікелей тұйықталса, ток көзінің екі қысқышы бір түйінге түседі.
    const tripped = net("src+") === net("src-") || Math.abs(r.cur("src")) > TRIP_CURRENT;
    if (tripped) r = build(0);
    const IA = r.cur("A");
    const UV = r.V[net("V+")] - r.V[net("V-")];
    const IR = r.cur("R");
    const IL = r.cur("L");
    const vAcross = new Set([net("V+"), net("V-")]);
    const vOnResistor = vAcross.size === 2 && vAcross.has(net("R1")) && vAcross.has(net("R2"));
    return { IA, UV, IR, IL, tripped, vOnResistor };
  }, [wires, closed, slotted, U]);

  const diag: Diagnosis = (() => {
    if (!wires.length) return { tone: "info", text: tr("Сымды жалғау үшін бір қысқышты, содан кейін екіншісін басыңыз. Сымды жою үшін оны басыңыз.") };
    if (sim.tripped) return { tone: "error", text: tr("Қысқа тұйықталу! Ток көзінің қорғанысы іске қосылды. Амперметр немесе сым ток көзін тікелей тұйықтап тұр.") };
    if (slotted === null) return { tone: "warn", text: tr("Резисторлардың бірін тышқанмен сүйреп, сары ұяға қойыңыз.") };
    if (!closed) return { tone: "info", text: tr("Кілт ажыратулы. Тізбекті тұйықтау үшін кілттің тұтқасын басыңыз.") };
    if (U < 0.05) return { tone: "info", text: tr("Ток көзінің кернеуін арттырыңыз.") };
    if (sim.IA > 3.05) return { tone: "error", text: tr("Амперметрдің өлшеу шегінен асты (3 А)! Тізбекті тексеріңіз.") };
    if (sim.IA < -1e-4) return { tone: "error", text: tr("Амперметр полярлығы қате: тілше кері ауытқыды. «+» қысқышын ток көзінің «+» жағына жалғаңыз.") };
    if (sim.UV < -1e-3) return { tone: "error", text: tr("Вольтметр полярлығы қате: «+» қысқышын резистордың ток кіретін ұшына жалғаңыз.") };
    if (Math.abs(sim.IR) < 1e-4) {
      if (Math.abs(sim.UV) > 0.8 * U) return { tone: "error", text: tr("Вольтметр тізбекке тізбектей қосылған: оның кедергісі өте үлкен, сондықтан ток жүрмейді. Вольтметр параллель қосылуы тиіс.") };
      return { tone: "warn", text: tr("Тізбек тұйықталмаған — резистор арқылы ток жүрмейді. Сымдарды тексеріңіз.") };
    }
    if (Math.abs(sim.IA - sim.IR) > 0.02 * Math.abs(sim.IR) + 1e-4) return { tone: "warn", text: tr("Амперметр резистормен тізбектей қосылмаған — ол резистордағы токты көрсетпейді.") };
    if (!sim.vOnResistor) return { tone: "warn", text: tr("Вольтметрді резистордың екі ұшына параллель жалғаңыз.") };
    const bulbNote = Math.abs(sim.IL) < 1e-4 ? " " + tr("(Шамды да тізбекке қосуға болады.)") : "";
    return { tone: "ok", text: tr("Тізбек дұрыс жиналды! Кернеуді өзгертіп, өлшеулерді кестеге жазыңыз.") + bulbNote };
  })();

  const ok = diag.tone === "ok";
  const brightness = (sim.IL * sim.IL * R_BULB) / 12;

  function record() {
    if (!ok || slotted === null) return;
    const Uv = round(sim.UV, 2);
    const I = round(sim.IA, 3);
    m.add({ R: slotted, U: Uv, I, Ui: I > 0 ? Uv / I : NaN });
  }

  function sampleWiring() {
    setWires(SAMPLE);
    if (slotted === null) setSlotted(5);
    setSelected(null);
  }

  function reset() {
    setWires([]);
    setSelected(null);
    setClosed(false);
    setSlotted(null);
    setRPos(TRAY);
    setPos(START);
  }

  const movable = (c: Exclude<Comp, "slot">) => ({
    position: pos[c],
    onChange: (p: Vec3) => setPos((s) => ({ ...s, [c]: p })),
    bounds: { x: [-0.72, 0.72] as [number, number], z: [-0.36, 0.36] as [number, number] },
  });

  const scene = (
    <>
      <Draggable {...movable("src")}>
        <PowerSupply position={[0, 0, 0]} voltage={sim.tripped ? 0 : U} on={!sim.tripped} />
      </Draggable>
      <Draggable {...movable("K")}>
        <Switch position={[0, 0, 0]} closed={closed} onToggle={() => setClosed((c) => !c)} />
      </Draggable>
      <Draggable {...movable("A")}>
        <Meter position={[0, 0, 0]} kind="ammeter" value={sim.IA} max={3} majors={6} unit={tr("ампер")} readout={digital ? `${sim.IA.toFixed(2)} A` : null} />
      </Draggable>
      <Draggable {...movable("V")}>
        <Meter position={[0, 0, 0]} kind="voltmeter" value={sim.UV} max={15} majors={5} unit={tr("вольт")} readout={digital ? `${sim.UV.toFixed(2)} V` : null} />
      </Draggable>
      <Draggable {...movable("L")}>
        <Bulb position={[0, 0, 0]} brightness={brightness} />
      </Draggable>
      <ResistorHolder position={pos.slot} filled={slotted !== null} />
      {RESISTORS.map((r) => (
        <Draggable
          key={r}
          position={slotted === r ? add(pos.slot, [0, 0.012, 0]) : rPos[r]}
          onChange={(p) => setRPos((s) => ({ ...s, [r]: p }))}
          onDrop={(p) => dropResistor(r, p)}
          bounds={{ x: [-0.72, 0.72], z: [-0.36, 0.4] }}
        >
          <Resistor ohms={r} highlight={slotted === r} />
        </Draggable>
      ))}
      {(Object.keys(TERMINALS) as TerminalId[]).map((id) => (
        <Terminal key={id} position={tPos(id)} polarity={TERMINALS[id].polarity} selected={selected === id} onClick={() => clickTerminal(id)} />
      ))}
      {wires.map(([a, b], i) => (
        <Wire key={`${a}-${b}`} from={tPos(a)} to={tPos(b)} color={COLORS[i % COLORS.length]} onClick={() => setWires((w) => w.filter((_, j) => j !== i))} />
      ))}
    </>
  );

  const controls = (
    <>
      <Slider label={tr("Ток көзінің кернеуі")} value={U} min={0} max={12} step={0.5} unit="В" onChange={setU} />
      <div className="grid grid-cols-3 gap-1.5">
        {RESISTORS.map((r) => (
          <button
            key={r}
            type="button"
            className={`${btn} ${slotted === r ? "border-violet-500 bg-violet-50 text-violet-700" : ""}`}
            onClick={() => {
              if (slotted !== null) setRPos((s) => ({ ...s, [slotted]: TRAY[slotted] }));
              setSlotted(r);
            }}
          >
            {r} Ом
          </button>
        ))}
      </div>
      <button type="button" className={`${btn} ${closed ? "border-amber-400 bg-amber-50" : ""}`} onClick={() => setClosed((c) => !c)}>
        🔌 {closed ? tr("Кілтті ажырату") : tr("Кілтті тұйықтау")}
      </button>
      <label className="flex items-center gap-2 text-[13px] text-slate-600">
        <input type="checkbox" className="accent-violet-600" checked={digital} onChange={(e) => setDigital(e.target.checked)} />
        {tr("Цифрлық көрсеткішті көрсету")}
      </label>
      <div className="rounded-xl bg-slate-50 p-3 font-mono text-[13px] leading-6">
        <div>
          U = <b>{sim.UV.toFixed(2)}</b> В
        </div>
        <div>
          I = <b>{sim.IA.toFixed(3)}</b> А
        </div>
        <div>
          U / I = <b>{sim.IA > 1e-4 ? (sim.UV / sim.IA).toFixed(2) : "—"}</b> Ом
        </div>
      </div>
      <div className="grid grid-cols-2 gap-1.5">
        <button type="button" className={btn} onClick={sampleWiring}>
          {tr("Үлгі бойынша жалғау")}
        </button>
        <button type="button" className={btn} onClick={reset}>
          {tr("Қайта бастау")}
        </button>
      </div>
      <p className="text-[12px] leading-snug text-slate-500">{tr("Үлгі: ток көзі (+) → кілт → амперметр → резистор → шам → ток көзі (−); вольтметр резисторға параллель.")}</p>
    </>
  );

  return (
    <LabShell
      lab={lab}
      scene={scene}
      controls={controls}
      status={<Status tone={diag.tone}>{diag.text}</Status>}
      onRecord={record}
      recordDisabled={!ok}
      measurements={m}
      chart={{ x: "U", y: "I" }}
      camera={[0, 0.72, 0.95]}
      target={[0, 0.05, 0]}
    />
  );
}
