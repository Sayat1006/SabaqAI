// ҚМЖ генераторы: Gemini арқылы (ai-generate Edge Function), AI қолжетімсіз болса —
// үлгі негізіндегі нұсқа. Сондай-ақ ҚМЖ-дан слайдтар құрастыру.

import { aiGenerateJson } from "./ai";
import { curriculum } from "./curriculum";

export interface QmzhActivityRow {
  teacherAction: string[];
  studentAction: string[];
  assessmentType: string;
  assessmentDetail: string;
  resources: string;
}

export interface QmzhStage {
  name: string;
  timeRange: string;
  rows: QmzhActivityRow[];
}

export interface QmzhCriterion {
  criterion: string;
  descriptors: string[];
}

export interface QmzhTask {
  title: string;
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
}

function hashString(input: string): number {
  let hash = 0;
  for (let i = 0; i < input.length; i++) {
    hash = (hash << 5) - hash + input.charCodeAt(i);
    hash |= 0;
  }
  return Math.abs(hash);
}

const valuesPool = [
  {
    title: "Заң және Тәртіп",
    text: "тапсырманы орындау барысында ережелерді сақтау, жұмыс орнындағы тәртіп пен қауіпсіздіктің маңызын түсінуді қалыптастырады.",
  },
  {
    title: "Еңбек пен шығармашылық",
    text: "тапсырманы жауапкершілікпен, ұқыпты әрі шығармашылықпен орындаудың құндылығын түсінуді қалыптастырады.",
  },
  {
    title: "Ынтымақтастық",
    text: "топтық жұмыс барысында бір-бірін тыңдау, пікірді құрметтеу және ортақ нәтижеге бірге жету дағдысын дамытады.",
  },
  {
    title: "Жауапкершілік",
    text: "өз жұмысына және топ жұмысына жауапты қарау, тапсырманы уақытында әрі сапалы орындау құндылығын қалыптастырады.",
  },
];

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

// Мұғалім өзі енгізген "Оқу мақсаттары" мәтінінен код (мыс. 7.2.1.4) пен
// мазмұнды бөліп алады — енгізілген мақсаттар генерацияда басшылыққа алынады.
function parseObjectivesInput(input: string): { code: string; text: string } | null {
  const trimmed = input.trim();
  if (!trimmed) return null;
  const firstLine = trimmed.split(/\r?\n/)[0].trim();
  const codeMatch = firstLine.match(/\d+(\.\d+){2,3}/);
  if (codeMatch) {
    const text = firstLine.slice(codeMatch.index! + codeMatch[0].length).replace(/^[\s.:–—-]+/, "").trim();
    return { code: codeMatch[0], text: text || trimmed };
  }
  return { code: "", text: trimmed };
}

