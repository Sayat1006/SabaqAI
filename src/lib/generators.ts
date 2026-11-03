// ҚМЖ генераторы: Gemini арқылы (ai-generate Edge Function), AI қолжетімсіз болса —
// үлгі негізіндегі нұсқа. Сондай-ақ ҚМЖ-дан слайдтар құрастыру.

import { aiGenerateJson, isLimitError } from "./ai";
import { subjectIn, type Lang } from "./lang";
import { curriculum } from "./curriculum";
import { PLATFORM_KEYS, templateResource, type QmzhResource } from "./resources";
import { plainText } from "./qmzhText";

export type { QmzhResource } from "./resources";

export interface QmzhActivityRow {
  teacherAction: string[];
  studentAction: string[];
  assessmentType: string;
  assessmentDetail: string;
  /** Ресурстар; үлгі нұсқасында әр жол — бір ресурс. */
  resources: string;
  /** Үлгі нұсқасы: «Бағалау (дескрипторлар)» ұяшығының жолдары (**қалың**, «• » тізім). */
  assessment?: string[];
}

export interface QmzhStage {
  name: string;
  timeRange: string;
  /** Үлгі нұсқасы: кезеңнің мақсаты (мыс. «Жаңа білімді меңгеру»), курсивпен шығады. */
  purpose?: string;
  rows: QmzhActivityRow[];
}

export interface QmzhCriterion {
  criterion: string;
  descriptors: string[];
}

export interface QmzhTask {
  title: string;
  /** Жұмыс түрі: жеке, жұптық, топтық, практикалық т.б. */
  kind?: string;
  /** Әдіс-тәсіл: «Джигсо», «INSERT», «Ойлан — жұптас — бөліс» т.б. */
  method?: string;
  level?: "A" | "B" | "C";
  time?: string;
  condition: string[];
  tableTitle: string;
  tableHeaders: string[];
  tableRows: string[][];
  steps: string[];
  criteria: QmzhCriterion[];
  differentiation: string;
  expectedResultRows: string[][];
  expectedConclusion: string;
}

export interface LessonPlan {
  subject: string;
  grade: string;
  topic: string;
  duration: number;
  teacherName: string;
  date: string;
  section: string;
  gradeNumber: string;
  objectiveCode: string;
  objectiveText: string;
  goals: string[];
  valuesTitle: string;
  valuesText: string;
  stages: QmzhStage[];
  tasks: QmzhTask[];
  // Төмендегі өрістер кеңейтілген ҚМЖ-да ғана бар (ескі жоспарларда болмауы мүмкін).
  lessonType?: string;
  methods?: string[];
  successCriteria?: string[];
  vocabulary?: { term: string; definition: string }[];
  interdisciplinary?: string;
  priorKnowledge?: string;
  resources?: QmzhResource[];
  planning?: { differentiation: string; assessment: string; safety: string; support?: string };
  reflection?: string[];
  homework?: string;
  /** Жоспар тілі (жоқ болса — қазақша). */
  lang?: Lang;
  /**
   * 2 — мектептің ресми ҚМЖ үлгісі бойынша жасалған жоспар: бекіту жолы, бірнеше оқыту мақсаты,
   * 6 кезеңдік «Сабақтың барысы», ЕББҚ қолдауы, жауап кілті және QR-кодты сандық ресурстар.
   * Жоқ болса — бұрынғы құрылым (бөлек тапсырмалар, сөздік, рефлексия).
   */
  format?: 2;
  /** Бекітуші — оқу ісі жөніндегі орынбасардың аты-жөні. */
  approver?: string;
  objectives?: { code: string; text: string }[];
  /** «Құндылықтарға баулу» жолындағы нақыл сөз (авторымен). */
  valuesQuote?: string;
  answerKey?: { level: string; answer: string }[];
}

export const isTemplatePlan = (p: LessonPlan) => p.format === 2;

export const LESSON_TYPES = ["Аралас сабақ", "Жаңа білімді меңгерту", "Білімді бекіту", "Қайталау-жинақтау", "Практикалық сабақ", "Зерттеу сабағы"] as const;

export const TASK_KINDS = [
  "Жеке жұмыс",
  "Жұптық жұмыс",
  "Топтық жұмыс",
  "Практикалық / зертханалық",
  "Дидактикалық ойын",
  "Функционалдық сауаттылық",
  "Шығармашылық тапсырма",
  "Зерттеу тапсырмасы",
] as const;

