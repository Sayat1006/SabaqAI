import { useEffect, useMemo, useState } from "react";
import { Badge, Button, Card, Field, Select, TextInput } from "../components/ui";
import { useAuth } from "../context/useAuth";
import * as auth from "../lib/auth";
import type { AccountStatus, AuditEntry, Role, UserAccount } from "../lib/auth";
import { tr } from "../i18n";

function genPasswordSuggestion(): string {
  const chars = "ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnpqrstuvwxyz23456789";
  let out = "";
  for (let i = 0; i < 10; i++) out += chars[Math.floor(Math.random() * chars.length)];
  return out;
}

// Intl-дің "kk-KZ" локалі кейбір браузерлерде толық қолдау таппай, күн
// форматын АҚШ-тың MM/DD/YYYY ретімен қайтаруы мүмкін, сондықтан
// ДД.АА.ЖЖЖЖ форматын қолмен құрастырамыз.
function formatDate(ts: string | null): string {
  if (!ts) return "—";
  const d = new Date(ts);
  const dd = String(d.getDate()).padStart(2, "0");
  const mm = String(d.getMonth() + 1).padStart(2, "0");
  const hh = String(d.getHours()).padStart(2, "0");
  const min = String(d.getMinutes()).padStart(2, "0");
  return `${dd}.${mm}.${d.getFullYear()} ${hh}:${min}`;
}

