// «Құжаттар» бөлімі: мұғалімнің күнделікті құжаттарын (мінездеме, ата-ана жиналысының
// баяндамасы, тәрбие сағаты мен іс-шара сценарийі, тоқсандық есеп) AI арқылы дайындау.

import { aiGenerateJson } from "./ai";
import { monthlyValue } from "./generators";
import type { Lang } from "./lang";

export type DocType = "characteristic" | "parents" | "classHour" | "event" | "report" | "free";

export interface DocSection {
  heading: string;
  paragraphs: string[];
  bullets: string[];
  table?: { headers: string[]; rows: string[][] } | null;
}

export interface DocData {
  type: DocType;
  lang: Lang;
  title: string;
  subtitle: string;
  sections: DocSection[];
  /** Қолтаңба жолы, мыс.: «Сынып жетекшісі: ____________ А. Сейітова». */
  signature: string;
  /** Форма деректері — қайта генерациялау үшін. */
  input: DocInput;
}

export interface DocInput {
  type: DocType;
  lang: Lang;
  topic: string;
  grade: string;
  subject: string;
  student: string;
  quarter: string;
  notes: string;
  length: "short" | "medium" | "long";
  author: string;
}

export interface DocTypeDef {
  id: DocType;
  emoji: string;
  label: string;
  hint: string;
  /** Қай өрістер көрсетіледі. */
  fields: ("topic" | "student" | "subject" | "quarter")[];
  topicLabel: string;
  topicPh: string;
  notesPh: string;
}

export const DOC_TYPES: DocTypeDef[] = [
  {
    id: "characteristic",
    emoji: "🧑‍🎓",
    label: "Оқушыға мінездеме",
    hint: "Оқуы, мінезі, қызығушылығы, қоғамдық жұмысы",
    fields: ["student"],
    topicLabel: "",
    topicPh: "",
    notesPh: "Мыс.: үлгерімі жақсы, математиканы ұнатады, олимпиадаға қатысқан, сабырлы, кейде ұялшақ, сынып старостасы, футбол үйірмесіне барады...",
  },
  {
    id: "parents",
    emoji: "👨‍👩‍👧",
    label: "Ата-ана жиналысының баяндамасы",
    hint: "Баяндама мәтіні, күн тәртібі, ұсыныстар",
    fields: ["topic"],
    topicLabel: "Жиналыс тақырыбы",
    topicPh: "Мыс.: Балаңыздың бос уақыты және гаджеттер",
    notesPh: "Мыс.: 1-тоқсан қорытындысы, сабаққа кешігу мәселесі, экскурсия туралы шешім...",
  },
  {
    id: "classHour",
    emoji: "🎯",
    label: "Тәрбие сағатының сценарийі",
    hint: "Мақсаты, барысы, ойындар, рефлексия",
    fields: ["topic"],
    topicLabel: "Тәрбие сағатының тақырыбы",
    topicPh: "Мыс.: Достық — ең асыл қазына",
    notesPh: "Мыс.: 40 минут, топтық ойын болсын, бейнеролик көрсетемін, ата-аналар қатысады...",
  },
  {
    id: "event",
    emoji: "🎉",
    label: "Іс-шара сценарийі",
    hint: "Мерекелік кеш, сайыс, апталық, жүргізушілер сөзі",
    fields: ["topic"],
    topicLabel: "Іс-шара атауы",
    topicPh: "Мыс.: Наурыз мерекесіне арналған «Әз-Наурыз» кеші",
    notesPh: "Мыс.: 2 жүргізуші, 3 ән, 1 би, «Кім жылдам?» сайысы, 45 минут...",
  },
  {
    id: "report",
    emoji: "📊",
    label: "Тоқсандық есеп",
    hint: "Пән бойынша немесе сынып жетекшісінің есебі",
    fields: ["subject", "quarter"],
    topicLabel: "",
    topicPh: "",
    notesPh: "Мыс.: 25 оқушы, 5 — өте жақсы, 12 — жақсы, 8 — қанағаттанарлық; сапасы 68%; 2 оқушы олимпиадада жүлделі; бағдарлама толық орындалды...",
  },
  {
    id: "free",
    emoji: "✍️",
    label: "Еркін құжат",
    hint: "Хат, хабарландыру, өтініш, ұсыныс хат және т.б.",
    fields: ["topic"],
    topicLabel: "Қандай құжат керек?",
    topicPh: "Мыс.: Ата-аналарға экскурсия туралы хабарландыру",
    notesPh: "Құжатта болуы тиіс деректер: күні, орны, бағасы, жауапты адам...",
  },
];

