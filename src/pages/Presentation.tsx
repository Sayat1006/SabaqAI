import { ChevronLeft, ChevronRight, Download, Maximize, Sparkles, X } from "lucide-react";
import { useCallback, useEffect, useMemo, useState } from "react";
import { useLocation } from "react-router-dom";
import { PageHeader } from "../components/PageHeader";
import { buildLessonPresentation, type LessonPlan } from "../lib/generators";
import { getPresentations, savePresentation, type SavedPresentation, type SlideData } from "../lib/projects";
import { generatePresentation, PRESENTATION_STYLES, SLIDE_COUNTS, SLIDE_THEMES } from "../lib/studio";
import "./presentation.css";

interface Deck {
  title: string;
  style: string;
  slides: SlideData[];
  subtitle: string;
}

const blank = { subheading: "", bullets: [], left_title: "", left: [], right_title: "", right: [], highlight: "", notes: "" };

/** ҚМЖ-дан құрылған слайдтарды студияның слайд пішіміне айналдырады. */
function deckFromPlan(plan: LessonPlan): Deck {
  const slides: SlideData[] = buildLessonPresentation(plan).map((s) =>
    s.kind === "content"
      ? { ...blank, layout: "bullets", heading: s.title, bullets: s.bullets }
      : { ...blank, layout: s.kind, heading: s.title, subheading: s.bullets.join(" · ") },
  );
  return { title: plan.topic, style: "minimal", slides, subtitle: `ҚМЖ негізінде · ${slides.length} слайд` };
}

function deckFromSaved(p: SavedPresentation): Deck {
  return { title: p.title, style: p.style, slides: p.slides, subtitle: `${p.slides.length} слайд` };
}

function List({ items, quiz = false }: { items: string[]; quiz?: boolean }) {
  return (
    <ul className={`s-list ${quiz ? "s-quiz" : ""}`}>
      {items.map((b, i) => (
        <li key={i}>{b}</li>
      ))}
    </ul>
  );
}

