import {
  ChevronDown,
  FolderOpen,
  Home,
  Menu,
  ShieldCheck,
  UserRound,
  X,
} from "lucide-react";
import { useEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { Link, NavLink, useLocation } from "react-router-dom";
import { useAuth } from "../context/useAuth";
import { tr } from "../i18n";
import { toolsIn, TOOL_GROUPS, type ToolGroup } from "../lib/navigation";
import { useCurrentTool } from "../lib/useCurrentTool";

/** Сыртын басқанда немесе Esc басқанда жабылатын ашылмалы күй. */
function useDismiss<T extends HTMLElement>(open: boolean, close: () => void) {
  const ref = useRef<T>(null);
  useEffect(() => {
    if (!open) return;
    const onClick = (e: MouseEvent) =>
      !ref.current?.contains(e.target as Node) && close();
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && close();
    document.addEventListener("click", onClick);
    document.addEventListener("keydown", onKey);
    return () => {
      document.removeEventListener("click", onClick);
      document.removeEventListener("keydown", onKey);
    };
  }, [open, close]);
  return ref;
}

const pill = (active: boolean) =>
  `inline-flex items-center gap-1 rounded-[11px] px-3.5 py-2 text-[13.5px] font-semibold whitespace-nowrap transition-colors ${
    active
      ? "bg-navy-900 text-white dark:bg-violet-600"
      : "text-slate-500 hover:bg-violet-100 hover:text-violet-700"
  }`;

/** Жоғарғы мәзірдегі бір топ: «Жоспарлау ▾» → ҚМЖ, КТЖ. */
export function NavGroupMenu({
  group,
  label,
}: {
  group: ToolGroup;
  label: string;
}) {
  const [open, setOpen] = useState(false);
  const current = useCurrentTool();
  const ref = useDismiss<HTMLDivElement>(open, () => setOpen(false));
  const items = toolsIn(group);
  const active = current?.group === group;
  return (
    <div ref={ref} className="relative">
      <button
        type="button"
        aria-haspopup="true"
        aria-expanded={open}
        onClick={() => setOpen((v) => !v)}
        className={pill(active)}
      >
        {active ? current.short : label}
        <ChevronDown
          size={14}
          className={`transition-transform ${open ? "rotate-180" : ""}`}
        />
      </button>
      {open && (
        <div className="absolute top-[calc(100%+8px)] left-0 z-50 w-[300px] rounded-[16px] border border-slate-200 bg-surface p-1.5 shadow-[0_18px_36px_-18px_rgba(27,26,46,.3)]">
          <div className="px-3 pt-1.5 pb-1 text-[11.5px] font-semibold tracking-wide text-slate-400 uppercase">
            {label}
          </div>
          {items.map((t) => (
            <NavLink
              key={t.to}
              to={t.to}
              onClick={() => setOpen(false)}
              className={({ isActive }) =>
                `flex items-start gap-3 rounded-[12px] px-3 py-2.5 ${isActive ? "bg-violet-100" : "hover:bg-slate-50"}`
              }
            >
              <span className="mt-0.5 flex h-8 w-8 shrink-0 items-center justify-center rounded-[10px] bg-violet-100 text-violet-600">
                <t.icon size={17} />
              </span>
              <span className="min-w-0">
                <span className="block text-sm font-semibold text-slate-900">
                  {t.label}
                </span>
                <span className="line-clamp-2 block text-xs text-slate-500">
                  {t.description}
                </span>
              </span>
            </NavLink>
          ))}
        </div>
      )}
    </div>
  );
}

/** Компьютердегі жоғарғы мәзір: Басты бет · 3 топ · Жобалар. */
export function DesktopToolNav() {
  return (
    <nav
      aria-label={tr("Құралдар")}
      className="hidden items-center gap-1 rounded-[14px] border border-slate-200 bg-surface p-1 md:flex"
    >
      <NavLink to="/" end className={({ isActive }) => pill(isActive)}>
        {tr("Басты бет")}
      </NavLink>
      {TOOL_GROUPS.map((g) => (
        <NavGroupMenu key={g.id} group={g.id} label={g.label} />
      ))}
      <NavLink to="/projects" className={({ isActive }) => pill(isActive)}>
        {tr("Жобалар")}
      </NavLink>
    </nav>
  );
}

/** Телефондағы мәзір: бір батырма → топтарға бөлінген тақтайшалар. */
export function MobileMenu({ tone = "light" }: { tone?: "light" | "dark" }) {
  const [open, setOpen] = useState(false);
  const { user } = useAuth();
  const { pathname } = useLocation();

  // Бет ауысқанда мәзір жабылады.
  const [shownFor, setShownFor] = useState(pathname);
  if (shownFor !== pathname) {
    setShownFor(pathname);
    if (open) setOpen(false);
  }

  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && setOpen(false);
    document.addEventListener("keydown", onKey);
    const prev = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      document.removeEventListener("keydown", onKey);
      document.body.style.overflow = prev;
    };
  }, [open]);

  const tile = (active: boolean) =>
    `flex items-center gap-2.5 rounded-[14px] border px-3 py-3 text-[14px] font-semibold ${active ? "border-violet-600 bg-violet-100 text-violet-800" : "border-slate-200 bg-surface text-slate-800"}`;
  const is = (to: string) => pathname === to || pathname.startsWith(`${to}/`);

  return (
    <>
      <button
        type="button"
        onClick={() => setOpen(true)}
        aria-label={tr("Мәзір")}
        aria-expanded={open}
        className={`inline-flex items-center gap-1.5 rounded-[12px] border px-3 py-2 text-sm font-semibold ${
          tone === "dark"
            ? "border-navy-700 text-[#f4f1ea] hover:bg-navy-800"
            : "border-slate-200 bg-surface text-slate-700 hover:border-violet-500"
        }`}
      >
        <Menu size={18} /> {tr("Мәзір")}
      </button>
      {open &&
        // Жабысқақ тақырыптағы backdrop-blur fixed-ті қиып тастамас үшін body-ге шығарамыз.
        createPortal(
          <div
            className="fixed inset-0 z-[60] flex flex-col bg-navy-900/50 backdrop-blur-sm"
            role="dialog"
            aria-modal="true"
            aria-label={tr("Мәзір")}
            onClick={() => setOpen(false)}
          >
            <div
              className="max-h-[92dvh] overflow-y-auto rounded-b-[26px] bg-slate-50 px-4 pt-4 pb-6 shadow-2xl"
              onClick={(e) => e.stopPropagation()}
            >
              <div className="mb-3 flex items-center justify-between">
                <span className="text-lg font-bold">AI Nur</span>
                <button
                  type="button"
                  onClick={() => setOpen(false)}
                  aria-label={tr("Жабу")}
                  className="rounded-full p-2 text-slate-500 hover:bg-slate-100"
                >
                  <X size={20} />
                </button>
              </div>
              <div className="grid grid-cols-2 gap-2">
                <Link to="/" className={tile(pathname === "/")}>
                  <Home size={18} className="text-violet-600" />{" "}
                  {tr("Басты бет")}
                </Link>
                <Link to="/projects" className={tile(is("/projects"))}>
                  <FolderOpen size={18} className="text-violet-600" />{" "}
                  {tr("Жобалар")}
                </Link>
              </div>
              {TOOL_GROUPS.map((g) => (
                <div key={g.id} className="mt-4">
                  <div className="mb-2 px-1 text-[12px] font-semibold tracking-wide text-slate-500 uppercase">
                    {g.label}
                  </div>
                  <div className="grid grid-cols-2 gap-2">
                    {toolsIn(g.id).map((t) => (
                      <Link key={t.to} to={t.to} className={tile(is(t.to))}>
                        <t.icon
                          size={18}
                          className="shrink-0 text-violet-600"
                        />{" "}
                        <span className="min-w-0 truncate">{t.label}</span>
                      </Link>
                    ))}
                  </div>
                </div>
              ))}
              <div className="mt-4 grid grid-cols-2 gap-2">
                <Link to="/profile" className={tile(is("/profile"))}>
                  <UserRound size={18} className="text-violet-600" />{" "}
                  {tr("Жеке бет")}
                </Link>
                {user?.role === "admin" && (
                  <Link to="/admin" className={tile(is("/admin"))}>
                    <ShieldCheck size={18} className="text-violet-600" />{" "}
                    {tr("Әкімші панелі")}
                  </Link>
                )}
              </div>
            </div>
          </div>,
          document.body,
        )}
    </>
  );
}
