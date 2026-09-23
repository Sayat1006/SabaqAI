import { FolderOpen, LogOut, ShieldCheck, UserRound } from "lucide-react";
import { useEffect, useRef, useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { useAuth } from "../context/useAuth";
import { Avatar } from "./Avatar";

export function UserMenu() {
  const { user, logout } = useAuth();
  const navigate = useNavigate();
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return;
    const onClick = (e: MouseEvent) => !ref.current?.contains(e.target as Node) && setOpen(false);
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && setOpen(false);
    document.addEventListener("click", onClick);
    document.addEventListener("keydown", onKey);
    return () => {
      document.removeEventListener("click", onClick);
      document.removeEventListener("keydown", onKey);
    };
  }, [open]);

  if (!user) return null;

  async function handleLogout() {
    await logout();
    navigate("/login", { replace: true });
  }

  const item = "flex w-full items-center gap-2.5 rounded-[10px] px-3 py-2.5 text-left text-sm hover:bg-slate-50";

  return (
    <div ref={ref} className="relative">
      <button
        type="button"
        aria-haspopup="true"
        aria-expanded={open}
        aria-label="Профиль мәзірі"
        onClick={() => setOpen((v) => !v)}
        className="rounded-xl"
      >
        <Avatar user={user} />
      </button>
      {open && (
        <div className="absolute top-[calc(100%+8px)] right-0 z-50 min-w-[230px] rounded-[14px] border border-slate-200 bg-surface p-1.5 shadow-[0_18px_36px_-18px_rgba(27,26,46,.25)]">
          <div className="mb-1 flex items-center gap-3 border-b border-slate-200 px-3 py-2.5">
            <Avatar user={user} className="h-9 w-9 rounded-lg text-xs" />
            <div className="min-w-0">
              <div className="truncate font-bold">{user.name}</div>
              <div className="truncate text-[12.5px] text-slate-500">{user.email}</div>
            </div>
          </div>
          <Link to="/profile" className={item} onClick={() => setOpen(false)}>
            <UserRound size={16} /> Жеке бет
          </Link>
          <Link to="/projects" className={item} onClick={() => setOpen(false)}>
            <FolderOpen size={16} /> Менің жобаларым
          </Link>
          {user.role === "admin" && (
            <Link to="/admin" className={item} onClick={() => setOpen(false)}>
              <ShieldCheck size={16} /> Әкімші панелі
            </Link>
          )}
          <button type="button" className={item} onClick={handleLogout}>
            <LogOut size={16} /> Шығу
          </button>
        </div>
      )}
    </div>
  );
}
