import { ClipboardList, FileCheck2, FileText, Image, Presentation, Timer, type LucideIcon } from "lucide-react";
import { tr } from "../i18n";

export interface Tool {
  to: string;
  label: string;
  short: string;
  icon: LucideIcon;
  description: string;
}

/** AI Nur құралдары: бүйір мәзір, жоғарғы мәзір және басты беттегі карталар осыдан құрылады. */
export const tools: Tool[] = [
  {
    to: "/qmzh",
    label: tr("ҚМЖ жоспарлау"),
    short: tr("ҚМЖ"),
    icon: ClipboardList,
    description: tr("Қысқа мерзімді жоспарды пән мен сыныпқа сай бірнеше минутта дайында."),
  },
  {
    to: "/presentation",
    label: tr("Презентация"),
    short: tr("Презентация"),
    icon: Presentation,
    description: tr("Тақырыпты жазыңыз — стильді слайдтар автоматты құрастырылады."),
  },
  {
    to: "/images",
    label: tr("Сурет генерациясы"),
    short: tr("Сурет"),
    icon: Image,
    description: tr("Сабаққа арналған иллюстрацияларды стиліне қарай генерациялаңыз."),
  },
  {
    to: "/tests",
    label: tr("Тапсырмалар"),
    short: tr("Тапсырмалар"),
    icon: FileCheck2,
    description: tr("Деңгейлік тест, PISA, ҰБТ, БЖБ/ТЖБ және шығармашылық тапсырмаларды құрастырыңыз."),
  },
  {
    to: "/docs",
    label: tr("Құжаттар"),
    short: tr("Құжаттар"),
    icon: FileText,
    description: tr("Мінездеме, ата-ана жиналысының баяндамасы, тәрбие сағаты мен іс-шара сценарийі, тоқсандық есеп."),
  },
  {
    to: "/tools",
    label: tr("Сабақ құралдары"),
    short: tr("Құралдар"),
    icon: Timer,
    description: tr("Таймер, кездейсоқ оқушы, топқа бөлу, бағдаршам, шу өлшегіш және рефлексия — тақтаға толық экранда."),
  },
];
