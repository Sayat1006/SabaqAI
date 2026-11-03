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
import { AlignmentType, BorderStyle, Document, ExternalHyperlink, HeadingLevel, ImageRun, LevelFormat, Packer, Paragraph, ShadingType, Table, TableCell, TableLayoutType, TableRow, TextRun, WidthType } from "npm:docx@9";
// @ts-expect-error Deno жаһандық объектісі тек Supabase Edge орталарында бар
import QRCode from "npm:qrcode@1.5.4";

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

// ҚМЖ — сайттағы генератормен бірдей құрылым (мектептің ресми үлгісі, format: 2),
// сондықтан сайт оны «Жобалардан» ашып, өңдей алады.
const PLATFORM_KEYS = ["bilimland", "youtube", "wikipedia", "okulyk", "phet", "geogebra", "wordwall", "learningapps", "kahoot", "padlet", "mentimeter", "canva", "google_forms", "opiq"];
const planSchema = {
  type: "OBJECT",
  properties: {
    objectives: { type: "ARRAY", items: { type: "OBJECT", properties: { code: S, text: S }, required: ["code", "text"] } },
    goals: SA,
    valuesQuote: S,
    valuesText: S,
    stages: { type: "ARRAY", items: { type: "OBJECT", properties: { purpose: S, teacher: SA, student: SA, assessment: SA, resources: SA }, required: ["purpose", "teacher", "student", "assessment", "resources"] } },
    planning: { type: "OBJECT", properties: { differentiation: SA, support: SA, assessment: S, safety: S }, required: ["differentiation", "support", "assessment", "safety"] },
    answerKey: { type: "ARRAY", items: { type: "OBJECT", properties: { level: { type: "STRING", enum: ["A", "B", "C"] }, answer: S }, required: ["level", "answer"] } },
    resources: { type: "ARRAY", items: { type: "OBJECT", properties: { platform: { type: "STRING", enum: PLATFORM_KEYS }, title: S }, required: ["platform", "title"] } },
  },
  required: ["objectives", "goals", "valuesQuote", "valuesText", "stages", "planning", "answerKey", "resources"],
};

const MONTH_VALUE: Record<number, string> = {
  9: "Еңбекқорлық және кәсіби біліктілік", 10: "Тәуелсіздік және отаншылдық", 11: "Әділдік және жауапкершілік",
  12: "Бірлік және ынтымақ", 1: "Заң және тәртіп", 2: "Жасампаздық және жаңашылдық", 3: "Тәуелсіздік және отаншылдық",
  4: "Еңбекқорлық және кәсіби біліктілік", 5: "Бірлік және ынтымақ", 6: "Еңбекқорлық және кәсіби біліктілік",
  7: "Еңбекқорлық және кәсіби біліктілік", 8: "Еңбекқорлық және кәсіби біліктілік",
};

// Сайттағы resources.ts-пен бірдей: QR-код платформаның сенімді басты бетіне апарады.
const PLATFORM: Record<string, { label: string; home: string }> = {
  bilimland: { label: "BilimLand", home: "https://bilimland.kz/" }, youtube: { label: "YouTube", home: "https://www.youtube.com/" },
  wikipedia: { label: "Уикипедия", home: "https://kk.wikipedia.org/" }, okulyk: { label: "Okulyk.kz", home: "https://okulyk.kz/" },
  phet: { label: "PhET", home: "https://phet.colorado.edu/" }, geogebra: { label: "GeoGebra", home: "https://www.geogebra.org/" },
  wordwall: { label: "Wordwall", home: "https://wordwall.net/" }, learningapps: { label: "LearningApps", home: "https://learningapps.org/" },
  kahoot: { label: "Kahoot!", home: "https://kahoot.com/" }, padlet: { label: "Padlet", home: "https://padlet.com/" },
  mentimeter: { label: "Mentimeter", home: "https://www.mentimeter.com/" }, canva: { label: "Canva", home: "https://www.canva.com/" },
  google_forms: { label: "Google Forms", home: "https://forms.google.com/" }, opiq: { label: "OPIQ", home: "https://www.opiq.kz/" },
};

