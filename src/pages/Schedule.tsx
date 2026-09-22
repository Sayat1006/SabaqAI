import { CheckCircle2, ChevronLeft, ChevronRight, Radio, Settings2 } from "lucide-react";
import { Fragment, useMemo, useState } from "react";
import { Link } from "react-router-dom";
import { Badge, Button, Card, Field, Select, TextInput } from "../components/ui";
import { useLocalStorage } from "../lib/useLocalStorage";
import {
  PERIOD_SLOTS,
  WEEKDAY_NAMES,
  addDaysIso,
  formatIsoHuman,
  getWeekDates,
  periodForSlot,
  todayIso,
  type LessonStatus,
  type ScheduledLesson,
  type TimetableSlot,
} from "../lib/schedule";

function uid(): string {
  return crypto.randomUUID();
}

const WORK_DAYS = [1, 2, 3, 4, 5]; // Дүйсенбі — Жұма
const SHIFT_1_PERIODS = PERIOD_SLOTS.filter((p) => p.shift === 1);
const SHIFT_2_PERIODS = PERIOD_SLOTS.filter((p) => p.shift === 2);

function statusOf(lesson: ScheduledLesson, date: string): { label: string; tone: "done" | "live" | "upcoming" } {
  if (lesson.status === "done") return { label: "Жүргізілді", tone: "done" };
  if (date !== todayIso()) return { label: "Алда", tone: "upcoming" };
  const now = new Date();
  const hhmm = `${String(now.getHours()).padStart(2, "0")}:${String(now.getMinutes()).padStart(2, "0")}`;
  if (lesson.startTime && lesson.endTime && hhmm >= lesson.startTime && hhmm <= lesson.endTime) {
    return { label: "Өтілуде", tone: "live" };
  }
  return { label: "Алда", tone: "upcoming" };
}

function ClassCell({
  slot,
  date,
  lesson,
  onToggleStatus,
  onTopicChange,
}: {
  slot: TimetableSlot;
  date: string;
  lesson: ScheduledLesson;
  onToggleStatus: () => void;
  onTopicChange: (value: string) => void;
}) {
  const [editing, setEditing] = useState(false);
  const status = statusOf(lesson, date);

  return (
    <div className="flex h-full flex-col gap-1.5 rounded-xl border border-violet-200/60 bg-white/80 p-2.5 text-left text-xs backdrop-blur dark:border-violet-900/50 dark:bg-white/5">
      <div className="flex items-start justify-between gap-1">
        <p className="font-semibold text-slate-900 dark:text-white">{slot.subject}</p>
        <button
          type="button"
          onClick={onToggleStatus}
          className={`inline-flex shrink-0 items-center gap-0.5 rounded-full px-1.5 py-0.5 text-[10px] font-medium ${
            status.tone === "done"
              ? "bg-emerald-100 text-emerald-700 dark:bg-emerald-900/40 dark:text-emerald-300"
              : status.tone === "live"
                ? "bg-amber-100 text-amber-700 dark:bg-amber-900/40 dark:text-amber-300"
                : "bg-slate-100 text-slate-500 dark:bg-slate-800 dark:text-slate-400"
          }`}
          title="Күйін ауыстыру"
        >
          {status.tone === "done" && <CheckCircle2 size={11} />}
          {status.tone === "live" && <Radio size={11} />}
          {status.label}
        </button>
      </div>

      <p className="text-slate-500 dark:text-slate-400">
        <span className="rounded bg-violet-50 px-1.5 py-0.5 font-medium text-violet-700 dark:bg-violet-900/40 dark:text-violet-200">
          {slot.className}
        </span>
      </p>

      {editing ? (
        <input
          autoFocus
          value={lesson.topic}
          onChange={(e) => onTopicChange(e.target.value)}
          onBlur={() => setEditing(false)}
          placeholder="Тақырып"
          className="w-full rounded border border-violet-200 bg-transparent px-1.5 py-1 text-xs outline-none focus:border-violet-400 dark:border-violet-800"
        />
      ) : (
        <button
          type="button"
          onClick={() => setEditing(true)}
          className="text-left text-slate-600 hover:underline dark:text-slate-300"
        >
          {lesson.topic || "Тақырып белгіленбеген"}
        </button>
      )}

      <div className="mt-auto flex gap-1.5 pt-1">
        <Link
          to="/classes"
          className="flex-1 rounded-md border border-violet-200 px-1.5 py-1 text-center text-[11px] font-medium text-slate-600 hover:bg-violet-50 dark:border-violet-800 dark:text-slate-300 dark:hover:bg-violet-900/30"
        >
          Балл қою
        </Link>
        <Link
          to="/qmzh"
          className="flex-1 rounded-md bg-gradient-to-br from-violet-600 to-fuchsia-500 px-1.5 py-1 text-center text-[11px] font-medium text-white hover:opacity-90"
        >
          ҚМЖ ашу
        </Link>
      </div>
    </div>
  );
}

