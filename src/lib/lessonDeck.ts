// Сабақ презентациясы — мұғалім берген PowerPoint үлгісі бойынша (16:9, 960 × 540 pt).
// Слайдтар ҚМЖ-ның (ресми үлгі, format: 2) кезеңдерімен бірдей ретпен құралады:
// титул → мақсат → өзектендіру → проблема → жаңа білім → сурет → бекіту → сергіту →
// деңгейлер (A, B, C) → викторина → рефлексия → үй тапсырмасы → қорытынды.
//
// Әр слайдтың геометриясы осы модульде бір рет сипатталады (`lessonShapes`): экрандағы
// көрініс (LessonSlideView) пен PowerPoint экспорты (exportLessonPptx) сол фигураларды салады,
// сондықтан екеуі бірдей болады. Координаттар үлгідегі нүктелермен (pt) берілген.

import { aiGenerateJson } from "./ai";
import type { LessonPlan } from "./generators";
import { gradeIn, subjectIn, type Lang } from "./lang";
import { parseRichLine, plainText } from "./qmzhText";
import { platformLabel } from "./resources";
import type { SlideData } from "./slides";

export const LESSON_STYLE = "lesson";

/* ------------------------------------------------------------------ деректер */

export type LessonKind =
  | "title"
  | "goals"
  | "warmup"
  | "problem"
  | "knowledge"
  | "picture"
  | "practice"
  | "break"
  | "levels"
  | "level"
  | "quiz"
  | "reflection"
  | "homework"
  | "closing";

export const LESSON_KINDS: LessonKind[] = ["title", "goals", "warmup", "problem", "knowledge", "picture", "practice", "break", "levels", "level", "quiz", "reflection", "homework", "closing"];

export interface LessonItem {
  label: string;
  text: string;
  extra?: string;
}

/** Үлгі слайдының мазмұны (SlideData.lesson). Мәтінде **қалың** белгісі қолданылады. */
export interface LessonSlide {
  kind: LessonKind;
  /** Кезең белгісі, мыс. «Сабақтың басы · 6 мин». */
  stage?: string;
  /** Түс: 1–6 (үлгі тақырыбының accent1…accent6). */
  tone?: number;
  footer?: string;
  /** title: «ФИЗИКА · 7-СЫНЫП», бөлім жолы, ақпарат жолдары. */
  kicker?: string;
  section?: string;
  info?: string[];
  /** Негізгі мәтін (абзацтар). */
  text?: string[];
  /** Көлбеу жол / төменгі жолақ / сурет асты жазуы / нақыл сөз. */
  note?: string;
  /** Бүйірдегі карточка (мақсаттар, құндылық). */
  sideTitle?: string;
  side?: string[];
  listTitle?: string;
  items?: LessonItem[];
  level?: string;
  answer?: string;
  qr?: string;
}

const str = (v: unknown) => (typeof v === "string" ? v.trim() : "");
const strs = (v: unknown, max = 8) => (Array.isArray(v) ? v.map(str).filter(Boolean).slice(0, max) : []);

export function normalizeLesson(raw: unknown): LessonSlide | undefined {
  if (!raw || typeof raw !== "object") return undefined;
  const r = raw as Record<string, unknown>;
  const kind = LESSON_KINDS.find((k) => k === r.kind);
  if (!kind) return undefined;
  const tone = Number(r.tone);
  return {
    kind,
    stage: str(r.stage),
    tone: tone >= 1 && tone <= 6 ? Math.round(tone) : undefined,
    footer: str(r.footer),
    kicker: str(r.kicker),
    section: str(r.section),
    info: strs(r.info, 4),
    text: strs(r.text, 8),
    note: str(r.note),
    sideTitle: str(r.sideTitle),
    side: strs(r.side, 5),
    listTitle: str(r.listTitle),
    items: Array.isArray(r.items)
      ? r.items
          .map((it) => {
            const o = (it ?? {}) as Record<string, unknown>;
            return { label: str(o.label), text: str(o.text), extra: str(o.extra) };
          })
          .filter((it) => it.label || it.text || it.extra)
          .slice(0, 6)
      : [],
    level: str(r.level),
    answer: str(r.answer),
    qr: /^https?:\/\//i.test(str(r.qr)) ? str(r.qr) : "",
  };
}

/* ------------------------------------------------------------------ тұрақты мәтіндер */