// «Адал азамат» тұжырымдамасы бойынша әр айдың құндылығы. ҚМЖ-дағы «Құндылықтарды дарыту»
// жолы сабақ күнінің айына сай осы тізімнен алынады.
const VALUE_TEXTS = {
  labor: {
    title: "Еңбекқорлық және кәсіби біліктілік",
    text: "тапсырманы ұқыпты әрі тиянақты орындау, еңбекті құрметтеу және білімін кәсіби біліктілікке айналдыруға ұмтылу арқылы дарытылады.",
    ruTitle: "Трудолюбие и профессионализм",
    ruText: "прививается через аккуратное и добросовестное выполнение заданий, уважение к труду и стремление превращать знания в профессиональные навыки.",
    enTitle: "Hard work and professionalism",
    enText: "is fostered through careful, diligent work on tasks, respect for labour and turning knowledge into professional skills.",
  },
  independence: {
    title: "Тәуелсіздік және отаншылдық",
    text: "Отанның тарихы мен жетістіктерін құрметтеу, еліміздің дамуына өз үлесін қосуға ұмтылу арқылы дарытылады.",
    ruTitle: "Независимость и патриотизм",
    ruText: "прививается через уважение к истории и достижениям Родины, стремление внести свой вклад в развитие страны.",
    enTitle: "Independence and patriotism",
    enText: "is fostered through respect for the history and achievements of the Motherland and the wish to contribute to the country’s development.",
  },
  justice: {
    title: "Әділдік және жауапкершілік",
    text: "өзінің және сыныптастарының жұмысын әділ бағалау, өз әрекеті мен шешімі үшін жауапкершілік алу арқылы дарытылады.",
    ruTitle: "Справедливость и ответственность",
    ruText: "прививается через честное оценивание своей работы и работы одноклассников, ответственность за свои действия и решения.",
    enTitle: "Justice and responsibility",
    enText: "is fostered through fair assessment of one’s own and classmates’ work and taking responsibility for one’s actions and decisions.",
  },
  unity: {
    title: "Бірлік және ынтымақ",
    text: "жұптық және топтық жұмыста бір-бірін тыңдау, пікірді құрметтеу және ортақ нәтижеге бірге жету арқылы дарытылады.",
    ruTitle: "Единство и солидарность",
    ruText: "прививается через умение слушать друг друга в парной и групповой работе, уважать мнение других и вместе достигать общего результата.",
    enTitle: "Unity and solidarity",
    enText: "is fostered by listening to each other in pair and group work, respecting opinions and reaching a shared result together.",
  },
  law: {
    title: "Заң және тәртіп",
    text: "сабақ ережелері мен қауіпсіздік талаптарын сақтау, уақытты тиімді пайдалану арқылы дарытылады.",
    ruTitle: "Закон и порядок",
    ruText: "прививается через соблюдение правил урока и требований безопасности, эффективное использование времени.",
    enTitle: "Law and order",
    enText: "is fostered by following lesson rules and safety requirements and using time efficiently.",
  },
  creativity: {
    title: "Жасампаздық және жаңашылдық",
    text: "жаңа идеялар ұсыну, шығармашылықпен ойлау және білімін жаңа жағдаятта қолдану арқылы дарытылады.",
    ruTitle: "Созидание и новаторство",
    ruText: "прививается через выдвижение новых идей, творческое мышление и применение знаний в новой ситуации.",
    enTitle: "Creativity and innovation",
    enText: "is fostered by proposing new ideas, thinking creatively and applying knowledge in new situations.",
  },
} as const;

/** Ай нөмірі (1–12) → құндылық. Жазғы айларда қыркүйектің құндылығы алынады. */
const MONTH_VALUES: Record<number, keyof typeof VALUE_TEXTS> = {
  9: "labor",
  10: "independence",
  11: "justice",
  12: "unity",
  1: "law",
  2: "creativity",
  3: "independence",
  4: "labor",
  5: "unity",
  6: "labor",
  7: "labor",
  8: "labor",
};

/** Сабақ күніне (кк.аа.жжжж) сай айдың құндылығы; күні түсініксіз болса — бүгінгі ай. */
export function monthlyValue(date: string, lang?: Lang): { title: string; text: string } {
  const m = date.match(/(\d{1,2})[./-](\d{1,2})[./-](\d{2,4})/);
  const month = m && Number(m[2]) >= 1 && Number(m[2]) <= 12 ? Number(m[2]) : new Date().getMonth() + 1;
  const v = VALUE_TEXTS[MONTH_VALUES[month]];
  return lang === "ru" ? { title: v.ruTitle, text: v.ruText } : lang === "en" ? { title: v.enTitle, text: v.enText } : { title: v.title, text: v.text };
}

function findObjective(subject: string, grade: string): { code: string; text: string } | null {
  const entry = curriculum.find((s) => s.subject === subject);
  if (!entry) return null;
  const byGrade = entry.objectives.find((o) => o.grade === grade);
  const obj = byGrade ?? entry.objectives[0];
  return obj ? { code: obj.code, text: obj.text } : null;
}

function gradeToNumber(grade: string): string {
  const match = grade.match(/\d+/);
  return match ? match[0] : grade;
}

function formatToday(): string {
  const d = new Date();
  const dd = String(d.getDate()).padStart(2, "0");
  const mm = String(d.getMonth() + 1).padStart(2, "0");
  return `${dd}.${mm}.${d.getFullYear()}`;
}

