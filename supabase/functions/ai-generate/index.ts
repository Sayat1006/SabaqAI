// AI Nur AI Generate Edge Function
//
// Тек осы функция Gemini API кілтін қолданады (ол ешқашан браузерге
// шықпайды). Клиент промпт пен (міндетті емес) JSON схема жібереді,
// функция Gemini-ден сол схемаға сәйкес мәтін/JSON алып қайтарады.
//
// admin-actions-тен айырмашылығы — бұған кез келген белсенді
// (расталған әрі өшірілмеген) пайдаланушы жүгіне алады, әкімші
// болу міндетті емес: ҚМЖ, презентация, сурет, тест сияқты құралдарды мұғалімдер
// де қолданады.
//
// Әр сұраныс ai_usage кестесіне жазылады (12-жаңарту): әкімші панеліндегі
// «Статистика» беті сол бойынша лимитке қаншалықты жақын екенін көрсетеді.
// Кесте әлі жоқ болса, жазу үнсіз өткізіледі — генерация бұзылмайды.

// @ts-expect-error Deno жаһандық объектісі тек Supabase Edge орталарында бар
import { createClient } from "npm:@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

// Лимиті біткен модельдер (осы функция данасының жадында): тәуліктік лимиті біткенге
// бір сағат бойы қайта жүгінбейміз — мұғалім бос күтпейді.
const exhaustedUntil = new Map<string, number>();

/** Gemini 429 жауабын талдау: тәуліктік лимит пе, минуттық па, қанша күту керек. */
function parseQuota(text: string): { daily: boolean; retryMs: number } {
  const daily = /PerDay/i.test(text);
  const m = text.match(/"retryDelay"\s*:\s*"(\d+(?:\.\d+)?)s"/) ?? text.match(/retry in (\d+(?:\.\d+)?)s/i);
  return { daily, retryMs: m ? Math.ceil(Number(m[1]) * 1000) : 30000 };
}

/** Қазақстан уақыты бойынша бүгіннің басы (UTC+5). */
function kzDayStart(): string {
  const now = new Date(Date.now() + 5 * 3600e3);
  return new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate()) - 5 * 3600e3).toISOString();
}

function json(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
}