function generateLessonPlanTemplate(
  subject: string,
  grade: string,
  topic: string,
  duration: number,
  teacherName = "",
  date = "",
  objectivesInput = "",
): LessonPlan {
  const seed = hashString(`${subject}-${grade}-${topic}`);
  const gradeNumber = gradeToNumber(grade);

  const manualObjective = parseObjectivesInput(objectivesInput);
  const foundObjective = manualObjective ?? findObjective(subject, grade);
  const objectiveCode = foundObjective?.code || `${gradeNumber}.1.1.1`;
  const objectiveText = foundObjective?.text ?? `"${topic}" тақырыбы бойынша негізгі ұғымдар мен түсініктерді меңгеру`;

  const goalTemplates = [
    `"${topic}" тақырыбының негізгі ұғымдарын ажыратады және оның негізгі белгілерін атайды`,
    `алған білімін "${topic}" тақырыбына қатысты нақты мысалдар келтіруде қолданады`,
    `"${topic}" бойынша бақылаулары мен деректерін салыстырып, қорытындысын кемінде екі дәлелмен негіздейді`,
  ];

  const values = valuesPool[seed % valuesPool.length];

  const stages: QmzhStage[] = [
    {
      name: "Сабақтың басы",
      timeRange: `1-${Math.max(3, Math.round(duration * 0.13))} мин`,
      rows: [
        {
          teacherAction: [
            `Сыныппен амандасып, сабаққа дайындықты тексереді. «Бүгін "${topic}" тақырыбын бірге зерттейміз.»`,
            "Сабақ тақырыбы мен оқу мақсатын жариялайды.",
            "Сабақтың ретін хабарлайды: қайталау, жаңа ұғымды ашу және бекіту.",
          ],
          studentAction: [
            "Оқушылар амандасады және сабаққа қажетті құралдарын дайындайды.",
            "Сабақ тақырыбы мен оқу мақсатын жазады.",
            "Сабақ кезеңдерінің ретін тыңдап, жұмысқа дайындалады.",
          ],
          assessmentType: "Ауызша кері байланыс",
          assessmentDetail: "Мұғалім оқушылардың сабаққа дайындығын және оқу мақсатын түсінуін қысқа сұрақтар арқылы анықтайды.",
          resources: "—",
        },
      ],
    },
    {
      name: "Сабақтың ортасы",
      timeRange: `${Math.max(4, Math.round(duration * 0.15))}-${Math.max(5, Math.round(duration * 0.85))} мин`,
      rows: [
        {
          teacherAction: [
            `Өткен білімді еске түсіру үшін "${topic}" тақырыбына қатысты сұрақ қояды. «Бұл құбылыс/ұғым туралы не білеміз?»`,
            "[Бірлескен ізденіс] Мәселе қойып, ашық сұрақтар сериясын жүргізеді, нұсқаларды бағаламай тақтаға тіркейді.",
            `${subject} пәні бойынша "${topic}" тақырыбының негізгі бөлімдерін түсіндіреді, мысалдар мен көрнекі құралдарды қолданады (презентация, видео, схема).`,
          ],
          studentAction: [
            `Оқушылар "${topic}" тақырыбына қатысты күнделікті мысалдарды атайды.`,
            "[Бірлескен ізденіс] Ашық сұрақтарға болжамдарымен жауап береді, сыныптастарының нұсқаларын тыңдап, дамытады немесе қарсылық білдіреді.",
            "Мұғалімнің түсіндіруін тыңдап, негізгі ұғымдарды дәптерге жазады.",
          ],
          assessmentType: "Ауызша кері байланыс",
          assessmentDetail: "Мұғалім ашық сұрақтарға берілген нұсқалардан оқушылардың негізгі ұғымды қаншалықты түсінгенін бақылайды.",
          resources: "Интерактивті тақта / проектор",
        },
        {
          teacherAction: [
            "1-тапсырманы («Тапсырмалар» бөлімін қараңыз) ұсынады және топтарға орындау тәртібін түсіндіреді.",
            "Топтардың бастапқы жауаптарын тыңдайды, бағыттаушы сұрақтар қояды.",
          ],
          studentAction: [
            "Топта 1-тапсырманың материалын оқып, талдайды.",
            "Бастапқы жауаптарын топ мүшелерімен талқылайды.",
          ],
          assessmentType: "Қалыптастырушы бағалау",
          assessmentDetail: "1-тапсырманың бағалау критерийлері мен дескрипторлары бойынша («Тапсырмалар» бөлімін қараңыз).",
          resources: "1-тапсырма парағы",
        },
      ],
    },
    {
      name: "Сабақтың соңы",
      timeRange: `${Math.max(6, Math.round(duration * 0.87))}-${duration} мин`,
      rows: [
        {
          teacherAction: [
            `Сабақ нәтижесін «қайталадық – жаңа білдік – бекіттік» ретімен жинақтауды сұрайды. «Бүгін "${topic}" тақырыбы бойынша нені түсіндік?»`,
            "Оқу мақсатына жетуді оқушылардың жауаптары арқылы бағалайды.",
          ],
          studentAction: [
            "Оқушылар сабақта қайталаған, жаңа білген және бекіткен ұғымдарын атайды.",
            "Оқу мақсатына жетуін өзі бағалайды.",
          ],
          assessmentType: "Сипаттамалық кері байланыс",
          assessmentDetail: "Мұғалім оқушының жауабына қысқа түсініктеме береді.",
          resources: "—",
        },
        {
          teacherAction: [
            `Үй тапсырмасын береді: "${topic}" тақырыбына қатысты 3-5 сұраққа жазбаша жауап дайындау.`,
            "Орындау үлгісін қысқаша түсіндіреді.",
          ],
          studentAction: ["Оқушылар үй тапсырмасын дәптерге жазады."],
          assessmentType: "Ауызша кері байланыс",
          assessmentDetail: "Мұғалім үй тапсырмасының түсінікті қабылданғанын ауызша тексереді.",
          resources: "—",
        },
      ],
    },
  ];

  const taskSeed = seed + 3;
  const statementPool = [
    `"${topic}" тақырыбының негізгі анықтамасы ${subject} пәнінің іргелі ұғымдарына жатады.`,
    `"${topic}" тек теориялық сипатта, күнделікті өмірде қолданылмайды.`,
    `"${topic}" бойынша білім тек жаттауға негізделеді, түсінуді қажет етпейді.`,
    `"${topic}" тақырыбын түсіну үшін алдыңғы сабақтарда алған білімдерді байланыстыру қажет.`,
    `"${topic}" бойынша қорытынды жасау үшін кемінде екі нақты дәлел келтіру керек.`,
  ];
  const truthPattern = [true, false, false, true, true];

  const task: QmzhTask = {
    title: `Тапсырма 1. "${topic}" бойынша тұжырымдарды талдау`,
    condition: [
      "Топта жұмыс істеңдер.",
      "Төмендегі тұжырымдарды оқып, әрқайсысын «дұрыс» немесе «бұрыс» деп белгілеңдер.",
      "Әр тұжырымға өз дәлеліңді бір сөйлеммен жазыңдар.",
    ],
    tableTitle: "МАТЕРИАЛ · КЕСТЕ",
    tableHeaders: ["№", "Тұжырым", "Дұрыс па?", "Дәлел"],
    tableRows: statementPool.map((s, i) => [String(i + 1), s, "", ""]),
    steps: [
      "Алдымен әр тұжырымды мұқият оқыңдар.",
      "Содан кейін оны «дұрыс» немесе «бұрыс» деп жіктеңдер.",
      "Одан кейін өз пікірлеріңді дәлелмен негіздеңдер.",
      "Соңында топ жауаптарын салыстырып, ортақ қорытындыны бір сөйлеммен тұжырымдаңдар.",
    ],
    criteria: [
      {
        criterion: "Тұжырымдарды дұрыс/бұрыс деп негізді түрде жіктейді.",
        descriptors: [
          "Әр тұжырымды берілген екі санаттың біріне орналастырады.",
          "Жіктеуін тақырып бойынша білетін фактілерге сүйеніп түсіндіреді.",
        ],
      },
      {
        criterion: "Өз пікірін нақты дәлелмен негіздейді.",
        descriptors: ["Әр тұжырымға кемінде бір нақты дәлел немесе мысал келтіреді."],
      },
      {
        criterion: "Топтық салыстыру нәтижесінде қорытынды жасайды.",
        descriptors: [
          "Топ мүшелерінің жауаптарындағы ұқсастықтар мен айырмашылықтарды анықтайды.",
          "Тақырып бойынша негізгі қорытындыны бір түсінікті сөйлеммен тұжырымдайды.",
        ],
      },
    ],
    differentiation:
      "Қолдау қажет оқушыларға тірек сөздер ұсынылады. Қабілеті жоғары оқушылар өз дәлелдерін тақырыптың нақты мысалымен толықтырып, бір сөйлеммен қорытады.",
    expectedResultRows: statementPool.map((s, i) => [
      String(i + 1),
      s,
      truthPattern[(i + taskSeed) % truthPattern.length] ? "Дұрыс" : "Бұрыс",
      truthPattern[(i + taskSeed) % truthPattern.length]
        ? "Тақырыптың негізгі мазмұнына сәйкес келеді."
        : "Тұжырым тақырыптың нақты мазмұнына қайшы келеді.",
    ]),
    expectedConclusion: `Қорытынды: "${topic}" тақырыбын дұрыс түсіну үшін негізгі ұғымдарды нақты дәлелдермен байланыстыра білу маңызды.`,
  };

  return {
    subject,
    grade,
    topic,
    duration,
    teacherName: teacherName || "Мұғалімнің аты-жөні",
    date: date || formatToday(),
    section: `${subject} — ${topic}`,
    gradeNumber,
    objectiveCode,
    objectiveText,
    goals: goalTemplates,
    valuesTitle: values.title,
    valuesText: `«${values.title}» — ${values.text}`,
    stages,
    tasks: [task],
  };
}