const TEXT = {
  kk: {
    goals: "Сабақтың мақсаты",
    objectives: "Оқу мақсаттары (бағдарлама)",
    weWill: "Сабақ соңында біз:",
    teacher: "Педагог",
    value: "Құндылық",
    section: "Бөлім",
    warmup: "Білімді өзектендіру",
    problem: "Проблемалық жағдаят",
    knowledge: "Жаңа білім",
    picture: "Суретпен жұмыс",
    practice: "Бекіту",
    break: "Сергіту сәті",
    levels: "Деңгейлік тапсырмалар",
    task: "Тапсырма",
    levelWord: (l: string) => `${l} деңгейі`,
    levelDesc: { A: "білу, түсіну", B: "қолдану", C: "талдау, жинақтау" } as Record<string, string>,
    levelLetters: { A: "А", B: "В", C: "С", SEN: "ЕББҚ", ALL: "★" } as Record<string, string>,
    senTitle: "ЕББҚ оқушысына арналған тапсырма",
    allTitle: "Өзіндік жұмыс",
    levelsNote: "Деңгейіңді өзің таңда. А деңгейін орындасаң – В деңгейіне өт!",
    answer: "Жауабы:",
    quiz: "Бекіту: викторина",
    reflection: "Рефлексия",
    homework: "Үй тапсырмасы",
    thanks: "Сабаққа белсенді қатысқандарыңа рахмет!",
    scale: [
      ["9–10 балл", "Өте жақсы"],
      ["7–8 балл", "Жақсы"],
      ["5–6 балл", "Қанағаттанарлық"],
      ["0–4 балл", "Қолдау қажет"],
    ],
    kicker: (subject: string, grade: string) => `${subject} · ${grade.match(/\d+/)?.[0] ?? grade}-сынып`.toUpperCase(),
    min: "мин",
  },
  ru: {
    goals: "Цель урока",
    objectives: "Цели обучения (программа)",
    weWill: "К концу урока мы:",
    teacher: "Педагог",
    value: "Ценность",
    section: "Раздел",
    warmup: "Актуализация знаний",
    problem: "Проблемная ситуация",
    knowledge: "Новые знания",
    picture: "Работа с рисунком",
    practice: "Закрепление",
    break: "Физминутка",
    levels: "Разноуровневые задания",
    task: "Задание",
    levelWord: (l: string) => `Уровень ${l}`,
    levelDesc: { A: "знание, понимание", B: "применение", C: "анализ, обобщение" } as Record<string, string>,
    levelLetters: { A: "А", B: "В", C: "С", SEN: "ООП", ALL: "★" } as Record<string, string>,
    senTitle: "Задание для учащегося с ООП",
    allTitle: "Самостоятельная работа",
    levelsNote: "Выбери свой уровень. Выполнил уровень А – переходи к уровню В!",
    answer: "Ответ:",
    quiz: "Закрепление: викторина",
    reflection: "Рефлексия",
    homework: "Домашнее задание",
    thanks: "Спасибо за активное участие!",
    scale: [
      ["9–10 баллов", "Отлично"],
      ["7–8 баллов", "Хорошо"],
      ["5–6 баллов", "Удовлетворительно"],
      ["0–4 балла", "Нужна поддержка"],
    ],
    kicker: (subject: string, grade: string) => `${subject} · ${grade.match(/\d+/)?.[0] ?? grade} класс`.toUpperCase(),
    min: "мин",
  },
  en: {
    goals: "Lesson objectives",
    objectives: "Learning objectives (curriculum)",
    weWill: "By the end of the lesson we will:",
    teacher: "Teacher",
    value: "Value",
    section: "Unit",
    warmup: "Activating prior knowledge",
    problem: "Problem situation",
    knowledge: "New knowledge",
    picture: "Working with a picture",
    practice: "Consolidation",
    break: "Brain break",
    levels: "Levelled tasks",
    task: "Task",
    levelWord: (l: string) => `Level ${l}`,
    levelDesc: { A: "knowledge, understanding", B: "application", C: "analysis, synthesis" } as Record<string, string>,
    levelLetters: { A: "A", B: "B", C: "C", SEN: "SEN", ALL: "★" } as Record<string, string>,
    senTitle: "Task for learners with SEN",
    allTitle: "Independent work",
    levelsNote: "Choose your level. Finished level A? Move on to level B!",
    answer: "Answer:",
    quiz: "Consolidation: quiz",
    reflection: "Reflection",
    homework: "Homework",
    thanks: "Thank you for your active participation!",
    scale: [
      ["9–10 points", "Excellent"],
      ["7–8 points", "Good"],
      ["5–6 points", "Satisfactory"],
      ["0–4 points", "Needs support"],
    ],
    kicker: (subject: string, grade: string) => `${subject} · Grade ${grade.match(/\d+/)?.[0] ?? grade}`.toUpperCase(),
    min: "min",
  },
} satisfies Record<Lang, unknown>;

export const lessonText = (lang?: Lang) => TEXT[lang ?? "kk"];

/* ------------------------------------------------------------------ геометрия */

/** Үлгі тақырыбының түстері (theme1.xml). */
export const LESSON_COLORS = {
  accent1: "0E7C86",
  accent2: "E07A1F",
  accent3: "2E7D32",
  accent4: "B7791F",
  accent5: "C0392B",
  accent6: "5B4B8A",
  tx1: "1B1B1B",
  tx2: "1F3A5F",
  bg1: "FFFFFF",
  muted: "55606E",
  foot: "6B7785",
} as const;
export type LessonColor = keyof typeof LESSON_COLORS;
const accent = (n: number | undefined): LessonColor => `accent${Math.min(Math.max(n ?? 1, 1), 6)}` as LessonColor;

export type IconName = "atom" | "target" | "brain" | "star" | "help" | "bulb" | "book" | "image" | "pencil" | "run" | "layers" | "key" | "game" | "smile" | "home" | "hands";

export interface Run {
  text: string;
  bold?: boolean;
  italic?: boolean;
  color?: LessonColor;
}
export interface Para {
  runs: Run[];
  bullet?: boolean;
}

export type Shape =
  | { k: "ellipse" | "rect"; x: number; y: number; w: number; h: number; fill?: LessonColor; alpha?: number; line?: LessonColor; lineW?: number; r?: number; shadow?: boolean }
  | {
      k: "text";
      x: number;
      y: number;
      w: number;
      h: number;
      paras: Para[];
      size: number;
      color: LessonColor;
      align?: "left" | "center" | "right";
      anchor?: "top" | "middle";
      inset?: number;
    }
  | { k: "icon"; x: number; y: number; w: number; h: number; name: IconName }
  | { k: "image"; x: number; y: number; w: number; h: number }
  | { k: "qr"; x: number; y: number; w: number; h: number; url: string };

