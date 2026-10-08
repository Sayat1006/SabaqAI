import { ArrowLeft, Box, Clock } from "lucide-react";
import { lazy, Suspense, useState, type ComponentType, type LazyExoticComponent } from "react";
import { Link, useParams } from "react-router-dom";
import { PageHeader } from "../components/PageHeader";
import { PageLoader } from "../components/PageLoader";
import { tr } from "../i18n";
import { GRADE_MODULES, LAB_WORKS, labById } from "../lab/catalog";
import type { LabWork } from "../lab/types";

// Әр зертханалық жұмыс (және Three.js) тек ашылғанда жүктеледі.
const WORKS: Record<string, LazyExoticComponent<ComponentType<{ lab: LabWork }>>> = {
  ohm: lazy(() => import("../lab/works/OhmLab")),
  pendulum: lazy(() => import("../lab/works/PendulumLab")),
  hooke: lazy(() => import("../lab/works/HookeLab")),
  incline: lazy(() => import("../lab/works/InclineLab")),
  lens: lazy(() => import("../lab/works/LensLab")),
};

function Soon({ lab }: { lab: LabWork }) {
  return (
    <div className="mt-6 grid gap-4 lg:grid-cols-[minmax(0,1fr)_340px]">
      <section className="rounded-[20px] border border-slate-200 bg-surface p-6">
        <div className="mb-4 flex items-center gap-2 rounded-xl bg-amber-50 px-3 py-2 text-[13.5px] text-amber-800 dark:bg-amber-950/40 dark:text-amber-300">
          <Clock size={16} /> {tr("Бұл жұмыстың 3D сахнасы дайындалуда. Әзірге теориясы мен формулаларын қолдануға болады.")}
        </div>
        <h3 className="mb-1 font-bold">{tr("Жұмыстың мақсаты")}</h3>
        <p className="mb-4 text-[14px] leading-relaxed text-slate-600">{lab.goal}</p>
        <h3 className="mb-1 font-bold">{tr("Теория")}</h3>
        <p className="mb-4 text-[14px] leading-relaxed text-slate-600">{lab.theory}</p>
        <h3 className="mb-1 font-bold">{tr("Жұмыс барысы")}</h3>
        <ol className="list-decimal pl-5 text-[14px] leading-relaxed text-slate-600">
          {lab.steps.map((s) => (
            <li key={s}>{s}</li>
          ))}
        </ol>
      </section>
      <aside className="flex flex-col gap-4">
        <section className="rounded-[20px] border border-slate-200 bg-surface p-5">
          <h3 className="mb-2 font-bold">{tr("Формулалар")}</h3>
          {lab.formulas.map((f) => (
            <div key={f.id} className="mb-1.5 rounded-lg bg-violet-50 px-3 py-2">
              <div className="font-mono font-bold text-violet-800">{f.expression}</div>
              <div className="text-[12px] text-slate-500">{f.description}</div>
            </div>
          ))}
        </section>
        <section className="rounded-[20px] border border-slate-200 bg-surface p-5">
          <h3 className="mb-2 font-bold">{tr("Құрал-жабдықтар")}</h3>
          <ul className="text-[13.5px] text-slate-600">
            {lab.equipment.map((e) => (
              <li key={e.id}>• {e.name}</li>
            ))}
          </ul>
        </section>
      </aside>
    </div>
  );
}

