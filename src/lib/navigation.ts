import {
  BookOpen,
  Bot,
  CalendarDays,
  CalendarRange,
  ClipboardList,
  Code2,
  FileQuestion,
  FlaskConical,
  FolderOpen,
  GraduationCap,
  Headphones,
  Image,
  Presentation,
  Swords,
  type LucideIcon,
} from "lucide-react";

export interface NavItem {
  to: string;
  label: string;
  icon: LucideIcon;
  description: string;
}

export interface NavGroup {
  title: string;
  items: NavItem[];
}

export const navGroups: NavGroup[] = [
  {
    title: "Сабақ жоспарлау",
    items: [
      {
        to: "/qmzh",
        label: "ҚМЖ жоспарлау",
        icon: ClipboardList,
        description: "Қысқа мерзімді жоспарды пән мен сыныпқа сай бірнеше минутта дайында.",
      },
      {
        to: "/ktj",
        label: "КТЖ",
        icon: CalendarRange,
        description: "Жыл бойғы күнтізбелік-тақырыптық жоспарды тоқсандар мен апталарға автоматты бөлу.",
      },
      {
        to: "/schedule",
        label: "Сабақ кестесі",
        icon: CalendarDays,
        description: "Апталық сабақ кестесі мен күнтізбе: тақырыптар, үй тапсырмасы, өткізілу белгісі.",
      },
    ],
  },
  {
    title: "AI студия",
    items: [
      {
        to: "/presentation",
        label: "Презентация",
        icon: Presentation,
        description: "Тақырыпты жазыңыз — стильді слайдтар автоматты құрастырылады.",
      },
      {
        to: "/images",
        label: "Сурет генерациясы",
        icon: Image,
        description: "Сабаққа арналған иллюстрацияларды стиліне қарай генерациялаңыз.",
      },
      {
        to: "/assistant",
        label: "Sabaq көмекшісі",
        icon: Bot,
        description: "Сабаққа дайындық бойынша кеңес беретін жеке AI-көмекші.",
      },
      {
        to: "/material-questions",
        label: "Материал бойынша сұрақтар",
        icon: FileQuestion,
        description: "Кез келген мәтінді тесттік сұрақтарға автоматты айналдыру.",
      },
      {
        to: "/dictation",
        label: "ЖИ диктант",
        icon: Headphones,
        description: "Мәтінді дауыстап оқитын, жылдамдығы реттелетін диктант режимі.",
      },
    ],
  },
  {
    title: "Интерактивті құралдар",
    items: [
      {
        to: "/doda",
        label: "Дода",
        icon: Swords,
        description: "Топтық викторина-ойын: ұпай тақтасымен сыныпты жарысқа шақыру.",
      },
      {
        to: "/lab",
        label: "Виртуалды зертхана",
        icon: FlaskConical,
        description: "Физика мен биологиядан интерактивті симуляциялар.",
      },
      {
        to: "/compiler",
        label: "Sabaq Компилятор",
        icon: Code2,
        description: "Информатика сабағына арналған браузер ішіндегі код ортасы.",
      },
    ],
  },
  {
    title: "Кітапхана және бағалау",
    items: [
      {
        to: "/encyclopedia",
        label: "ҮОБ Энциклопедиясы",
        icon: BookOpen,
        description: "Пәндер бойынша оқу мақсаттары мен таксономия базасы.",
      },
      {
        to: "/library",
        label: "Материалдар кітапханасы",
        icon: FolderOpen,
        description: "Дидактикалық материалдарды бір жерде сақтау және реттеу.",
      },
      {
        to: "/classes",
        label: "Сыныптар мен тесттер",
        icon: GraduationCap,
        description: "Сыныптарды құру, тест тағайындау және нәтижелерді бақылау.",
      },
    ],
  },
];

export const allNavItems: NavItem[] = navGroups.flatMap((g) => g.items);
