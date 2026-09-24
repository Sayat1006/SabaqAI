import { useMemo, useState } from "react";
import { PageHeader } from "../components/PageHeader";
import { ProjectCard } from "../components/ProjectCard";
import { deleteProject, getRecentProjects, KIND_LABEL, type ProjectKind, type RecentProject } from "../lib/projects";
import { useLoad } from "../lib/useLoad";
import { tr } from "../i18n";

const filters: ("" | ProjectKind)[] = ["", "qmzh", "presentation", "image", "test", "document"];

// ҚМЖ мен тапсырмалардың сипаттамасы «Пән · Сынып · ...» түрінде сақталады.
const partsOf = (p: RecentProject) => p.detail.split(" · ").map((x) => x.trim());
const subjectOf = (p: RecentProject) => (p.kind === "qmzh" || p.kind === "test" ? partsOf(p)[0] ?? "" : "");
const gradeOf = (p: RecentProject) => partsOf(p).find((x) => /сынып/.test(x)) ?? "";
const selectClass = "rounded-xl border border-slate-200 bg-surface px-3 py-2.5 text-sm outline-none focus:border-violet-500";

type SortKey = "new" | "old" | "az";

export default function ProjectsPage() {
  const { data, setData, error, loading } = useLoad(getRecentProjects);
  const projects = useMemo(() => data ?? [], [data]);
  const [kind, setKind] = useState<"" | ProjectKind>("");
  const [query, setQuery] = useState("");
  const [subject, setSubject] = useState("");
  const [grade, setGrade] = useState("");
  const [sort, setSort] = useState<SortKey>("new");

  const subjects = useMemo(() => [...new Set(projects.map(subjectOf).filter(Boolean))].sort(), [projects]);
  const grades = useMemo(
    () => [...new Set(projects.map(gradeOf).filter(Boolean))].sort((a, b) => parseInt(a, 10) - parseInt(b, 10)),
    [projects],
  );
  const counts = useMemo(() => {
    const c: Record<string, number> = { "": projects.length };
    projects.forEach((p) => (c[p.kind] = (c[p.kind] ?? 0) + 1));
    return c;
  }, [projects]);

  const q = query.trim().toLowerCase();
  const shown = projects
    .filter(
      (p) =>
        (!kind || p.kind === kind) &&
        (!subject || subjectOf(p) === subject) &&
        (!grade || gradeOf(p) === grade) &&
        (!q || `${p.title} ${p.detail}`.toLowerCase().includes(q)),
    )
    .sort((a, b) => (sort === "az" ? a.title.localeCompare(b.title, "kk") : sort === "old" ? a.savedAt - b.savedAt : b.savedAt - a.savedAt));
  const filtered = Boolean(q || kind || subject || grade);

  async function handleDelete(p: RecentProject) {
    if (!window.confirm(tr("«{title}» жобасын жоясыз ба?", { title: p.title }))) return;
    try {
      await deleteProject(p.id);
      setData(projects.filter((x) => x.id !== p.id));
    } catch (e) {
      window.alert(e instanceof Error ? e.message : tr("Жою мүмкін болмады."));
    }
  }

  return (
    <div className="mx-auto max-w-[1360px] px-4 py-9 sm:px-10">
      <PageHeader
        crumb={tr("Жобалар")}
        title={tr("Менің жобаларым")}
        subtitle={tr("Жасаған барлық ҚМЖ, презентация, сурет және тапсырмаларыңыз осында сақталады.")}
      />
      <div className="mt-7 mb-6 flex flex-wrap items-center gap-3">
        <div role="group" aria-label={tr("Түрі")} className="flex flex-wrap gap-2">
          {filters.map((f) => (
            <button
              key={f || "all"}
              type="button"
              aria-pressed={kind === f}
              onClick={() => setKind(f)}
              className={`min-h-10 rounded-full border px-4 py-2 text-[13.5px] transition ${
                kind === f ? "border-violet-600 bg-violet-600 text-white" : "border-slate-200 bg-surface text-slate-500 hover:border-violet-500"
              }`}
            >
              {f ? KIND_LABEL[f] : tr("Барлығы")}
              <span className={`ml-1.5 text-[12px] ${kind === f ? "text-white/80" : "text-slate-400"}`}>{counts[f] ?? 0}</span>
            </button>
          ))}
        </div>
        <div className="flex-1" />
        <input
          type="search"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          aria-label={tr("Іздеу")}
          placeholder={tr("Атауы немесе пәні бойынша іздеу")}
          className="w-full rounded-xl border border-slate-200 bg-surface px-3.5 py-2.5 text-sm outline-none focus:border-violet-500 sm:max-w-[320px]"
        />
      </div>
      <div className="mb-6 -mt-2 flex flex-wrap items-center gap-2.5">
        {subjects.length > 0 && (
          <select value={subject} onChange={(e) => setSubject(e.target.value)} aria-label={tr("Пән")} className={selectClass}>
            <option value="">{tr("Барлық пәндер")}</option>
            {subjects.map((x) => (
              <option key={x}>{x}</option>
            ))}
          </select>
        )}
        {grades.length > 0 && (
          <select value={grade} onChange={(e) => setGrade(e.target.value)} aria-label={tr("Сынып")} className={selectClass}>
            <option value="">{tr("Барлық сыныптар")}</option>
            {grades.map((x) => (
              <option key={x}>{x}</option>
            ))}
          </select>
        )}
        <select value={sort} onChange={(e) => setSort(e.target.value as SortKey)} aria-label={tr("Сұрыптау")} className={selectClass}>
          <option value="new">{tr("Алдымен жаңалары")}</option>
          <option value="old">{tr("Алдымен ескілері")}</option>
          <option value="az">{tr("Атауы бойынша (А–Я)")}</option>
        </select>
        {filtered && (
          <button
            type="button"
            onClick={() => {
              setKind("");
              setSubject("");
              setGrade("");
              setQuery("");
            }}
            className="rounded-xl px-3 py-2.5 text-sm font-semibold text-violet-700 hover:bg-violet-100"
          >
            {tr("Сүзгіні тазалау")}
          </button>
        )}
        {filtered && <span className="text-sm text-slate-500">{tr("Табылды:")} {shown.length}</span>}
      </div>
      {error ? (
        <div role="alert" className="rounded-[18px] border border-rose-200 bg-rose-50 p-5 text-rose-700">{error}</div>
      ) : loading ? (
        <div className="rounded-[18px] border border-slate-200 bg-surface p-7 text-center text-slate-500">{tr("Жүктелуде...")}</div>
      ) : shown.length === 0 ? (
        <div className="rounded-[18px] border border-slate-200 bg-surface p-7 text-center text-slate-500">
          {filtered ? tr("Ештеңе табылмады.") : tr("Әзірге жоба жоқ.")}
        </div>
      ) : (
        <div className="grid grid-cols-[repeat(auto-fill,minmax(260px,1fr))] gap-[18px]">
          {shown.map((p, i) => (
            <ProjectCard key={p.id} project={p} index={i} onDelete={() => handleDelete(p)} />
          ))}
        </div>
      )}
    </div>
  );
}
