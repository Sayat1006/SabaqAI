// AI студия: тақырып бойынша презентация, сабақ иллюстрациялары және тест.
// Барлығы `ai-generate` Edge Function арқылы Gemini-ге жүгінеді.

import { aiGenerateJson } from "./ai";
import type { LessonPlan } from "./generators";
import type { TestQuestion } from "./projects";
import { normalizeSlide, type SlideData } from "./slides";

export const PRESENTATION_STYLES = [
  { key: "minimal", label: "Минимал" },
  { key: "colorful", label: "Түрлі-түсті" },
  { key: "science", label: "Ғылыми" },
  { key: "kids", label: "Балаларға арналған" },
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
    label: "Акварель",
    hint: "soft watercolor look: translucent layered fills with low opacity, organic blob shapes, gentle color bleeding, no hard outlines",
  },
  { key: "flat", label: "Жалпақ дизайн", hint: "flat design: solid fills, no gradients, simple geometric shapes, bold limited palette" },
  {
    key: "realistic",
    label: "Реалистік",
    hint: "semi-realistic: linear/radial gradients for volume, soft shadows, detailed proportions",
  },
  { key: "line", label: "Сызықтық", hint: "line art: consistent stroke outlines only, no or very light fills, minimalist" },
  {
    key: "iso",
    label: "Изометрия",
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

const DECK_RULES = (count: number, styleLabel: string) => `Стиль: ${styleLabel}. Дәл ${count} слайд құрастыр.
Мәтін қазақ тілінде (шет тілі пәні болмаса), қысқа, оқушыға түсінікті; бір слайдта бір идея; тармақ 12 сөзден аспасын.
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

export async function generatePresentation(topic: string, style: string, count: number, planContext?: string) {
  const styleLabel = PRESENTATION_STYLES.find((s) => s.key === style)?.label ?? "Минимал";
  const prompt = `Сен мұғалімдерге сабақ презентациясын құрастыратын тәжірибелі әдіскер-дизайнерсің.
Тақырып: ${topic}
${planContext ? `Презентация мына қысқа мерзімді жоспарға (ҚМЖ) сай болсын — оның мақсаттарын, кезеңдерін, тапсырмаларын және құндылығын көрсет:\n"""\n${planContext}\n"""\n` : ""}${DECK_RULES(count, styleLabel)}`;
  const result = await aiGenerateJson<{ title: string; slides: Partial<SlideData>[] }>(prompt, presentationSchema);
  const slides = (result.slides ?? []).map((s) => normalizeSlide(s as Partial<SlideData> & Record<string, unknown>));
  if (slides.length === 0) throw new Error("AI слайд қайтармады. Қайталап көріңіз.");
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
export async function illustrateSlides(
  slides: SlideData[],
  deckStyle: string,
  onSlide: (index: number, svg: string) => void,
): Promise<void> {
  const style = DECK_IMAGE_STYLE[deckStyle] ?? "iso";
  const queue = slides
    .map((s, i) => ({ s, i }))
    .filter(({ s }) => (s.layout === "title" || s.layout === "image") && s.image_prompt && !s.image_svg)
    .slice(0, 4);
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
  await Promise.all([worker(), worker()]);
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
  if (!svg) throw new Error("Сурет дұрыс генерацияланбады. Қайталап көріңіз.");
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
        },
        required: ["question", "options", "correctIndex", "explanation"],
      },
    },
  },
  required: ["questions"],
};

export async function generateTest(input: {
  subject: string;
  grade: string;
  topic: string;
  difficulty: string;
  count: number;
  notes: string;
}): Promise<TestQuestion[]> {
  const prompt = `Сен Қазақстан мектептеріне арналған тәжірибелі мұғалім-әдіскерсің.
Пән: ${input.subject}
Сынып: ${input.grade}
Тақырып: ${input.topic}
Қиындық деңгейі: ${input.difficulty}
${input.notes ? `Мұғалімнің тілегі: ${input.notes}\n` : ""}Осы тақырып бойынша дәл ${input.count} тест сұрағын құрастыр.
- Әр сұрақта 4 жауап нұсқасы, тек біреуі дұрыс; дұрыс жауаптың орны сұрақтан сұраққа әртүрлі болсын.
- "correctIndex" — дұрыс нұсқаның "options" ішіндегі реттік нөмірі (0-ден бастап).
- Нұсқаларда "A)" сияқты әріп белгілерін жазба, сұрақтың алдына нөмір қойма.
- Қате нұсқалар сенімді, бірақ анық қате болсын; "барлығы дұрыс" сияқты нұсқаларды қолданба.
- "explanation" — дұрыс жауаптың бір сөйлемдік түсіндірмесі.
- Сұрақтар сынып деңгейіне сай, фактілері дұрыс, қазақ тілінде (шет тілі пәні болмаса).`;
  const result = await aiGenerateJson<{ questions: Partial<TestQuestion>[] }>(prompt, testSchema);
  const questions = (result.questions ?? [])
    .filter((q) => q.question && Array.isArray(q.options) && q.options.length >= 2)
    .slice(0, input.count)
    .map((q) => {
      const options = q.options!.map((o) => o.replace(/^\s*[A-DА-Г][).]\s*/, ""));
      return {
        question: q.question!.replace(/^\s*\d+[).]\s*/, ""),
        options,
        correctIndex: Math.min(Math.max(Number(q.correctIndex) || 0, 0), options.length - 1),
        explanation: q.explanation ?? "",
      };
    });
  if (questions.length === 0) throw new Error("AI сұрақ қайтармады. Қайталап көріңіз.");
  return questions;
}