export default function SchedulePage() {
  const [slots, setSlots] = useLocalStorage<TimetableSlot[]>("sai-timetable", []);
  const [lessons, setLessons] = useLocalStorage<ScheduledLesson[]>("sai-schedule", []);
  const [anchor, setAnchor] = useState(todayIso());
  const [showTimetableEditor, setShowTimetableEditor] = useState(false);

  const [gradeFilter, setGradeFilter] = useState("Барлығы");
  const [dayFilter, setDayFilter] = useState<number | "all">("all");

  const [slotDay, setSlotDay] = useState(1);
  const [slotPeriodId, setSlotPeriodId] = useState(PERIOD_SLOTS[0].id);
  const [slotSubject, setSlotSubject] = useState("");
  const [slotClass, setSlotClass] = useState("");

  const weekDates = useMemo(() => getWeekDates(anchor), [anchor]);

  function lessonsForSlotOnDate(slot: TimetableSlot, date: string): ScheduledLesson {
    const existing = lessons.find((l) => l.slotId === slot.id && l.date === date);
    if (existing) return existing;
    return {
      id: `virtual-${slot.id}-${date}`,
      date,
      slotId: slot.id,
      subject: slot.subject,
      className: slot.className,
      startTime: slot.startTime,
      endTime: slot.endTime,
      topic: "",
      homework: "",
      status: "planned",
    };
  }

  function upsert(entry: ScheduledLesson) {
    setLessons((prev) => {
      const idx = prev.findIndex((l) => l.slotId === entry.slotId && l.date === entry.date);
      if (idx >= 0) {
        const next = [...prev];
        next[idx] = { ...entry, id: prev[idx].id };
        return next;
      }
      return [...prev, { ...entry, id: uid() }];
    });
  }

  function addSlot(e: React.FormEvent) {
    e.preventDefault();
    if (!slotSubject.trim() || !slotClass.trim()) return;
    const period = PERIOD_SLOTS.find((p) => p.id === slotPeriodId) ?? PERIOD_SLOTS[0];
    setSlots((prev) => [
      ...prev,
      {
        id: uid(),
        dayOfWeek: slotDay,
        startTime: period.start,
        endTime: period.end,
        subject: slotSubject.trim(),
        className: slotClass.trim(),
      },
    ]);
    setSlotSubject("");
    setSlotClass("");
  }

  function removeSlot(id: string) {
    setSlots((prev) => prev.filter((s) => s.id !== id));
  }

  const distinctClasses = useMemo(
    () => Array.from(new Set(slots.map((s) => s.className))).sort((a, b) => a.localeCompare(b)),
    [slots],
  );

  const visibleSlots = slots.filter((s) => gradeFilter === "Барлығы" || s.className === gradeFilter);
  const visibleDays = dayFilter === "all" ? WORK_DAYS : [dayFilter];

  const slotFor = (dayOfWeek: number, periodId: number) =>
    visibleSlots.find((s) => s.dayOfWeek === dayOfWeek && periodForSlot(s).id === periodId);

  return (
    <div className="mx-auto max-w-7xl px-4 py-10 sm:px-6">
      <Badge>Менің кестем</Badge>
      <h1 className="mt-3 mb-2 text-3xl font-semibold text-slate-900 dark:text-white">Апталық сабақ кестесі</h1>
      <p className="mb-6 text-slate-600 dark:text-slate-300">
        Дүйсенбіден Жұмаға дейінгі толық апталық кесте — сабақтар бойынша (1-ауысым 08:00-ден, 2-ауысым
        13:30-дан). Тақырыпты ашу үшін жол атын басыңыз, ал күйін «Жүргізілді/Алда» белгісінен
        ауыстырыңыз.
      </p>

      <div className="mb-5 flex flex-wrap items-center gap-3">
        <Field className="!mb-0">
          Сынып бойынша сүзу
          <Select value={gradeFilter} onChange={(e) => setGradeFilter(e.target.value)} className="!w-auto">
            <option>Барлығы</option>
            {distinctClasses.map((c) => (
              <option key={c}>{c}</option>
            ))}
          </Select>
        </Field>
        <Field className="!mb-0">
          Апта күні бойынша сүзу
          <Select
            value={dayFilter}
            onChange={(e) => setDayFilter(e.target.value === "all" ? "all" : Number(e.target.value))}
            className="!w-auto"
          >
            <option value="all">Барлық күндер</option>
            {WORK_DAYS.map((d) => (
              <option key={d} value={d}>
                {WEEKDAY_NAMES[d - 1]}
              </option>
            ))}
          </Select>
        </Field>

        <div className="ml-auto flex items-center gap-2">
          <Button type="button" variant="ghost" onClick={() => setAnchor((a) => addDaysIso(a, -7))} aria-label="Алдыңғы апта">
            <ChevronLeft size={16} />
          </Button>
          <Button type="button" variant="ghost" onClick={() => setAnchor(todayIso())}>
            Осы апта
          </Button>
          <Button type="button" variant="ghost" onClick={() => setAnchor((a) => addDaysIso(a, 7))} aria-label="Келесі апта">
            <ChevronRight size={16} />
          </Button>
          <Button type="button" variant="ghost" onClick={() => setShowTimetableEditor((v) => !v)}>
            <Settings2 size={15} /> {showTimetableEditor ? "Жасыру" : "Кестені баптау"}
          </Button>
        </div>
      </div>

      {showTimetableEditor && (
        <Card className="mb-6">
          <h3 className="mb-3 font-semibold text-slate-900 dark:text-white">Тұрақты апталық кесте</h3>
          <p className="mb-4 text-sm text-slate-500 dark:text-slate-400">
            Пән мен сыныптың аптаның қай күні, қай сабақта өтетінін қосыңыз — бұл әр аптада қайталанып
            отырады.
          </p>
          <form onSubmit={addSlot} className="mb-4 grid gap-3 sm:grid-cols-5 sm:items-end">
            <Field className="sm:mb-0">
              Күні
              <Select value={slotDay} onChange={(e) => setSlotDay(Number(e.target.value))}>
                {WORK_DAYS.map((d) => (
                  <option key={d} value={d}>
                    {WEEKDAY_NAMES[d - 1]}
                  </option>
                ))}
              </Select>
            </Field>
            <Field className="sm:mb-0">
              Сабақ
              <Select value={slotPeriodId} onChange={(e) => setSlotPeriodId(Number(e.target.value))}>
                <optgroup label="1-ауысым">
                  {SHIFT_1_PERIODS.map((p) => (
                    <option key={p.id} value={p.id}>
                      {p.lessonNumber}-сабақ ({p.start}–{p.end})
                    </option>
                  ))}
                </optgroup>
                <optgroup label="2-ауысым">
                  {SHIFT_2_PERIODS.map((p) => (
                    <option key={p.id} value={p.id}>
                      {p.lessonNumber}-сабақ ({p.start}–{p.end})
                    </option>
                  ))}
                </optgroup>
              </Select>
            </Field>
            <Field className="sm:mb-0">
              Пән
              <TextInput placeholder="мысалы: Физика" value={slotSubject} onChange={(e) => setSlotSubject(e.target.value)} required />
            </Field>
            <Field className="sm:mb-0">
              Сынып
              <TextInput placeholder="мысалы: 11А" value={slotClass} onChange={(e) => setSlotClass(e.target.value)} required />
            </Field>
            <Button type="submit">+ Қосу</Button>
          </form>

          {slots.length === 0 ? (
            <p className="text-sm text-slate-500 dark:text-slate-400">Әзірге тұрақты сабақ қосылмаған.</p>
          ) : (
            <div className="overflow-x-auto rounded-lg border border-violet-100 dark:border-violet-900/50">
              <table className="w-full text-sm">
                <thead className="bg-violet-50 text-slate-600 dark:bg-violet-950/60 dark:text-slate-300">
                  <tr>
                    <th className="px-3 py-2 text-left font-medium">Күні</th>
                    <th className="px-3 py-2 text-left font-medium">Сабақ</th>
                    <th className="px-3 py-2 text-left font-medium">Пән</th>
                    <th className="px-3 py-2 text-left font-medium">Сынып</th>
                    <th className="px-3 py-2 text-left font-medium"></th>
                  </tr>
                </thead>
                <tbody>
                  {slots.map((s) => {
                    const period = periodForSlot(s);
                    return (
                      <tr key={s.id} className="border-t border-violet-50 dark:border-violet-900/30">
                        <td className="px-3 py-2">{WEEKDAY_NAMES[s.dayOfWeek - 1]}</td>
                        <td className="px-3 py-2 text-slate-500 dark:text-slate-400">
                          {period.shift}-ауысым, {period.lessonNumber}-сабақ ({s.startTime}–{s.endTime})
                        </td>
                        <td className="px-3 py-2 font-medium text-slate-800 dark:text-slate-100">{s.subject}</td>
                        <td className="px-3 py-2">{s.className}</td>
                        <td className="px-3 py-2 text-right">
                          <button type="button" onClick={() => removeSlot(s.id)} className="text-xs text-rose-500 hover:text-rose-700">
                            Жою
                          </button>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}
        </Card>
      )}

      {slots.length === 0 ? (
        <Card className="text-center text-slate-500 dark:text-slate-400">
          Апта көрінісін көру үшін алдымен «Кестені баптау» арқылы кем дегенде бір сабақ қосыңыз.
        </Card>
      ) : (
        <div className="overflow-x-auto rounded-xl border border-violet-100 dark:border-violet-900/50">
          <table className="w-full border-collapse text-sm">
            <thead>
              <tr>
                <th className="w-28 border-b border-violet-100 bg-violet-50 px-2 py-2 text-xs font-medium text-slate-500 dark:border-violet-900/40 dark:bg-violet-950/60 dark:text-slate-400">
                  Сабақ
                </th>
                {visibleDays.map((d) => {
                  const date = weekDates[d - 1];
                  const isToday = date === todayIso();
                  return (
                    <th
                      key={d}
                      className={`min-w-[190px] border-b border-l border-violet-100 px-2 py-2 text-xs font-semibold uppercase tracking-wide dark:border-violet-900/40 ${
                        isToday
                          ? "bg-violet-600 text-white"
                          : "bg-violet-50 text-slate-600 dark:bg-violet-950/60 dark:text-slate-300"
                      }`}
                    >
                      {WEEKDAY_NAMES[d - 1]}
                      <span className="ml-1 font-normal opacity-80">{formatIsoHuman(date)}</span>
                    </th>
                  );
                })}
              </tr>
            </thead>
            <tbody>
              {PERIOD_SLOTS.map((period) => (
                <Fragment key={period.id}>
                  {period.lessonNumber === 1 && (
                    <tr>
                      <td
                        colSpan={visibleDays.length + 1}
                        className="border-b border-violet-100 bg-violet-100/70 px-3 py-1.5 text-xs font-semibold uppercase tracking-wide text-violet-700 dark:border-violet-900/40 dark:bg-violet-900/30 dark:text-violet-200"
                      >
                        {period.shift}-ауысым
                      </td>
                    </tr>
                  )}
                  <tr>
                    <td className="border-b border-violet-50 bg-violet-50/50 px-2 py-2 text-center align-top dark:border-violet-900/30 dark:bg-violet-950/30">
                      <p className="text-sm font-semibold text-slate-700 dark:text-slate-200">{period.lessonNumber}</p>
                      <p className="text-[11px] text-slate-400 dark:text-slate-500">
                        {period.start}–{period.end}
                      </p>
                    </td>
                    {visibleDays.map((d) => {
                      const slot = slotFor(d, period.id);
                      const date = weekDates[d - 1];
                      return (
                        <td key={d} className="border-b border-l border-violet-50 p-1.5 align-top dark:border-violet-900/30">
                          {slot ? (
                            <ClassCell
                              slot={slot}
                              date={date}
                              lesson={lessonsForSlotOnDate(slot, date)}
                              onToggleStatus={() => {
                                const lesson = lessonsForSlotOnDate(slot, date);
                                upsert({ ...lesson, status: (lesson.status === "done" ? "planned" : "done") as LessonStatus });
                              }}
                              onTopicChange={(value) => upsert({ ...lessonsForSlotOnDate(slot, date), topic: value })}
                            />
                          ) : (
                            <button
                              type="button"
                              onClick={() => {
                                setSlotDay(d);
                                setSlotPeriodId(period.id);
                                setShowTimetableEditor(true);
                              }}
                              className="flex h-full min-h-[64px] w-full items-center justify-center rounded-lg border border-dashed border-violet-200 text-xs text-slate-300 transition hover:border-violet-400 hover:text-violet-500 dark:border-violet-900/50 dark:text-slate-600"
                            >
                              + Қосу
                            </button>
                          )}
                        </td>
                      );
                    })}
                  </tr>
                </Fragment>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
