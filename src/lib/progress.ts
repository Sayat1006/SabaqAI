// Оқушы прогресі: мұғалімнің барлық тесттеріне түскен нәтижелерді оқушы бойынша
// біріктіреді. Оқушылар тіркелмейді, сондықтан оқушыны аты-жөні мен сыныбы бойынша
// ажыратамыз (бос орындар, әріп регистрі, латын/кирилл «А» айырмашылығы ескерілмейді).

import { tr } from "../i18n";
import { aiGenerateJson } from "./ai";
import type { Lang } from "./lang";
import type { TestLevel, TestQuestion } from "./projects";
import { supabase } from "./supabaseClient";

export interface ProgressTest {
  id: string;
  topic: string;
  subject: string;
  grade: string;
  createdAt: number;
  questions: TestQuestion[];
}

export interface Attempt {
  id: string;
  testId: string;
  score: number;
  total: number;
  pct: number;
  answers: (number | null)[];
  createdAt: number;
}

export interface StudentProgress {
  key: string;
  name: string;
  cls: string;
  /** Әр тест бойынша соңғы тапсыруы (уақыт ретімен). */
  attempts: Attempt[];
  avg: number;
  /** Соңғы нәтиже мен алғашқы нәтиженің айырмасы (пайыз тармағы). */
  trend: number;
  levels: Record<TestLevel, { ok: number; total: number }>;
}

export interface ProgressData {
  tests: ProgressTest[];
  students: StudentProgress[];
  classes: string[];
}

