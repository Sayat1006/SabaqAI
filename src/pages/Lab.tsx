import { useEffect, useRef, useState } from "react";
import { Badge, Button, Card } from "../components/ui";

type SimId = "pendulum" | "cell";

const sims: { id: SimId; title: string; subject: string; icon: string }[] = [
  { id: "pendulum", title: "Математикалық маятник", subject: "Физика", icon: "⏱️" },
  { id: "cell", title: "Жасуша құрылысы", subject: "Биология", icon: "🔬" },
];

function PendulumSim() {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [length, setLength] = useState(120);
  const [gravity, setGravity] = useState(9.8);
  const [running, setRunning] = useState(true);
  const stateRef = useRef({ theta: Math.PI / 3, omega: 0 });

  useEffect(() => {
    stateRef.current = { theta: Math.PI / 3, omega: 0 };
  }, [length, gravity]);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    let raf = 0;
    const originX = canvas.width / 2;
    const originY = 40;
    const scale = 1.6;

    function step() {
      if (running) {
        const s = stateRef.current;
        const accel = (-gravity / (length / 100)) * Math.sin(s.theta);
        s.omega += accel * 0.02;
        s.omega *= 0.999;
        s.theta += s.omega * 0.02;
      }

      ctx!.clearRect(0, 0, canvas!.width, canvas!.height);
      const bobX = originX + length * scale * Math.sin(stateRef.current.theta);
      const bobY = originY + length * scale * Math.cos(stateRef.current.theta);

      ctx!.strokeStyle = "#1b2438";
      ctx!.lineWidth = 2;
      ctx!.beginPath();
      ctx!.moveTo(originX, originY);
      ctx!.lineTo(bobX, bobY);
      ctx!.stroke();

      ctx!.fillStyle = "#2f7d74";
      ctx!.beginPath();
      ctx!.arc(originX, originY, 5, 0, Math.PI * 2);
      ctx!.fill();

      ctx!.fillStyle = "#e0733d";
      ctx!.beginPath();
      ctx!.arc(bobX, bobY, 16, 0, Math.PI * 2);
      ctx!.fill();

      raf = requestAnimationFrame(step);
    }
    raf = requestAnimationFrame(step);
    return () => cancelAnimationFrame(raf);
  }, [length, gravity, running]);

  return (
    <Card className="text-left">
      <h3 className="mb-3 text-lg font-semibold text-slate-900 dark:text-white">
        Математикалық маятник симуляциясы
      </h3>
      <p className="mb-4 text-sm text-slate-600 dark:text-slate-300">
        Жіптің ұзындығы мен еркін түсу үдеуін өзгертіп, маятниктің тербеліс жиілігінің қалай
        өзгеретінін бақылаңыз.
      </p>
      <canvas ref={canvasRef} width={360} height={320} className="mx-auto block rounded-lg bg-violet-50 dark:bg-[#1d1d1f]" />
      <div className="mt-4 grid gap-4 sm:grid-cols-2">
        <label className="block text-left text-sm">
          <span className="mb-1 block font-medium text-slate-700 dark:text-slate-200">
            Жіптің ұзындығы: {length} см
          </span>
          <input
            type="range"
            min={60}
            max={160}
            value={length}
            onChange={(e) => setLength(Number(e.target.value))}
            className="w-full accent-violet-600"
          />
        </label>
        <label className="block text-left text-sm">
          <span className="mb-1 block font-medium text-slate-700 dark:text-slate-200">
            Еркін түсу үдеуі: {gravity.toFixed(1)} м/с²
          </span>
          <input
            type="range"
            min={1}
            max={20}
            step={0.1}
            value={gravity}
            onChange={(e) => setGravity(Number(e.target.value))}
            className="w-full accent-violet-600"
          />
        </label>
      </div>
      <Button variant="ghost" className="mt-4" type="button" onClick={() => setRunning((r) => !r)}>
        {running ? "Тоқтату" : "Жалғастыру"}
      </Button>
    </Card>
  );
}

