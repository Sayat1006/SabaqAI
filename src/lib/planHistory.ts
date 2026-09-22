import type { LessonPlan } from "./generators";
import { bumpStats } from "./projects";

export interface SavedPlan<T> {
  id: string;
  savedAt: number;
  label: string;
  data: T;
}

const QMZH_KEY = "sai-qmzh-history";
const MAX_ENTRIES = 8;

function load<T>(key: string): SavedPlan<T>[] {
  try {
    const raw = localStorage.getItem(key);
    return raw ? (JSON.parse(raw) as SavedPlan<T>[]) : [];
  } catch {
    return [];
  }
}

function save<T>(key: string, list: SavedPlan<T>[]) {
  try {
    localStorage.setItem(key, JSON.stringify(list));
  } catch {
    // сақтау мүмкін болмаса үнсіз өтеміз
  }
}

export function getQmzhHistory(): SavedPlan<LessonPlan>[] {
  return load<LessonPlan>(QMZH_KEY);
}

export function pushQmzhHistory(plan: LessonPlan): SavedPlan<LessonPlan>[] {
  const list = load<LessonPlan>(QMZH_KEY);
  const entry: SavedPlan<LessonPlan> = {
    id: crypto.randomUUID(),
    savedAt: Date.now(),
    label: `${plan.subject} — ${plan.topic}`,
    data: plan,
  };
  const next = [entry, ...list].slice(0, MAX_ENTRIES);
  save(QMZH_KEY, next);
  bumpStats({ qmzh: 1 });
  return next;
}

export function removeQmzhHistory(id: string): SavedPlan<LessonPlan>[] {
  const next = load<LessonPlan>(QMZH_KEY).filter((e) => e.id !== id);
  save(QMZH_KEY, next);
  return next;
}
