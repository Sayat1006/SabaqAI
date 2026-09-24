// Supabase арқылы серверлік аутентификация қабаты. Құпия сөздер Supabase Auth-та
// қауіпсіз хэштеліп сақталады; "кім әкімші/белсенді" деген ереже Postgres-тегі Row
// Level Security саясаттарында тексеріледі (браузерде емес). Аккаунт құру, құпия сөзді
// ысыру және жою — тек `admin-actions` Edge Function арқылы, себебі олар Supabase Admin
// API-ын (service_role кілтін) қажет етеді.

import { supabase } from "./supabaseClient";
import { tr } from "../i18n";

export type Role = "admin" | "teacher";
export type AccountStatus = "active" | "disabled";

export interface UserAccount {
  id: string;
  name: string;
  email: string;
  role: Role;
  status: AccountStatus;
  subject: string;
  school: string;
  createdAt: string;
  lastLoginAt: string | null;
  avatarUrl: string;
  grades: string[];
  category: string;
  experienceYears: number | null;
  phone: string;
  bio: string;
}

export interface AuditEntry {
  id: string;
  ts: string;
  actorEmail: string;
  action: string;
  detail: string;
}

interface ProfileRow {
  id: string;
  name: string;
  email: string;
  role: Role;
  status: AccountStatus;
  subject: string;
  school: string;
  created_at: string;
  last_login_at: string | null;
  // 2-жаңарту SQL-ы орындалмаған болса, бұл өрістер болмауы мүмкін.
  avatar_url?: string;
  grades?: string[];
  category?: string;
  experience_years?: number | null;
  phone?: string;
  bio?: string;
}

function mapProfile(row: ProfileRow): UserAccount {
  return {
    id: row.id,
    name: row.name,
    email: row.email,
    role: row.role,
    status: row.status,
    subject: row.subject,
    school: row.school,
    createdAt: row.created_at,
    lastLoginAt: row.last_login_at,
    avatarUrl: row.avatar_url ?? "",
    grades: row.grades ?? [],
    category: row.category ?? "",
    experienceYears: row.experience_years ?? null,
    phone: row.phone ?? "",
    bio: row.bio ?? "",
  };
}

function genPassword(): string {
  const chars = "ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnpqrstuvwxyz23456789";
  let out = "";
  for (let i = 0; i < 10; i++) out += chars[Math.floor(Math.random() * chars.length)];
  return out;
}

export type LoginResult =
  | { ok: true; user: UserAccount }
  | { ok: false; reason: "not_found" | "wrong_password" | "disabled"; message?: string };

export async function login(email: string, password: string): Promise<LoginResult> {
  const { data, error } = await supabase.auth.signInWithPassword({ email, password });
  if (error || !data.user) {
    return { ok: false, reason: "wrong_password", message: error?.message };
  }

  const { data: profile, error: profileError } = await supabase
    .from("profiles")
    .select("*")
    .eq("id", data.user.id)
    .single<ProfileRow>();

  if (profileError || !profile) {
    await supabase.auth.signOut();
    return { ok: false, reason: "not_found" };
  }
  if (profile.status === "disabled") {
    await supabase.auth.signOut();
    return { ok: false, reason: "disabled" };
  }

  await supabase.rpc("touch_last_login");
  await supabase.rpc("log_audit", { p_action: "Жүйеге кірді", p_detail: "" });
  return { ok: true, user: mapProfile(profile) };
}

export async function logout() {
  await supabase.rpc("log_audit", { p_action: "Жүйеден шықты", p_detail: "" });
  await supabase.auth.signOut();
}

export async function getSessionUser(): Promise<UserAccount | null> {
  const {
    data: { session },
  } = await supabase.auth.getSession();
  if (!session) return null;

  const { data: profile } = await supabase
    .from("profiles")
    .select("*")
    .eq("id", session.user.id)
    .single<ProfileRow>();
  if (!profile || profile.status === "disabled") return null;
  return mapProfile(profile);
}

export async function getUsers(): Promise<UserAccount[]> {
  const { data, error } = await supabase
    .from("profiles")
    .select("*")
    .order("created_at", { ascending: false })
    .returns<ProfileRow[]>();
  if (error || !data) return [];
  return data.map(mapProfile);
}

export async function getAudit(): Promise<AuditEntry[]> {
  const { data, error } = await supabase
    .from("audit_log")
    .select("*")
    .order("ts", { ascending: false })
    .limit(100);
  if (error || !data) return [];
  return data.map((row) => ({
    id: row.id as string,
    ts: row.ts as string,
    actorEmail: row.actor_email as string,
    action: row.action as string,
    detail: row.detail as string,
  }));
}

const isFetchError = (e: unknown) => (e as { name?: string } | null)?.name === "FunctionsFetchError";

