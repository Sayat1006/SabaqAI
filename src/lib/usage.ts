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

export interface AiLimits {
  /** Gemini кілтінің тәуліктік лимиті (барлық модель бойынша). */
  day: number;
  /** Минуттық лимит. */
  minute: number;
  /** Бір мұғалімге тәулігіне (0 — шектеусіз). ai-generate функциясы тексереді. */
  perUser: number;
}

/** Тегін тариф: 3 модель × 20 сұраныс/тәулік, 3 × 5/минут. */
export const DEFAULT_LIMITS: AiLimits = { day: 60, minute: 15, perUser: 0 };

const clean = (v: Partial<AiLimits> | null | undefined): AiLimits => ({
  day: Math.max(1, Number(v?.day) || DEFAULT_LIMITS.day),
  minute: Math.max(1, Number(v?.minute) || DEFAULT_LIMITS.minute),
  perUser: Math.max(0, Math.floor(Number(v?.perUser) || 0)),
});

export async function getLimits(): Promise<{ limits: AiLimits; stored: boolean }> {
  const { data, error } = await supabase.from("app_settings").select("value").eq("key", "ai_limits").maybeSingle();
  if (error) return { limits: DEFAULT_LIMITS, stored: false }; // 14-жаңарту әлі орындалмаған
  return { limits: clean(data?.value as Partial<AiLimits>), stored: true };
}

export async function saveLimits(limits: AiLimits): Promise<void> {
  const { error } = await supabase
    .from("app_settings")
    .upsert({ key: "ai_limits", value: clean(limits), updated_at: new Date().toISOString() }, { onConflict: "key" });
  if (error) {
    if (/app_settings/.test(error.message) && /(does not exist|Could not find|schema cache)/i.test(error.message)) {
      throw new Error(tr("Лимиттерді сақтау үшін Supabase-те supabase/update-14-ai-limits.sql файлын орындаңыз."));
    }
    throw new Error(error.message);
  }
}

/** Supabase тегін жоспарындағы дерекқор көлемі. */
export const DB_FREE_BYTES = 500 * 1024 * 1024;
