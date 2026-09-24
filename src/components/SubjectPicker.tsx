import { Check } from "lucide-react";
import { tr } from "../i18n";
import { SUBJECTS } from "../lib/catalog";
import { MAX_SUBJECTS } from "../lib/subjects";

/** Әкімші мұғалімге пән бекітеді: ең көбі 2, үшіншісін таңдау үшін біреуін алып тастау керек. */
export function SubjectPicker({ value, onChange }: { value: string[]; onChange: (v: string[]) => void }) {
  const full = value.length >= MAX_SUBJECTS;
  function toggle(s: string) {
    onChange(value.includes(s) ? value.filter((x) => x !== s) : full ? value : [...value, s]);
  }
  return (
    <div>
      <div className="mb-2 flex items-center justify-between text-[12.5px] text-slate-500">
        <span>{tr("Ең көбі {n} пән. Мұғалім тек осы пәндер бойынша материал жасай алады.", { n: MAX_SUBJECTS })}</span>
        <span className={`font-semibold ${full ? "text-violet-600" : ""}`}>
          {value.length}/{MAX_SUBJECTS}
        </span>
      </div>
      <div className="flex flex-wrap gap-1.5" role="group" aria-label={tr("Пәндер")}>
        {[...SUBJECTS, ...value.filter((v) => !SUBJECTS.includes(v))].map((s) => {
          const on = value.includes(s);
          const legacy = !SUBJECTS.includes(s);
          const order = value.indexOf(s);
          return (
            <button
              key={s}
              type="button"
              aria-pressed={on}
              disabled={!on && full}
              onClick={() => toggle(s)}
              className={`inline-flex items-center gap-1 rounded-full border px-3 py-1.5 text-[13px] transition ${
                on ? "border-violet-600 bg-violet-600 text-white" : "border-slate-200 bg-surface text-slate-600 hover:border-violet-400 disabled:cursor-not-allowed disabled:opacity-40"
              }`}
            >
              {on && <Check size={13} />}
              {tr(s)}
              {on && order === 0 && value.length > 1 && <span className="text-[10.5px] opacity-80">· {tr("негізгі")}</span>}
              {legacy && <span className="text-[10.5px] opacity-80">· {tr("тізімде жоқ")}</span>}
            </button>
          );
        })}
      </div>
    </div>
  );
}
