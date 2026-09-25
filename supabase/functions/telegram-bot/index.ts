// AI Nur Telegram Bot Edge Function
//
// Бір функция бес жұмысты атқарады:
//  1. Telegram webhook — мұғалім `/start <код>` арқылы өз аккаунтын ботқа қосады.
//  2. action "notify" — оқушы тест тапсырған соң (оқушы беті шақырады) мұғалімге хабар.
//     Жаңа (notified = false), соңғы 10 минуттағы нәтижелер ғана жіберіледі, сондықтан
//     бұл әрекетті қайталап шақыру артық хабар тудырмайды.
//  3. action "summary" — мұғалім тест бойынша қорытындыны өзіне жібереді.
//  4. action "info" / "setup" — бот атауын қайтарады; әкімші webhook-ты орнатады.
//  5. /qmzh және /test командалары — қосылған мұғалімге Gemini арқылы ҚМЖ немесе тест
//     жасап, «Жобаларға» сақтайды және Word файлы етіп жібереді (GEMINI_API_KEY қажет).
//
// Құпия: TELEGRAM_BOT_TOKEN (Supabase → Edge Functions → Secrets). Webhook құпиясы
// токеннің SHA-256 хэшінен есептеледі, сондықтан бөлек құпия қажет емес.
// Функцияны «Verify JWT» ӨШІРУЛІ күйде жариялаңыз: Telegram JWT жібермейді,
// ал рұқсатты функция өзі тексереді.

// @ts-expect-error Deno жаһандық объектісі тек Supabase Edge орталарында бар
import { createClient } from "npm:@supabase/supabase-js@2";
// @ts-expect-error Deno жаһандық объектісі тек Supabase Edge орталарында бар
import { AlignmentType, Document, ExternalHyperlink, HeadingLevel, Packer, Paragraph, Table, TableCell, TableRow, TextRun, WidthType } from "npm:docx@9";

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


/* =================================================================== Генерация */

const SUBJECTS = [
  "Қазақ тілі", "Қазақ әдебиеті", "Орыс тілі", "Орыс әдебиеті", "Қазақ тілі мен әдебиеті", "Шетел тілі",
  "Математика", "Алгебра", "Геометрия", "Информатика", "Цифрлық сауаттылық", "Жаратылыстану", "Физика",
  "Химия", "Биология", "География", "Қазақстан тарихы", "Дүниежүзі тарихы", "Құқық негіздері",
  "Конституция негіздері", "Заң мен Тәртіп", "Жеке қауіпсіздік", "Музыка", "Көркем еңбек", "Дене шынықтыру",
  "Алғашқы әскери және технологиялық дайындық", "Графика және жобалау", "Кәсіпкерлік және бизнес негіздері",
  "Екінші шетел тілі (тиісті бағытта)",
];

const BOT_DAILY_LIMIT = 15;

const HELP =
  "🤖 <b>AI Nur боты</b>\n\n" +
  "<b>/qmzh</b> тақырып — ҚМЖ жасау (Word)\n" +
  "<b>/test</b> тақырып — деңгейлік тест жасау (Word)\n\n" +
  "Пән мен сыныпты да жазуға болады, мысалы:\n<code>/qmzh 5-сынып Математика Жай бөлшектерді салыстыру</code>\n" +
  "Жазылмаса, «Жеке беттегі» пәніңіз бен бірінші сыныбыңыз алынады.\n\n/stop — хабарламаларды өшіру";