/** Мәтін жолдарын абзацтарға айналдыру (**қалың**, «• » тізім). */
function rich(lines: string[], o: { bold?: boolean; italic?: boolean; color?: LessonColor } = {}): Para[] {
  return lines
    .map((l) => parseRichLine(l))
    .filter((l) => l.parts.length)
    .map((l) => ({ bullet: l.bullet, runs: l.parts.map((p) => ({ text: p.text, bold: o.bold || p.bold || undefined, italic: o.italic, color: o.color })) }));
}

/**
 * Мәтін өлшемін қорапқа сыйғызу: Times New Roman-ның орташа әріп ені ≈ 0.5 em,
 * жол биіктігі ≈ 1.2 em. Экран мен PowerPoint бір өлшемді алады.
 */
function fit(paras: Para[], w: number, h: number, base: number, min = 12, inset = 0): number {
  const text = paras.map((p) => p.runs.map((r) => r.text).join(""));
  for (let size = base; size > min; size -= 1) {
    const perLine = Math.max(6, Math.floor((w - inset * 2 - (paras.some((p) => p.bullet) ? size : 0)) / (size * 0.5)));
    const lines = text.reduce((n, t) => n + Math.max(1, Math.ceil(t.length / perLine)), 0);
    if (lines * size * 1.2 + (paras.length - 1) * size * 0.25 <= h - inset * 2) return size;
  }
  return min;
}

function text(
  x: number,
  y: number,
  w: number,
  h: number,
  paras: Para[],
  base: number,
  o: { color?: LessonColor; align?: "left" | "center" | "right"; anchor?: "top" | "middle"; inset?: number; min?: number } = {},
): Shape {
  const inset = o.inset ?? 0;
  return { k: "text", x, y, w, h, paras, size: fit(paras, w, h, base, o.min ?? Math.min(12, base), inset), color: o.color ?? "tx1", align: o.align, anchor: o.anchor ?? "middle", inset };
}

const card = (x: number, y: number, w: number, h: number, c: LessonColor, alpha = 12): Shape => ({ k: "rect", x, y, w, h, fill: c, alpha, line: c, lineW: 1.25, r: 8.6 });
const circle = (x: number, y: number, d: number, c: LessonColor): Shape => ({ k: "ellipse", x, y, w: d, h: d, fill: c, line: c, lineW: 1 });
const letter = (x: number, y: number, d: number, t: string, size: number): Shape =>
  text(x, y, d, d, [{ runs: [{ text: t, bold: true }] }], t.length > 2 ? size * 0.45 : size, { color: "bg1", align: "center" });

function header(s: LessonSlide, heading: string, icon: IconName, n: number): Shape[] {
  const c = accent(s.tone);
  const out: Shape[] = [
    text(115, 59, 802, 58, [{ runs: [{ text: heading, bold: true }] }], 32, { color: "tx2", min: 20 }),
    circle(43, 59, 58, c),
    { k: "icon", x: 57, y: 73, w: 30, h: 30, name: icon },
  ];
  if (s.stage) {
    out.push({ k: "rect", x: 658, y: 22, w: 259, h: 30, fill: c, alpha: 15, line: c, lineW: 1, r: 15 });
    out.push(text(658, 22, 259, 30, [{ runs: [{ text: s.stage, bold: true }] }], 14, { color: c, align: "center", min: 10 }));
  }
  if (s.footer) out.push(text(43, 508, 720, 22, [{ runs: [{ text: s.footer }] }], 12, { color: "foot", min: 9 }));
  out.push(text(881, 508, 36, 22, [{ runs: [{ text: String(n) }] }], 12, { color: "foot", align: "right" }));
  return out;
}

const decor = (): Shape[] => [
  { k: "ellipse", x: 713, y: -101, w: 331, h: 331, fill: "accent1", alpha: 10 },
  { k: "ellipse", x: -86, y: 403, w: 216, h: 216, fill: "accent2", alpha: 12 },
];

const LEVEL_TONE: Record<string, number> = { A: 3, B: 4, C: 5, SEN: 6, ALL: 1 };

