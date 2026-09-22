import { Home, LogOut, Menu, ShieldCheck, X } from "lucide-react";
import { useState } from "react";
import { NavLink, Outlet, useNavigate } from "react-router-dom";
import { useAuth } from "../context/useAuth";
import { initialsOf } from "../lib/names";
import { navGroups } from "../lib/navigation";
import { Logo } from "./Logo";

const navLinkClasses = ({ isActive }: { isActive: boolean }) =>
  `flex items-center gap-3 rounded-xl px-3.5 py-2.5 text-[15px] transition-colors ${
    isActive
      ? "bg-navy-800 text-white shadow-[inset_3px_0_0_0_var(--color-violet-500)]"
      : "text-[#c7c4da] hover:bg-navy-800 hover:text-white"
  }`;

function SidebarContent({ onNavigate }: { onNavigate?: () => void }) {
  const { user, logout } = useAuth();
  const navigate = useNavigate();

  async function handleLogout() {
    await logout();
    onNavigate?.();
    navigate("/login", { replace: true });
  }

  return (
    <div className="flex h-full flex-col gap-6 overflow-y-auto px-5 py-8">
      <NavLink to="/" onClick={onNavigate} className="flex items-center gap-3 px-1.5">
        <span className="flex h-11 w-11 items-center justify-center rounded-xl bg-[#f4f1ea] p-1">
          <Logo className="h-9 w-9" />
        </span>
        <span className="text-[19px] font-bold text-white">Sabaq AI</span>
      </NavLink>

      <nav aria-label="Негізгі мәзір" className="flex flex-col gap-5">
        <NavLink to="/" end onClick={onNavigate} className={navLinkClasses}>
          <Home size={19} strokeWidth={1.8} />
          Басты бет
        </NavLink>

        {navGroups.map((group) => (
          <div key={group.title}>
            <p className="mb-1.5 px-3.5 text-[11.5px] font-semibold tracking-wider text-[#8f8ba8] uppercase">
              {group.title}
            </p>
            <div className="flex flex-col gap-0.5">
              {group.items.map((item) => (
                <NavLink key={item.to} to={item.to} onClick={onNavigate} className={navLinkClasses}>
                  <item.icon size={19} strokeWidth={1.8} />
                  {item.label}
                </NavLink>
              ))}
            </div>
          </div>
        ))}

        {user?.role === "admin" && (
          <div>
            <p className="mb-1.5 px-3.5 text-[11.5px] font-semibold tracking-wider text-[#8f8ba8] uppercase">
              Әкімшілік
            </p>
            <NavLink to="/admin" onClick={onNavigate} className={navLinkClasses}>
              <ShieldCheck size={19} strokeWidth={1.8} />
              Әкімші панелі
            </NavLink>
          </div>
        )}
      </nav>

      <div className="mt-auto flex flex-col gap-2">
        {user && (
          <div className="flex items-center gap-3 rounded-2xl bg-navy-800 px-2.5 py-3.5">
            <span className="flex h-[38px] w-[38px] shrink-0 items-center justify-center rounded-[11px] bg-violet-500 text-sm font-bold text-white">
              {initialsOf(user.name)}
            </span>
            <div className="min-w-0">
              <p className="truncate text-sm font-semibold text-white">{user.name}</p>
              <p className="truncate text-xs text-[#b4b0c8]">
                {user.role === "admin" ? "Әкімші" : user.subject ? `${user.subject} мұғалімі` : "Мұғалім"}
              </p>
            </div>
          </div>
        )}
        <button
          type="button"
          onClick={handleLogout}
          className="flex w-full items-center gap-3 rounded-xl px-3.5 py-2.5 text-left text-sm text-[#c7c4da] transition-colors hover:bg-navy-800 hover:text-white"
        >
          <LogOut size={17} /> Шығу
        </button>
      </div>
    </div>
  );
}

export default function Layout() {
  const [mobileOpen, setMobileOpen] = useState(false);

  return (
    <div className="flex min-h-screen">
      <aside className="hidden w-[272px] shrink-0 bg-navy-900 lg:block print:hidden">
        <div className="sticky top-0 h-screen">
          <SidebarContent />
        </div>
      </aside>

      {mobileOpen && (
        <div className="fixed inset-0 z-40 lg:hidden print:hidden">
          <div className="absolute inset-0 bg-navy-900/50" onClick={() => setMobileOpen(false)} />
          <div className="absolute inset-y-0 left-0 w-[280px] max-w-[85vw] bg-navy-900 shadow-2xl">
            <button
              onClick={() => setMobileOpen(false)}
              className="absolute top-4 right-3 rounded-lg p-1.5 text-[#c7c4da] hover:bg-navy-800 hover:text-white"
              aria-label="Мәзірді жабу"
            >
              <X size={18} />
            </button>
            <SidebarContent onNavigate={() => setMobileOpen(false)} />
          </div>
        </div>
      )}

      <div className="flex min-h-screen min-w-0 flex-1 flex-col">
        <header className="sticky top-0 z-30 flex items-center gap-3 bg-navy-900 px-4 py-3 lg:hidden print:hidden">
          <button
            onClick={() => setMobileOpen(true)}
            className="rounded-lg border border-navy-700 p-2 text-white"
            aria-label="Мәзірді ашу"
          >
            <Menu size={18} />
          </button>
          <span className="flex h-8 w-8 items-center justify-center rounded-lg bg-[#f4f1ea] p-0.5">
            <Logo className="h-7 w-7" />
          </span>
          <span className="font-bold text-white">Sabaq AI</span>
        </header>

        <main className="flex-1">
          <Outlet />
        </main>

        <footer className="border-t border-slate-200 py-6 text-center text-sm text-slate-500 print:hidden">
          Sabaq AI — мұғалімге арналған AI студия
        </footer>
      </div>
    </div>
  );
}