/** «/qmzh 7-сынып Биология Жасуша» → сынып, пән, тақырып (жоқтары профильден). */
function parseRequest(raw: string, prof: { subject?: string; grades?: string[] }) {
  let text = raw.trim();
  let grade = "";
  const g = text.match(/(\d{1,2})\s*-?\s*(сынып|класс)?/i);
  if (g && Number(g[1]) >= 1 && Number(g[1]) <= 11 && (g[2] || /^\d{1,2}\b/.test(text))) {
    grade = `${Number(g[1])}-сынып`;
    text = text.replace(g[0], " ");
  }
  let subject = "";
  const lower = text.toLowerCase();
  for (const sub of [...SUBJECTS].sort((a, b) => b.length - a.length)) {
    const i = lower.indexOf(sub.toLowerCase());
    if (i >= 0) {
      subject = sub;
      text = text.slice(0, i) + " " + text.slice(i + sub.length);
      break;
    }
  }
  const topic = text
    .replace(/(^|[\s,.:;])(пәні|пәнінен|пәнi|сыныбы|сыныбына|тақырыбы|тақырып)(?=[\s,.:;]|$)/gi, " ")
    .replace(/\s*([,.:;])(\s*[,.:;])+/g, "$1")
    .replace(/^[\s,.:;—-]+|[\s,.:;—-]+$/g, "")
    .replace(/\s{2,}/g, " ")
    .trim();
  return {
    grade: grade || prof.grades?.[0] || "5-сынып",
    subject: subject || (prof.subject && SUBJECTS.includes(prof.subject) ? prof.subject : (prof.subjects?.[0] ?? "Математика")),
    topic,
  };
}

/** ai_usage кестесіне жазу (12-жаңарту; кесте жоқ болса үнсіз өтеді). */
type UsageLog = (e: { ok: boolean; status: number; model: string; retries: number; tokens_in: number; tokens_out: number; ms: number }) => Promise<void>;

