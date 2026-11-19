// Сабақтағы сауалнамалар: бағдаршам, өзін-өзі бағалау, рефлексия. Мұғалім QR көрсетеді,
// оқушылар телефоннан 6 таңбалы кодпен (тіркелусіз) жауап береді. Барлық тексеру
// Supabase-тегі функцияларда (15-жаңарту). Мұғалім экраны күйді 2 секунд сайын сұрайды.

import { tr } from "../i18n";
import type { Lang } from "./lang";
import { supabase } from "./supabaseClient";

export type PollKind = "traffic" | "self" | "reflection" | "rubric";

/** Дескриптор бойынша бағалау әдісі: өзін-өзі, жұбын (өзара), басқа топты. */
export type RubricMethod = "self" | "peer" | "group";

export interface Descriptor {
  text: string;
  points: number;
}

export interface PollOption {
  emoji: string;
  label: string;
}

export interface PollResponse {
  name: string | null;
  choice: number | null;
  texts: string[] | null;
  /** rubric: кім/қай топ бағаланды, бағалаушының тобы, әр дескриптор бойынша балл, пікір. */
  target?: string | null;
  group?: string | null;
  marks?: number[] | null;
  comment?: string | null;
  at: string;
}

export interface PollState {
  id: string;
  code: string;
  kind: PollKind;
  method: string;
  title: string;
  options: PollOption[];
  prompts: string[];
  descriptors?: Descriptor[];
  targets?: string[];
  ask_name: boolean;
  lang: Lang;
  is_open: boolean;
  created_at: string;
  responses: PollResponse[];
}

export interface PublicPoll {
  kind: PollKind;
  method: string;
  title: string;
  options: PollOption[];
  prompts: string[];
  descriptors?: Descriptor[];
  targets?: string[];
  ask_name: boolean;
  lang: Lang;
  is_open: boolean;
  answer: { name: string | null; choice: number | null; texts: string[] | null; marks?: number[] | null; comment?: string | null } | null;
  /** Жұптық/топтық бағалауда осы телефоннан бағаланғандар. */
  assessed?: { target: string; group: string | null; name: string | null }[];
}

export interface PollListItem {
  id: string;
  code: string;
  kind: PollKind;
  method: string;
  title: string;
  created_at: string;
}

/** Сервер қайтаратын қате кодтары. */
export class PollError extends Error {
  code: string;
  constructor(code: string, message?: string) {
    super(message ?? code);
    this.code = code;
  }
}

const KNOWN = ["not_found", "closed", "full", "bad_name", "bad_answer", "bad_target", "bad_poll", "too_many", "not_allowed"];

function wrap(error: { message: string; code?: string }): PollError {
  if (error.code === "PGRST202" || error.code === "42P01" || /Could not find the (function|table)|does not exist/i.test(error.message)) {
    return new PollError("setup", tr("QR сауалнамалар әлі қосылмаған. Әкімші Supabase-те supabase/update-15-class-polls.sql файлын орындауы керек."));
  }
  const code = KNOWN.find((k) => error.message.includes(k));
  if (code) return new PollError(code);
  if (/Failed to fetch|NetworkError|network/i.test(error.message)) return new PollError("network");
  return new PollError("unknown", error.message);
}

/** Тарих тізімін жаңарту үшін (жаңа сауалнама жасалғанда). */
export const pollsChanged = () => window.dispatchEvent(new Event("ainur-polls-changed"));

export const pollLink = (code: string) => `${window.location.origin}/p/${code}`;

export async function createPoll(p: {
  kind: PollKind;
  method: string;
  title: string;
  options?: PollOption[];
  prompts?: string[];
  descriptors?: Descriptor[];
  targets?: string[];
  askName: boolean;
  lang: Lang;
}): Promise<{ id: string; code: string }> {
  const args: Record<string, unknown> = {
    p_kind: p.kind,
    p_method: p.method,
    p_title: p.title,
    p_options: p.options ?? [],
    p_prompts: p.prompts ?? [],
    p_ask_name: p.askName,
    p_lang: p.lang,
  };
  // Бағалау өрістері тек «rubric» үшін жіберіледі — 16-жаңарту орындалмаған базада басқа сауалнамалар бұрынғыдай жұмыс істейді.
  if (p.kind === "rubric") Object.assign(args, { p_descriptors: p.descriptors ?? [], p_targets: p.targets ?? [] });
  const { data, error } = await supabase.rpc("poll_create", args);
  if (error) {
    if (p.kind === "rubric" && (error.code === "PGRST202" || /Could not find the function/i.test(error.message))) {
      throw new PollError("setup", tr("Дескриптор бойынша бағалау әлі қосылмаған. Әкімші Supabase-те supabase/update-16-rubric-assessment.sql файлын орындауы керек."));
    }
    throw wrap(error);
  }
  return data as { id: string; code: string };
}

