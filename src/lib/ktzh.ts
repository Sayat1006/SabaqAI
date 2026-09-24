// КТЖ — күнтізбелік-тақырыптық жоспар: тоқсан (не жыл) бойынша бөлімдер, сабақ
// тақырыптары, оқу мақсаттары, БЖБ/ТЖБ және күндері. Күндерді AI емес, сайт есептейді.

import { tr } from "../i18n";
import { aiGenerateJson } from "./ai";
import { curriculum } from "./curriculum";
import { subjectIn, type Lang } from "./lang";

export type KtzhKind = "lesson" | "sor" | "soch";

export interface KtzhRow {
  section: string;
  topic: string;
  objectives: string;
  hours: number;
  kind: KtzhKind;
  date: string;
  note: string;
}

export interface KtzhData {
  subject: string;
  grade: string;
  period: string;
  hoursPerWeek: number;
  weeks: number;
  days: number[];
  startDate: string;
  teacher: string;
  lang: Lang;
  rows: KtzhRow[];
}

export const KTZH_PERIODS = ["1-тоқсан", "2-тоқсан", "3-тоқсан", "4-тоқсан", "Жылдық"];
/** Шамамен оқу апталары (мұғалім өзгерте алады). */
export const DEFAULT_WEEKS: Record<string, number> = { "1-тоқсан": 8, "2-тоқсан": 8, "3-тоқсан": 10, "4-тоқсан": 8, Жылдық: 34 };
/** Дүйсенбі=1 … Жұма=5, Сенбі=6. */
export const WEEKDAYS: { id: number; label: string }[] = [
  { id: 1, label: "Дс" },
  { id: 2, label: "Сс" },
  { id: 3, label: "Ср" },
  { id: 4, label: "Бс" },
  { id: 5, label: "Жм" },
  { id: 6, label: "Сн" },
];

const pad = (n: number) => String(n).padStart(2, "0");
const fmt = (d: Date) => `${pad(d.getDate())}.${pad(d.getMonth() + 1)}.${d.getFullYear()}`;

/** «кк.аа.жжжж» → Date (қате болса null). */
export function parseDate(s: string): Date | null {
  const m = s.trim().match(/^(\d{1,2})[./-](\d{1,2})[./-](\d{4})$/);
  if (!m) return null;
  const d = new Date(Number(m[3]), Number(m[2]) - 1, Number(m[1]));
  return Number.isNaN(d.getTime()) ? null : d;
}

/** Сабақ күндерін бастау күнінен бастап таңдалған апта күндері бойынша қояды. */
export function assignDates(rows: KtzhRow[], startDate: string, days: number[]): KtzhRow[] {
  const start = parseDate(startDate);
  if (!start || !days.length) return rows;
  const d = new Date(start);
  let guard = 0;
  return rows.map((r) => {
    while (!days.includes(d.getDay()) && guard++ < 1000) d.setDate(d.getDate() + 1);
    const date = fmt(d);
    d.setDate(d.getDate() + 1);
    return { ...r, date };
  });
}

/** Тоқсанның шамамен басталу күні (оқу жылы 1 қыркүйектен). */
export function defaultStart(period: string): string {
  const now = new Date();
  const year = now.getMonth() >= 7 ? now.getFullYear() : now.getFullYear() - 1;
  const starts: Record<string, [number, number, number]> = {
    "1-тоқсан": [year, 8, 1],
    "2-тоқсан": [year, 10, 3],
    "3-тоқсан": [year + 1, 0, 8],
    "4-тоқсан": [year + 1, 3, 1],
    Жылдық: [year, 8, 1],
  };
  const [y, m, d] = starts[period] ?? starts["1-тоқсан"];
  return fmt(new Date(y, m, d));
}

const schema = {
  type: "OBJECT",
  properties: {
    rows: {
      type: "ARRAY",
      items: {
        type: "OBJECT",
        properties: {
          section: { type: "STRING" },
          topic: { type: "STRING" },
          objectives: { type: "STRING" },
          kind: { type: "STRING", enum: ["lesson", "sor", "soch"] },
        },
        required: ["section", "topic", "objectives", "kind"],
      },
    },
  },
  required: ["rows"],
};

export interface KtzhInput {
  subject: string;
  grade: string;
  period: string;
  hoursPerWeek: number;
  weeks: number;
  days: number[];
  startDate: string;
  teacher: string;
  lang: Lang;
  notes: string;
}

