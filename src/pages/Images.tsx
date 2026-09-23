import { ArrowRight, Download, Sparkles, Trash2, X } from "lucide-react";
import { useEffect, useState } from "react";
import { useLocation } from "react-router-dom";
import { PageHeader } from "../components/PageHeader";
import { downloadBlob } from "../lib/downloadBlob";
import { deleteProject, getImages, saveImage, svgDataUrl, type SavedImage } from "../lib/projects";
import { useLoad } from "../lib/useLoad";
import { generateIllustration, IMAGE_STYLES } from "../lib/studio";

const safeName = (s: string) => s.replace(/[\\/:*?"<>|]+/g, " ").trim() || "ai-nur";

/** SVG-ді браузерде растрлайды: мұғалім PNG-ні Word-қа не слайдқа қоя алады. */
async function downloadPng(img: SavedImage) {
  const el = new Image();
  el.src = svgDataUrl(img.svg);
  await el.decode();
  const canvas = document.createElement("canvas");
  canvas.width = 1600;
  canvas.height = 1200;
  canvas.getContext("2d")!.drawImage(el, 0, 0, canvas.width, canvas.height);
  const blob = await new Promise<Blob | null>((resolve) => canvas.toBlob(resolve, "image/png"));
  if (blob) downloadBlob(blob, `${safeName(img.title)}.png`);
}

function downloadSvg(img: SavedImage) {
  downloadBlob(new Blob([img.svg], { type: "image/svg+xml" }), `${safeName(img.title)}.svg`);
}

export default function ImagesPage() {
  const location = useLocation();
  const { data, setData: setImages, error: loadError, loading } = useLoad(getImages);
  const images = data ?? [];
  const [prompt, setPrompt] = useState("");
  const [style, setStyle] = useState<string>(IMAGE_STYLES[0].key);
  const [generating, setGenerating] = useState(false);
  const [error, setError] = useState("");
  const [viewing, setViewing] = useState<SavedImage | null>(null);

  // «Жобалар» тізімінен ашылса, сол суретті үлкейтіп көрсетеміз.
  const openedId = (location.state as { imageId?: string } | null)?.imageId;
  useEffect(() => {
    const found = openedId && data?.find((i) => i.id === openedId);
    // eslint-disable-next-line react/set-state-in-effect -- жүктелген тізімнен бір рет ашу
    if (found) setViewing(found);
  }, [openedId, data]);

  useEffect(() => {
    if (!viewing) return;
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && setViewing(null);
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [viewing]);

  async function handleGenerate(e: React.FormEvent) {
    e.preventDefault();
    if (generating) return;
    if (prompt.trim().length < 3) {
      setError("Иллюстрация сипаттамасын жазыңыз.");
      return;
    }
    setGenerating(true);
    setError("");
    try {
      const result = await generateIllustration(prompt.trim(), style);
      const saved = await saveImage({ prompt: prompt.trim(), style, styleLabel: result.styleLabel, title: result.title, svg: result.svg });
      setImages([saved, ...images]);
      setPrompt("");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Сурет жасау мүмкін болмады.");
    } finally {
      setGenerating(false);
    }
  }

  async function handleDelete(img: SavedImage) {
    if (!window.confirm(`«${img.title}» суретін жоясыз ба?`)) return;
    try {
      await deleteProject(img.id);
      setImages(images.filter((i) => i.id !== img.id));
      if (viewing?.id === img.id) setViewing(null);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Жою мүмкін болмады.");
    }
  }

  return (
    <div className="mx-auto max-w-[1360px] px-4 py-9 sm:px-10">
      <PageHeader
        crumb="Сурет генерациясы"
        title="Сабаққа арналған иллюстрациялар"
        subtitle="Сипаттама мен стильді таңдаңыз — AI векторлық (SVG) иллюстрация салады. Суретті SVG немесе PNG түрінде жүктеп, слайдқа не жұмыс парағына қоя аласыз."
      />

      <form
        onSubmit={handleGenerate}
        noValidate
        className="mt-7 flex flex-col gap-4 rounded-3xl border border-white/70 bg-white/75 p-5.5 shadow-[0_24px_48px_-30px_rgba(27,26,46,.2)] backdrop-blur-xl sm:p-6"
      >
        <div className="flex flex-wrap gap-3">
          <label className="flex min-h-[52px] flex-[1_1_420px] items-center gap-2.5 rounded-[14px] border border-slate-200 bg-white px-4 focus-within:border-violet-500">
            <Sparkles size={17} className="text-slate-500" />
            <span className="sr-only">Иллюстрация сипаттамасы</span>
            <input
              value={prompt}
              onChange={(e) => setPrompt(e.target.value)}
              maxLength={400}
              placeholder="Иллюстрация сипаттамасын жазыңыз (мыс.: «жасыл жапырақ фотосинтезі»)"
              className="flex-1 bg-transparent py-3.5 text-[15px] outline-none"
            />
          </label>
          <button
            type="submit"
            disabled={generating}
            className="inline-flex items-center justify-center gap-2.5 rounded-[14px] bg-violet-600 px-6 py-3.5 text-[15px] font-semibold text-white transition hover:-translate-y-0.5 disabled:translate-y-0 disabled:opacity-70"
          >
            {generating ? <Sparkles size={16} className="animate-spin" /> : <ArrowRight size={16} />}
            {generating ? "Салынуда..." : "Генерациялау"}
          </button>
        </div>
        <div role="group" aria-label="Стиль" className="flex flex-wrap gap-2">
          {IMAGE_STYLES.map((s) => (
            <button
              key={s.key}
              type="button"
              aria-pressed={style === s.key}
              onClick={() => setStyle(s.key)}
              className={`min-h-10 rounded-full border px-4 py-2 text-[13.5px] transition ${
                style === s.key ? "border-violet-600 bg-violet-600 text-white" : "border-slate-200 bg-white text-slate-500 hover:border-violet-500"
              }`}
            >
              {s.label}
            </button>
          ))}
        </div>
        {error && <p role="alert" className="rounded-xl bg-rose-50 px-3.5 py-2.5 text-sm text-rose-700">{error}</p>}
      </form>

      <div className="mt-9 flex items-center justify-between">
        <h2 className="text-xl font-bold">Менің суреттерім</h2>
        {images.length > 0 && <span className="text-[13.5px] text-slate-500">{images.length} сурет</span>}
      </div>

      <div className="mt-6 grid grid-cols-[repeat(auto-fill,minmax(250px,1fr))] gap-5" aria-live="polite">
        {generating && (
          <article className="overflow-hidden rounded-[20px] border border-slate-200 bg-white">
            <div className="flex aspect-[4/3] flex-col items-center justify-center gap-2.5 bg-slate-50">
              <Sparkles size={28} className="animate-spin text-violet-500" />
              <div className="text-[13.5px] text-slate-500">Сурет салынуда...</div>
            </div>
            <div className="border-t border-slate-200 px-4 py-3.5 font-bold">{prompt.slice(0, 50)}</div>
          </article>
        )}
        {loadError && (
          <div role="alert" className="col-span-full rounded-[18px] border border-rose-200 bg-rose-50 p-5 text-rose-700">{loadError}</div>
        )}
        {loading && !loadError && (
          <div className="col-span-full rounded-[18px] border border-slate-200 bg-white p-7 text-center text-slate-500">Жүктелуде...</div>
        )}
        {!loading && !loadError && images.length === 0 && !generating && (
          <div className="col-span-full rounded-[18px] border border-slate-200 bg-white p-7 text-center text-slate-500">
            Әзірге сурет жоқ. Жоғарыда сипаттама жазып, алғашқы иллюстрацияңызды жасаңыз.
          </div>
        )}
        {images.map((img, i) => (
          <article
            key={img.id}
            style={{ animationDelay: `${Math.min(i, 10) * 0.04}s` }}
            className="flex animate-[fadeUp_.5s_cubic-bezier(.16,1,.3,1)_both] flex-col overflow-hidden rounded-[20px] border border-slate-200 bg-white transition hover:-translate-y-1 hover:shadow-[0_20px_36px_-20px_rgba(27,26,46,.25)]"
          >
            <button type="button" onClick={() => setViewing(img)} aria-label={`Үлкейту: ${img.title}`} className="block aspect-[4/3] w-full cursor-zoom-in bg-slate-50">
              <img src={svgDataUrl(img.svg)} alt={img.title} loading="lazy" className="h-full w-full object-contain" />
            </button>
            <div className="flex items-center justify-between gap-2.5 border-t border-slate-200 px-4 py-3.5">
              <div className="min-w-0">
                <div className="truncate text-[15px] font-bold">{img.title}</div>
                <div className="text-[12.5px] text-slate-500">{img.styleLabel}</div>
              </div>
              <div className="flex gap-1">
                <button type="button" onClick={() => downloadPng(img)} aria-label="PNG жүктеу" title="PNG жүктеу" className="flex h-9 w-9 items-center justify-center rounded-[10px] border border-slate-200 hover:border-violet-500 hover:text-violet-600">
                  <Download size={15} />
                </button>
                <button type="button" onClick={() => handleDelete(img)} aria-label="Жою" title="Жою" className="flex h-9 w-9 items-center justify-center rounded-[10px] border border-slate-200 hover:border-rose-600 hover:text-rose-700">
                  <Trash2 size={15} />
                </button>
              </div>
            </div>
          </article>
        ))}
      </div>

      {viewing && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-navy-900/45 p-4" onClick={(e) => e.target === e.currentTarget && setViewing(null)}>
          <div role="dialog" aria-modal="true" aria-label={viewing.title} className="flex max-h-[calc(100vh-32px)] w-full max-w-[760px] animate-[fadeUp_.35s_cubic-bezier(.16,1,.3,1)_both] flex-col gap-3.5 overflow-auto rounded-[22px] bg-white p-7">
            <img src={svgDataUrl(viewing.svg)} alt={viewing.title} className="w-full rounded-[14px] bg-slate-50" />
            <div>
              <h2 className="text-[21px] font-bold">{viewing.title}</h2>
              <div className="mt-1 text-[13.5px] text-slate-500">{viewing.prompt}</div>
            </div>
            <div className="flex flex-wrap justify-end gap-2.5">
              <button type="button" onClick={() => downloadSvg(viewing)} className="inline-flex items-center gap-2 rounded-[11px] border border-slate-200 px-3.5 py-2.5 text-sm font-semibold hover:border-violet-500">
                <Download size={15} /> SVG
              </button>
              <button type="button" onClick={() => downloadPng(viewing)} className="inline-flex items-center gap-2 rounded-[11px] border border-slate-200 px-3.5 py-2.5 text-sm font-semibold hover:border-violet-500">
                <Download size={15} /> PNG
              </button>
              <button type="button" onClick={() => setViewing(null)} className="inline-flex items-center gap-2 rounded-[14px] bg-violet-600 px-5 py-2.5 font-semibold text-white">
                <X size={15} /> Жабу
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
