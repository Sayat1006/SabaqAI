import { Check, Copy, ExternalLink, Maximize2, Minimize2, QrCode, X } from "lucide-react";
import { useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { PageHeader } from "../components/PageHeader";
import { QrDialog } from "../components/QrDialog";
import { tr } from "../i18n";
import { GAMES, gameUrl, type Game } from "../lib/games";
import { useFullscreen } from "../lib/useFullscreen";

const ghost =
  "inline-flex items-center gap-2 rounded-[11px] border border-slate-200 bg-surface px-3.5 py-2.5 text-sm font-semibold hover:border-violet-500 hover:text-violet-600";

function Player({ game, onClose }: { game: Game; onClose: () => void }) {
  const { ref, full, toggle } = useFullscreen();
  const [copied, setCopied] = useState(false);
  const [qr, setQr] = useState(false);
  const url = gameUrl(game);

  async function copy() {
    try {
      await navigator.clipboard.writeText(url);
      setCopied(true);
      window.setTimeout(() => setCopied(false), 1800);
    } catch {
      window.prompt(tr("Сілтемені көшіріңіз:"), url);
    }
  }

  return (
    <section className="mt-7">
      <div className="mb-3 flex flex-wrap items-center justify-between gap-3">
        <h2 className="text-xl font-bold">
          {game.emoji} {game.title} <span className="text-base font-semibold text-slate-500">· {tr(game.subject)}, {tr(game.grade)}</span>
        </h2>
        <div className="flex flex-wrap gap-2">
          <button type="button" onClick={toggle} className={ghost}>
            {full ? <Minimize2 size={16} /> : <Maximize2 size={16} />} {tr("Толық экран")}
          </button>
          <button type="button" onClick={() => void copy()} className={ghost}>
            {copied ? <Check size={16} /> : <Copy size={16} />} {copied ? tr("Көшірілді") : tr("Оқушыларға сілтеме")}
          </button>
          <button type="button" onClick={() => setQr(true)} className={ghost}>
            <QrCode size={16} /> QR
          </button>
          <a href={game.src} target="_blank" rel="noreferrer" className={ghost}>
            <ExternalLink size={16} /> {tr("Жаңа бетте")}
          </a>
          <button type="button" onClick={onClose} aria-label={tr("Жабу")} className={ghost}>
            <X size={16} />
          </button>
        </div>
      </div>
      <div ref={ref} className="overflow-hidden rounded-[20px] border border-slate-200 bg-white shadow-[0_24px_48px_-30px_rgba(27,26,46,.25)]">
        <iframe title={game.title} src={game.src} className={`block w-full border-0 ${full ? "h-screen" : "h-[80vh] min-h-[640px]"}`} />
      </div>
      <p className="mt-2 text-[12.5px] text-slate-500">{tr("Оқушылар сілтеме не QR арқылы телефоннан немесе компьютерден жүйеге кірмей ойнай алады.")}</p>
      {qr && <QrDialog url={url} title={game.title} onClose={() => setQr(false)} />}
    </section>
  );
}

/** Оқу ойындары: мұғалім тақтада толық экранмен ашады, оқушыларға сілтеме/QR береді. */
export default function GamesPage() {
  const { id } = useParams();
  const navigate = useNavigate();
  const active = GAMES.find((g) => g.id === id);

  return (
    <div className="mx-auto max-w-[1440px] px-4 py-9 sm:px-10">
      <PageHeader
        crumb={tr("Ойындар")}
        title={tr("Оқу ойындары")}
        subtitle={tr("Сабақта тақырыпты бекітуге арналған интерактивті ойындар. Тақтада толық экранмен ашыңыз немесе оқушыларға сілтеме мен QR-код беріңіз.")}
      />

      {active && <Player game={active} onClose={() => navigate("/games")} />}

      <div className="mt-8 grid gap-5 sm:grid-cols-2 xl:grid-cols-3">
        {GAMES.map((g) => (
          <article key={g.id} className={`flex flex-col gap-3 rounded-[20px] border bg-surface p-6 ${active?.id === g.id ? "border-violet-500" : "border-slate-200"}`}>
            <div className="flex items-center gap-3">
              <span className="flex h-14 w-14 items-center justify-center rounded-[16px] bg-violet-100 text-3xl">{g.emoji}</span>
              <div>
                <h3 className="text-lg font-bold">{g.title}</h3>
                <div className="text-[13px] text-slate-500">
                  {tr(g.subject)} · {tr(g.grade)} · {g.topic}
                </div>
              </div>
            </div>
            <p className="text-sm leading-relaxed text-slate-600">{g.description}</p>
            <div className="flex flex-wrap gap-1.5">
              {g.skills.map((s) => (
                <span key={s} className="rounded-full bg-slate-100 px-2.5 py-1 text-[12px] font-medium text-slate-600">
                  {s}
                </span>
              ))}
            </div>
            <button
              type="button"
              onClick={() => {
                navigate(`/games/${g.id}`);
                window.scrollTo({ top: 0, behavior: "smooth" });
              }}
              className="mt-auto inline-flex items-center justify-center gap-2 rounded-[12px] bg-violet-600 px-4 py-2.5 text-sm font-semibold text-white hover:bg-violet-700"
            >
              ▶ {tr("Ойнау")}
            </button>
          </article>
        ))}
      </div>
    </div>
  );
}
