/** Бет файлы жүктеліп жатқанда көрсетілетін жеңіл белгі (бірден жыпылықтамас үшін кешігіп шығады). */
export function PageLoader() {
  return (
    <div role="status" aria-label="…" className="flex min-h-[40vh] items-center justify-center opacity-0 [animation:fadeIn_.2s_.25s_forwards]">
      <span className="h-8 w-8 animate-spin rounded-full border-[3px] border-violet-200 border-t-violet-600" />
    </div>
  );
}
