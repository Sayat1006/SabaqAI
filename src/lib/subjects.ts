// Мұғалімге қолжетімді пәндер: әкімші бекіткен пәндер (ең көбі 2), ал бекітілмеген
// болса (әкімші, бұрынғы аккаунттар) — барлық пән.

import { SUBJECTS } from "./catalog";
import type { UserAccount } from "./auth";

export const MAX_SUBJECTS = 2;

export function allowedSubjects(user: Pick<UserAccount, "role" | "subjects"> | null | undefined): string[] {
  if (!user || user.role === "admin" || !user.subjects?.length) return SUBJECTS;
  return user.subjects;
}

/** Бастапқы пән: қалаған пән рұқсат етілсе — сол, әйтпесе профильдегі пән, әйтпесе біріншісі. */
export function pickSubject(allowed: string[], ...preferred: (string | undefined | null)[]): string {
  for (const p of preferred) if (p && allowed.includes(p)) return p;
  return allowed[0];
}