/** Слайдтың барлық фигуралары (pt). `n` — слайд нөмірі. */
export function lessonShapes(slide: SlideData, n: number, lang?: Lang): Shape[] {
  const s = slide.lesson ?? { kind: "practice" as const, text: slide.bullets };
  const T = lessonText(lang);
  const c = accent(s.tone);
  const body = s.text ?? [];
  const H = (icon: IconName) => header(s, slide.heading, icon, n);
  switch (s.kind) {
    case "title": {
      const out: Shape[] = [
        ...decor(),
        circle(43, 54, 68, "accent1"),
        { k: "icon", x: 60, y: 70, w: 36, h: 36, name: "atom" },
        text(126, 58, 468, 32, [{ runs: [{ text: s.kicker ?? "", bold: true }] }], 20, { color: "accent1", min: 12 }),
        text(126, 90, 468, 32, [{ runs: [{ text: s.section ?? "" }] }], 18, { color: "muted", min: 11 }),
      ];
      const hasImage = !!slide.image_svg || !!slide.image_prompt;
      out.push(text(43, 155, hasImage ? 497 : 874, 216, [{ runs: [{ text: slide.heading, bold: true }] }], 44, { color: "tx2", min: 24 }));
      out.push(card(43, 392, 497, 86, "accent2", 12));
      out.push(text(61, 396, 468, 79, rich(s.info ?? []), 18, { min: 11 }));
      if (hasImage) {
        out.push({ k: "rect", x: 565, y: 168, w: 356, h: 212, fill: "bg1", line: "accent1", lineW: 2, r: 18, shadow: true });
        out.push({ k: "image", x: 580, y: 186, w: 328, h: 176 });
      }
      return out;
    }
    case "goals": {
      const out: Shape[] = [
        ...H("target"),
        card(43, 140, 353, 346, "accent1", 12),
        text(61, 151, 317, 36, [{ runs: [{ text: s.sideTitle ?? "", bold: true }] }], 18, { color: "accent1", min: 12 }),
        text(61, 191, 317, 284, rich(s.side ?? []), 20, { anchor: "top", inset: 8, min: 11 }),
        text(421, 140, 497, 36, [{ runs: [{ text: s.listTitle ?? "", bold: true }] }], 22, { color: "tx2", min: 14 }),
      ];
      const items = (s.items ?? []).slice(0, 5);
      const step = items.length > 4 ? 60 : 74.7;
      const colors: LessonColor[] = ["accent3", "accent4", "accent1", "accent5", "accent6"];
      items.forEach((it, i) => {
        const y = 189 + i * step;
        out.push(circle(421, y, 40, colors[i]));
        out.push(letter(421, y, 40, String(i + 1), 18));
        out.push(text(472, y - 5, 446, step - 6, rich([it.text]), 21, { anchor: "top", inset: 4, min: 11 }));
      });
      return out;
    }
    case "warmup":
    case "practice": {
      const side = !!(s.sideTitle || s.side?.length);
      if (side) {
        return [
          ...H(s.kind === "warmup" ? "brain" : "pencil"),
          card(43, 140, 547, 288, c, 12),
          text(65, 155, 504, 259, rich(body), 26, { anchor: "top", inset: 8 }),
          card(619, 140, 297, 288, "accent2", 12),
          circle(637, 155, 43, "accent2"),
          { k: "icon", x: 648, y: 165, w: 22, h: 22, name: "star" },
          text(688, 155, 216, 65, [{ runs: [{ text: s.sideTitle ?? "", bold: true }] }], 17, { color: "accent2", min: 11 }),
          text(637, 230, 266, 187, rich(s.side ?? []), 22, { anchor: "top", inset: 8, min: 11 }),
        ];
      }
      const top = s.note ? 209 : 140;
      return [
        ...H(s.kind === "warmup" ? "brain" : "pencil"),
        ...(s.note ? [text(43, 137, 874, 61, rich([s.note], { italic: true }), 18, { color: "muted", min: 11 })] : []),
        card(43, top, 874, 483 - top, c, 12),
        circle(65, top + 18, 68, c),
        { k: "icon" as const, x: 81, y: top + 34, w: 36, h: 36, name: "pencil" as IconName },
        text(151, top + 11, 744, 483 - top - 22, rich(body), 28, { anchor: "top", inset: 8 }),
      ];
    }
    case "problem":
      return [
        ...H("help"),
        card(43, 140, 874, 266, c, 15),
        circle(68, 169, 94, c),
        { k: "icon", x: 91, y: 192, w: 49, h: 49, name: "bulb" },
        text(184, 151, 708, 245, rich(body), 32, { inset: 8 }),
        ...(s.note
          ? [card(43, 421, 874, 61, "accent1", 20), text(65, 421, 830, 61, rich([s.note], { bold: true }), 22, { color: "accent1", min: 12 })]
          : []),
      ];
    case "knowledge": {
      const img = !!slide.image_svg || !!slide.image_prompt;
      const out: Shape[] = [...H("book"), text(43, 140, img ? 482 : 874, 342, rich(body.map((b) => (b.startsWith("•") ? b : `• ${b}`))), 22, { anchor: "top", inset: 8 })];
      if (img) {
        out.push(card(544, 140, 373, 342, "accent1", 12));
        out.push({ k: "image", x: 554, y: 201, w: 351, h: 189 });
        if (s.note) out.push(text(554, 443, 351, 29, rich([s.note], { italic: true }), 14, { color: "muted", align: "center", min: 10 }));
      }
      return out;
    }
    case "picture":
      return [
        ...H("image"),
        card(151, 140, 658, 299, c, 12),
        { k: "image", x: 215, y: 148, w: 529, h: 284 },
        text(43, 450, 874, 40, rich([s.note ?? ""], { italic: true }), 20, { color: c, align: "center", min: 11 }),
      ];
    case "break":
      return [
        ...H("run"),
        circle(408, 140, 144, c),
        { k: "icon", x: 443, y: 175, w: 75, h: 75, name: "run" },
        text(115, 306, 730, 166, rich(body), 32, { align: "center", anchor: "top", inset: 8 }),
      ];
    case "levels": {
      const items = (s.items ?? []).slice(0, 3);
      const boxes = [
        { x: 43, y: 245, h: 187, t: "accent3" as LessonColor },
        { x: 340, y: 202, h: 230, t: "accent4" as LessonColor },
        { x: 636, y: 158, h: 274, t: "accent5" as LessonColor },
      ];
      const out: Shape[] = [...H("layers")];
      items.forEach((it, i) => {
        const b = boxes[i];
        out.push(card(b.x, b.y, 277, b.h, b.t, 20));
        out.push(circle(b.x + 95, b.y + 18, 86, b.t));
        out.push(letter(b.x + 95, b.y + 18, 86, it.label, 40));
        out.push(text(b.x, b.y + 111, 277, 40, [{ runs: [{ text: it.text, bold: true }] }], 26, { color: b.t, align: "center", min: 14 }));
        out.push(text(b.x, b.y + 147, 277, 32, [{ runs: [{ text: it.extra ?? "" }] }], 20, { align: "center", min: 11 }));
      });
      if (s.note) out.push(text(43, 446, 874, 36, rich([s.note], { italic: true }), 20, { color: "accent6", align: "center", min: 11 }));
      return out;
    }
    case "level": {
      const lt = accent(LEVEL_TONE[s.level ?? "A"] ?? s.tone);
      const out: Shape[] = [
        ...header({ ...s, tone: LEVEL_TONE[s.level ?? "A"] ?? s.tone }, slide.heading, "layers", n),
        card(43, 140, 874, s.answer ? 248 : 343, lt, 14),
        circle(65, 158, 79, lt),
        letter(65, 158, 79, T.levelLetters[s.level ?? "A"] ?? s.level ?? "", 38),
        text(162, 148, 737, s.answer ? 234 : 329, rich(body), 32, { anchor: "top", inset: 8 }),
      ];
      if (s.answer) {
        out.push(card(43, 403, 874, 83, "accent3", 8));
        out.push(circle(58, 419, 50, "accent3"));
        out.push({ k: "icon", x: 70, y: 431, w: 26, h: 26, name: "key" });
        out.push(text(122, 405, 780, 79, rich([`**${T.answer}** ${s.answer}`]), 18, { inset: 8, min: 10 }));
      }
      return out;
    }
    case "quiz": {
      const items = (s.items ?? []).slice(0, 3);
      const out: Shape[] = [...H("game")];
      const qw = s.qr ? 558 : 790;
      items.forEach((it, i) => {
        const y = 140 + i * 112;
        out.push(circle(43, y + 15, 61, "accent2"));
        out.push(letter(43, y + 15, 61, String(i + 1), 26));
        out.push(card(119, y, qw, 94, "accent2", 12));
        out.push(text(133, y + 4, qw - 176, 86, rich([it.text]), 24, { inset: 8, min: 11 }));
        out.push({ k: "rect", x: 119 + qw - 155, y: y + 15, w: 144, h: 65, fill: "accent3", line: "accent3", lineW: 1, r: 7.2 });
        out.push(text(119 + qw - 155, y + 15, 144, 65, [{ runs: [{ text: it.extra ?? "", bold: true }] }], 20, { color: "bg1", align: "center", inset: 3, min: 10 }));
      });
      if (s.qr) {
        out.push({ k: "qr", x: 731, y: 148, w: 173, h: 173, url: s.qr });
        if (s.note) out.push(text(702, 324, 230, 25, [{ runs: [{ text: s.note }] }], 14, { color: "muted", align: "center", min: 10 }));
      }
      return out;
    }
    case "reflection": {
      const out: Shape[] = [
        ...H("smile"),
        circle(58, 158, 130, c),
        { k: "icon", x: 89, y: 190, w: 67, h: 67, name: "smile" },
        card(209, 140, 708, 245, c, 12),
        text(227, 151, 672, 223, rich(body), 32, { inset: 8 }),
      ];
      const tones: LessonColor[] = ["accent3", "accent1", "accent4", "accent5"];
      (s.items ?? []).slice(0, 4).forEach((it, i) => {
        const x = 43 + i * 221;
        out.push(card(x, 403, 209, 79, tones[i], 15));
        out.push(text(x, 403, 209, 79, [{ runs: [{ text: it.label, bold: true, color: tones[i] }] }, { runs: [{ text: it.text }] }], 18, { align: "center", min: 10 }));
      });
      return out;
    }
    case "homework": {
      const items = (s.items ?? []).slice(0, 3);
      const out: Shape[] = [...H("home")];
      const w = items.length === 1 ? 874 : items.length === 2 ? 425 : 277;
      const gap = items.length === 2 ? 24 : 20;
      items.forEach((it, i) => {
        const x = 43 + i * (w + gap);
        const t = accent(LEVEL_TONE[it.label] ?? 1);
        out.push(card(x, 140, w, 342, t, 14));
        out.push(circle(x + 18, 155, 61, t));
        out.push(letter(x + 18, 155, 61, T.levelLetters[it.label] ?? it.label, 28));
        out.push(text(x + 90, 158, w - 101, 54, [{ runs: [{ text: it.text, bold: true }] }], 22, { color: t, min: 12 }));
        out.push(text(x + 18, 230, w - 36, 238, rich([it.extra ?? ""]), 26, { anchor: "top", inset: 5 }));
      });
      return out;
    }
    case "closing":
      return [
        ...decor(),
        circle(415, 101, 130, "accent1"),
        { k: "icon", x: 446, y: 132, w: 67, h: 67, name: "star" },
        text(72, 252, 816, 72, [{ runs: [{ text: slide.heading, bold: true }] }], 40, { color: "tx2", align: "center", min: 20 }),
        text(108, 331, 744, 86, rich([s.note ?? ""], { italic: true }), 22, { color: "accent1", align: "center", min: 12 }),
      ];
  }
}

