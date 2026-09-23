// AI Nur Admin Actions Edge Function
//
// Тек осы функция service_role кілтін қолданады (ол ешқашан браузерге
// шықпайды). Мұнда: жаңа мұғалім/әкімші аккаунтын Auth-та құру, кез
// келген пайдаланушының құпия сөзін ысыру және аккаунтты толық жою —
// себебі бұл үшеуі Supabase Admin API-ын қажет етеді, ал ол клиент
// жағынан (anon кілтпен) қолжетімсіз.
//
// Шақырушының шын мәнінде белсенді әкімші екенін әрдайым сервер
// жағында, шақырушының өз JWT-і арқылы RLS негізінде тексереміз —
// сұраныс денесіндегі мәліметке сенбейміз.

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
  const serviceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;

  // Шақырушының жеке сессиясымен байланысқан клиент — оның шын мәнінде
  // кім екенін және RLS арқылы әкімші рөлін тексеру үшін.
  const callerClient = createClient(supabaseUrl, anonKey, {
    global: { headers: { Authorization: authHeader } },
  });

  const {
    data: { user },
  } = await callerClient.auth.getUser();
  if (!user) return json({ error: "Unauthorized" }, 401);

  const { data: callerProfile } = await callerClient
    .from("profiles")
    .select("role, status, email")
    .eq("id", user.id)
    .single();

  if (!callerProfile || callerProfile.role !== "admin" || callerProfile.status !== "active") {
    return json({ error: "Forbidden: тек белсенді әкімшіге рұқсат етілген" }, 403);
  }

  const adminClient = createClient(supabaseUrl, serviceKey);
  const body = await req.json().catch(() => ({}));
  const action = body.action as string;

  if (action === "create") {
    const { name, email, password, role, subject, school } = body;
    if (!name || !email || !password) return json({ error: "Толтырылмаған өрістер бар" }, 400);

    const { data: created, error: createError } = await adminClient.auth.admin.createUser({
      email,
      password,
      email_confirm: true,
    });
    if (createError || !created.user) return json({ error: createError?.message ?? "Құру мүмкін болмады" }, 400);

    const { error: profileError } = await adminClient.from("profiles").insert({
      id: created.user.id,
      name,
      email,
      role: role === "admin" ? "admin" : "teacher",
      status: "active",
      subject: subject ?? "",
      school: school ?? "",
    });
    if (profileError) {
      await adminClient.auth.admin.deleteUser(created.user.id);
      return json({ error: profileError.message }, 400);
    }

    await callerClient.rpc("log_audit", {
      p_action: "Аккаунт құрылды",
      p_detail: `${name} (${email}), рөлі: ${role === "admin" ? "әкімші" : "мұғалім"}`,
    });
    return json({ ok: true, id: created.user.id });
  }

  if (action === "reset-password") {
    const { userId, newPassword } = body;
    if (!userId || !newPassword) return json({ error: "userId/newPassword жоқ" }, 400);

    const { error } = await adminClient.auth.admin.updateUserById(userId, { password: newPassword });
    if (error) return json({ error: error.message }, 400);

    const { data: target } = await adminClient.from("profiles").select("name, email").eq("id", userId).single();
    await callerClient.rpc("log_audit", {
      p_action: "Құпия сөз ысырылды",
      p_detail: target ? `${target.name} (${target.email})` : userId,
    });
    return json({ ok: true });
  }

  if (action === "delete") {
    const { userId } = body;
    if (!userId) return json({ error: "userId жоқ" }, 400);
    if (userId === user.id) return json({ error: "Өз аккаунтыңызды жоя алмайсыз" }, 400);

    const { data: target } = await adminClient.from("profiles").select("name, email").eq("id", userId).single();
    const { error } = await adminClient.auth.admin.deleteUser(userId);
    if (error) return json({ error: error.message }, 400);

    await callerClient.rpc("log_audit", {
      p_action: "Аккаунт жойылды",
      p_detail: target ? `${target.name} (${target.email})` : userId,
    });
    return json({ ok: true });
  }

  return json({ error: "Белгісіз әрекет" }, 400);
});