export async function getPollState(id: string): Promise<PollState> {
  const { data, error } = await supabase.rpc("poll_host_state", { p_poll: id });
  if (error) throw wrap(error);
  return data as PollState;
}

export async function pollControl(id: string, action: "close" | "open" | "reset"): Promise<void> {
  const { error } = await supabase.rpc("poll_control", { p_poll: id, p_action: action });
  if (error) throw wrap(error);
}

export async function listPolls(limit = 20): Promise<PollListItem[]> {
  const { data, error } = await supabase.from("class_polls").select("id, code, kind, method, title, created_at").order("created_at", { ascending: false }).limit(limit);
  if (error) throw wrap(error);
  return (data ?? []) as PollListItem[];
}

export async function deletePoll(id: string): Promise<void> {
  const { error } = await supabase.from("class_polls").delete().eq("id", id);
  if (error) throw wrap(error);
}

export async function getPublicPoll(code: string, device: string): Promise<PublicPoll> {
  const { data, error } = await supabase.rpc("poll_get", { p_code: code, p_device: device });
  if (error) throw wrap(error);
  return data as PublicPoll;
}

export async function answerPoll(
  code: string,
  device: string,
  a: { name?: string; choice?: number; texts?: string[]; target?: string; group?: string; marks?: number[]; comment?: string },
): Promise<void> {
  const args: Record<string, unknown> = {
    p_code: code,
    p_device: device,
    p_name: a.name ?? null,
    p_choice: a.choice ?? null,
    p_texts: a.texts ?? null,
  };
  if (a.marks) Object.assign(args, { p_target: a.target ?? null, p_group: a.group ?? null, p_marks: a.marks, p_comment: a.comment ?? null });
  const { error } = await supabase.rpc("poll_answer", args);
  if (error) throw wrap(error);
}

/** Осы телефонның тұрақты идентификаторы (бір сауалнамаға бір жауап). */
export function deviceId(): string {
  const key = "ainur-poll-device";
  try {
    let id = localStorage.getItem(key);
    if (!id) {
      id = crypto.randomUUID();
      localStorage.setItem(key, id);
    }
    return id;
  } catch {
    return crypto.randomUUID();
  }
}

/* ------------------------------------------------------------ әдістер */

/** Таңдау нұсқаларының түстері (индекс бойынша). */
export const OPTION_TONES = {
  traffic: ["bg-emerald-500", "bg-amber-400", "bg-rose-500"],
  thumbs: ["bg-emerald-500", "bg-amber-400", "bg-rose-500"],
  scale: ["bg-rose-500", "bg-orange-400", "bg-amber-400", "bg-lime-500", "bg-emerald-500"],
  ladder: ["bg-sky-500", "bg-teal-500", "bg-emerald-500", "bg-violet-600"],
} as Record<string, string[]>;

/** Өзін-өзі бағалау әдістері (нұсқалар мұғалім таңдаған тілде жасалады). */
export const SELF_METHODS = (L: (s: string) => string) => [
  {
    key: "thumbs",
    name: L("Бас бармақ"),
    question: L("Тақырыпты қаншалықты түсіндің?"),
    options: [
      { emoji: "👍", label: L("Бәрі түсінікті") },
      { emoji: "👌", label: L("Біраз сұрағым бар") },
      { emoji: "👎", label: L("Түсінбедім, көмек керек") },
    ],
  },
  {
    key: "scale",
    name: L("1–5 шкала"),
    question: L("Бүгінгі сабақтағы жұмысыңды 1-ден 5-ке дейін бағала"),
    options: [
      { emoji: "1", label: L("Мүлде түсінбедім") },
      { emoji: "2", label: L("Аз түсіндім") },
      { emoji: "3", label: L("Жартылай түсіндім") },
      { emoji: "4", label: L("Жақсы түсіндім") },
      { emoji: "5", label: L("Өзгелерге түсіндіре аламын") },
    ],
  },
  {
    key: "ladder",
    name: L("Баспалдақ"),
    question: L("Баспалдақтың қай сатысына жеттің?"),
    options: [
      { emoji: "1️⃣", label: L("Білемін") },
      { emoji: "2️⃣", label: L("Түсінемін") },
      { emoji: "3️⃣", label: L("Қолдана аламын") },
      { emoji: "4️⃣", label: L("Түсіндіре аламын") },
    ],
  },
];

/** Бағдаршам нұсқалары. */
export const TRAFFIC_OPTIONS = (L: (s: string) => string): PollOption[] => [
  { emoji: "🟢", label: L("Түсіндім") },
  { emoji: "🟡", label: L("Сұрағым бар") },
  { emoji: "🔴", label: L("Көмек керек") },
];

