import { BellOff, BellRing, Check, ExternalLink, RefreshCw, Send, Settings, Unlink } from "lucide-react";
import { useCallback, useEffect, useState } from "react";
import {
  createLinkCode,
  getBotUsername,
  getTelegramStatus,
  setTelegramNotify,
  setupTelegramWebhook,
  type TelegramStatus,
  unlinkTelegram,
} from "../lib/telegram";

const btn = "inline-flex items-center gap-2 rounded-[12px] border border-slate-200 bg-white px-3.5 py-2.5 text-sm font-semibold hover:border-violet-500 disabled:opacity-60";

/** «Жеке бет»: мұғалімнің Telegram хабарламалары; әкімшіге — ботты іске қосу. */
export function TelegramCard({ userId, isAdmin }: { userId: string; isAdmin: boolean }) {
  const [status, setStatus] = useState<TelegramStatus | null | undefined>(undefined);
  const [bot, setBot] = useState("");
  const [waiting, setWaiting] = useState(false);
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState<{ ok: boolean; text: string } | null>(null);

  const reload = useCallback(async () => {
    const [s, b] = await Promise.all([getTelegramStatus(userId), getBotUsername().catch(() => "")]);
    setStatus(s);
    setBot(b);
    return s;
  }, [userId]);

  useEffect(() => {
    let alive = true;
    Promise.all([getTelegramStatus(userId), getBotUsername().catch(() => "")]).then(([s, b]) => {
      if (!alive) return;
      setStatus(s);
      setBot(b);
    });
    return () => {
      alive = false;
    };
  }, [userId]);

  async function run(fn: () => Promise<void>) {
    setBusy(true);
    setMsg(null);
    try {
      await fn();
    } catch (e) {
      setMsg({ ok: false, text: e instanceof Error ? e.message : "Әрекет орындалмады." });
    } finally {
      setBusy(false);
    }
  }

  function link() {
    // iPhone Safari «күтуден кейін» ашылған терезені бөгейді — сондықтан терезені басқан
    // сәтте ашып, код келген соң Telegram-ға бағыттаймыз.
    const w = window.open("about:blank", "_blank");
    void run(async () => {
      try {
        const url = `https://t.me/${bot}?start=${await createLinkCode()}`;
        if (w) {
          w.opener = null;
          w.location.href = url;
        } else window.location.href = url;
        setWaiting(true);
      } catch (e) {
        w?.close();
        throw e;
      }
    });
  }

  const check = () =>
    run(async () => {
      const s = await reload();
      if (s?.linked) {
        setWaiting(false);
        setMsg({ ok: true, text: "Telegram қосылды!" });
      } else setMsg({ ok: false, text: "Әлі қосылмаған. Ботта «Start» (Бастау) батырмасын басыңыз." });
    });

  const setup = () =>
    run(async () => {
      const name = await setupTelegramWebhook();
      setBot(name);
      setMsg({ ok: true, text: `Бот іске қосылды: @${name}` });
    });

  return (
    <section className="rounded-[22px] border border-slate-200 bg-white p-6 sm:p-7">
      <h2 className="flex items-center gap-2 text-lg font-bold">
        <Send size={18} className="text-violet-600" /> Telegram хабарламалары
      </h2>
      <p className="mt-1 text-sm text-slate-500">Оқушылар тест тапсырған сайын және тест жабылғанда Telegram-ға қысқа хабарлама келеді.</p>

      <div className="mt-4 flex flex-col gap-3">
        {status === undefined ? (
          <div className="text-sm text-slate-500">Жүктелуде...</div>
        ) : status === null ? (
          <p className="rounded-xl bg-slate-50 px-3.5 py-2.5 text-sm text-slate-600">Telegram бот әлі қосылмаған. Әкімші Supabase-те update-6-telegram.sql файлын орындауы керек.</p>
        ) : !bot ? (
          <p className="rounded-xl bg-slate-50 px-3.5 py-2.5 text-sm text-slate-600">Telegram бот әлі бапталмаған. Әкімші ботты жасап, кілтін Supabase-ке қоюы керек.</p>
        ) : status.linked ? (
          <>
            <p className="inline-flex items-center gap-2 text-sm font-semibold text-fuchsia-800">
              <Check size={16} /> Қосылған: <a href={`https://t.me/${bot}`} target="_blank" rel="noopener noreferrer" className="text-violet-700 underline">@{bot}</a>
            </p>
            <div className="flex flex-wrap gap-2">
              <button
                type="button"
                disabled={busy}
                onClick={() =>
                  run(async () => {
                    await setTelegramNotify(!status.notify);
                    setStatus({ ...status, notify: !status.notify });
                  })
                }
                className={btn}
              >
                {status.notify ? <BellOff size={15} /> : <BellRing size={15} />} {status.notify ? "Хабарламаларды тоқтату" : "Хабарламаларды қосу"}
              </button>
              <button
                type="button"
                disabled={busy}
                onClick={() =>
                  run(async () => {
                    await unlinkTelegram();
                    setStatus({ ...status, linked: false });
                  })
                }
                className={btn}
              >
                <Unlink size={15} /> Ажырату
              </button>
            </div>
          </>
        ) : (
          <div className="flex flex-wrap gap-2">
            <button type="button" onClick={link} disabled={busy} className="inline-flex items-center gap-2 rounded-[12px] bg-violet-600 px-4 py-2.5 text-sm font-semibold text-white disabled:opacity-60">
              <ExternalLink size={15} /> Telegram-ды қосу
            </button>
            {waiting && (
              <button type="button" onClick={check} disabled={busy} className={btn}>
                <RefreshCw size={15} /> Қосылғанын тексеру
              </button>
            )}
          </div>
        )}
        {waiting && !status?.linked && <p className="text-xs text-slate-500">Telegram ашылады — ботта «Start» (Бастау) басыңыз, сосын осында «Қосылғанын тексеру» батырмасын басыңыз.</p>}

        {isAdmin && (
          <div className="mt-2 rounded-xl border border-dashed border-slate-300 p-3.5">
            <div className="text-sm font-semibold">Әкімші: ботты іске қосу</div>
            <p className="mt-0.5 text-xs text-slate-500">Supabase-ке TELEGRAM_BOT_TOKEN құпиясын қойып, telegram-bot функциясын жариялаған соң бір рет басыңыз.</p>
            <button type="button" onClick={setup} disabled={busy} className={`${btn} mt-2`}>
              <Settings size={15} /> Ботты іске қосу
            </button>
          </div>
        )}
        {msg && (
          <p role={msg.ok ? "status" : "alert"} className={`rounded-xl px-3.5 py-2.5 text-sm ${msg.ok ? "bg-fuchsia-100 text-fuchsia-800" : "bg-rose-50 text-rose-700"}`}>
            {msg.text}
          </p>
        )}
      </div>
    </section>
  );
}
