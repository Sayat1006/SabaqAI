import { CalendarClock, CalendarDays, ClipboardList, FileCheck2, FileText, Image, LineChart, Presentation, Timer, type LucideIcon } from "lucide-react";
import { tr } from "../i18n";

export type ToolGroup = "plan" | "create" | "class";

export interface Tool {
  to: string;
  group: ToolGroup;
  label: string;
  short: string;
  icon: LucideIcon;
  description: string;
}

/** AI Nur құралдары: бүйір мәзір, жоғарғы мәзір және басты беттегі карталар осыдан құрылады. */
export const tools: Tool[] = [
  {
    to: "/schedule",
    group: "plan",
    label: tr("Сабақ кестесі"),
    short: tr("Кесте"),
    icon: CalendarClock,
    description: tr("Апталық кесте: әр сабақтың КТЖ-дағы тақырыбы және бір батырмамен ҚМЖ."),
  },
  {
    to: "/qmzh",
    group: "plan",
    label: tr("ҚМЖ жоспарлау"),
    short: tr("ҚМЖ"),
    icon: ClipboardList,
    description: tr("Қысқа мерзімді жоспарды пән мен сыныпқа сай бірнеше минутта дайында."),
  },
  {
    to: "/ktzh",
    group: "plan",
    label: tr("КТЖ"),
    short: tr("КТЖ"),
    icon: CalendarDays,
    description: tr("Тоқсанға арналған күнтізбелік-тақырыптық жоспар: бөлімдер, тақырыптар, оқу мақсаттары, БЖБ/ТЖБ және күндері."),
  },
  {
    to: "/presentation",
    group: "create",
    label: tr("Презентация"),
    short: tr("Презентация"),
    icon: Presentation,
    description: tr("Тақырыпты жазыңыз — стильді слайдтар автоматты құрастырылады."),
  },
  {
    to: "/images",
    group: "create",
    label: tr("Сурет генерациясы"),
    short: tr("Сурет"),
    icon: Image,
    description: tr("Сабаққа арналған иллюстрацияларды стиліне қарай генерациялаңыз."),
  },
  {
    to: "/tests",
    group: "create",
    label: tr("Тапсырмалар"),
    short: tr("Тапсырмалар"),
    icon: FileCheck2,
    description: tr("Деңгейлік тест, PISA, ҰБТ, БЖБ/ТЖБ және шығармашылық тапсырмаларды құрастырыңыз."),
  },
  {
    to: "/progress",
    group: "class",
    label: tr("Оқушы прогресі"),
    short: tr("Прогресс"),
    icon: LineChart,
    description: tr("Сынып бойынша тест нәтижелері: әр оқушының дамуы, әлсіз тақырыптары және AI қорытындысы."),
  },
  {
    to: "/docs",
    group: "create",
    label: tr("Құжаттар"),
    short: tr("Құжаттар"),
    icon: FileText,
    description: tr("Мінездеме, ата-ана жиналысының баяндамасы, тәрбие сағаты мен іс-шара сценарийі, тоқсандық есеп."),
  },
  {
    to: "/tools",
    group: "class",
    label: tr("Сабақ құралдары"),
    short: tr("Құралдар"),
    icon: Timer,
    description: tr("Таймер, кездейсоқ оқушы, топқа бөлу, бағдаршам, шу өлшегіш және рефлексия — тақтаға толық экранда."),
  },
];

/** Мәзір топтары: жоғарғы мәзірде ашылмалы тізім, телефонда тақтайшалар. */
export const TOOL_GROUPS: { id: ToolGroup; label: string }[] = [
  { id: "plan", label: tr("Жоспарлау") },
  { id: "create", label: tr("Материалдар") },
  { id: "class", label: tr("Сабақта") },
];

export const toolsIn = (g: ToolGroup) => tools.filter((t) => t.group === g);
