// AI Nur Telegram Bot Edge Function
//
// Бір функция төрт жұмысты атқарады:
//  1. Telegram webhook — мұғалім `/start <код>` арқылы өз аккаунтын ботқа қосады.
//  2. action "notify" — оқушы тест тапсырған соң (оқушы беті шақырады) мұғалімге хабар.
//     Жаңа (notified = false), соңғы 10 минуттағы нәтижелер ғана жіберіледі, сондықтан
//     бұл әрекетті қайталап шақыру артық хабар тудырмайды.
//  3. action "summary" — мұғалім тест бойынша қорытындыны өзіне жібереді.
//  4. action "info" / "setup" — бот атауын қайтарады; әкімші webhook-ты орнатады.
//
// Құпия: TELEGRAM_BOT_TOKEN (Supabase → Edge Functions → Secrets). Webhook құпиясы
// токеннің SHA-256 хэшінен есептеледі, сондықтан бөлек құпия қажет емес.
// Функцияны «Verify JWT» ӨШІРУЛІ күйде жариялаңыз: Telegram JWT жібермейді,
// ал рұқсатты функция өзі тексереді.

// @ts-expect-error Deno жаһандық объектісі тек Supabase Edge орталарында бар
import { createClient } from "npm:@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

function json(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), { status, headers: { ...corsHeaders, "Content-Type": "application/json" } });
}

// @ts-expect-error Deno жаһандық объектісі тек Supabase Edge орталарында бар
const env = (k: string) => Deno.env.get(k) as string | undefined;

const esc = (s: string) => String(s ?? "").replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
const pct = (score: number, total: number) => (total ? Math.round((score / total) * 100) : 0);

async function webhookSecret(token: string) {
  const hash = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(`ai-nur:${token}`));
  return Array.from(new Uint8Array(hash))
    .map((b) => b.toString(16).padStart(2, "0"))
    .join("")
    .slice(0, 48);
}

async function tg(token: string, method: string, payload: Record<string, unknown>) {
  const res = await fetch(`https://api.telegram.org/bot${token}/${method}`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(payload),
  });
  return (await res.json().catch(() => ({ ok: false }))) as { ok: boolean; result?: Record<string, unknown>; description?: string };
}

const send = (token: string, chatId: number, text: string) =>
  tg(token, "sendMessage", { chat_id: chatId, text, parse_mode: "HTML", disable_web_page_preview: true });

