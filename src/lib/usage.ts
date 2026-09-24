// AI қолдану статистикасы (әкімшіге): ai_usage кестесінен admin_ai_stats() жиынтығы.

import { tr } from "../i18n";
import { supabase } from "./supabaseClient";

export interface UsageStats {
  days: number;
  today: { total: number; ok: number; failed: number; retried: number; tokens: number };
  peak_minute_today: number;
  daily: { day: string; total: number; failed: number }[];
  users: { id: string; name: string; email: string; status: string; today: number; week: number; month: number; last_at: string | null }[];
  tools: { tool: string; count: number }[];
  models: { model: string; count: number }[];
  db_bytes: number;
  projects: Record<string, number>;
}

export async function getUsageStats(days = 30): Promise<UsageStats> {
  const { data, error } = await supabase.rpc("admin_ai_stats", { p_days: days });
  if (error) {
    if (/admin_ai_stats/.test(error.message) && /(does not exist|Could not find|schema cache)/i.test(error.message)) {
      throw new Error(tr("Статистика әлі қосылмаған. Supabase-те supabase/update-12-ai-usage.sql файлын орындаңыз."));
    }
    if (/not_allowed/.test(error.message)) throw new Error(tr("Бұл бет тек әкімшіге арналған."));
    throw new Error(tr("Статистиканы жүктеу мүмкін болмады: {msg}", { msg: error.message }));
  }
  return data as UsageStats;
}

/** Құрал атауы (URL бөлігі → мәзірдегі атау). */
export function toolLabel(tool: string): string {
  const map: Record<string, string> = {
    qmzh: "ҚМЖ",
    ktzh: "КТЖ",
    presentation: "Презентация",
    images: "Сурет генерациясы",
    tests: "Тапсырмалар",
    docs: "Құжаттар",
    progress: "Оқушы прогресі",
    telegram: "Telegram бот",
    live: "Тірі викторина",
    home: "Басты бет",
  };
  return tr(map[tool] ?? "Басқа");
}

const num = (key: string, fallback: number) => {
  try {
    const v = Number(localStorage.getItem(key));
    return v > 0 ? v : fallback;
  } catch {
    return fallback;
  }
};
const save = (key: string, v: number) => {
  try {
    localStorage.setItem(key, String(v));
  } catch {
    // жеке режим
  }
};

/** Gemini лимиттері Google AI Studio-да көрінеді; әкімші өз кілтінің санын жазады. */
export const limits = {
  daily: () => num("ainur-ai-limit-day", 250),
  perMinute: () => num("ainur-ai-limit-min", 10),
  setDaily: (v: number) => save("ainur-ai-limit-day", v),
  setPerMinute: (v: number) => save("ainur-ai-limit-min", v),
};

/** Supabase тегін жоспарындағы дерекқор көлемі. */
export const DB_FREE_BYTES = 500 * 1024 * 1024;