// ---------------------------------------------------------------------------------------------
// ҚМЖ ресми үлгісі (2-нұсқа). Құрылым мұғалім берген үлгіден алынды және қатаң сақталады:
// бекіту жолы → жалпы мәліметтер кестесі → «Сабақтың барысы» (6 кезең) → саралау, ЕББҚ қолдау,
// бағалау және қауіпсіздік → деңгейлік тапсырмалардың жауап кілті → сандық ресурстар (QR).

interface ScaffoldStage {
  name: string;
  purpose: string;
  minutes: number;
}

/** Үлгідегі 45 минуттық сабақтың уақыт үлесі: 6 + 12 + 7 + 2 + 11 + 7. */
const STAGE_SHARE = [6, 12, 7, 2, 11, 7];

const STAGE_TEXT: Record<Lang, { name: string; purpose: string }[]> = {
  kk: [
    { name: "Сабақтың басы", purpose: "Ұйымдастыру, қызығушылықты ояту, мақсат қою" },
    { name: "Сабақтың ортасы", purpose: "Жаңа білімді меңгеру" },
    { name: "Сабақтың ортасы", purpose: "Бекіту, жаттығу" },
    { name: "Сергіту сәті", purpose: "" },
    { name: "Сабақтың ортасы", purpose: "Деңгейлік тапсырмалар (жеке жұмыс)" },
    { name: "Сабақтың соңы", purpose: "Бекіту, рефлексия, үй тапсырмасы" },
  ],
  ru: [
    { name: "Начало урока", purpose: "Организация, мотивация, целеполагание" },
    { name: "Середина урока", purpose: "Изучение нового материала" },
    { name: "Середина урока", purpose: "Закрепление, практика" },
    { name: "Физминутка", purpose: "" },
    { name: "Середина урока", purpose: "Разноуровневые задания (индивидуальная работа)" },
    { name: "Конец урока", purpose: "Закрепление, рефлексия, домашнее задание" },
  ],
  en: [
    { name: "Beginning of the lesson", purpose: "Organisation, engagement, setting objectives" },
    { name: "Middle of the lesson", purpose: "Learning new material" },
    { name: "Middle of the lesson", purpose: "Consolidation, practice" },
    { name: "Brain break", purpose: "" },
    { name: "Middle of the lesson", purpose: "Levelled tasks (individual work)" },
    { name: "End of the lesson", purpose: "Consolidation, reflection, homework" },
  ],
};

/** Сабақ ұзақтығына сай 6 кезеңнің минуттары (қосындысы ұзақтыққа дәл тең). */
export function stageMinutes(duration: number): number[] {
  const total = Math.min(Math.max(Math.round(duration) || 45, 20), 90);
  const mins = STAGE_SHARE.map((m) => Math.max(1, Math.round((m * total) / 45)));
  mins[1] += total - mins.reduce((a, b) => a + b, 0);
  return mins;
}

function scaffold(duration: number, lang: Lang = "kk"): ScaffoldStage[] {
  const mins = stageMinutes(duration);
  return STAGE_TEXT[lang].map((s, i) => ({ ...s, minutes: mins[i] }));
}

const minutesLabel = (n: number, lang: Lang = "kk") => (lang === "en" ? `${n} min` : `${n} минут`);

const SA = { type: "ARRAY", items: { type: "STRING" } };

const templateStageAiSchema = {
  type: "OBJECT",
  properties: {
    purpose: { type: "STRING" },
    teacher: SA,
    student: SA,
    assessment: SA,
    resources: SA,
  },
  required: ["purpose", "teacher", "student", "assessment", "resources"],
};

const templatePlanAiSchema = {
  type: "OBJECT",
  properties: {
    objectives: {
      type: "ARRAY",
      items: { type: "OBJECT", properties: { code: { type: "STRING" }, text: { type: "STRING" } }, required: ["code", "text"] },
    },
    goals: SA,
    valuesQuote: { type: "STRING" },
    valuesText: { type: "STRING" },
    stages: { type: "ARRAY", items: templateStageAiSchema },
    planning: {
      type: "OBJECT",
      properties: { differentiation: SA, support: SA, assessment: { type: "STRING" }, safety: { type: "STRING" } },
      required: ["differentiation", "support", "assessment", "safety"],
    },
    answerKey: {
      type: "ARRAY",
      items: {
        type: "OBJECT",
        properties: { level: { type: "STRING", enum: ["A", "B", "C"] }, answer: { type: "STRING" } },
        required: ["level", "answer"],
      },
    },
    resources: {
      type: "ARRAY",
      items: {
        type: "OBJECT",
        properties: { platform: { type: "STRING", enum: PLATFORM_KEYS }, title: { type: "STRING" } },
        required: ["platform", "title"],
      },
    },
  },
  required: ["objectives", "goals", "valuesQuote", "valuesText", "stages", "planning", "answerKey", "resources"],
};

