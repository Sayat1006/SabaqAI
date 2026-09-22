import { useContext } from "react";
import { AuthContext, type AuthContextValue } from "./authContextObject";

export function useAuth(): AuthContextValue {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error("useAuth AuthProvider ішінде қолданылуы керек");
  return ctx;
}
