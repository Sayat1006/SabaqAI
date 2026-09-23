import { ClipboardList, FileCheck2, Image, Presentation, type LucideIcon } from "lucide-react";

export interface Tool {
  to: string;
  label: string;
  short: string;
  icon: LucideIcon;
  description: string;
}

/** AI Nur-дың төрт құралы: бүйір мәзір, жоғарғы мәзір және басты беттегі карталар осыдан құрылады. */
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
];