interface TemplateAiContent {
  objectives?: { code?: string; text?: string }[];
  goals?: string[];
  valuesQuote?: string;
  valuesText?: string;
  stages?: { purpose?: string; teacher?: string[]; student?: string[]; assessment?: string[]; resources?: string[] }[];
  planning?: { differentiation?: string[]; support?: string[]; assessment?: string; safety?: string };
  answerKey?: { level?: string; answer?: string }[];
  resources?: { platform?: string; title?: string }[];
}

export interface LessonPlanOptions {
  lessonType?: string;
  notes?: string;
  lang?: Lang;
  /** Бекітуші — оқу ісі жөніндегі орынбасар. */
  approver?: string;
}

/** Мұғалім енгізген мақсаттар: әр жолда «7.2.1.4 - мазмұны». */
function parseObjectiveLines(input: string): { code: string; text: string }[] {
  return input
    .split(/\r?\n/)
    .map((l) => l.trim())
    .filter(Boolean)
    .map((l) => {
      const m = l.match(/^(\d+(?:\.\d+){2,4})\s*[.:–—-]?\s*(.*)$/);
      return m ? { code: m[1], text: m[2].trim() } : { code: "", text: l };
    });
}

const clean = (list: unknown): string[] => (Array.isArray(list) ? list.map((x) => String(x ?? "").trim()).filter(Boolean) : []);

/** Үлгінің 6 кезеңін AI жауабымен толтырады: атауы мен уақыты әрдайым үлгідегідей. */
function buildStages(frame: ScaffoldStage[], ai: TemplateAiContent["stages"], lang: Lang): QmzhStage[] {
  return frame.map((f, i) => {
    const s = ai?.[i] ?? {};
    const isBreak = i === 3;
    const assessment = clean(s.assessment);
    const resources = clean(s.resources);
    return {
      name: f.name,
      timeRange: minutesLabel(f.minutes, lang),
      purpose: isBreak ? "" : s.purpose?.trim() || f.purpose,
      rows: [
        {
          teacherAction: clean(s.teacher),
          studentAction: clean(s.student),
          assessmentType: "",
          assessmentDetail: "",
          assessment: assessment.length ? assessment : ["–"],
          resources: (resources.length ? resources : ["–"]).join("\n"),
        },
      ],
    };
  });
}

