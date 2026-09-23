import { ArrowRight, Bell, Search, Sparkles, X } from "lucide-react";
import { useEffect, useMemo, useState } from "react";
import { Link } from "react-router-dom";
import { useAuth } from "../context/useAuth";
import { UserMenu } from "../components/UserMenu";
import { firstNameOf } from "../lib/names";
import { ProjectCard } from "../components/ProjectCard";
import { tools } from "../lib/navigation";
import { deleteProject, getRecentProjects, statsOf, type RecentProject } from "../lib/projects";
import { useLoad } from "../lib/useLoad";
import { useCountUp } from "../lib/useCountUp";

const announcements = [
  {
    id: "a1",
    title: "ІІ тоқсанның ҚМЖ-ларын тапсыру мерзімі",
    body: "Барлық пән мұғалімдері 2-тоқсанға арналған қысқа мерзімді жоспарларды әдістемелік кеңеске 25-күніне дейін тапсыруы тиіс.",
    date: "Бүгін",
  },
  {
    id: "a2",
    title: "БЖБ/ТЖБ кестесі жаңартылды",
    body: "Тоқсандық жиынтық бағалау кестесін «Сабақ кестесі» бетінен тексеріңіз.",
    date: "Кеше",
  },
  {
    id: "a3",
    title: "Әдістемелік семинар",
    body: "«Оқыту мақсаттарын критериалды бағалаумен байланыстыру» — бейсенбі, 15:00, әдіскерлер бөлмесі.",
    date: "2 күн бұрын",
  },
];

function greeting(): string {
  const hour = Number(
    new Intl.DateTimeFormat("en-US", { hour: "numeric", hour12: false, timeZone: "Asia/Almaty" }).format(new Date()),
  );
  if (hour < 5) return "Қайырлы түн";
  if (hour < 12) return "Қайырлы таң";
  if (hour < 18) return "Қайырлы күн";
  return "Қайырлы кеш";
}

function Stat({ value, label }: { value: number; label: string }) {
  const animated = useCountUp(value, 900);
  return (
    <div className="rounded-[18px] border border-slate-200 bg-white px-4 py-4 sm:px-6 sm:py-5">
      <div className="text-[24px] font-bold sm:text-[28px]">{animated}</div>
      <div className="mt-1 text-[13.5px] text-slate-500">{label}</div>
    </div>
  );
}

const TONES = [
  { tone: "bg-violet-100 text-violet-500", link: "text-violet-600" },
  { tone: "bg-fuchsia-100 text-fuchsia-500", link: "text-fuchsia-600" },
];

