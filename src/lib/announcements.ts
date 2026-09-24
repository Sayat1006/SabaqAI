// Хабарландырулар: әкімші жазады, барлық мұғалім басты беттегі қоңыраудан көреді.
// Қай хабарландыруды көргені құрылғыда (localStorage) сақталады.

import { tr } from "../i18n";
import { supabase } from "./supabaseClient";

export interface Announcement {
  id: string;
  title: string;
  body: string;
  createdAt: number;
}

function wrap(message: string) {
  if (/announcements/.test(message) && /(does not exist|Could not find|42P01|schema cache)/i.test(message)) {
    return new Error(tr("Хабарландырулар кестесі табылмады. Әкімші Supabase-те supabase/update-11-announcements.sql файлын орындауы керек."));
  }
  return new Error(tr("Хабарландыруларды жүктеу/сақтау мүмкін болмады: {msg}", { msg: message }));
}

const toAnnouncement = (r: { id: string; title: string; body: string; created_at: string }): Announcement => ({
  id: r.id,
  title: r.title,
  body: r.body,
  createdAt: new Date(r.created_at).getTime(),
});

export async function getAnnouncements(limit = 30): Promise<Announcement[]> {
  const { data, error } = await supabase.from("announcements").select("id, title, body, created_at").order("created_at", { ascending: false }).limit(limit);
  if (error) throw wrap(error.message);
  return (data ?? []).map(toAnnouncement);
}

export async function createAnnouncement(title: string, body: string): Promise<Announcement> {
  const { data: s } = await supabase.auth.getSession();
  const { data, error } = await supabase
    .from("announcements")
    .insert({ title: title.trim(), body: body.trim(), created_by: s.session?.user.id })
    .select("id, title, body, created_at")
    .single();
  if (error) throw wrap(error.message);
  return toAnnouncement(data);
}

export async function updateAnnouncement(id: string, title: string, body: string): Promise<void> {
  const { data, error } = await supabase.from("announcements").update({ title: title.trim(), body: body.trim() }).eq("id", id).select("id");
  if (error) throw wrap(error.message);
  if (!data?.length) throw new Error(tr("Өзгерту мүмкін болмады: рұқсат жоқ."));
}

export async function deleteAnnouncement(id: string): Promise<void> {
  const { error } = await supabase.from("announcements").delete().eq("id", id);
  if (error) throw wrap(error.message);
}

const SEEN_KEY = "ainur-news-seen";

export function lastSeen(): number {
  try {
    return Number(localStorage.getItem(SEEN_KEY)) || 0;
  } catch {
    return 0;
  }
}

export function markSeen(ts: number) {
  try {
    localStorage.setItem(SEEN_KEY, String(ts));
  } catch {
    // жеке режим
  }
}
