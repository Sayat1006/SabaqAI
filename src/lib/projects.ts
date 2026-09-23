// Мұғалімнің жобалары (ҚМЖ, презентация, сурет, тест) Supabase-тегі `projects`
// кестесінде сақталады: RLS арқылы әр мұғалім тек өз жобаларын көреді.
// Бұрын браузерде (localStorage) сақталған жобалар бірінші кіргенде дерекқорға көшіріледі.

import type { DocData } from "./documents";
import type { LessonPlan } from "./generators";
import type { Lang } from "./lang";
import { supabase } from "./supabaseClient";

export type { SlideData } from "./slides";
import type { SlideData } from "./slides";

/** Саралау деңгейі: A — білу және түсіну, B — қолдану, C — жоғары деңгей дағдылары. */
export type TestLevel = "A" | "B" | "C";

export interface TestQuestion {
  question: string;
  options: string[];
  correctIndex: number;
  explanation: string;
  level?: TestLevel;
  /** PISA: сұрақ сүйенетін өмірлік жағдаят мәтіні (бір топ сұраққа ортақ). */
  context?: string;
}

/** Тапсырма түрі: алғашқы үшеуі — автоматты тексерілетін тест, соңғы екеуі — жазбаша тапсырмалар. */
export type TaskType = "levels" | "pisa" | "ubt" | "bzb" | "open";

/** БЖБ/ТЖБ және ашық тапсырмалар: критерий, дескрипторлар және балл. */
export interface WrittenTask {
  title: string;
  text: string;
  level: TestLevel;
  criterion: string;
  descriptors: string[];
  points: number;
  answer: string;
}

interface PresentationData {
  topic: string;
  style: string;
  title: string;
  slides: SlideData[];
  lang?: Lang;
}

interface ImageData {
  prompt: string;
  style: string;
  styleLabel: string;
  title: string;
  svg: string;
}

interface TestData {
  subject: string;
  grade: string;
  topic: string;
  difficulty: string;
  questions: TestQuestion[];
  /** Тест тексеретін оқу мақсаты (ҮОБ коды және мазмұны). */
  objective?: string;
  /** Жоқ болса — «levels» (бұрынғы тесттер). */
  taskType?: TaskType;
  /** Тек «bzb» / «open» түрлерінде. */
  tasks?: WrittenTask[];
  /** Материал тілі (жоқ болса — қазақша). */
  lang?: Lang;
}

interface Saved {
  id: string;
  savedAt: number;
}

export type SavedPresentation = Saved & PresentationData;
export type SavedImage = Saved & ImageData;
export type SavedTest = Saved & TestData;
export type SavedQmzh = Saved & { plan: LessonPlan };

export type ProjectKind = "qmzh" | "presentation" | "image" | "test" | "document";

export const KIND_LABEL: Record<ProjectKind, string> = {
  qmzh: "ҚМЖ",
  presentation: "Презентация",
  image: "Сурет",
  test: "Тапсырма",
  document: "Құжат",
};

interface ProjectRow {
  id: string;
  kind: ProjectKind;
  title: string;
  detail: string;
  data: unknown;
  created_at: string;
}

export class ProjectsError extends Error {}

function wrapError(error: { message: string; code?: string }): ProjectsError {
  // 42P01 — кесте жоқ: Supabase-те 2-жаңарту SQL-ы әлі орындалмаған.
  if (error.code === "42P01" || /relation .*projects.* does not exist|Could not find the table/i.test(error.message)) {
    return new ProjectsError(
      "Жобалар кестесі табылмады. Әкімші Supabase-те supabase/update-2-projects-profile.sql файлын орындауы керек.",
    );
  }
  return new ProjectsError(`Жобаларды сақтау/оқу мүмкін болмады: ${error.message}`);
}

const savedAt = (row: ProjectRow) => new Date(row.created_at).getTime();

/* ------------------------------------------------ бұрынғы localStorage-тен көшіру */

