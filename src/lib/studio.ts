// AI студия: тақырып бойынша презентация, сабақ иллюстрациялары және тест.
// Барлығы `ai-generate` Edge Function арқылы Gemini-ге жүгінеді.

import { tr } from "../i18n";
import { aiGenerateJson } from "./ai";
import { curriculum } from "./curriculum";
import type { LessonPlan } from "./generators";
import type { SavedTest, TaskType, TestLevel, TestQuestion, WrittenTask } from "./projects";
import type { Lang } from "./lang";
import { normalizeSlide, type SlideData } from "./slides";

/** Материал тілі туралы нұсқау (AI-ға берілетін сұраныс қазақша, мазмұны — таңдалған тілде). */
const inLang = (lang?: Lang) => (lang === "ru" ? "ОРЫС тілінде" : lang === "en" ? "АҒЫЛШЫН тілінде" : "қазақ тілінде");

export const PRESENTATION_STYLES = [
  { key: "minimal", label: tr("Минимал") },
  { key: "colorful", label: tr("Түрлі-түсті") },
  { key: "science", label: tr("Ғылыми") },
  { key: "kids", label: tr("Балаларға арналған") },
] as const;

export const SLIDE_COUNTS = [5, 8, 10, 12] as const;

/** Слайд түстері; PPTX экспорты да осы палитраны қолданады. */
export const SLIDE_THEMES: Record<string, { bg: string; ink: string; accent: string; accent2: string; dark: string }> = {
  minimal: { bg: "#FBF7F0", ink: "#1C1B2E", accent: "#E0733D", accent2: "#2F7D74", dark: "#1B2438" },
  colorful: { bg: "#FFF8EE", ink: "#1C1B2E", accent: "#E0733D", accent2: "#6C4AB6", dark: "#E0733D" },
  science: { bg: "#F4F7FA", ink: "#15202B", accent: "#2F7D74", accent2: "#1B2438", dark: "#1B2438" },
  kids: { bg: "#FFFBEA", ink: "#2A2440", accent: "#F2A33A", accent2: "#2F9D8F", dark: "#2F9D8F" },
};

export const IMAGE_STYLES = [
  {
    key: "watercolor",
    label: tr("Акварель"),
    hint: "soft watercolor look: translucent layered fills with low opacity, organic blob shapes, gentle color bleeding, no hard outlines",
  },
  { key: "flat", label: tr("Жалпақ дизайн"), hint: "flat design: solid fills, no gradients, simple geometric shapes, bold limited palette" },
  {
    key: "realistic",
    label: tr("Реалистік"),
    hint: "semi-realistic: linear/radial gradients for volume, soft shadows, detailed proportions",
  },
  { key: "line", label: tr("Сызықтық"), hint: "line art: consistent stroke outlines only, no or very light fills, minimalist" },
  {
    key: "iso",
    label: tr("Изометрия"),
    hint: "isometric 3D: 30-degree isometric projection, three shaded faces per object, clean geometric forms",
  },
] as const;

/* ---------------------------------------------------------------- Презентация */

const stringArray = { type: "ARRAY", items: { type: "STRING" } };

const presentationSchema = {
  type: "OBJECT",
  properties: {
    title: { type: "STRING" },
    slides: {
      type: "ARRAY",
      items: {
        type: "OBJECT",
        properties: {
          layout: {
            type: "STRING",
            enum: ["title", "bullets", "image", "diagram", "chart", "table", "two_column", "highlight", "timeline", "quiz", "task", "closing"],
          },
          heading: { type: "STRING" },
          subheading: { type: "STRING" },
          bullets: stringArray,
          notes: { type: "STRING" },
          image_prompt: { type: "STRING" },
          diagram_type: { type: "STRING", enum: ["process", "cycle", "hierarchy"] },
          diagram_nodes: stringArray,
          chart_type: { type: "STRING", enum: ["bar", "pie"] },
          chart_labels: stringArray,
          chart_values: { type: "ARRAY", items: { type: "NUMBER" } },
          chart_unit: { type: "STRING" },
          table_headers: stringArray,
          table_rows: { type: "ARRAY", items: { type: "OBJECT", properties: { cells: stringArray }, required: ["cells"] } },
          left_title: { type: "STRING" },
          left: stringArray,
          right_title: { type: "STRING" },
          right: stringArray,
          highlight: { type: "STRING" },
          timeline: {
            type: "ARRAY",
            items: { type: "OBJECT", properties: { label: { type: "STRING" }, text: { type: "STRING" } }, required: ["label", "text"] },
          },
          question: { type: "STRING" },
          options: stringArray,
          correct_index: { type: "INTEGER" },
          explanation: { type: "STRING" },
          task_text: { type: "STRING" },
          answer: { type: "STRING" },
        },
        required: ["layout", "heading"],
      },
    },
  },
  required: ["title", "slides"],
};

