import { FolderOpen, Home, LogOut, ShieldCheck, UserRound } from "lucide-react";
import { Suspense } from "react";
import { NavLink, Outlet, useNavigate } from "react-router-dom";
import { useAuth } from "../context/useAuth";
import { toolsIn, TOOL_GROUPS } from "../lib/navigation";
import { Avatar } from "./Avatar";
import { Logo } from "./Logo";
import { PageLoader } from "./PageLoader";
import { useCurrentTool } from "../lib/useCurrentTool";
import { DesktopToolNav, MobileMenu } from "./NavMenus";
import { UserMenu } from "./UserMenu";
import { tr } from "../i18n";

/* AI Nur құрылымы: басты бетте — қою көк бүйір мәзір, құрал беттерінде — жоғарғы мәзір. */

const sideLink = ({ isActive }: { isActive: boolean }) =>
  `flex shrink-0 items-center gap-3 rounded-xl px-3.5 py-2 text-[14.5px] whitespace-nowrap transition-colors ${
    isActive
      ? "bg-navy-800 text-white shadow-[inset_3px_0_0_0_var(--color-violet-500)]"
      : "text-[#c7c4da] hover:bg-navy-800 hover:text-white"
  }`;

export function DashboardLayout() {
  const { user, logout } = useAuth();
  const navigate = useNavigate();

  async function handleLogout() {
    await logout();
    navigate("/login", { replace: true });
  }

  return (
    <div className="flex min-h-screen flex-col lg:flex-row">
      <nav
        aria-label={tr("Негізгі мәзір")}
        className="flex items-center gap-3 bg-navy-900 px-4 py-3 text-[#f4f1ea] lg:sticky lg:top-0 lg:h-screen lg:w-[264px] lg:shrink-0 lg:flex-col lg:items-stretch lg:gap-0 lg:overflow-y-auto lg:px-5 lg:py-7"
      >
        <NavLink to="/" className="flex shrink-0 items-center gap-3 lg:mb-6 lg:px-1.5">
          <span className="flex h-10 w-10 items-center justify-center logo-keep rounded-xl bg-[#f4f1ea] p-1 lg:h-[42px] lg:w-[42px]">
            <Logo className="h-full w-full" />
          </span>
          <span className="text-[19px] font-bold">AI Nur</span>
        </NavLink>

        {/* Телефонда: бір «Мәзір» батырмасы */}
        <div className="ml-auto lg:hidden">
          <MobileMenu tone="dark" />
        </div>

        <div className="hidden flex-col gap-0.5 lg:flex">
          <NavLink to="/" end className={sideLink}>
            <Home size={19} strokeWidth={1.8} /> {tr("Басты бет")}
          </NavLink>
          {TOOL_GROUPS.map((g) => (
            <div key={g.id} className="flex flex-col gap-0.5">
              <div className="mt-3 mb-0.5 px-3.5 text-[11px] font-semibold tracking-[0.08em] text-[#8f8ba8] uppercase">{g.label}</div>
              {toolsIn(g.id).map((t) => (
                <NavLink key={t.to} to={t.to} className={sideLink}>
                  <t.icon size={19} strokeWidth={1.8} /> {t.label}
                </NavLink>
              ))}
            </div>
          ))}
          <div className="mx-1.5 my-3 h-px bg-navy-700" />
          <NavLink to="/projects" className={sideLink}>
            <FolderOpen size={19} strokeWidth={1.8} /> {tr("Менің жобаларым")}
          </NavLink>
          <NavLink to="/profile" className={sideLink}>
            <UserRound size={19} strokeWidth={1.8} /> {tr("Жеке бет")}
          </NavLink>
          {user?.role === "admin" && (
            <NavLink to="/admin" className={sideLink}>
              <ShieldCheck size={19} strokeWidth={1.8} /> {tr("Әкімші панелі")}
            </NavLink>
          )}
        </div>

        <div className="hidden flex-1 lg:block" />

        {user && (
          <div className="hidden flex-col gap-1.5 lg:flex">
            <NavLink to="/profile" className="flex items-center gap-3 rounded-2xl bg-navy-800 px-2.5 py-3.5 hover:bg-navy-700">
              <Avatar user={user} className="h-[38px] w-[38px] rounded-[11px] text-sm" tone="bg-violet-500 text-white" />
              <div className="min-w-0">
                <p className="truncate text-sm font-semibold text-white">{user.name}</p>
                <p className="truncate text-xs text-[#b4b0c8]">
                  {user.role === "admin" ? tr("Әкімші") : user.subject ? tr("{subject} мұғалімі", { subject: tr(user.subject) }) : tr("Мұғалім")}
                </p>
              </div>
            </NavLink>
            <button
              type="button"
              onClick={handleLogout}
              className="flex items-center gap-3 rounded-xl px-3.5 py-2 text-left text-sm text-[#c7c4da] hover:bg-navy-800 hover:text-white"
            >
              <LogOut size={17} /> {tr("Шығу")}
            </button>
          </div>
        )}
      </nav>

      <main className="min-w-0 flex-1">
        <Suspense fallback={<PageLoader />}>
          <Outlet />
        </Suspense>
      </main>
    </div>
  );
}

