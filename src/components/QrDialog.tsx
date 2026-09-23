import { Download, X } from "lucide-react";
import QRCode from "qrcode";
import { useEffect, useState } from "react";

/** Тест сілтемесінің QR-коды: сыныпта проекторға шығаруға және PNG ретінде жүктеуге. */
export function QrDialog({ url, title, onClose }: { url: string; title: string; onClose: () => void }) {
  const [src, setSrc] = useState("");

  useEffect(() => {
    let alive = true;
    QRCode.toDataURL(url, { width: 720, margin: 2, errorCorrectionLevel: "M", color: { dark: "#1C1B2E", light: "#FFFFFF" } })
      .then((d) => alive && setSrc(d))
      .catch(() => alive && setSrc(""));
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && onClose();
    window.addEventListener("keydown", onKey);
    return () => {
      alive = false;
      window.removeEventListener("keydown", onKey);
    };
  }, [url, onClose]);

  return (
    <div role="dialog" aria-modal="true" aria-label="Тест сілтемесінің QR-коды" className="fixed inset-0 z-50 flex items-center justify-center bg-navy-900/80 p-4" onClick={onClose}>
      <div className="flex max-h-full w-full max-w-[560px] flex-col items-center gap-4 overflow-auto rounded-3xl bg-white p-6 text-center" onClick={(e) => e.stopPropagation()}>
        <div className="flex w-full items-start justify-between gap-3">
          <div className="text-left">
            <div className="text-lg font-bold">Телефонмен сканерлеңіз</div>
            <div className="text-sm text-slate-500">{title}</div>
          </div>
          <button type="button" onClick={onClose} aria-label="Жабу" className="rounded-lg p-1.5 hover:bg-slate-100">
            <X size={20} />
          </button>
        </div>
        {src ? <img src={src} alt="QR-код" className="aspect-square w-full max-w-[440px]" /> : <div className="aspect-square w-full max-w-[440px] animate-pulse rounded-2xl bg-slate-100" />}
        <div className="break-all text-[15px] font-semibold text-violet-700">{url}</div>
        {src && (
          <a href={src} download="test-qr.png" className="inline-flex items-center gap-2 rounded-[12px] border border-slate-200 px-4 py-2.5 text-sm font-semibold hover:border-violet-500">
            <Download size={15} /> PNG жүктеу
          </a>
        )}
      </div>
    </div>
  );
}
