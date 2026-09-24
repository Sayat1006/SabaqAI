// Сабақ кестесі: мұғалімнің апталық кестесі (күн, уақыт, пән, сынып).
// Кесте КТЖ-мен байланысады: белгілі бір күнгі сабақтың тақырыбы сол пән/сыныптың
// КТЖ-сындағы осы күнге қойылған жолынан алынады.

import { tr, uiLang, uiLocale } from "../i18n";
import type { KtzhRow } from "./ktzh";
import { getKtzhList, type SavedKtzh } from "./projects";
import { supabase } from "./supabaseClient";

export interface Slot {
  id: string;
  /** Дүйсенбі=1 … Сенбі=6 (Date.getDay() сияқты). */
  day: number;
  /** «08:00» */
  time: string;
  subject: string;
  /** «7-сынып» */
  grade: string;
  /** Сынып литері: «А», «Ә»… */
  letter: string;
}

export const SCHOOL_DAYS = [1, 2, 3, 4, 5, 6];
/** Қоңырау кестесі (жаңа сабақ қосқанда келесі уақыт ұсынылады). */
export const BELLS = ["08:00", "08:55", "09:50", "10:55", "11:50", "12:45", "13:40", "14:35", "15:30", "16:25", "17:20"];

const DAY_NAMES = ["Жексенбі", "Дүйсенбі", "Сейсенбі", "Сәрсенбі", "Бейсенбі", "Жұма", "Сенбі"];
const KK_MONTHS = ["қаңтар", "ақпан", "наурыз", "сәуір", "мамыр", "маусым", "шілде", "тамыз", "қыркүйек", "қазан", "қараша", "желтоқсан"];

export const dayName = (d: number) => tr(DAY_NAMES[d]);
/** «24 қыркүйек» / «24 сентября» / «24 September». */
export const dayMonth = (d: Date) =>
  uiLang === "kk" ? `${d.getDate()} ${KK_MONTHS[d.getMonth()]}` : d.toLocaleDateString(uiLocale, { day: "numeric", month: "long" });

/** «7-сынып» + «А» → «7А». */
export const className = (s: Pick<Slot, "grade" | "letter">) => `${parseInt(s.grade, 10) || s.grade}${s.letter}`;

const pad = (n: number) => String(n).padStart(2, "0");
/** КТЖ-дағы пішім: «кк.аа.жжжж». */
export const ktzhDate = (d: Date) => `${pad(d.getDate())}.${pad(d.getMonth() + 1)}.${d.getFullYear()}`;

export const sortSlots = (slots: Slot[]) => [...slots].sort((a, b) => a.day - b.day || a.time.localeCompare(b.time));

export const newSlotId = () => Math.random().toString(36).slice(2, 10);

/** Берілген аптаның дүйсенбісі. */
export function mondayOf(d: Date): Date {
  const m = new Date(d.getFullYear(), d.getMonth(), d.getDate());
  m.setDate(m.getDate() - ((m.getDay() + 6) % 7));
  return m;
}

export function dateOfWeekday(monday: Date, day: number): Date {
  const d = new Date(monday);
  d.setDate(d.getDate() + day - 1);
  return d;
}

function setupError(message: string) {
  if (/lesson_schedules/.test(message) && /(does not exist|Could not find|42P01|schema cache)/i.test(message)) {
    return new Error(tr("Сабақ кестесінің дерекқор кестесі табылмады. Әкімші Supabase-те supabase/update-10-schedule.sql файлын орындауы керек."));
  }
  return new Error(tr("Кестені сақтау/оқу мүмкін болмады: {msg}", { msg: message }));
}

function clean(raw: unknown): Slot[] {
  if (!Array.isArray(raw)) return [];
  return raw
    .filter((s): s is Slot => !!s && typeof s === "object" && typeof (s as Slot).day === "number" && typeof (s as Slot).subject === "string")
    .map((s) => ({ id: s.id || newSlotId(), day: s.day, time: s.time ?? "", subject: s.subject, grade: s.grade ?? "", letter: s.letter ?? "" }));
}

export async function loadSchedule(): Promise<Slot[]> {
  const { data, error } = await supabase.from("lesson_schedules").select("slots").maybeSingle();
  if (error) throw setupError(error.message);
  return sortSlots(clean(data?.slots));
}

export async function saveSchedule(slots: Slot[]): Promise<void> {
  const { data: auth } = await supabase.auth.getSession();
  const userId = auth.session?.user.id;
  if (!userId) throw new Error(tr("Жүйеге қайта кіріңіз."));
  const { error } = await supabase
    .from("lesson_schedules")
    .upsert({ user_id: userId, slots: sortSlots(slots), updated_at: new Date().toISOString() }, { onConflict: "user_id" });
  if (error) throw setupError(error.message);
}

export interface Lesson {
  slot: Slot;
  date: Date;
  plan?: SavedKtzh;
  row?: KtzhRow;
}

/**
 * Берілген күнгі сабақтар және олардың КТЖ-дағы тақырыбы.
 * Бір күнде бір сыныпқа бір пәннен екі сабақ болса, КТЖ-дағы сол күннің 1-, 2-жолы беріледі.
 */
export function lessonsOn(date: Date, slots: Slot[], plans: SavedKtzh[]): Lesson[] {
  const key = ktzhDate(date);
  const seen = new Map<string, number>();
  return sortSlots(slots.filter((s) => s.day === date.getDay())).map((slot) => {
    const k = `${slot.subject}|${slot.grade}|${slot.letter}`;
    const n = seen.get(k) ?? 0;
    seen.set(k, n + 1);
    // Сол пән/сыныптың КТЖ-лары (ең жаңасы бірінші); бүгінгі күн бар жолдарды жинаймыз.
    const hits: { plan: SavedKtzh; row: KtzhRow }[] = [];
    for (const plan of plans) {
      if (plan.subject !== slot.subject || plan.grade !== slot.grade) continue;
      for (const row of plan.rows) if (row.date === key) hits.push({ plan, row });
      if (hits.length) break;
    }
    const hit = hits[Math.min(n, hits.length - 1)];
    return { slot, date, plan: hit?.plan, row: hit?.row };
  });
}

/** Бүгін сабақ болмаса — алдағы 7 күндегі сабағы бар алғашқы күн. */
export function nextSchoolDay(from: Date, slots: Slot[]): Date | null {
  const days = new Set(slots.map((s) => s.day));
  for (let i = 0; i < 7; i++) {
    const d = new Date(from.getFullYear(), from.getMonth(), from.getDate() + i);
    if (days.has(d.getDay())) return d;
  }
  return null;
}

export async function loadScheduleWithPlans(): Promise<{ slots: Slot[]; plans: SavedKtzh[] }> {
  const slots = await loadSchedule();
  // КТЖ кестесі жоқ болса да кесте жұмыс істей береді.
  const plans = slots.length ? await getKtzhList(60).catch(() => []) : [];
  return { slots, plans };
}

/** КТЖ жолынан ҚМЖ бетіне толтырылған өрістер. */
export const qmzhPrefill = (l: Lesson) =>
  l.plan && l.row
    ? { subject: l.plan.subject, grade: l.plan.grade, topic: l.row.topic, objectives: l.row.objectives, date: l.row.date, lang: l.plan.lang, section: l.row.section }
    : { subject: l.slot.subject, grade: l.slot.grade, topic: "", objectives: "", date: ktzhDate(l.date) };