export default function AdminPage() {
  const { user: currentUser, refresh } = useAuth();
  const [users, setUsers] = useState<UserAccount[]>([]);
  const [audit, setAudit] = useState<AuditEntry[]>([]);
  const [loadingList, setLoadingList] = useState(true);

  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState(genPasswordSuggestion());
  const [role, setRole] = useState<Role>("teacher");
  const [subject, setSubject] = useState("");
  const [school, setSchool] = useState("");
  const [createError, setCreateError] = useState("");
  const [creating, setCreating] = useState(false);
  const [busyId, setBusyId] = useState<string | null>(null);

  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState<"Барлығы" | AccountStatus>("Барлығы");
  const [revealedPassword, setRevealedPassword] = useState<{ id: string; value: string } | null>(null);
  const [exporting, setExporting] = useState(false);

  async function refreshAll() {
    const [nextUsers, nextAudit] = await Promise.all([auth.getUsers(), auth.getAudit()]);
    setUsers(nextUsers);
    setAudit(nextAudit);
    await refresh();
  }

  useEffect(() => {
    // eslint-disable-next-line react/set-state-in-effect -- бастапқы жүктеу, бір рет
    refreshAll().finally(() => setLoadingList(false));
    // eslint-disable-next-line react-hooks/exhaustive-deps -- тек бастапқы жүктеу, refreshAll әр рендерде жаңарады
  }, []);

  async function handleCreate(e: React.FormEvent) {
    e.preventDefault();
    setCreateError("");
    if (!name.trim() || !email.trim() || !password.trim()) return;
    setCreating(true);
    const result = await auth.createUser({ name, email, password, role, subject, school });
    setCreating(false);
    if (!result.ok) {
      setCreateError(
        result.reason === "duplicate_email" ? tr("Бұл email-мен аккаунт бұрыннан бар.") : (result.message ?? tr("Құру мүмкін болмады.")),
      );
      return;
    }
    await refreshAll();
    setName("");
    setEmail("");
    setPassword(genPasswordSuggestion());
    setSubject("");
    setSchool("");
    setRole("teacher");
  }

  async function handleToggleStatus(target: UserAccount) {
    setBusyId(target.id);
    await auth.toggleStatus(target);
    await refreshAll();
    setBusyId(null);
  }

  async function handleToggleRole(target: UserAccount) {
    if (target.id === currentUser?.id) return;
    setBusyId(target.id);
    await auth.toggleRole(target);
    await refreshAll();
    setBusyId(null);
  }

  async function handleDelete(target: UserAccount) {
    if (target.id === currentUser?.id) return;
    if (!window.confirm(tr("«{name}» аккаунтын жоюды растайсыз ба? Бұл әрекетті кері қайтару мүмкін емес.", { name: target.name }))) return;
    setBusyId(target.id);
    const result = await auth.deleteUser(target);
    setBusyId(null);
    if (!result.ok) {
      window.alert(result.message ?? tr("Жою мүмкін болмады."));
      return;
    }
    await refreshAll();
  }

  async function handleResetPassword(target: UserAccount) {
    setBusyId(target.id);
    const result = await auth.resetPassword(target);
    setBusyId(null);
    if (!result.ok) {
      window.alert(result.message ?? tr("Құпия сөзді ысыру мүмкін болмады."));
      return;
    }
    setRevealedPassword({ id: target.id, value: result.newPassword });
    await refreshAll();
  }

  async function handleExport() {
    setExporting(true);
    try {
      const { exportUsersToXlsx } = await import("../lib/exportXlsx");
      await exportUsersToXlsx(users);
    } finally {
      setExporting(false);
    }
  }

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    return users.filter((u) => {
      if (statusFilter !== "Барлығы" && u.status !== statusFilter) return false;
      if (!q) return true;
      return (
        u.name.toLowerCase().includes(q) ||
        u.email.toLowerCase().includes(q) ||
        u.subject.toLowerCase().includes(q) ||
        u.school.toLowerCase().includes(q)
      );
    });
  }, [users, search, statusFilter]);

  const stats = useMemo(
    () => ({
      total: users.length,
      active: users.filter((u) => u.status === "active").length,
      disabled: users.filter((u) => u.status === "disabled").length,
      admins: users.filter((u) => u.role === "admin").length,
    }),
    [users],
  );

  return (
    <div className="mx-auto max-w-[1360px] px-4 py-9 sm:px-10">
      <h1 className="text-[28px] font-bold">{tr("Әкімші панелі")}</h1>
      <p className="mt-1.5 mb-8 max-w-[680px] text-[14.5px] text-slate-500">
        {tr("Мұғалімдерге аккаунт ашыңыз, қатынасты бақылаңыз — олар «Мұғалім» ретінде осы деректермен қосымшаға кіре алады. Аккаунтты кез келген уақытта өшіруге/қосуға немесе жоюға болады.")}
      </p>

      <div className="mb-6 grid gap-4 sm:grid-cols-4">
        <Card className="text-center">
          <p className="text-3xl font-bold text-violet-600">{stats.total}</p>
          <p className="text-sm text-slate-500">{tr("Барлық аккаунт")}</p>
        </Card>
        <Card className="text-center">
          <p className="text-3xl font-bold text-emerald-600">{stats.active}</p>
          <p className="text-sm text-slate-500">{tr("Белсенді")}</p>
        </Card>
        <Card className="text-center">
          <p className="text-3xl font-bold text-rose-600">{stats.disabled}</p>
          <p className="text-sm text-slate-500">{tr("Өшірілген")}</p>
        </Card>
        <Card className="text-center">
          <p className="text-3xl font-bold text-fuchsia-600">{stats.admins}</p>
          <p className="text-sm text-slate-500">{tr("Әкімшілер")}</p>
        </Card>
      </div>

      <Card className="mb-6">
        <h3 className="mb-3 font-semibold text-slate-900">{tr("Жаңа аккаунт құру")}</h3>
        <form onSubmit={handleCreate} className="grid gap-1 sm:grid-cols-3 sm:gap-x-6">
          <Field>
            {tr("Аты-жөні")}
            <TextInput placeholder={tr("мысалы: Айгүл Serikovna")} value={name} onChange={(e) => setName(e.target.value)} required />
          </Field>
          <Field>
            Email
            <TextInput type="email" placeholder="mysal@mektep.kz" value={email} onChange={(e) => setEmail(e.target.value)} required />
          </Field>
          <Field>
            {tr("Уақытша құпия сөз")}
            <div className="flex gap-2">
              <TextInput value={password} onChange={(e) => setPassword(e.target.value)} required />
              <Button type="button" variant="ghost" className="!px-3" onClick={() => setPassword(genPasswordSuggestion())}>
                🎲
              </Button>
            </div>
          </Field>
          <Field>
            {tr("Рөлі")}
            <Select value={role} onChange={(e) => setRole(e.target.value as Role)}>
              <option value="teacher">{tr("Мұғалім")}</option>
              <option value="admin">{tr("Әкімші")}</option>
            </Select>
          </Field>
          <Field>
            {tr("Пән (міндетті емес)")}
            <TextInput placeholder={tr("мысалы: Математика")} value={subject} onChange={(e) => setSubject(e.target.value)} />
          </Field>
          <Field>
            {tr("Мектеп (міндетті емес)")}
            <TextInput placeholder={tr("мысалы: №25 мектеп-гимназия")} value={school} onChange={(e) => setSchool(e.target.value)} />
          </Field>
          {createError && <p className="text-sm text-rose-600 sm:col-span-3">{createError}</p>}
          <div className="pb-4 sm:col-span-3">
            <Button type="submit" disabled={creating}>
              {creating ? tr("Құрылуда...") : tr("Аккаунт құру")}
            </Button>
          </div>
        </form>
      </Card>

      <Card className="mb-6">
        <div className="mb-3 flex flex-wrap items-center justify-between gap-3">
          <h3 className="font-semibold text-slate-900">{tr("Аккаунттар ({n})", { n: filtered.length })}</h3>
          <Button variant="ghost" type="button" onClick={handleExport} disabled={exporting}>
            {exporting ? tr("Дайындалуда...") : tr("📊 Excel-ге экспорттау")}
          </Button>
        </div>
        <div className="mb-4 grid gap-3 sm:grid-cols-3">
          <TextInput placeholder={tr("Аты, email, пән бойынша іздеу")} value={search} onChange={(e) => setSearch(e.target.value)} className="sm:col-span-2" />
          <Select value={statusFilter} onChange={(e) => setStatusFilter(e.target.value as typeof statusFilter)}>
            <option value="Барлығы">{tr("Барлығы")}</option>
            <option value="active">{tr("Белсенді")}</option>
            <option value="disabled">{tr("Өшірілген")}</option>
          </Select>
        </div>

        <div className="overflow-x-auto rounded-lg border border-violet-100">
          <table className="w-full text-sm">
            <thead className="bg-violet-50 text-slate-600">
              <tr>
                <th className="px-3 py-2 text-left font-medium">{tr("Аты-жөні / Email")}</th>
                <th className="px-3 py-2 text-left font-medium">{tr("Рөлі")}</th>
                <th className="px-3 py-2 text-left font-medium">{tr("Пән / Мектеп")}</th>
                <th className="px-3 py-2 text-left font-medium">{tr("Мәртебесі")}</th>
                <th className="px-3 py-2 text-left font-medium">{tr("Соңғы кіру")}</th>
                <th className="px-3 py-2 text-left font-medium">{tr("Әрекеттер")}</th>
              </tr>
            </thead>
            <tbody>
              {filtered.map((u) => (
                <tr key={u.id} className="border-t border-violet-50 align-top">
                  <td className="px-3 py-2">
                    <p className="font-medium text-slate-900">
                      {u.name} {u.id === currentUser?.id && <span className="text-xs text-violet-500">{tr("(сіз)")}</span>}
                    </p>
                    <p className="text-xs text-slate-500">{u.email}</p>
                  </td>
                  <td className="px-3 py-2">
                    <Badge>{u.role === "admin" ? tr("Әкімші") : tr("Мұғалім")}</Badge>
                  </td>
                  <td className="px-3 py-2 text-slate-600">
                    {u.subject || "—"} {u.school && <span className="text-xs text-slate-400">· {u.school}</span>}
                  </td>
                  <td className="px-3 py-2">
                    <span
                      className={`rounded-full px-2.5 py-0.5 text-xs font-medium ${
                        u.status === "active"
                          ? "bg-emerald-100 text-emerald-700"
                          : "bg-rose-100 text-rose-700"
                      }`}
                    >
                      {u.status === "active" ? tr("Белсенді") : tr("Өшірілген")}
                    </span>
                  </td>
                  <td className="px-3 py-2 text-xs text-slate-500">{formatDate(u.lastLoginAt)}</td>
                  <td className="px-3 py-2">
                    <div className="flex flex-wrap gap-1.5">
                      <button
                        type="button"
                        onClick={() => handleToggleStatus(u)}
                        disabled={u.id === currentUser?.id || busyId === u.id}
                        className="rounded-md border border-violet-200 px-2 py-1 text-xs text-violet-700 hover:bg-violet-50 disabled:opacity-40"
                      >
                        {u.status === "active" ? tr("Өшіру") : tr("Қосу")}
                      </button>
                      <button
                        type="button"
                        onClick={() => handleToggleRole(u)}
                        disabled={u.id === currentUser?.id || busyId === u.id}
                        className="rounded-md border border-violet-200 px-2 py-1 text-xs text-violet-700 hover:bg-violet-50 disabled:opacity-40"
                      >
                        {u.role === "admin" ? tr("Мұғалім ету") : tr("Әкімші ету")}
                      </button>
                      <button
                        type="button"
                        onClick={() => handleResetPassword(u)}
                        disabled={busyId === u.id}
                        className="rounded-md border border-violet-200 px-2 py-1 text-xs text-violet-700 hover:bg-violet-50 disabled:opacity-40"
                      >
                        {tr("Құпия сөзді ысырту")}
                      </button>
                      <button
                        type="button"
                        onClick={() => handleDelete(u)}
                        disabled={u.id === currentUser?.id || busyId === u.id}
                        className="rounded-md border border-rose-200 px-2 py-1 text-xs text-rose-600 hover:bg-rose-50 disabled:opacity-40"
                      >
                        {tr("Жою")}
                      </button>
                    </div>
                    {revealedPassword?.id === u.id && (
                      <p className="mt-1.5 rounded-md bg-amber-50 px-2 py-1 text-xs text-amber-800">
                        {tr("Жаңа құпия сөз:")} <code className="font-mono">{revealedPassword.value}</code>{" "}
                        <button type="button" className="ml-1 underline" onClick={() => setRevealedPassword(null)}>
                          {tr("жасыру")}
                        </button>
                      </p>
                    )}
                  </td>
                </tr>
              ))}
              {loadingList && (
                <tr>
                  <td colSpan={6} className="px-3 py-6 text-center text-slate-500">
                    {tr("Жүктелуде...")}
                  </td>
                </tr>
              )}
              {!loadingList && filtered.length === 0 && (
                <tr>
                  <td colSpan={6} className="px-3 py-6 text-center text-slate-500">
                    {tr("Ешнәрсе табылмады.")}
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </Card>

      <Card>
        <h3 className="mb-3 font-semibold text-slate-900">{tr("Әрекеттер журналы")}</h3>
        <div className="max-h-72 overflow-y-auto rounded-lg border border-violet-100">
          <table className="w-full text-sm">
            <thead className="sticky top-0 bg-violet-50 text-slate-600">
              <tr>
                <th className="px-3 py-2 text-left font-medium">{tr("Уақыты")}</th>
                <th className="px-3 py-2 text-left font-medium">{tr("Кім")}</th>
                <th className="px-3 py-2 text-left font-medium">{tr("Әрекет")}</th>
                <th className="px-3 py-2 text-left font-medium">{tr("Мәлімет")}</th>
              </tr>
            </thead>
            <tbody>
              {audit.map((entry) => (
                <tr key={entry.id} className="border-t border-violet-50">
                  <td className="px-3 py-2 text-xs text-slate-500">{formatDate(entry.ts)}</td>
                  <td className="px-3 py-2 text-slate-700">{entry.actorEmail}</td>
                  <td className="px-3 py-2 text-slate-900">{tr(entry.action)}</td>
                  <td className="px-3 py-2 text-slate-600">{entry.detail}</td>
                </tr>
              ))}
              {audit.length === 0 && (
                <tr>
                  <td colSpan={4} className="px-3 py-6 text-center text-slate-500">
                    {tr("Әзірге жазба жоқ.")}
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </Card>
    </div>
  );
}
