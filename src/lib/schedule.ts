// Сабақ кестесі: тұрақты апталық уақыт кестесі (TimetableSlot) + нақты
// күндерге байланысқан сабақтар (ScheduledLesson). Деректер осы браузерде
// (localStorage) сақталады — bilimclass.kz-тегі "Сабақ кестесі" мен
// "Тақырыптық жоспарлау" модульдерінің ықшам аналогы.

import type { KtjPlan } from "./generators";
import type { CtjRow } from "./thematicPlan";

export interface TimetableSlot {
  id: string;
  dayOfWeek: number; // 1 = Дүйсенбі ... 6 = Сенбі
  startTime: string; // "08:50"
  endTime: string; // "09:35"
  subject: string;
  className: string;
}

// Сабақ кестесі: 1-ауысым 8:00-де, 2-ауысым (түскі) 13:30-да басталады.
// Әр сабақ 45 минут, ауысымдар арасындағы үзіліс 5 минут, ал 3-сабақтан
// кейін 10 минуттық ұзақ үзіліс (қоңырау) болады.
export interface Period {
  id: number; // 1-16, барлық ауысымдар бойынша бірегей (кесте жолының кілті)
  shift: 1 | 2;
  lessonNumber: number; // ауысым ішіндегі реті (1-8)
  start: string;
  end: string;
}

const LESSON_MIN = 45;
const SHORT_BREAK_MIN = 5;
const LONG_BREAK_AFTER_LESSON = 3;
const LONG_BREAK_MIN = 10;
const LESSONS_PER_SHIFT = 8;
const SHIFT_1_START_MIN = 8 * 60; // 08:00
const SHIFT_2_START_MIN = 13 * 60 + 30; // 13:30

function minutesToHHMM(total: number): string {
  const h = Math.floor(total / 60);
  const m = total % 60;
  return `${String(h).padStart(2, "0")}:${String(m).padStart(2, "0")}`;
}

function buildShiftPeriods(shift: 1 | 2, startMinutes: number, idOffset: number): Period[] {
  const periods: Period[] = [];
  let cursor = startMinutes;
  for (let i = 1; i <= LESSONS_PER_SHIFT; i++) {
    const end = cursor + LESSON_MIN;
    periods.push({ id: idOffset + i, shift, lessonNumber: i, start: minutesToHHMM(cursor), end: minutesToHHMM(end) });
    cursor = end + (i === LONG_BREAK_AFTER_LESSON ? LONG_BREAK_MIN : SHORT_BREAK_MIN);
  }
  return periods;
}

export const PERIOD_SLOTS: Period[] = [
  ...buildShiftPeriods(1, SHIFT_1_START_MIN, 0),
  ...buildShiftPeriods(2, SHIFT_2_START_MIN, LESSONS_PER_SHIFT),
];

function toMinutes(hhmm: string): number {
  const [h, m] = hhmm.split(":").map(Number);
  return (h || 0) * 60 + (m || 0);
}

// Слоттың бастау уақыты бойынша ең жақын сабақ уақытын табады (сабақ реті
// сақталмаған ескі жазбалар үшін де жұмыс істеу үшін).
export function periodForSlot(slot: Pick<TimetableSlot, "startTime">): Period {
  const exact = PERIOD_SLOTS.find((p) => p.start === slot.startTime);
  if (exact) return exact;
  let closest = PERIOD_SLOTS[0];
  let closestDiff = Infinity;
  for (const p of PERIOD_SLOTS) {
    const diff = Math.abs(toMinutes(p.start) - toMinutes(slot.startTime));
    if (diff < closestDiff) {
      closest = p;
      closestDiff = diff;
    }
  }
  return closest;
}

export type LessonStatus = "planned" | "done";

export interface ScheduledLesson {
  id: string;
  date: string; // ISO "2026-09-22"
  slotId: string | null;
  subject: string;
  className: string;
  startTime: string;
  endTime: string;
  topic: string;
  homework: string;
  status: LessonStatus;
  ktjSource?: { subject: string; grade: string; lessonNumber: number };
}

export const WEEKDAY_NAMES = ["Дүйсенбі", "Сейсенбі", "Сәрсенбі", "Бейсенбі", "Жұма", "Сенбі"];

const TIMETABLE_KEY = "sai-timetable";
const SCHEDULE_KEY = "sai-schedule";

function uid(): string {
  return crypto.randomUUID();
}

function load<T>(key: string): T[] {
  try {
    const raw = localStorage.getItem(key);
    return raw ? (JSON.parse(raw) as T[]) : [];
  } catch {
    return [];
  }
}

function save<T>(key: string, list: T[]) {
  try {
    localStorage.setItem(key, JSON.stringify(list));
  } catch {
    // сақтау мүмкін болмаса үнсіз өтеміз
  }
}

export function getTimetable(): TimetableSlot[] {
  return load<TimetableSlot>(TIMETABLE_KEY);
}

export function saveTimetable(slots: TimetableSlot[]) {
  save(TIMETABLE_KEY, slots);
}

export function addTimetableSlot(slot: Omit<TimetableSlot, "id">): TimetableSlot[] {
  const next = [...getTimetable(), { ...slot, id: uid() }];
  saveTimetable(next);
  return next;
}

export function removeTimetableSlot(id: string): TimetableSlot[] {
  const next = getTimetable().filter((s) => s.id !== id);
  saveTimetable(next);
  return next;
}

export function getScheduledLessons(): ScheduledLesson[] {
  return load<ScheduledLesson>(SCHEDULE_KEY);
}

export function saveScheduledLessons(lessons: ScheduledLesson[]) {
  save(SCHEDULE_KEY, lessons);
}