async function callAdminAction<T>(action: string, payload: Record<string, unknown>): Promise<T> {
  const invoke = () => supabase.functions.invoke("admin-actions", { body: { action, ...payload } });
  let { data, error } = await invoke();
  // Байланыс бір рет үзілсе (мыс. функция «суық» іске қосылғанда) — қайта көреміз.
  if (isFetchError(error)) {
    await new Promise((r) => setTimeout(r, 1500));
    ({ data, error } = await invoke());
  }
  if (isFetchError(error)) {
    throw new Error(
      tr("Сервер функциясына (admin-actions) қосылу мүмкін болмады. Supabase → Edge Functions бөлімінде «admin-actions» функциясы жарияланғанын тексеріңіз (supabase/README.md, 4-қадам)."),
    );
  }
  if (error) {
    let message = error.message;
    const context = (error as { context?: Response }).context;
    if (context && typeof context.json === "function") {
      try {
        const body = (await context.json()) as { error?: string };
        if (body?.error) message = body.error;
      } catch {
        // денесі JSON емес болса — үнсіз өтеміз
      }
    }
    throw new Error(message);
  }
  return data as T;
}

export interface CreateUserInput {
  name: string;
  email: string;
  password: string;
  role: Role;
  subject: string;
  school: string;
}

export type CreateUserResult = { ok: true } | { ok: false; reason: "duplicate_email" | "error"; message?: string };

export async function createUser(input: CreateUserInput): Promise<CreateUserResult> {
  try {
    await callAdminAction("create", {
      name: input.name.trim(),
      email: input.email.trim().toLowerCase(),
      password: input.password,
      role: input.role,
      subject: input.subject.trim(),
      school: input.school.trim(),
    });
    return { ok: true };
  } catch (e) {
    const message = e instanceof Error ? e.message : tr("Белгісіз қате");
    if (/already|duplicate|registered/i.test(message)) {
      return { ok: false, reason: "duplicate_email" };
    }
    return { ok: false, reason: "error", message };
  }
}

export async function toggleStatus(user: UserAccount): Promise<boolean> {
  const nextStatus: AccountStatus = user.status === "active" ? "disabled" : "active";
  const { error } = await supabase.from("profiles").update({ status: nextStatus }).eq("id", user.id);
  if (error) return false;
  await supabase.rpc("log_audit", {
    p_action: nextStatus === "disabled" ? "Аккаунт өшірілді" : "Аккаунт қосылды",
    p_detail: `${user.name} (${user.email})`,
  });
  return true;
}

export async function toggleRole(user: UserAccount): Promise<boolean> {
  const nextRole: Role = user.role === "admin" ? "teacher" : "admin";
  const { error } = await supabase.from("profiles").update({ role: nextRole }).eq("id", user.id);
  if (error) return false;
  await supabase.rpc("log_audit", {
    p_action: "Рөлі өзгертілді",
    p_detail: `${user.name} (${user.email}) → ${nextRole === "admin" ? "әкімші" : "мұғалім"}`,
  });
  return true;
}

export async function deleteUser(user: UserAccount): Promise<{ ok: boolean; message?: string }> {
  try {
    await callAdminAction("delete", { userId: user.id });
    return { ok: true };
  } catch (e) {
    return { ok: false, message: e instanceof Error ? e.message : tr("Белгісіз қате") };
  }
}

export async function resetPassword(user: UserAccount): Promise<{ ok: true; newPassword: string } | { ok: false; message?: string }> {
  const newPassword = genPassword();
  try {
    await callAdminAction("reset-password", { userId: user.id, newPassword });
    return { ok: true, newPassword };
  } catch (e) {
    return { ok: false, message: e instanceof Error ? e.message : tr("Белгісіз қате") };
  }
}

/* ------------------------------------------------------------------ Жеке бет */

export interface ProfileInput {
  name: string;
  subject: string;
  school: string;
  grades: string[];
  category: string;
  experienceYears: number | null;
  phone: string;
  bio: string;
  avatarUrl: string;
}

export async function updateMyProfile(input: ProfileInput): Promise<void> {
  const { error } = await supabase.rpc("update_my_profile", {
    p_name: input.name,
    p_subject: input.subject,
    p_school: input.school,
    p_grades: input.grades,
    p_category: input.category,
    p_experience_years: input.experienceYears,
    p_phone: input.phone,
    p_bio: input.bio,
    p_avatar_url: input.avatarUrl,
  });
  if (error) {
    if (/update_my_profile/.test(error.message) && /(find|exist)/i.test(error.message)) {
      throw new Error(tr("Профильді сақтау функциясы табылмады. Әкімші Supabase-те supabase/update-2-projects-profile.sql файлын орындауы керек."));
    }
    throw new Error(error.message);
  }
  await supabase.rpc("log_audit", { p_action: "Профиль жаңартылды", p_detail: "" });
}

/** Қазіргі құпия сөзді тексеріп, жаңасын орнатады. */
export async function changeMyPassword(email: string, current: string, next: string): Promise<void> {
  const check = await supabase.auth.signInWithPassword({ email, password: current });
  if (check.error) throw new Error(tr("Қазіргі құпия сөз қате."));
  const { error } = await supabase.auth.updateUser({ password: next });
  if (error) {
    if (/should be different/i.test(error.message)) throw new Error(tr("Жаңа құпия сөз ескісінен өзгеше болуы керек."));
    if (/at least|weak|short/i.test(error.message)) throw new Error(tr("Құпия сөз тым әлсіз: кемінде 8 таңба, әріп пен сан қолданыңыз."));
    throw new Error(error.message);
  }
  await supabase.rpc("log_audit", { p_action: "Құпия сөз өзгертілді", p_detail: "" });
}
