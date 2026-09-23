// Күндізгі / түнгі режим. Таңдау осы құрылғыда сақталады; «Жүйелік» — телефон
// немесе компьютер баптауына сай. Бет жүктелгенде жыпылықтамау үшін алғашқы
// қолдану index.html ішіндегі шағын скриптте жасалады.

export type ThemePref = "light" | "dark" | "system";

const KEY = "ainur-theme";
const listeners = new Set<() => void>();

export function getThemePref(): ThemePref {
  try {
    const v = localStorage.getItem(KEY);
    return v === "light" || v === "dark" ? v : "system";
  } catch {
    return "system";
  }
}

const systemDark = () => window.matchMedia?.("(prefers-color-scheme: dark)").matches ?? false;

export function isDark(): boolean {
  return document.documentElement.dataset.theme === "dark";
}

function apply() {
  const pref = getThemePref();
  const dark = pref === "dark" || (pref === "system" && systemDark());
  const root = document.documentElement;
  if (dark) root.dataset.theme = "dark";
  else delete root.dataset.theme;
  document.querySelector('meta[name="theme-color"]')?.setAttribute("content", dark ? "#121119" : "#b85a2a");
  listeners.forEach((l) => l());
}

export function setThemePref(pref: ThemePref) {
  try {
    if (pref === "system") localStorage.removeItem(KEY);
    else localStorage.setItem(KEY, pref);
  } catch {
    // жеке режим — тек осы сессияда
  }
  apply();
}

export function initTheme() {
  apply();
  window.matchMedia?.("(prefers-color-scheme: dark)").addEventListener?.("change", () => {
    if (getThemePref() === "system") apply();
  });
}

export function onThemeChange(fn: () => void) {
  listeners.add(fn);
  return () => {
    listeners.delete(fn);
  };
}