/* ------------------------------------------------------------------ ҚМЖ → слайдтар */

/** ҚМЖ-дағы жолдан белгі бойынша мәтінді алу (мыс. «Проблемалық жағдаят:»). */
function findLine(lines: string[], re: RegExp): { label: string; rest: string; index: number } | null {
  const index = lines.findIndex((l) => re.test(plainText(l)));
  if (index < 0) return null;
  const line = lines[index];
  const m = line.match(/^\*\*(.+?)\*\*\s*(.*)$/);
  return m ? { label: m[1].replace(/[.:]\s*$/, ""), rest: m[2], index } : { label: "", rest: line, index };
}

const quoted = (s: string) => s.match(/«[^»]+»/)?.[0] ?? "";
const stageLines = (plan: LessonPlan, i: number) => plan.stages[i]?.rows.flatMap((r) => r.teacherAction) ?? [];
const minutesOf = (t: string) => t.match(/\d+/)?.[0] ?? "";

interface DeckAi {
  warmup?: { method?: string; text?: string[] };
  problem?: { text?: string; call?: string };
  knowledge?: { bullets?: string[]; caption?: string; image_prompt?: string };
  picture_question?: string;
  practice?: { method?: string; description?: string; task?: string };
  brain_break?: string;
  levels?: { level?: string; task?: string }[];
  quiz?: { title?: string; items?: { question?: string; answer?: string }[] };
  reflection?: { method?: string; text?: string };
  homework?: { level?: string; text?: string }[];
}

