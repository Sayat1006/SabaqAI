// Презентация слайдтарының пішімі. Бір слайд бір «макетке» (layout) ие; әр макет
// өз өрістерін пайдаланады, қалғандары бос қалады. Ескі сақталған презентациялар
// (title/bullets/two_column/highlight/quiz/closing) да осы пішімге сай келеді.

export type SlideLayout =
  | "title"
  | "bullets"
  | "image"
  | "diagram"
  | "chart"
  | "table"
  | "two_column"
  | "highlight"
  | "timeline"
  | "quiz"
  | "task"
  | "closing";

export interface SlideData {
  layout: SlideLayout;
  heading: string;
  subheading: string;
  bullets: string[];
  notes: string;
  /** title / image: иллюстрация сипаттамасы және дайын (тазаланған) SVG. */
  image_prompt?: string;
  image_svg?: string;
  /** diagram: process — қадамдар тізбегі, cycle — айналым, hierarchy — бір негіз және тармақтар. */
  diagram_type?: "process" | "cycle" | "hierarchy";
  diagram_nodes?: string[];
  /** chart: тек нақты, жалпыға белгілі сандар (мыс. ауаның құрамы). */
  chart_type?: "bar" | "pie";
  chart_labels?: string[];
  chart_values?: number[];
  chart_unit?: string;
  /** table */
  table_headers?: string[];
  table_rows?: { cells: string[] }[];
  /** two_column */
  left_title: string;
  left: string[];
  right_title: string;
  right: string[];
  /** highlight: басты анықтама/формула. */
  highlight: string;
  /** timeline: оқиғалар немесе кезеңдер. */
  timeline?: { label: string; text: string }[];
  /** quiz: бір сұрақ, нұсқалар және дұрыс жауап. */
  question?: string;
  options?: string[];
  correct_index?: number;
  explanation?: string;
  /** task: тапсырма шарты, орындау қадамдары (bullets) және жауабы. */
  task_text?: string;
  answer?: string;
}

const LAYOUTS: SlideLayout[] = ["title", "bullets", "image", "diagram", "chart", "table", "two_column", "highlight", "timeline", "quiz", "task", "closing"];

const strs = (v: unknown, max = 8): string[] =>
  Array.isArray(v) ? v.filter((x) => typeof x === "string" && x.trim()).map((x: string) => x.trim()).slice(0, max) : [];
const str = (v: unknown) => (typeof v === "string" ? v.trim() : "");

/** AI жауабын қауіпсіз пішімге келтіреді: бос/сәйкессіз өрістерді түзетеді, жарамсыз слайдты қарапайым макетке ауыстырады. */
export function normalizeSlide(raw: Partial<SlideData> & Record<string, unknown>): SlideData {
  let layout: SlideLayout = LAYOUTS.includes(raw.layout as SlideLayout) ? (raw.layout as SlideLayout) : "bullets";
  const s: SlideData = {
    layout,
    heading: str(raw.heading),
    subheading: str(raw.subheading),
    bullets: strs(raw.bullets, 6),
    notes: str(raw.notes),
    image_prompt: str(raw.image_prompt),
    image_svg: str(raw.image_svg) || undefined,
    diagram_type: (["process", "cycle", "hierarchy"] as const).find((t) => t === raw.diagram_type) ?? "process",
    diagram_nodes: strs(raw.diagram_nodes, 6),
    chart_type: raw.chart_type === "pie" ? "pie" : "bar",
    chart_labels: strs(raw.chart_labels, 8),
    chart_values: Array.isArray(raw.chart_values) ? raw.chart_values.map(Number).filter((n) => Number.isFinite(n) && n >= 0).slice(0, 8) : [],
    chart_unit: str(raw.chart_unit),
    table_headers: strs(raw.table_headers, 5),
    table_rows: Array.isArray(raw.table_rows)
      ? raw.table_rows
          .map((r) => ({ cells: strs((r as { cells?: unknown })?.cells ?? r, 5) }))
          .filter((r) => r.cells.length)
          .slice(0, 6)
      : [],
    left_title: str(raw.left_title),
    left: strs(raw.left, 5),
    right_title: str(raw.right_title),
    right: strs(raw.right, 5),
    highlight: str(raw.highlight),
    timeline: Array.isArray(raw.timeline)
      ? raw.timeline
          .map((t) => ({ label: str((t as { label?: unknown })?.label), text: str((t as { text?: unknown })?.text) }))
          .filter((t) => t.label || t.text)
          .slice(0, 5)
      : [],
    question: str(raw.question),
    options: strs(raw.options, 4),
    correct_index: Number.isInteger(raw.correct_index) ? Number(raw.correct_index) : 0,
    explanation: str(raw.explanation),
    task_text: str(raw.task_text),
    answer: str(raw.answer),
  };

  // Мазмұны жетіспейтін макеттерді қарапайымға ауыстырамыз, сонда бос слайд көрінбейді.
  const fallback = (): SlideLayout => (s.bullets.length ? "bullets" : s.highlight ? "highlight" : "bullets");
  if (layout === "diagram" && (s.diagram_nodes?.length ?? 0) < 2) layout = fallback();
  if (layout === "chart" && (Math.min(s.chart_labels!.length, s.chart_values!.length) < 2 || s.chart_values!.every((v) => v === 0))) layout = fallback();
  if (layout === "table" && (!s.table_headers?.length || !s.table_rows?.length)) layout = fallback();
  if (layout === "timeline" && (s.timeline?.length ?? 0) < 2) layout = fallback();
  if (layout === "quiz" && (!s.question || (s.options?.length ?? 0) < 2)) layout = s.bullets.length ? "quiz" : fallback();
  if (layout === "task" && !s.task_text && !s.bullets.length) layout = fallback();
  if (layout === "two_column" && !s.left.length && !s.right.length) layout = fallback();
  s.layout = layout;
  if (s.options && s.correct_index! >= s.options.length) s.correct_index = 0;
  const n = Math.min(s.chart_labels!.length, s.chart_values!.length);
  s.chart_labels = s.chart_labels!.slice(0, n);
  s.chart_values = s.chart_values!.slice(0, n);
  return s;
}
