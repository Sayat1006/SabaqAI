// Gemini арқылы нақты ЖИ генерациясына жүгінетін клиент қабаты.
// API кілт тек `ai-generate` Edge Function ішінде сақталады (браузерде емес).

import { supabase } from "./supabaseClient";

export class AiGenerationError extends Error {}

export async function aiGenerate(prompt: string, schema?: object): Promise<string> {
  const { data, error } = await supabase.functions.invoke("ai-generate", {
    body: schema ? { prompt, schema } : { prompt },
  });
  if (error) {
    let message = error.message;
    const context = (error as { context?: Response }).context;
    if (context && typeof context.json === "function") {
      try {
        const body = (await context.json()) as { error?: string };
        if (body?.error) message = body.error;
      } catch {
        // денесі JSON емес болса — үнсіз өтеміз
      }
    }
    throw new AiGenerationError(message);
  }
  return (data as { text: string }).text;
}

export async function aiGenerateJson<T>(prompt: string, schema: object): Promise<T> {
  const text = await aiGenerate(prompt, schema);
  return JSON.parse(text) as T;
}
