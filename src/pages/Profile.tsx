import { Camera, Check, KeyRound, Save, Trash2 } from "lucide-react";
import { useRef, useState } from "react";
import { Avatar } from "../components/Avatar";
import { PageHeader } from "../components/PageHeader";
import { useAuth } from "../context/useAuth";
import { changeMyPassword, updateMyProfile, type ProfileInput, type UserAccount } from "../lib/auth";
import { CATEGORIES, GRADES } from "../lib/catalog";
import { allowedSubjects } from "../lib/subjects";
import { TelegramCard } from "../components/TelegramCard";
import { InstallApp } from "../components/InstallApp";
import { tr } from "../i18n";

const fieldClass = "w-full rounded-xl border border-slate-200 bg-slate-50 px-3.5 py-3 text-sm outline-none focus:border-violet-500";
const cardClass = "rounded-[22px] border border-slate-200 bg-surface p-6 sm:p-7";

function Field({ label, hint, children }: { label: string; hint?: string; children: React.ReactNode }) {
  return (
    <label className="block">
      <span className="mb-2 block text-[13px] font-semibold text-slate-500">{label}</span>
      {children}
      {hint && <span className="mt-1.5 block text-xs text-slate-500">{hint}</span>}
    </label>
  );
}

function toInput(u: UserAccount): ProfileInput {
  return {
    name: u.name,
    subject: u.subject,
    school: u.school,
    grades: u.grades,
    category: u.category,
    experienceYears: u.experienceYears,
    phone: u.phone,
    bio: u.bio,
    avatarUrl: u.avatarUrl,
  };
}

/** Суретті ортасынан шаршы етіп қиып, 256×256 JPEG-ке кішірейтеді (~20–40 КБ). */
async function resizeAvatar(file: File): Promise<string> {
  const url = URL.createObjectURL(file);
  try {
    const img = new Image();
    img.src = url;
    await img.decode();
    const side = Math.min(img.naturalWidth, img.naturalHeight);
    const canvas = document.createElement("canvas");
    canvas.width = canvas.height = 256;
    const ctx = canvas.getContext("2d")!;
    // JPEG-те мөлдірлік жоқ: мөлдір PNG қара болып кетпес үшін фонды ақ етеміз.
    ctx.fillStyle = "#ffffff";
    ctx.fillRect(0, 0, 256, 256);
    ctx.drawImage(img, (img.naturalWidth - side) / 2, (img.naturalHeight - side) / 2, side, side, 0, 0, 256, 256);
    return canvas.toDataURL("image/jpeg", 0.85);
  } finally {
    URL.revokeObjectURL(url);
  }
}

function StatusLine({ s }: { s: { ok: boolean; text: string } | null }) {
  if (!s) return null;
  return (
    <p role={s.ok ? "status" : "alert"} className={`rounded-xl px-3.5 py-2.5 text-sm ${s.ok ? "bg-fuchsia-100 text-fuchsia-800" : "bg-rose-50 text-rose-700"}`}>
      {s.ok && <Check size={15} className="mr-1.5 inline" />}
      {s.text}
    </p>
  );
}

const gradeSort = (a: string, b: string) => Number.parseInt(a, 10) - Number.parseInt(b, 10);

