import { Sparkles } from "lucide-react";

/** Бет файлы жүктеліп жатқанда көрсетілетін белгі (бірден жыпылықтамас үшін кешігіп шығады). */
export function PageLoader() {
  return (
    <div role="status" aria-label="…" className="flex min-h-[40vh] items-center justify-center opacity-0 [animation:fadeIn_.2s_.25s_forwards]">
      <Sparkles size={34} className="animate-spin text-violet-500" />
    </div>
  );
}
