// AI студия: тақырып бойынша презентация, сабақ иллюстрациялары және тест.
// Барлығы `ai-generate` Edge Function арқылы Gemini-ге жүгінеді.

import { aiGenerateJson } from "./ai";
import type { SlideData, TestQuestion } from "./projects";

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
          layout: { type: "STRING", enum: ["title", "bullets", "two_column", "highlight", "quiz", "closing"] },
          heading: { type: "STRING" },
          subheading: { type: "STRING" },
          bullets: stringArray,
          left_title: { type: "STRING" },
          left: stringArray,
          right_title: { type: "STRING" },
          right: stringArray,
          highlight: { type: "STRING" },
          notes: { type: "STRING" },
        },
        required: ["layout", "heading"],
      },
    },
  },
  required: ["title", "slides"],
};

export async function generatePresentation(topic: string, style: string, count: number) {
  const styleLabel = PRESENTATION_STYLES.find((s) => s.key === style)?.label ?? "Минимал";
  const prompt = `Сен мұғалімдерге сабақ презентациясын құрастыратын әдіскер-дизайнерсің.
Тақырып: ${topic}
Стиль: ${styleLabel}
Дәл ${count} слайд құрастыр. Мәтін қазақ тілінде (шет тілі пәні болмаса), қысқа, оқушыға түсінікті, бір слайдта бір идея.
Макеттер: "title" (бірінші слайд), "bullets" (2–5 қысқа тармақ), "two_column" (салыстыру: left_title/left және right_title/right), "highlight" (басты анықтама не формула — highlight өрісінде), "quiz" (тексеру сұрақтары — bullets өрісінде), "closing" (соңғы слайд).
Бірінші слайд — title, соңғысы — closing. Әр слайдқа мұғалімге арналған қысқа "notes" жаз. Ойдан шығарылған статистика қолданба.`;
  const result = await aiGenerateJson<{ title: string; slides: Partial<SlideData>[] }>(prompt, presentationSchema);
  const slides: SlideData[] = (result.slides ?? []).map((s) => ({
    layout: s.layout ?? "bullets",
    heading: s.heading ?? "",
    subheading: s.subheading ?? "",
    bullets: s.bullets ?? [],
    left_title: s.left_title ?? "",
    left: s.left ?? [],
    right_title: s.right_title ?? "",
    right: s.right ?? [],
    highlight: s.highlight ?? "",
    notes: s.notes ?? "",
  }));
  if (slides.length === 0) throw new Error("AI слайд қайтармады. Қайталап көріңіз.");
  return { title: result.title || topic, slides };
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
