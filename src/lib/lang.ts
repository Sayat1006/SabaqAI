import { uiLang } from "../i18n";

/** Материал тілі: қазақша немесе орысша. */
export type Lang = "kk" | "ru" | "en";

/** Материал тілі әдепкіде интерфейс тіліне сай. */
export const defaultMaterialLang: Lang = uiLang;

export const LANGS: { id: Lang; label: string }[] = [
  { id: "kk", label: "Қаз" },
  { id: "ru", label: "Рус" },
  { id: "en", label: "Eng" },
];

const SUBJECT_RU: Record<string, string> = {
  "Қазақ тілі": "Казахский язык",
  "Қазақ әдебиеті": "Казахская литература",
  "Орыс тілі": "Русский язык",
  "Орыс әдебиеті": "Русская литература",
  "Ағылшын тілі": "Английский язык",
  Дүниетану: "Познание мира",
  Жаратылыстану: "Естествознание",
  Биология: "Биология",
  Химия: "Химия",
  Физика: "Физика",
  География: "География",
  Информатика: "Информатика",
  "Қазақстан тарихы": "История Казахстана",
  "Дүниежүзі тарихы": "Всемирная история",
  "Құқық негіздері": "Основы права",
  "Өзін-өзі тану": "Самопознание",
  "Дене шынықтыру": "Физическая культура",
  Музыка: "Музыка",
  "Бейнелеу өнері": "Изобразительное искусство",
  "Көркем еңбек": "Художественный труд",
  "Қазақ тілі мен әдебиеті": "Казахский язык и литература",
  "Шетел тілі": "Иностранный язык",
  "Цифрлық сауаттылық": "Цифровая грамотность",
  "Конституция негіздері": "Основы Конституции",
  "Заң мен Тәртіп": "Закон и порядок",
  "Жеке қауіпсіздік": "Личная безопасность",
  "Алғашқы әскери және технологиялық дайындық": "Начальная военная и технологическая подготовка",
  "Графика және жобалау": "Графика и проектирование",
  "Кәсіпкерлік және бизнес негіздері": "Основы предпринимательства и бизнеса",
  "Екінші шетел тілі (тиісті бағытта)": "Второй иностранный язык",
};

const SUBJECT_EN: Record<string, string> = {
  Математика: "Mathematics",
  Алгебра: "Algebra",
  Геометрия: "Geometry",
  "Қазақ тілі": "Kazakh language",
  "Қазақ әдебиеті": "Kazakh literature",
  "Орыс тілі": "Russian language",
  "Орыс әдебиеті": "Russian literature",
  "Ағылшын тілі": "English",
  Дүниетану: "Knowledge of the world",
  Жаратылыстану: "Natural science",
  Биология: "Biology",
  Химия: "Chemistry",
  Физика: "Physics",
  География: "Geography",
  Информатика: "Computer science",
  "Қазақстан тарихы": "History of Kazakhstan",
  "Дүниежүзі тарихы": "World history",
  "Құқық негіздері": "Fundamentals of law",
  "Өзін-өзі тану": "Self-knowledge",
  "Дене шынықтыру": "Physical education",
  Музыка: "Music",
  "Бейнелеу өнері": "Visual arts",
  "Көркем еңбек": "Arts and crafts",
  "Қазақ тілі мен әдебиеті": "Kazakh language and literature",
  "Шетел тілі": "Foreign language",
  "Цифрлық сауаттылық": "Digital literacy",
  "Конституция негіздері": "Fundamentals of the Constitution",
  "Заң мен Тәртіп": "Law and Order",
  "Жеке қауіпсіздік": "Personal safety",
  "Алғашқы әскери және технологиялық дайындық": "Basic military and technological training",
  "Графика және жобалау": "Graphics and design",
  "Кәсіпкерлік және бизнес негіздері": "Fundamentals of entrepreneurship and business",
  "Екінші шетел тілі (тиісті бағытта)": "Second foreign language",
};

/** Пән атауы материал тілінде (каталогтағы атаулар қазақша). */
export const subjectIn = (subject: string, lang: Lang | undefined) =>
  lang === "ru" ? (SUBJECT_RU[subject] ?? subject) : lang === "en" ? (SUBJECT_EN[subject] ?? subject) : subject;

/** «5-сынып» → «5 класс» (орысша материалда). */
export const gradeIn = (grade: string, lang: Lang | undefined) =>
  lang === "ru" ? grade.replace(/^(\d+)-сынып$/, "$1 класс") : lang === "en" ? grade.replace(/^(\d+)-сынып$/, "Grade $1") : grade;

/** Промптқа: мазмұн қай тілде жазылуы керек. */
export const langName = (lang: Lang | undefined) => (lang === "ru" ? "ОРЫС" : lang === "en" ? "АҒЫЛШЫН" : "ҚАЗАҚ");