// @ts-expect-error Deno жаһандық объектісі тек Supabase Edge орталарында бар
Deno.serve(async (req: Request) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });

  const token = env("TELEGRAM_BOT_TOKEN");
  if (!token) return json({ error: "TELEGRAM_BOT_TOKEN құпиясы орнатылмаған" }, 503);

  const supabaseUrl = env("SUPABASE_URL")!;
  const admin = createClient(supabaseUrl, env("SUPABASE_SERVICE_ROLE_KEY")!);
  const secret = await webhookSecret(token);

  /* ---------------------------------------------------------- 1. Telegram webhook */
  const tgSecret = req.headers.get("X-Telegram-Bot-Api-Secret-Token");
  if (tgSecret !== null) {
    if (tgSecret !== secret) return new Response("forbidden", { status: 403 });
    const update = await req.json().catch(() => ({}));
    const msg = update.message;
    const chatId = msg?.chat?.id as number | undefined;
    const text = String(msg?.text ?? "").trim();
    if (!chatId || msg?.chat?.type !== "private") return new Response("ok");

    if (text.startsWith("/start")) {
      const code = text.split(/\s+/)[1] ?? "";
      if (!code) {
        await send(token, chatId, "Сәлеметсіз бе! 👋 Бұл — <b>AI Nur</b> боты.\n\nҚосылу үшін сайттағы <b>Жеке бет → Telegram</b> бөлімінде «Telegram-ды қосу» батырмасын басыңыз.");
        return new Response("ok");
      }
      const { data: link } = await admin.from("telegram_links").select("user_id, created_at").eq("code", code).maybeSingle();
      if (!link || Date.now() - new Date(link.created_at).getTime() > 30 * 60 * 1000) {
        await send(token, chatId, "Код жарамсыз немесе ескірген. Сайттан «Telegram-ды қосу» батырмасын қайта басыңыз.");
        return new Response("ok");
      }
      await admin.from("profiles").update({ telegram_chat_id: chatId, telegram_notify: true }).eq("id", link.user_id);
      await admin.from("telegram_links").delete().eq("code", code);
      const { data: prof } = await admin.from("profiles").select("name").eq("id", link.user_id).maybeSingle();
      await send(
        token,
        chatId,
        `✅ Қосылды, ${esc(prof?.name ?? "мұғалім")}!\n\nЕнді оқушыларыңыз тест тапсырған сайын осында хабарлама келеді. Хабарламаларды өшіру — /stop.`,
      );
      return new Response("ok");
    }
    if (text === "/stop") {
      await admin.from("profiles").update({ telegram_chat_id: null }).eq("telegram_chat_id", chatId);
      await send(token, chatId, "Хабарламалар өшірілді. Қайта қосу үшін сайттағы «Telegram-ды қосу» батырмасын басыңыз.");
      return new Response("ok");
    }
    await send(token, chatId, "Бұл бот мұғалімге хабарлама жібереді. Қосылу — сайттағы <b>Жеке бет → Telegram</b>. Өшіру — /stop.");
    return new Response("ok");
  }

  /* ---------------------------------------------------------- 2–4. Сайттан шақыру */
  const body = await req.json().catch(() => ({}));
  const action = String(body.action ?? "");

  // Шақырушы (бар болса) — оның JWT-і арқылы.
  const authHeader = req.headers.get("Authorization") ?? "";
  const caller = createClient(supabaseUrl, env("SUPABASE_ANON_KEY")!, { global: { headers: { Authorization: authHeader } } });
  const userId = authHeader ? (await caller.auth.getUser()).data.user?.id : undefined;

  if (action === "info") {
    const me = await tg(token, "getMe", {});
    if (!me.ok) return json({ error: "Бот кілті жарамсыз" }, 400);
    return json({ username: me.result?.username });
  }

  if (action === "setup") {
    if (!userId) return json({ error: "Unauthorized" }, 401);
    const { data: prof } = await admin.from("profiles").select("role, status").eq("id", userId).maybeSingle();
    if (prof?.role !== "admin" || prof.status !== "active") return json({ error: "Тек әкімшіге рұқсат етілген" }, 403);
    const hook = await tg(token, "setWebhook", {
      url: `${supabaseUrl}/functions/v1/telegram-bot`,
      secret_token: secret,
      allowed_updates: ["message"],
      drop_pending_updates: true,
    });
    if (!hook.ok) return json({ error: hook.description ?? "Webhook орнатылмады" }, 400);
    await tg(token, "setMyCommands", { commands: [{ command: "start", description: "Ботты қосу" }, { command: "stop", description: "Хабарламаларды өшіру" }] });
    const me = await tg(token, "getMe", {});
    return json({ ok: true, username: me.result?.username });
  }

  if (action === "notify") {
    const code = String(body.code ?? "").toLowerCase();
    if (!/^[a-z0-9]{8}$/.test(code)) return json({ error: "code" }, 400);
    const { data: share } = await admin.from("test_shares").select("project_id, user_id").eq("code", code).maybeSingle();
    if (!share) return json({ ok: true });
    const { data: prof } = await admin.from("profiles").select("telegram_chat_id, telegram_notify").eq("id", share.user_id).maybeSingle();
    const since = new Date(Date.now() - 10 * 60 * 1000).toISOString();
    const { data: fresh } = await admin
      .from("test_submissions")
      .update({ notified: true })
      .eq("project_id", share.project_id)
      .eq("notified", false)
      .gte("created_at", since)
      .select("student_name, student_class, score, total");
    if (!fresh?.length || !prof?.telegram_chat_id || !prof.telegram_notify) return json({ ok: true });
    const { data: project } = await admin.from("projects").select("title").eq("id", share.project_id).maybeSingle();
    const { count } = await admin.from("test_submissions").select("id", { count: "exact", head: true }).eq("project_id", share.project_id);
    const lines = fresh.map((s: { student_name: string; student_class: string; score: number; total: number }) => {
      const p = pct(s.score, s.total);
      const mark = p >= 85 ? "🟢" : p >= 50 ? "🟡" : "🔴";
      return `${mark} <b>${esc(s.student_name)}</b>${s.student_class ? ` (${esc(s.student_class)})` : ""} — ${s.score}/${s.total}, ${p}%`;
    });
    await send(token, prof.telegram_chat_id, `📝 <b>${esc(project?.title ?? "Тест")}</b>\n${lines.join("\n")}\n\nБарлығы тапсырғандар: ${count ?? fresh.length}`);
    return json({ ok: true });
  }

  if (action === "summary") {
    if (!userId) return json({ error: "Unauthorized" }, 401);
    const projectId = String(body.projectId ?? "");
    const { data: project } = await admin.from("projects").select("title, user_id, data").eq("id", projectId).maybeSingle();
    if (!project || project.user_id !== userId) return json({ error: "Тест табылмады" }, 404);
    const { data: prof } = await admin.from("profiles").select("telegram_chat_id").eq("id", userId).maybeSingle();
    if (!prof?.telegram_chat_id) return json({ error: "Telegram қосылмаған. Жеке бетте «Telegram-ды қосу» батырмасын басыңыз." }, 400);
    const { data: subs } = await admin.from("test_submissions").select("student_name, score, total, answers").eq("project_id", projectId);
    const list = (subs ?? []) as { student_name: string; score: number; total: number; answers: (number | null)[] }[];
    if (!list.length) {
      await send(token, prof.telegram_chat_id, `📊 <b>${esc(project.title)}</b>\nӘзірге ешкім тапсырған жоқ.`);
      return json({ ok: true });
    }
    const avg = Math.round(list.reduce((s, x) => s + pct(x.score, x.total), 0) / list.length);
    const groups = { C: 0, B: 0, A: 0 };
    list.forEach((x) => {
      const p = pct(x.score, x.total);
      groups[p >= 85 ? "C" : p >= 50 ? "B" : "A"]++;
    });
    const questions = ((project.data as { questions?: { question: string; correctIndex: number }[] })?.questions ?? []) as { question: string; correctIndex: number }[];
    const hardest = questions
      .map((q, i) => ({ i, q, ok: pct(list.filter((x) => x.answers?.[i] === q.correctIndex).length, list.length) }))
      .sort((a, b) => a.ok - b.ok)
      .slice(0, 2);
    const best = [...list].sort((a, b) => pct(b.score, b.total) - pct(a.score, a.total)).slice(0, 3);
    const text =
      `📊 <b>${esc(project.title)}</b> — қорытынды\n\n` +
      `Тапсырғандар: <b>${list.length}</b>\nОрташа нәтиже: <b>${avg}%</b>\n` +
      `🟢 C (85%+): ${groups.C}   🟡 B (50–84%): ${groups.B}   🔴 A (&lt;50%): ${groups.A}\n\n` +
      (hardest.length ? `Ең қиын сұрақтар:\n${hardest.map((h) => `• ${h.i + 1}-сұрақ — ${h.ok}% дұрыс: ${esc(h.q.question.slice(0, 90))}`).join("\n")}\n\n` : "") +
      `Үздіктер: ${best.map((b) => `${esc(b.student_name)} (${pct(b.score, b.total)}%)`).join(", ")}`;
    const r = await send(token, prof.telegram_chat_id, text);
    return r.ok ? json({ ok: true }) : json({ error: r.description ?? "Жіберілмеді" }, 400);
  }

  return json({ error: "Белгісіз әрекет" }, 400);
});
