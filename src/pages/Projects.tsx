import { useMemo, useState } from "react";
import { PageHeader } from "../components/PageHeader";
import { ProjectCard } from "../components/ProjectCard";
import { deleteProject, getRecentProjects, KIND_LABEL, type ProjectKind, type RecentProject } from "../lib/projects";
import { useLoad } from "../lib/useLoad";

const filters: ("" | ProjectKind)[] = ["", "qmzh", "presentation", "image", "test"];

export default function ProjectsPage() {
  const { data, setData, error, loading } = useLoad(getRecentProjects);
  const projects = useMemo(() => data ?? [], [data]);
  const [kind, setKind] = useState<"" | ProjectKind>("");
  const [query, setQuery] = useState("");

  const q = query.trim().toLowerCase();
  const shown = projects.filter(
    (p) => (!kind || p.kind === kind) && (!q || `${p.title} ${p.detail}`.toLowerCase().includes(q)),
  );

  async function handleDelete(p: RecentProject) {
    if (!window.confirm(`«${p.title}» жобасын жоясыз ба?`)) return;
    try {
      await deleteProject(p.id);
      setData(projects.filter((x) => x.id !== p.id));
    } catch (e) {
      window.alert(e instanceof Error ? e.message : "Жою мүмкін болмады.");
    }
  }

  return (
    <div className="mx-auto max-w-[1360px] px-4 py-9 sm:px-10">
      <PageHeader
        crumb="Жобалар"
        title="Менің жобаларым"
        subtitle="Жасаған барлық ҚМЖ, презентация, сурет және тесттеріңіз осында сақталады."
      />
      <div className="mt-7 mb-6 flex flex-wrap items-center gap-3">
        <div role="group" aria-label="Түрі" className="flex flex-wrap gap-2">
          {filters.map((f) => (
            <button
              key={f || "all"}
              type="button"
              aria-pressed={kind === f}
              onClick={() => setKind(f)}
              className={`min-h-10 rounded-full border px-4 py-2 text-[13.5px] transition ${
                kind === f ? "border-violet-600 bg-violet-600 text-white" : "border-slate-200 bg-white text-slate-500 hover:border-violet-500"
              }`}
            >
              {f ? KIND_LABEL[f] : "Барлығы"}
            </button>
          ))}
        </div>
        <div className="flex-1" />
        <input
          type="search"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          aria-label="Іздеу"
          placeholder="Атауы немесе пәні бойынша іздеу"
          className="w-full rounded-xl border border-slate-200 bg-white px-3.5 py-2.5 text-sm outline-none focus:border-violet-500 sm:max-w-[320px]"
        />
      </div>
      {error ? (
        <div role="alert" className="rounded-[18px] border border-rose-200 bg-rose-50 p-5 text-rose-700">{error}</div>
      ) : loading ? (
        <div className="rounded-[18px] border border-slate-200 bg-white p-7 text-center text-slate-500">Жүктелуде...</div>
      ) : shown.length === 0 ? (
        <div className="rounded-[18px] border border-slate-200 bg-white p-7 text-center text-slate-500">
          {q || kind ? "Ештеңе табылмады." : "Әзірге жоба жоқ."}
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