export const docTypeOf = (t: DocType) => DOC_TYPES.find((d) => d.id === t) ?? DOC_TYPES[0];

export const QUARTERS = ["1-тоқсан", "2-тоқсан", "3-тоқсан", "4-тоқсан", "Жылдық"];

export const DOC_LENGTHS: { id: DocInput["length"]; label: string; words: string }[] = [
  { id: "short", label: "Қысқа", words: "250–400" },
  { id: "medium", label: "Орташа", words: "500–800" },
  { id: "long", label: "Толық", words: "900–1400" },
];

/** Құжат атауы (тізімде және Word файлында). */
export function docTitleOf(input: DocInput): string {
  const def = docTypeOf(input.type);
  if (input.type === "characteristic") return `${def.label}: ${input.student || "оқушы"}`;
  if (input.type === "report") return `${def.label}: ${[input.subject, input.grade, input.quarter].filter(Boolean).join(", ")}`;
  return input.topic || def.label;
}

const schema = {
  type: "OBJECT",
  properties: {
    title: { type: "STRING" },
    subtitle: { type: "STRING" },
    sections: {
      type: "ARRAY",
      items: {
        type: "OBJECT",
        properties: {
          heading: { type: "STRING" },
          paragraphs: { type: "ARRAY", items: { type: "STRING" } },
          bullets: { type: "ARRAY", items: { type: "STRING" } },
          tableHeaders: { type: "ARRAY", items: { type: "STRING" } },
          tableRows: { type: "ARRAY", items: { type: "ARRAY", items: { type: "STRING" } } },
        },
        required: ["heading", "paragraphs", "bullets"],
      },
    },
    signature: { type: "STRING" },
  },
  required: ["title", "subtitle", "sections", "signature"],
};

interface RawDoc {
  title?: string;
  subtitle?: string;
  sections?: { heading?: string; paragraphs?: string[]; bullets?: string[]; tableHeaders?: string[]; tableRows?: string[][] }[];
  signature?: string;
}

const RU_GRADE = (g: string) => g.replace("сынып", "класс");

