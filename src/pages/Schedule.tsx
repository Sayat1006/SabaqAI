import { ChevronLeft, ChevronRight, Pencil, Plus, Save, Trash2, X } from "lucide-react";
import { Loading } from "../components/Loading";
import { useState } from "react";
import { LessonItem } from "../components/LessonItem";
import { PageHeader } from "../components/PageHeader";
import { useAuth } from "../context/useAuth";
import { tr } from "../i18n";
import { GRADES } from "../lib/catalog";
import { allowedSubjects, pickSubject } from "../lib/subjects";
import {
  BELLS,
  dateOfWeekday,
  dayMonth,
  dayName,
  lessonsOn,
  loadScheduleWithPlans,
  mondayOf,
  newSlotId,
  saveSchedule,
  SCHOOL_DAYS,
  sortSlots,
  type Slot,
} from "../lib/schedule";
import { useLoad } from "../lib/useLoad";

const field = "w-full min-w-0 rounded-lg border border-slate-200 bg-slate-50 px-2 py-2 text-[13px] outline-none focus:border-violet-500";
const ghost =
  "inline-flex items-center gap-2 rounded-[11px] border border-slate-200 bg-surface px-3.5 py-2.5 text-sm font-semibold hover:border-violet-500 hover:text-violet-600 disabled:opacity-60";

