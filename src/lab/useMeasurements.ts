import { useCallback, useEffect, useState } from "react";
import type { Measurement } from "./types";

/* ───────── Өлшеулерді сақтау ───────── */

/** Өлшеулер осы құрылғының браузерінде сақталады (бет жаңартылса да жоғалмайды). */
export function useMeasurements(labId: string) {
  const key = `ainur-lab-${labId}`;
  const [rows, setRows] = useState<Measurement[]>(() => {
    try {
      return JSON.parse(localStorage.getItem(key) ?? "[]") as Measurement[];
    } catch {
      return [];
    }
  });
  useEffect(() => {
    try {
      localStorage.setItem(key, JSON.stringify(rows));
    } catch {
      // жеке режим — сақталмайды
    }
  }, [key, rows]);
  const add = useCallback((values: Record<string, number>) => setRows((r) => [...r, { id: crypto.randomUUID(), time: Date.now(), values }]), []);
  return {
    rows,
    add,
    remove: (id: string) => setRows((r) => r.filter((x) => x.id !== id)),
    clear: () => setRows([]),
  };
}
