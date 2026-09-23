import { Download, Share, SquarePlus, Smartphone, X } from "lucide-react";
import { useEffect, useState, useSyncExternalStore } from "react";
import { canPromptInstall, isIos, isStandalone, onInstallChange, promptInstall } from "../lib/pwa";

// «Қосымшаны орнату»: Android/Chrome-да бір батырма, iPhone/iPad-та қысқа нұсқаулық.
// Қосымша ретінде ашылған болса немесе мұғалім «Жабу» басса — көрінбейді.

const HIDE_KEY = "ainur-install-hidden";

function readHidden() {
  try {
    return localStorage.getItem(HIDE_KEY) === "1";
  } catch {
    return false;
  }
}

export function InstallApp({ variant = "banner" }: { variant?: "banner" | "card" }) {
  const canPrompt = useSyncExternalStore(onInstallChange, canPromptInstall, () => false);
  const [hidden, setHidden] = useState(() => variant === "banner" && readHidden());
  const [standalone, setStandalone] = useState(isStandalone);
  const [iosHelp, setIosHelp] = useState(false);
  const [done, setDone] = useState(false);
  const ios = isIos();

  useEffect(() => {
    const mq = window.matchMedia?.("(display-mode: standalone)");
    if (!mq) return;
    const on = () => setStandalone(isStandalone());
    mq.addEventListener?.("change", on);
    return () => mq.removeEventListener?.("change", on);
  }, []);

  if (standalone || done) {
    if (variant === "card")
      return (
        <section className="rounded-[22px] border border-slate-200 bg-white p-6 sm:p-7">
          <h2 className="flex items-center gap-2 text-lg font-bold">
            <Smartphone size={18} className="text-violet-600" /> AI Nur қосымшасы
          </h2>
          <p className="mt-2 text-sm text-slate-500">Қосымша орнатылған — оны телефонның басты экранынан ашыңыз.</p>
        </section>
      );
    return null;
  }
  // Батырма да, iOS нұсқаулығы да мүмкін болмаса (мыс. компьютердегі Firefox), баннер шықпайды.
  if (variant === "banner" && (hidden || (!canPrompt && !ios))) return null;

  const hide = () => {
    setHidden(true);
    try {
      localStorage.setItem(HIDE_KEY, "1");
    } catch {
      // жеке режим — тек осы сессияда жасырылады
    }
  };

  async function install() {
    if (canPrompt) {
      if (await promptInstall()) setDone(true);
    } else setIosHelp(true);
  }

  const help = (
    <ol className="mt-3 flex flex-col gap-2 text-sm">
      <li className="flex items-start gap-2">
        <span className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-violet-100 text-xs font-bold text-violet-700">1</span>
        <span className="pt-0.5">
          Safari-дің төменгі жолағындағы <Share size={15} className="inline align-[-2px] text-violet-600" aria-hidden /> «Бөлісу» батырмасын басыңыз.
        </span>
      </li>
      <li className="flex items-start gap-2">
        <span className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-violet-100 text-xs font-bold text-violet-700">2</span>
        <span className="pt-0.5">
          Тізімнен <SquarePlus size={15} className="inline align-[-2px] text-violet-600" aria-hidden /> «Басты экранға қосу» (На экран «Домой») таңдаңыз.
        </span>
      </li>
      <li className="flex items-start gap-2">
        <span className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-violet-100 text-xs font-bold text-violet-700">3</span>
        <span className="pt-0.5">«Қосу» басыңыз — басты экранда AI Nur белгішесі пайда болады.</span>
      </li>
    </ol>
  );

  if (variant === "card")
    return (
      <section className="rounded-[22px] border border-slate-200 bg-white p-6 sm:p-7">
        <h2 className="flex items-center gap-2 text-lg font-bold">
          <Smartphone size={18} className="text-violet-600" /> Телефонға орнату
        </h2>
        <p className="mt-2 text-sm text-slate-500">
          AI Nur-ды қосымша ретінде орнатсаңыз, ол басты экраннан бір басумен, браузер жолағынсыз толық экранда ашылады.
        </p>
        {canPrompt ? (
          <button type="button" onClick={install} className="mt-4 inline-flex items-center gap-2 rounded-[12px] bg-violet-600 px-4 py-2.5 text-sm font-semibold text-white">
            <Download size={16} /> Қосымшаны орнату
          </button>
        ) : ios ? (
          help
        ) : (
          <p className="mt-3 text-sm">
            Телефоныңыздағы Chrome-да сайтты ашып, мәзірден (⋮) <b>«Қолданбаны орнату»</b> / «Басты экранға қосу» таңдаңыз. iPhone-да Safari → «Бөлісу» → «Басты экранға қосу».
          </p>
        )}
      </section>
    );

  return (
    <div className="relative rounded-3xl border border-violet-200 bg-violet-50 p-5 pr-12">
      <button type="button" onClick={hide} aria-label="Жабу" className="absolute top-3 right-3 rounded-full p-1.5 text-slate-500 hover:bg-white">
        <X size={16} />
      </button>
      <div className="flex flex-wrap items-center gap-4">
        <img src="/icons/icon-192.png" alt="" className="h-12 w-12 rounded-xl border border-slate-200" />
        <div className="min-w-[200px] flex-1">
          <div className="font-bold">AI Nur-ды телефонға орнатыңыз</div>
          <div className="text-sm text-slate-500">Басты экраннан бір басумен ашылады — қосымша сияқты.</div>
        </div>
        {!iosHelp && (
          <button type="button" onClick={install} className="inline-flex items-center gap-2 rounded-[12px] bg-violet-600 px-4 py-2.5 text-sm font-semibold text-white">
            <Download size={16} /> {canPrompt ? "Орнату" : "Қалай орнатамын?"}
          </button>
        )}
      </div>
      {iosHelp && help}
    </div>
  );
}
