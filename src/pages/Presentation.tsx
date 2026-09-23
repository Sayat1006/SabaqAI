import { ArrowLeft, ArrowRight, Check, ChevronLeft, ChevronRight, Download, Maximize, Pencil, Plus, Save, Sparkles, Trash2, X } from "lucide-react";
import { useCallback, useEffect, useRef, useState } from "react";
import { useLocation } from "react-router-dom";
import { PageHeader } from "../components/PageHeader";
import { SlideEditor } from "../components/SlideEditor";
import { SlideView } from "../components/SlideView";
import { buildLessonPresentation, type LessonPlan } from "../lib/generators";
import { LangPicker } from "../components/LangPicker";
import type { Lang } from "../lib/lang";
import { getPresentation, savePresentation, type SavedPresentation, updatePresentation } from "../lib/projects";
import { blankSlide, finalizeSlide, normalizeSlide, type SlideData, type SlideLayout } from "../lib/slides";
import { generatePresentation, illustrateSlide, illustrateSlides, planToContext, PRESENTATION_STYLES, SLIDE_COUNTS } from "../lib/studio";
import "./presentation.css";
import { scrollToResult } from "../lib/scrollToResult";

interface Deck {
  /** Сақталған жобаның id-і (өңдегенде сол жоба жаңартылады). */
  id?: string;
  title: string;
  style: string;
  topic: string;
  slides: SlideData[];
  subtitle: string;
  lang?: Lang;
}

/** AI қолжетімсіз болса ғана: ҚМЖ-дан қарапайым слайдтар құрастырады. */
function deckFromPlan(plan: LessonPlan): Deck {
  const slides = buildLessonPresentation(plan).map((s) =>
    normalizeSlide(
      s.kind === "content"
        ? { layout: "bullets", heading: s.title, bullets: s.bullets }
        : { layout: s.kind, heading: s.title, subheading: s.bullets.join(" · ") },
    ),
  );
  return { title: plan.topic, topic: plan.topic, style: "minimal", lang: plan.lang, slides, subtitle: `ҚМЖ негізінде · ${slides.length} слайд` };
}

function deckFromSaved(p: SavedPresentation): Deck {
  return { id: p.id, title: p.title, topic: p.topic, style: p.style, lang: p.lang, slides: p.slides.map((s) => normalizeSlide(s as SlideData & Record<string, unknown>)), subtitle: `${p.slides.length} слайд` };
}

function place(i: number, active: number): React.CSSProperties {
  const d = i - active;
  const a = Math.abs(d);
  const base = "translate(-50%,-50%) ";
  if (d === 0) return { transform: `${base}scale(1)`, opacity: 1, zIndex: 10 };
  if (a === 1) return { transform: `${base}translateX(${d * 62}%) scale(.78) rotateY(${d * -30}deg)`, opacity: 0.85, zIndex: 5 };
  if (a === 2) return { transform: `${base}translateX(${d * 52}%) scale(.6) rotateY(${d * -30}deg)`, opacity: 0.4, zIndex: 2 };
  return { transform: `${base}translateX(${d * 45}%) scale(.5)`, opacity: 0, zIndex: 1, pointerEvents: "none" };
}

function chipClass(active: boolean) {
  return `min-h-10 rounded-xl border px-2 py-2.5 text-[13.5px] transition hover:-translate-y-px ${
    active ? "border-fuchsia-500 bg-fuchsia-500 text-white" : "border-slate-200 bg-white text-slate-500 hover:border-fuchsia-500"
  }`;
}

const LAYOUT_LABELS: Record<SlideLayout, string> = {
  title: "Титул",
  bullets: "Тізім",
  image: "Сурет",
  diagram: "Сызба",
  chart: "Диаграмма",
  table: "Кесте",
  two_column: "Екі баған",
  highlight: "Басты ой",
  timeline: "Уақыт сызығы",
  quiz: "Тест сұрағы",
  task: "Тапсырма",
  closing: "Қорытынды",
};