const DECK_RULES = (count: number, styleLabel: string, lang?: Lang) => `Стиль: ${styleLabel}. Дәл ${count} слайд құрастыр.
Мәтін ${inLang(lang)} (шет тілі пәні болмаса), қысқа, оқушыға түсінікті; бір слайдта бір идея; тармақ 12 сөзден аспасын.
Презентация көрнекі әрі әртүрлі болсын — макеттерді араластыр:
- "title" — бірінші слайд: heading, subheading, image_prompt.
- "image" — тақырыптың негізгі нысанын көрсететін иллюстрация + 2–4 тармақ (bullets). image_prompt міндетті.
- "diagram" — процесс/айналым/құрылым сызбасы: diagram_type ("process" — қадамдар тізбегі, "cycle" — айналым, "hierarchy" — бірінші түйін негізгі ұғым, қалғаны оның бөліктері) және diagram_nodes (3–6 қысқа түйін, әрқайсысы 1–4 сөз).
- "table" — салыстыру не жіктеу кестесі: table_headers (2–4) және table_rows (3–5 жол, әрқайсысында cells).
- "chart" — ТЕК тақырыпқа қатысты нақты, ғылыми белгілі сандар болса (мыс. ауаның құрамы: 78, 21, 1): chart_type ("bar"/"pie"), chart_labels, chart_values, chart_unit. Сан ойдан шығаруға ТЫЙЫМ САЛЫНАДЫ; сенімді дерек жоқ болса, chart қолданба.
- "timeline" — тарихи оқиғалар не кезеңдер: timeline (3–5 элемент: label — жыл/кезең, text — қысқа сипаттама).
- "highlight" — басты анықтама, ереже не формула (highlight өрісінде).
- "two_column" — салыстыру: left_title/left және right_title/right.
- "bullets" — қарапайым тармақтар (тек қажет болса).
- "quiz" — бір тексеру сұрағы: question, 4 options, correct_index (0-ден), explanation.
- "task" — практикалық тапсырма: task_text (шарты), bullets (орындау қадамдары, 2–4), answer (жауабы не үлгі шешім).
- "closing" — соңғы слайд: қорытынды не рефлексия сұрағы (subheading).
Талаптар: бірінші слайд — title, соңғысы — closing. Кемінде бір "image", бір "diagram", бір "table", бір "quiz" және бір "task" болсын (слайд саны жетсе). Тақырып тарихи болса — timeline қос.
image_prompt ағылшынша жазылады: суретшіге арналған нақты сипаттама (не бейнеленеді, қандай бөліктер көрінеді), мәтінсіз.
Әр слайдқа мұғалімге арналған қысқа "notes" жаз. Фактілер дұрыс болсын, ойдан шығарылған статистика қолданба.`;

export async function generatePresentation(topic: string, style: string, count: number, planContext?: string, lang?: Lang) {
  const styleLabel = PRESENTATION_STYLES.find((s) => s.key === style)?.label ?? "Минимал";
  const prompt = `Сен мұғалімдерге сабақ презентациясын құрастыратын тәжірибелі әдіскер-дизайнерсің.
Тақырып: ${topic}
${planContext ? `Презентация мына қысқа мерзімді жоспарға (ҚМЖ) сай болсын — оның мақсаттарын, кезеңдерін, тапсырмаларын және құндылығын көрсет:\n"""\n${planContext}\n"""\n` : ""}${DECK_RULES(count, styleLabel, lang)}`;
  const result = await aiGenerateJson<{ title: string; slides: Partial<SlideData>[] }>(prompt, presentationSchema);
  const slides = (result.slides ?? []).map((s) => normalizeSlide(s as Partial<SlideData> & Record<string, unknown>));
  if (slides.length === 0) throw new Error(tr("AI слайд қайтармады. Қайталап көріңіз."));
  return { title: result.title || topic, slides };
}

