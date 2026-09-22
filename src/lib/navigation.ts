import { ClipboardList, FileCheck2, Image, Presentation, type LucideIcon } from "lucide-react";

export interface Tool {
  to: string;
  label: string;
  short: string;
  icon: LucideIcon;
  description: string;
}

/** Sabaq AI-дың төрт құралы: бүйір мәзір, жоғарғы мәзір және басты беттегі карталар осыдан құрылады. */
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
    label: "Тест генерациясы",
    short: "Тест",
    icon: FileCheck2,
    description: "Тақырып бойынша жауап кілті бар тестті бірден құрастырыңыз.",
  },
];