const SA = { type: "ARRAY", items: { type: "STRING" } };
const deckSchema = {
  type: "OBJECT",
  properties: {
    warmup: { type: "OBJECT", properties: { method: { type: "STRING" }, text: SA }, required: ["method", "text"] },
    problem: { type: "OBJECT", properties: { text: { type: "STRING" }, call: { type: "STRING" } }, required: ["text", "call"] },
    knowledge: {
      type: "OBJECT",
      properties: { bullets: SA, caption: { type: "STRING" }, image_prompt: { type: "STRING" } },
      required: ["bullets", "caption", "image_prompt"],
    },
    picture_question: { type: "STRING" },
    practice: { type: "OBJECT", properties: { method: { type: "STRING" }, description: { type: "STRING" }, task: { type: "STRING" } }, required: ["method", "description", "task"] },
    brain_break: { type: "STRING" },
    levels: {
      type: "ARRAY",
      items: { type: "OBJECT", properties: { level: { type: "STRING", enum: ["A", "B", "C", "ALL", "SEN"] }, task: { type: "STRING" } }, required: ["level", "task"] },
    },
    quiz: {
      type: "OBJECT",
      properties: { title: { type: "STRING" }, items: { type: "ARRAY", items: { type: "OBJECT", properties: { question: { type: "STRING" }, answer: { type: "STRING" } }, required: ["question", "answer"] } } },
      required: ["title", "items"],
    },
    reflection: { type: "OBJECT", properties: { method: { type: "STRING" }, text: { type: "STRING" } }, required: ["method", "text"] },
    homework: { type: "ARRAY", items: { type: "OBJECT", properties: { level: { type: "STRING", enum: ["A", "B", "C", "ALL"] }, text: { type: "STRING" } }, required: ["level", "text"] } },
  },
  required: ["warmup", "problem", "knowledge", "picture_question", "practice", "brain_break", "levels", "quiz", "reflection", "homework"],
};

/** ҚМЖ-ны AI-ға берілетін толық мәтінге айналдыру (кезең бойынша). */
function planText(plan: LessonPlan): string {
  return plan.stages
    .map((st, i) => {
      const r = st.rows[0];
      return [
        `${i + 1}-кезең: ${st.name} (${st.timeRange})${st.purpose ? ` — ${st.purpose}` : ""}`,
        `Педагог: ${(r?.teacherAction ?? []).join(" | ")}`,
        `Оқушы: ${(r?.studentAction ?? []).join(" | ")}`,
        `Бағалау: ${(r?.assessment ?? []).join(" | ")}`,
      ].join("\n");
    })
    .join("\n\n");
}

/** AI-сыз: ҚМЖ жолдарынан слайд мазмұнын шығару. */
function extractFromPlan(plan: LessonPlan): DeckAi {
  const s0 = stageLines(plan, 0);
  const s1 = stageLines(plan, 1);
  const s2 = stageLines(plan, 2);
  const s3 = stageLines(plan, 3);
  const s4 = stageLines(plan, 4);
  const s5 = stageLines(plan, 5);
  const warm = findLine(s0, /өзектендіру|актуализ|prior knowledge/i);
  const prob = findLine(s0, /проблема|problem/i);
  const head1 = s1.find((l) => l.startsWith("**")) ?? "";
  const prac = s2[0] ? findLine(s2, /./) : null;
  const task = findLine(s2, /^(Тапсырма|Задание|Task)/i);
  const levels: DeckAi["levels"] = [];
  (["A", "B", "C"] as const).forEach((lv, k) => {
    const re = [/^(А|A)\s*(деңгейі|уровень|level)/i, /^(В|B)\s*(деңгейі|уровень|level)/i, /^(С|C)\s*(деңгейі|уровень|level)/i][k];
    const at = s4.findIndex((l) => re.test(plainText(l)));
    if (at >= 0 && s4[at + 1] && !s4[at + 1].startsWith("**")) levels.push({ level: lv, task: s4[at + 1] });
  });
  const quizAt = s5.findIndex((l) => /бекіту|закреплен|consolidat/i.test(plainText(l)));
  const quizItems = s5
    .slice(quizAt + 1)
    .filter((l) => /^•/.test(l) && /\(.+\)\s*$/.test(l))
    .slice(0, 3)
    .map((l) => {
      const t = plainText(l);
      const m = t.match(/^(.*)\(([^)]+)\)\s*$/);
      return { question: (m?.[1] ?? t).trim(), answer: (m?.[2] ?? "").trim() };
    });
  const refl = findLine(s5, /рефлексия|reflection/i);
  const homework = s5
    .filter((l) => /^(\*\*)?•?\s*(\*\*)?\s*[АВСABC]\s*:/.test(plainText(l).replace(/^•\s*/, "")) && /^(•|\*\*•)/.test(l))
    .slice(0, 3)
    .map((l, i) => ({ level: (["A", "B", "C"] as const)[i], text: plainText(l).replace(/^•?\s*[АВСABC]\s*:\s*/, "") }));
  return {
    warmup: { method: quoted(warm?.label ?? ""), text: warm ? [warm.rest] : [] },
    problem: { text: prob?.rest ?? "", call: "" },
    knowledge: { bullets: s1.filter((l) => l.startsWith("•")).slice(0, 5), caption: "", image_prompt: "" },
    picture_question: "",
    practice: { method: quoted(prac?.label ?? ""), description: prac?.rest ?? "", task: task?.rest ?? "" },
    brain_break: s3[0] ?? "",
    levels: levels.length ? levels : [{ level: "ALL", task: findLine(s4, /^(Тапсырма|Задание|Task)/i)?.rest ?? plainText(head1) }],
    quiz: { title: "", items: quizItems },
    reflection: { method: quoted(refl?.label ?? ""), text: refl?.rest.replace(/^[–—-]\s*/, "") ?? "" },
    homework,
  };
}

