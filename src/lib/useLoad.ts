import { useCallback, useEffect, useState } from "react";
import { tr } from "../i18n";

/** Асинхронды деректі жүктейді: loading/error күйлерімен және жергілікті жаңарту үшін setData-мен. */
export function useLoad<T>(load: () => Promise<T>, deps: unknown[] = []) {
  const [data, setData] = useState<T | null>(null);
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(true);

  // eslint-disable-next-line react-hooks/exhaustive-deps
  const run = useCallback(load, deps);

  const reload = useCallback(async () => {
    setLoading(true);
    setError("");
    try {
      setData(await run());
    } catch (e) {
      setError(e instanceof Error ? e.message : tr("Деректерді жүктеу мүмкін болмады."));
    } finally {
      setLoading(false);
    }
  }, [run]);

  useEffect(() => {
    // eslint-disable-next-line react/set-state-in-effect -- сыртқы дерекқордан жүктеу
    void reload();
  }, [reload]);

  return { data, setData, error, loading, reload };
}
