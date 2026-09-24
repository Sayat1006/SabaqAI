import { ArrowLeft, ArrowRight, CalendarClock, CalendarDays, ClipboardList, FileCheck2, Sparkles, UserRound, X, type LucideIcon } from "lucide-react";
import { useEffect, useState } from "react";
import { createPortal } from "react-dom";
import { useNavigate, useSearchParams } from "react-router-dom";
import { useAuth } from "../context/useAuth";
import { tr } from "../i18n";

interface Step {
  icon: LucideIcon;
  title: string;
  text: string;
  to?: string;
  action?: string;
}

const STEPS: Step[] = [
  {
    icon: Sparkles,
    title: tr("AI Nur-ға қош келдіңіз!"),
    text: tr("Бұл — мұғалімге арналған AI көмекші. Бір минутта негізгі мүмкіндіктерді көрсетейік."),
  },
  {
    icon: UserRound,
    title: tr("1. Профильді толтырыңыз"),
    text: tr("Пәніңіз бен сыныптарыңызды көрсетіңіз — ҚМЖ, КТЖ және тест беттері соларды әдепкі етіп алады."),
    to: "/profile",
    action: tr("Профильді ашу"),
  },
  {
    icon: CalendarClock,
    title: tr("2. Сабақ кестесі"),
    text: tr("Апталық кестені бір рет толтырыңыз — бүгінгі сабақтар тақырыбымен басты бетте шығады."),
    to: "/schedule",
    action: tr("Кестені толтыру"),
  },
  {
    icon: CalendarDays,
    title: tr("3. КТЖ"),
    text: tr("Тоқсандық жоспарды AI жасайды, күндерін сайт өзі қояды. Кестедегі әр сабақтың тақырыбы осы жоспардан алынады."),
    to: "/ktzh",
    action: tr("КТЖ жасау"),
  },
  {
    icon: ClipboardList,
    title: tr("4. ҚМЖ және материалдар"),
    text: tr("Бір батырмамен ресми үлгідегі ҚМЖ, одан кейін презентация мен деңгейлік тест. Материалды қазақша, орысша не ағылшынша жасауға болады."),
    to: "/qmzh",
    action: tr("ҚМЖ жасау"),
  },
  {
    icon: FileCheck2,
    title: tr("5. Сабақта"),
    text: tr("Тестті оқушыларға сілтеме не QR арқылы жіберіңіз, тірі викторина өткізіңіз, нәтижелерін «Оқушы прогресі» бетінен көріңіз."),
    to: "/tests",
    action: tr("Тапсырма жасау"),
  },
];

const doneKey = (id: string) => `ainur-tour-done-${id}`;

function isDone(id: string) {
  try {
    return localStorage.getItem(doneKey(id)) === "1";
  } catch {
    return true;
  }
}

/** Алғаш кірген мұғалімге қысқа нұсқаулық. Профиль мәзіріндегі «Нұсқаулық» арқылы қайта ашылады (/?tour=1). */
export function WelcomeTour() {
  const { user } = useAuth();
  const navigate = useNavigate();
  const [params, setParams] = useSearchParams();
  const requested = params.get("tour") === "1";
  const [dismissed, setDismissed] = useState(false);
  const [step, setStep] = useState(0);

  // «Нұсқаулық» қайта басылса, бірінші қадамнан ашылады.
  const [lastRequested, setLastRequested] = useState(requested);
  if (requested !== lastRequested) {
    setLastRequested(requested);
    if (requested) {
      setDismissed(false);
      setStep(0);
    }
  }

  const open = !!user && !dismissed && (requested || !isDone(user.id));

  function close() {
    if (user) {
      try {
        localStorage.setItem(doneKey(user.id), "1");
      } catch {
        // жеке режим
      }
    }
    setDismissed(true);
    if (requested) {
      params.delete("tour");
      setParams(params, { replace: true });
    }
  }

  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") close();
      if (e.key === "ArrowRight") setStep((s) => Math.min(s + 1, STEPS.length - 1));
      if (e.key === "ArrowLeft") setStep((s) => Math.max(s - 1, 0));
    };
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
    // eslint-disable-next-line react-hooks/exhaustive-deps -- close тек күйді жазады
  }, [open]);

  if (!open) return null;
  const s = STEPS[step];
  const last = step === STEPS.length - 1;

  function go(to: string) {
    close();
    navigate(to);
  }

  return createPortal(
    <div className="fixed inset-0 z-[70] flex items-end justify-center bg-navy-900/50 p-3 backdrop-blur-sm sm:items-center" role="dialog" aria-modal="true" aria-labelledby="tour-title">
      <div className="relative w-full max-w-[460px] animate-[fadeUp_.35s_cubic-bezier(.16,1,.3,1)_both] rounded-[26px] bg-surface p-6 shadow-2xl sm:p-7">
        <button type="button" onClick={close} aria-label={tr("Жабу")} className="absolute top-4 right-4 rounded-full p-2 text-slate-400 hover:bg-slate-100 hover:text-slate-600">
          <X size={18} />
        </button>
        <div className="text-[12.5px] font-semibold text-slate-400">
          {step + 1} / {STEPS.length}
        </div>
        <span key={step} className="mt-3 flex h-14 w-14 animate-[fadeUp_.35s_both] items-center justify-center rounded-[18px] bg-violet-100 text-violet-600">
          <s.icon size={28} />
        </span>
        <h2 id="tour-title" className="mt-4 text-[21px] leading-snug font-bold">
          {s.title}
        </h2>
        <p className="mt-2 min-h-[66px] text-[14.5px] leading-relaxed text-slate-600">{s.text}</p>
        {s.to && (
          <button type="button" onClick={() => go(s.to!)} className="mt-3 inline-flex items-center gap-1.5 text-sm font-semibold text-violet-600 hover:underline">
            {s.action} <ArrowRight size={14} />
          </button>
        )}

        <div className="mt-6 flex items-center justify-between gap-3">
          <div className="flex gap-1.5" aria-hidden>
            {STEPS.map((_, i) => (
              <span key={i} className={`h-1.5 rounded-full transition-all ${i === step ? "w-5 bg-violet-600" : "w-1.5 bg-slate-200"}`} />
            ))}
          </div>
          <div className="flex items-center gap-2">
            {step > 0 ? (
              <button type="button" onClick={() => setStep(step - 1)} aria-label={tr("Артқа")} className="rounded-[12px] border border-slate-200 p-2.5 text-slate-600 hover:border-violet-500">
                <ArrowLeft size={17} />
              </button>
            ) : (
              <button type="button" onClick={close} className="px-2 text-sm font-semibold text-slate-500 hover:text-slate-700">
                {tr("Өткізіп жіберу")}
              </button>
            )}
            <button
              type="button"
              onClick={() => (last ? close() : setStep(step + 1))}
              className="inline-flex items-center gap-1.5 rounded-[12px] bg-violet-600 px-4 py-2.5 text-sm font-semibold text-white hover:bg-violet-700"
            >
              {last ? tr("Бастау") : tr("Келесі")} {!last && <ArrowRight size={15} />}
            </button>
          </div>
        </div>
      </div>
    </div>,
    document.body,
  );
}