export default function SchedulePage() {
  const { user } = useAuth();
  const subjects = allowedSubjects(user);
  const { data, error: loadError, loading, reload } = useLoad(loadScheduleWithPlans);
  const slots = data?.slots ?? [];
  const [editing, setEditing] = useState<boolean | null>(null);
  const [draft, setDraft] = useState<Slot[] | null>(null);
  const [week, setWeek] = useState(0);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");

  // Кесте бос болса, бірден толтыру күйінде ашылады.
  const isEditing = editing ?? (!loading && !loadError && slots.length === 0);
  const rows = draft ?? slots;

  const monday = mondayOf(new Date());
  monday.setDate(monday.getDate() + week * 7);
  const saturday = dateOfWeekday(monday, 6);
  const todayKey = new Date().toDateString();
  const shownDays = SCHOOL_DAYS.filter((d) => d !== 6 || isEditing || rows.some((s) => s.day === 6));

  function startEdit() {
    setDraft(slots);
    setEditing(true);
    setError("");
  }

  function cancel() {
    setDraft(null);
    setEditing(false);
    setError("");
  }

  function addSlot(day: number) {
    const list = sortSlots(rows.filter((s) => s.day === day));
    const last = list[list.length - 1];
    const next = last ? (BELLS.find((b) => b > last.time) ?? last.time) : BELLS[0];
    const subject = pickSubject(subjects, last?.subject, user?.subject);
    const grade = last?.grade ?? user?.grades?.[0] ?? GRADES[4];
    setDraft([...rows, { id: newSlotId(), day, time: next, subject, grade, letter: last?.letter ?? "А" }]);
  }

  const patch = (id: string, p: Partial<Slot>) => setDraft(rows.map((s) => (s.id === id ? { ...s, ...p } : s)));
  const remove = (id: string) => setDraft(rows.filter((s) => s.id !== id));

  /** Бір күннің сабақтарын келесі бос күнге көшіру (мыс. Дс = Ср). */
  function copyDay(from: number, to: number) {
    const copies = rows.filter((s) => s.day === from).map((s) => ({ ...s, id: newSlotId(), day: to }));
    setDraft([...rows.filter((s) => s.day !== to), ...copies]);
  }

  async function save() {
    setSaving(true);
    setError("");
    try {
      await saveSchedule(rows.filter((s) => s.subject && s.grade));
      setDraft(null);
      setEditing(false);
      await reload();
    } catch (e) {
      setError(e instanceof Error ? e.message : tr("Сақтау мүмкін болмады."));
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="mx-auto max-w-[1440px] px-4 py-9 sm:px-10">
      <PageHeader
        crumb={tr("Сабақ кестесі")}
        title={tr("Сабақ кестесі")}
        subtitle={tr("Апталық кестеңізді бір рет толтырыңыз. Әр сабақтың тақырыбы КТЖ-дан алынады, ҚМЖ-ны бір батырмамен жасайсыз. Бүгінгі сабақтар басты бетте шығады.")}
      />

      <div className="mt-7 flex flex-wrap items-center justify-between gap-3">
        {isEditing ? (
          <div className="text-sm font-semibold text-slate-500">{tr("Кестені өзгерту: әр күнге сабақтарды қосыңыз.")}</div>
        ) : (
          <div className="flex items-center gap-2">
            <button type="button" onClick={() => setWeek((w) => w - 1)} aria-label={tr("Алдыңғы апта")} className="rounded-[11px] border border-slate-200 bg-surface p-2.5 hover:border-violet-500">
              <ChevronLeft size={17} />
            </button>
            <div className="min-w-[150px] text-center text-sm font-semibold">
              {dayMonth(monday)} – {dayMonth(saturday)}
            </div>
            <button type="button" onClick={() => setWeek((w) => w + 1)} aria-label={tr("Келесі апта")} className="rounded-[11px] border border-slate-200 bg-surface p-2.5 hover:border-violet-500">
              <ChevronRight size={17} />
            </button>
            {week !== 0 && (
              <button type="button" onClick={() => setWeek(0)} className="px-2 text-sm font-semibold text-violet-600">
                {tr("Осы апта")}
              </button>
            )}
          </div>
        )}
        <div className="flex gap-2">
          {isEditing ? (
            <>
              {slots.length > 0 && (
                <button type="button" onClick={cancel} className={ghost}>
                  <X size={16} /> {tr("Болдырмау")}
                </button>
              )}
              <button
                type="button"
                onClick={save}
                disabled={saving}
                className="inline-flex items-center gap-2 rounded-[11px] bg-violet-600 px-4 py-2.5 text-sm font-semibold text-white disabled:opacity-60"
              >
                <Save size={16} /> {saving ? tr("Сақталуда...") : tr("Сақтау")}
              </button>
            </>
          ) : (
            !loading && !loadError && (
              <button type="button" onClick={startEdit} className={ghost}>
                <Pencil size={16} /> {tr("Кестені өзгерту")}
              </button>
            )
          )}
        </div>
      </div>

      {(error || loadError) && (
        <p role="alert" className="mt-4 rounded-xl bg-rose-50 px-4 py-3 text-sm text-rose-700">
          {error || loadError}
        </p>
      )}

      {loading ? (
        <Loading className="mt-6" />
      ) : (
        !loadError && (
          <div className="mt-6 grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
            {shownDays.map((day) => {
              const date = dateOfWeekday(monday, day);
              const isToday = !isEditing && date.toDateString() === todayKey;
              const daySlots = sortSlots(rows.filter((s) => s.day === day));
              const prevDay = day - 1;
              return (
                <section
                  key={day}
                  aria-label={dayName(day)}
                  className={`flex flex-col rounded-[20px] border p-4 ${isToday ? "border-violet-500 bg-violet-50/50" : "border-slate-200 bg-slate-50"}`}
                >
                  <div className="mb-3 flex items-baseline justify-between gap-2 px-1">
                    <h2 className="font-bold">
                      {dayName(day)}
                      {isToday && <span className="ml-2 rounded-full bg-violet-600 px-2 py-0.5 text-[11px] font-semibold text-white">{tr("Бүгін")}</span>}
                    </h2>
                    {!isEditing && <span className="text-[13px] text-slate-500">{dayMonth(date)}</span>}
                  </div>

                  {isEditing ? (
                    <div className="flex flex-col gap-2">
                      {daySlots.map((s) => (
                        <div key={s.id} className="grid grid-cols-[84px_1fr_34px] gap-1.5 rounded-[12px] border border-slate-200 bg-surface p-2">
                          <input type="time" aria-label={tr("Уақыты")} value={s.time} onChange={(e) => patch(s.id, { time: e.target.value })} className={field} />
                          <select aria-label={tr("Пән")} value={s.subject} onChange={(e) => patch(s.id, { subject: e.target.value })} className={field}>
                            {(subjects.includes(s.subject) ? subjects : [s.subject, ...subjects]).map((x) => (
                              <option key={x} value={x}>
                                {tr(x)}
                              </option>
                            ))}
                          </select>
                          <button type="button" onClick={() => remove(s.id)} aria-label={tr("Сабақты жою")} className="flex items-center justify-center rounded-lg text-slate-400 hover:bg-rose-50 hover:text-rose-600">
                            <Trash2 size={16} />
                          </button>
                          <select aria-label={tr("Сынып")} value={s.grade} onChange={(e) => patch(s.id, { grade: e.target.value })} className={`${field} col-span-2 col-start-1`}>
                            {GRADES.map((g) => (
                              <option key={g} value={g}>
                                {tr(g)}
                              </option>
                            ))}
                          </select>
                          <input
                            aria-label={tr("Литер")}
                            value={s.letter}
                            onChange={(e) => patch(s.id, { letter: e.target.value.toUpperCase().slice(0, 2) })}
                            placeholder="А"
                            className={`${field} text-center`}
                          />
                        </div>
                      ))}
                      <div className="flex flex-wrap gap-2">
                        <button type="button" onClick={() => addSlot(day)} className="inline-flex items-center gap-1.5 rounded-[11px] border border-dashed border-violet-400 px-3 py-2 text-[13px] font-semibold text-violet-700 hover:bg-violet-50">
                          <Plus size={15} /> {tr("Сабақ қосу")}
                        </button>
                        {daySlots.length === 0 && prevDay >= 1 && rows.some((s) => s.day === prevDay) && (
                          <button type="button" onClick={() => copyDay(prevDay, day)} className="rounded-[11px] px-2 py-2 text-[13px] font-semibold text-slate-500 hover:text-violet-600">
                            {tr("{day} күнін көшіру", { day: dayName(prevDay) })}
                          </button>
                        )}
                      </div>
                    </div>
                  ) : daySlots.length ? (
                    <ul className="flex flex-col gap-2">
                      {lessonsOn(date, slots, data?.plans ?? []).map((l) => (
                        <LessonItem key={l.slot.id} lesson={l} compact />
                      ))}
                    </ul>
                  ) : (
                    <p className="px-1 text-sm text-slate-500">{tr("Сабақ жоқ")}</p>
                  )}
                </section>
              );
            })}
          </div>
        )
      )}
    </div>
  );
}
