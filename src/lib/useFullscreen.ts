import { useEffect, useRef, useState } from "react";

/** Элементті толық экранға шығару (проекторға көрсету үшін). */
export function useFullscreen() {
  const ref = useRef<HTMLDivElement>(null);
  const [full, setFull] = useState(false);
  useEffect(() => {
    const on = () => setFull(document.fullscreenElement === ref.current);
    document.addEventListener("fullscreenchange", on);
    return () => document.removeEventListener("fullscreenchange", on);
  }, []);
  const toggle = () => {
    if (document.fullscreenElement) void document.exitFullscreen();
    else void ref.current?.requestFullscreen?.();
  };
  return { ref, full, toggle };
}