async function gemini<T>(prompt: string, schema: object, log?: UsageLog): Promise<T> {
  const key = env("GEMINI_API_KEY");
  if (!key) throw new Error("GEMINI_API_KEY орнатылмаған");
  let last = "";
  let lastStatus = 502;
  let retries = 0;
  let used = "";
  const started = Date.now();
  const done = (ok: boolean, status: number, usage?: { promptTokenCount?: number; candidatesTokenCount?: number }) =>
    log?.({ ok, status, model: used, retries, tokens_in: usage?.promptTokenCount ?? 0, tokens_out: usage?.candidatesTokenCount ?? 0, ms: Date.now() - started }).catch(() => {});
  for (const model of ["gemini-3.6-flash", "gemini-flash-latest", "gemini-2.5-flash"]) {
    used = model;
    for (let attempt = 1; attempt <= 2; attempt++) {
      const res = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${key}`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          contents: [{ role: "user", parts: [{ text: prompt }] }],
          generationConfig: { temperature: 0.8, responseMimeType: "application/json", responseSchema: schema },
        }),
      });
      if (res.ok) {
        const data = await res.json();
        const text = data?.candidates?.[0]?.content?.parts?.[0]?.text;
        await done(!!text, text ? 200 : 502, data?.usageMetadata);
        if (text) return JSON.parse(text) as T;
        last = "бос жауап";
        break;
      }
      last = `${res.status}`;
      lastStatus = res.status;
      retries++;
      if (res.status !== 503 && res.status !== 429) break;
      await new Promise((r) => setTimeout(r, 600 * attempt));
    }
  }
  await done(false, lastStatus);
  throw new Error(`AI уақытша қолжетімсіз (${last}). Сәл кейін қайталаңыз.`);
}

const S = { type: "STRING" };
const SA = { type: "ARRAY", items: S };

// ҚМЖ — сайттағы генератормен бірдей құрылым (сайт оны «Жобалардан» аша алады).
const planSchema = {
  type: "OBJECT",
  properties: {
    objectiveCode: S, objectiveText: S, goals: SA, valuesText: S,
    vocabulary: { type: "ARRAY", items: { type: "OBJECT", properties: { term: S, definition: S }, required: ["term", "definition"] } },
    stages: {
      type: "ARRAY",
      items: {
        type: "OBJECT",
        properties: {
          name: S, timeRange: S,
          rows: { type: "ARRAY", items: { type: "OBJECT", properties: { teacherAction: SA, studentAction: SA, assessmentType: S, assessmentDetail: S, resources: S }, required: ["teacherAction", "studentAction", "assessmentType", "assessmentDetail", "resources"] } },
        },
        required: ["name", "timeRange", "rows"],
      },
    },
    tasks: {
      type: "ARRAY",
      items: {
        type: "OBJECT",
        properties: {
          title: S, kind: S, method: S, level: { type: "STRING", enum: ["A", "B", "C"] }, time: S, condition: SA,
          tableTitle: S, tableHeaders: SA, tableRows: { type: "ARRAY", items: SA }, steps: SA,
          criteria: { type: "ARRAY", items: { type: "OBJECT", properties: { criterion: S, descriptors: SA }, required: ["criterion", "descriptors"] } },
          differentiation: S, expectedResultRows: { type: "ARRAY", items: SA }, expectedConclusion: S,
        },
        required: ["title", "kind", "method", "level", "time", "condition", "tableTitle", "tableHeaders", "tableRows", "steps", "criteria", "differentiation", "expectedResultRows", "expectedConclusion"],
      },
    },
    resources: { type: "ARRAY", items: { type: "OBJECT", properties: { title: S, platform: { type: "STRING", enum: ["bilimland", "youtube", "wikipedia", "okulyk", "phet", "geogebra", "wordwall", "learningapps", "kahoot", "padlet", "mentimeter", "canva", "google_forms"] }, query: S, note: S }, required: ["title", "platform", "query", "note"] } },
    planning: { type: "OBJECT", properties: { differentiation: S, assessment: S, safety: S }, required: ["differentiation", "assessment", "safety"] },
    reflection: SA,
    homework: S,
  },
  required: ["objectiveCode", "objectiveText", "goals", "valuesText", "vocabulary", "stages", "tasks", "resources", "planning", "reflection", "homework"],
};

const MONTH_VALUE: Record<number, string> = {
  9: "Еңбекқорлық және кәсіби біліктілік", 10: "Тәуелсіздік және отаншылдық", 11: "Әділдік және жауапкершілік",
  12: "Бірлік және ынтымақ", 1: "Заң және тәртіп", 2: "Жасампаздық және жаңашылдық", 3: "Тәуелсіздік және отаншылдық",
  4: "Еңбекқорлық және кәсіби біліктілік", 5: "Бірлік және ынтымақ", 6: "Еңбекқорлық және кәсіби біліктілік",
  7: "Еңбекқорлық және кәсіби біліктілік", 8: "Еңбекқорлық және кәсіби біліктілік",
};

const google = (site: string) => (q: string) => `https://www.google.com/search?q=${encodeURIComponent(`${q} site:${site}`)}`;
const PLATFORM_URL: Record<string, (q: string) => string> = {
  bilimland: google("bilimland.kz"),
  youtube: (q) => `https://www.youtube.com/results?search_query=${encodeURIComponent(q)}`,
  wikipedia: (q) => `https://kk.wikipedia.org/w/index.php?search=${encodeURIComponent(q)}`,
  okulyk: google("okulyk.kz"), phet: google("phet.colorado.edu"), geogebra: google("geogebra.org"),
  wordwall: google("wordwall.net"), learningapps: google("learningapps.org"), kahoot: google("create.kahoot.it"),
  padlet: () => "https://padlet.com", mentimeter: () => "https://www.mentimeter.com", canva: () => "https://www.canva.com",
  google_forms: () => "https://forms.google.com",
};

function today() {
  const d = new Date();
  return `${String(d.getDate()).padStart(2, "0")}.${String(d.getMonth() + 1).padStart(2, "0")}.${d.getFullYear()}`;
}

// deno-lint-ignore no-explicit-any
type Json = any;

async function generatePlan(subject: string, grade: string, topic: string, teacherName: string, log?: UsageLog): Promise<Json> {
  const value = MONTH_VALUE[new Date().getMonth() + 1];
  const prompt = `Сен тәжірибелі қазақстандық мектеп мұғалімі әрі әдіскерсің. "${subject}" пәнінен "${grade}" сыныбына, "${topic}" тақырыбына, 45 минуттық сабаққа арналған ЖОҒАРЫ САПАЛЫ, толық қысқа мерзімді жоспар (ҚМЖ) құрастыр. Сабақ түрі: аралас сабақ.
Оқу мақсатын ҮОБ-қа сай код (мыс. "5.1.2.3") және мазмұнымен бер.
ҚҰНДЫЛЫҚ: осы айдың құндылығы — «${value}»; "valuesText" осы құндылықтың сабақта қалай дарытылатынын 1–2 сөйлеммен сипатта.
"goals" — 3 саралау мақсаты ("Барлық оқушылар...", "Оқушылардың көбі...", "Кейбір оқушылар...").
"stages" — дәл 3 кезең: "Сабақтың басы", "Сабақтың ортасы", "Сабақтың соңы" (45 минут); педагог пен оқушы әрекеттері нақты, белсенді әдістер аталсын.
"tasks" — дәл 3 ТҮРЛІ тапсырма (жұптық, топтық, функционалдық сауаттылық): әдіс-тәсіл, деңгей A→C, уақыт, толық шарты, қажет болса кестесі (толтыратын ұяшықтар бос), 1–2 критерий және "Білім алушы ..." деп басталатын дескрипторлар, саралау, күтілетін нәтиже.
"vocabulary" — 4–6 пәндік термин және анықтамасы.
"resources" — 5 цифрлық ресурс: URL ЖАЗБА, тек "platform" (тізімнен) мен "query" (іздеу сөзі) және "note" (қай кезеңде).
"planning" — саралау, бағалау, денсаулық және қауіпсіздік; "reflection" — 3 сұрақ; "homework" — саралап берілген үй тапсырмасы.
Барлығы қазақ тілінде, фактілері дұрыс.`;
  const ai = await gemini<Json>(prompt, planSchema, log);
  return {
    subject, grade, topic, duration: 45,
    teacherName: teacherName || "Мұғалімнің аты-жөні",
    date: today(), section: `${subject} — ${topic}`, gradeNumber: grade.match(/\d+/)?.[0] ?? grade,
    objectiveCode: ai.objectiveCode ?? "", objectiveText: ai.objectiveText ?? "", goals: ai.goals ?? [],
    valuesTitle: value,
    valuesText: String(ai.valuesText ?? "").includes(value) ? ai.valuesText : `«${value}» — ${ai.valuesText ?? ""}`,
    stages: ai.stages ?? [],
    tasks: (ai.tasks ?? []).map((t: Json) => ({ ...t, tableHeaders: t.tableHeaders ?? [], tableRows: t.tableRows ?? [], expectedResultRows: t.expectedResultRows ?? [] })),
    lessonType: "Аралас сабақ",
    vocabulary: ai.vocabulary ?? [],
    resources: (ai.resources ?? [])
      .filter((r: Json) => PLATFORM_URL[r.platform] && r.title)
      .map((r: Json) => ({ title: r.title, platform: r.platform, url: PLATFORM_URL[r.platform](r.query || r.title), note: r.note ?? "" })),
    planning: ai.planning, reflection: ai.reflection ?? [], homework: ai.homework ?? "",
    source: "telegram",
  };
}

const testSchema = {
  type: "OBJECT",
  properties: {
    questions: {
      type: "ARRAY",
      items: { type: "OBJECT", properties: { question: S, options: SA, correctIndex: { type: "INTEGER" }, explanation: S, level: { type: "STRING", enum: ["A", "B", "C"] } }, required: ["question", "options", "correctIndex", "explanation", "level"] },
    },
  },
  required: ["questions"],
};

async function generateTest(subject: string, grade: string, topic: string, log?: UsageLog): Promise<Json> {
  const prompt = `Сен Қазақстан мектептеріне арналған тәжірибелі мұғалім-әдіскерсің. Пән: ${subject}. Сынып: ${grade}. Тақырып: ${topic}.
Дәл 10 тест сұрағын құрастыр: әр сұрақта 4 нұсқа, біреуі дұрыс; "correctIndex" 0-ден; дұрыс жауаптың орны әртүрлі.
"level": A — білу/түсіну, B — қолдану, C — жоғары деңгей дағдылары; шамамен 4 A, 4 B, 2 C, A → C ретімен.
Нұсқаларда әріп белгілерін жазба. "explanation" — бір сөйлем. Қазақ тілінде, фактілері дұрыс.`;
  const ai = await gemini<Json>(prompt, testSchema, log);
  const questions = (ai.questions ?? [])
    .filter((q: Json) => q.question && Array.isArray(q.options) && q.options.length >= 2)
    .slice(0, 10)
    .map((q: Json) => {
      const options = q.options.map((o: string) => o.replace(/^\s*[A-DА-Г][).]\s*/, "")).slice(0, 4);
      return { question: q.question, options, correctIndex: Math.min(Math.max(Number(q.correctIndex) || 0, 0), options.length - 1), explanation: q.explanation ?? "", level: ["A", "B", "C"].includes(q.level) ? q.level : "A" };
    });
  if (!questions.length) throw new Error("AI сұрақ қайтармады");
  return { subject, grade, topic, difficulty: "Орташа", questions, taskType: "levels", source: "telegram" };
}

/* ---------------------------------------------------------------- Word құжаттары */

const p = (text: string, bold = false) => new Paragraph({ children: [new TextRun({ text: String(text ?? ""), bold })], spacing: { after: 80 } });
const h = (text: string, level: (typeof HeadingLevel)[keyof typeof HeadingLevel] = HeadingLevel.HEADING_2) => new Paragraph({ text, heading: level, spacing: { before: 200, after: 100 } });
const bullet = (text: string) => new Paragraph({ text: String(text ?? ""), bullet: { level: 0 } });
const cell = (children: Paragraph[], shade = false, width?: number) =>
  new TableCell({ children: children.length ? children : [p("")], shading: shade ? { fill: "F7DFCB" } : undefined, width: width ? { size: width, type: WidthType.PERCENTAGE } : undefined });
const tbl = (rows: TableRow[]) => new Table({ width: { size: 100, type: WidthType.PERCENTAGE }, rows });
const headRow = (cols: string[]) => new TableRow({ tableHeader: true, children: cols.map((c) => cell([p(c, true)], true)) });
const textRow = (cols: string[]) => new TableRow({ children: cols.map((c) => cell([p(c)])) });

// A4, барлық шеті 1 см (567 twip) — кестелер парақтың енін толық алады.
const makeDoc = (children: (Paragraph | Table)[]) =>
  new Document({
    styles: { default: { document: { run: { font: "Times New Roman", size: 24 } } } },
    sections: [{ properties: { page: { size: { width: 11906, height: 16838 }, margin: { top: 567, bottom: 567, left: 567, right: 567 } } }, children }],
  });

async function planDocx(plan: Json): Promise<Blob> {
  const kids: (Paragraph | Table)[] = [
    new Paragraph({ text: `Қысқа мерзімді сабақ жоспары — ${plan.subject}`, heading: HeadingLevel.HEADING_1, alignment: AlignmentType.CENTER }),
    tbl(
      [
        ["Бөлім", plan.section], ["Педагогтің аты-жөні", plan.teacherName], ["Күні", plan.date],
        [`Сынып ${plan.gradeNumber}`, "Қатысушылар саны ____   Қатыспағандар саны ____"], ["Сабақтың тақырыбы", plan.topic],
        ["Оқу бағдарламасына сәйкес оқыту мақсаттары", `${plan.objectiveCode} — ${plan.objectiveText}`],
        ["Сабақтың мақсаты", plan.goals.join("\n")],
        ["Құндылықтарды дарыту", plan.valuesText],
      ].map(([a, b]) => new TableRow({ children: [cell([p(a, true)], true, 32), cell(String(b ?? "").split("\n").map((x) => p(x)), false, 68)] })),
    ),
  ];
  if (plan.vocabulary.length) kids.push(h("Пәндік лексика"), tbl([headRow(["Термин", "Анықтамасы"]), ...plan.vocabulary.map((v: Json) => textRow([v.term, v.definition]))]));
  kids.push(h("Сабақтың барысы"));
  const flow = [headRow(["Кезең / уақыт", "Педагогтің әрекеті", "Оқушының әрекеті", "Бағалау", "Ресурстар"])];
  for (const st of plan.stages)
    for (const r of st.rows ?? [])
      flow.push(new TableRow({ children: [cell([p(st.name, true), p(st.timeRange)]), cell((r.teacherAction ?? []).map(p)), cell((r.studentAction ?? []).map(p)), cell([p(r.assessmentType, true), p(r.assessmentDetail)]), cell([p(r.resources)])] }));
  kids.push(tbl(flow));
  plan.tasks.forEach((t: Json, i: number) => {
    kids.push(h(`${i + 1}-тапсырма. ${t.title}`, HeadingLevel.HEADING_3));
    kids.push(new Paragraph({ children: [new TextRun({ text: [t.kind, t.method && `Әдіс: ${t.method}`, t.level && `Деңгейі: ${t.level}`, t.time && `Уақыты: ${t.time}`].filter(Boolean).join(" · "), italics: true, color: "B85A2A" })] }));
    (t.condition ?? []).forEach((c: string) => kids.push(p(c)));
    const w = (t.tableHeaders ?? []).length;
    const fit = (r: string[]) => Array.from({ length: w }, (_, k) => r[k] ?? "");
    if (w && t.tableRows?.length) kids.push(p(t.tableTitle || "", true), tbl([headRow(t.tableHeaders), ...t.tableRows.map((r: string[]) => textRow(fit(r)))]));
    if (t.steps?.length) kids.push(p("Орындау қадамдары:", true), ...t.steps.map((x: string, k: number) => p(`${k + 1}. ${x}`)));
    kids.push(p("Бағалау критерийлері мен дескрипторлары:", true));
    kids.push(tbl([headRow(["Критерий", "Дескриптор", "Ұпай"]), ...(t.criteria ?? []).flatMap((c: Json) => (c.descriptors ?? []).map((d: string, k: number) => textRow([k === 0 ? c.criterion : "", d, "1"])))]));
    if (t.differentiation) kids.push(p("Саралау:", true), p(t.differentiation));
    kids.push(p("Күтілетін нәтиже:", true));
    if (w && t.expectedResultRows?.length) kids.push(tbl([headRow(t.tableHeaders), ...t.expectedResultRows.map((r: string[]) => textRow(fit(r)))]));
    kids.push(p(t.expectedConclusion));
  });
  if (plan.planning) {
    kids.push(p(""), tbl([headRow(["Саралау", "Бағалау", "Денсаулық және қауіпсіздік"]), textRow([plan.planning.differentiation, plan.planning.assessment, plan.planning.safety])]));
  }
  if (plan.reflection.length) kids.push(h("Рефлексия"), ...plan.reflection.map(bullet));
  if (plan.homework) kids.push(h("Үй тапсырмасы"), p(plan.homework));
  if (plan.resources.length) {
    kids.push(h("Ресурстар мен сілтемелер"));
    plan.resources.forEach((r: Json, i: number) =>
      kids.push(new Paragraph({ children: [new TextRun(`${i + 1}. `), new ExternalHyperlink({ link: r.url, children: [new TextRun({ text: r.title, style: "Hyperlink", color: "0563C1", underline: {} })] }), new TextRun(r.note ? ` — ${r.note}` : "")] })),
    );
  }
  return await Packer.toBlob(makeDoc(kids));
}

async function testDocx(test: Json): Promise<Blob> {
  const L = (i: number) => String.fromCharCode(65 + i);
  const kids: Paragraph[] = [
    new Paragraph({ text: `Тест: ${test.topic}`, heading: HeadingLevel.HEADING_1, alignment: AlignmentType.CENTER }),
    p(`${test.subject} · ${test.grade} · ${test.questions.length} сұрақ · Деңгейлер: A — білу/түсіну, B — қолдану, C — жоғары деңгей`),
    p("Оқушының аты-жөні: ______________________   Сынып: ______   Күні: ________"),
  ];
  test.questions.forEach((q: Json, i: number) => {
    kids.push(new Paragraph({ children: [new TextRun({ text: `${i + 1}. ${q.question} (${q.level})`, bold: true })], spacing: { before: 160, after: 60 } }));
    q.options.forEach((o: string, k: number) => kids.push(p(`   ${L(k)}) ${o}`)));
  });
  kids.push(new Paragraph({ text: "Жауаптар кілті", heading: HeadingLevel.HEADING_2, pageBreakBefore: true }));
  test.questions.forEach((q: Json, i: number) => kids.push(p(`${i + 1} — ${L(q.correctIndex)}) ${q.options[q.correctIndex]}. ${q.explanation}`)));
  return await Packer.toBlob(makeDoc(kids));
}

async function sendDoc(token: string, chatId: number, blob: Blob, filename: string, caption: string) {
  const form = new FormData();
  form.append("chat_id", String(chatId));
  form.append("caption", caption);
  form.append("parse_mode", "HTML");
  form.append("document", blob, filename);
  const res = await fetch(`https://api.telegram.org/bot${token}/sendDocument`, { method: "POST", body: form });
  const out = await res.json().catch(() => ({ ok: false }));
  if (!out.ok) throw new Error(out.description ?? "Файл жіберілмеді");
}

const safeName = (s: string) => s.replace(/[\\/:*?"<>|]+/g, " ").trim().slice(0, 60) || "AI Nur";

// deno-lint-ignore no-explicit-any
async function runGeneration(admin: any, token: string, chatId: number, kind: "qmzh" | "test", prof: Json, args: string, site: string) {
  const { subject, grade, topic } = parseRequest(args, prof);
  // Әкімші бекіткен пәндерден тыс материал жасалмайды (дерекқор да сақтамайды).
  const allowed: string[] = Array.isArray(prof.subjects) ? prof.subjects : [];
  if (allowed.length && !allowed.includes(subject)) {
    await send(token, chatId, `⛔ «${esc(subject)}» пәніне рұқсат жоқ. Сізге бекітілген пәндер: ${esc(allowed.join(", "))}.`);
    return;
  }
  const log: UsageLog = async (e) => {
    await admin.from("ai_usage").insert({ ...e, user_id: prof.id, source: "telegram", tool: kind });
  };
  try {
    if (kind === "qmzh") {
      const plan = await generatePlan(subject, grade, topic, prof.name, log);
      const { data: row, error } = await admin.from("projects").insert({ user_id: prof.id, kind: "qmzh", title: topic.slice(0, 300), detail: `${subject} · ${grade}`, data: plan }).select("id").single();
      if (error) throw new Error(`Сақталмады: ${error.message}`);
      const link = site ? `\n<a href="${site}/qmzh?id=${row.id}">Сайтта ашу және өңдеу</a>` : "";
      await sendDoc(token, chatId, await planDocx(plan), `KMZH - ${safeName(topic)}.docx`, `📘 <b>ҚМЖ дайын:</b> ${esc(topic)}\n${esc(subject)} · ${esc(grade)}${link}`);
    } else {
      const test = await generateTest(subject, grade, topic, log);
      const { data: row, error } = await admin.from("projects").insert({ user_id: prof.id, kind: "test", title: topic.slice(0, 300), detail: `${subject} · ${grade} · ${test.questions.length} сұрақ`, data: test }).select("id").single();
      if (error) throw new Error(`Сақталмады: ${error.message}`);
      const link = site ? `\n<a href="${site}/tests?id=${row.id}">Сайтта ашу — оқушыларға сілтеме, QR-код</a>` : "";
      await sendDoc(token, chatId, await testDocx(test), `Test - ${safeName(topic)}.docx`, `📝 <b>Тест дайын:</b> ${esc(topic)}\n${esc(subject)} · ${esc(grade)} · ${test.questions.length} сұрақ, жауап кілтімен${link}`);
    }
  } catch (e) {
    await send(token, chatId, `⚠️ Жасау мүмкін болмады: ${esc(e instanceof Error ? e.message : String(e))}`);
  }
}

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
        await send(token, chatId, "Сәлеметсіз бе! 👋 Бұл — <b>AI Nur</b> боты.\n\nҚосылу үшін сайттағы <b>Жеке бет → Telegram</b> бөлімінде «Telegram-ды қосу» батырмасын басыңыз.\n\n" + HELP);
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
        `✅ Қосылды, ${esc(prof?.name ?? "мұғалім")}!\n\nЕнді оқушыларыңыз тест тапсырған сайын осында хабарлама келеді.\n\n${HELP}`,
      );
      return new Response("ok");
    }
    if (text === "/stop") {
      await admin.from("profiles").update({ telegram_chat_id: null }).eq("telegram_chat_id", chatId);
      await send(token, chatId, "Хабарламалар өшірілді. Қайта қосу үшін сайттағы «Telegram-ды қосу» батырмасын басыңыз.");
      return new Response("ok");
    }
    const cmd = text.match(/^\/(qmzh|test|help)(?:@\w+)?\s*([\s\S]*)$/i);
    if (!cmd || cmd[1].toLowerCase() === "help") {
      await send(token, chatId, HELP);
      return new Response("ok");
    }
    const kind = cmd[1].toLowerCase() as "qmzh" | "test";
    const args = cmd[2].trim();
    // «*»: 13-жаңартудағы subjects бағаны әлі жоқ болса да сұраныс бұзылмайды.
    const { data: prof } = await admin.from("profiles").select("*").eq("telegram_chat_id", chatId).maybeSingle();
    if (!prof || prof.status !== "active") {
      await send(token, chatId, "Алдымен аккаунтыңызды қосыңыз: сайттағы <b>Жеке бет → Telegram-ды қосу</b>.");
      return new Response("ok");
    }
    if (args.replace(/\d+\s*-?\s*сынып/gi, "").trim().length < 3) {
      await send(token, chatId, `Тақырыпты жазыңыз, мысалы:\n<code>/${kind} 5-сынып Жай бөлшектерді салыстыру</code>`);
      return new Response("ok");
    }
    const since = new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString();
    const { count } = await admin.from("projects").select("id", { count: "exact", head: true }).eq("user_id", prof.id).eq("data->>source", "telegram").gte("created_at", since);
    if ((count ?? 0) >= BOT_DAILY_LIMIT) {
      await send(token, chatId, `Бот арқылы тәулігіне ${BOT_DAILY_LIMIT} материалға дейін жасауға болады. Сайтты пайдаланыңыз немесе ертең қайталаңыз.`);
      return new Response("ok");
    }
    await send(token, chatId, kind === "qmzh" ? "⏳ ҚМЖ дайындалуда... Әдетте 30–60 секунд алады." : "⏳ Тест дайындалуда... Әдетте 15–30 секунд алады.");
    const site = new URL(req.url).searchParams.get("site") ?? "";
    const job = runGeneration(admin, token, chatId, kind, prof, args, /^https:\/\/[^\s"<>]+$/.test(site) ? site.replace(/\/$/, "") : "");
    // Telegram-ға бірден жауап береміз (әйтпесе ол қайта жібереді), жұмыс фонда жалғасады.
    // @ts-expect-error EdgeRuntime тек Supabase Edge орталарында бар
    if (typeof EdgeRuntime !== "undefined") EdgeRuntime.waitUntil(job);
    else await job;
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
    const site = String(body.site ?? "");
    const siteParam = /^https:\/\/[^\s"<>?#]+$/.test(site) ? `?site=${encodeURIComponent(site)}` : "";
    const hook = await tg(token, "setWebhook", {
      url: `${supabaseUrl}/functions/v1/telegram-bot${siteParam}`,
      secret_token: secret,
      allowed_updates: ["message"],
      drop_pending_updates: true,
    });
    if (!hook.ok) return json({ error: hook.description ?? "Webhook орнатылмады" }, 400);
    await tg(token, "setMyCommands", { commands: [
        { command: "qmzh", description: "ҚМЖ жасау: /qmzh 5-сынып тақырып" },
        { command: "test", description: "Тест жасау: /test 7-сынып тақырып" },
        { command: "help", description: "Көмек" },
        { command: "stop", description: "Хабарламаларды өшіру" },
      ] });
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