function templatePrompt(args: {
  subject: string;
  grade: string;
  topic: string;
  duration: number;
  frame: ScaffoldStage[];
  objectivesInstruction: string;
  valueTitle: string;
  lessonType: string;
  notes?: string;
  lang: Lang;
}): string {
  const { subject, grade, topic, frame, lang } = args;
  const st = (i: number) => `«${frame[i].name}» — ${frame[i].minutes} мин${frame[i].purpose ? `, «${frame[i].purpose}»` : ""}`;
  const langRule =
    lang === "en"
      ? `ТІЛ: БАРЛЫҚ мазмұн АҒЫЛШЫН тілінде. Қалың белгілердің ішіндегі сөздерді де ағылшынша жаз (мыс. **Organisation.**, **Descriptor:**, **2 points**, **Level A (knowledge, understanding) – green card.**). Деңгейлер: A, B, C.`
      : lang === "ru"
        ? `ТІЛ: БАРЛЫҚ мазмұн ОРЫС тілінде. Қалың белгілердің ішіндегі сөздерді де орысша жаз (мыс. **Организационный момент.**, **Дескриптор:**, **2 балла**, **Уровень А (знание, понимание) – зелёная карточка.**). Деңгейлер: А, В, С.`
        : "ТІЛ: барлығы тек қазақ тілінде (шет тілі пәнінде тапсырма мәтіндері сол тілде болуы мүмкін). Деңгейлер: А, В, С.";
  return `Сен тәжірибелі қазақстандық мектеп мұғалімі әрі әдіскерсің. "${subject}"${lang !== "kk" ? ` (${subjectIn(subject, lang)})` : ""} пәнінен "${grade}" сыныбына, "${topic}" тақырыбына, ${args.duration} минуттық сабаққа арналған қысқа мерзімді жоспарды (ҚМЖ) МЕКТЕПТІҢ РЕСМИ ҮЛГІСІ бойынша ҚАТАҢ толтыр.
Сабақ түрі: ${args.lessonType}.
${args.objectivesInstruction}
${args.notes ? `Мұғалімнің тілегі: ${args.notes}\n` : ""}
МӘТІН БЕЛГІЛЕРІ: әр массив элементі — ұяшықтағы бір абзац. Қалың мәтінді **...** арқылы белгіле (үлгідегі жапсырмалар: **Ұйымдастыру кезеңі.**, **Дескриптор:**, **2 балл**). Тізім пунктін «• » белгісімен баста. Басқа markdown қолданба.

ӨРІСТЕР:
1. "objectives" — оқу бағдарламасына сәйкес 1–3 оқыту мақсаты: "code" (ҮОБ коды, мыс. "10.1.2.1") және "text" (мазмұны кіші әріппен, мыс. "жүйелік және кездейсоқ қателіктерді ажырата білу;").
2. "goals" — SMART сабақ мақсаттары, 3–4 жол; әрқайсысы оқушы не істейтінін өлшенетін етістікпен сипаттайды (мыс. "жүйелік және кездейсоқ қателіктерді ажыратады"), "Барлық оқушылар" деп БАСТАМА.
3. Құндылық: осы айдың құндылығы — «${args.valueTitle}» («Адал азамат» бағдарламасы). "valuesQuote" — осы құндылыққа сай нақыл сөз немесе дана сөз, авторымен (мыс. «Еңбек етсең ерінбей, тояды қарның тіленбей» – Абай Құнанбайұлы). "valuesText" — құндылықтың сабақта нақты қалай жүзеге асатынын бір сөйлеммен сипатта.
4. "stages" — ДӘЛ 6 элемент, мына ретпен (атауы мен уақытын өзгертпе, тек мазмұнын толтыр; "purpose" — көрсетілген мақсатты қайтар):
   1) ${st(0)}: "teacher" — **Ұйымдастыру кезеңі.** (сәлемдесу, түгендеу, бағалау парағын тарату); **Білімді өзектендіру: «әдіс атауы».** (тақырыпқа қатысты нақты тапсырма); **Құндылыққа баулу:** (valuesQuote-ты келтір); **Проблемалық жағдаят:** (өмірмен байланысты сұрақ); соңғы жол — болжамдар арқылы тақырып пен мақсаттың бірге анықталуы. "student" — 2 жол. "assessment" — **Қалыптастырушы бағалау:** әдісі (мыс. «Бас бармақ»).
   2) ${st(1)}: "teacher" — **Жаңа білімді меңгеру: «белсенді әдіс».** ұйымдастырылуы, одан кейін «• » арқылы жаңа тақырыптың НАҚТЫ мазмұны 3–5 пункт (анықтамалар, формулалар, мысалдар; негізгі терминдер **қалың**). "assessment" — **Дескриптор:**, «• » 2 дескриптор, **2 балл**.
   3) ${st(2)}: "teacher" — **«әдіс атауы» (жұптық не топтық жұмыс).** ұйымдастырылуы; **Тапсырма:** нақты деректері бар тапсырма. "assessment" — **Дескриптор:**, «• » 1 дескриптор, **1 балл**.
   4) ${st(3)}: "teacher" — **«жаттығу атауы».** қысқа сипаттамасы; "student" — 1 жол; "assessment" — ["–"]; "resources" — ["–"]; "purpose" — "".
   5) ${st(4)}: "teacher" — **Саралау «Таңдау» арқылы:** түсіндірме; **А деңгейі (білу, түсіну) – жасыл карта.** келесі жолда нақты тапсырма; **В деңгейі (қолдану) – сары карта.** + тапсырма; **С деңгейі (талдау, жинақтау) – қызыл карта.** + тапсырма; **ЕББҚ оқушыларына:** қолдау тәсілі. "student" — 2 жол (деңгейін таңдап орындайды, жауап кілтімен тексереді). "assessment" — **Дескриптор:**, **А:** дескриптор – **2 балл**, **В:** … – **3 балл**, **С:** … – **4 балл**.
   6) ${st(5)}: "teacher" — **Бекіту: онлайн-викторина** (Kahoot т.б.) және «• » 3 сұрақ үлгісі (жақшада жауабы), құрылғы жетіспесе — қағаз нұсқасы; **Рефлексия: «әдіс атауы»** – сипаттамасы; **Үй тапсырмасы (сараланған):**, одан кейін «• **А:** …», «• **В:** …», «• **С:** …». "student" — 3 жол. "assessment" — **Дескриптор:**, «• » дескриптор – **3 балл**, **Шкала (10 балл):** 9–10 «Өте жақсы», 7–8 «Жақсы», 5–6 «Қанағаттанарлық», 0–4 «Қолдау қажет».
   Әр кезеңде "resources" — 1–3 нақты ресурс атауы (оқулық, презентация, карточкалар, платформа). Әр кезеңдегі педагог пен оқушы әрекеттері нақты, тақырыпқа сай, фактілері дұрыс болсын.
5. "planning" — қорытынды кесте: "differentiation" — 4 жол: **Тапсырма арқылы:** …, **Таңдау арқылы:** …, **Қолдау арқылы:** …, **Қабілетті оқушыларға:** …; "support" — ЕББҚ оқушыларына қолдау, 3 жол: **Оқу қиындығы:** …, **Көру/есту қабілеті:** …, **Зейін тапшылығы:** …; "assessment" — бір сөйлем (бағалау парағы 10 балл, дескрипторлар, өзін-өзі және өзара бағалау…); "safety" — бір сөйлем (сергіту сәті, көзге арналған үзіліс, сыныпты желдету…).
6. "answerKey" — 5-кезеңдегі А, В, С деңгейлік тапсырмалардың дұрыс жауаптары (level: "A", "B", "C"; answer — қысқа әрі нақты).
7. "resources" — ДӘЛ 3 сандық ресурс (QR-код жасалады): "platform" тізімнен (мыс. kahoot, bilimland, opiq, phet, geogebra, wordwall, youtube), "title" — қысқа түрі кіші әріппен (мыс. "викторина", "видеосабақ", "цифрлық оқулық"). URL жазба.
${langRule} Фактілері дұрыс, сынып деңгейіне сай. Дайын JSON схемаға сай қайтар.`;
}