// Үлгідегі 6 кезең: атауы, мақсаты және 45 минуттағы уақыты.
const STAGES = [
  { name: "Сабақтың басы", purpose: "Ұйымдастыру, қызығушылықты ояту, мақсат қою", minutes: 6 },
  { name: "Сабақтың ортасы", purpose: "Жаңа білімді меңгеру", minutes: 12 },
  { name: "Сабақтың ортасы", purpose: "Бекіту, жаттығу", minutes: 7 },
  { name: "Сергіту сәті", purpose: "", minutes: 2 },
  { name: "Сабақтың ортасы", purpose: "Деңгейлік тапсырмалар (жеке жұмыс)", minutes: 11 },
  { name: "Сабақтың соңы", purpose: "Бекіту, рефлексия, үй тапсырмасы", minutes: 7 },
];

function today() {
  const d = new Date();
  return `${String(d.getDate()).padStart(2, "0")}.${String(d.getMonth() + 1).padStart(2, "0")}.${d.getFullYear()}`;
}

// deno-lint-ignore no-explicit-any
type Json = any;

const clean = (list: unknown): string[] => (Array.isArray(list) ? list.map((x) => String(x ?? "").trim()).filter(Boolean) : []);

async function generatePlan(subject: string, grade: string, topic: string, teacherName: string, log?: UsageLog): Promise<Json> {
  const value = MONTH_VALUE[new Date().getMonth() + 1];
  const st = (i: number) => `«${STAGES[i].name}» — ${STAGES[i].minutes} мин${STAGES[i].purpose ? `, «${STAGES[i].purpose}»` : ""}`;
  const prompt = `Сен тәжірибелі қазақстандық мектеп мұғалімі әрі әдіскерсің. "${subject}" пәнінен "${grade}" сыныбына, "${topic}" тақырыбына, 45 минуттық сабаққа арналған қысқа мерзімді жоспарды (ҚМЖ) МЕКТЕПТІҢ РЕСМИ ҮЛГІСІ бойынша ҚАТАҢ толтыр. Сабақ түрі: аралас сабақ.
МӘТІН БЕЛГІЛЕРІ: әр массив элементі — ұяшықтағы бір абзац. Қалың мәтінді **...** арқылы белгіле. Тізім пунктін «• » белгісімен баста. Басқа markdown қолданба.
1. "objectives" — ҮОБ-қа сай 1–3 оқыту мақсаты: "code" (мыс. "10.1.2.1") және "text" (мазмұны кіші әріппен).
2. "goals" — SMART мақсаттар, 3–4 жол; әрқайсысы өлшенетін етістікпен (мыс. "жүйелік және кездейсоқ қателіктерді ажыратады").
3. Осы айдың құндылығы — «${value}». "valuesQuote" — осы құндылыққа сай нақыл сөз, авторымен; "valuesText" — құндылықтың сабақта қалай жүзеге асатыны, бір сөйлем.
4. "stages" — ДӘЛ 6 элемент, ретімен ("purpose" — көрсетілген мақсат):
   1) ${st(0)}: "teacher" — **Ұйымдастыру кезеңі.** …; **Білімді өзектендіру: «әдіс».** …; **Құндылыққа баулу:** (нақыл сөз); **Проблемалық жағдаят:** …; болжамдар арқылы тақырып пен мақсат анықталады. "student" — 2 жол. "assessment" — **Қалыптастырушы бағалау:** әдісі.
   2) ${st(1)}: "teacher" — **Жаңа білімді меңгеру: «белсенді әдіс».** ұйымдастырылуы, одан кейін «• » арқылы тақырыптың НАҚТЫ мазмұны 3–5 пункт. "assessment" — **Дескриптор:**, «• » 2 дескриптор, **2 балл**.
   3) ${st(2)}: "teacher" — **«әдіс» (жұптық жұмыс).** …; **Тапсырма:** нақты деректері бар тапсырма. "assessment" — **Дескриптор:**, «• » 1 дескриптор, **1 балл**.
   4) ${st(3)}: "teacher" — **«жаттығу атауы».** сипаттамасы; "student" — 1 жол; "assessment" — ["–"]; "resources" — ["–"]; "purpose" — "".
   5) ${st(4)}: "teacher" — **Саралау «Таңдау» арқылы:** …; **А деңгейі (білу, түсіну) – жасыл карта.** + тапсырма; **В деңгейі (қолдану) – сары карта.** + тапсырма; **С деңгейі (талдау, жинақтау) – қызыл карта.** + тапсырма; **ЕББҚ оқушыларына:** … "assessment" — **Дескриптор:**, **А:** … – **2 балл**, **В:** … – **3 балл**, **С:** … – **4 балл**.
   6) ${st(5)}: "teacher" — **Бекіту: онлайн-викторина** және «• » 3 сұрақ үлгісі (жауабымен); **Рефлексия: «әдіс»** – …; **Үй тапсырмасы (сараланған):**, «• **А:** …», «• **В:** …», «• **С:** …». "assessment" — **Дескриптор:**, «• » … – **3 балл**, **Шкала (10 балл):** 9–10 «Өте жақсы», 7–8 «Жақсы», 5–6 «Қанағаттанарлық», 0–4 «Қолдау қажет».
   Әр кезеңде "resources" — 1–3 нақты ресурс атауы.
5. "planning": "differentiation" — 4 жол (**Тапсырма арқылы:**, **Таңдау арқылы:**, **Қолдау арқылы:**, **Қабілетті оқушыларға:**); "support" — 3 жол (**Оқу қиындығы:**, **Көру/есту қабілеті:**, **Зейін тапшылығы:**); "assessment" мен "safety" — бір-бір сөйлем.
6. "answerKey" — 5-кезеңдегі А, В, С тапсырмаларының дұрыс жауаптары (level: A, B, C).
7. "resources" — ДӘЛ 3 сандық ресурс: "platform" (тізімнен) және "title" — қысқа түрі (мыс. "викторина", "видеосабақ", "цифрлық оқулық"). URL жазба.
Барлығы қазақ тілінде, фактілері дұрыс, сынып деңгейіне сай.`;
  const ai = await gemini<Json>(prompt, planSchema, log);
  const objectives = (ai.objectives ?? []).map((o: Json) => ({ code: String(o.code ?? "").trim(), text: String(o.text ?? "").trim() })).filter((o: Json) => o.text);
  const objs = objectives.length ? objectives : [{ code: "", text: `«${topic}» тақырыбы бойынша негізгі ұғымдарды меңгеру` }];
  const stages = STAGES.map((f, i) => {
    const x = ai.stages?.[i] ?? {};
    const assessment = clean(x.assessment);
    const resources = clean(x.resources);
    return {
      name: f.name, timeRange: `${f.minutes} минут`, purpose: i === 3 ? "" : String(x.purpose ?? "").trim() || f.purpose,
      rows: [{ teacherAction: clean(x.teacher), studentAction: clean(x.student), assessmentType: "", assessmentDetail: "", assessment: assessment.length ? assessment : ["–"], resources: (resources.length ? resources : ["–"]).join("\n") }],
    };
  });
  const pl = ai.planning ?? {};
  return {
    subject, grade, topic, duration: 45, format: 2, approver: "",
    teacherName: teacherName || "Мұғалімнің аты-жөні",
    date: today(), section: subject, gradeNumber: grade.match(/\d+/)?.[0] ?? grade,
    objectiveCode: objs[0].code, objectiveText: objs[0].text, objectives: objs,
    goals: clean(ai.goals), valuesTitle: value, valuesQuote: String(ai.valuesQuote ?? "").trim(), valuesText: String(ai.valuesText ?? "").trim(),
    stages, tasks: [], lessonType: "Аралас сабақ",
    planning: { differentiation: clean(pl.differentiation).join("\n"), support: clean(pl.support).join("\n"), assessment: String(pl.assessment ?? ""), safety: String(pl.safety ?? "") },
    answerKey: (ai.answerKey ?? []).map((k: Json) => ({ level: ["A", "B", "C"].includes(k.level) ? k.level : "A", answer: String(k.answer ?? "").trim() })).filter((k: Json) => k.answer),
    resources: (ai.resources ?? [])
      .filter((r: Json) => PLATFORM[r.platform])
      .slice(0, 3)
      .map((r: Json) => ({ title: String(r.title ?? "").trim() || "ресурс", platform: r.platform, url: PLATFORM[r.platform].home, note: "" })),
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
// A4, барлық шеті 1 см (567 twip) — кестелер парақтың енін толық алады.
const makeDoc = (children: (Paragraph | Table)[]) =>
  new Document({
    styles: { default: { document: { run: { font: "Times New Roman", size: 24 } } } },
    sections: [{ properties: { page: { size: { width: 11906, height: 16838 }, margin: { top: 567, bottom: 567, left: 567, right: 567 } } }, children }],
  });

// Ресми ҚМЖ үлгісі: A4, шеттері 1,27 см, Times New Roman 11 pt, бағандар ені үлгідегідей
// (сайттағы exportDocx.ts → exportTemplateQmzh-пен бірдей).
const TF = "Times New Roman";
const TS = 22;
const tb = { style: BorderStyle.SINGLE, size: 4, color: "auto" };
const tRun = (text: string, o: Json = {}) => new TextRun({ text, font: TF, size: TS, ...o });
function tPara(raw: string, o: Json = {}) {
  let line = String(raw ?? "").trim();
  let bullet = false;
  if (/^\*\*\s*•\s*/.test(line)) { bullet = true; line = "**" + line.replace(/^\*\*\s*•\s*/, ""); }
  else if (/^\s*[•●▪◦]\s*/.test(line)) { bullet = true; line = line.replace(/^\s*[•●▪◦]\s*/, ""); }
  const runs: Json[] = [];
  line.split(/(\*\*.+?\*\*)/g).filter(Boolean).forEach((part) => {
    const bold = /^\*\*.+\*\*$/.test(part);
    const text = part.replace(/\*\*/g, "");
    if (text) runs.push(tRun(text, { bold: o.bold || bold || undefined, italics: o.italics }));
  });
  return new Paragraph({ spacing: { after: 0, line: 240 }, alignment: o.align, numbering: bullet ? { reference: "qmzh-bullet", level: 0 } : undefined, children: runs });
}
const tLines = (lines: string[]) => { const l = (lines ?? []).map((x) => String(x ?? "").trim()).filter(Boolean); return l.length ? l.map((x) => tPara(x)) : [tPara("")]; };
const split = (s: string) => String(s ?? "").split(/\r?\n/).map((x) => x.trim()).filter(Boolean);
const tCell = (children: Paragraph[], width: number, o: Json = {}) =>
  new TableCell({ width: { size: width, type: WidthType.DXA }, columnSpan: o.span, margins: { top: 30, bottom: 30, left: 80, right: 80 }, shading: o.fill ? { type: ShadingType.CLEAR, color: "auto", fill: o.fill } : undefined, children });
const tTable = (widths: number[], rows: TableRow[]) =>
  new Table({ width: { size: 10466, type: WidthType.DXA }, columnWidths: widths, layout: TableLayoutType.FIXED, borders: { top: tb, bottom: tb, left: tb, right: tb, insideHorizontal: tb, insideVertical: tb }, rows });
const tHead = (widths: number[], titles: string[]) => new TableRow({ tableHeader: true, children: titles.map((t, i) => tCell([tPara(t, { bold: true, align: AlignmentType.CENTER })], widths[i], { fill: "D9E2F3" })) });
const tHeading = (text: string) => new Paragraph({ keepNext: true, spacing: { before: 120, after: 40 }, children: [tRun(text, { bold: true })] });

async function qrPng(url: string): Promise<Uint8Array | null> {
  try {
    const dataUrl: string = await QRCode.toDataURL(url, { width: 240, margin: 1, errorCorrectionLevel: "M" });
    const bin = atob(dataUrl.split(",")[1]);
    return Uint8Array.from(bin, (c) => c.charCodeAt(0));
  } catch {
    return null;
  }
}

async function planDocx(plan: Json): Promise<Blob> {
  const IW = [2700, 3883, 3883];
  const info = (label: string, value: Paragraph[]) => new TableRow({ children: [tCell([tPara(label, { bold: true })], IW[0]), tCell(value, IW[1] + IW[2], { span: 2 })] });
  const date = /\d$/.test(plan.date) ? `${plan.date} ж.` : plan.date;
  const kids: (Paragraph | Table)[] = [
    tPara("Бекітемін:"),
    tPara(`Оқу ісі жөніндегі орынбасары: ${plan.approver || "____________________"}`),
    tPara(""),
    tTable(IW, [
      info("Бөлім:", [tPara(plan.section)]),
      info("Педагогтың аты-жөні:", [tPara(plan.teacherName)]),
      info("Күні:", [tPara(date)]),
      new TableRow({ children: [tCell([new Paragraph({ children: [tRun("Сынып:", { bold: true }), tRun(` ${plan.gradeNumber}`)] })], IW[0]), tCell([tPara("Қатысушылар саны:")], IW[1]), tCell([tPara("Қатыспағандар саны:")], IW[2])] }),
      info("Сабақтың тақырыбы:", [tPara(plan.topic, { bold: true })]),
      info("Оқу бағдарламасына сәйкес оқыту мақсаттары:", tLines(plan.objectives.map((o: Json) => (o.code ? `${o.code} - ${o.text}` : o.text)))),
      info("Сабақтың мақсаты (SMART):", tLines(plan.goals)),
      info("Құндылықтарға баулу:", [
        new Paragraph({ children: [tRun("«Адал азамат» бағдарламасы бойынша: "), tRun(plan.valuesTitle, { bold: true }), tRun(".")] }),
        ...(plan.valuesQuote ? [tPara(plan.valuesQuote, { italics: true })] : []),
        tPara(plan.valuesText),
      ]),
    ]),
    tHeading("Сабақтың барысы:"),
  ];
  const FW = [1250, 3900, 2200, 1900, 1216];
  const flow = [tHead(FW, ["Сабақтың кезеңі / уақыты", "Педагогтың әрекеті", "Оқушының әрекеті", "Бағалау (дескрипторлар)", "Ресурстар"])];
  for (const st of plan.stages)
    for (const r of st.rows ?? [])
      flow.push(new TableRow({ children: [
        tCell([tPara(st.name, { bold: true }), tPara(st.timeRange, { bold: true }), ...(st.purpose ? [tPara(st.purpose, { italics: true })] : [])], FW[0], { fill: "F2F2F2" }),
        tCell(tLines(r.teacherAction), FW[1]), tCell(tLines(r.studentAction), FW[2]), tCell(tLines(r.assessment ?? []), FW[3]), tCell(tLines(split(r.resources)), FW[4]),
      ] }));
  kids.push(tTable(FW, flow));
  const PW = [2718, 2990, 2378, 2380];
  const pl = plan.planning ?? {};
  kids.push(tHeading("Саралау, ЕББҚ қолдау, бағалау және қауіпсіздік"),
    tTable(PW, [tHead(PW, ["Саралау", "ЕББҚ оқушыларына қолдау", "Бағалау", "Денсаулық және қауіпсіздік"]), new TableRow({ children: [pl.differentiation, pl.support, pl.assessment, pl.safety].map((v, i) => tCell(tLines(split(v)), PW[i])) })]));
  if (plan.answerKey?.length) {
    const KW = [815, 9651];
    const LV: Record<string, string> = { A: "А", B: "В", C: "С" };
    kids.push(tHeading("Деңгейлік тапсырмалардың жауап кілті"), tTable(KW, [tHead(KW, ["Деңгей", "Дұрыс жауап"]), ...plan.answerKey.map((k: Json) => new TableRow({ children: [tCell([tPara(LV[k.level] ?? k.level, { bold: true })], KW[0]), tCell(tLines(split(k.answer)), KW[1])] }))]));
  }
  if (plan.resources?.length) {
    const RW = [3488, 3488, 3490];
    const imgs = await Promise.all(plan.resources.map((r: Json) => qrPng(r.url)));
    const rows: TableRow[] = [];
    for (let i = 0; i < plan.resources.length; i += 3)
      rows.push(new TableRow({ children: RW.map((w, c) => {
        const r = plan.resources[i + c];
        if (!r) return tCell([tPara("")], w);
        const img = imgs[i + c];
        return tCell([
          new Paragraph({ children: [tRun(PLATFORM[r.platform]?.label ?? r.title, { bold: true }), tRun(` – ${r.title}`)] }),
          new Paragraph({ children: [new ExternalHyperlink({ link: r.url, children: [new TextRun({ text: r.url, font: TF, size: TS, color: "0563C1", underline: {} })] })] }),
          ...(img ? [new Paragraph({ alignment: AlignmentType.CENTER, children: [new ImageRun({ type: "png", data: img, transformation: { width: 56, height: 56 } })] })] : []),
        ], w);
      }) }));
    kids.push(tHeading("Сандық ресурстар (QR-кодтар)"), tTable(RW, rows));
  }
  const doc = new Document({
    styles: { default: { document: { run: { font: TF, size: TS }, paragraph: { spacing: { after: 0, line: 240 } } } } },
    numbering: { config: [{ reference: "qmzh-bullet", levels: [{ level: 0, format: LevelFormat.BULLET, text: "•", alignment: AlignmentType.LEFT, style: { paragraph: { indent: { left: 284, hanging: 227 } } } }] }] },
    sections: [{ properties: { page: { size: { width: 11906, height: 16838 }, margin: { top: 720, right: 720, bottom: 720, left: 720 } } }, children: kids }],
  });
  return await Packer.toBlob(doc);
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