const qmzhRowAiSchema = {
  type: "OBJECT",
  properties: {
    teacherAction: { type: "ARRAY", items: { type: "STRING" } },
    studentAction: { type: "ARRAY", items: { type: "STRING" } },
    assessmentType: { type: "STRING" },
    assessmentDetail: { type: "STRING" },
    resources: { type: "STRING" },
  },
  required: ["teacherAction", "studentAction", "assessmentType", "assessmentDetail", "resources"],
};

const qmzhStageAiSchema = {
  type: "OBJECT",
  properties: {
    name: { type: "STRING" },
    timeRange: { type: "STRING" },
    rows: { type: "ARRAY", items: qmzhRowAiSchema },
  },
  required: ["name", "timeRange", "rows"],
};

const qmzhCriterionAiSchema = {
  type: "OBJECT",
  properties: {
    criterion: { type: "STRING" },
    descriptors: { type: "ARRAY", items: { type: "STRING" } },
  },
  required: ["criterion", "descriptors"],
};

const qmzhTaskAiSchema = {
  type: "OBJECT",
  properties: {
    title: { type: "STRING" },
    condition: { type: "ARRAY", items: { type: "STRING" } },
    tableTitle: { type: "STRING" },
    tableHeaders: { type: "ARRAY", items: { type: "STRING" } },
    tableRows: { type: "ARRAY", items: { type: "ARRAY", items: { type: "STRING" } } },
    steps: { type: "ARRAY", items: { type: "STRING" } },
    criteria: { type: "ARRAY", items: qmzhCriterionAiSchema },
    differentiation: { type: "STRING" },
    expectedResultRows: { type: "ARRAY", items: { type: "ARRAY", items: { type: "STRING" } } },
    expectedConclusion: { type: "STRING" },
  },
  required: [
    "title",
    "condition",
    "tableTitle",
    "tableHeaders",
    "tableRows",
    "steps",
    "criteria",
    "differentiation",
    "expectedResultRows",
    "expectedConclusion",
  ],
};