export async function generateLessonPlan(
  subject: string,
  grade: string,
  topic: string,
  duration: number,
  teacherName = "",
  date = "",
  objectivesInput = "",
  options: LessonPlanOptions = {},
): Promise<LessonPlan> {
  const lang: Lang = options.lang ?? "kk";
  const gradeNumber = gradeToNumber(grade);
  const manual = parseObjectiveLines(objectivesInput);
  const found = findObjective(subject, grade);
  const fallbackObjectives = manual.length
    ? manual
    : [{ code: found?.code || `${gradeNumber}.1.1.1`, text: found?.text ?? `"${topic}" тақырыбы бойынша негізгі ұғымдар мен түсініктерді меңгеру` }];

  const objectivesInstruction = manual.length
    ? `Мұғалім мына оқыту мақсаттарын өзі енгізген — "objectives" өрісіне оларды ДӘЛ сол қалпында (кодымен) қайтар, басқасын қоспа; барлық кезең, тапсырма мен дескриптор осы мақсаттарға бағытталсын:\n"""\n${objectivesInput.trim()}\n"""`
    : `Оқыту мақсаттарының коды ҮОБ-қа сай болсын (шамамен "${fallbackObjectives[0].code}" секілді), мазмұны "${topic}" тақырыбына нақты сәйкес келсін.`;

  const frame = scaffold(duration, lang);
  const value = monthlyValue(date || formatToday(), lang);
  const lessonType = options.lessonType || "Аралас сабақ";
  const prompt = templatePrompt({
    subject,
    grade,
    topic,
    duration,
    frame,
    objectivesInstruction,
    valueTitle: value.title,
    lessonType,
    notes: options.notes,
    lang,
  });

  const base = {
    subject,
    grade,
    topic,
    duration,
    teacherName: teacherName || "Мұғалімнің аты-жөні",
    date: date || formatToday(),
    section: subjectIn(subject, lang),
    gradeNumber,
    lang,
    lessonType,
    format: 2 as const,
    approver: options.approver?.trim() ?? "",
    valuesTitle: value.title,
    tasks: [],
  };

  try {
    const ai = await aiGenerateJson<TemplateAiContent>(prompt, templatePlanAiSchema);
    const objectives = manual.length
      ? manual
      : (ai.objectives ?? []).map((o) => ({ code: o.code?.trim() ?? "", text: o.text?.trim() ?? "" })).filter((o) => o.text);
    const objs = objectives.length ? objectives : fallbackObjectives;
    const planning = ai.planning ?? {};
    return {
      ...base,
      objectiveCode: objs[0].code,
      objectiveText: objs[0].text,
      objectives: objs,
      goals: clean(ai.goals),
      valuesQuote: ai.valuesQuote?.trim() ?? "",
      valuesText: ai.valuesText?.trim() || value.text,
      stages: buildStages(frame, ai.stages, lang),
      planning: {
        differentiation: clean(planning.differentiation).join("\n"),
        support: clean(planning.support).join("\n"),
        assessment: planning.assessment?.trim() ?? "",
        safety: planning.safety?.trim() ?? "",
      },
      answerKey: (ai.answerKey ?? [])
        .map((k) => ({ level: (["A", "B", "C"] as const).find((l) => l === k.level) ?? "A", answer: k.answer?.trim() ?? "" }))
        .filter((k) => k.answer),
      resources: (ai.resources ?? []).map(templateResource).filter((r): r is QmzhResource => r !== null).slice(0, 3),
    };
  } catch (e) {
    // Үлгі нұсқасы тек қазақша — басқа тілдегі жоспарда қатені көрсетеміз.
    // AI лимиті біткенде де үлгіге ауыспаймыз: мұғалім себебін білуі керек.
    if (lang !== "kk" || isLimitError(e)) throw e;
    console.warn("ЖИ арқылы ҚМЖ жасау мүмкін болмады, үлгі нұсқасына көшірілді:", e);
    return fallbackTemplatePlan(base, fallbackObjectives, frame, value.text);
  }
}

