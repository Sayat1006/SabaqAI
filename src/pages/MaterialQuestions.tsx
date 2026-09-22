import { useState } from "react";
import { Badge, Button, Card, Field, PrintButton, TextInput } from "../components/ui";
import { generateClozeQuestions, type ClozeQuestion } from "../lib/generators";

const sampleText =
  "Фотосинтез — жасыл өсімдіктердің күн энергиясын пайдаланып, органикалық заттар түзу процесі. Бұл процесс жапырақтардағы хлорофилл пигментінің қатысуымен жүреді. Фотосинтез нәтижесінде атмосфераға оттегі бөлінеді. Өсімдіктер фотосинтез үшін көмірқышқыл газын, суды және жарық энергиясын қажет етеді.";

export default function MaterialQuestionsPage() {
  const [text, setText] = useState(sampleText);
  const [count, setCount] = useState(4);
  const [questions, setQuestions] = useState<ClozeQuestion[]>([]);
  const [revealed, setRevealed] = useState<Set<number>>(new Set());
  const [exportingDocx, setExportingDocx] = useState(false);
  const [generating, setGenerating] = useState(false);
  const [generateError, setGenerateError] = useState("");

  async function handleGenerate(e: React.FormEvent) {
    e.preventDefault();
    if (!text.trim()) return;
    setGenerating(true);
    setGenerateError("");
    try {
      const newQuestions = await generateClozeQuestions(text.trim(), count);
      setQuestions(newQuestions);
      setRevealed(new Set());
    } catch (err) {
      setGenerateError(err instanceof Error ? err.message : "Сұрақтар жасау мүмкін болмады.");
    } finally {
      setGenerating(false);
    }
  }

  async function handleExportDocx() {
    if (questions.length === 0) return;
    setExportingDocx(true);
    try {
      const { exportClozeToDocx } = await import("../lib/exportDocx");
      await exportClozeToDocx(questions);
    } finally {
      setExportingDocx(false);
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

  return (
    <div className="mx-auto max-w-4xl px-4 py-10 sm:px-6">
      <Badge>Материал бойынша сұрақтар</Badge>
      <h1 className="mt-3 mb-2 text-3xl font-semibold text-slate-900 dark:text-white">
        Мәтінді тексеру сұрақтарына айналдыру
      </h1>
      <p className="mb-8 text-slate-600 dark:text-slate-300">
        Оқулықтан үзінді немесе кез келген оқу мәтінін қойыңыз — жүйе негізгі ұғымдарды тауып,
        толықтыру (cloze) сұрақтарын автоматты құрастырады.
      </p>

      <Card className="print:hidden">
        <form onSubmit={handleGenerate} className="grid gap-1">
          <Field>
            Мәтін
            <textarea
              value={text}
              onChange={(e) => setText(e.target.value)}
              rows={6}
              className="w-full rounded-lg border border-violet-200 bg-white px-3 py-2 text-slate-900 outline-none transition focus:border-violet-500 focus:ring-2 focus:ring-violet-200 dark:border-violet-800 dark:bg-[#1d1d1f] dark:text-slate-100"
              required
            />
          </Field>
          <div className="grid gap-4 sm:grid-cols-3 sm:items-end">
            <Field className="sm:col-span-1">
              Сұрақ саны
              <TextInput
                type="number"
                min={2}
                max={10}
                value={count}
                onChange={(e) => setCount(Number(e.target.value))}
              />
            </Field>
            <div className="sm:col-span-2 sm:pb-4">
              <Button type="submit" disabled={generating}>
                {generating ? "ЖИ жасап жатыр..." : "Сұрақтар құру"}
              </Button>
            </div>
          </div>
          {generateError && <p className="mt-2 text-sm text-rose-600 dark:text-rose-400">{generateError}</p>}
        </form>
      </Card>

      {questions.length > 0 && (
        <Card className="print-card mt-6 text-left">
          <div className="mb-4 flex flex-wrap items-start justify-between gap-3">
            <h2 className="text-xl font-semibold text-slate-900 dark:text-white">
              Толықтыру сұрақтары ({questions.length})
            </h2>
            <div className="flex flex-wrap gap-2 print:hidden">
              <Button variant="ghost" type="button" onClick={handleExportDocx} disabled={exportingDocx}>
                {exportingDocx ? "Дайындалуда..." : "📄 Word-ке экспорттау"}
              </Button>
              <PrintButton />
            </div>
          </div>
          <div className="space-y-4">
            {questions.map((q, i) => (
              <div key={i} className="rounded-lg border border-violet-100 p-4 dark:border-violet-900/50">
                <p className="mb-2 text-slate-800 dark:text-slate-100">
                  {i + 1}. {q.masked}
                </p>
                {revealed.has(i) && (
                  <p className="mb-2 text-sm font-medium text-emerald-600 dark:text-emerald-400 print:hidden">
                    Жауабы: {q.answer}
                  </p>
                )}
                <Button
                  variant="ghost"
                  className="!px-3 !py-1 text-xs print:hidden"
                  type="button"
                  onClick={() => toggleReveal(i)}
                >
                  {revealed.has(i) ? "Жауапты жасыру" : "Жауапты көрсету"}
                </Button>
              </div>
            ))}
          </div>
          {questions.length < count && (
            <p className="mt-4 text-sm text-amber-600 dark:text-amber-400 print:hidden">
              Мәтін қысқа болғандықтан, тек {questions.length} сұрақ құрастырылды. Көбірек сұрақ
              алу үшін мәтінді ұзартыңыз.
            </p>
          )}

          <div className="mt-6 hidden border-t border-violet-100 pt-4 print:block dark:border-violet-900/50">
            <h3 className="mb-2 font-semibold text-slate-900">Жауаптар кілті</h3>
            <ol className="list-decimal space-y-1 pl-5 text-sm text-slate-800">
              {questions.map((q, i) => (
                <li key={i}>{q.answer}</li>
              ))}
            </ol>
          </div>
        </Card>
      )}
    </div>
  );
}