/** ҚМЖ мазмұнын AI-ға берілетін қысқа мәтінге айналдырады. */
export function planToContext(plan: LessonPlan): string {
  const stageLines = plan.stages.map((st) => `${st.name} (${st.timeRange}): ${st.rows.flatMap((r) => r.teacherAction).slice(0, 3).join("; ")}`);
  const taskLines = plan.tasks.map((t) => `${t.title}: ${t.condition.join(" ")}`);
  return [
    `Пән: ${plan.subject}; сынып: ${plan.grade}`,
    `Оқу мақсаты: ${plan.objectiveCode} — ${plan.objectiveText}`,
    `Сабақ мақсаттары: ${plan.goals.join("; ")}`,
    `Құндылық: ${plan.valuesTitle} — ${plan.valuesText}`,
    `Кезеңдер: ${stageLines.join(" | ")}`,
    `Тапсырмалар: ${taskLines.join(" | ")}`,
  ].join("\n").slice(0, 4000);
}

/** Презентация стиліне сай иллюстрация стилі. */
const DECK_IMAGE_STYLE: Record<string, string> = { minimal: "iso", colorful: "flat", science: "realistic", kids: "flat" };

/**
 * title/image слайдтарына иллюстрация салады (ең көбі 4, бір уақытта 2 сұраныс — тегін Gemini
 * лимитіне сыю үшін). Әр дайын сурет onSlide арқылы бірден көрсетіледі; қате болса, слайд суретсіз қалады.
 */
/** Бір слайдқа иллюстрацияны қайта салады (өңдеу режимі). */
export async function illustrateSlide(prompt: string, deckStyle: string): Promise<string> {
  const { svg } = await generateIllustration(`${prompt}. Leave generous empty margins; no text labels.`, DECK_IMAGE_STYLE[deckStyle] ?? "iso");
  return svg;
}

export async function illustrateSlides(
  slides: SlideData[],
  deckStyle: string,
  onSlide: (index: number, svg: string) => void,
  max = 4,
): Promise<void> {
  const style = DECK_IMAGE_STYLE[deckStyle] ?? "iso";
  const queue = slides
    .map((s, i) => ({ s, i }))
    .filter(({ s }) => (s.layout === "title" || s.layout === "image") && s.image_prompt && !s.image_svg)
    .slice(0, max);
  const worker = async () => {
    for (let job = queue.shift(); job; job = queue.shift()) {
      try {
        const { svg } = await generateIllustration(`${job.s.image_prompt}. Leave generous empty margins; no text labels.`, style);
        onSlide(job.i, svg);
      } catch {
        // сурет шықпаса, слайд безендірілген фонымен қалады
      }
    }
  };
  // Бірінен соң бірі: тегін тарифтің минуттық лимитіне (бір модельге 5) сыю үшін.
  await worker();
}

/* ------------------------------------------------------------------- Сурет */

const imageSchema = {
  type: "OBJECT",
  properties: {
    title: { type: "STRING" },
    svg: { type: "STRING" },
  },
  required: ["title", "svg"],
};

export async function generateIllustration(description: string, style: string) {
  const styleDef = IMAGE_STYLES.find((s) => s.key === style) ?? IMAGE_STYLES[0];
  const prompt = `You are an illustrator who draws educational illustrations for school lessons as standalone SVG.
Draw: ${description}
Visual style: ${styleDef.hint}.
Rules for the "svg" field:
- A single <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 800 600"> root, no width/height attributes.
- Only static shapes: path, rect, circle, ellipse, line, polyline, polygon, g, text, tspan, defs, linearGradient, radialGradient, stop, clipPath, pattern, use (internal #ids only).
- No <script>, <foreignObject>, <image>, <style>, animation, event handlers or external references.
- A full-bleed background rect; the subject centered and clearly readable for children; accurate for teaching.
- Labels only when they help learning, in Kazakh, font-family="Times New Roman, serif".
- Keep it under ~12 KB.
"title" is a short Kazakh name for the picture (2–4 words).`;
  const result = await aiGenerateJson<{ title: string; svg: string }>(prompt, imageSchema);
  const svg = sanitizeSvg(result.svg);
  if (!svg) throw new Error(tr("Сурет дұрыс генерацияланбады. Қайталап көріңіз."));
  return { title: result.title || description.slice(0, 40), svg, styleLabel: styleDef.label };
}

const ALLOWED_TAGS = new Set([
  "svg", "g", "path", "rect", "circle", "ellipse", "line", "polyline", "polygon", "text", "tspan", "defs",
  "lineargradient", "radialgradient", "stop", "clippath", "pattern", "use", "title", "desc", "mask", "symbol",
]);