/** AI қолжетімсіз болғанда: үлгі құрылымындағы жалпы мазмұн (мұғалім өңдеп толықтырады). */
function fallbackTemplatePlan(
  base: Omit<LessonPlan, "objectiveCode" | "objectiveText" | "goals" | "valuesText" | "stages">,
  objectives: { code: string; text: string }[],
  frame: ScaffoldStage[],
  valueText: string,
): LessonPlan {
  const t = base.topic;
  const ai: TemplateAiContent["stages"] = [
    {
      teacher: [
        "**Ұйымдастыру кезеңі.** Сәлемдесу, түгендеу, бағалау парағын тарату.",
        `**Білімді өзектендіру: «Миға шабуыл».** «${t}» тақырыбына қатысты 3 сұрақ қойылады, жауаптар тақтаға жазылады.`,
        "**Құндылыққа баулу:** «Білім – таусылмас кен» – халық мақалы.",
        `**Проблемалық жағдаят:** «${t}» күнделікті өмірде қай жерде кездеседі?`,
        "Оқушылардың болжамдары тыңдалып, сабақтың тақырыбы мен мақсаты бірге анықталады.",
      ],
      student: ["Сұрақтарға жауап беріп, болжам айтады.", "Тақырып пен мақсатты анықтауға қатысады."],
      assessment: ["**Қалыптастырушы бағалау:** ауызша кері байланыс, «Бас бармақ» әдісі."],
      resources: ["Презентация", "Бағалау парағы"],
    },
    {
      teacher: [
        "**Жаңа білімді меңгеру: «Джигсо» (мозаика).** Сынып топтарға бөлінеді, әр топ мәтіннің бір бөлігін меңгеріп, өз тобына түсіндіреді.",
        `• «${t}» тақырыбының негізгі ұғымдары мен анықтамалары.`,
        "• Негізгі заңдылықтар мен мысалдар.",
        "• Тақырыптың күнделікті өмірмен байланысы.",
      ],
      student: ["Топта бөлімді меңгеріп, өз тобына түсіндіреді."],
      assessment: ["**Дескриптор:**", "• тақырыптың негізгі ұғымдарын түсіндіреді;", "• топта белсенді жұмыс істейді.", "**2 балл**"],
      resources: ["Оқулық", "Презентация"],
    },
    {
      teacher: [
        "**«Жүргізуші – штурман» (жұптық жұмыс).** Жұптың бірі тапсырманы орындайды, екіншісі әр қадамын тексереді; келесі тапсырмада рөлдер ауысады.",
        `**Тапсырма:** «${t}» бойынша жаттығу орындау.`,
      ],
      student: ["Тапсырманы орындап, шешімін талқылайды."],
      assessment: ["**Дескриптор:**", "• тапсырманы қадамдап, дұрыс орындайды.", "**1 балл**"],
      resources: ["Жұмыс дәптері", "Тапсырма карточкасы"],
    },
    {
      teacher: ["**«Тепе-теңдік».** Оқушылар бір аяқпен тұрып, қолдарын жайып, тепе-теңдікті сақтайды."],
      student: ["Қимыл арқылы орындайды."],
      assessment: ["–"],
      resources: ["–"],
    },
    {
      teacher: [
        "**Саралау «Таңдау» арқылы:** оқушылар деңгейін өздері таңдайды; А деңгейін орындаған оқушы В деңгейіне өтеді.",
        "**А деңгейі (білу, түсіну) – жасыл карта.**",
        `«${t}» тақырыбының негізгі ұғымдарына анықтама бер.`,
        "**В деңгейі (қолдану) – сары карта.**",
        "Алған білімді нақты мысалда қолдан.",
        "**С деңгейі (талдау, жинақтау) – қызыл карта.**",
        "Тақырып бойынша қорытынды жасап, дәлелде.",
        "**ЕББҚ оқушыларына:** тапсырманы бөліктерге бөліп беру және қосымша 3–5 минут.",
      ],
      student: ["Деңгейін таңдап, тапсырманы жеке орындайды.", "Жауап кілтімен өзін-өзі тексереді."],
      assessment: [
        "**Дескриптор:**",
        "**А:** негізгі ұғымдарды анықтайды – **2 балл**",
        "**В:** білімін мысалда қолданады – **3 балл**",
        "**С:** қорытынды жасап, дәлелдейді – **4 балл**",
      ],
      resources: ["Деңгейлік карточкалар (А – жасыл, В – сары, С – қызыл)", "Жауап кілті"],
    },
    {
      teacher: [
        "**Бекіту: Kahoot онлайн-викторинасы** (мұғалім алдын ала дайындайды).",
        "Құрылғы жетіспесе – қағаз нұсқасы.",
        "**Рефлексия: «Баспалдақ»** – оқушы стикерін өзі жеткен сатысына («білемін», «түсінемін», «қолдана аламын», «түсіндіре аламын») жапсырады.",
        "**Үй тапсырмасы (сараланған):**",
        "• **А:** оқулықтағы мәтінді оқу, 3 сұраққа жауап беру.",
        "• **В:** тақырып бойынша 2 жаттығу орындау.",
        "• **С:** тақырып бойынша шағын хабарлама дайындау.",
      ],
      student: ["Викторинаға жауап береді.", "Бағалау парағындағы балын қосып, өзін-өзі бағалайды.", "Рефлексия жасайды, үй тапсырмасының деңгейін таңдайды."],
      assessment: [
        "**Дескриптор:**",
        "• викторина сұрақтарының кемінде 80%-ына дұрыс жауап береді – **3 балл**",
        "**Шкала (10 балл):** 9–10 «Өте жақсы», 7–8 «Жақсы», 5–6 «Қанағаттанарлық», 0–4 «Қолдау қажет»",
      ],
      resources: ["Kahoot (QR-код)", "Рефлексия материалдары"],
    },
  ];
  return {
    ...base,
    objectiveCode: objectives[0].code,
    objectiveText: objectives[0].text,
    objectives,
    goals: [`«${t}» тақырыбының негізгі ұғымдарын түсіндіреді`, "алған білімін нақты мысалдарда қолданады", "тақырып бойынша қорытынды жасап, дәлелдейді"],
    valuesQuote: "«Білім – таусылмас кен» – халық мақалы.",
    valuesText: `Құндылық ${valueText}`,
    stages: buildStages(frame, ai, "kk"),
    planning: {
      differentiation: [
        "**Тапсырма арқылы:** А, В, С деңгейлік карталар.",
        "**Таңдау арқылы:** оқушы деңгейін өзі таңдайды.",
        "**Қолдау арқылы:** «Джигсо» (мозаика), жұп-тьютор.",
        "**Қабілетті оқушыларға:** С деңгейі, қосымша зерттеу.",
      ].join("\n"),
      support: [
        "**Оқу қиындығы:** тапсырманы бөліктерге бөліп беру және қосымша 3–5 минут.",
        "**Көру/есту қабілеті:** толтырылған үлгі және бос орынды толықтыру тапсырмасы.",
        "**Зейін тапшылығы:** белсенді рөл беру (уақыт сақшысы, материал таратушы).",
      ].join("\n"),
      assessment: "Бағалау парағы (10 балл), дескрипторлар, өзін-өзі және өзара бағалау, онлайн-викторина, рефлексия.",
      safety: "Сергіту сәті, көзге арналған үзіліс, интерактивті тақтамен жұмыс уақытын шектеу, сыныпты желдету.",
    },
    answerKey: [
      { level: "A", answer: "Негізгі ұғымдардың оқулықтағы анықтамалары." },
      { level: "B", answer: "Мысалдағы дұрыс шешім (мұғалім толықтырады)." },
      { level: "C", answer: "Дәлелді қорытынды (мұғалім толықтырады)." },
    ],
    resources: ["kahoot", "bilimland", "opiq"].map((platform) => templateResource({ platform })).filter((r): r is QmzhResource => r !== null),
  };
}

