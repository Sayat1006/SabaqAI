import { useMemo, useState } from "react";
import { Badge, Card, Field, Select, TextInput } from "../components/ui";
import { curriculum } from "../lib/curriculum";

const subjectOptions = ["Барлығы", ...curriculum.map((s) => s.subject)];

const taxonomyColors: Record<string, string> = {
  Білу: "bg-sky-100 text-sky-700 dark:bg-sky-900/40 dark:text-sky-300",
  Түсіну: "bg-emerald-100 text-emerald-700 dark:bg-emerald-900/40 dark:text-emerald-300",
  Қолдану: "bg-violet-100 text-violet-700 dark:bg-violet-900/40 dark:text-violet-300",
  Талдау: "bg-amber-100 text-amber-700 dark:bg-amber-900/40 dark:text-amber-300",
  Бағалау: "bg-rose-100 text-rose-700 dark:bg-rose-900/40 dark:text-rose-300",
  Жасау: "bg-fuchsia-100 text-fuchsia-700 dark:bg-fuchsia-900/40 dark:text-fuchsia-300",
};

export default function EncyclopediaPage() {
  const [subject, setSubject] = useState("Барлығы");
  const [query, setQuery] = useState("");

  const results = useMemo(() => {
    const q = query.trim().toLowerCase();
    return curriculum
      .filter((s) => subject === "Барлығы" || s.subject === subject)
      .flatMap((s) => s.objectives.map((o) => ({ ...o, subject: s.subject })))
      .filter(
        (o) =>
          !q ||
          o.text.toLowerCase().includes(q) ||
          o.topic.toLowerCase().includes(q) ||
          o.code.toLowerCase().includes(q),
      );
  }, [subject, query]);

  return (
    <div className="mx-auto max-w-4xl px-4 py-10 sm:px-6">
      <Badge>ҮОБ Энциклопедиясы</Badge>
      <h1 className="mt-3 mb-2 text-3xl font-semibold text-slate-900 dark:text-white">
        Оқу мақсаттары мен таксономия базасы
      </h1>
      <p className="mb-8 text-slate-600 dark:text-slate-300">
        Типтік оқу бағдарламасына (ҮОБ) сәйkес пән, сынып, тақырып бойынша оқу мақсаттарын
        іздеңіз — ҚМЖ мен КТЖ құрастырғанда дәйексөз ретінде қолдана аласыз.
      </p>

      <Card>
        <div className="grid gap-4 sm:grid-cols-2">
          <Field>
            Пән
            <Select value={subject} onChange={(e) => setSubject(e.target.value)}>
              {subjectOptions.map((s) => (
                <option key={s}>{s}</option>
              ))}
            </Select>
          </Field>
          <Field>
            Іздеу (тақырып, мақсат немесе код бойынша)
            <TextInput placeholder="мысалы: фотосинтез" value={query} onChange={(e) => setQuery(e.target.value)} />
          </Field>
        </div>
      </Card>

      <div className="mt-6 space-y-3">
        {results.length === 0 && (
          <Card className="text-center text-slate-500 dark:text-slate-400">Ешнәрсе табылмады.</Card>
        )}
        {results.map((o) => (
          <Card key={o.code} className="text-left">
            <div className="mb-1 flex flex-wrap items-center justify-between gap-2">
              <div className="flex items-center gap-2">
                <span className="font-mono text-xs text-slate-400">{o.code}</span>
                <span className="text-sm font-medium text-slate-500 dark:text-slate-400">
                  {o.subject} · {o.grade} · {o.topic}
                </span>
              </div>
              <span className={`rounded-full px-2.5 py-0.5 text-xs font-medium ${taxonomyColors[o.taxonomy]}`}>
                {o.taxonomy}
              </span>
            </div>
            <p className="text-slate-800 dark:text-slate-100">{o.text}</p>
          </Card>
        ))}
      </div>
    </div>
  );
}