const cellParts = [
  { id: "nucleus", label: "Ядро", top: "38%", left: "48%", info: "Жасушаның тұқым қуалау ақпаратын (ДНҚ) сақтайды және жасуша қызметін басқарады." },
  { id: "mito", label: "Митохондрия", top: "62%", left: "28%", info: "Жасушаның 'энергия станциясы' — тыныс алу арқылы АТФ өндіреді." },
  { id: "membrane", label: "Жасуша қабығы", top: "12%", left: "50%", info: "Жасушаны қоршап тұрып, заттардың өтуін реттейді." },
  { id: "cytoplasm", label: "Цитоплазма", top: "75%", left: "68%", info: "Органоидтар орналасқан сұйық орта, зат алмасу процестері жүреді." },
];

function CellSim() {
  const [active, setActive] = useState(cellParts[0].id);
  const activePart = cellParts.find((p) => p.id === active)!;

  return (
    <Card className="text-left">
      <h3 className="mb-3 text-lg font-semibold text-slate-900 dark:text-white">
        Жасуша құрылысын зерттеу
      </h3>
      <p className="mb-4 text-sm text-slate-600 dark:text-slate-300">
        Диаграммадағы белгілерді басып, әр органоидтың атауы мен қызметімен танысыңыз.
      </p>
      <div className="relative mx-auto h-72 w-72 rounded-full border-4 border-violet-300 bg-gradient-to-br from-violet-50 to-fuchsia-50 dark:border-violet-700 dark:from-violet-950/40 dark:to-fuchsia-950/40">
        {cellParts.map((p) => (
          <button
            key={p.id}
            type="button"
            onClick={() => setActive(p.id)}
            style={{ top: p.top, left: p.left }}
            className={`absolute flex h-8 w-8 -translate-x-1/2 -translate-y-1/2 items-center justify-center rounded-full border-2 text-xs font-bold transition ${
              active === p.id
                ? "border-violet-600 bg-violet-600 text-white scale-110"
                : "border-violet-400 bg-white text-violet-600 dark:bg-[#1d1d1f]"
            }`}
            aria-label={p.label}
          >
            {p.label.charAt(0)}
          </button>
        ))}
      </div>
      <div className="mt-4 rounded-lg border border-violet-100 p-4 dark:border-violet-900/50">
        <p className="font-semibold text-violet-700 dark:text-violet-300">{activePart.label}</p>
        <p className="mt-1 text-sm text-slate-600 dark:text-slate-300">{activePart.info}</p>
      </div>
    </Card>
  );
}

export default function LabPage() {
  const [selected, setSelected] = useState<SimId | null>(null);

  return (
    <div className="mx-auto max-w-4xl px-4 py-10 sm:px-6">
      <Badge>Виртуалды зертхана</Badge>
      <h1 className="mt-3 mb-2 text-3xl font-semibold text-slate-900 dark:text-white">
        Интерактивті симуляциялар
      </h1>
      <p className="mb-8 text-slate-600 dark:text-slate-300">
        Зертханалық құрал-жабдықсыз-ақ, физика мен биологиядан құбылыстарды браузерде тікелей
        көрсетіп, оқушыларды тартымды сабаққа шақырыңыз.
      </p>

      <div className="mb-6 grid gap-4 sm:grid-cols-2">
        {sims.map((s) => (
          <button key={s.id} type="button" onClick={() => setSelected(s.id)} className="text-left">
            <Card
              className={`h-full transition hover:-translate-y-0.5 hover:shadow-md ${
                selected === s.id ? "ring-2 ring-violet-500" : ""
              }`}
            >
              <div className="mb-2 text-3xl">{s.icon}</div>
              <h3 className="font-semibold text-slate-900 dark:text-white">{s.title}</h3>
              <p className="text-sm text-slate-500 dark:text-slate-400">{s.subject}</p>
            </Card>
          </button>
        ))}
      </div>

      {selected === "pendulum" && <PendulumSim />}
      {selected === "cell" && <CellSim />}
    </div>
  );
}
