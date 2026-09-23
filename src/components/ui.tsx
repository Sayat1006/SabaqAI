import type { InputHTMLAttributes, LabelHTMLAttributes, ReactNode, SelectHTMLAttributes, TextareaHTMLAttributes } from "react";

export function Card({ children, className = "" }: { children: ReactNode; className?: string }) {
  return (
    <div
      className={`rounded-2xl border border-slate-200/80 bg-surface p-6 shadow-[0_1px_2px_rgba(15,23,42,0.04),0_8px_24px_-12px_rgba(184,90,42,0.10)] ${className}`}
    >
      {children}
    </div>
  );
}

export function Field({ children, className = "", ...props }: LabelHTMLAttributes<HTMLLabelElement> & { children: ReactNode }) {
  return (
    <label {...props} className={`mb-4 block text-left text-sm ${className}`}>
      <span className="mb-1.5 block font-medium text-slate-700">{children}</span>
    </label>
  );
}

const fieldClasses =
  "w-full rounded-lg border border-slate-200 bg-surface px-3 py-2 text-slate-900 outline-none transition placeholder:text-slate-400 focus:border-violet-500 focus:ring-4 focus:ring-violet-500/12";

export function TextInput(props: InputHTMLAttributes<HTMLInputElement>) {
  return <input {...props} className={`${fieldClasses} ${props.className ?? ""}`} />;
}

export function Textarea(props: TextareaHTMLAttributes<HTMLTextAreaElement>) {
  return <textarea {...props} className={`${fieldClasses} ${props.className ?? ""}`} />;
}

export function Select(props: SelectHTMLAttributes<HTMLSelectElement>) {
  return <select {...props} className={`${fieldClasses} ${props.className ?? ""}`} />;
}

export function Button({
  children,
  variant = "primary",
  className = "",
  ...props
}: React.ButtonHTMLAttributes<HTMLButtonElement> & { variant?: "primary" | "ghost" }) {
  const base =
    "inline-flex items-center justify-center gap-2 rounded-lg px-4 py-2.5 text-sm font-medium transition-all duration-150 active:scale-[0.98] disabled:opacity-50 disabled:active:scale-100 disabled:cursor-not-allowed";
  const styles =
    variant === "primary"
      ? "bg-violet-600 text-white shadow-[0_2px_8px_-2px_rgba(184,90,42,0.5)] hover:bg-violet-700 hover:shadow-[0_6px_16px_-4px_rgba(184,90,42,0.55)]"
      : "border border-slate-200 bg-surface text-slate-700 hover:border-violet-300 hover:bg-violet-50/70 hover:text-violet-700";
  return (
    <button {...props} className={`${base} ${styles} ${className}`}>
      {children}
    </button>
  );
}

export function PrintButton({ label = "PDF-ке экспорттау" }: { label?: string }) {
  return (
    <Button type="button" variant="ghost" className="print:hidden" onClick={() => window.print()}>
      🖨️ {label}
    </Button>
  );
}

export function Badge({ children }: { children: ReactNode }) {
  return (
    <span className="inline-flex items-center gap-1.5 rounded-full border border-violet-200/70 bg-violet-50 px-3 py-1 text-xs font-medium text-violet-700">
      <span className="h-1.5 w-1.5 rounded-full bg-violet-500" />
      {children}
    </span>
  );
}