const PHASES = ["Құрылым мен мазмұн жасалуда...", "Сызбалар мен кестелер дайындалуда...", "Тапсырмалар мен тест сұрақтары құрастырылуда..."];

export default function PresentationPage() {
  const location = useLocation();
  const navState = location.state as { plan?: LessonPlan; presentationId?: string } | null;
  const plan = navState?.plan;

  const [deck, setDeck] = useState<Deck | null>(null);
  const [active, setActive] = useState(0);
  const [topic, setTopic] = useState(plan ? `${plan.subject}, ${plan.grade}: ${plan.topic}` : "");
  const [style, setStyle] = useState<string>("minimal");
  const [count, setCount] = useState<number>(10);
  const [withImages, setWithImages] = useState(true);
  const [lang, setLang] = useState<Lang>(plan?.lang ?? "kk");
  const [generating, setGenerating] = useState(false);
  const [phase, setPhase] = useState(0);
  const [pending, setPending] = useState<Set<number>>(new Set());
  const [saveState, setSaveState] = useState<"" | "saving" | "saved">("");
  const [error, setError] = useState("");
  const [presenting, setPresenting] = useState(false);
  const [exporting, setExporting] = useState(false);
  const [editing, setEditing] = useState(false);
  const [dirty, setDirty] = useState(false);
  const [regenIndex, setRegenIndex] = useState<number | null>(null);
  // Слайдтар жылжығанда/өшкенде өңдегішті қайта құру үшін.
  const [structVersion, setStructVersion] = useState(0);
  const busy = generating || pending.size > 0;

  // «Жобалар» тізімінен ашылса, сақталған презентацияны жүктейміз.
  const openedId = navState?.presentationId;
  useEffect(() => {
    if (!openedId) return;
    getPresentation(openedId)
      .then((p) => {
        if (!p) return;
        setDeck(deckFromSaved(p));
        setTopic(p.topic);
        setStyle(p.style);
        setLang(p.lang ?? "kk");
        setSaveState("saved");
      })
      .catch((e) => setError(e instanceof Error ? e.message : "Презентацияны ашу мүмкін болмады."));
  }, [openedId]);

  const runGeneration = useCallback(
    async (theTopic: string, planContext?: string, fallback?: Deck) => {
      setGenerating(true);
    scrollToResult();
      setError("");
      setSaveState("");
      setEditing(false);
      setDirty(false);
      setPhase(0);
      const timer = window.setInterval(() => setPhase((p) => (p + 1) % PHASES.length), 5000);
      let result: { title: string; slides: SlideData[] };
      try {
        result = await generatePresentation(theTopic, style, count, planContext, lang);
      } catch (err) {
        window.clearInterval(timer);
        setGenerating(false);
        if (fallback) {
          setDeck(fallback);
          setError("AI қолжетімсіз болды, сондықтан ҚМЖ-дан қарапайым слайдтар жасалды. Кейінірек «Слайд жасау» арқылы қайталап көріңіз.");
        } else {
          setError(err instanceof Error ? err.message : "Презентация жасау мүмкін болмады.");
        }
        return;
      }
      window.clearInterval(timer);
      setGenerating(false);

      const slides = result.slides;
      setDeck({ title: result.title, topic: theTopic, style, lang, slides, subtitle: `${slides.length} слайд` });
      setActive(0);

      // Иллюстрациялар бірінен соң бірі пайда болады; бәрі біткен соң презентация сақталады.
      if (withImages) {
        const targets = slides.map((s, i) => ((s.layout === "title" || s.layout === "image") && s.image_prompt ? i : -1)).filter((i) => i >= 0).slice(0, 4);
        setPending(new Set(targets));
        await illustrateSlides(slides, style, (index, svg) => {
          slides[index] = { ...slides[index], image_svg: svg };
          setDeck((d) => (d ? { ...d, slides: d.slides.map((s, i) => (i === index ? { ...s, image_svg: svg } : s)) } : d));
          setPending((p) => {
            const next = new Set(p);
            next.delete(index);
            return next;
          });
        });
        setPending(new Set());
      }

      setSaveState("saving");
      try {
        const saved = await savePresentation({ topic: theTopic, style, title: result.title, slides, lang });
        setDeck((d) => (d ? { ...d, id: saved.id } : d));
        setSaveState("saved");
      } catch (err) {
        setSaveState("");
        setError(err instanceof Error ? `Презентация дайын, бірақ сақталмады: ${err.message}` : "Презентация сақталмады.");
      }
    },
    [style, count, withImages, lang],
  );

  // ҚМЖ бетінен «Презентация жасау» басылса — жоспар негізінде бірден генерациялаймыз.
  const startedFromPlan = useRef(false);
  useEffect(() => {
    if (!plan || startedFromPlan.current) return;
    startedFromPlan.current = true;
    void runGeneration(plan.topic, planToContext(plan), deckFromPlan(plan));
  }, [plan, runGeneration]);

  const total = deck?.slides.length ?? 0;
  const go = useCallback((i: number) => setActive(Math.max(0, Math.min(total - 1, i))), [total]);

  useEffect(() => {
    if (!deck) return;
    function onKey(e: KeyboardEvent) {
      const tag = (document.activeElement as HTMLElement | null)?.tagName;
      if (tag === "INPUT" || tag === "TEXTAREA" || tag === "SELECT") return;
      if (e.key === "ArrowRight" || e.key === "PageDown") {
        e.preventDefault();
        setActive((a) => Math.min(total - 1, a + 1));
      }
      if (e.key === "ArrowLeft" || e.key === "PageUp") setActive((a) => Math.max(0, a - 1));
      if (e.key === "Escape") setPresenting(false);
    }
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [deck, total]);

  useEffect(() => {
    if (presenting) document.documentElement.requestFullscreen?.().catch(() => {});
    else if (document.fullscreenElement) document.exitFullscreen().catch(() => {});
  }, [presenting]);

  useEffect(() => {
    const onChange = () => !document.fullscreenElement && setPresenting(false);
    document.addEventListener("fullscreenchange", onChange);
    return () => document.removeEventListener("fullscreenchange", onChange);
  }, []);

  function handleGenerate(e: React.FormEvent) {
    e.preventDefault();
    if (busy) return;
    if (topic.trim().length < 3) {
      setError("Презентация тақырыбын жазыңыз.");
      return;
    }
    void runGeneration(topic.trim(), plan ? planToContext(plan) : undefined);
  }

  // Сақталмаған өзгерістер болса, бетті жапқанда ескертеміз.
  useEffect(() => {
    if (!dirty) return;
    const onLeave = (e: BeforeUnloadEvent) => e.preventDefault();
    window.addEventListener("beforeunload", onLeave);
    return () => window.removeEventListener("beforeunload", onLeave);
  }, [dirty]);

  function changeDeck(fn: (d: Deck) => Deck, structural = false) {
    setDeck((d) => (d ? fn(d) : d));
    setDirty(true);
    setSaveState("");
    if (structural) setStructVersion((v) => v + 1);
  }

  const updateSlide = (index: number, patch: Partial<SlideData>) =>
    changeDeck((d) => ({ ...d, slides: d.slides.map((s, i) => (i === index ? { ...s, ...patch } : s)) }));

  function moveSlide(dir: -1 | 1) {
    const to = active + dir;
    if (!deck || to < 0 || to >= deck.slides.length) return;
    changeDeck((d) => {
      const slides = [...d.slides];
      [slides[active], slides[to]] = [slides[to], slides[active]];
      return { ...d, slides };
    }, true);
    setActive(to);
  }

  function addSlide() {
    changeDeck((d) => ({ ...d, slides: [...d.slides.slice(0, active + 1), blankSlide(), ...d.slides.slice(active + 1)] }), true);
    setActive(active + 1);
  }

  function removeSlide() {
    if (!deck || deck.slides.length <= 1) return;
    if (!window.confirm(`${active + 1}-слайдты өшіру керек пе?`)) return;
    changeDeck((d) => ({ ...d, slides: d.slides.filter((_, i) => i !== active) }), true);
    setActive(Math.max(0, Math.min(active, deck.slides.length - 2)));
  }

  async function regenerateImage() {
    const slide = deck?.slides[active];
    if (!deck || !slide?.image_prompt?.trim()) return;
    const index = active;
    setRegenIndex(index);
    setError("");
    try {
      updateSlide(index, { image_svg: await illustrateSlide(slide.image_prompt.trim(), deck.style) });
    } catch (err) {
      setError(err instanceof Error ? err.message : "Сурет салу мүмкін болмады.");
    } finally {
      setRegenIndex(null);
    }
  }

  async function handleSave() {
    if (!deck) return;
    const slides = deck.slides.map(finalizeSlide);
    const title = deck.title.trim() || deck.topic || "Презентация";
    setSaveState("saving");
    setError("");
    try {
      const data = { topic: deck.topic, style: deck.style, title, slides, lang: deck.lang };
      let id = deck.id;
      if (id) await updatePresentation(id, data);
      else id = (await savePresentation(data)).id;
      setDeck((d) => (d ? { ...d, id, title, slides, subtitle: `${slides.length} слайд` } : d));
      setStructVersion((v) => v + 1);
      setDirty(false);
      setSaveState("saved");
    } catch (err) {
      setSaveState("");
      setError(err instanceof Error ? err.message : "Өзгерістер сақталмады.");
    }
  }

  async function handleExport() {
    if (!deck) return;
    setExporting(true);
    try {
      const { exportSlidesToPptx } = await import("../lib/exportPptx");
      await exportSlidesToPptx(deck.title, deck.slides.map(finalizeSlide), deck.style, deck.lang);
    } finally {
      setExporting(false);
    }
  }

  const current = deck?.slides[active];

  return (
    <div className="mx-auto max-w-[1360px] px-4 py-9 sm:px-10">
      <PageHeader
        crumb="Презентация жасау"
        title="Презентация генераторы"
        subtitle="Тақырыпты жазыңыз — AI иллюстрациялары, сызбалары, кестелері, тапсырмалары мен тест сұрақтары бар әдемі презентация құрастырады. PowerPoint түрінде жүктеуге немесе бірден көрсетуге болады."
      />

      <div className="mt-8 flex flex-wrap items-start gap-7">
        <form
          onSubmit={handleGenerate}
          noValidate
          className="flex w-full flex-col gap-5 rounded-3xl border border-white/70 bg-white/75 p-6 shadow-[0_24px_48px_-30px_rgba(27,26,46,.2)] backdrop-blur-xl lg:sticky lg:top-24 lg:w-[380px]"
        >
          {plan && (
            <div className="rounded-xl bg-fuchsia-100 px-3.5 py-2.5 text-[13px] text-fuchsia-800">
              ҚМЖ негізінде: <b>{plan.topic}</b> — мақсаттары, кезеңдері мен тапсырмалары ескеріледі.
            </div>
          )}
          <LangPicker value={lang} onChange={setLang} />
          <label className="block">
            <span className="mb-2 block text-[13px] font-semibold text-slate-500">Тақырып</span>
            <textarea
              value={topic}
              onChange={(e) => setTopic(e.target.value)}
              maxLength={500}
              rows={3}
              placeholder="мыс.: 7-сынып, биология: өсімдік жасушасының құрылысы"
              className="w-full resize-y rounded-xl border border-slate-200 bg-slate-50 px-3.5 py-3 text-sm outline-none focus:border-fuchsia-500"
            />
          </label>
          <div>
            <span className="mb-2 block text-[13px] font-semibold text-slate-500">Стиль</span>
            <div className="grid grid-cols-2 gap-2">
              {PRESENTATION_STYLES.map((s) => (
                <button key={s.key} type="button" aria-pressed={style === s.key} onClick={() => setStyle(s.key)} className={chipClass(style === s.key)}>
                  {s.label}
                </button>
              ))}
            </div>
          </div>
          <div>
            <span className="mb-2 block text-[13px] font-semibold text-slate-500">Слайд саны</span>
            <div className="grid grid-cols-4 gap-2">
              {SLIDE_COUNTS.map((n) => (
                <button key={n} type="button" aria-pressed={count === n} onClick={() => setCount(n)} className={chipClass(count === n)}>
                  {n}
                </button>
              ))}
            </div>
          </div>
          <label className="flex cursor-pointer items-start gap-2.5 text-sm">
            <input type="checkbox" checked={withImages} onChange={(e) => setWithImages(e.target.checked)} className="mt-0.5 h-4 w-4 accent-fuchsia-500" />
            <span>
              AI иллюстрациялар салу
              <span className="block text-xs text-slate-500">Титул мен суретті слайдтарға (ең көбі 4). Ұзағырақ уақыт алады.</span>
            </span>
          </label>
          {error && <p role="alert" className="rounded-xl bg-rose-50 px-3.5 py-2.5 text-sm text-rose-700">{error}</p>}
          <button
            type="submit"
            disabled={busy}
            className="flex w-full items-center justify-center gap-2.5 rounded-[14px] bg-fuchsia-500 px-5 py-3.5 text-[15px] font-semibold text-white transition hover:-translate-y-0.5 disabled:translate-y-0 disabled:opacity-70"
          >
            <Sparkles size={17} className={busy ? "animate-spin" : ""} />
            {generating ? "Слайдтар жасалуда..." : pending.size ? "Суреттер салынуда..." : "Слайд жасау"}
          </button>
        </form>

        <section id="result" className="min-w-0 flex-[1_1_560px] scroll-mt-28" aria-live="polite">
          {generating ? (
            <div className="flex min-h-[420px] flex-col items-center justify-center gap-3 rounded-3xl border border-slate-200 bg-white p-6 text-center">
              <Sparkles size={34} className="animate-spin text-fuchsia-500" />
              <div className="text-base">{PHASES[phase]}</div>
              <div className="text-[12.5px] text-slate-500">Әдетте 20–60 секунд алады, иллюстрациялар кейін бірінен соң бірі қосылады</div>
            </div>
          ) : !deck ? (
            <div className="flex min-h-[420px] flex-col items-center justify-center gap-3.5 rounded-3xl border-2 border-dashed border-slate-200 p-10 text-center text-slate-500">
              <span className="flex h-[72px] w-[72px] items-center justify-center rounded-[20px] bg-fuchsia-100 text-fuchsia-500">
                <Sparkles size={32} />
              </span>
              <div className="text-base text-slate-900">Тақырыпты жазып, «Слайд жасау» батырмасын басыңыз</div>
              <div className="text-[13.5px]">Иллюстрация, сызба, кесте, тапсырма және тест слайдтары 3D каруселде көрсетіледі.</div>
            </div>
          ) : (
            <div className="flex animate-[fadeUp_.5s_cubic-bezier(.16,1,.3,1)_both] flex-col items-center gap-5">
              <div className="text-center">
                <h2 className="text-[21px] font-bold">{deck.title}</h2>
                <div className="mt-1 flex items-center justify-center gap-2 text-[13.5px] text-slate-500">
                  {deck.subtitle}
                  {pending.size > 0 && <span>· {pending.size} сурет салынуда...</span>}
                  {saveState === "saving" && <span>· сақталуда...</span>}
                  {dirty && saveState !== "saving" && <span className="text-violet-600">· сақталмаған өзгерістер бар</span>}
                  {saveState === "saved" && (
                    <span className="inline-flex items-center gap-1 text-fuchsia-700">
                      · <Check size={14} /> сақталды
                    </span>
                  )}
                </div>
              </div>
              <div className="carousel">
                {deck.slides.map((s, i) => (
                  <button key={i} type="button" aria-label={`${i + 1}-слайд: ${s.heading}`} onClick={() => go(i)} className="slide-btn" style={place(i, active)}>
                    <SlideView slide={s} style={deck.style} lang={deck.lang} index={i} total={total} imagePending={pending.has(i) || regenIndex === i} />
                  </button>
                ))}
              </div>
              <div className="flex items-center gap-4">
                <button type="button" aria-label="Алдыңғы слайд" onClick={() => go(active - 1)} className="flex h-[46px] w-[46px] items-center justify-center rounded-full border border-slate-200 bg-white hover:border-fuchsia-500 hover:bg-fuchsia-100">
                  <ChevronLeft size={18} />
                </button>
                <div className="dots">
                  {deck.slides.map((_, i) => (
                    <button key={i} type="button" aria-label={`${i + 1}-слайдқа өту`} aria-current={i === active} onClick={() => go(i)} className="dot" />
                  ))}
                </div>
                <button type="button" aria-label="Келесі слайд" onClick={() => go(active + 1)} className="flex h-[46px] w-[46px] items-center justify-center rounded-full border border-slate-200 bg-white hover:border-fuchsia-500 hover:bg-fuchsia-100">
                  <ChevronRight size={18} />
                </button>
              </div>
              {current?.notes && (
                <div className="w-full max-w-[720px] rounded-[14px] border border-slate-200 bg-white px-4 py-3.5 text-sm">
                  <b>Мұғалімге жазба:</b> {current.notes}
                </div>
              )}
              <div className="flex flex-wrap justify-center gap-2.5">
                <button type="button" onClick={() => setPresenting(true)} className="inline-flex items-center gap-2 rounded-[14px] bg-fuchsia-500 px-5 py-3 font-semibold text-white">
                  <Maximize size={16} /> Көрсету
                </button>
                <button
                  type="button"
                  onClick={() => setEditing((v) => !v)}
                  disabled={busy}
                  aria-pressed={editing}
                  className={`inline-flex items-center gap-2 rounded-[11px] border px-4 py-2.5 text-sm font-semibold disabled:opacity-60 ${
                    editing ? "border-violet-600 bg-violet-600 text-white" : "border-slate-200 bg-white hover:border-violet-500 hover:text-violet-600"
                  }`}
                >
                  <Pencil size={15} /> {editing ? "Өңдеуді жабу" : "Өңдеу"}
                </button>
                {(dirty || editing) && (
                  <button
                    type="button"
                    onClick={handleSave}
                    disabled={!dirty || saveState === "saving" || regenIndex !== null}
                    className="inline-flex items-center gap-2 rounded-[11px] border border-violet-600 bg-white px-4 py-2.5 text-sm font-semibold text-violet-700 disabled:opacity-50"
                  >
                    <Save size={15} /> {saveState === "saving" ? "Сақталуда..." : "Сақтау"}
                  </button>
                )}
                <button type="button" onClick={handleExport} disabled={exporting || pending.size > 0} className="inline-flex items-center gap-2 rounded-[11px] border border-slate-200 bg-white px-4 py-2.5 text-sm font-semibold hover:border-violet-500 hover:text-violet-600 disabled:opacity-60">
                  <Download size={15} /> {exporting ? "Дайындалуда..." : "PowerPoint (.pptx)"}
                </button>
              </div>

              {editing && current && (
                <div className="w-full rounded-[20px] border border-slate-200 bg-white p-5 shadow-[0_24px_48px_-30px_rgba(27,26,46,.2)]">
                  <label className="mb-4 block">
                    <span className="mb-1.5 block text-[12.5px] font-semibold text-slate-500">Презентация атауы</span>
                    <input
                      value={deck.title}
                      maxLength={300}
                      onChange={(e) => changeDeck((d) => ({ ...d, title: e.target.value }))}
                      className="w-full rounded-xl border border-slate-200 bg-slate-50 px-3 py-2.5 text-sm outline-none focus:border-fuchsia-500"
                    />
                  </label>
                  <div className="mb-4 flex flex-wrap items-center gap-2 border-t border-slate-200 pt-4">
                    <span className="mr-auto text-[15px] font-bold">{active + 1}-слайд</span>
                    <select
                      aria-label="Слайд түрі"
                      value={current.layout}
                      onChange={(e) => updateSlide(active, { layout: e.target.value as SlideLayout })}
                      className="rounded-[10px] border border-slate-200 bg-white px-2.5 py-2 text-[13px]"
                    >
                      {(Object.keys(LAYOUT_LABELS) as SlideLayout[]).map((l) => (
                        <option key={l} value={l}>
                          {LAYOUT_LABELS[l]}
                        </option>
                      ))}
                    </select>
                    <button type="button" onClick={() => moveSlide(-1)} disabled={active === 0} aria-label="Слайдты солға жылжыту" title="Солға жылжыту" className="rounded-[10px] border border-slate-200 p-2 hover:border-violet-500 disabled:opacity-40">
                      <ArrowLeft size={15} />
                    </button>
                    <button type="button" onClick={() => moveSlide(1)} disabled={active === total - 1} aria-label="Слайдты оңға жылжыту" title="Оңға жылжыту" className="rounded-[10px] border border-slate-200 p-2 hover:border-violet-500 disabled:opacity-40">
                      <ArrowRight size={15} />
                    </button>
                    <button type="button" onClick={addSlide} className="inline-flex items-center gap-1.5 rounded-[10px] border border-slate-200 px-3 py-2 text-[13px] font-semibold hover:border-violet-500">
                      <Plus size={15} /> Слайд қосу
                    </button>
                    <button type="button" onClick={removeSlide} disabled={total <= 1} className="inline-flex items-center gap-1.5 rounded-[10px] border border-slate-200 px-3 py-2 text-[13px] font-semibold hover:border-rose-400 hover:text-rose-700 disabled:opacity-40">
                      <Trash2 size={15} /> Өшіру
                    </button>
                  </div>
                  <SlideEditor
                    key={`${active}-${structVersion}-${current.layout}`}
                    slide={current}
                    onChange={(patch) => updateSlide(active, patch)}
                    onRegenerateImage={regenerateImage}
                    imageBusy={regenIndex === active}
                  />
                </div>
              )}

              <div className="mt-2 grid w-full grid-cols-2 gap-3 sm:grid-cols-3 xl:grid-cols-4">
                {deck.slides.map((s, i) => (
                  <button
                    key={i}
                    type="button"
                    onClick={() => go(i)}
                    aria-label={`${i + 1}-слайдты ашу`}
                    className={`thumb rounded-[12px] p-1 transition ${i === active ? "bg-fuchsia-500" : "bg-transparent hover:bg-slate-200"}`}
                  >
                    <SlideView slide={s} style={deck.style} lang={deck.lang} imagePending={pending.has(i)} />
                  </button>
                ))}
              </div>
            </div>
          )}
        </section>
      </div>

      {presenting && deck && current && (
        <div className="present">
          <div className="present-stage">
            <SlideView key={active} slide={current} style={deck.style} lang={deck.lang} index={active} total={total} interactive imagePending={pending.has(active)} />
          </div>
          <div className="flex items-center gap-3 text-[#c7c4da]">
            <button type="button" onClick={() => go(active - 1)} aria-label="Алдыңғы слайд" className="rounded-lg border border-navy-700 p-2">
              <ChevronLeft size={18} />
            </button>
            <span>
              {active + 1} / {total}
            </span>
            <button type="button" onClick={() => go(active + 1)} aria-label="Келесі слайд" className="rounded-lg border border-navy-700 p-2">
              <ChevronRight size={18} />
            </button>
            <button type="button" onClick={() => setPresenting(false)} className="inline-flex items-center gap-1.5 rounded-lg border border-navy-700 px-3 py-2">
              <X size={16} /> Шығу (Esc)
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
