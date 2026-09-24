import { Sparkles } from "lucide-react";
import { tr } from "../i18n";

/**
 * Жүктелу белгісі — ҚМЖ генерациясындағыдай айналып тұрған жұлдызша.
 * full: бүкіл экран (кіру тексерілгенде); card: бос картада; inline: мәтін жолында.
 */
export function Loading({ variant = "card", label, className = "" }: { variant?: "full" | "card" | "inline"; label?: string; className?: string }) {
  if (variant === "full") {
    return (
      <div role="status" aria-label={label ?? tr("Жүктелуде...")} className="flex min-h-screen items-center justify-center">
        <Sparkles size={40} className="animate-spin text-violet-500" />
      </div>
    );
  }
  if (variant === "inline") {
    return (
      <span role="status" className={`inline-flex items-center gap-2 text-sm text-slate-500 ${className}`}>
        <Sparkles size={16} className="animate-spin text-violet-500" /> {label ?? tr("Жүктелуде...")}
      </span>
    );
  }
  return (
    <div role="status" className={`flex flex-col items-center justify-center gap-2.5 rounded-[18px] border border-slate-200 bg-surface p-8 text-slate-500 ${className}`}>
      <Sparkles size={28} className="animate-spin text-violet-500" />
      <span className="text-sm">{label ?? tr("Жүктелуде...")}</span>
    </div>
  );
}
