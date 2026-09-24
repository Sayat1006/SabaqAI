import { Monitor, Moon, Sun } from "lucide-react";
import { useSyncExternalStore } from "react";
import { setUiLang, tr, UI_LANGS, uiLang } from "../i18n";
import { getThemePref, onThemeChange, setThemePref, type ThemePref } from "../lib/theme";

const THEMES: { id: ThemePref; icon: typeof Sun; label: string }[] = [
  { id: "light", icon: Sun, label: "Күндізгі" },
  { id: "dark", icon: Moon, label: "Түнгі" },
  { id: "system", icon: Monitor, label: "Жүйелік" },
];

const seg = (active: boolean) =>
  `flex flex-1 items-center justify-center gap-1.5 rounded-[9px] px-2 py-1.5 text-[12.5px] font-semibold transition ${active ? "bg-surface text-slate-900 shadow-sm dark:bg-slate-300" : "text-slate-500 hover:text-slate-900"}`;

/** Режим (күндізгі/түнгі) және интерфейс тілі. */
export function PrefsControls({ compact = false }: { compact?: boolean }) {
  const theme = useSyncExternalStore(onThemeChange, getThemePref, () => "system" as ThemePref);
  return (
    <div className={`flex flex-col gap-2 ${compact ? "" : "min-w-[210px]"}`}>
      <div role="group" aria-label={tr("Режим")} className="flex gap-1 rounded-[11px] bg-slate-100 p-1">
        {THEMES.map(({ id, icon: Icon, label }) => (
          <button key={id} type="button" aria-pressed={theme === id} title={tr(label)} onClick={() => setThemePref(id)} className={seg(theme === id)}>
            <Icon size={14} />
            {!compact && <span>{tr(label)}</span>}
          </button>
        ))}
      </div>
      <div role="group" aria-label={tr("Интерфейс тілі")} className="flex gap-1 rounded-[11px] bg-slate-100 p-1">
        {UI_LANGS.map((l) => (
          <button key={l.id} type="button" aria-pressed={uiLang === l.id} lang={l.id} onClick={() => setUiLang(l.id)} className={seg(uiLang === l.id)}>
            {l.short}
          </button>
        ))}
      </div>
    </div>
  );
}
