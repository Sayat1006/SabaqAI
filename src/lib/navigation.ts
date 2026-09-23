import { ClipboardList, FileCheck2, FileText, Image, Presentation, Timer, type LucideIcon } from "lucide-react";

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
    label: "ҚМЖ жоспарлау",
    short: "ҚМЖ",
    icon: ClipboardList,
    description: "Қысқа мерзімді жоспарды пән мен сыныпқа сай бірнеше минутта дайында.",
  },
  {
    to: "/presentation",
    label: "Презентация",
    short: "Презентация",
    icon: Presentation,
    description: "Тақырыпты жазыңыз — стильді слайдтар автоматты құрастырылады.",
  },
  {
    to: "/images",
    label: "Сурет генерациясы",
    short: "Сурет",
    icon: Image,
    description: "Сабаққа арналған иллюстрацияларды стиліне қарай генерациялаңыз.",
  },
  {
    to: "/tests",
    label: "Тапсырмалар",
    short: "Тапсырмалар",
    icon: FileCheck2,
    description: "Деңгейлік тест, PISA, ҰБТ, БЖБ/ТЖБ және шығармашылық тапсырмаларды құрастырыңыз.",
  },
  {
    to: "/docs",
    label: "Құжаттар",
    short: "Құжаттар",
    icon: FileText,
    description: "Мінездеме, ата-ана жиналысының баяндамасы, тәрбие сағаты мен іс-шара сценарийі, тоқсандық есеп.",
  },
  {
    to: "/tools",
    label: "Сабақ құралдары",
    short: "Құралдар",
    icon: Timer,
    description: "Таймер, кездейсоқ оқушы, топқа бөлу, бағдаршам, шу өлшегіш және рефлексия — тақтаға толық экранда.",
  },
];
