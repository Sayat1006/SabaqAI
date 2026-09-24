// Telegram бот: мұғалім аккаунтын ботқа қосу, хабарламалар және сілтемені бөлісу.
// Бот кілті тек `telegram-bot` Edge Function ішінде сақталады.

import { supabase } from "./supabaseClient";
import { tr } from "../i18n";

async function call<T>(body: Record<string, unknown>): Promise<T> {
  const { data, error } = await supabase.functions.invoke("telegram-bot", { body });
  if (error) {
    let message = error.name === "FunctionsFetchError" ? tr("Telegram бот әлі орнатылмаған (telegram-bot функциясы жоқ).") : error.message;
    const context = (error as { context?: Response }).context;
    if (context && typeof context.json === "function") {
      try {
        const b = (await context.json()) as { error?: string };
        if (b?.error) message = b.error;
      } catch {
        // денесі JSON емес
      }
    }
    throw new Error(message);
  }
  return data as T;
}

export const getBotUsername = () => call<{ username?: string }>({ action: "info" }).then((r) => r.username ?? "");
/** Webhook-ты орнатады; бот хабарламаларындағы «Сайтта ашу» сілтемелері үшін сайт мекенжайын да береді. */
export const setupTelegramWebhook = () => call<{ username?: string }>({ action: "setup", site: window.location.origin }).then((r) => r.username ?? "");
export const sendTestSummary = (projectId: string) => call<{ ok: boolean }>({ action: "summary", projectId });

/** Оқушы беті: тапсырған соң мұғалімге хабарлама (қате болса — үнсіз). */
export function notifySubmission(code: string) {
  void supabase.functions.invoke("telegram-bot", { body: { action: "notify", code } }).catch(() => {});
}

export interface TelegramStatus {
  linked: boolean;
  notify: boolean;
}

export async function getTelegramStatus(userId: string): Promise<TelegramStatus | null> {
  const { data, error } = await supabase.from("profiles").select("telegram_chat_id, telegram_notify").eq("id", userId).maybeSingle();
  if (error) return null; // 6-жаңарту әлі орындалмаған
  const row = data as { telegram_chat_id: number | null; telegram_notify: boolean } | null;
  return { linked: !!row?.telegram_chat_id, notify: row?.telegram_notify ?? true };
}

export async function createLinkCode(): Promise<string> {
  const { data, error } = await supabase.rpc("telegram_link_code");
  if (error) throw new Error(/Could not find the function|PGRST202/.test(error.message + error.code) ? tr("Әкімші Supabase-те update-6-telegram.sql файлын орындауы керек.") : error.message);
  return data as string;
}

export async function unlinkTelegram() {
  const { error } = await supabase.rpc("telegram_unlink");
  if (error) throw new Error(error.message);
}

export async function setTelegramNotify(on: boolean) {
  const { error } = await supabase.rpc("telegram_set_notify", { p_on: on });
  if (error) throw new Error(error.message);
}

/** Telegram-ның ресми «бөлісу» беті: сілтемені кез келген чатқа/топқа жібереді. */
export const telegramShareUrl = (url: string, text: string) =>
  `https://t.me/share/url?url=${encodeURIComponent(url)}&text=${encodeURIComponent(text)}`;