const topLink = ({ isActive }: { isActive: boolean }) =>
  `rounded-[11px] px-1 py-2 text-center text-[12px] font-semibold whitespace-nowrap transition-colors sm:px-4 sm:text-[13.5px] ${
    isActive ? "bg-navy-900 text-white dark:bg-violet-600" : "text-slate-500 hover:bg-violet-100 hover:text-violet-700"
  }`;

function Topbar({ admin = false }: { admin?: boolean }) {
  const current = useCurrentTool();
  if (!admin) {
    return (
      <header className="sticky top-0 z-30 flex items-center justify-between gap-3 border-b border-slate-200 bg-slate-50/90 px-4 py-3 backdrop-blur-md sm:px-10 sm:py-4 print:hidden">
        <NavLink to="/" className="flex min-w-0 items-center gap-3 font-bold">
          <Logo className="h-9 w-9" />
          <span className="text-[16.5px]">AI Nur</span>
          {current && <span className="truncate rounded-full bg-violet-100 px-2.5 py-1 text-[12.5px] font-semibold text-violet-700 md:hidden">{current.short}</span>}
        </NavLink>
        <DesktopToolNav />
        <div className="flex items-center gap-2">
          <div className="md:hidden">
            <MobileMenu />
          </div>
          <UserMenu />
        </div>
      </header>
    );
  }
  return (
    <header className="sticky top-0 z-30 flex flex-wrap items-center justify-between gap-3 border-b border-slate-200 bg-slate-50/90 px-4 py-3 backdrop-blur-md sm:px-10 sm:py-4 print:hidden">
      <NavLink to={admin ? "/admin" : "/"} className="flex items-center gap-3 font-bold">
        <Logo className="h-9 w-9" />
        <span className="text-[16.5px]">
          AI Nur{admin && <span className="text-[13.5px] font-semibold text-slate-500"> · {tr("Әкімші")}</span>}
        </span>
      </NavLink>
      <nav
        aria-label={tr("Әкімші мәзірі")}
        className={"order-3 grid w-full grid-cols-2 gap-1 rounded-[14px] border border-slate-200 bg-surface p-1 sm:flex sm:overflow-x-auto md:order-none md:w-auto"}
      >
        <NavLink to="/admin" className={topLink}>{tr("Аккаунттар")}</NavLink>
        <NavLink to="/" end className={topLink}>{tr("Қосымшаны қарау")}</NavLink>
      </nav>
      <UserMenu />
    </header>
  );
}

export function ToolLayout() {
  return (
    <div className="min-h-screen">
      <Topbar />
      <main>
        <Suspense fallback={<PageLoader />}>
          <Outlet />
        </Suspense>
      </main>
    </div>
  );
}

export function AdminLayout() {
  return (
    <div className="min-h-screen">
      <Topbar admin />
      <main>
        <Suspense fallback={<PageLoader />}>
          <Outlet />
        </Suspense>
      </main>
    </div>
  );
}
