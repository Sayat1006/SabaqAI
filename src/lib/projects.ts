// Мұғалімнің AI студиядағы материалдары (ҚМЖ-дан басқа: презентациялар, суреттер,
// тесттер) мен жалпы статистика. Браузерде (localStorage) сақталады.

import { getQmzhHistory, removeQmzhHistory } from "./planHistory";

export interface SlideData {
  layout: "title" | "bullets" | "two_column" | "highlight" | "quiz" | "closing";
  heading: string;
  subheading: string;
  bullets: string[];
  left_title: string;
  left: string[];
  right_title: string;
  right: string[];
  highlight: string;
  notes: string;
}

export interface SavedPresentation {
  id: string;
  savedAt: number;
  topic: string;
  style: string;
  title: string;
  slides: SlideData[];
}

export interface SavedImage {
  id: string;
  savedAt: number;
  prompt: string;
  style: string;
  styleLabel: string;
  title: string;
  svg: string;
}

export interface TestQuestion {
  question: string;
  options: string[];
  correctIndex: number;
  explanation: string;
}

export interface SavedTest {
  id: string;
  savedAt: number;
  subject: string;
  grade: string;
  topic: string;
  difficulty: string;
  questions: TestQuestion[];
}

export interface Stats {
  qmzh: number;
  slides: number;
  images: number;
  tests: number;
}

const PRESENTATIONS_KEY = "sabaq-presentations";
const IMAGES_KEY = "sabaq-images";
const TESTS_KEY = "sabaq-tests";
const STATS_KEY = "sabaq-stats";

function load<T>(key: string, fallback: T): T {
  try {
    const raw = localStorage.getItem(key);
    return raw ? (JSON.parse(raw) as T) : fallback;
  } catch {
    return fallback;
  }
}

function save(key: string, value: unknown): boolean {
  try {
    localStorage.setItem(key, JSON.stringify(value));
    return true;
  } catch {
    return false;
  }
}

export function getStats(): Stats {
  return { qmzh: 0, slides: 0, images: 0, tests: 0, ...load<Partial<Stats>>(STATS_KEY, {}) };
}

export function bumpStats(delta: Partial<Stats>) {
  const s = getStats();
  save(STATS_KEY, {
    qmzh: s.qmzh + (delta.qmzh ?? 0),
    slides: s.slides + (delta.slides ?? 0),
    images: s.images + (delta.images ?? 0),
    tests: s.tests + (delta.tests ?? 0),
  });
}

export function getPresentations(): SavedPresentation[] {
  return load<SavedPresentation[]>(PRESENTATIONS_KEY, []);
}

export function savePresentation(p: Omit<SavedPresentation, "id" | "savedAt">): SavedPresentation {
  const entry: SavedPresentation = { ...p, id: crypto.randomUUID(), savedAt: Date.now() };
  save(PRESENTATIONS_KEY, [entry, ...getPresentations()].slice(0, 30));
  bumpStats({ slides: p.slides.length });
  return entry;
}

export function removePresentation(id: string): SavedPresentation[] {
  const next = getPresentations().filter((p) => p.id !== id);
  save(PRESENTATIONS_KEY, next);
  return next;
}

export function getImages(): SavedImage[] {
  return load<SavedImage[]>(IMAGES_KEY, []);
}

/** Суреттер ~5–15 КБ SVG; localStorage толса, ең ескілерін шығарып тастаймыз. */
export function saveImage(img: Omit<SavedImage, "id" | "savedAt">): SavedImage {
  const entry: SavedImage = { ...img, id: crypto.randomUUID(), savedAt: Date.now() };
  let list = [entry, ...getImages()].slice(0, 60);
  while (!save(IMAGES_KEY, list) && list.length > 1) list = list.slice(0, -1);
  bumpStats({ images: 1 });
  return entry;
}

export function removeImage(id: string): SavedImage[] {
  const next = getImages().filter((i) => i.id !== id);
  save(IMAGES_KEY, next);
  return next;
}

export function getTests(): SavedTest[] {
  return load<SavedTest[]>(TESTS_KEY, []);
}

export function saveTest(t: Omit<SavedTest, "id" | "savedAt">): SavedTest {
  const entry: SavedTest = { ...t, id: crypto.randomUUID(), savedAt: Date.now() };
  save(TESTS_KEY, [entry, ...getTests()].slice(0, 50));
  bumpStats({ tests: 1 });
  return entry;
}

export function removeTest(id: string): SavedTest[] {
  const next = getTests().filter((t) => t.id !== id);
  save(TESTS_KEY, next);
  return next;
}

export type ProjectKind = "qmzh" | "presentation" | "image" | "test";

export const KIND_LABEL: Record<ProjectKind, string> = {
  qmzh: "ҚМЖ",
  presentation: "Презентация",
  image: "Сурет",
  test: "Тест",
};

export interface RecentProject {
  id: string;
  kind: ProjectKind;
  title: string;
  detail: string;
  savedAt: number;
  to: string;
  state?: unknown;
  thumb?: string;
}

export function getRecentProjects(): RecentProject[] {
  const qmzh: RecentProject[] = getQmzhHistory().map((e) => ({
    id: e.id,
    kind: "qmzh",
    title: e.data.topic,
    detail: `${e.data.subject} · ${e.data.grade}`,
    savedAt: e.savedAt,
    to: "/qmzh",
    state: { historyId: e.id },
  }));
  const presentations: RecentProject[] = getPresentations().map((p) => ({
    id: p.id,
    kind: "presentation",
    title: p.title,
    detail: `${p.slides.length} слайд`,
    savedAt: p.savedAt,
    to: "/presentation",
    state: { presentationId: p.id },
  }));
  const images: RecentProject[] = getImages().map((i) => ({
    id: i.id,
    kind: "image",
    title: i.title,
    detail: i.styleLabel,
    savedAt: i.savedAt,
    to: "/images",
    state: { imageId: i.id },
    thumb: svgDataUrl(i.svg),
  }));
  const tests: RecentProject[] = getTests().map((t) => ({
    id: t.id,
    kind: "test",
    title: t.topic,
    detail: `${t.subject} · ${t.grade} · ${t.questions.length} сұрақ`,
    savedAt: t.savedAt,
    to: "/tests",
    state: { testId: t.id },
  }));
  return [...qmzh, ...presentations, ...images, ...tests].sort((a, b) => b.savedAt - a.savedAt);
}

export function svgDataUrl(svg: string): string {
  return `data:image/svg+xml;charset=utf-8,${encodeURIComponent(svg)}`;
}

export function timeAgo(ts: number): string {
  const s = Math.max(0, (Date.now() - ts) / 1000);
  if (s < 60) return "жаңа ғана";
  if (s < 3600) return `${Math.floor(s / 60)} минут бұрын`;
  if (s < 86400) return `${Math.floor(s / 3600)} сағат бұрын`;
  const days = Math.floor(s / 86400);
  if (days === 1) return "Кеше";
  if (days < 7) return `${days} күн бұрын`;
  return new Date(ts).toLocaleDateString("ru-RU");
}

export function removeProject(p: Pick<RecentProject, "id" | "kind">) {
  if (p.kind === "qmzh") removeQmzhHistory(p.id);
  if (p.kind === "presentation") removePresentation(p.id);
  if (p.kind === "image") removeImage(p.id);
  if (p.kind === "test") removeTest(p.id);
}