export default function ProfilePage() {
  const { user, refresh } = useAuth();
  const subjects = allowedSubjects(user);
  const locked = user?.role !== "admin" && !!user?.subjects?.length;
  const [form, setForm] = useState<ProfileInput | null>(() => (user ? toInput(user) : null));
  const [saving, setSaving] = useState(false);
  const [status, setStatus] = useState<{ ok: boolean; text: string } | null>(null);
  const [avatarBusy, setAvatarBusy] = useState(false);
  const fileRef = useRef<HTMLInputElement>(null);

  const [pw, setPw] = useState({ current: "", next: "", repeat: "" });
  const [pwBusy, setPwBusy] = useState(false);
  const [pwStatus, setPwStatus] = useState<{ ok: boolean; text: string } | null>(null);

  if (!user || !form) return null;

  const set = <K extends keyof ProfileInput>(key: K, value: ProfileInput[K]) => {
    setForm({ ...form, [key]: value });
    setStatus(null);
  };

  function toggleGrade(g: string) {
    const has = form!.grades.includes(g);
    set("grades", has ? form!.grades.filter((x) => x !== g) : [...form!.grades, g].sort(gradeSort));
  }

  async function save(next: ProfileInput, okText: string) {
    await updateMyProfile(next);
    await refresh();
    setStatus({ ok: true, text: okText });
  }

  async function handleSave(e: React.FormEvent) {
    e.preventDefault();
    if (form!.name.trim().length < 2) {
      setStatus({ ok: false, text: tr("Аты-жөніңізді жазыңыз.") });
      return;
    }
    setSaving(true);
    setStatus(null);
    try {
      await save({ ...form!, name: form!.name.trim() }, tr("Мәліметтер сақталды."));
    } catch (err) {
      setStatus({ ok: false, text: err instanceof Error ? err.message : tr("Сақтау мүмкін болмады.") });
    } finally {
      setSaving(false);
    }
  }

  /** Аватар таңдалған бойда сақталады; қалған өрістер соңғы сақталған күйінде жіберіледі. */
  async function handleAvatar(file: File | null) {
    if (!file) return;
    if (!file.type.startsWith("image/")) {
      setStatus({ ok: false, text: tr("Сурет файлын таңдаңыз (JPG, PNG).") });
      return;
    }
    if (file.size > 15 * 1024 * 1024) {
      setStatus({ ok: false, text: tr("Сурет тым үлкен (15 МБ-тан аспауы керек).") });
      return;
    }
    setAvatarBusy(true);
    setStatus(null);
    try {
      const avatarUrl = await resizeAvatar(file);
      await save({ ...toInput(user!), avatarUrl }, tr("Аватар жаңартылды."));
      setForm({ ...form!, avatarUrl });
    } catch (err) {
      setStatus({ ok: false, text: err instanceof Error ? err.message : tr("Суретті жүктеу мүмкін болмады.") });
    } finally {
      setAvatarBusy(false);
      if (fileRef.current) fileRef.current.value = "";
    }
  }

  async function removeAvatar() {
    setAvatarBusy(true);
    try {
      await save({ ...toInput(user!), avatarUrl: "" }, tr("Аватар өшірілді."));
      setForm({ ...form!, avatarUrl: "" });
    } catch (err) {
      setStatus({ ok: false, text: err instanceof Error ? err.message : tr("Өшіру мүмкін болмады.") });
    } finally {
      setAvatarBusy(false);
    }
  }

  async function handlePassword(e: React.FormEvent) {
    e.preventDefault();
    setPwStatus(null);
    if (pw.next.length < 8) {
      setPwStatus({ ok: false, text: tr("Жаңа құпия сөз кемінде 8 таңбадан тұруы керек.") });
      return;
    }
    if (pw.next !== pw.repeat) {
      setPwStatus({ ok: false, text: tr("Жаңа құпия сөздер сәйкес емес.") });
      return;
    }
    setPwBusy(true);
    try {
      await changeMyPassword(user!.email, pw.current, pw.next);
      setPw({ current: "", next: "", repeat: "" });
      setPwStatus({ ok: true, text: tr("Құпия сөз өзгертілді.") });
    } catch (err) {
      setPwStatus({ ok: false, text: err instanceof Error ? err.message : tr("Құпия сөзді өзгерту мүмкін болмады.") });
    } finally {
      setPwBusy(false);
    }
  }

  return (
    <div className="mx-auto max-w-[1100px] px-4 py-9 sm:px-10">
      <PageHeader crumb={tr("Жеке бет")} title={tr("Жеке бет")} subtitle={tr("Өзіңіз туралы мәліметтерді толтырыңыз: олар ҚМЖ мен тесттерге автоматты түрде қойылады.")} />

      <div className="mt-8 flex flex-col gap-6">
        {/* Профиль картасы */}
        <section className={`${cardClass} flex flex-wrap items-center gap-6`}>
          <div className="relative">
            <Avatar user={{ name: form.name || user.name, avatarUrl: form.avatarUrl }} className="h-28 w-28 rounded-[28px] text-3xl" tone="bg-violet-500 text-white" />
            <button
              type="button"
              onClick={() => fileRef.current?.click()}
              disabled={avatarBusy}
              aria-label={tr("Аватарды өзгерту")}
              className="absolute -right-2 -bottom-2 flex h-10 w-10 items-center justify-center rounded-full border-4 border-surface bg-navy-900 text-white disabled:opacity-60"
            >
              <Camera size={16} className={avatarBusy ? "animate-pulse" : ""} />
            </button>
            <input ref={fileRef} type="file" accept="image/*" className="hidden" onChange={(e) => handleAvatar(e.target.files?.[0] ?? null)} />
          </div>
          <div className="min-w-0 flex-1">
            <h2 className="text-2xl font-bold">{user.name}</h2>
            <div className="mt-1 text-slate-500">{user.email}</div>
            <div className="mt-3 flex flex-wrap gap-2">
              <span className="rounded-full bg-violet-100 px-3 py-1 text-xs font-semibold text-violet-700">{user.role === "admin" ? tr("Әкімші") : tr("Мұғалім")}</span>
              {user.subject && <span className="rounded-full bg-fuchsia-100 px-3 py-1 text-xs font-semibold text-fuchsia-700">{tr(user.subject)}</span>}
              {user.category && <span className="rounded-full bg-slate-100 px-3 py-1 text-xs font-semibold text-slate-600">{user.category}</span>}
            </div>
          </div>
          <div className="flex flex-wrap gap-2">
            <button
              type="button"
              onClick={() => fileRef.current?.click()}
              disabled={avatarBusy}
              className="inline-flex items-center gap-2 rounded-[11px] border border-slate-200 bg-surface px-3.5 py-2.5 text-sm font-semibold hover:border-violet-500 hover:text-violet-600"
            >
              <Camera size={15} /> {avatarBusy ? tr("Жүктелуде...") : tr("Сурет жүктеу")}
            </button>
            {form.avatarUrl && (
              <button
                type="button"
                onClick={removeAvatar}
                disabled={avatarBusy}
                className="inline-flex items-center gap-2 rounded-[11px] border border-slate-200 bg-surface px-3.5 py-2.5 text-sm font-semibold hover:border-rose-600 hover:text-rose-700"
              >
                <Trash2 size={15} /> {tr("Өшіру")}
              </button>
            )}
          </div>
        </section>

        {/* Жеке мәліметтер */}
        <form onSubmit={handleSave} noValidate className={`${cardClass} flex flex-col gap-5`}>
          <h2 className="text-lg font-bold">{tr("Жеке мәліметтер")}</h2>
          <div className="grid gap-5 sm:grid-cols-2">
            <Field label={tr("Аты-жөні")}>
              <input value={form.name} onChange={(e) => set("name", e.target.value)} maxLength={120} autoComplete="name" className={fieldClass} />
            </Field>
            <Field label={tr("Телефон")}>
              <input value={form.phone} onChange={(e) => set("phone", e.target.value)} maxLength={40} type="tel" autoComplete="tel" placeholder="+7 7__ ___ __ __" className={fieldClass} />
            </Field>
            <Field label={locked ? tr("Негізгі пән") : tr("Пән")} hint={locked ? tr("Әкімші сізге бекіткен пәндер: {list}. Басқа пәндер бойынша материал жасау қолжетімсіз.", { list: subjects.map((x) => tr(x)).join(", ") }) : undefined}>
              <select value={form.subject} onChange={(e) => set("subject", e.target.value)} className={fieldClass}>
                {!locked && <option value="">{tr("— Таңдаңыз —")}</option>}
                {(subjects.includes(form.subject) || !form.subject ? subjects : [form.subject, ...subjects]).map((s) => (
                  <option key={s} value={s}>{tr(s)}</option>
                ))}
              </select>
            </Field>
            <Field label={tr("Мектеп")}>
              <input value={form.school} onChange={(e) => set("school", e.target.value)} maxLength={200} placeholder={tr("мыс.: №25 мектеп-гимназия")} className={fieldClass} />
            </Field>
            <Field label={tr("Біліктілік санаты")}>
              <select value={form.category} onChange={(e) => set("category", e.target.value)} className={fieldClass}>
                <option value="">{tr("— Таңдаңыз —")}</option>
                {CATEGORIES.map((c) => (
                  <option key={c} value={c}>{tr(c)}</option>
                ))}
              </select>
            </Field>
            <Field label={tr("Педагогикалық өтілі (жыл)")}>
              <input
                type="number"
                min={0}
                max={70}
                value={form.experienceYears ?? ""}
                onChange={(e) => set("experienceYears", e.target.value === "" ? null : Math.max(0, Math.min(70, Number(e.target.value))))}
                className={fieldClass}
              />
            </Field>
          </div>

          <div>
            <span className="mb-2 block text-[13px] font-semibold text-slate-500">{tr("Сабақ беретін сыныптарым")}</span>
            <div role="group" aria-label={tr("Сабақ беретін сыныптар")} className="grid grid-cols-6 gap-2 sm:grid-cols-11">
              {GRADES.map((g) => {
                const on = form.grades.includes(g);
                return (
                  <button
                    key={g}
                    type="button"
                    aria-pressed={on}
                    aria-label={tr(g)}
                    onClick={() => toggleGrade(g)}
                    className={`min-h-10 rounded-xl border text-sm transition ${on ? "border-violet-600 bg-violet-600 text-white" : "border-slate-200 bg-surface text-slate-500 hover:border-violet-500"}`}
                  >
                    {Number.parseInt(g, 10)}
                  </button>
                );
              })}
            </div>
            <span className="mt-1.5 block text-xs text-slate-500">{tr("Бірінші таңдалған сынып ҚМЖ мен тест беттерінде әдепкі болып тұрады.")}</span>
          </div>

          <Field label={tr("Өзім туралы")}>
            <textarea value={form.bio} onChange={(e) => set("bio", e.target.value)} maxLength={1000} rows={3} placeholder={tr("Қысқаша: тәжірибеңіз, қызығушылықтарыңыз, жетістіктеріңіз")} className={`${fieldClass} resize-y`} />
          </Field>

          <StatusLine s={status} />
          <div>
            <button type="submit" disabled={saving} className="inline-flex items-center gap-2.5 rounded-[14px] bg-violet-600 px-6 py-3.5 text-[15px] font-semibold text-white transition hover:-translate-y-0.5 disabled:translate-y-0 disabled:opacity-70">
              <Save size={16} /> {saving ? tr("Сақталуда...") : tr("Сақтау")}
            </button>
          </div>
        </form>

        {/* Құпия сөз */}
        <form onSubmit={handlePassword} noValidate className={`${cardClass} flex flex-col gap-5`}>
          <h2 className="text-lg font-bold">{tr("Құпия сөзді өзгерту")}</h2>
          <input type="text" autoComplete="username" value={user.email} readOnly hidden />
          <div className="grid gap-5 sm:grid-cols-3">
            <Field label={tr("Қазіргі құпия сөз")}>
              <input type="password" autoComplete="current-password" value={pw.current} onChange={(e) => setPw({ ...pw, current: e.target.value })} className={fieldClass} />
            </Field>
            <Field label={tr("Жаңа құпия сөз")} hint={tr("Кемінде 8 таңба")}>
              <input type="password" autoComplete="new-password" value={pw.next} onChange={(e) => setPw({ ...pw, next: e.target.value })} className={fieldClass} />
            </Field>
            <Field label={tr("Жаңа құпия сөзді қайталаңыз")}>
              <input type="password" autoComplete="new-password" value={pw.repeat} onChange={(e) => setPw({ ...pw, repeat: e.target.value })} className={fieldClass} />
            </Field>
          </div>
          <StatusLine s={pwStatus} />
          <div>
            <button type="submit" disabled={pwBusy || !pw.current || !pw.next} className="inline-flex items-center gap-2.5 rounded-[14px] bg-navy-900 dark:bg-violet-600 px-6 py-3.5 text-[15px] font-semibold text-white disabled:opacity-60">
              <KeyRound size={16} /> {pwBusy ? tr("Өзгертілуде...") : tr("Құпия сөзді өзгерту")}
            </button>
          </div>
        </form>

        <TelegramCard userId={user.id} isAdmin={user.role === "admin"} />
        <InstallApp variant="card" />
      </div>
    </div>
  );
}
