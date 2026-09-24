import { useLocation } from "react-router-dom";
import { tools } from "./navigation";

/** Ашық тұрған беттің құралы (жоқ болса — null). */
export function useCurrentTool() {
  const { pathname } = useLocation();
  return tools.find((t) => pathname === t.to || pathname.startsWith(`${t.to}/`)) ?? null;
}