// @ts-expect-error Deno жаһандық объектісі тек Supabase Edge орталарында бар
Deno.serve(async (req: Request) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });

  const authHeader = req.headers.get("Authorization");
  if (!authHeader) return json({ error: "Unauthorized" }, 401);

  // @ts-expect-error Deno жаһандық объектісі тек Supabase Edge орталарында бар
  const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
  // @ts-expect-error Deno жаһандық объектісі тек Supabase Edge орталарында бар
  const anonKey = Deno.env.get("SUPABASE_ANON_KEY")!;
  // @ts-expect-error Deno жаһандық объектісі тек Supabase Edge орталарында бар
  const geminiKey = Deno.env.get("GEMINI_API_KEY");
  if (!geminiKey) return json({ error: "GEMINI_API_KEY орнатылмаған (Edge Function Secrets бөлімін қараңыз)" }, 500);

  const callerClient = createClient(supabaseUrl, anonKey, {
    global: { headers: { Authorization: authHeader } },
  });

  const {
    data: { user },
  } = await callerClient.auth.getUser();
  if (!user) return json({ error: "Unauthorized" }, 401);

  const { data: callerProfile } = await callerClient.from("profiles").select("status, role").eq("id", user.id).single();
  if (!callerProfile || callerProfile.status !== "active") {
    return json({ error: "Forbidden: аккаунт белсенді емес" }, 403);
  }

  const body = await req.json().catch(() => ({}));
  const prompt = body.prompt as string | undefined;
  const schema = body.schema as object | undefined;
  const tool = typeof body.tool === "string" ? body.tool.slice(0, 30) : "";
  if (!prompt) return json({ error: "prompt жоқ" }, 400);

  const userId = user.id;
  const started = Date.now();
  let retries = 0;
  let usedModel = "";
  // @ts-expect-error Deno жаһандық объектісі тек Supabase Edge орталарында бар
  const serviceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");
  async function logUsage(ok: boolean, status: number, usage?: { promptTokenCount?: number; candidatesTokenCount?: number }) {
    if (!serviceKey) return;
    try {
      await createClient(supabaseUrl, serviceKey).from("ai_usage").insert({
        user_id: userId,
        source: "web",
        tool,
        model: usedModel,
        ok,
        status,
        retries,
        tokens_in: usage?.promptTokenCount ?? 0,
        tokens_out: usage?.candidatesTokenCount ?? 0,
        ms: Date.now() - started,
      });
    } catch {
      // статистика жазылмаса да жауап қайтарыла береді
    }
  }

  // Әкімші қойған жеке тәуліктік лимит (14-жаңарту, app_settings.ai_limits.perUser; 0 — шектеусіз).
  if (serviceKey && callerProfile.role !== "admin") {
    try {
      const service = createClient(supabaseUrl, serviceKey);
      const { data: setting } = await service.from("app_settings").select("value").eq("key", "ai_limits").maybeSingle();
      const perUser = Number(setting?.value?.perUser) || 0;
      if (perUser > 0) {
        const { count } = await service
          .from("ai_usage")
          .select("id", { count: "exact", head: true })
          .eq("user_id", userId)
          .eq("ok", true)
          .gte("created_at", kzDayStart());
        if ((count ?? 0) >= perUser) {
          return json({ error: `Бүгінгі жеке лимитіңіз (${perUser} генерация) таусылды. Ертең қайта жаңарады.`, code: "user_limit" }, 429);
        }
      }
    } catch {
      // баптау кестесі жоқ болса — шектеусіз
    }
  }

  const generationConfig: Record<string, unknown> = { temperature: 0.8 };
  if (schema) {
    generationConfig.responseMimeType = "application/json";
    generationConfig.responseSchema = schema;
  }

  // Модельдер кезегі: GEMINI_MODELS секретімен өзгертуге болады (үтір арқылы), әйтпесе әдепкі тізім.
  // Әр модельдің тегін лимиті бөлек: біреуі біткенде келесісіне өтеміз.
  // @ts-expect-error Deno жаһандық объектісі тек Supabase Edge орталарында бар
  const envModels = (Deno.env.get("GEMINI_MODELS") ?? "").split(",").map((m: string) => m.trim()).filter(Boolean);
  const modelCandidates: string[] = envModels.length ? envModels : ["gemini-3.6-flash", "gemini-flash-latest", "gemini-2.5-flash"];
  let geminiRes: Response | null = null;
  let lastErrText = "";
  let lastStatus = 502;
  let dailyHits = 0;
  let minuteHits = 0;

  const call = (model: string) =>
    fetch(`https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${geminiKey}`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ contents: [{ role: "user", parts: [{ text: prompt }] }], generationConfig }),
    });

  // 1-айналым: барлық модельді байқаймыз. Тек минуттық лимит кедергі болса — күтіп, 2-айналым.
  outer: for (let round = 0; round < 2; round++) {
    let waitMs = Infinity;
    minuteHits = 0;
    for (const model of modelCandidates) {
      if ((exhaustedUntil.get(model) ?? 0) > Date.now()) {
        dailyHits++;
        lastStatus = 429;
        continue;
      }
      for (let attempt = 1; attempt <= 2; attempt++) {
        usedModel = model;
        geminiRes = await call(model);
        if (geminiRes.ok) break outer;
        lastErrText = await geminiRes.text();
        lastStatus = geminiRes.status;
        retries++;
        if (geminiRes.status === 429) {
          const q = parseQuota(lastErrText);
          if (q.daily) {
            exhaustedUntil.set(model, Date.now() + 3600e3);
            dailyHits++;
          } else {
            minuteHits++;
            waitMs = Math.min(waitMs, q.retryMs);
          }
          break; // келесі модельге
        }
        if (geminiRes.status !== 503 || attempt === 2) break; // 503 — бір рет қайталаймыз
        await new Promise((resolve) => setTimeout(resolve, 800));
      }
    }
    // Минуттық лимит 20 секундқа дейін күтуді қажет етсе — күтіп, қайта байқаймыз.
    if (round === 0 && minuteHits > 0 && waitMs <= 20000) {
      await new Promise((resolve) => setTimeout(resolve, waitMs + 500));
      continue;
    }
    break;
  }

  if (!geminiRes || !geminiRes.ok) {
    await logUsage(false, lastStatus);
    if (minuteHits > 0) {
      return json({ error: "AI-ға қазір тым көп сұраныс түсті. Бір минуттан кейін қайталаңыз.", code: "quota_minute" }, 429);
    }
    if (dailyHits > 0 && dailyHits >= modelCandidates.length) {
      return json({ error: "AI-дың бүгінгі тегін лимиті таусылды. Лимит түскі сағат 12–13-те жаңарады немесе әкімшіге хабарласыңыз.", code: "quota_day" }, 429);
    }
    return json({ error: `Gemini API қатесі (${lastStatus}): ${lastErrText.slice(0, 300)}`, code: "ai_error" }, 502);
  }

  const geminiData = await geminiRes!.json();
  const text = geminiData?.candidates?.[0]?.content?.parts?.[0]?.text;
  await logUsage(!!text, text ? 200 : 502, geminiData?.usageMetadata);
  if (!text) {
    const blockReason = geminiData?.promptFeedback?.blockReason;
    return json({ error: blockReason ? `Gemini жауапты бөгеді: ${blockReason}` : "Gemini бос жауап қайтарды" }, 502);
  }

  return json({ text });
});