const LEGACY_KEYS = {
  qmzh: "sai-qmzh-history",
  presentation: "sabaq-presentations",
  image: "sabaq-images",
  test: "sabaq-tests",
  stats: "sabaq-stats",
};

function readLegacy<T>(key: string): T[] {
  try {
    const raw = localStorage.getItem(key);
    const parsed = raw ? JSON.parse(raw) : [];
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}

let migration: Promise<void> | null = null;

/** Браузерде қалған ескі жобаларды бір рет дерекқорға жүктейді; сәтті болса, жергілікті көшірмені өшіреді. */
function migrateLegacy(): Promise<void> {
  migration ??= (async () => {
    const rows: Omit<ProjectRow, "id">[] = [];
    const at = (ts: number) => new Date(ts || Date.now()).toISOString();

    for (const e of readLegacy<{ savedAt: number; data: LessonPlan }>(LEGACY_KEYS.qmzh)) {
      if (e?.data?.topic) rows.push({ kind: "qmzh", title: e.data.topic, detail: `${e.data.subject} · ${e.data.grade}`, data: e.data, created_at: at(e.savedAt) });
    }
    for (const p of readLegacy<SavedPresentation>(LEGACY_KEYS.presentation)) {
      if (p?.slides) rows.push({ kind: "presentation", title: p.title, detail: `${p.slides.length} слайд`, data: { topic: p.topic, style: p.style, title: p.title, slides: p.slides }, created_at: at(p.savedAt) });
    }
    for (const i of readLegacy<SavedImage>(LEGACY_KEYS.image)) {
      if (i?.svg) rows.push({ kind: "image", title: i.title, detail: i.styleLabel, data: { prompt: i.prompt, style: i.style, styleLabel: i.styleLabel, title: i.title, svg: i.svg }, created_at: at(i.savedAt) });
    }
    for (const t of readLegacy<SavedTest>(LEGACY_KEYS.test)) {
      if (t?.questions) rows.push({ kind: "test", title: t.topic, detail: `${t.subject} · ${t.grade} · ${t.questions.length} сұрақ`, data: { subject: t.subject, grade: t.grade, topic: t.topic, difficulty: t.difficulty, questions: t.questions }, created_at: at(t.savedAt) });
    }

    if (rows.length > 0) {
      const { error } = await supabase.from("projects").insert(rows);
      if (error) {
        migration = null; // келесі жолы қайталап көреміз
        return;
      }
    }
    try {
      Object.values(LEGACY_KEYS).forEach((k) => localStorage.removeItem(k));
    } catch {
      // localStorage қолжетімсіз болса — үнсіз өтеміз
    }
  })();
  return migration;
}

/* ------------------------------------------------------------ жалпы операциялар */

async function list(kind?: ProjectKind, limit = 200): Promise<ProjectRow[]> {
  await migrateLegacy();
  let query = supabase.from("projects").select("id, kind, title, detail, data, created_at").order("created_at", { ascending: false }).limit(limit);
  if (kind) query = query.eq("kind", kind);
  const { data, error } = await query;
  if (error) throw wrapError(error);
  return (data ?? []) as ProjectRow[];
}

async function getRow(id: string, kind: ProjectKind): Promise<ProjectRow | null> {
  const { data, error } = await supabase.from("projects").select("id, kind, title, detail, data, created_at").eq("id", id).eq("kind", kind).maybeSingle();
  if (error) throw wrapError(error);
  return (data as ProjectRow | null) ?? null;
}

async function create(kind: ProjectKind, title: string, detail: string, data: unknown): Promise<ProjectRow> {
  const { data: row, error } = await supabase
    .from("projects")
    .insert({ kind, title: title.slice(0, 300), detail: detail.slice(0, 300), data })
    .select("id, kind, title, detail, data, created_at")
    .single();
  if (error) throw wrapError(error);
  return row as ProjectRow;
}

export async function deleteProject(id: string): Promise<void> {
  const { error } = await supabase.from("projects").delete().eq("id", id);
  if (error) throw wrapError(error);
}

/* ---------------------------------------------------------------- түрлер бойынша */

const toPresentation = (r: ProjectRow): SavedPresentation => ({ id: r.id, savedAt: savedAt(r), ...(r.data as PresentationData) });
const toImage = (r: ProjectRow): SavedImage => ({ id: r.id, savedAt: savedAt(r), ...(r.data as ImageData) });
const toTest = (r: ProjectRow): SavedTest => ({ id: r.id, savedAt: savedAt(r), ...(r.data as TestData) });
const toQmzh = (r: ProjectRow): SavedQmzh => ({ id: r.id, savedAt: savedAt(r), plan: r.data as LessonPlan });

export async function savePresentation(p: PresentationData): Promise<SavedPresentation> {
  return toPresentation(await create("presentation", p.title, `${p.slides.length} слайд`, p));
}
/** Өңделген презентацияны сол жобаның үстіне сақтайды. */
export async function updatePresentation(id: string, p: PresentationData): Promise<void> {
  const { data, error } = await supabase
    .from("projects")
    .update({ title: p.title.slice(0, 300), detail: `${p.slides.length} слайд`, data: p })
    .eq("id", id)
    .select("id");
  if (error) throw wrapError(error);
  if (!data?.length) {
    throw new ProjectsError("Өзгерістер сақталмады. Әкімші Supabase-те supabase/update-3-editing-sharing.sql файлын орындауы керек.");
  }
}
export async function getPresentation(id: string): Promise<SavedPresentation | null> {
  const row = await getRow(id, "presentation");
  return row && toPresentation(row);
}

export async function saveImage(img: ImageData): Promise<SavedImage> {
  return toImage(await create("image", img.title, img.styleLabel, img));
}
export async function getImages(): Promise<SavedImage[]> {
  return (await list("image")).map(toImage);
}

export async function saveTest(t: TestData): Promise<SavedTest> {
  const n = t.tasks?.length ? `${t.tasks.length} тапсырма` : `${t.questions.length} сұрақ`;
  return toTest(await create("test", t.topic, `${t.subject} · ${t.grade} · ${n}`, t));
}
export async function getTest(id: string): Promise<SavedTest | null> {
  const row = await getRow(id, "test");
  return row && toTest(row);
}

export async function saveQmzh(plan: LessonPlan): Promise<SavedQmzh> {
  return toQmzh(await create("qmzh", plan.topic, `${plan.subject} · ${plan.grade}`, plan));
}
/** Өзгертілген ҚМЖ-ны (мыс. мұғалім қосқан сілтемелер) сол жобаның үстіне сақтайды. */
export async function updateQmzh(id: string, plan: LessonPlan): Promise<void> {
  const { data, error } = await supabase
    .from("projects")
    .update({ title: plan.topic.slice(0, 300), detail: `${plan.subject} · ${plan.grade}`, data: plan })
    .eq("id", id)
    .select("id");
  if (error) throw wrapError(error);
  if (!data?.length) {
    throw new ProjectsError("Өзгерістер сақталмады. Әкімші Supabase-те supabase/update-3-editing-sharing.sql файлын орындауы керек.");
  }
}
export async function getQmzhList(limit = 8): Promise<SavedQmzh[]> {
  return (await list("qmzh", limit)).map(toQmzh);
}
export async function getQmzh(id: string): Promise<SavedQmzh | null> {
  const row = await getRow(id, "qmzh");
  return row && toQmzh(row);
}

export type SavedDocument = Saved & DocData;
const toDocument = (r: ProjectRow): SavedDocument => ({ id: r.id, savedAt: savedAt(r), ...(r.data as DocData) });

function kindError(error: { message: string; code?: string }): ProjectsError {
  // 23514 — check constraint: «document» түрі әлі рұқсат етілмеген (7-жаңарту орындалмаған).
  if (error.code === "23514" || /projects_kind_check/.test(error.message)) {
    return new ProjectsError("Құжаттарды сақтау үшін әкімші Supabase-те supabase/update-7-docs-live.sql файлын орындауы керек.");
  }
  return wrapError(error);
}

const docDetail = (d: DocData) => [d.input.grade, d.input.lang === "ru" ? "орысша" : ""].filter(Boolean).join(" · ");

export async function saveDocument(d: DocData): Promise<SavedDocument> {
  const { data: row, error } = await supabase
    .from("projects")
    .insert({ kind: "document", title: d.title.slice(0, 300), detail: docDetail(d).slice(0, 300), data: d })
    .select("id, kind, title, detail, data, created_at")
    .single();
  if (error) throw kindError(error);
  return toDocument(row as ProjectRow);
}
export async function updateDocument(id: string, d: DocData): Promise<void> {
  const { data, error } = await supabase
    .from("projects")
    .update({ title: d.title.slice(0, 300), detail: docDetail(d).slice(0, 300), data: d })
    .eq("id", id)
    .select("id");
  if (error) throw wrapError(error);
  if (!data?.length) throw new ProjectsError("Өзгерістер сақталмады. Қайталап көріңіз.");
}
export async function getDocument(id: string): Promise<SavedDocument | null> {
  const row = await getRow(id, "document");
  return row && toDocument(row);
}
export async function getDocuments(limit = 12): Promise<SavedDocument[]> {
  return (await list("document", limit)).map(toDocument);
}

/* ------------------------------------------------------- басты бет пен «Жобалар» */

export interface RecentProject {
  id: string;
  kind: ProjectKind;
  title: string;
  detail: string;
  savedAt: number;
  to: string;
  state: unknown;
  thumb?: string;
}

const ROUTES: Record<ProjectKind, { to: string; key: string }> = {
  qmzh: { to: "/qmzh", key: "qmzhId" },
  presentation: { to: "/presentation", key: "presentationId" },
  image: { to: "/images", key: "imageId" },
  test: { to: "/tests", key: "testId" },
  document: { to: "/docs", key: "docId" },
};

function toRecent(r: ProjectRow): RecentProject {
  return {
    id: r.id,
    kind: r.kind,
    title: r.title,
    detail: r.detail,
    savedAt: savedAt(r),
    to: ROUTES[r.kind].to,
    state: { [ROUTES[r.kind].key]: r.id },
    thumb: r.kind === "image" ? svgDataUrl((r.data as ImageData).svg) : undefined,
  };
}

export async function getRecentProjects(): Promise<RecentProject[]> {
  return (await list()).map(toRecent);
}

export interface Stats {
  qmzh: number;
  slides: number;
  images: number;
  tests: number;
}

export function statsOf(projects: RecentProject[]): Stats {
  const count = (k: ProjectKind) => projects.filter((p) => p.kind === k).length;
  const slides = projects
    .filter((p) => p.kind === "presentation")
    .reduce((sum, p) => sum + (Number.parseInt(p.detail, 10) || 0), 0);
  return { qmzh: count("qmzh"), slides, images: count("image"), tests: count("test") };
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

/* ------------------------------------------------- тестті оқушыларға жіберу */

export interface TestShare {
  code: string;
  isOpen: boolean;
  /** Оқушы тапсырған соң қателерін түсіндірмесімен көреді (4-жаңарту). */
  showReview: boolean;
}

export interface TestSubmission {
  id: string;
  studentName: string;
  studentClass: string;
  answers: (number | null)[];
  score: number;
  total: number;
  createdAt: number;
}

export interface SharedTest {
  title: string;
  subject: string;
  grade: string;
  topic: string;
  objective?: string;
  taskType?: TaskType;
  lang?: Lang;
  questions: { question: string; options: string[]; level?: TestLevel | ""; context?: string }[];
}

export interface SubmitResult {
  score: number;
  total: number;
  /** Мұғалім рұқсат етсе: әр сұрақтың дұрыс жауабы мен түсіндірмесі. */
  review?: { correct: number; explanation: string }[] | null;
}

function sharingError(error: { message: string; code?: string }): ProjectsError {
  if (error.code === "42P01" || error.code === "PGRST202" || /does not exist|Could not find the (table|function)/i.test(error.message)) {
    return new ProjectsError("Тест жіберу әлі қосылмаған. Әкімші Supabase-те supabase/update-3-editing-sharing.sql файлын орындауы керек.");
  }
  return new ProjectsError(error.message);
}

export const shareLink = (code: string) => `${window.location.origin}/t/${code}`;

export async function getTestShare(projectId: string): Promise<TestShare | null> {
  let res = await supabase.from("test_shares").select("code, is_open, show_review").eq("project_id", projectId).maybeSingle();
  // 4-жаңарту әлі орындалмаса, show_review бағаны жоқ — онсыз оқимыз.
  if (res.error && /show_review/.test(res.error.message)) {
    res = await supabase.from("test_shares").select("code, is_open").eq("project_id", projectId).maybeSingle();
  }
  const { data, error } = res;
  if (error) throw sharingError(error);
  if (!data) return null;
  const row = data as { code: string; is_open: boolean; show_review?: boolean };
  return { code: row.code, isOpen: row.is_open, showReview: row.show_review ?? false };
}

export async function shareTest(projectId: string): Promise<TestShare> {
  const { data, error } = await supabase.rpc("share_test", { p_project_id: projectId });
  if (error) throw sharingError(error);
  return (await getTestShare(projectId)) ?? { code: data as string, isOpen: true, showReview: true };
}

export async function setTestShareReview(projectId: string, show: boolean): Promise<void> {
  const { error } = await supabase.rpc("set_test_share_review", { p_project_id: projectId, p_show: show });
  if (error) {
    if (error.code === "PGRST202" || /Could not find the function/i.test(error.message)) {
      throw new ProjectsError("Бұл баптау үшін әкімші Supabase-те supabase/update-4-feedback.sql файлын орындауы керек.");
    }
    throw sharingError(error);
  }
}

export async function setTestShareOpen(projectId: string, open: boolean): Promise<void> {
  const { error } = await supabase.rpc("set_test_share_open", { p_project_id: projectId, p_open: open });
  if (error) throw sharingError(error);
}

export async function getSubmissions(projectId: string): Promise<TestSubmission[]> {
  const { data, error } = await supabase
    .from("test_submissions")
    .select("id, student_name, student_class, answers, score, total, created_at")
    .eq("project_id", projectId)
    .order("created_at", { ascending: false })
    .limit(1000);
  if (error) throw sharingError(error);
  return (data ?? []).map((r) => ({
    id: r.id as string,
    studentName: r.student_name as string,
    studentClass: r.student_class as string,
    answers: (r.answers as (number | null)[]) ?? [],
    score: r.score as number,
    total: r.total as number,
    createdAt: new Date(r.created_at as string).getTime(),
  }));
}

export async function deleteSubmission(id: string): Promise<void> {
  const { error } = await supabase.from("test_submissions").delete().eq("id", id);
  if (error) throw sharingError(error);
}

/** Оқушы беті (жүйеге кірмей): сұрақтар дұрыс жауаптарсыз келеді. */
export async function getSharedTest(code: string): Promise<SharedTest | null> {
  const { data, error } = await supabase.rpc("get_shared_test", { p_code: code });
  if (error) throw sharingError(error);
  return (data as SharedTest | null) ?? null;
}

export async function submitSharedTest(code: string, name: string, className: string, answers: (number | null)[]): Promise<SubmitResult> {
  const { data, error } = await supabase.rpc("submit_test", { p_code: code, p_name: name, p_class: className, p_answers: answers });
  if (error) throw sharingError(error);
  return data as SubmitResult;
}
