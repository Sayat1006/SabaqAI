// Интерфейс тілі: қазақша (негізгі), орысша, ағылшынша.
// Кілт — қазақша мәтіннің өзі: аудармасы жоқ жерде қазақша шыға береді.
// Тіл ауысқанда бет қайта жүктеледі, сондықтан t() кез келген жерде (тұрақтыларда да) жұмыс істейді.
// Материал тілі (ҚМЖ, тест, құжат қай тілде жасалады) — бұдан бөлек, lib/lang.ts.

export type UiLang = "kk" | "ru" | "en";

export const UI_LANGS: { id: UiLang; label: string; short: string }[] = [
  { id: "kk", label: "Қазақша", short: "Қаз" },
  { id: "ru", label: "Русский", short: "Рус" },
  { id: "en", label: "English", short: "Eng" },
];

const KEY = "ainur-ui-lang";

function read(): UiLang {
  try {
    const v = localStorage.getItem(KEY);
    return v === "ru" || v === "en" ? v : "kk";
  } catch {
    return "kk";
  }
}

export const uiLang: UiLang = read();

// Сөздік тек керек тілде ғана жүктеледі (қазақша интерфейске ешқайсысы керек емес).
let dict: Record<string, string> = {};

/** main.tsx қосымшаны көрсетпес бұрын шақырады: осыдан кейін tr() аударманы қайтарады. */
export async function loadUiDict() {
  if (uiLang === "ru") dict = (await import("./ru")).default;
  else if (uiLang === "en") dict = (await import("./en")).default;
}

/** Аударма. {name} түріндегі орындарға vars мәндері қойылады. */
export function tr(key: string, vars?: Record<string, string | number>): string {
  const s = dict[key] ?? key;
  return vars ? s.replace(/\{(\w+)\}/g, (m, k: string) => (k in vars ? String(vars[k]) : m)) : s;
}

export function setUiLang(lang: UiLang) {
  if (lang === uiLang) return;
  try {
    localStorage.setItem(KEY, lang);
  } catch {
    // жеке режим
  }
  window.location.reload();
}

/** Күн/уақытты пішімдеу үшін локаль. */
// «kk-KZ» локалін кейбір браузерлер толық қолдамай, АҚШ ретімен (ай/күн) шығарады —
// қазақша интерфейсте де күн.ай.жыл ретін береміз.
export const uiLocale = uiLang === "en" ? "en-GB" : "ru-RU";

export function initUiLang() {
  document.documentElement.lang = uiLang === "kk" ? "kk" : uiLang;
}