function structureHint(input: DocInput, ru: boolean): string {
  const value = monthlyValue("");
  switch (input.type) {
    case "characteristic":
      return ru
        ? `Характеристика на ученика ${input.student || "(имя не указано)"}, ${RU_GRADE(input.grade)}. Официальный стиль, от третьего лица. Разделы: общие сведения; учебная деятельность (успеваемость, сильные предметы, отношение к учёбе); личностные качества и поведение; общественная и внеурочная деятельность (кружки, конкурсы, поручения); взаимоотношения с одноклассниками и учителями; вывод и рекомендации. Пиши только на основе указанных фактов; где фактов нет — нейтрально и доброжелательно, ничего не выдумывай (оценки, награды, диагнозы). Подпись: «Классный руководитель: ____________ ${input.author}».`
        : `${input.student || "(аты көрсетілмеген)"} есімді оқушыға мінездеме, ${input.grade}. Ресми стиль, үшінші жақтан. Бөлімдер: жалпы мәлімет; оқу іс-әрекеті (үлгерімі, қабілетті пәндері, оқуға көзқарасы); жеке қасиеттері мен тәртібі; қоғамдық және сыныптан тыс жұмысы (үйірме, сайыс, тапсырмалар); сыныптастарымен және мұғалімдермен қарым-қатынасы; қорытынды және ұсыныс. Тек берілген деректерге сүйен; дерек жоқ жерде бейтарап, жылы жаз, ештеңе ойдан қоспа (баға, марапат, диагноз). Қолтаңба: «Сынып жетекшісі: ____________ ${input.author}».`;
    case "parents":
      return ru
        ? `Доклад на родительском собрании, ${RU_GRADE(input.grade)}, тема: «${input.topic}». Разделы: повестка дня (списком); вступительное слово; основная часть доклада (2–3 подраздела с практическими примерами и цифрами из заметок, если есть); практические советы родителям (списком); вопросы для обсуждения; проект решения собрания (списком). Живой, уважительный язык.`
        : `${input.grade} ата-ана жиналысына арналған баяндама, тақырыбы: «${input.topic}». Бөлімдер: күн тәртібі (тізім); кіріспе сөз; баяндаманың негізгі бөлімі (2–3 тармақша, тәжірибелік мысалдармен, жазбаларда сандар болса — қолдан); ата-аналарға кеңестер (тізім); талқылауға сұрақтар; жиналыс шешімінің жобасы (тізім). Жылы, құрметті тілмен.`;
    case "classHour":
      return ru
        ? `Сценарий классного часа, ${RU_GRADE(input.grade)}, тема: «${input.topic}». Разделы: цель и задачи; ценность месяца (${value.title}) и как она раскрывается; оборудование; ход классного часа по этапам с указанием минут (организационный момент, вступление, основная часть с интерактивными заданиями/играми/обсуждением, практическое задание в группах, рефлексия) — слова учителя в прямой речи; итог. Добавь таблицу «Этап | Время | Деятельность учителя | Деятельность учащихся».`
        : `${input.grade} тәрбие сағатының сценарийі, тақырыбы: «${input.topic}». Бөлімдер: мақсаты мен міндеттері; айдың құндылығы (${value.title}) және ол қалай ашылады; көрнекілігі; барысы кезеңдер бойынша, минутымен (ұйымдастыру, кіріспе, негізгі бөлім — интерактивті тапсырмалар/ойындар/талқылау, топтық практикалық жұмыс, рефлексия) — мұғалімнің сөзі төл сөзбен; қорытынды. «Кезең | Уақыты | Мұғалім әрекеті | Оқушы әрекеті» кестесін қос.`;
    case "event":
      return ru
        ? `Сценарий мероприятия «${input.topic}» (${RU_GRADE(input.grade)}). Разделы: цель; участники и роли; оформление и оборудование; ход мероприятия — полные слова ведущих (Ведущий 1, Ведущий 2) в прямой речи, номера программы, конкурсы с правилами; заключительное слово. Добавь таблицу программы «№ | Номер | Исполнители | Время».`
        : `«${input.topic}» іс-шарасының сценарийі (${input.grade}). Бөлімдер: мақсаты; қатысушылар мен рөлдер; безендіру мен жабдықтар; барысы — жүргізушілердің (1-жүргізуші, 2-жүргізуші) толық сөздері төл сөзбен, бағдарлама нөмірлері, сайыстар ережесімен; қорытынды сөз. «№ | Нөмір | Орындаушылар | Уақыты» бағдарлама кестесін қос.`;
    case "report":
      return ru
        ? `Отчёт учителя по предмету «${input.subject}» за ${input.quarter.replace("тоқсан", "четверть").replace("Жылдық", "учебный год")}, ${RU_GRADE(input.grade)}. Разделы: общие сведения (количество учащихся); выполнение учебной программы; результаты обучения — таблица «Показатель | Количество | %» (отлично, хорошо, удовлетворительно, неудовлетворительно, качество знаний, успеваемость) — считай только по данным из заметок, если данных нет — оставь «___»; работа с одарёнными и отстающими; использованные методы и технологии; проблемы и пути решения; задачи на следующий период. Официальный стиль. Подпись: «Учитель: ____________ ${input.author}».`
        : `«${input.subject}» пәні бойынша ${input.quarter} есебі, ${input.grade}. Бөлімдер: жалпы мәлімет (оқушы саны); оқу бағдарламасының орындалуы; оқу нәтижелері — «Көрсеткіш | Саны | %» кестесі (өте жақсы, жақсы, қанағаттанарлық, қанағаттанарлықсыз, білім сапасы, үлгерім) — тек жазбадағы деректермен есепте, дерек жоқ болса «___» қалдыр; дарынды және үлгерімі төмен оқушылармен жұмыс; қолданылған әдіс-тәсілдер; кездескен қиындықтар және шешу жолдары; келесі кезеңге міндеттер. Ресми стиль. Қолтаңба: «Пән мұғалімі: ____________ ${input.author}».`;
    default:
      return ru
        ? `Документ: «${input.topic}» (${RU_GRADE(input.grade)}). Определи подходящую структуру для такого документа (обращение, основная часть, детали списком, заключение/подпись).`
        : `Құжат: «${input.topic}» (${input.grade}). Осындай құжатқа лайық құрылымды өзің анықта (қаратпа сөз, негізгі бөлім, мәліметтер тізіммен, қорытынды/қолтаңба).`;
  }
}