/** «Бір сөзбен» әдісіндегі жауаптардан сөз бұлты: [сөз, саны] (жиілігі бойынша). */
export function wordCloud(texts: string[]): [string, number][] {
  const counts = new Map<string, { word: string; n: number }>();
  for (const t of texts) {
    const w = t.trim().replace(/[.,!?;:«»"()]+/g, "").replace(/\s+/g, " ");
    if (!w) continue;
    const key = w.toLocaleLowerCase();
    const cur = counts.get(key);
    if (cur) cur.n++;
    else counts.set(key, { word: w, n: 1 });
  }
  return [...counts.values()].sort((a, b) => b.n - a.n).slice(0, 40).map((x) => [x.word, x.n]);
}

/* ------------------------------------------------- дескриптор бойынша бағалау */

/** Бір бағалаудың жалпы балы. */
export const rubricTotal = (marks: number[] | null | undefined) => (marks ?? []).reduce((a, b) => a + (Number(b) || 0), 0);
export const rubricMax = (d: Descriptor[] | undefined) => (d ?? []).reduce((a, x) => a + x.points, 0);

export interface RubricRow {
  /** Бағаланған оқушы немесе топ. */
  target: string;
  /** Бағалау саны. */
  count: number;
  /** Әр дескриптор бойынша орташа балл. */
  avg: number[];
  /** Орташа жалпы балл. */
  total: number;
  reviews: { by: string; group: string | null; marks: number[]; comment: string }[];
}

/** Нәтижелерді бағаланғандар бойынша топтастыру (өзін-өзі бағалауда — бағалаушының өзі). */
export function rubricRows(st: PollState): RubricRow[] {
  const d = st.descriptors ?? [];
  const map = new Map<string, RubricRow>();
  for (const r of st.responses) {
    const target = (st.method === "self" ? r.name : r.target)?.trim() || "—";
    const marks = d.map((_, i) => Number(r.marks?.[i]) || 0);
    const row = map.get(target) ?? { target, count: 0, avg: d.map(() => 0), total: 0, reviews: [] };
    row.count++;
    row.reviews.push({ by: r.name ?? "", group: r.group ?? null, marks, comment: r.comment ?? "" });
    map.set(target, row);
  }
  for (const row of map.values()) {
    row.avg = d.map((_, i) => row.reviews.reduce((a, x) => a + x.marks[i], 0) / row.count);
    row.total = row.avg.reduce((a, b) => a + b, 0);
  }
  const order = st.targets ?? [];
  return [...map.values()].sort((a, b) => {
    const ia = order.indexOf(a.target);
    const ib = order.indexOf(b.target);
    if (ia >= 0 && ib >= 0) return ia - ib;
    return a.target.localeCompare(b.target);
  });
}

/**
 * ҚМЖ-дағы дескрипторлар: «Бағалау (дескрипторлар)» ұяшығындағы пункттер және ескі жоспарлардағы
 * тапсырма критерийлері. «– 2 балл» сияқты балл жазылса, ол да алынады.
 */
export function planDescriptors(plan: {
  stages?: { name: string; purpose?: string; timeRange?: string; rows: { assessment?: string[]; assessmentDetail?: string }[] }[];
  tasks?: { title: string; criteria?: { descriptors: string[] }[] }[];
}): { stage: string; text: string; points: number }[] {
  const out: { stage: string; text: string; points: number }[] = [];
  const clean = (s: string) => s.replace(/\*\*/g, "").replace(/^\s*[•●▪◦-]\s*/, "").trim();
  for (const st of plan.stages ?? []) {
    const stage = st.purpose ? `${st.name} — ${st.purpose}` : st.name;
    for (const row of st.rows ?? []) {
      for (const raw of row.assessment ?? []) {
        let t = clean(raw);
        if (!t || /^(Дескриптор|Дескрипторы|Descriptors?)\s*:?$/i.test(t) || /^(Шкала|Scale)/i.test(t) || /^\d+\s*(балл|балла|баллов|points?)\.?$/i.test(t)) continue;
        if (/^(Қалыптастырушы бағалау|Формативное оценивание|Formative assessment)/i.test(t) || t === "–") continue;
        let points = 1;
        const m = t.match(/[–—-]\s*(\d+)\s*(балл|балла|баллов|points?)\.?\s*$/i);
        if (m) {
          points = Math.min(Math.max(Number(m[1]), 1), 10);
          t = t.slice(0, m.index).trim();
        }
        t = t.replace(/^[АВСABC]\s*:\s*/, "").replace(/[;.]\s*$/, "");
        if (t.length >= 4) out.push({ stage, text: t, points });
      }
    }
  }
  for (const task of plan.tasks ?? []) {
    for (const c of task.criteria ?? []) for (const d of c.descriptors) if (d.trim()) out.push({ stage: task.title, text: clean(d), points: 1 });
  }
  return out;
}
