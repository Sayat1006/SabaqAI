import { Check, ChevronDown, Copy, FileSpreadsheet, Link2, Lock, QrCode, RefreshCw, Send, Trash2, Unlock, Users } from "lucide-react";
import { Fragment, useEffect, useState } from "react";
import {
  deleteSubmission,
  getSubmissions,
  getTestShare,
  type SavedTest,
  setTestShareOpen,
  setTestShareReview,
  shareLink,
  shareTest,
  type TestShare,
  type TestSubmission,
  timeAgo,
} from "../lib/projects";
import { sendTestSummary, telegramShareUrl } from "../lib/telegram";
import { QrDialog } from "./QrDialog";
import { ClassInsights, StudentDetail } from "./ResultsInsights";
import { tr } from "../i18n";

const btn =
  "inline-flex items-center gap-2 rounded-[11px] border border-slate-200 bg-surface px-3.5 py-2.5 text-sm font-semibold hover:border-violet-500 hover:text-violet-600 disabled:opacity-60";

const pct = (score: number, total: number) => (total ? Math.round((score / total) * 100) : 0);

/** Тестті оқушыларға сілтемемен жіберу және олардың нәтижелері. */
export function TestSharePanel({ test }: { test: SavedTest }) {
  const [share, setShare] = useState<TestShare | null>(null);
  const [subs, setSubs] = useState<TestSubmission[]>([]);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [copied, setCopied] = useState(false);
  const [error, setError] = useState("");
  const [expanded, setExpanded] = useState<string | null>(null);
  const [qrOpen, setQrOpen] = useState(false);
  const [notice, setNotice] = useState("");
  const [exporting, setExporting] = useState(false);

  async function exportExcel() {
    setExporting(true);
    try {
      const { exportResultsToXlsx } = await import("../lib/exportXlsx");
      await exportResultsToXlsx(test, subs);
    } catch (e) {
      setError(e instanceof Error ? e.message : tr("Excel файлын жасау мүмкін болмады."));
    } finally {
      setExporting(false);
    }
  }

  useEffect(() => {
    let alive = true;
    getTestShare(test.id)
      .then(async (s) => {
        const list = s ? await getSubmissions(test.id) : [];
        if (!alive) return;
        setShare(s);
        setSubs(list);
      })
      .catch((e) => alive && setError(e instanceof Error ? e.message : tr("Нәтижелерді жүктеу мүмкін болмады.")))
      .finally(() => alive && setLoading(false));
    return () => {
      alive = false;
    };
  }, [test.id]);

  async function run(action: () => Promise<void>) {
    setBusy(true);
    setError("");
    setNotice("");
    try {
      await action();
    } catch (e) {
      setError(e instanceof Error ? e.message : tr("Әрекет орындалмады."));
    } finally {
      setBusy(false);
    }
  }

  const create = () => run(async () => setShare(await shareTest(test.id)));
  const toggle = () =>
    run(async () => {
      if (!share) return;
      await setTestShareOpen(test.id, !share.isOpen);
      setShare({ ...share, isOpen: !share.isOpen });
      // Жауап қабылдау тоқтатылса — Telegram-ға қорытынды (қосылмаған болса, үнсіз).
      if (share.isOpen && subs.length) sendTestSummary(test.id).catch(() => {});
    });
  const toggleReview = () =>
    run(async () => {
      if (!share) return;
      await setTestShareReview(test.id, !share.showReview);
      setShare({ ...share, showReview: !share.showReview });
    });
  const refresh = () => run(async () => setSubs(await getSubmissions(test.id)));
  const remove = (id: string) =>
    run(async () => {
      if (!window.confirm(tr("Бұл оқушының нәтижесін өшіру керек пе?"))) return;
      await deleteSubmission(id);
      setSubs((list) => list.filter((s) => s.id !== id));
    });

  async function copy() {
    if (!share) return;
    try {
      await navigator.clipboard.writeText(shareLink(share.code));
      setCopied(true);
      window.setTimeout(() => setCopied(false), 2000);
    } catch {
      setError(tr("Көшіру мүмкін болмады — сілтемені белгілеп, қолмен көшіріңіз."));
    }
  }

  const avg = subs.length ? Math.round(subs.reduce((sum, s) => sum + pct(s.score, s.total), 0) / subs.length) : 0;
  // Әр сұраққа дұрыс жауап бергендер үлесі — қай тақырып нашар меңгерілгенін көрсетеді.
  const perQuestion = test.questions.map((q, i) =>
    subs.length ? Math.round((subs.filter((s) => s.answers[i] === q.correctIndex).length / subs.length) * 100) : 0,
  );

  return (
    <section className="mt-6 flex flex-col gap-5 rounded-[22px] border border-slate-200 bg-surface p-6 sm:p-8 print:hidden" aria-labelledby="share-title">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h3 id="share-title" className="flex items-center gap-2 text-lg font-bold">
            <Send size={18} className="text-violet-600" /> {tr("Оқушыларға жіберу")}
          </h3>
          <p className="mt-1 text-[13.5px] text-slate-500">
            {tr("Оқушылар сілтеме арқылы телефоннан тіркелмей тапсырады. Оқушының аты басылса, оның жауаптары мен AI жеке тапсырмасы ашылады. Нәтижелері осы жерде жиналады, дұрыс жауаптар оқушыларға көрсетілмейді.")}
          </p>
        </div>
        {share && (
          <span className={`rounded-full px-3 py-1.5 text-xs font-semibold ${share.isOpen ? "bg-fuchsia-100 text-fuchsia-700" : "bg-slate-100 text-slate-500"}`}>
            {share.isOpen ? tr("Жауап қабылдануда") : tr("Жабық")}
          </span>
        )}
      </div>

      {error && (
        <p role="alert" className="rounded-xl bg-rose-50 px-3.5 py-2.5 text-sm text-rose-700">
          {error}
        </p>
      )}
      {notice && !error && (
        <p role="status" className="rounded-xl bg-fuchsia-100 px-3.5 py-2.5 text-sm text-fuchsia-800">
          {notice}
        </p>
      )}

      {loading ? (
        <div className="text-sm text-slate-500">{tr("Жүктелуде...")}</div>
      ) : !share ? (
        <div>
          <button type="button" onClick={create} disabled={busy} className="inline-flex items-center gap-2 rounded-[14px] bg-violet-600 px-5 py-3 font-semibold text-white disabled:opacity-70">
            <Link2 size={16} /> {busy ? tr("Жасалуда...") : tr("Сілтеме жасау")}
          </button>
        </div>
      ) : (
        <>
          <div className="flex flex-wrap gap-2.5">
            <input
              readOnly
              value={shareLink(share.code)}
              onFocus={(e) => e.currentTarget.select()}
              aria-label={tr("Тест сілтемесі")}
              className="min-w-0 flex-[1_1_260px] rounded-xl border border-slate-200 bg-slate-50 px-3.5 py-2.5 text-sm"
            />
            <button type="button" onClick={copy} className={btn}>
              {copied ? <Check size={15} /> : <Copy size={15} />} {copied ? tr("Көшірілді") : tr("Көшіру")}
            </button>
            <button type="button" onClick={() => setQrOpen(true)} className={btn}>
              <QrCode size={15} /> {tr("QR-код")}
            </button>
            <a
              href={telegramShareUrl(shareLink(share.code), tr("📝 Тест: {topic}. Аты-жөніңізді жазып, тапсырыңыз:", { topic: test.topic }))}
              target="_blank"
              rel="noopener noreferrer"
              className={btn}
            >
              <Send size={15} /> {tr("Telegram-ға жіберу")}
            </a>
            <button type="button" onClick={toggle} disabled={busy} className={btn}>
              {share.isOpen ? <Lock size={15} /> : <Unlock size={15} />} {share.isOpen ? tr("Қабылдауды тоқтату") : tr("Қайта ашу")}
            </button>
          </div>

          <label className="flex cursor-pointer items-start gap-2.5 text-sm">
            <input type="checkbox" checked={share.showReview} onChange={toggleReview} disabled={busy} className="mt-0.5 h-4 w-4 accent-violet-600" />
            <span>
              {tr("Оқушыға тапсырған соң қателерін түсіндірмесімен көрсету")}
              <span className="block text-xs text-slate-500">{tr("Оқушы қай жерде қателескенін көріп, «Қатемен жұмыс» режимінде қайта орындайды. Бақылау жұмысы болса, өшіріп қойыңыз.")}</span>
            </span>
          </label>

          <div className="flex flex-wrap items-center justify-between gap-3 border-t border-slate-200 pt-5">
            <div className="flex flex-wrap gap-5 text-sm">
              <span className="inline-flex items-center gap-1.5">
                <Users size={16} className="text-slate-500" /> {tr("Тапсырғандар:")} <b>{subs.length}</b>
              </span>
              {subs.length > 0 && (
                <span>
                  {tr("Орташа нәтиже:")} <b>{avg}%</b>
                </span>
              )}
            </div>
            <div className="flex flex-wrap gap-2">
              {subs.length > 0 && (
                <button
                  type="button"
                  onClick={() =>
                    run(async () => {
                      await sendTestSummary(test.id);
                      setNotice(tr("Қорытынды Telegram-ға жіберілді."));
                    })
                  }
                  disabled={busy}
                  className={btn}
                >
                  <Send size={15} /> {tr("Қорытынды → Telegram")}
                </button>
              )}
              {subs.length > 0 && (
                <button type="button" onClick={exportExcel} disabled={exporting} className={btn}>
                  <FileSpreadsheet size={15} /> {exporting ? tr("Дайындалуда...") : tr("Excel-ге жүктеу")}
                </button>
              )}
              <button type="button" onClick={refresh} disabled={busy} className={btn}>
                <RefreshCw size={15} className={busy ? "animate-spin" : ""} /> {tr("Жаңарту")}
              </button>
            </div>
          </div>

          {subs.length === 0 ? (
            <div className="rounded-xl border-2 border-dashed border-slate-200 p-6 text-center text-sm text-slate-500">
              {tr("Әзірге ешкім тапсырған жоқ. Сілтемені оқушыларға WhatsApp не Telegram арқылы жіберіңіз.")}
            </div>
          ) : (
            <>
              <div className="overflow-x-auto">
                <table className="w-full min-w-[520px] text-left text-sm">
                  <thead>
                    <tr className="border-b border-slate-200 text-[12.5px] text-slate-500">
                      <th className="py-2 pr-3 font-semibold">№</th>
                      <th className="py-2 pr-3 font-semibold">{tr("Аты-жөні")}</th>
                      <th className="py-2 pr-3 font-semibold">{tr("Сынып")}</th>
                      <th className="py-2 pr-3 font-semibold">{tr("Нәтиже")}</th>
                      <th className="py-2 pr-3 font-semibold">{tr("Уақыты")}</th>
                      <th className="py-2" />
                    </tr>
                  </thead>
                  <tbody>
                    {subs.map((s, i) => {
                      const p = pct(s.score, s.total);
                      return (
                        <Fragment key={s.id}>
                        <tr className="border-b border-slate-100">
                          <td className="py-2.5 pr-3 text-slate-500">{i + 1}</td>
                          <td className="py-2.5 pr-3 font-semibold">
                            <button
                              type="button"
                              aria-expanded={expanded === s.id}
                              onClick={() => setExpanded((e) => (e === s.id ? null : s.id))}
                              className="inline-flex items-center gap-1 text-left hover:text-violet-600"
                            >
                              {s.studentName}
                              <ChevronDown size={14} className={`transition ${expanded === s.id ? "rotate-180" : ""}`} />
                            </button>
                          </td>
                          <td className="py-2.5 pr-3">{s.studentClass || "—"}</td>
                          <td className="py-2.5 pr-3">
                            <span className={`rounded-full px-2.5 py-1 text-xs font-bold ${p >= 85 ? "bg-fuchsia-100 text-fuchsia-800" : p >= 50 ? "bg-violet-100 text-violet-700" : "bg-rose-50 text-rose-700"}`}>
                              {s.score}/{s.total} · {p}%
                            </span>
                          </td>
                          <td className="py-2.5 pr-3 text-slate-500">{timeAgo(s.createdAt)}</td>
                          <td className="py-2.5 text-right">
                            <button type="button" onClick={() => remove(s.id)} aria-label={tr("{name} нәтижесін өшіру", { name: s.studentName })} className="rounded-lg p-1.5 text-slate-500 hover:bg-rose-50 hover:text-rose-700">
                              <Trash2 size={15} />
                            </button>
                          </td>
                        </tr>
                        {expanded === s.id && (
                          <tr>
                            <td colSpan={6} className="py-2">
                              <StudentDetail test={test} sub={s} />
                            </td>
                          </tr>
                        )}
                        </Fragment>
                      );
                    })}
                  </tbody>
                </table>
              </div>

              <div>
                <div className="mb-2 text-[13px] font-semibold text-slate-500">{tr("Сұрақтар бойынша дұрыс жауап бергендер")}</div>
                <div className="flex flex-wrap gap-2">
                  {perQuestion.map((p, i) => (
                    <span
                      key={i}
                      title={test.questions[i].question}
                      className={`rounded-lg px-2.5 py-1.5 text-xs font-semibold ${p >= 70 ? "bg-fuchsia-100 text-fuchsia-800" : p >= 40 ? "bg-violet-100 text-violet-700" : "bg-rose-50 text-rose-700"}`}
                    >
                      {tr("{n}-сұрақ", { n: i + 1 })}{test.questions[i].level ? ` (${test.questions[i].level})` : ""}: {p}%
                    </span>
                  ))}
                </div>
              </div>
              <ClassInsights test={test} subs={subs} perQuestion={perQuestion} average={avg} />
            </>
          )}
        </>
      )}
      {qrOpen && share && <QrDialog url={shareLink(share.code)} title={test.topic} onClose={() => setQrOpen(false)} />}
    </section>
  );
}
