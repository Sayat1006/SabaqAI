import { useState } from "react";
import { Badge, Button, Card, Field, Select, TextInput } from "../components/ui";
import { generateQuiz, type Quiz } from "../lib/generators";

const difficulties = ["Оңай", "Орташа", "Қиын"];

export default function DodaPage() {
  const [topic, setTopic] = useState("");
  const [count, setCount] = useState(5);
  const [difficulty, setDifficulty] = useState(difficulties[1]);
  const [quiz, setQuiz] = useState<Quiz | null>(null);
  const [revealed, setRevealed] = useState<Set<number>>(new Set());
  const [teamAName, setTeamAName] = useState("Топ А");
  const [teamBName, setTeamBName] = useState("Топ Б");
  const [scoreA, setScoreA] = useState(0);
  const [scoreB, setScoreB] = useState(0);
  const [awarded, setAwarded] = useState<Record<number, "A" | "B">>({});
  const [exportingPptx, setExportingPptx] = useState(false);
  const [exportingDocx, setExportingDocx] = useState(false);
  const [generating, setGenerating] = useState(false);
  const [generateError, setGenerateError] = useState("");

  async function handleExportPptx() {
    if (!quiz) return;
    setExportingPptx(true);
    try {
      const { exportDodaToPptx } = await import("../lib/exportPptx");
      await exportDodaToPptx(quiz, teamAName || "Топ А", teamBName || "Топ Б");
    } finally {
      setExportingPptx(false);
    }
  }

  async function handleExportDocx() {
    if (!quiz) return;
    setExportingDocx(true);
    try {
      const { exportDodaToDocx } = await import("../lib/exportDocx");
      await exportDodaToDocx(quiz);
    } finally {
      setExportingDocx(false);
    }
  }

  async function handleGenerate(e: React.FormEvent) {
    e.preventDefault();
    if (!topic.trim()) return;
    setGenerating(true);
    setGenerateError("");
    try {
      const newQuiz = await generateQuiz(topic.trim(), count, difficulty);
      setQuiz(newQuiz);
      setRevealed(new Set());
      setAwarded({});
      setScoreA(0);
      setScoreB(0);
    } catch (err) {
      setGenerateError(err instanceof Error ? err.message : "Дода сұрақтарын жасау мүмкін болмады.");
    } finally {
      setGenerating(false);
    }
  }

  function toggleReveal(i: number) {
    setRevealed((prev) => {
      const next = new Set(prev);
      if (next.has(i)) next.delete(i);
      else next.add(i);
      return next;
    });
  }

  function award(i: number, team: "A" | "B") {
    setAwarded((prev) => {
      const already = prev[i];
      if (already === team) {
        const rest = Object.fromEntries(Object.entries(prev).filter(([key]) => key !== String(i))) as Record<number, "A" | "B">;
        if (team === "A") setScoreA((s) => s - 1);
        else setScoreB((s) => s - 1);
        return rest;
      }
      if (already) {
        if (already === "A") setScoreA((s) => s - 1);
        else setScoreB((s) => s - 1);
      }
      if (team === "A") setScoreA((s) => s + 1);
      else setScoreB((s) => s + 1);
      return { ...prev, [i]: team };
    });
  }

  return (
    <div className="mx-auto max-w-4xl px-4 py-10 sm:px-6">
      <Badge>Дода · интерактивті викторина-ойын</Badge>
      <h1 className="mt-3 mb-2 text-3xl font-semibold text-slate-900 dark:text-white">
        Сыныпты Дода жарысына шақыр
      </h1>
      <p className="mb-8 text-slate-600 dark:text-slate-300">
        Тақырыпты, сұрақ санын және қиындық деңгейін таңдаңыз — сынып екі топқа бөлініп, ұпай
        тақтасымен жарысады.
      </p>

      <Card>
        <form onSubmit={handleGenerate} className="grid gap-1 sm:grid-cols-3 sm:gap-x-6">
          <Field className="sm:col-span-3">
            Тақырып
            <TextInput
              placeholder="мысалы: Фотосинтез"
              value={topic}
              onChange={(e) => setTopic(e.target.value)}
              required
            />
          </Field>
          <Field>
            Сұрақ саны
            <TextInput
              type="number"
              min={3}
              max={15}
              value={count}
              onChange={(e) => setCount(Number(e.target.value))}
            />
          </Field>
          <Field>
            Қиындық деңгейі
            <Select value={difficulty} onChange={(e) => setDifficulty(e.target.value)}>
              {difficulties.map((d) => (
                <option key={d}>{d}</option>
              ))}
            </Select>
          </Field>
          <div className="flex items-end pb-4">
            <Button type="submit" className="w-full" disabled={generating}>
              {generating ? "ЖИ жасап жатыр..." : "Дода бастау"}
            </Button>
          </div>
          {generateError && <p className="mb-4 text-sm text-rose-600 dark:text-rose-400 sm:col-span-3">{generateError}</p>}
        </form>
      </Card>

      {quiz && (
        <>
          <Card className="mt-6">
            <div className="grid grid-cols-2 divide-x divide-violet-100 dark:divide-violet-900/50">
              <div className="px-4 text-center">
                <input
                  value={teamAName}
                  onChange={(e) => setTeamAName(e.target.value)}
                  className="mb-1 w-full rounded-md bg-transparent text-center text-sm font-medium text-slate-600 outline-none focus:bg-violet-50 dark:text-slate-300 dark:focus:bg-violet-900/30"
                />
                <p className="text-4xl font-bold text-violet-600 dark:text-violet-300">{scoreA}</p>
              </div>
              <div className="px-4 text-center">
                <input
                  value={teamBName}
                  onChange={(e) => setTeamBName(e.target.value)}
                  className="mb-1 w-full rounded-md bg-transparent text-center text-sm font-medium text-slate-600 outline-none focus:bg-violet-50 dark:text-slate-300 dark:focus:bg-violet-900/30"
                />
                <p className="text-4xl font-bold text-fuchsia-600 dark:text-fuchsia-300">{scoreB}</p>
              </div>
            </div>
          </Card>

          <Card className="mt-6 text-left">
            <div className="mb-1 flex flex-wrap items-start justify-between gap-3">
              <h2 className="text-2xl font-semibold text-slate-900 dark:text-white">
                {quiz.topic} — Дода сұрақтары
              </h2>
              <div className="flex flex-wrap gap-2">
                <Button variant="ghost" type="button" onClick={handleExportDocx} disabled={exportingDocx}>
                  {exportingDocx ? "Дайындалуда..." : "📄 Word-ке экспорттау"}
                </Button>
                <Button variant="ghost" type="button" onClick={handleExportPptx} disabled={exportingPptx}>
                  {exportingPptx ? "Дайындалуда..." : "📽️ PPTX жүктеу"}
                </Button>
              </div>
            </div>
            <p className="mb-4 text-sm text-slate-500 dark:text-slate-400">
              Деңгей: {quiz.difficulty} · {quiz.questions.length} сұрақ
            </p>

            <div className="space-y-5">
              {quiz.questions.map((q, i) => (
                <div key={i} className="rounded-lg border border-violet-100 p-4 dark:border-violet-900/50">
                  <p className="mb-2 font-medium text-slate-900 dark:text-white">{q.question}</p>
                  <ul className="space-y-1.5">
                    {q.options.map((opt, oi) => {
                      const isCorrect = revealed.has(i) && oi === q.correctIndex;
                      return (
                        <li
                          key={oi}
                          className={`rounded-md border px-3 py-1.5 text-sm ${
                            isCorrect
                              ? "border-emerald-400 bg-emerald-50 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-300"
                              : "border-violet-100 text-slate-600 dark:border-violet-900/40 dark:text-slate-300"
                          }`}
                        >
                          {String.fromCharCode(65 + oi)}. {opt}
                        </li>
                      );
                    })}
                  </ul>
                  <div className="mt-2 flex flex-wrap items-center gap-2">
                    <Button variant="ghost" className="!px-3 !py-1 text-xs" type="button" onClick={() => toggleReveal(i)}>
                      {revealed.has(i) ? "Жауапты жасыру" : "Дұрыс жауапты көрсету"}
                    </Button>
                    {revealed.has(i) && (
                      <>
                        <Button
                          variant="ghost"
                          type="button"
                          className={`!px-3 !py-1 text-xs ${awarded[i] === "A" ? "!bg-violet-600 !text-white" : ""}`}
                          onClick={() => award(i, "A")}
                        >
                          +1 {teamAName || "Топ А"}
                        </Button>
                        <Button
                          variant="ghost"
                          type="button"
                          className={`!px-3 !py-1 text-xs ${awarded[i] === "B" ? "!bg-fuchsia-600 !text-white" : ""}`}
                          onClick={() => award(i, "B")}
                        >
                          +1 {teamBName || "Топ Б"}
                        </Button>
                      </>
                    )}
                  </div>
                </div>
              ))}
            </div>
          </Card>
        </>
      )}
    </div>
  );
}