/**
 * ҚМЖ бойынша үлгідегі слайдтар. AI тек ҚМЖ-дағы мазмұнды слайдқа ықшамдайды
 * (жаңа тапсырма ойлап шығармайды); жауаптар ҚМЖ-ның жауап кілтінен алынады.
 */
export async function generateLessonDeck(plan: LessonPlan, opts: { useAi?: boolean } = {}): Promise<{ title: string; slides: SlideData[]; usedAi: boolean }> {
  const lang = plan.lang ?? "kk";
  let ai: DeckAi;
  let usedAi = false;
  if (opts.useAi !== false) {
    const langRule =
      lang === "ru" ? "Барлық мәтін ОРЫС тілінде." : lang === "en" ? "Барлық мәтін АҒЫЛШЫН тілінде." : "Барлық мәтін қазақ тілінде.";
    const prompt = `Сен мұғалімге сабақ презентациясын дайындайтын әдіскерсің. Төмендегі қысқа мерзімді жоспардан (ҚМЖ) слайдтарға мәтін дайында.
ҚАТАҢ ЕРЕЖЕ: мазмұнды ТЕК осы ҚМЖ-дан ал — жаңа тапсырма, сұрақ не факт ОЙЛАП ШЫҒАРМА; тапсырмалар мен сұрақтар ҚМЖ-дағыдай болсын, тек слайдқа ықшамда (оқушыға арналған, қысқа сөйлемдер). Негізгі терминдерді **...** арқылы қалың ет.
Пән: ${plan.subject}; сынып: ${plan.grade}; тақырып: ${plan.topic}.
ҚМЖ:
"""
${planText(plan)}
"""
Өрістер:
- "warmup": 1-кезеңдегі «Білімді өзектендіру» — "method" (әдіс атауы тырнақшамен, мыс. «Шынжыр»), "text" — оқушыға түсінікті 1–2 абзац (соңғысы мыс. **Өткен тақырып:** …).
- "problem": 1-кезеңдегі проблемалық жағдаят — "text" (сұрағымен), "call" — оқушыларды болжам айтуға шақыратын бір сөйлем.
- "knowledge": 2-кезеңнің жаңа мазмұны — "bullets" 3–5 пункт (анықтама, формула, мысал), "caption" — сурет асты жазуы, "image_prompt" — тақырыпты түсіндіретін схема/сурет сипаттамасы АҒЫЛШЫНША (мәтінсіз).
- "picture_question": суретпен жұмысқа арналған бір сұрақ (суретте не бейнеленген? өз сөзіңмен түсіндір).
- "practice": 3-кезең — "method" (әдіс атауы тырнақшамен), "description" (әдістің ұйымдастырылуы, бір сөйлем), "task" — **Тапсырма:** деп басталатын шарты.
- "brain_break": 4-кезеңдегі сергіту сәті, **«атауы».** деп басталсын.
- "levels": 5-кезеңдегі тапсырмалар ҚМЖ-дағы ретпен (level: A, B, C; деңгейге бөлінбесе ALL; ЕББҚ оқушысына арналған тапсырма болса SEN), "task" — тапсырма шарты.
- "quiz": 6-кезеңдегі бекіту — "title" (мыс. «Бекіту: Kahoot викторинасы»), "items" — 3 сұрақ, "answer" — 1–3 сөзден тұратын қысқа жауап.
- "reflection": 6-кезеңдегі рефлексия — "method" (тырнақшамен), "text" — оқушыға нұсқау.
- "homework": 6-кезеңдегі үй тапсырмасы (level: A, B, C; бөлінбесе бір элемент ALL).
${langRule} JSON схемаға сай қайтар.`;
    try {
      ai = await aiGenerateJson<DeckAi>(prompt, deckSchema);
      usedAi = true;
    } catch (e) {
      ai = extractFromPlan(plan);
      if (opts.useAi === true) throw e;
    }
  } else ai = extractFromPlan(plan);

  return { title: plan.topic, slides: buildSlides(plan, ai, lang), usedAi };
}

