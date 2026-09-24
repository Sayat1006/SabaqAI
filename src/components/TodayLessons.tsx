import { ArrowRight, CalendarClock } from "lucide-react";
import { Link } from "react-router-dom";
import { tr } from "../i18n";
import { dayMonth, dayName, lessonsOn, loadScheduleWithPlans, nextSchoolDay } from "../lib/schedule";
import { useLoad } from "../lib/useLoad";
import { LessonItem } from "./LessonItem";

/** Басты беттегі «Бүгінгі сабақтар»: кесте + КТЖ-дағы тақырыптар. */
export function TodayLessons() {
  const { data, error, loading } = useLoad(loadScheduleWithPlans);

  const head = (title: string) => (
    <div className="mb-3 flex items-center justify-between gap-3">
      <h2 className="flex items-center gap-2 text-xl font-bold">
        <CalendarClock size={20} className="text-violet-600" /> {title}
      </h2>
      <Link to="/schedule" className="text-sm font-semibold text-violet-600">
        {tr("Кесте")}
      </Link>
    </div>
  );

  if (loading) return null;
  if (error) {
    return (
      <section>
        {head(tr("Бүгінгі сабақтар"))}
        <div className="rounded-[18px] border border-slate-200 bg-surface p-5 text-sm text-slate-500">{error}</div>
      </section>
    );
  }

  const slots = data?.slots ?? [];
  if (!slots.length) {
    return (
      <section className="flex flex-wrap items-center justify-between gap-4 rounded-[20px] border border-dashed border-violet-300 bg-violet-50/60 px-6 py-5">
        <div className="flex items-start gap-3">
          <CalendarClock size={22} className="mt-0.5 shrink-0 text-violet-600" />
          <div>
            <div className="font-bold">{tr("Сабақ кестеңізді толтырыңыз")}</div>
            <div className="mt-0.5 text-sm text-slate-500">
              {tr("Бүгінгі сабақтар осында шығады: КТЖ-дағы тақырыбымен, бір батырмамен ҚМЖ жасауға болады.")}
            </div>
          </div>
        </div>
        <Link to="/schedule" className="inline-flex items-center gap-2 rounded-[12px] bg-violet-600 px-4 py-2.5 text-sm font-semibold text-white">
          {tr("Кестені толтыру")} <ArrowRight size={15} />
        </Link>
      </section>
    );
  }

  const today = new Date();
  const day = nextSchoolDay(today, slots) ?? today;
  const isToday = day.toDateString() === today.toDateString();
  const lessons = lessonsOn(day, slots, data?.plans ?? []);
  const title = isToday ? tr("Бүгінгі сабақтар") : tr("Келесі сабақтар");

  return (
    <section>
      {head(title)}
      <div className="rounded-[20px] border border-slate-200 bg-slate-50 p-3 sm:p-4">
        <div className="mb-2.5 px-1 text-[13px] font-semibold text-slate-500">
          {!isToday && `${tr("Бүгін сабақ жоқ.")} `}
          {dayName(day.getDay())}, {dayMonth(day)} · {tr("{n} сабақ", { n: lessons.length })}
        </div>
        <ul className="grid gap-2 lg:grid-cols-2">
          {lessons.map((l) => (
            <LessonItem key={l.slot.id} lesson={l} />
          ))}
        </ul>
      </div>
    </section>
  );
}
