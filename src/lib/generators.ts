// Үлгі негізіндегі контент генераторлары (демо режимі).
// Нақты нұсқада бұл функциялар backend арқылы LLM API-ге (мыс. Claude) жүгінеді,
// бірақ мұғалімге идеяны көрсету үшін толыққанды жұмыс істейтін статикалық логика жеткілікті.

import { aiGenerate, aiGenerateJson } from "./ai";
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

export interface QuizQuestion {
  question: string;
  options: string[];
  correctIndex: number;
}

export interface Quiz {
  topic: string;
  difficulty: string;
  questions: QuizQuestion[];
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
const quizQuestionSets: {
  frame: (topic: string) => string;
  options: (topic: string) => string[];
}[] = [
  {
    frame: (topic) => `"${topic}" тақырыбының негізгі анықтамасы қандай?`,
    options: () => ["Дұрыс әрі толық анықтама", "Ішінара дұрыс анықтама", "Қате анықтама", "Тақырыпқа мүлдем қатысы жоқ анықтама"],
  },
  {
    frame: (topic) => `Төмендегілердің қайсысы "${topic}" тақырыбына тікелей қатысты?`,
    options: () => ["Тақырыпқа тікелей қатысты ұғым", "Тек жанама қатысты ұғым", "Мүлдем қатысы жоқ ұғым", "Басқа пәнге тән ұғым"],
  },
  {
    frame: (topic) => `"${topic}" бойынша келесі тұжырымдардың қайсысы дұрыс?`,
    options: () => ["Бірінші тұжырым дұрыс", "Екінші тұжырым дұрыс", "Екі тұжырым да дұрыс", "Екі тұжырым да қате"],
  },
  {
    frame: (topic) => `"${topic}" тақырыбын оқығанда оқушыға ең бірінші не түсіну маңызды?`,
    options: () => ["Негізгі ұғымдар мен анықтамалар", "Тек формулаларды жаттау", "Тек тарихи деректер", "Тақырыпқа қатысы жоқ ақпарат"],
  },
  {
    frame: (topic) => `"${topic}" тақырыбы қандай салада көбірек қолданылады?`,
    options: () => ["Күнделікті өмірде де, ғылымда да қолданылады", "Тек теорияда қолданылады", "Ешқандай қолданысы жоқ", "Тек көркем әдебиетте қолданылады"],
  },
  {
    frame: (topic) => `"${topic}" тақырыбын зерттеу неліктен маңызды?`,
    options: () => ["Себебі ол пәннің негізін құрайды", "Себебі тек емтиханда кездеседі", "Ешқандай практикалық маңызы жоқ", "Себебі басқа тақырыппен байланысы жоқ"],
  },
];

function seededShuffleWithCorrect(options: string[], seed: number): { options: string[]; correctIndex: number } {
  const shuffled = options.map((opt, i) => ({ opt, wasCorrect: i === 0 }));
  for (let i = shuffled.length - 1; i > 0; i--) {
    seed = (seed * 1103515245 + 12345) & 0x7fffffff;
    const j = seed % (i + 1);
    [shuffled[i], shuffled[j]] = [shuffled[j], shuffled[i]];
  }
  return {
    options: shuffled.map((s) => s.opt),
    correctIndex: shuffled.findIndex((s) => s.wasCorrect),
  };
}

function generateQuizTemplate(topic: string, count: number, difficulty: string): Quiz {
  const seed = hashString(`${topic}-${difficulty}`);
  const questions: QuizQuestion[] = [];

  for (let i = 0; i < count; i++) {
    const set = quizQuestionSets[(seed + i) % quizQuestionSets.length];
    const { options, correctIndex } = seededShuffleWithCorrect(set.options(topic), seed + i * 7);
    questions.push({
      question: `${i + 1}. ${set.frame(topic)}`,
      options,
      correctIndex,
    });
  }

  return { topic, difficulty, questions };
}

const quizQuestionAiSchema = {
  type: "OBJECT",
  properties: {
    question: { type: "STRING" },
    options: { type: "ARRAY", items: { type: "STRING" } },
    correctIndex: { type: "INTEGER" },
  },
  required: ["question", "options", "correctIndex"],
};

const quizAiSchema = {
  type: "OBJECT",
  properties: {
    questions: { type: "ARRAY", items: quizQuestionAiSchema },
  },
  required: ["questions"],
};

export async function generateQuiz(topic: string, count: number, difficulty: string): Promise<Quiz> {
  const prompt = `Сен қазақстандық мектеп мұғалімісің. "${topic}" тақырыбы бойынша ${difficulty.toLowerCase()} қиындық деңгейінде дәл ${count} тест сұрағын құрастыр. Әр сұрақта нақты 4 жауап нұсқасы болсын, тек біреуі дұрыс. "correctIndex" — дұрыс жауаптың "options" массивіндегі реттік нөмірі (0-ден бастап). Жауап тек қазақ тілінде болсын.`;

  try {
    const ai = await aiGenerateJson<{ questions: QuizQuestion[] }>(prompt, quizAiSchema);
    const questions: QuizQuestion[] = ai.questions.slice(0, count).map((q, i) => ({
      question: /^\d+\./.test(q.question) ? q.question : `${i + 1}. ${q.question}`,
      options: q.options,
      correctIndex: Math.min(Math.max(q.correctIndex, 0), q.options.length - 1),
    }));
    return { topic, difficulty, questions };
  } catch (e) {
    console.warn("ЖИ арқылы Дода сұрақтарын жасау мүмкін болмады, үлгі нұсқасына көшірілді:", e);
    return generateQuizTemplate(topic, count, difficulty);
  }
}

export interface KtjLesson {
  globalNumber: number;
  topic: string;
  stage: string;
}

export interface KtjWeekRow {
  quarterName: string;
  weekInQuarter: number;
  globalWeek: number;
  lessons: KtjLesson[];
}

export interface KtjPlan {
  subject: string;
  grade: string;
  hoursPerWeek: number;
  totalWeeks: number;
  totalLessons: number;
  quarters: { name: string; weeks: number; lessons: number }[];
  weeks: KtjWeekRow[];
}

const QUARTERS = [
  { name: "1-тоқсан", weeks: 8 },
  { name: "2-тоқсан", weeks: 8 },
  { name: "3-тоқсан", weeks: 10 },
  { name: "4-тоқсан", weeks: 8 },
];

const defaultUnitNames = (subject: string) => [
  `${subject}: кіріспе бөлім`,
  `${subject}: негізгі ұғымдар`,
  `${subject}: тереңдетілген тақырыптар`,
  `${subject}: практикалық қолданыс`,
  `${subject}: қайталау және жүйелеу`,
  `${subject}: жобалық жұмыс`,
  `${subject}: қорытынды бөлім`,
];

function buildKtjPlan(subject: string, grade: string, hoursPerWeek: number, units: string[]): KtjPlan {
  const totalWeeks = QUARTERS.reduce((sum, q) => sum + q.weeks, 0);
  const totalLessons = totalWeeks * hoursPerWeek;

  const base = Math.floor(totalLessons / units.length);
  const remainder = totalLessons % units.length;
  const unitLessonCounts = units.map((_, i) => base + (i < remainder ? 1 : 0));

  const flatLessons: { topic: string; stage: string }[] = [];
  units.forEach((unit, ui) => {
    const count = Math.max(1, unitLessonCounts[ui]);
    for (let k = 0; k < count; k++) {
      let stage = "жалғасы";
      if (k === 0) stage = "кіріспе";
      else if (k === count - 1) stage = "қорытынды/бекіту";
      flatLessons.push({ topic: unit, stage });
    }
  });

  while (flatLessons.length < totalLessons) {
    const last = units[units.length - 1];
    flatLessons.push({ topic: last, stage: "қосымша практика" });
  }
  flatLessons.length = totalLessons;

  const weeks: KtjWeekRow[] = [];
  let cursor = 0;
  let globalWeek = 0;

  const quartersOut: { name: string; weeks: number; lessons: number }[] = [];

  for (const q of QUARTERS) {
    let quarterLessonCount = 0;
    for (let w = 0; w < q.weeks; w++) {
      globalWeek++;
      const lessons: KtjLesson[] = [];
      for (let h = 0; h < hoursPerWeek; h++) {
        const item = flatLessons[cursor];
        cursor++;
        lessons.push({ globalNumber: cursor, topic: item.topic, stage: item.stage });
      }
      quarterLessonCount += lessons.length;
      weeks.push({ quarterName: q.name, weekInQuarter: w + 1, globalWeek, lessons });
    }
    quartersOut.push({ name: q.name, weeks: q.weeks, lessons: quarterLessonCount });
  }

  return {
    subject,
    grade,
    hoursPerWeek,
    totalWeeks,
    totalLessons,
    quarters: quartersOut,
    weeks,
  };
}

const ktjUnitsAiSchema = {
  type: "OBJECT",
  properties: {
    units: { type: "ARRAY", items: { type: "STRING" } },
  },
  required: ["units"],
};

export async function generateKtj(
  subject: string,
  grade: string,
  hoursPerWeek: number,
  rawTopics: string[],
): Promise<KtjPlan> {
  if (rawTopics.length > 0) {
    return buildKtjPlan(subject, grade, hoursPerWeek, rawTopics);
  }

  const prompt = `Сен қазақстандық мектеп мұғалімісің. "${subject}" пәнінен "${grade}" сыныбына арналған оқу жылының негізгі бөлімдерін (тарауларын) тізімде бер — ҚР Білім беру стандартына сәйкес, 6-8 бөлім, әрқайсысы қысқа әрі нақты атаумен, тек қазақ тілінде.`;

  try {
    const ai = await aiGenerateJson<{ units: string[] }>(prompt, ktjUnitsAiSchema);
    const units = ai.units.filter((u) => u.trim().length > 0);
    return buildKtjPlan(subject, grade, hoursPerWeek, units.length > 0 ? units : defaultUnitNames(subject));
  } catch (e) {
    console.warn("ЖИ арқылы КТЖ тарауларын жасау мүмкін болмады, үлгі нұсқасына көшірілді:", e);
    return buildKtjPlan(subject, grade, hoursPerWeek, defaultUnitNames(subject));
  }
}

const assistantRules: { keywords: string[]; reply: string }[] = [
  {
    keywords: ["сәлем", "салем", "қалайсың", "привет", "hi", "hello"],
    reply:
      "Сәлеметсіз бе! Мен Sabaq — сіздің AI-көмекшіңізбін. Сабақ жоспарлау, викторина құру, тест дайындау немесе материал іздеу бойынша сұрағыңызды жазыңыз.",
  },
  {
    keywords: ["ктж", "жылдық жоспар", "күнтізбелік"],
    reply:
      "Жылдық жоспар үшін «КТЖ» құралын қолданыңыз: пән, сынып, апталық сағат саны мен негізгі тарауларды енгізсеңіз, жүйе оларды 4 тоқсанға автоматты бөліп шығады.",
  },
  {
    keywords: ["қмж", "сабақ жоспар", "жоспар құру"],
    reply:
      "Жеке сабаққа жоспар керек болса, «ҚМЖ» бетіне өтіңіз — пән, сынып, тақырып пен ұзақтықты енгізсеңіз, толық құрылымды жоспар (мақсат, кезеңдер, материалдар) бірден дайын болады.",
  },
  {
    keywords: ["дода", "викторина", "квиз", "ойын", "жарыс"],
    reply:
      "Сыныпты жандандыру үшін «Дода» құралын байқап көріңіз — тақырып пен қиындық деңгейін таңдасаңыз, ұпай тақтасы бар топтық викторина дайын болады.",
  },
  {
    keywords: ["диктант", "тыңда", "дауыстап"],
    reply:
      "«ЖИ диктант» бетінде кез келген мәтінді қойып, оны оқушыларға әртүрлі жылдамдықта дауыстап оқытуға болады — тыңдап жазу жаттығуларына ыңғайлы.",
  },
  {
    keywords: ["сұрақ", "тест құру", "материал бойынша"],
    reply:
      "Дайын мәтін немесе оқулық үзіндісі болса, «Материал бойынша сұрақтар» бетіне қойыңыз — жүйе автоматты түрде тексеру сұрақтарын құрастырып береді.",
  },
  {
    keywords: ["кітапхана", "материал сақтау", "файл"],
    reply:
      "Барлық дидактикалық материалдарыңызды «Материалдар кітапханасы» бөлімінде бір жерде сақтап, пән мен түрі бойынша ретке келтіре аласыз.",
  },
  {
    keywords: ["сынып", "баға", "тест нәтиже", "оқушы"],
    reply:
      "«Сыныптар мен тесттер» бетінде сынып құрып, оқушыларды қосып, тест тағайындап, нәтижелерін бақылай аласыз.",
  },
  {
    keywords: ["зертхана", "тәжірибе", "симуляция"],
    reply:
      "«Виртуалды зертхана» бөлімінде физика мен биологиядан интерактивті симуляциялар бар — зертханалық құрал-жабдықсыз көрнекі сабақ өткізуге болады.",
  },
  {
    keywords: ["код", "программалау", "информатика", "компилятор"],
    reply:
      "Информатика сабағына «Sabaq Компилятор» ыңғайлы — оқушылар браузерде тікелей JavaScript кодын жазып, нәтижесін бірден көре алады.",
  },
  {
    keywords: ["рахмет", "рақмет", "thanks", "спасибо"],
    reply: "Өтінемін! Тағы да көмек керек болса, жаза беріңіз.",
  },
];

const assistantFallback =
  "Түсіндім деп ойлаймын, бірақ нақтырақ жазып көріңізші. Мысалы: «5-сыныпқа математикадан ҚМЖ керек», «Дода үшін тарих тақырыбы», немесе «диктантқа мәтін дайындау». Сол бойынша тиісті құралды ұсынамын.";

function generateAssistantReplyTemplate(message: string): string {
  const lower = message.toLowerCase();
  for (const rule of assistantRules) {
    if (rule.keywords.some((kw) => lower.includes(kw))) {
      return rule.reply;
    }
  }
  return assistantFallback;
}

const assistantSystemPrompt = `Сен "Sabaq" — Sabaq AI платформасының қазақ тілді AI-көмекшісісің. Платформада мына құралдар бар: ҚМЖ (сабақ жоспары), КТЖ (жылдық жоспар), Презентация (тақырып бойынша слайдтар), Сурет генерациясы (сабақ иллюстрациялары), Дода (викторина), Виртуалды зертхана, Sabaq Компилятор, Материал бойынша сұрақтар, ЖИ диктант, ҮОБ Энциклопедиясы, Материалдар кітапханасы, Сыныптар мен тесттер. Мұғалімнің сұрағына қысқа (2-4 сөйлем), нақты, қазақ тілінде жауап бер, қажет болса платформаның қай құралын пайдалану керектігін ұсын.`;

export async function generateAssistantReply(message: string): Promise<string> {
  try {
    const reply = await aiGenerate(`${assistantSystemPrompt}\n\nМұғалімнің сұрағы: "${message}"`);
    return reply.trim();
  } catch (e) {
    console.warn("ЖИ арқылы жауап алу мүмкін болмады, ереже негізіндегі жауапқа көшірілді:", e);
    return generateAssistantReplyTemplate(message);
  }
}

export interface ClozeQuestion {
  sentence: string;
  masked: string;
  answer: string;
}

const kazakhStopwords = new Set([
  "және", "бірақ", "немесе", "яғни", "сондықтан", "себебі", "осылайша", "бұл", "сол", "әрі",
  "үшін", "туралы", "кезде", "болды", "болады", "керек", "мен", "сен", "ол", "біз", "сіз",
  "олар", "да", "де", "та", "те", "бір", "әр", "барлық", "әрбір", "неге", "қалай", "қандай",
]);

function pickClozeWord(words: string[]): { word: string; index: number } | null {
  let best = -1;
  let bestIndex = -1;
  words.forEach((w, i) => {
    const clean = w.replace(/[.,!?;:()"']/g, "");
    if (clean.length < 4) return;
    if (kazakhStopwords.has(clean.toLowerCase())) return;
    if (clean.length > best) {
      best = clean.length;
      bestIndex = i;
    }
  });
  if (bestIndex === -1) return null;
  return { word: words[bestIndex].replace(/[.,!?;:()"']/g, ""), index: bestIndex };
}

function generateClozeQuestionsTemplate(text: string, maxQuestions: number): ClozeQuestion[] {
  const sentences = text
    .split(/(?<=[.!?])\s+/)
    .map((s) => s.trim())
    .filter((s) => s.split(/\s+/).length >= 4);

  const questions: ClozeQuestion[] = [];
  for (const sentence of sentences) {
    if (questions.length >= maxQuestions) break;
    const words = sentence.split(/\s+/);
    const picked = pickClozeWord(words);
    if (!picked) continue;
    const masked = words
      .map((w, i) => (i === picked.index ? "____" : w))
      .join(" ");
    questions.push({ sentence, masked, answer: picked.word });
  }
  return questions;
}

const clozeQuestionAiSchema = {
  type: "OBJECT",
  properties: {
    sentence: { type: "STRING" },
    masked: { type: "STRING" },
    answer: { type: "STRING" },
  },
  required: ["sentence", "masked", "answer"],
};

const clozeAiSchema = {
  type: "OBJECT",
  properties: {
    questions: { type: "ARRAY", items: clozeQuestionAiSchema },
  },
  required: ["questions"],
};

export async function generateClozeQuestions(text: string, maxQuestions: number): Promise<ClozeQuestion[]> {
  const prompt = `Берілген мәтіннен ең маңызды ${maxQuestions} терминді/ұғымды тауып, толықтыру (cloze) сұрақтарын құра. Әр сұрақ үшін: "sentence" — мәтіннен алынған түпнұсқа сөйлем, "masked" — сол сөйлемдегі негізгі сөз/тіркес "____" деп ауыстырылған нұсқасы, "answer" — жасырылған сөз/тіркес. Тек мәтіннің өз мазмұнын қолдан, жаңа ақпарат ойлап шығарма. Мәтін:\n\n${text}`;

  try {
    const ai = await aiGenerateJson<{ questions: ClozeQuestion[] }>(prompt, clozeAiSchema);
    return ai.questions.slice(0, maxQuestions);
  } catch (e) {
    console.warn("ЖИ арқылы сұрақтар жасау мүмкін болмады, үлгі нұсқасына көшірілді:", e);
    return generateClozeQuestionsTemplate(text, maxQuestions);
  }
}

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
