// Sabaq AI AI Generate Edge Function
//
// Тек осы функция Gemini API кілтін қолданады (ол ешқашан браузерге
// шықпайды). Клиент промпт пен (міндетті емес) JSON схема жібереді,
// функция Gemini-ден сол схемаға сәйкес мәтін/JSON алып қайтарады.
//
// admin-actions-тен айырмашылығы — бұған кез келген белсенді
// (расталған әрі өшірілмеген) пайдаланушы жүгіне алады, әкімші
// болу міндетті емес: ҚМЖ, КТЖ, Дода сияқты құралдарды мұғалімдер
// де қолданады.

// @ts-expect-error Deno жаһандық объектісі тек Supabase Edge орталарында бар
import { createClient } from "npm:@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

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

  const { data: callerProfile } = await callerClient.from("profiles").select("status").eq("id", user.id).single();
  if (!callerProfile || callerProfile.status !== "active") {
    return json({ error: "Forbidden: аккаунт белсенді емес" }, 403);
  }

  const body = await req.json().catch(() => ({}));
  const prompt = body.prompt as string | undefined;
  const schema = body.schema as object | undefined;
  if (!prompt) return json({ error: "prompt жоқ" }, 400);

  const generationConfig: Record<string, unknown> = { temperature: 0.8 };
  if (schema) {
    generationConfig.responseMimeType = "application/json";
    generationConfig.responseSchema = schema;
  }

  // Бірінші модель шамадан тыс жүктелсе (503), келесі кандидатқа өтеді.
  const modelCandidates = ["gemini-3.6-flash", "gemini-flash-latest", "gemini-2.5-flash"];
  const attemptsPerModel = 2;
  let geminiRes: Response | null = null;
  let lastErrText = "";
  let lastStatus = 502;

  outer: for (const model of modelCandidates) {
    for (let attempt = 1; attempt <= attemptsPerModel; attempt++) {
      geminiRes = await fetch(
        `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${geminiKey}`,
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            contents: [{ role: "user", parts: [{ text: prompt }] }],
            generationConfig,
          }),
        },
      );

      if (geminiRes.ok) break outer;

      lastErrText = await geminiRes.text();
      lastStatus = geminiRes.status;
      // 503 (UNAVAILABLE) / 429 (тым жиі сұраныс) — уақытша, қайта байқауға тұрарлық.
      const retryable = geminiRes.status === 503 || geminiRes.status === 429;
      if (!retryable) break; // осы модельмен қайталанбайтын қате — келесі модельге өтеді
      if (attempt < attemptsPerModel) await new Promise((resolve) => setTimeout(resolve, 500 * attempt));
    }
  }

  if (!geminiRes || !geminiRes.ok) {
    return json({ error: `Gemini API қатесі (${lastStatus}): ${lastErrText.slice(0, 300)}` }, 502);
  }

  const geminiData = await geminiRes!.json();
  const text = geminiData?.candidates?.[0]?.content?.parts?.[0]?.text;
  if (!text) {
    const blockReason = geminiData?.promptFeedback?.blockReason;
    return json({ error: blockReason ? `Gemini жауапты бөгеді: ${blockReason}` : "Gemini бос жауап қайтарды" }, 502);
  }

  return json({ text });
});
