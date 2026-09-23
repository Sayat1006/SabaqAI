import { Trash2 } from "lucide-react";
import { Link } from "react-router-dom";
import { KIND_LABEL, timeAgo, type RecentProject } from "../lib/projects";

const tone = (kind: RecentProject["kind"]) =>
  kind === "document" ? "bg-slate-100 text-slate-700" : kind === "presentation" || kind === "test" ? "bg-fuchsia-100 text-fuchsia-700" : "bg-violet-100 text-violet-700";

export function ProjectCard({ project: p, index, onDelete }: { project: RecentProject; index: number; onDelete: () => void }) {
  return (
    <article
      style={{ animationDelay: `${Math.min(index, 8) * 0.05}s` }}
      className="relative flex animate-[fadeUp_.5s_cubic-bezier(.16,1,.3,1)_both] flex-col gap-3.5 rounded-[18px] border border-slate-200 bg-surface p-5 transition hover:-translate-y-1 hover:shadow-[0_18px_32px_-18px_rgba(27,26,46,.2)]"
    >
      {p.thumb && (
        <div className="flex h-[140px] items-center justify-center overflow-hidden rounded-xl bg-slate-50">
          <img src={p.thumb} alt="" className="h-full w-full object-cover" />
        </div>
      )}
      <div className="flex items-start justify-between">
        <span className={`flex h-[38px] w-[38px] items-center justify-center rounded-[11px] text-[13.5px] font-bold ${tone(p.kind)}`}>
          {p.title.charAt(0).toUpperCase()}
        </span>
        <span className={`rounded-full px-2.5 py-1 text-[11.5px] font-semibold ${tone(p.kind)}`}>{KIND_LABEL[p.kind]}</span>
      </div>
      <div>
        <Link to={p.to} state={p.state} className="text-[15.5px] leading-snug font-semibold after:absolute after:inset-0 after:rounded-[18px]">
          {p.title}
        </Link>
        <div className="mt-1.5 text-[13px] text-slate-500">{p.detail}</div>
      </div>
      <div className="mt-auto flex items-center justify-between border-t border-slate-200 pt-3 text-[12.5px] text-slate-500">
        <span>{timeAgo(p.savedAt)}</span>
        <button
          type="button"
          onClick={onDelete}
          aria-label={`Жою: ${p.title}`}
          className="relative z-10 rounded-lg p-1.5 hover:bg-rose-50 hover:text-rose-700"
        >
          <Trash2 size={14} />
        </button>
      </div>
    </article>
  );
}