export async function generateKtzh(input: KtzhInput): Promise<KtzhData> {
  const total = Math.min(Math.max(input.hoursPerWeek * input.weeks, 4), 140);
  const ru = input.lang === "ru";
  const known = curriculum
    .find((c) => c.subject === input.subject)
    ?.objectives.filter((o) => o.grade === input.grade)
    .map((o) => `${o.code} — ${o.text}`);
  const year = input.period === "Жылдық";
  const prompt = `Сен Қазақстан мектебінің тәжірибелі мұғалімі әрі әдіскерсің. Жаңартылған білім беру мазмұны бойынша типтік оқу бағдарламасына (ТОБ/ҮОБ) сай күнтізбелік-тақырыптық жоспар (КТЖ) құрастыр.
Пән: ${input.subject}${input.lang !== "kk" ? ` (${subjectIn(input.subject, input.lang)})` : ""}; сынып: ${input.grade}; кезең: ${input.period}; аптасына ${input.hoursPerWeek} сағат; барлығы ДӘЛ ${total} сабақ (жол).
${known?.length ? `Анықтамалық оқу мақсаттары (бар болса қолдан):\n${known.join("\n")}\n` : ""}${input.notes.trim() ? `Мұғалімнің нұсқауы (бөлімдер, тақырыптар т.б. — міндетті түрде ескер):\n${input.notes.trim()}\n` : ""}
ТАЛАПТАР:
- "rows" — ДӘЛ ${total} жол, әр жол = 1 сағаттық бір сабақ, оқу бағдарламасындағы ретімен.
- "section" — бөлім атауы (ТОБ-тағы ${year ? "бөлімдер жыл бойы" : "осы тоқсанның бөлімдері"}); бір бөлімнің сабақтары қатар тұрсын.
- "topic" — нақты сабақ тақырыбы (қайталанбасын; ұзақ тақырып болса «1-сабақ», «2-сабақ» деп бөл).
- "objectives" — оқу мақсаттарының кодтары мен қысқаша мазмұны, мыс. "5.1.2.3 — натурал сандарды салыстыру" (бірнеше болса «; » арқылы). Кодтарды ТОБ құрылымына сай жаз (сынып.бөлім.тарау.мақсат).
- Әр бөлімнің соңында бір "sor" жолы — бөлім бойынша жиынтық бағалау (БЖБ), тақырыбы: «Бөлім бойынша жиынтық бағалау»${ru ? " / «Суммативное оценивание за раздел»" : ""}.
- ${year ? "Әр тоқсанның соңында" : "Кезеңнің соңында"} бір "soch" жолы — тоқсандық жиынтық бағалау (ТЖБ), одан кейін бір "lesson" жолы — қорытынды қайталау/қатемен жұмыс.${input.hoursPerWeek <= 1 ? " Аптасына 1 сағат болса, ТЖБ болмауы мүмкін — тек БЖБ қой." : ""}
- Қалғаны "lesson".
${ru ? "ТІЛ: бүкіл мазмұн ОРЫС тілінде (бөлімдер, тақырыптар, мақсаттар)." : input.lang === "en" ? "ТІЛ: бүкіл мазмұн АҒЫЛШЫН тілінде (бөлімдер, тақырыптар, мақсаттар). БЖБ тақырыбы: «Summative assessment for the unit», ТЖБ: «Summative assessment for the term»." : "Барлығы қазақ тілінде (шет тілі пәнінде тақырыптар сол тілде болуы мүмкін)."}`;
  const raw = await aiGenerateJson<{ rows?: Partial<KtzhRow>[] }>(prompt, schema);
  const rows: KtzhRow[] = (raw.rows ?? [])
    .filter((r) => r.topic?.trim())
    .slice(0, 160)
    .map((r) => ({
      section: r.section?.trim() ?? "",
      topic: r.topic!.trim(),
      objectives: r.objectives?.trim() ?? "",
      hours: 1,
      kind: r.kind === "sor" || r.kind === "soch" ? r.kind : "lesson",
      date: "",
      note: "",
    }));
  if (!rows.length) throw new Error(tr("AI жоспар қайтармады. Қайталап көріңіз."));
  return {
    subject: input.subject,
    grade: input.grade,
    period: input.period,
    hoursPerWeek: input.hoursPerWeek,
    weeks: input.weeks,
    days: input.days,
    startDate: input.startDate,
    teacher: input.teacher,
    lang: input.lang,
    rows: assignDates(rows, input.startDate, input.days),
  };
}

/** Жол түрінің белгісі (материал тілінде). */
export const kindLabel = (k: KtzhKind, lang: Lang | undefined) =>
  k === "sor" ? (lang === "ru" ? "СОР" : lang === "en" ? "SAU" : "БЖБ") : k === "soch" ? (lang === "ru" ? "СОЧ" : lang === "en" ? "SAT" : "ТЖБ") : "";

export const ktzhTotalHours = (d: KtzhData) => d.rows.reduce((s, r) => s + (r.hours || 0), 0);