/**
 * AI жасаған SVG-ден тек статикалық сызба элементтерін қалдырады. Суреттер тек <img> арқылы
 * көрсетіледі (онда скрипт ешқашан іске қосылмайды), бұл — қосымша қорғаныс қабаты.
 */
export function sanitizeSvg(input: string): string | null {
  const start = input.indexOf("<svg");
  const end = input.lastIndexOf("</svg>");
  if (start < 0 || end < 0) return null;
  const doc = new DOMParser().parseFromString(input.slice(start, end + 6), "image/svg+xml");
  const root = doc.documentElement;
  if (root.nodeName !== "svg" || doc.getElementsByTagName("parsererror").length) return null;

  const walk = (el: Element) => {
    for (const child of Array.from(el.children)) {
      if (!ALLOWED_TAGS.has(child.localName.toLowerCase())) {
        child.remove();
        continue;
      }
      walk(child);
    }
    for (const attr of Array.from(el.attributes)) {
      const name = attr.name.toLowerCase();
      const value = attr.value;
      const unsafe =
        name.startsWith("on") ||
        /javascript:|data:/i.test(value) ||
        /url\(\s*['"]?(?!#)/i.test(value) ||
        ((name === "href" || name === "xlink:href") && !value.startsWith("#")) ||
        (name === "style" && /expression|@import|url\(/i.test(value));
      if (unsafe) el.removeAttribute(attr.name);
    }
  };
  walk(root);
  if (!root.getAttribute("xmlns")) root.setAttribute("xmlns", "http://www.w3.org/2000/svg");
  return new XMLSerializer().serializeToString(root);
}

/* ------------------------------------------------------------------- Тест */

export const DIFFICULTIES = ["Жеңіл", "Орташа", "Қиын"] as const;
export const QUESTION_COUNTS = [5, 10, 15, 20] as const;

/** Қазақстандағы критериалды бағалаудағы ойлау дағдыларының деңгейлері. */
export const TEST_LEVELS: { key: TestLevel; label: string; short: string }[] = [
  { key: "A", label: tr("Білу және түсіну"), short: tr("A · Білу/түсіну") },
  { key: "B", label: tr("Қолдану"), short: tr("B · Қолдану") },
  { key: "C", label: tr("Жоғары деңгей дағдылары"), short: tr("C · Талдау/бағалау") },
];
export const levelBadge = (l?: string) =>
  l === "C" ? "bg-navy-800 text-white" : l === "B" ? "bg-violet-100 text-violet-700" : "bg-fuchsia-100 text-fuchsia-800";
export const levelLabel = (l?: TestLevel) => TEST_LEVELS.find((x) => x.key === l)?.label ?? "";

/** ҮОБ демо-базасынан осы пән мен сыныпқа сай оқу мақсаттары (ұсыныс ретінде). */
export function objectiveSuggestions(subject: string, grade: string): string[] {
  const entry = curriculum.find((c) => c.subject === subject);
  return (entry?.objectives ?? []).filter((o) => o.grade === grade).map((o) => `${o.code} — ${o.text}`);
}

const testSchema = {
  type: "OBJECT",
  properties: {
    questions: {
      type: "ARRAY",
      items: {
        type: "OBJECT",
        properties: {
          question: { type: "STRING" },
          options: { type: "ARRAY", items: { type: "STRING" } },
          correctIndex: { type: "INTEGER" },
          explanation: { type: "STRING" },
          level: { type: "STRING", enum: ["A", "B", "C"] },
        },
        required: ["question", "options", "correctIndex", "explanation", "level"],
      },
    },
  },
  required: ["questions"],
};

/** «Тапсырмалар» бөліміндегі тапсырма түрлері. */
export const TASK_TYPES: { key: TaskType; label: string; description: string; counts: readonly number[]; unit: string }[] = [
  { key: "levels", label: tr("Деңгейлік тест"), description: tr("A / B / C деңгейлері, 4 нұсқа, автоматты тексеріледі"), counts: [5, 10, 15, 20], unit: "сұрақ" },
  { key: "pisa", label: tr("Функционалдық сауаттылық (PISA)"), description: tr("Өмірлік жағдаят, мәтін мен деректер негізіндегі сұрақтар"), counts: [5, 8, 10, 12], unit: "сұрақ" },
  { key: "ubt", label: tr("ҰБТ форматы"), description: tr("5 нұсқалы, ҰБТ спецификациясына жақын сұрақтар"), counts: [10, 15, 20, 25], unit: "сұрақ" },
  { key: "bzb", label: tr("БЖБ / ТЖБ"), description: tr("Жиынтық бағалау: критерий, дескриптор, балл қоюы"), counts: [3, 4, 5, 6], unit: "тапсырма" },
  { key: "open", label: tr("Ашық және шығармашылық"), description: tr("Жазбаша жауап, эссе, жоба, зерттеу тапсырмалары"), counts: [3, 4, 5, 6], unit: "тапсырма" },
];
export const taskTypeOf = (key?: TaskType) => TASK_TYPES.find((t) => t.key === (key ?? "levels")) ?? TASK_TYPES[0];
/** Оқушыға сілтемемен жіберуге және автоматты тексеруге болатын түрлер. */
export const isQuizType = (key?: TaskType) => key !== "bzb" && key !== "open";

interface TaskInput {
  subject: string;
  grade: string;
  topic: string;
  difficulty: string;
  count: number;
  notes: string;
  /** ҚМЖ-дан жасалса: сабақ жоспарының қысқаша мазмұны. */
  planContext?: string;
  /** Оқу мақсаты (ҮОБ коды және мазмұны). */
  objective?: string;
  /** true — A/B/C деңгейлеріне саралап бөлінеді. */
  differentiate?: boolean;
  taskType?: TaskType;
  lang?: Lang;
}

function taskIntro(input: TaskInput): string {
  return `Сен Қазақстан мектептеріне арналған тәжірибелі мұғалім-әдіскерсің.
Пән: ${input.subject}
Сынып: ${input.grade}
Тақырып: ${input.topic}
Қиындық деңгейі: ${input.difficulty}
${input.notes ? `Мұғалімнің тілегі: ${input.notes}\n` : ""}${
    input.planContext
      ? `Тапсырмалар осы сабақтың қысқа мерзімді жоспарына (ҚМЖ) сай болсын: оқу мақсаттары мен сабақ мақсаттарының орындалуын тексерсін.\nҚМЖ мазмұны:\n${input.planContext}\n`
      : ""
  }${input.objective ? `Оқу мақсаты (ҮОБ): ${input.objective}\nӘр тапсырма осы оқу мақсатына жетуді тексерсін.\n` : ""}`;
}

const LEVEL_RULE = `"level" — ойлау деңгейі: "A" — білу және түсіну (анықтама, факт), "B" — қолдану (есеп, мысал, жағдаят), "C" — жоғары деңгей дағдылары (талдау, салыстыру, бағалау, қорытынды жасау).`;

const TYPE_RULES: Record<"levels" | "pisa" | "ubt", (n: number) => string> = {
  levels: (n) => `Осы тақырып бойынша дәл ${n} тест сұрағын құрастыр. Әр сұрақта 4 жауап нұсқасы, тек біреуі дұрыс.`,
  pisa: (n) => `PISA үлгісіндегі функционалдық сауаттылық тапсырмаларын құрастыр: дәл ${n} сұрақ.
- Сұрақтарды ${Math.max(2, Math.round(n / 3))} өмірлік жағдаятқа топта. Әр жағдаят — "context" өрісі: оқушыға таныс өмірлік жағдай (дүкен, саяхат, денсаулық, экология, қаржы, ғылыми жаңалық т.б.) туралы 60–130 сөздік мәтін; қажет болса, ішінде нақты сандар, шағын кесте ("|" арқылы жолдармен) немесе график сипаттамасы болсын.
- Бір жағдаятқа жататын сұрақтарда "context" мәтіні ТОЛЫҒЫМЕН бірдей болсын (сөзбе-сөз қайтала).
- Сұрақтар жаттанды білімді емес, мәтіннен ақпарат табуды, оны түсіндіруді, өмірде қолдануды және бағалауды тексерсін.
- Әр сұрақта 4 жауап нұсқасы, тек біреуі дұрыс.`,
  ubt: (n) => `ҰБТ (Ұлттық бірыңғай тестілеу) форматындағы дәл ${n} сұрақ құрастыр.
- Әр сұрақта ДӘЛ 5 жауап нұсқасы (A–E), тек біреуі дұрыс.
- Сұрақтар ҰБТ спецификациясына жақын: қысқа, нақты, есептеу, анықтама, себеп-салдар, формуланы қолдану сұрақтары; қате нұсқалар оқушылардың жиі қателесетін жауаптары болсын.
- Сынып деңгейінен асып кетпе, бірақ ҰБТ-ға дайындық деңгейінде болсын.`,
};

const testSchema2 = {
  type: "OBJECT",
  properties: {
    questions: {
      type: "ARRAY",
      items: {
        type: "OBJECT",
        properties: {
          context: { type: "STRING" },
          question: { type: "STRING" },
          options: { type: "ARRAY", items: { type: "STRING" } },
          correctIndex: { type: "INTEGER" },
          explanation: { type: "STRING" },
          level: { type: "STRING", enum: ["A", "B", "C"] },
        },
        required: ["question", "options", "correctIndex", "explanation", "level"],
      },
    },
  },
  required: ["questions"],
};

export async function generateTest(input: TaskInput): Promise<TestQuestion[]> {
  const type = input.taskType === "pisa" || input.taskType === "ubt" ? input.taskType : "levels";
  const optionCount = type === "ubt" ? 5 : 4;
  const prompt = `${taskIntro(input)}${TYPE_RULES[type](input.count)}
- ${LEVEL_RULE}
${
    input.differentiate !== false
      ? "- САРАЛАУ: сұрақтардың шамамен 40%-ы A, 40%-ы B, 20%-ы C деңгейінде болсын; қиындығы біртіндеп артсын.\n"
      : ""
  }- "correctIndex" — дұрыс нұсқаның "options" ішіндегі реттік нөмірі (0-ден бастап); дұрыс жауаптың орны сұрақтан сұраққа әртүрлі болсын.
- Нұсқаларда "A)" сияқты әріп белгілерін жазба, сұрақтың алдына нөмір қойма.
- Қате нұсқалар сенімді, бірақ анық қате болсын; "барлығы дұрыс" сияқты нұсқаларды қолданба.
- "explanation" — дұрыс жауаптың бір сөйлемдік түсіндірмесі.
- Фактілері дұрыс, бүкіл мәтін (сұрақ, нұсқалар, түсіндірме${type === "pisa" ? ", жағдаят" : ""}) ${inLang(input.lang)} (шет тілі пәні болмаса).`;
  const result = await aiGenerateJson<{ questions: Partial<TestQuestion>[] }>(prompt, type === "pisa" ? testSchema2 : testSchema);
  const questions = (result.questions ?? [])
    .filter((q) => q.question && Array.isArray(q.options) && q.options.length >= 2)
    .slice(0, input.count)
    .map((q) => {
      const options = q.options!.map((o) => o.replace(/^\s*[A-EА-Д][).]\s*/, "")).slice(0, optionCount);
      return {
        question: q.question!.replace(/^\s*\d+[).]\s*/, ""),
        options,
        correctIndex: Math.min(Math.max(Number(q.correctIndex) || 0, 0), options.length - 1),
        explanation: q.explanation ?? "",
        level: (["A", "B", "C"] as const).find((l) => l === q.level) ?? "A",
        ...(type === "pisa" && q.context?.trim() ? { context: q.context.trim() } : {}),
      };
    });
  if (questions.length === 0) throw new Error(tr("AI сұрақ қайтармады. Қайталап көріңіз."));
  if (type === "levels" && input.differentiate !== false) {
    const order = { A: 0, B: 1, C: 2 };
    questions.sort((x, y) => order[x.level] - order[y.level]);
  }
  return questions;
}

const writtenSchema = {
  type: "OBJECT",
  properties: {
    tasks: {
      type: "ARRAY",
      items: {
        type: "OBJECT",
        properties: {
          title: { type: "STRING" },
          text: { type: "STRING" },
          level: { type: "STRING", enum: ["A", "B", "C"] },
          criterion: { type: "STRING" },
          descriptors: { type: "ARRAY", items: { type: "STRING" } },
          points: { type: "INTEGER" },
          answer: { type: "STRING" },
        },
        required: ["title", "text", "level", "criterion", "descriptors", "points", "answer"],
      },
    },
  },
  required: ["tasks"],
};

/** БЖБ/ТЖБ немесе ашық/шығармашылық тапсырмалар: критерий, дескриптор, балл және үлгі жауап. */
export async function generateWrittenTasks(input: TaskInput): Promise<WrittenTask[]> {
  const bzb = input.taskType === "bzb";
  const prompt = `${taskIntro(input)}${
    bzb
      ? `Қазақстандағы критериалды бағалау жүйесі бойынша бөлім/тоқсан бойынша жиынтық бағалау (БЖБ/ТЖБ) тапсырмаларын құрастыр: дәл ${input.count} тапсырма.
- Тапсырмалар әртүрлі форматта болсын: қысқа жауапты, толық жауапты, есеп шығару, кестені толтыру, сәйкестендіру, сызбамен жұмыс.
- Жалпы балл 10–25 аралығында болсын.`
      : `Ашық және шығармашылық тапсырмалар құрастыр: дәл ${input.count} тапсырма.
- Түрлері әртүрлі болсын: ашық сұрақ (жазбаша түсіндіру), шағын эссе немесе пікір, зерттеу/тәжірибе, шағын жоба, кейс-талдау, постер/модель жасау.
- Тапсырмалар оқушының сыни ойлауын, шығармашылығын, коммуникациясын дамытсын.`
  }
- ${LEVEL_RULE} Тапсырмалар A → B → C ретімен күрделенсін.
- "title" — қысқа атауы; "text" — оқушыға арналған толық шарты (қажет болса, берілген деректерімен).
- "criterion" — бағалау критерийі (оқушы не істей алуы керек).
- "descriptors" — 2–4 дескриптор: әрқайсысы "Білім алушы ..." деп басталып, нақты әрекетті сипаттасын.
- "points" — тапсырманың балы (әр дескрипторға 1–2 балл).
- "answer" — мұғалімге арналған үлгі жауап немесе бағалау нұсқаулығы.
Барлығы ${inLang(input.lang)} (шет тілі пәні болмаса), фактілері дұрыс, сынып деңгейіне сай.${input.lang === "ru" ? ' Дескрипторлар "Обучающийся ..." деп басталсын.' : input.lang === "en" ? ' Дескрипторлар "The learner ..." деп басталсын.' : ""}`;
  const result = await aiGenerateJson<{ tasks: Partial<WrittenTask>[] }>(prompt, writtenSchema);
  const tasks = (result.tasks ?? [])
    .filter((t) => t.text)
    .slice(0, input.count)
    .map((t) => ({
      title: t.title?.trim() || "Тапсырма",
      text: t.text!.trim(),
      level: (["A", "B", "C"] as const).find((l) => l === t.level) ?? "A",
      criterion: t.criterion?.trim() ?? "",
      descriptors: (t.descriptors ?? []).filter(Boolean).slice(0, 5),
      points: Math.min(Math.max(Math.round(Number(t.points) || 1), 1), 20),
      answer: t.answer?.trim() ?? "",
    }));
  if (!tasks.length) throw new Error(tr("AI тапсырма қайтармады. Қайталап көріңіз."));
  return tasks;
}

/* -------------------------------------------- Нәтижелерді талдау және жеке тапсырма */

export interface PersonalTask {
  level: TestLevel;
  title: string;
  text: string;
  answer: string;
}

export interface PersonalPlan {
  feedback: string;
  tasks: PersonalTask[];
}

const personalSchema = {
  type: "OBJECT",
  properties: {
    feedback: { type: "STRING" },
    tasks: {
      type: "ARRAY",
      items: {
        type: "OBJECT",
        properties: {
          level: { type: "STRING", enum: ["A", "B", "C"] },
          title: { type: "STRING" },
          text: { type: "STRING" },
          answer: { type: "STRING" },
        },
        required: ["level", "title", "text", "answer"],
      },
    },
  },
  required: ["feedback", "tasks"],
};

const questionLine = (q: TestQuestion, i: number, picked?: number | null) =>
  `${i + 1}. [${q.level ?? "A"}] ${q.question} Дұрыс жауап: ${q.options[q.correctIndex]}.` +
  (picked === undefined ? "" : picked === null ? " Оқушы жауап бермеген." : ` Оқушы таңдағаны: ${q.options[picked] ?? "—"}.`);

/** Оқушының қателеріне қарай оның деңгейіне сай 3 жеке тапсырма құрастырады. */
export async function generatePersonalTasks(test: SavedTest, answers: (number | null)[]): Promise<PersonalPlan> {
  const wrong = test.questions.map((q, i) => ({ q, i })).filter(({ q, i }) => answers[i] !== q.correctIndex);
  const percent = Math.round(((test.questions.length - wrong.length) / Math.max(test.questions.length, 1)) * 100);
  const prompt = `Сен тәжірибелі мұғалімсің. Оқушы "${test.topic}" тақырыбы бойынша тест тапсырды (${test.subject}, ${test.grade}).
${test.objective ? `Оқу мақсаты: ${test.objective}
` : ""}Нәтижесі: ${percent}%.
Қате жіберген сұрақтары:
${wrong.length ? wrong.map(({ q, i }) => questionLine(q, i, answers[i])).join("\n") : "жоқ — барлығы дұрыс"}

Тапсырма:
- "feedback" — оқушыға арналған 2–3 сөйлемдік жылы, нақты кері байланыс: нені жақсы білетінін, қай жерде қателескенін және неге екенін түсіндір.
- "tasks" — дәл 3 жеке тапсырма. Қателері бар тақырыптарды бекітуге бағытта.
  Нәтиже 50%-дан төмен болса: A, A, B деңгейінде (қадамдап түсіндіретін, қолдау көрсететін);
  50–84% болса: A, B, B; 85%-дан жоғары болса: B, C, C (тереңдетілген, шығармашылық).
- Әр тапсырмада "title" (қысқа атауы), "text" (толық шарты), "answer" (мұғалімге арналған қысқа жауабы).
Барлығы ${inLang(test.lang)}, сынып деңгейіне сай, фактілері дұрыс болсын.`;
  const result = await aiGenerateJson<PersonalPlan>(prompt, personalSchema);
  const tasks = (result.tasks ?? []).filter((t) => t.text).slice(0, 3).map((t) => ({
    level: (["A", "B", "C"] as const).find((l) => l === t.level) ?? "A",
    title: t.title ?? "",
    text: t.text,
    answer: t.answer ?? "",
  }));
  if (!tasks.length) throw new Error(tr("AI тапсырма қайтармады. Қайталап көріңіз."));
  return { feedback: result.feedback ?? "", tasks };
}

export interface ClassAnalysis {
  summary: string;
  difficulties: string[];
  recommendations: string[];
  groups: { level: TestLevel; advice: string }[];
}

const analysisSchema = {
  type: "OBJECT",
  properties: {
    summary: { type: "STRING" },
    difficulties: { type: "ARRAY", items: { type: "STRING" } },
    recommendations: { type: "ARRAY", items: { type: "STRING" } },
    groups: {
      type: "ARRAY",
      items: {
        type: "OBJECT",
        properties: { level: { type: "STRING", enum: ["A", "B", "C"] }, advice: { type: "STRING" } },
        required: ["level", "advice"],
      },
    },
  },
  required: ["summary", "difficulties", "recommendations", "groups"],
};

/** Сынып нәтижесін талдап, келесі сабаққа ұсыныс және топтарға тапсырма береді. */
export async function analyzeClassResults(
  test: SavedTest,
  stats: { perQuestion: number[]; students: number; average: number; groups: Record<TestLevel, number> },
): Promise<ClassAnalysis> {
  const prompt = `Сен тәжірибелі әдіскер-мұғалімсің. Сыныптың тест нәтижесін талда.
Пән: ${test.subject}; сынып: ${test.grade}; тақырып: ${test.topic}.
${test.objective ? `Оқу мақсаты: ${test.objective}
` : ""}Тапсырған оқушылар: ${stats.students}; орташа нәтиже: ${stats.average}%.
Топтар: C (85%+, жоғары) — ${stats.groups.C} оқушы; B (50–84%) — ${stats.groups.B}; A (50%-дан төмен, қолдау қажет) — ${stats.groups.A}.
Сұрақтар және оларға дұрыс жауап бергендер үлесі:
${test.questions.map((q, i) => `${questionLine(q, i)} — ${stats.perQuestion[i]}% дұрыс`).join("\n")}

Жауапта:
- "summary" — оқу мақсатына қаншалықты жеткені туралы 2–3 сөйлемдік қорытынды.
- "difficulties" — 2–4 пункт: қай ұғымдар нашар меңгерілген және оның ықтимал себебі (қате нұсқаларға сүйен).
- "recommendations" — келесі сабаққа 3–4 нақты әдістемелік ұсыныс (қатемен жұмыс, саралау, белсенді әдістер).
- "groups" — әр топқа (A, B, C) бір-бір нақты тапсырма/жұмыс түрі.
Барлығы қазақ тілінде, қысқа әрі нақты.`;
  const r = await aiGenerateJson<ClassAnalysis>(prompt, analysisSchema);
  return {
    summary: r.summary ?? "",
    difficulties: (r.difficulties ?? []).slice(0, 5),
    recommendations: (r.recommendations ?? []).slice(0, 5),
    groups: (r.groups ?? []).filter((g) => g.advice).slice(0, 3),
  };
}