const lessonPlanAiSchema = {
  type: "OBJECT",
  properties: {
    objectiveCode: { type: "STRING" },
    objectiveText: { type: "STRING" },
    goals: { type: "ARRAY", items: { type: "STRING" } },
    valuesTitle: { type: "STRING" },
    valuesText: { type: "STRING" },
    stages: { type: "ARRAY", items: qmzhStageAiSchema },
    tasks: { type: "ARRAY", items: qmzhTaskAiSchema },
  },
  required: ["objectiveCode", "objectiveText", "goals", "valuesTitle", "valuesText", "stages", "tasks"],
};

type LessonPlanAiContent = Pick<
  LessonPlan,
  "objectiveCode" | "objectiveText" | "goals" | "valuesTitle" | "valuesText" | "stages" | "tasks"
>;

export async function generateLessonPlan(
  subject: string,
  grade: string,
  topic: string,
  duration: number,
  teacherName = "",
  date = "",
  objectivesInput = "",
): Promise<LessonPlan> {
  const gradeNumber = gradeToNumber(grade);
  const manualObjective = parseObjectivesInput(objectivesInput);
  const foundObjective = manualObjective ?? findObjective(subject, grade);
  const fallbackObjectiveCode = foundObjective?.code || `${gradeNumber}.1.1.1`;
  const fallbackObjectiveText =
    foundObjective?.text ?? `"${topic}" тақырыбы бойынша негізгі ұғымдар мен түсініктерді меңгеру`;

  const objectivesInstruction = manualObjective
    ? `Мұғалім мына оқыту мақсаттарын өзі енгізген — оларды МІНДЕТТІ түрде дәл сол қалпында, өзгертпей және басқасын ойлап шығармай, жоспардың негізі ретінде қолдан:\n"""\n${objectivesInput.trim()}\n"""\nБарлық кезеңдер (стадиялар), тапсырма мен бағалау критерийлері осы мақсаттарға қол жеткізуге бағытталсын. "objectiveCode" мен "objectiveText" өрістерін де осы мақсаттар негізінде (біріншісінен) толтыр.`
    : `Оқыту мақсатының коды шамамен "${fallbackObjectiveCode}" секілді болсын, мазмұны "${topic}" тақырыбына нақты сәйкес келсін (қажет болса "${fallbackObjectiveText}" деген нұсқаны негіз ет, бірақ тақырыпқа лайықтап нақтыла).`;

  const prompt = `Сен тәжірибелі қазақстандық мектеп мұғалімісің. "${subject}" пәнінен "${grade}" сыныбына, "${topic}" тақырыбына, ${duration} минуттық сабаққа арналған толық қысқа мерзімді жоспар (ҚМЖ) құрастыр.
${objectivesInstruction}
Дәл 3 кезең бер: "Сабақтың басы", "Сабақтың ортасы", "Сабақтың соңы" (уақыт бөлінісі ${duration} минутқа сәйкес келсін). Дәл 1 тапсырма бер — кестемен, бағалау критерийлерімен, дескрипторлармен, күтілетін нәтижемен.
Жауапты тек қазақ тілінде, мазмұнды әрі нақты, дайын JSON схемаға сай қайтар.`;

  try {
    const ai = await aiGenerateJson<LessonPlanAiContent>(prompt, lessonPlanAiSchema);
    return {
      subject,
      grade,
      topic,
      duration,
      teacherName: teacherName || "Мұғалімнің аты-жөні",
      date: date || formatToday(),
      section: `${subject} — ${topic}`,
      gradeNumber,
      objectiveCode: ai.objectiveCode || fallbackObjectiveCode,
      objectiveText: ai.objectiveText || fallbackObjectiveText,
      goals: ai.goals,
      valuesTitle: ai.valuesTitle,
      valuesText: ai.valuesText,
      stages: ai.stages,
      tasks: ai.tasks,
    };
  } catch (e) {
    console.warn("ЖИ арқылы ҚМЖ жасау мүмкін болмады, үлгі нұсқасына көшірілді:", e);
    return generateLessonPlanTemplate(subject, grade, topic, duration, teacherName, date, objectivesInput);
  }
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

  slides.push({
    kind: "title",
    title: plan.topic,
    bullets: [plan.subject, `${plan.gradeNumber}-сынып`, `Оқыту мақсаты: ${plan.objectiveCode}`],
  });

  slides.push({
    kind: "content",
    title: "Сабақтың мақсаты",
    bullets: plan.goals,
  });

  plan.stages.forEach((stage) => {
    const bullets = stage.rows.map((row) => row.teacherAction[0]).slice(0, 4);
    slides.push({ kind: "content", title: stage.name, bullets });
  });

  plan.tasks.forEach((task) => {
    slides.push({ kind: "content", title: task.title, bullets: task.condition });
  });

  slides.push({
    kind: "content",
    title: `Құндылық: «${plan.valuesTitle}»`,
    bullets: [plan.valuesText],
  });

  const conclusion = plan.tasks[0]?.expectedConclusion ?? `"${plan.topic}" тақырыбы бойынша негізгі ұғымдарды меңгердік.`;
  slides.push({
    kind: "closing",
    title: "Сабақ қорытындысы",
    bullets: [conclusion, "Сұрақтарыңыз болса — қойыңыз! Келесі сабаққа дейін!"],
  });

  return slides;
}
