import { FolderOpen, Home, LogOut, ShieldCheck, UserRound } from "lucide-react";
import { NavLink, Outlet, useNavigate } from "react-router-dom";
import { useAuth } from "../context/useAuth";
import { tools } from "../lib/navigation";
import { Avatar } from "./Avatar";
import { Logo } from "./Logo";
import { UserMenu } from "./UserMenu";

/* AI Nur құрылымы: басты бетте — қою көк бүйір мәзір, құрал беттерінде — жоғарғы мәзір. */

const sideLink = ({ isActive }: { isActive: boolean }) =>
  `flex shrink-0 items-center gap-3 rounded-xl px-3.5 py-2.5 text-[15px] whitespace-nowrap transition-colors ${
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
        aria-label="Негізгі мәзір"
        className="flex items-center gap-3 overflow-x-auto bg-navy-900 px-4 py-3 text-[#f4f1ea] lg:sticky lg:top-0 lg:h-screen lg:w-[264px] lg:shrink-0 lg:flex-col lg:items-stretch lg:gap-0 lg:overflow-visible lg:px-5 lg:py-8"
      >
        <NavLink to="/" className="flex shrink-0 items-center gap-3 lg:mb-11 lg:px-1.5">
          <span className="flex h-10 w-10 items-center justify-center rounded-xl bg-[#f4f1ea] p-1 lg:h-[42px] lg:w-[42px]">
            <Logo className="h-full w-full" />
          </span>
          <span className="hidden text-[19px] font-bold lg:inline">AI Nur</span>
        </NavLink>

        <div className="flex gap-1 lg:flex-col">
          <NavLink to="/" end className={sideLink}>
            <Home size={19} strokeWidth={1.8} /> Басты бет
          </NavLink>
          {tools.map((t) => (
            <NavLink key={t.to} to={t.to} className={sideLink}>
              <t.icon size={19} strokeWidth={1.8} /> {t.label}
            </NavLink>
          ))}
          <div className="mx-1.5 my-3.5 hidden h-px bg-navy-700 lg:block" />
          <NavLink to="/projects" className={sideLink}>
            <FolderOpen size={19} strokeWidth={1.8} /> Менің жобаларым
          </NavLink>
          <NavLink to="/profile" className={sideLink}>
            <UserRound size={19} strokeWidth={1.8} /> Жеке бет
          </NavLink>
          {user?.role === "admin" && (
            <NavLink to="/admin" className={sideLink}>
              <ShieldCheck size={19} strokeWidth={1.8} /> Әкімші панелі
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
                  {user.role === "admin" ? "Әкімші" : user.subject ? `${user.subject} мұғалімі` : "Мұғалім"}
                </p>
              </div>
            </NavLink>
            <button
              type="button"
              onClick={handleLogout}
              className="flex items-center gap-3 rounded-xl px-3.5 py-2 text-left text-sm text-[#c7c4da] hover:bg-navy-800 hover:text-white"
            >
              <LogOut size={17} /> Шығу
            </button>
          </div>
        )}
      </nav>

      <main className="min-w-0 flex-1">
        <Outlet />
      </main>
    </div>
  );
}

const topLink = ({ isActive }: { isActive: boolean }) =>
  `rounded-[11px] px-1 py-2 text-center text-[12px] font-semibold whitespace-nowrap transition-colors sm:px-4 sm:text-[13.5px] ${
    isActive ? "bg-navy-900 text-white" : "text-slate-500 hover:bg-violet-100 hover:text-violet-700"
  }`;

function Topbar({ admin = false }: { admin?: boolean }) {
  return (
    <header className="sticky top-0 z-30 flex flex-wrap items-center justify-between gap-3 border-b border-slate-200 bg-slate-50/90 px-4 py-3 backdrop-blur-md sm:px-10 sm:py-4 print:hidden">
      <NavLink to={admin ? "/admin" : "/"} className="flex items-center gap-3 font-bold">
        <Logo className="h-9 w-9" />
        <span className="text-[16.5px]">
          AI Nur{admin && <span className="text-[13.5px] font-semibold text-slate-500"> · Әкімші</span>}
        </span>
      </NavLink>
      <nav
        aria-label={admin ? "Әкімші мәзірі" : "Құралдар"}
        className={`order-3 grid w-full gap-1 rounded-[14px] border border-slate-200 bg-white p-1 sm:flex sm:overflow-x-auto md:order-none md:w-auto ${admin ? "grid-cols-2" : "grid-cols-4"}`}
      >
        {admin ? (
          <>
            <NavLink to="/admin" className={topLink}>Аккаунттар</NavLink>
            <NavLink to="/" end className={topLink}>Қосымшаны қарау</NavLink>
          </>
        ) : (
          <>
            <NavLink to="/" end className={topLink}>Басты бет</NavLink>
            {tools.map((t) => (
              <NavLink key={t.to} to={t.to} className={topLink}>
                {t.short}
              </NavLink>
            ))}
            <NavLink to="/projects" className={topLink}>Жобалар</NavLink>
          </>
        )}
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
        <Outlet />
      </main>
    </div>
  );
}

export function AdminLayout() {
  return (
    <div className="min-h-screen">
      <Topbar admin />
      <main>
        <Outlet />
      </main>
    </div>
  );
}