export async function generateDocument(input: DocInput): Promise<DocData> {
  const ru = input.lang === "ru";
  const len = DOC_LENGTHS.find((l) => l.id === input.length) ?? DOC_LENGTHS[1];
  const prompt = ru
    ? `Ты опытный учитель и классный руководитель казахстанской школы. Подготовь готовый к печати документ.
${structureHint(input, true)}
${input.notes.trim() ? `Факты и пожелания учителя (обязательно учти):\n${input.notes.trim()}\n` : ""}Объём: примерно ${len.words} слов.
Формат JSON: "title" — заголовок документа; "subtitle" — строка под заголовком (класс, дата «___» или учебный год); "sections" — разделы, в каждом "heading", "paragraphs" (абзацы связного текста), "bullets" (пункты списка, может быть пустым), при необходимости таблица "tableHeaders" + "tableRows"; "signature" — строка подписи (или пустая строка).
Весь текст — только на русском языке, грамотно, без markdown-разметки и без эмодзи.`
    : `Сен Қазақстан мектебінің тәжірибелі мұғалімі және сынып жетекшісісің. Басып шығаруға дайын құжат дайында.
${structureHint(input, false)}
${input.notes.trim() ? `Мұғалімнің деректері мен тілектері (міндетті түрде ескер):\n${input.notes.trim()}\n` : ""}Көлемі: шамамен ${len.words} сөз.
JSON форматы: "title" — құжат атауы; "subtitle" — атаудың астындағы жол (сынып, күні «___» немесе оқу жылы); "sections" — бөлімдер, әрқайсысында "heading", "paragraphs" (байланысқан мәтін азат жолдары), "bullets" (тізім тармақтары, бос болуы мүмкін), қажет болса кесте "tableHeaders" + "tableRows"; "signature" — қолтаңба жолы (немесе бос жол).
${input.lang === "en" ? "Бүкіл мәтін тек АҒЫЛШЫН тілінде (бөлім атаулары, қолтаңба да), сауатты, markdown белгілерінсіз және эмодзисіз." : "Бүкіл мәтін тек қазақ тілінде, сауатты, markdown белгілерінсіз және эмодзисіз."}`;

  const raw = await aiGenerateJson<RawDoc>(prompt, schema);
  const sections: DocSection[] = (raw.sections ?? [])
    .map((s) => {
      const headers = (s.tableHeaders ?? []).filter((h) => h?.trim());
      const rows = (s.tableRows ?? []).filter((r) => Array.isArray(r) && r.some((c) => c?.trim())).map((r) => headers.map((_, i) => r[i] ?? ""));
      return {
        heading: (s.heading ?? "").trim(),
        paragraphs: (s.paragraphs ?? []).map((p) => p.trim()).filter(Boolean),
        bullets: (s.bullets ?? []).map((b) => b.trim()).filter(Boolean),
        table: headers.length >= 2 && rows.length ? { headers, rows } : null,
      };
    })
    .filter((s) => s.heading || s.paragraphs.length || s.bullets.length || s.table);
  if (!sections.length) throw new Error(ru ? "AI вернул пустой документ. Попробуйте ещё раз." : "AI бос құжат қайтарды. Қайталап көріңіз.");
  return {
    type: input.type,
    lang: input.lang,
    title: (raw.title ?? "").trim() || docTitleOf(input),
    subtitle: (raw.subtitle ?? "").trim(),
    sections,
    signature: (raw.signature ?? "").trim(),
    input,
  };
}