// Әр сұрақ үлгісі өз мағынасына сай жауап нұсқаларымен жұпталған
// (options[0] — семантикалық жағынан дұрыс жауап, қалғандары шатастыру үшін).
export interface PresentationSlide {
  title: string;
  bullets: string[];
  kind: "title" | "content" | "closing";
}

export function buildLessonPresentation(plan: LessonPlan): PresentationSlide[] {
  const slides: PresentationSlide[] = [];
  const objectives = plan.objectives?.length ? plan.objectives : [{ code: plan.objectiveCode, text: plan.objectiveText }];

  slides.push({
    kind: "title",
    title: plan.topic,
    bullets: [plan.subject, `${plan.gradeNumber}-сынып`, `Оқыту мақсаты: ${objectives.map((o) => o.code).filter(Boolean).join(", ")}`],
  });

  slides.push({
    kind: "content",
    title: "Сабақтың мақсаты",
    bullets: plan.goals.map(plainText),
  });

  plan.stages.forEach((stage) => {
    const bullets = stage.rows
      .flatMap((row) => (isTemplatePlan(plan) ? row.teacherAction.filter((l) => l.startsWith("**")) : row.teacherAction.slice(0, 1)))
      .map(plainText)
      .slice(0, 4);
    slides.push({ kind: "content", title: stage.purpose ? `${stage.name}: ${stage.purpose}` : stage.name, bullets });
  });

  plan.tasks.forEach((task) => {
    slides.push({ kind: "content", title: task.title, bullets: task.condition });
  });

  slides.push({
    kind: "content",
    title: `Құндылық: «${plan.valuesTitle}»`,
    bullets: [plan.valuesQuote, plan.valuesText].filter((x): x is string => !!x).map(plainText),
  });

  const conclusion = plan.tasks[0]?.expectedConclusion ?? `"${plan.topic}" тақырыбы бойынша негізгі ұғымдарды меңгердік.`;
  slides.push({
    kind: "closing",
    title: "Сабақ қорытындысы",
    bullets: [conclusion, "Сұрақтарыңыз болса — қойыңыз! Келесі сабаққа дейін!"],
  });

  return slides;
}
