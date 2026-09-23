import { ArrowLeft, ArrowRight, Eye, Flag, Maximize, Minimize, Play, Trophy, Users } from "lucide-react";
import QRCode from "qrcode";
import { useCallback, useEffect, useRef, useState } from "react";
import { Link, useParams } from "react-router-dom";
import { Logo } from "../components/Logo";
import { getHostState, getLiveGame, LIVE_TEXT, liveControl, liveJoinUrl, LiveError, OPTION_STYLES, type HostState, type LiveGame } from "../lib/live";
import { useFullscreen } from "../lib/useFullscreen";

// Мұғалімнің тақтаға (проекторға) шығаратын экраны: кіру коды, сұрақтар, уақыт,
// жауаптар таралуы және көшбасшылар кестесі.

const primary = "inline-flex items-center justify-center gap-2 rounded-2xl bg-violet-600 px-6 py-3.5 text-lg font-bold text-white shadow-[0_14px_26px_-12px_rgba(184,90,42,.55)] transition hover:-translate-y-0.5 disabled:opacity-60";
const ghost = "inline-flex items-center justify-center gap-2 rounded-2xl border border-slate-200 bg-white px-4 py-3 text-sm font-semibold hover:border-violet-500";

export default function LiveHostPage() {
  const { id = "" } = useParams();
  const { ref, full, toggle } = useFullscreen();
  const [game, setGame] = useState<LiveGame | null>(null);
  const [hs, setHs] = useState<HostState | null>(null);
  const [error, setError] = useState("");
  const [qr, setQr] = useState("");
  const [busy, setBusy] = useState(false);
  const [left, setLeft] = useState<number | null>(null);
  const deadline = useRef<number | null>(null);
  const autoRevealed = useRef(-1);

  useEffect(() => {
    getLiveGame(id)
      .then((g) => {
        if (!g) return setError("Ойын табылмады.");
        setGame(g);
        void QRCode.toDataURL(liveJoinUrl(g.code), { width: 360, margin: 1 }).then(setQr);
      })
      .catch((e) => setError(e instanceof Error ? e.message : "Ойынды ашу мүмкін болмады."));
  }, [id]);

  // Күйді секунд сайын сұраймыз.
  const refresh = useCallback(async () => {
    try {
      const s = await getHostState(id);
      setHs(s);
      if (s.state === "question" && s.remaining !== null) deadline.current = Date.now() + s.remaining * 1000;
      else deadline.current = null;
      setError("");
    } catch (e) {
      if (e instanceof LiveError && e.code === "network") return;
      setError(e instanceof Error ? e.message : "Байланыс үзілді.");
    }
  }, [id]);

  useEffect(() => {
    let alive = true;
    let timer = 0;
    const loop = async () => {
      await refresh();
      if (alive) timer = window.setTimeout(loop, 1000);
    };
    void loop();
    return () => {
      alive = false;
      window.clearTimeout(timer);
    };
  }, [refresh]);


  const act = useCallback(
    async (action: "next" | "reveal" | "finish") => {
      setBusy(true);
      try {
        await liveControl(id, action);
        await refresh();
      } catch (e) {
        setError(e instanceof Error ? e.message : "Әрекет орындалмады.");
      } finally {
        setBusy(false);
      }
    },
    [id, refresh],
  );

  const players = hs?.players.length ?? 0;
  const answeredCount = hs?.answers.length ?? 0;

  // Кері санақты жергілікті түрде жұмсақ жаңартамыз. Уақыт біткенде немесе бәрі
  // жауап бергенде жауапты өзі көрсетеді.
  const latest = useRef({ hs, act });
  useEffect(() => {
    latest.current = { hs, act };
  });
  useEffect(() => {
    const t = window.setInterval(() => {
      const rest = deadline.current === null ? null : Math.max(0, Math.ceil((deadline.current - Date.now()) / 1000));
      setLeft(rest);
      const { hs: s, act: run } = latest.current;
      if (!s || s.state !== "question" || autoRevealed.current === s.current) return;
      if (rest === 0 || (s.players.length > 0 && s.answers.length >= s.players.length)) {
        autoRevealed.current = s.current;
        void run("reveal");
      }
    }, 200);
    return () => window.clearInterval(t);
  }, []);

  const T = LIVE_TEXT[game?.lang ?? "kk"];
  const q = game && hs && hs.current >= 0 ? game.questions[hs.current] : null;
  const last = hs ? hs.current + 1 >= hs.total : false;

  if (error && !game) {
    return (
      <div className="flex min-h-screen flex-col items-center justify-center gap-4 p-6 text-center">
        <p className="rounded-2xl bg-rose-50 px-5 py-4 text-rose-700">{error}</p>
        <Link to="/tests" className={ghost}>
          <ArrowLeft size={16} /> Тапсырмаларға оралу
        </Link>
      </div>
    );
  }
  if (!game || !hs) return <div className="flex min-h-screen items-center justify-center text-slate-500">Жүктелуде...</div>;

  const dist = q ? q.options.map((_, i) => hs.answers.filter((a) => a.choice === i).length) : [];
  const maxDist = Math.max(1, ...dist);

  return (
    <div ref={ref} className="flex min-h-screen flex-col bg-slate-50">
      <header className="flex flex-wrap items-center justify-between gap-3 border-b border-slate-200 bg-white px-4 py-3 sm:px-8">
        <div className="flex min-w-0 items-center gap-3">
          <Logo className="h-9 w-9" />
          <div className="min-w-0">
            <div className="text-xs font-semibold tracking-wide text-violet-600 uppercase">{T.liveQuiz}</div>
            <div className="truncate font-bold">{game.title}</div>
          </div>
        </div>
        <div className="flex items-center gap-2">
          {hs.state !== "lobby" && (
            <span className="rounded-xl bg-slate-100 px-3 py-2 text-sm font-semibold">
              {T.code}: <b className="tracking-widest">{hs.code}</b>
            </span>
          )}
          <span className="inline-flex items-center gap-1.5 rounded-xl bg-slate-100 px-3 py-2 text-sm font-semibold">
            <Users size={15} /> {players}
          </span>
          <button type="button" onClick={toggle} className={ghost} aria-label={full ? "Толық экраннан шығу" : "Толық экран"}>
            {full ? <Minimize size={16} /> : <Maximize size={16} />}
          </button>
          {hs.state !== "finished" && (
            <button type="button" onClick={() => window.confirm("Ойынды аяқтау керек пе?") && void act("finish")} className={ghost}>
              <Flag size={15} /> <span className="hidden sm:inline">{T.endGame}</span>
            </button>
          )}
        </div>
      </header>

      {error && <p className="mx-auto mt-3 rounded-xl bg-rose-50 px-4 py-2 text-sm text-rose-700">{error}</p>}

      <main className="mx-auto flex w-full max-w-[1200px] flex-1 flex-col gap-6 px-4 py-6 sm:px-8">
        {hs.state === "lobby" && (
          <div className="grid flex-1 items-center gap-8 lg:grid-cols-[1.1fr_1fr]">
            <div className="flex flex-col items-center gap-4 rounded-[28px] border border-slate-200 bg-white p-8 text-center">
              <div className="text-lg text-slate-500">{T.goTo}</div>
              <div className="text-2xl font-bold break-all text-violet-700 sm:text-3xl">{liveJoinUrl().replace(/^https?:\/\//, "")}</div>
              <div className="text-sm tracking-wide text-slate-500 uppercase">{T.code}</div>
              <div className="font-mono text-6xl font-bold tracking-[0.2em] sm:text-8xl">{hs.code}</div>
              {qr && <img src={qr} alt="QR" className="mt-2 h-44 w-44 rounded-xl border border-slate-200 sm:h-52 sm:w-52" />}
              <div className="text-sm text-slate-500">{T.orScan}</div>
            </div>
            <div className="flex flex-col gap-4">
              <div className="flex items-center justify-between">
                <h2 className="text-2xl font-bold">
                  {T.players}: {players}
                </h2>
              </div>
              <div className="flex min-h-[160px] flex-wrap content-start gap-2 rounded-[22px] border border-dashed border-slate-300 bg-white/60 p-4">
                {players === 0 ? (
                  <span className="m-auto animate-pulse text-slate-500">{T.waitingPlayers}</span>
                ) : (
                  hs.players.map((p) => (
                    <span key={p.id} className="animate-[fadeUp_.4s_both] rounded-full bg-violet-100 px-4 py-2 text-lg font-semibold text-violet-800">
                      {p.name}
                    </span>
                  ))
                )}
              </div>
              <button type="button" onClick={() => void act("next")} disabled={busy} className={primary}>
                <Play size={20} /> {T.start}
              </button>
              <p className="text-sm text-slate-500">{T.hint(hs.total, hs.timeLimit)}</p>
            </div>
          </div>
        )}

        {(hs.state === "question" || hs.state === "reveal") && q && (
          <div className="flex flex-1 flex-col gap-5">
            <div className="flex items-center justify-between gap-3">
              <span className="rounded-full bg-white px-4 py-2 text-sm font-bold shadow-sm">
                {T.question} {hs.current + 1} / {hs.total}
              </span>
              {hs.state === "question" ? (
                <span
                  className={`flex h-16 w-16 items-center justify-center rounded-full text-2xl font-bold text-white tabular-nums ${left !== null && left <= 5 ? "animate-pulse bg-rose-500" : "bg-violet-600"}`}
                  aria-label="Қалған уақыт"
                >
                  {left ?? hs.timeLimit}
                </span>
              ) : (
                <span className="rounded-full bg-emerald-100 px-4 py-2 text-sm font-bold text-emerald-800">✓ {T.correctWas}</span>
              )}
              <span className="rounded-full bg-white px-4 py-2 text-sm font-bold shadow-sm">
                {answeredCount} / {players} {T.answered}
              </span>
            </div>

            <h1 className="rounded-[26px] border border-slate-200 bg-white px-6 py-8 text-center text-2xl leading-snug font-bold sm:text-4xl">{q.question}</h1>

            <div className="grid gap-3 sm:grid-cols-2">
              {q.options.map((o, i) => {
                const st = OPTION_STYLES[i % OPTION_STYLES.length];
                const isCorrect = i === q.correctIndex;
                const dim = hs.state === "reveal" && !isCorrect;
                return (
                  <div key={i} className={`relative flex items-center gap-4 overflow-hidden rounded-2xl px-5 py-5 text-white transition ${st.bg} ${dim ? "opacity-35" : ""}`}>
                    <span className="text-3xl" aria-hidden>
                      {st.shape}
                    </span>
                    <span className="flex-1 text-xl font-bold sm:text-2xl">{o}</span>
                    {hs.state === "reveal" && (
                      <span className="flex items-center gap-2 text-xl font-bold">
                        {isCorrect && "✓"} {dist[i]}
                      </span>
                    )}
                  </div>
                );
              })}
            </div>

            {hs.state === "reveal" && (
              <div className="grid gap-5 lg:grid-cols-2">
                <div className="flex h-44 items-end justify-around gap-3 rounded-[22px] border border-slate-200 bg-white p-5" aria-label="Жауаптар таралуы">
                  {dist.map((n, i) => (
                    <div key={i} className="flex h-full flex-1 flex-col items-center justify-end gap-1">
                      <span className="text-sm font-bold">{n}</span>
                      <div className={`w-full rounded-t-lg ${OPTION_STYLES[i % OPTION_STYLES.length].bg}`} style={{ height: `${(n / maxDist) * 100}%`, minHeight: 4 }} />
                      <span className="text-sm">{OPTION_STYLES[i % OPTION_STYLES.length].shape}</span>
                    </div>
                  ))}
                </div>
                <Leaderboard hs={hs} title={T.leaderboard} points={T.points} limit={5} />
              </div>
            )}

            <div className="mt-auto flex justify-end gap-2">
              {hs.state === "question" ? (
                <button type="button" onClick={() => void act("reveal")} disabled={busy} className={ghost}>
                  <Eye size={16} /> {T.showAnswer}
                </button>
              ) : (
                <button type="button" onClick={() => void act("next")} disabled={busy} className={primary}>
                  {last ? (
                    <>
                      <Trophy size={20} /> {T.results}
                    </>
                  ) : (
                    <>
                      {T.next} <ArrowRight size={20} />
                    </>
                  )}
                </button>
              )}
            </div>
          </div>
        )}

        {hs.state === "finished" && (
          <div className="flex flex-1 flex-col items-center gap-8">
            <h1 className="text-center text-4xl font-bold">🏆 {T.finished}</h1>
            <Podium hs={hs} points={T.points} />
            <div className="w-full max-w-[640px]">
              <Leaderboard hs={hs} title={T.results} points={T.points} />
            </div>
            <Link to="/tests" className={ghost}>
              <ArrowLeft size={16} /> Тапсырмаларға оралу
            </Link>
          </div>
        )}
      </main>
    </div>
  );
}

function Leaderboard({ hs, title, points, limit }: { hs: HostState; title: string; points: string; limit?: number }) {
  const rows = limit ? hs.players.slice(0, limit) : hs.players;
  return (
    <div className="rounded-[22px] border border-slate-200 bg-white p-5">
      <h2 className="mb-3 text-lg font-bold">{title}</h2>
      {rows.length === 0 ? (
        <p className="text-sm text-slate-500">—</p>
      ) : (
        <ol className="flex flex-col gap-1.5">
          {rows.map((p, i) => (
            <li key={p.id} className="flex items-center gap-3 rounded-xl px-2 py-1.5 odd:bg-slate-50">
              <span className="w-7 text-center font-bold text-slate-500">{i + 1}</span>
              <span className="flex-1 truncate font-semibold">{p.name}</span>
              <span className="font-bold tabular-nums">
                {p.score} <span className="text-xs font-normal text-slate-500">{points}</span>
              </span>
            </li>
          ))}
        </ol>
      )}
    </div>
  );
}

function Podium({ hs, points }: { hs: HostState; points: string }) {
  const top = hs.players.slice(0, 3);
  if (!top.length) return null;
  // Ортада — 1-орын, сол жақта — 2-орын, оң жақта — 3-орын.
  const order = [top[1], top[0], top[2]];
  const heights = ["h-28", "h-40", "h-20"];
  const medals = ["🥈", "🥇", "🥉"];
  return (
    <div className="flex items-end justify-center gap-3 sm:gap-5">
      {order.map((p, i) =>
        p ? (
          <div key={p.id} className="flex w-28 flex-col items-center gap-2 sm:w-40">
            <span className="text-4xl">{medals[i]}</span>
            <span className="max-w-full truncate text-center text-lg font-bold">{p.name}</span>
            <span className="text-sm text-slate-500">
              {p.score} {points}
            </span>
            <div className={`w-full rounded-t-2xl ${i === 1 ? "bg-violet-600" : "bg-violet-300"} ${heights[i]}`} />
          </div>
        ) : (
          <div key={i} className="w-28 sm:w-40" />
        ),
      )}
    </div>
  );
}