function LabCard({ lab }: { lab: LabWork }) {
  return (
    <Link
      to={`/lab/${lab.id}`}
      className="group flex flex-col gap-2.5 rounded-[18px] border border-slate-200 bg-surface p-5 transition hover:-translate-y-0.5 hover:border-violet-400 hover:shadow-[0_16px_32px_-24px_rgba(27,26,46,.4)]"
    >
      <div className="flex items-start justify-between gap-2">
        <span className="flex h-12 w-12 items-center justify-center rounded-[14px] bg-violet-100 text-2xl">{lab.emoji}</span>
        {lab.ready ? (
          <span className="inline-flex items-center gap-1 rounded-full bg-emerald-100 px-2.5 py-1 text-[11.5px] font-semibold text-emerald-700 dark:bg-emerald-950/50 dark:text-emerald-300">
            <Box size={12} /> 3D
          </span>
        ) : (
          <span className="rounded-full bg-slate-100 px-2.5 py-1 text-[11.5px] font-semibold text-slate-500">{tr("Жақында")}</span>
        )}
      </div>
      <h3 className="text-[15.5px] leading-snug font-bold group-hover:text-violet-700">{lab.title}</h3>
      <p className="line-clamp-3 text-[13px] leading-relaxed text-slate-500">{lab.goal}</p>
      <div className="mt-auto flex flex-wrap gap-1.5 pt-1">
        {lab.formulas.slice(0, 2).map((f) => (
          <span key={f.id} className="rounded-md bg-slate-100 px-2 py-0.5 font-mono text-[11.5px] text-slate-600">
            {f.expression}
          </span>
        ))}
      </div>
    </Link>
  );
}

/** 7–11 сынып физикасының 3D виртуалды зертханасы. */
export default function PhysicsLabPage() {
  const { id } = useParams();
  const lab = labById(id);
  const [grade, setGrade] = useState<number | "all">("all");

  if (lab) {
    const Work = WORKS[lab.id];
    return (
      <div className="mx-auto max-w-[1600px] px-4 py-7 sm:px-8">
        <Link to="/lab" className="mb-3 inline-flex items-center gap-1.5 text-[13px] font-semibold text-slate-500 hover:text-violet-600">
          <ArrowLeft size={15} /> {tr("Барлық зертханалық жұмыстар")}
        </Link>
        <div className="flex flex-wrap items-center gap-3">
          <span className="text-3xl">{lab.emoji}</span>
          <div>
            <div className="text-[12.5px] font-semibold text-violet-600">
              {tr("{n}-сынып", { n: lab.grade })} · {lab.module}
            </div>
            <h1 className="text-[24px] leading-tight font-bold">{lab.title}</h1>
          </div>
        </div>
        {lab.ready && Work ? (
          <Suspense fallback={<PageLoader />}>
            <Work lab={lab} />
          </Suspense>
        ) : (
          <Soon lab={lab} />
        )}
      </div>
    );
  }

  const grades = GRADE_MODULES.filter((g) => grade === "all" || g.grade === grade);
  return (
    <div className="mx-auto max-w-[1440px] px-4 py-9 sm:px-10">
      <PageHeader
        crumb={tr("Физика зертханасы")}
        title={tr("3D физика зертханасы")}
        subtitle={tr("7–11 сынып физикасының виртуалды зертханалық жұмыстары: құралдарды тышқанмен жылжытып, тізбек жинап, өлшеулерді кестеге жазыңыз. Барлық есептеулер нақты физикалық формулалармен жүргізіледі.")}
      />
      <div className="mt-6 flex flex-wrap gap-1.5" role="tablist">
        {(["all", 7, 8, 9, 10, 11] as const).map((g) => (
          <button
            key={g}
            type="button"
            role="tab"
            aria-selected={grade === g}
            onClick={() => setGrade(g)}
            className={`rounded-full px-4 py-2 text-[13.5px] font-semibold transition ${grade === g ? "bg-navy-900 text-white dark:bg-violet-600" : "border border-slate-200 bg-surface text-slate-600 hover:border-violet-400"}`}
          >
            {g === "all" ? tr("Барлығы") : tr("{n}-сынып", { n: g })}
          </button>
        ))}
      </div>
      {grades.map((g) => (
        <section key={g.grade} className="mt-8">
          <div className="mb-3 flex flex-wrap items-baseline gap-x-3">
            <h2 className="text-xl font-bold">{tr("{n}-сынып", { n: g.grade })}</h2>
            <span className="text-[13.5px] text-slate-500">{g.title}</span>
          </div>
          <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
            {LAB_WORKS.filter((l) => l.grade === g.grade).map((l) => (
              <LabCard key={l.id} lab={l} />
            ))}
          </div>
        </section>
      ))}
    </div>
  );
}
