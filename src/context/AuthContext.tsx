import { useEffect, useState, type ReactNode } from "react";
import * as auth from "../lib/auth";
import type { LoginResult, UserAccount } from "../lib/auth";
import { supabase } from "../lib/supabaseClient";
import { AuthContext } from "./authContextObject";

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<UserAccount | null>(null);
  const [loading, setLoading] = useState(true);

  async function refresh() {
    setUser(await auth.getSessionUser());
  }

  useEffect(() => {
    // eslint-disable-next-line react/set-state-in-effect -- сыртқы Supabase сессиясымен синхрондау
    refresh().finally(() => setLoading(false));

    const { data: subscription } = supabase.auth.onAuthStateChange(() => {
      refresh();
    });
    return () => subscription.subscription.unsubscribe();
  }, []);

  async function login(email: string, password: string): Promise<LoginResult> {
    const result = await auth.login(email, password);
    if (result.ok) setUser(result.user);
    return result;
  }

  async function logout() {
    await auth.logout();
    setUser(null);
  }

  return <AuthContext.Provider value={{ user, loading, login, logout, refresh }}>{children}</AuthContext.Provider>;
}
