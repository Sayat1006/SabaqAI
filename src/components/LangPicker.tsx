import { LANGS, type Lang } from "../lib/lang";

/** Материал тілін таңдау: қазақша немесе орысша (оқыту тілі орыс сыныптары үшін). */
export function LangPicker({ value, onChange }: { value: Lang; onChange: (l: Lang) => void }) {
  return (
    <fieldset>
      <legend className="mb-2 block text-[13px] font-semibold text-slate-500">Материал тілі</legend>
      <div className="grid grid-cols-2 gap-2" role="group">
        {LANGS.map((l) => (
          <button
            key={l.id}
            type="button"
            aria-pressed={value === l.id}
            onClick={() => onChange(l.id)}
            className={`min-h-10 rounded-xl border px-3 py-2 text-[13.5px] transition ${value === l.id ? "border-violet-600 bg-violet-600 text-white" : "border-slate-200 bg-white text-slate-600 hover:border-violet-500"}`}
          >
            {l.label}
          </button>
        ))}
      </div>
    </fieldset>
  );
}