const LOOKALIKE: Record<string, string> = { A: "А", B: "В", C: "С", E: "Е", H: "Н", K: "К", M: "М", O: "О", P: "Р", T: "Т", X: "Х" };
/** «7 а», «7-A», «7А» → «7А». */
export const normClass = (c: string) =>
  c
    .toUpperCase()
    .replace(/[\s\-–—."']/g, "")
    .replace(/[ABCEHKMOPTX]/g, (ch) => LOOKALIKE[ch] ?? ch)
    .replace(/СЫНЫП|КЛАСС/g, "");
const normName = (n: string) => n.toLowerCase().replace(/ё/g, "е").replace(/\s+/g, " ").trim();

export const pctOf = (score: number, total: number) => (total ? Math.round((score / total) * 100) : 0);

function setupError(message: string) {
  if (/does not exist|Could not find the table|42P01/i.test(message)) {
    return new Error(tr("Нәтижелер кестесі табылмады. Әкімші Supabase-те supabase/update-3-editing-sharing.sql файлын орындауы керек."));
  }
  return new Error(message);
}

export async function loadProgress(): Promise<ProgressData> {
  const [projRes, subRes] = await Promise.all([
    supabase.from("projects").select("id, data, created_at").eq("kind", "test").order("created_at", { ascending: true }).limit(500),
    supabase.from("test_submissions").select("id, project_id, student_name, student_class, answers, score, total, created_at").order("created_at", { ascending: true }).limit(10000),
  ]);
  if (projRes.error) throw setupError(projRes.error.message);
  if (subRes.error) throw setupError(subRes.error.message);

  const allTests = new Map<string, ProgressTest>();
  for (const p of projRes.data ?? []) {
    const d = (p.data ?? {}) as { topic?: string; subject?: string; grade?: string; questions?: TestQuestion[] };
    if (!d.questions?.length) continue; // жазбаша тапсырмалар автоматты бағаланбайды
    allTests.set(p.id as string, {
      id: p.id as string,
      topic: d.topic ?? "",
      subject: d.subject ?? "",
      grade: d.grade ?? "",
      createdAt: new Date(p.created_at as string).getTime(),
      questions: d.questions,
    });
  }

  const byStudent = new Map<string, { name: string; cls: string; last: Map<string, Attempt> }>();
  for (const s of subRes.data ?? []) {
    const testId = s.project_id as string;
    if (!allTests.has(testId)) continue;
    const cls = normClass((s.student_class as string) ?? "");
    const key = `${normName(s.student_name as string)}|${cls}`;
    const entry = byStudent.get(key) ?? { name: (s.student_name as string).trim(), cls, last: new Map() };
    const attempt: Attempt = {
      id: s.id as string,
      testId,
      score: s.score as number,
      total: s.total as number,
      pct: pctOf(s.score as number, s.total as number),
      answers: (s.answers as (number | null)[]) ?? [],
      createdAt: new Date(s.created_at as string).getTime(),
    };
    entry.last.set(testId, attempt); // уақыт ретімен келеді — соңғысы қалады
    byStudent.set(key, entry);
  }

  const usedTests = new Set<string>();
  const students: StudentProgress[] = [...byStudent.entries()].map(([key, e]) => {
    const attempts = [...e.last.values()].sort((a, b) => a.createdAt - b.createdAt);
    attempts.forEach((a) => usedTests.add(a.testId));
    const levels: StudentProgress["levels"] = { A: { ok: 0, total: 0 }, B: { ok: 0, total: 0 }, C: { ok: 0, total: 0 } };
    for (const a of attempts) {
      allTests.get(a.testId)!.questions.forEach((q, i) => {
        const l = q.level ?? "A";
        levels[l].total++;
        if (a.answers[i] === q.correctIndex) levels[l].ok++;
      });
    }
    const avg = attempts.length ? Math.round(attempts.reduce((s, a) => s + a.pct, 0) / attempts.length) : 0;
    const trend = attempts.length > 1 ? attempts[attempts.length - 1].pct - attempts[0].pct : 0;
    return { key, name: e.name, cls: e.cls, attempts, avg, trend, levels };
  });
  students.sort((a, b) => a.cls.localeCompare(b.cls) || a.name.localeCompare(b.name));

  const tests = [...allTests.values()].filter((t) => usedTests.has(t.id));
  const classes = [...new Set(students.map((s) => s.cls).filter(Boolean))].sort((a, b) => a.localeCompare(b, undefined, { numeric: true }));
  return { tests, students, classes };
}

export const band = (p: number) => (p >= 85 ? "high" : p >= 50 ? "mid" : "low");

export interface StudentSummary {
  summary: string;
  strengths: string[];
  weaknesses: string[];
  recommendations: string[];
}

const summarySchema = {
  type: "OBJECT",
  properties: {
    summary: { type: "STRING" },
    strengths: { type: "ARRAY", items: { type: "STRING" } },
    weaknesses: { type: "ARRAY", items: { type: "STRING" } },
    recommendations: { type: "ARRAY", items: { type: "STRING" } },
  },
  required: ["summary", "strengths", "weaknesses", "recommendations"],
};

/** Оқушының барлық тест нәтижелері бойынша тоқсандық қорытынды (мұғалімге, ата-анаға айтуға). */
export async function summarizeStudent(s: StudentProgress, tests: ProgressTest[], lang: Lang): Promise<StudentSummary> {
  const byId = new Map(tests.map((t) => [t.id, t]));
  const lines = s.attempts.map((a) => {
    const t = byId.get(a.testId)!;
    const wrong = t.questions
      .map((q, i) => ({ q, i }))
      .filter(({ q, i }) => a.answers[i] !== q.correctIndex)
      .slice(0, 6)
      .map(({ q }) => `«${q.question.slice(0, 90)}» (${q.level ?? "A"})`);
    return `- ${new Date(a.createdAt).toLocaleDateString("ru-RU")} · ${t.subject} · «${t.topic}»: ${a.pct}% (${a.score}/${a.total})${wrong.length ? `; қате сұрақтары: ${wrong.join("; ")}` : ""}`;
  });
  const lv = (["A", "B", "C"] as const).map((l) => `${l}: ${s.levels[l].total ? pctOf(s.levels[l].ok, s.levels[l].total) : "—"}%`).join(", ");
  const prompt = `Сен тәжірибелі мұғалімсің. Оқушының тоқсан бойғы тест нәтижелерін талдап, қысқа қорытынды жаз.
Оқушы: ${s.name}${s.cls ? `, ${s.cls} сынып` : ""}. Орташа нәтиже: ${s.avg}%. Динамика: ${s.trend > 0 ? "+" : ""}${s.trend} пайыз тармағы.
Ойлау деңгейлері бойынша дұрыс жауаптар: ${lv} (A — білу/түсіну, B — қолдану, C — жоғары деңгей).
Нәтижелер (уақыт ретімен):
${lines.join("\n")}

"summary" — 3–4 сөйлемдік жалпы қорытынды (оқу мақсаттарына жетуі, динамикасы); "strengths" — 2–3 күшті жағы; "weaknesses" — 2–3 қиындық тудырған тақырып/дағды (нақты тақырыптарды ата); "recommendations" — оқушыға және ата-анаға 3 нақты ұсыныс.
Тек берілген деректерге сүйен, жылы әрі әдепті жаз. ${lang === "ru" ? "Бүкіл мәтін ОРЫС тілінде." : "Бүкіл мәтін қазақ тілінде."}`;
  const r = await aiGenerateJson<StudentSummary>(prompt, summarySchema);
  return {
    summary: r.summary ?? "",
    strengths: (r.strengths ?? []).slice(0, 4),
    weaknesses: (r.weaknesses ?? []).slice(0, 4),
    recommendations: (r.recommendations ?? []).slice(0, 4),
  };
}