export default function Home() {
  const { user } = useAuth();
  const [query, setQuery] = useState("");
  const [drawerOpen, setDrawerOpen] = useState(false);
  const { data, setData, error: loadError, loading } = useLoad(getRecentProjects);
  const projects = useMemo(() => data ?? [], [data]);
  const stats = statsOf(projects);

  useEffect(() => {
    if (!drawerOpen) return;
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && setDrawerOpen(false);
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [drawerOpen]);

  const q = query.trim().toLowerCase();
  const matchedTools = useMemo(
    () => (q ? tools.filter((i) => `${i.label} ${i.description}`.toLowerCase().includes(q)) : []),
    [q],
  );
  const shownProjects = q
    ? projects.filter((p) => `${p.title} ${p.detail}`.toLowerCase().includes(q))
    : projects.slice(0, 6);

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
    <div className="mx-auto flex max-w-[1440px] flex-col gap-10 px-4 py-8 sm:px-8 lg:px-14 lg:py-11">
      {/* Тақырып жолы */}
      <div className="flex flex-wrap items-start justify-between gap-6">
        <div>
          <h1 className="text-[32px] leading-tight font-bold">
            {greeting()}
            {user ? `, ${firstNameOf(user.name)}` : ""}!
          </h1>
          <p className="mt-1.5 text-[15.5px] text-slate-500">Бүгін қандай сабаққа дайындаласыз?</p>
        </div>
        <div className="flex w-full items-center gap-3 sm:w-auto">
          <label className="flex h-11 flex-1 items-center gap-2.5 rounded-[14px] border border-slate-200 bg-white px-4 sm:w-[260px] sm:flex-none">
            <Search size={17} className="text-slate-500" />
            <span className="sr-only">Жобалар мен құралдарды іздеу</span>
            <input
              type="search"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="Жобаларды іздеу"
              className="w-full bg-transparent text-sm outline-none"
            />
          </label>
          <button
            type="button"
            onClick={() => setDrawerOpen(true)}
            aria-label="Хабарландырулар"
            className="relative flex h-11 w-11 items-center justify-center rounded-[14px] border border-slate-200 bg-white transition hover:-translate-y-0.5"
          >
            <Bell size={19} strokeWidth={1.8} />
            <span className="absolute top-2.5 right-2.5 h-2 w-2 rounded-full border-2 border-white bg-violet-500" />
          </button>
          <UserMenu />
        </div>
      </div>

      {q && (
        <section>
          <h2 className="mb-4 text-xl font-bold">Іздеу нәтижесі: «{query.trim()}»</h2>
          {matchedTools.length > 0 && (
            <div className="mb-4 flex flex-wrap gap-2">
              {matchedTools.map((t) => (
                <Link
                  key={t.to}
                  to={t.to}
                  className="inline-flex items-center gap-2 rounded-full border border-slate-200 bg-white px-4 py-2 text-sm hover:border-violet-500"
                >
                  <t.icon size={15} /> {t.label}
                </Link>
              ))}
            </div>
          )}
          {matchedTools.length === 0 && shownProjects.length === 0 && (
            <p className="text-slate-500">Ештеңе табылмады.</p>
          )}
        </section>
      )}

      {!q && (
        <>
          {/* AI көмекшісі */}
          <div className="flex flex-wrap items-stretch gap-7">
            <div className="flex flex-[1_1_420px] flex-col gap-4 rounded-3xl border border-white/70 bg-white/70 p-8 shadow-[0_24px_48px_-30px_rgba(27,26,46,.2)] backdrop-blur-xl">
              <div className="flex items-center gap-2 text-[13px] font-semibold tracking-wide text-violet-600 uppercase">
                <Sparkles size={15} /> AI көмекшісі
              </div>
              <h2 className="text-[23px] leading-snug font-bold">Сабақты үш қадамда дайындаңыз</h2>
              <div className="flex flex-col gap-2">
                {[
                  ["Тақырып", "Қолмен жазасыз — мыс.: «Жай бөлшектерді салыстыру»"],
                  ["Оқу мақсаты", "Қолмен жазасыз — мыс.: «5.1.2.7 — жай бөлшектерді салыстыру»"],
                  ["Құндылық", "AI сабақ мазмұнына сай құндылықты өзі енгізеді"],
                ].map(([t, d]) => (
                  <div key={t} className="rounded-xl border border-slate-200 bg-white px-4 py-3">
                    <div className="mb-0.5 text-[13px] font-bold">{t}</div>
                    <div className="text-sm text-slate-500">{d}</div>
                  </div>
                ))}
              </div>
              <div>
                <Link
                  to="/qmzh"
                  className="inline-flex items-center gap-2.5 rounded-[14px] bg-violet-600 px-6 py-3.5 text-[15px] font-semibold tracking-wide text-white uppercase transition hover:-translate-y-0.5 hover:shadow-[0_14px_26px_-10px_rgba(224,115,61,.4)]"
                >
                  Сабақты генерациялау <ArrowRight size={16} />
                </Link>
              </div>
            </div>

            <div aria-hidden className="relative hidden min-h-[280px] flex-[1_1_320px] [perspective:1400px] md:block">
              <div className="absolute top-[8%] left-[6%] h-[150px] w-[230px] animate-[floatC_6s_ease-in-out_infinite] rounded-[18px] bg-navy-900 p-[18px] shadow-[0_30px_50px_-20px_rgba(27,26,46,.25)]">
                <div className="text-[11px] text-[#9c98b3]">СУРЕТ</div>
                <div className="mt-2.5 h-2 w-3/5 rounded bg-violet-500" />
                <div className="mt-2 h-2 w-4/5 rounded bg-[#3a4568]" />
              </div>
              <div className="absolute top-[30%] left-[30%] h-[150px] w-[230px] animate-[floatB_5.2s_ease-in-out_infinite] rounded-[18px] border border-slate-200 bg-white p-[18px] shadow-[0_30px_50px_-18px_rgba(27,26,46,.19)]">
                <div className="text-[11px] text-slate-500">ПРЕЗЕНТАЦИЯ</div>
                <div className="mt-2.5 h-2 w-[70%] rounded bg-fuchsia-500" />
                <div className="mt-2 flex gap-1.5">
                  <div className="h-[26px] w-[26px] rounded-md bg-fuchsia-100" />
                  <div className="h-[26px] w-[26px] rounded-md bg-violet-100" />
                </div>
              </div>
              <div className="absolute top-[2%] left-[52%] h-[150px] w-[230px] animate-[floatA_4.6s_ease-in-out_infinite] rounded-[18px] bg-violet-500 p-[18px] shadow-[0_30px_55px_-18px_rgba(224,115,61,.28)]">
                <div className="text-[11px] text-white/85">ҚМЖ</div>
                <div className="mt-2.5 h-2 w-3/5 rounded bg-white/85" />
                <div className="mt-2 h-2 w-[85%] rounded bg-white/55" />
                <div className="mt-2 h-2 w-[45%] rounded bg-white/55" />
              </div>
            </div>
          </div>

          {/* Статистика */}
          <div className="grid grid-cols-2 gap-3 sm:gap-5 lg:grid-cols-4">
            <Stat value={stats.qmzh} label="жасалған ҚМЖ жоспары" />
            <Stat value={stats.slides} label="құрастырылған слайд" />
            <Stat value={stats.images} label="генерацияланған сурет" />
            <Stat value={stats.tests} label="тапсырмалар жинағы" />
          </div>

          {/* Жылдам жасау */}
          <section>
            <h2 className="mb-[18px] text-xl font-bold">Жылдам жасау</h2>
            <div className="flex flex-wrap gap-[22px] [perspective:1400px]">
              {tools.map((c, i) => (
                <Link
                  key={c.to}
                  to={c.to}
                  style={{ animationDelay: `${i * 0.1}s` }}
                  className="group flex flex-[1_1_230px] animate-[fadeUp_.6s_cubic-bezier(.16,1,.3,1)_both] flex-col gap-3.5 rounded-[20px] border border-slate-200 bg-white p-[26px] transition duration-300 hover:-translate-y-2 hover:shadow-[0_26px_44px_-18px_rgba(27,26,46,.22)]"
                >
                  <span className={`flex h-12 w-12 items-center justify-center rounded-[14px] ${TONES[i % 2].tone}`}>
                    <c.icon size={22} strokeWidth={1.8} />
                  </span>
                  <span className="text-[17px] font-semibold">{c.label}</span>
                  <span className="text-sm leading-relaxed text-slate-500">{c.description}</span>
                  <span className={`mt-auto inline-flex items-center gap-1.5 text-sm font-semibold transition-transform group-hover:translate-x-1 ${TONES[i % 2].link}`}>
                    Бастау <ArrowRight size={14} />
                  </span>
                </Link>
              ))}
            </div>
          </section>

        </>
      )}

      {/* Соңғы жобалар */}
      <section>
        <div className="mb-[18px] flex items-center justify-between gap-3">
          <h2 className="text-xl font-bold">{q ? "Жобалар" : "Соңғы жобалар"}</h2>
          <Link to="/projects" className="text-sm font-semibold text-violet-600">
            Барлығын көру
          </Link>
        </div>
        {loadError ? (
          <div role="alert" className="rounded-[18px] border border-rose-200 bg-rose-50 p-5 text-rose-700">{loadError}</div>
        ) : loading ? (
          <div className="rounded-[18px] border border-slate-200 bg-white p-7 text-center text-slate-500">Жүктелуде...</div>
        ) : shownProjects.length === 0 ? (
          <div className="rounded-[18px] border border-slate-200 bg-white p-7 text-center text-slate-500">
            {q ? "Жоба табылмады." : "Әзірге жоба жоқ. Жоғарыдағы құралдардың бірін таңдап, алғашқы материалыңызды жасаңыз."}
          </div>
        ) : (
          <div className="grid grid-cols-[repeat(auto-fill,minmax(260px,1fr))] gap-[18px]">
            {shownProjects.map((p, i) => (
              <ProjectCard key={p.id} project={p} index={i} onDelete={() => handleDelete(p)} />
            ))}
          </div>
        )}
      </section>

      {/* Хабарландырулар */}
      {drawerOpen && <button aria-label="Жабу" className="fixed inset-0 z-40 cursor-default" onClick={() => setDrawerOpen(false)} />}
      <aside
        aria-label="Хабарландырулар"
        aria-hidden={!drawerOpen}
        className={`fixed top-0 right-0 z-50 flex h-screen w-full max-w-[380px] flex-col gap-4 overflow-y-auto border-l border-slate-200 bg-white/95 px-6 py-7 shadow-[-24px_0_60px_-20px_rgba(27,26,46,.22)] backdrop-blur-xl transition-transform duration-500 ${
          drawerOpen ? "translate-x-0" : "invisible translate-x-[105%]"
        }`}
      >
        <div className="flex items-center justify-between">
          <h3 className="text-lg font-bold">Хабарландырулар</h3>
          <button
            type="button"
            onClick={() => setDrawerOpen(false)}
            aria-label="Жабу"
            className="flex h-9 w-9 items-center justify-center rounded-xl hover:bg-slate-100"
          >
            <X size={18} />
          </button>
        </div>
        {announcements.map((a) => (
          <div key={a.id} className="rounded-[14px] border border-slate-200 bg-white px-4 py-3.5">
            <div className="text-sm font-semibold">{a.title}</div>
            <div className="mt-1 text-[13px] text-slate-500">{a.body}</div>
            <div className="mt-2 text-xs text-slate-500">{a.date}</div>
          </div>
        ))}
      </aside>
    </div>
  );
}
