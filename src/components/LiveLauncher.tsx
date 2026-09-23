import { Gamepad2 } from "lucide-react";
import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { createLiveGame } from "../lib/live";
import type { SavedTest } from "../lib/projects";

const TIMES = [10, 20, 30, 45, 60];

/** Тесттен тірі викторина жасау: оқушылар телефоннан кодпен қосылып, бірге жарысады. */
export function LiveLauncher({ test }: { test: SavedTest }) {
  const navigate = useNavigate();
  const [time, setTime] = useState(20);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");

  async function start() {
    setBusy(true);
    setError("");
    try {
      const questions = test.questions.slice(0, 50).map((q) => ({ question: q.question, options: q.options, correctIndex: q.correctIndex }));
      const g = await createLiveGame(test.topic, questions, time, test.lang ?? "kk");
      navigate(`/live/${g.id}`);
    } catch (e) {
      setError(e instanceof Error && e.message !== "unknown" ? e.message : "Викторинаны бастау мүмкін болмады.");
      setBusy(false);
    }
  }

  return (
    <section className="flex flex-col gap-4 rounded-[22px] border border-slate-200 bg-gradient-to-br from-violet-50 to-fuchsia-50 p-5 sm:p-6 print:hidden">
      <div className="flex items-start gap-3">
        <span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl bg-violet-600 text-white">
          <Gamepad2 size={22} />
        </span>
        <div>
          <h2 className="text-lg font-bold">Тірі викторина</h2>
          <p className="text-sm text-slate-600">
            Сұрақтарды тақтаға шығарыңыз — оқушылар телефоннан кодпен қосылып, уақытқа жарысып жауап береді. Соңында көшбасшылар кестесі шығады.
          </p>
        </div>
      </div>
      <div className="flex flex-wrap items-center gap-2">
        <span className="text-sm text-slate-500">Әр сұраққа:</span>
        {TIMES.map((t) => (
          <button
            key={t}
            type="button"
            aria-pressed={time === t}
            onClick={() => setTime(t)}
            className={`rounded-full border px-3 py-1.5 text-sm ${time === t ? "border-violet-600 bg-violet-600 text-white" : "border-slate-200 bg-white hover:border-violet-500"}`}
          >
            {t} сек
          </button>
        ))}
        <button type="button" onClick={start} disabled={busy || !test.questions.length} className="ml-auto inline-flex items-center gap-2 rounded-[12px] bg-violet-600 px-4 py-2.5 text-sm font-semibold text-white disabled:opacity-60">
          <Gamepad2 size={16} /> {busy ? "Дайындалуда..." : "Викторинаны бастау"}
        </button>
      </div>
      {error && <p className="rounded-xl bg-rose-50 px-3 py-2 text-sm text-rose-700">{error}</p>}
    </section>
  );
}
