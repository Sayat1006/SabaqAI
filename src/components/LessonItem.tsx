import { ClipboardList } from "lucide-react";
import { Link, useNavigate } from "react-router-dom";
import { tr } from "../i18n";
import { kindLabel } from "../lib/ktzh";
import { className, qmzhPrefill, type Lesson } from "../lib/schedule";

/** Кестедегі бір сабақ: уақыты, пән мен сынып, КТЖ-дағы тақырыбы және «ҚМЖ» батырмасы. */
export function LessonItem({ lesson, compact = false }: { lesson: Lesson; compact?: boolean }) {
  const navigate = useNavigate();
  const { slot, row, plan } = lesson;
  const badge = row && row.kind !== "lesson" ? kindLabel(row.kind, plan?.lang) : "";
  return (
    <li className={`flex items-start gap-3 rounded-[14px] border border-slate-200 bg-surface ${compact ? "p-3" : "px-4 py-3.5"}`}>
      <span className="mt-0.5 shrink-0 rounded-lg bg-violet-100 px-2 py-1 text-[12.5px] font-bold text-violet-700 tabular-nums">{slot.time || "—"}</span>
      <div className="min-w-0 flex-1">
        <div className="text-[14px] font-semibold">
          {tr(slot.subject)} · {className(slot)}
          {badge && <span className="ml-2 rounded-md bg-fuchsia-100 px-1.5 py-0.5 text-[11px] font-bold text-fuchsia-700">{badge}</span>}
        </div>
        {row ? (
          <div className="mt-0.5 text-[13px] text-slate-600">{row.topic}</div>
        ) : (
          <div className="mt-0.5 text-[12.5px] text-slate-500">
            {tr("КТЖ-да бұл күнге тақырып жоқ.")}{" "}
            <Link to="/ktzh" className="font-semibold text-violet-600 hover:underline">
              {tr("КТЖ жасау")}
            </Link>
          </div>
        )}
      </div>
      <button
        type="button"
        onClick={() => navigate("/qmzh", { state: { prefill: qmzhPrefill(lesson) } })}
        title={tr("Осы сабаққа ҚМЖ жасау")}
        className="inline-flex shrink-0 items-center gap-1.5 rounded-[10px] border border-slate-200 px-2.5 py-1.5 text-[12.5px] font-semibold text-slate-700 hover:border-violet-500 hover:text-violet-600"
      >
        <ClipboardList size={14} /> {tr("ҚМЖ")}
      </button>
    </li>
  );
}