function Slide({ slide, style, className = "", css }: { slide: SlideData; style: string; className?: string; css?: React.CSSProperties }) {
  const t = SLIDE_THEMES[style] ?? SLIDE_THEMES.minimal;
  const vars = { "--s-bg": t.bg, "--s-ink": t.ink, "--s-accent": t.accent, "--s-accent2": t.accent2, "--s-dark": t.dark } as React.CSSProperties;
  const dark = slide.layout === "title" ? "dark" : slide.layout === "closing" ? "closing" : "";
  const head = (
    <>
      <div className="s-rule" />
      <div className="s-h">{slide.heading}</div>
      {slide.subheading && <div className="s-sub">{slide.subheading}</div>}
    </>
  );
  let body: React.ReactNode;
  if (dark) {
    body = (
      <>
        <div className="s-title">{slide.heading}</div>
        {slide.subheading && <div className="s-sub">{slide.subheading}</div>}
      </>
    );
  } else if (slide.layout === "two_column") {
    body = (
      <>
        {head}
        <div className="s-cols">
          <div>
            <div className="s-col-t" style={{ color: t.accent }}>{slide.left_title}</div>
            <List items={slide.left} />
          </div>
          <div>
            <div className="s-col-t" style={{ color: t.accent2 }}>{slide.right_title}</div>
            <List items={slide.right} />
          </div>
        </div>
      </>
    );
  } else if (slide.layout === "highlight") {
    body = (
      <>
        {head}
        <div className="s-highlight">{slide.highlight}</div>
      </>
    );
  } else {
    body = (
      <>
        {head}
        <List items={slide.bullets} quiz={slide.layout === "quiz"} />
      </>
    );
  }
  return (
    <div className={`slide ${dark} ${className}`} style={{ ...vars, ...css }}>
      <div className="slide-inner">{body}</div>
    </div>
  );
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

export default function PresentationPage() {
  const location = useLocation();
  const navState = location.state as { plan?: LessonPlan; presentationId?: string } | null;

  const initialDeck = useMemo(() => {
    if (navState?.plan) return deckFromPlan(navState.plan);
    const saved = navState?.presentationId && getPresentations().find((p) => p.id === navState.presentationId);
    return saved ? deckFromSaved(saved) : null;
  }, [navState]);

  const [deck, setDeck] = useState<Deck | null>(initialDeck);
  const [active, setActive] = useState(0);
  const [topic, setTopic] = useState(navState?.plan ? `${navState.plan.subject}, ${navState.plan.grade}: ${navState.plan.topic}` : "");
  const [style, setStyle] = useState<string>("minimal");
  const [count, setCount] = useState<number>(8);
  const [generating, setGenerating] = useState(false);
  const [error, setError] = useState("");
  const [presenting, setPresenting] = useState(false);
  const [exporting, setExporting] = useState(false);

  const total = deck?.slides.length ?? 0;
  const go = useCallback((i: number) => setActive(Math.max(0, Math.min(total - 1, i))), [total]);

  useEffect(() => {
    if (!deck) return;
    function onKey(e: KeyboardEvent) {
      const tag = (document.activeElement as HTMLElement | null)?.tagName;
      if (tag === "INPUT" || tag === "TEXTAREA" || tag === "SELECT") return;
      if (e.key === "ArrowRight" || (e.key === " " && presenting)) {
        e.preventDefault();
        setActive((a) => Math.min(total - 1, a + 1));
      }
      if (e.key === "ArrowLeft") setActive((a) => Math.max(0, a - 1));
      if (e.key === "Escape") setPresenting(false);
    }
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [deck, presenting, total]);

  useEffect(() => {
    if (presenting) document.documentElement.requestFullscreen?.().catch(() => {});
    else if (document.fullscreenElement) document.exitFullscreen().catch(() => {});
  }, [presenting]);

  useEffect(() => {
    const onChange = () => !document.fullscreenElement && setPresenting(false);
    document.addEventListener("fullscreenchange", onChange);
    return () => document.removeEventListener("fullscreenchange", onChange);
  }, []);

  async function handleGenerate(e: React.FormEvent) {
    e.preventDefault();
    if (topic.trim().length < 3) {
      setError("Презентация тақырыбын жазыңыз.");
      return;
    }
    setGenerating(true);
    setError("");
    try {
      const result = await generatePresentation(topic.trim(), style, count);
      const saved = savePresentation({ topic: topic.trim(), style, title: result.title, slides: result.slides });
      setDeck(deckFromSaved(saved));
      setActive(0);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Презентация жасау мүмкін болмады.");
    } finally {
      setGenerating(false);
    }
  }

  async function handleExport() {
    if (!deck) return;
    setExporting(true);
    try {
      const { exportSlidesToPptx } = await import("../lib/exportPptx");
      await exportSlidesToPptx(deck.title, deck.slides, deck.style);
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
        subtitle="Тақырыпты жазып, стилін таңдаңыз — слайдтарды каруселден қарап, PowerPoint түрінде жүктеп алыңыз немесе бірден көрсетіңіз. Дайын ҚМЖ-дан да презентация жасауға болады."
      />

      <div className="mt-8 flex flex-wrap items-start gap-7">
        <form
          onSubmit={handleSubmitGuard(handleGenerate, generating)}
          noValidate
          className="flex w-full flex-col gap-5 rounded-3xl border border-white/70 bg-white/75 p-6 shadow-[0_24px_48px_-30px_rgba(27,26,46,.2)] backdrop-blur-xl lg:sticky lg:top-6 lg:w-[380px]"
        >
          <label className="block">
            <span className="mb-2 block text-[13px] font-semibold text-slate-500">Тақырып</span>
            <textarea
              value={topic}
              onChange={(e) => setTopic(e.target.value)}
              maxLength={500}
              rows={3}
              placeholder="мыс.: 5-сынып, математика: жай бөлшектер — анықтамасы, мысалдары және салыстыру тәсілдері"
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
          {error && <p role="alert" className="rounded-xl bg-rose-50 px-3.5 py-2.5 text-sm text-rose-700">{error}</p>}
          <button
            type="submit"
            disabled={generating}
            className="flex w-full items-center justify-center gap-2.5 rounded-[14px] bg-fuchsia-500 px-5 py-3.5 text-[15px] font-semibold text-white transition hover:-translate-y-0.5 disabled:translate-y-0 disabled:opacity-70"
          >
            <Sparkles size={17} className={generating ? "animate-spin" : ""} />
            {generating ? "Слайдтар жасалуда..." : "Слайд жасау"}
          </button>
        </form>

        <section className="min-w-0 flex-[1_1_560px]" aria-live="polite">
          {generating ? (
            <div className="flex min-h-[420px] flex-col items-center justify-center gap-3 rounded-3xl border border-slate-200 bg-white">
              <Sparkles size={34} className="animate-spin text-fuchsia-500" />
              <div className="text-base">Слайдтар құрастырылуда...</div>
              <div className="text-[12.5px] text-slate-500">Әдетте 10–40 секунд алады</div>
            </div>
          ) : !deck ? (
            <div className="flex min-h-[420px] flex-col items-center justify-center gap-3.5 rounded-3xl border-2 border-dashed border-slate-200 p-10 text-center text-slate-500">
              <span className="flex h-[72px] w-[72px] items-center justify-center rounded-[20px] bg-fuchsia-100 text-fuchsia-500">
                <Sparkles size={32} />
              </span>
              <div className="text-base text-slate-900">Тақырыпты жазып, «Слайд жасау» батырмасын басыңыз</div>
              <div className="text-[13.5px]">Слайдтар осы жерде 3D каруселде көрсетіледі.</div>
            </div>
          ) : (
            <div className="flex animate-[fadeUp_.5s_cubic-bezier(.16,1,.3,1)_both] flex-col items-center gap-5">
              <div className="text-center">
                <h2 className="text-[21px] font-bold">{deck.title}</h2>
                <div className="mt-1 text-[13.5px] text-slate-500">{deck.subtitle}</div>
              </div>
              <div className="carousel">
                {deck.slides.map((s, i) => (
                  <button
                    key={i}
                    type="button"
                    aria-label={`${i + 1}-слайд: ${s.heading}`}
                    onClick={() => go(i)}
                    className="slide-btn"
                    style={place(i, active)}
                  >
                    <Slide slide={s} style={deck.style} />
                  </button>
                ))}
              </div>
              <div className="flex items-center gap-4">
                <button type="button" aria-label="Алдыңғы слайд" onClick={() => go(active - 1)} className="flex h-[46px] w-[46px] items-center justify-center rounded-full border border-slate-200 bg-white hover:border-fuchsia-500 hover:bg-fuchsia-100">
                  <ChevronLeft size={18} />
                </button>
                <div className="flex max-w-[360px] flex-wrap justify-center gap-1">
                  {deck.slides.map((_, i) => (
                    <button key={i} type="button" aria-label={`${i + 1}-слайдқа өту`} aria-current={i === active} onClick={() => go(i)} className="dot" />
                  ))}
                </div>
                <button type="button" aria-label="Келесі слайд" onClick={() => go(active + 1)} className="flex h-[46px] w-[46px] items-center justify-center rounded-full border border-slate-200 bg-white hover:border-fuchsia-500 hover:bg-fuchsia-100">
                  <ChevronRight size={18} />
                </button>
              </div>
              <div className="text-[13px] text-slate-500">
                Слайд {active + 1} / {total}
              </div>
              {current?.notes && (
                <div className="w-full max-w-[720px] rounded-[14px] border border-slate-200 bg-white px-4.5 py-3.5 text-sm">
                  <b>Мұғалімге жазба:</b> {current.notes}
                </div>
              )}
              <div className="flex flex-wrap justify-center gap-2.5">
                <button type="button" onClick={() => setPresenting(true)} className="inline-flex items-center gap-2 rounded-[14px] bg-fuchsia-500 px-5 py-3 font-semibold text-white">
                  <Maximize size={16} /> Көрсету
                </button>
                <button type="button" onClick={handleExport} disabled={exporting} className="inline-flex items-center gap-2 rounded-[11px] border border-slate-200 bg-white px-4 py-2.5 text-sm font-semibold hover:border-violet-500 hover:text-violet-600">
                  <Download size={15} /> {exporting ? "Дайындалуда..." : "PowerPoint (.pptx)"}
                </button>
              </div>
            </div>
          )}
        </section>
      </div>

      {presenting && deck && current && (
        <div className="fixed inset-0 z-[300] flex flex-col items-center justify-center gap-4 bg-[#0e1320] p-4">
          <button type="button" className="present-stage" onClick={() => go(active + 1)} aria-label="Келесі слайд">
            <Slide slide={current} style={deck.style} />
          </button>
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

/** Генерация жүріп жатқанда форманы қайта жібермейміз. */
function handleSubmitGuard(fn: (e: React.FormEvent) => void, busy: boolean) {
  return (e: React.FormEvent) => {
    if (busy) {
      e.preventDefault();
      return;
    }
    fn(e);
  };
}
