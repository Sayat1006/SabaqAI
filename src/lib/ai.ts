// Gemini арқылы нақты ЖИ генерациясына жүгінетін клиент қабаты.
// API кілт тек `ai-generate` Edge Function ішінде сақталады (браузерде емес).

import { supabase } from "./supabaseClient";
import { tr } from "../i18n";

export class AiGenerationError extends Error {
  /** «quota_day», «quota_minute», «user_limit» — лимит қатесі (үлгі жоспарға ауыспау керек). */
  code: string;
  constructor(message: string, code = "") {
    super(message);
    this.code = code;
  }
}

export const isLimitError = (e: unknown) => e instanceof AiGenerationError && /^(quota_|user_limit)/.test(e.code);

/** Статистика үшін: сұраныс қай құралдан жіберілді (URL-дің бірінші бөлігі, мыс. «qmzh»). */
const currentTool = () => window.location.pathname.split("/")[1] || "home";

export async function aiGenerate(prompt: string, schema?: object): Promise<string> {
  const tool = currentTool();
  const invoke = () => supabase.functions.invoke("ai-generate", { body: schema ? { prompt, schema, tool } : { prompt, tool } });
  let { data, error } = await invoke();
  if (error?.name === "FunctionsFetchError") {
    await new Promise((r) => setTimeout(r, 1500));
    ({ data, error } = await invoke());
  }
  if (error?.name === "FunctionsFetchError") {
    throw new AiGenerationError(
      tr("AI серверіне (ai-generate) қосылу мүмкін болмады. Интернетті тексеріңіз; қайталанса, Supabase → Edge Functions бөлімінде «ai-generate» функциясы жарияланғанын тексеріңіз."),
    );
  }
  if (error) {
    let message = error.message;
    let code = "";
    const context = (error as { context?: Response }).context;
    if (context && typeof context.json === "function") {
      try {
        const body = (await context.json()) as { error?: string; code?: string };
        if (body?.error) message = body.error;
        code = body?.code ?? "";
      } catch {
        // денесі JSON емес болса — үнсіз өтеміз
      }
    }
    const friendly = friendlyAiError(message, code);
    throw new AiGenerationError(friendly.message, friendly.code);
  }
  return (data as { text: string }).text;
}

/** Лимит қателерін мұғалімге түсінікті етіп жазу (функцияның ескі нұсқасы ағылшынша мәтін қайтарса да). */
export function friendlyAiError(message: string, code = ""): { message: string; code: string } {
  if (code === "user_limit") return { code, message: tr("Бүгінгі жеке лимитіңіз ({n} генерация) таусылды. Ертең қайта жаңарады.", { n: message.match(/\d+/)?.[0] ?? "" }) };
  const quota = code === "quota_day" || code === "quota_minute" || /\(429\)|RESOURCE_EXHAUSTED|exceeded your current quota/i.test(message);
  if (!quota) return { message, code };
  if (code === "quota_minute" || (!code && !/PerDay/i.test(message))) {
    return { code: "quota_minute", message: tr("AI-ға қазір тым көп сұраныс түсті. Бір минуттан кейін қайталаңыз.") };
  }
  return { code: "quota_day", message: tr("AI-дың бүгінгі тегін лимиті таусылды. Лимит түскі сағат 12–13-те жаңарады немесе әкімшіге хабарласыңыз.") };
}

export async function aiGenerateJson<T>(prompt: string, schema: object): Promise<T> {
  const text = await aiGenerate(prompt, schema);
  return JSON.parse(text) as T;
}