function buildSlides(plan: LessonPlan, ai: DeckAi, lang: Lang): SlideData[] {
  const T = lessonText(lang);
  const subject = subjectIn(plan.subject, lang);
  const footer = `${subject} · ${gradeIn(plan.grade, lang)} · ${plan.topic}`;
  const stage = (i: number) => {
    const st = plan.stages[i];
    return st ? `${st.name} · ${minutesOf(st.timeRange)} ${T.min}` : "";
  };
  const objectives = plan.objectives?.length ? plan.objectives : [{ code: plan.objectiveCode, text: plan.objectiveText }];
  const answers = new Map((plan.answerKey ?? []).map((k) => [k.level, k.answer]));
  const quizRes = (plan.resources ?? []).find((r) => ["kahoot", "learningapps", "wordwall", "google_forms", "mentimeter"].includes(r.platform)) ?? plan.resources?.[0];
  const imagePrompt = ai.knowledge?.image_prompt?.trim() || `Educational diagram about "${plan.topic}" for ${plan.subject}`;

  const slide = (heading: string, lesson: LessonSlide, extra: Partial<SlideData> = {}): SlideData => ({
    layout: "lesson",
    heading,
    subheading: "",
    bullets: [],
    notes: "",
    left_title: "",
    left: [],
    right_title: "",
    right: [],
    highlight: "",
    task_text: "",
    answer: "",
    ...extra,
    lesson: { footer, ...lesson },
  });

  const slides: SlideData[] = [];
  slides.push(
    slide(plan.topic, {
      kind: "title",
      tone: 1,
      kicker: T.kicker(subject, plan.grade),
      section: `${T.section}: ${plan.section || subject}`,
      info: [`${T.teacher}: ${plan.teacherName}`, `${T.value}: ${plan.valuesTitle}`],
      footer: "",
    }, { image_prompt: imagePrompt }),
  );
  slides.push(
    slide(T.goals, {
      kind: "goals",
      tone: 1,
      stage: stage(0),
      sideTitle: T.objectives,
      side: objectives.map((o) => (o.code ? `${o.code} - ${o.text}` : o.text)),
      listTitle: T.weWill,
      items: plan.goals.slice(0, 5).map((g, i) => ({ label: String(i + 1), text: g })),
    }),
  );
  const warmMethod = ai.warmup?.method?.trim();
  slides.push(
    slide(warmMethod ? `${T.warmup}: ${warmMethod}` : T.warmup, {
      kind: "warmup",
      tone: 1,
      stage: stage(0),
      text: ai.warmup?.text ?? [],
      sideTitle: plan.valuesTitle,
      side: plan.valuesQuote ? [plan.valuesQuote] : [],
    }),
  );
  if (ai.problem?.text)
    slides.push(slide(T.problem, { kind: "problem", tone: 2, stage: stage(0), text: [ai.problem.text], note: ai.problem.call ?? "" }));
  slides.push(
    slide(T.knowledge, { kind: "knowledge", tone: 1, stage: stage(1), text: ai.knowledge?.bullets ?? [], note: ai.knowledge?.caption ?? "" }, { image_prompt: imagePrompt }),
  );
  slides.push(slide(T.picture, { kind: "picture", tone: 3, stage: stage(1), note: ai.picture_question ?? "" }, { image_prompt: imagePrompt }));
  const prMethod = ai.practice?.method?.trim();
  slides.push(
    slide(prMethod ? `${T.practice}: ${prMethod}` : T.practice, {
      kind: "practice",
      tone: 1,
      stage: stage(2),
      note: ai.practice?.description ?? "",
      text: ai.practice?.task ? [ai.practice.task] : [],
    }),
  );
  if (ai.brain_break) slides.push(slide(T.break, { kind: "break", tone: 3, stage: stage(3), text: [ai.brain_break] }));

  const levels = (ai.levels ?? []).filter((l) => l.task?.trim());
  const abc = levels.filter((l) => ["A", "B", "C"].includes(l.level ?? ""));
  if (abc.length >= 2) {
    slides.push(
      slide(T.levels, {
        kind: "levels",
        tone: 6,
        stage: stage(4),
        items: abc.slice(0, 3).map((l) => ({ label: T.levelLetters[l.level!], text: T.levelWord(T.levelLetters[l.level!]), extra: T.levelDesc[l.level!] })),
        note: T.levelsNote,
      }),
    );
  }
  for (const l of levels) {
    const lv = l.level ?? "ALL";
    const heading = lv === "SEN" ? T.senTitle : lv === "ALL" ? T.allTitle : `${T.levelWord(T.levelLetters[lv])}: ${T.levelDesc[lv]}`;
    slides.push(slide(heading, { kind: "level", level: lv, tone: LEVEL_TONE[lv], stage: stage(4), text: [l.task!.trim()], answer: answers.get(lv) ?? "" }));
  }

  const quiz = (ai.quiz?.items ?? []).filter((q) => q.question?.trim()).slice(0, 3);
  if (quiz.length)
    slides.push(
      slide(ai.quiz?.title?.trim() || T.quiz, {
        kind: "quiz",
        tone: 2,
        stage: stage(5),
        items: quiz.map((q, i) => ({ label: String(i + 1), text: q.question!.trim(), extra: q.answer?.trim() ?? "" })),
        qr: quizRes?.url ?? "",
        note: quizRes ? (quizRes.platform === "custom" ? quizRes.title : platformLabel(quizRes.platform)) : "",
      }),
    );
  if (ai.reflection?.text) {
    const m = ai.reflection.method?.trim();
    slides.push(
      slide(m ? `${T.reflection}: ${m}` : T.reflection, {
        kind: "reflection",
        tone: 6,
        stage: stage(5),
        text: [ai.reflection.text],
        items: T.scale.map(([label, text]) => ({ label, text })),
      }),
    );
  }
  const hw = (ai.homework ?? []).filter((h) => h.text?.trim()).slice(0, 3);
  if (hw.length)
    slides.push(
      slide(T.homework, {
        kind: "homework",
        tone: 2,
        stage: stage(5),
        items: hw.map((h) => {
          const lv = h.level ?? "ALL";
          return { label: lv, text: lv === "ALL" ? T.homework : T.levelWord(T.levelLetters[lv]), extra: h.text!.trim() };
        }),
      }),
    );
  slides.push(slide(T.thanks, { kind: "closing", tone: 1, note: plan.valuesQuote ?? "", footer: "" }));
  return slides;
}