// Бір күн/слот бойынша сабақты құрады немесе жаңартады (қайта жүктегенде қайталанбас үшін).
export function upsertScheduledLesson(entry: ScheduledLesson): ScheduledLesson[] {
  const list = getScheduledLessons();
  const idx = list.findIndex((l) => l.date === entry.date && l.slotId === entry.slotId && l.slotId !== null);
  const next = idx >= 0 ? list.map((l, i) => (i === idx ? { ...entry, id: l.id } : l)) : [...list, entry];
  saveScheduledLessons(next);
  return next;
}

function toIsoDate(d: Date): string {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${y}-${m}-${day}`;
}

function isoWeekday(d: Date): number {
  const js = d.getDay(); // 0 = Sunday
  return js === 0 ? 7 : js;
}

// Берілген күн енетін аптаның Дүйсенбі-Сенбі аралығындағы 6 ISO-күнін қайтарады.
export function getWeekDates(anchorIso: string): string[] {
  const anchor = new Date(anchorIso + "T00:00:00");
  const monday = new Date(anchor);
  monday.setDate(anchor.getDate() - (isoWeekday(anchor) - 1));
  return Array.from({ length: 6 }, (_, i) => {
    const d = new Date(monday);
    d.setDate(monday.getDate() + i);
    return toIsoDate(d);
  });
}

export function addDaysIso(iso: string, days: number): string {
  const d = new Date(iso + "T00:00:00");
  d.setDate(d.getDate() + days);
  return toIsoDate(d);
}

export function todayIso(): string {
  return toIsoDate(new Date());
}

// Intl-дің "kk-KZ" локалі кейбір браузерлерде толық қолдау таппай, АҚШ-тың
// MM/DD/YYYY ретін қайтаруы мүмкін, сондықтан ДД.АА.ЖЖЖЖ форматын қолмен
// құрастырамыз.
export function formatIsoHuman(iso: string): string {
  const d = new Date(iso + "T00:00:00");
  const dd = String(d.getDate()).padStart(2, "0");
  const mm = String(d.getMonth() + 1).padStart(2, "0");
  return `${dd}.${mm}.${d.getFullYear()}`;
}

// КТЖ жоспарындағы барлық сабақтарды, таңдалған апталық слоттарға сай,
// нақты күндерге орналастырады (слоттың сабақ күні келгенде — келесі сабақ).
export function projectKtjOntoCalendar(plan: KtjPlan, slots: TimetableSlot[], startIso: string): ScheduledLesson[] {
  const matchingSlots = slots.filter((s) => s.subject === plan.subject);
  if (matchingSlots.length === 0) return [];

  const flatLessons = plan.weeks.flatMap((w) => w.lessons);
  const results: ScheduledLesson[] = [];
  let cursor = startIso;
  let idx = 0;
  let guard = 0;

  while (idx < flatLessons.length && guard < 3000) {
    guard++;
    const dow = isoWeekday(new Date(cursor + "T00:00:00"));
    const slot = matchingSlots.find((s) => s.dayOfWeek === dow);
    if (slot) {
      const lesson = flatLessons[idx];
      results.push({
        id: uid(),
        date: cursor,
        slotId: slot.id,
        subject: slot.subject,
        className: slot.className,
        startTime: slot.startTime,
        endTime: slot.endTime,
        topic: lesson.topic,
        homework: "",
        status: "planned",
        ktjSource: { subject: plan.subject, grade: plan.grade, lessonNumber: lesson.globalNumber },
      });
      idx++;
    }
    cursor = addDaysIso(cursor, 1);
  }

  return results;
}

// "12.09.2025" немесе "2025-09-12" секілді еркін мәтінді ISO-ға түрлендіреді.
function parseHumanToIso(raw: string): string | null {
  const trimmed = raw.trim();
  if (!trimmed) return null;
  const dotted = trimmed.match(/^(\d{1,2})\.(\d{1,2})\.(\d{4})$/);
  if (dotted) {
    const [, d, m, y] = dotted;
    return `${y}-${m.padStart(2, "0")}-${d.padStart(2, "0")}`;
  }
  if (/^\d{4}-\d{2}-\d{2}$/.test(trimmed)) return trimmed;
  return null;
}

// КТЖ құрылымдық кестесінің (bilimclass стилі) күні енгізілген жолдарын тікелей
// күнтізбеге орналастырады — апталық слотты қажет етпейді, себебі әр жолда
// күн нақты көрсетілген.
export function pushThematicToCalendar(subject: string, grade: string, rows: CtjRow[]): number {
  let list = getScheduledLessons();
  let count = 0;
  for (const row of rows) {
    const iso = parseHumanToIso(row.date);
    if (!iso || !row.topic.trim()) continue;
    const entry: ScheduledLesson = {
      id: uid(),
      date: iso,
      slotId: null,
      subject,
      className: grade,
      startTime: row.time || "",
      endTime: "",
      topic: row.topic,
      homework: row.homework,
      status: "planned",
    };
    const idx = list.findIndex((l) => l.date === entry.date && l.slotId === null && l.subject === subject && l.className === entry.className);
    list = idx >= 0 ? list.map((l, i) => (i === idx ? { ...entry, id: l.id } : l)) : [...list, entry];
    count++;
  }
  saveScheduledLessons(list);
  return count;
}

export function pushKtjToCalendar(plan: KtjPlan, slots: TimetableSlot[], startIso: string): number {
  const projected = projectKtjOntoCalendar(plan, slots, startIso);
  if (projected.length === 0) return 0;
  let list = getScheduledLessons();
  for (const entry of projected) {
    const idx = list.findIndex((l) => l.date === entry.date && l.slotId === entry.slotId);
    list = idx >= 0 ? list.map((l, i) => (i === idx ? { ...entry, id: l.id } : l)) : [...list, entry];
  }
  saveScheduledLessons(list);
  return projected.length;
}
