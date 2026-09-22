import { createClient } from "@supabase/supabase-js";

const supabaseUrl = import.meta.env.VITE_SUPABASE_URL as string | undefined;
const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY as string | undefined;

if (!supabaseUrl || !supabaseAnonKey) {
  throw new Error(
    "Supabase баптаулары табылмады: .env файлында VITE_SUPABASE_URL мен VITE_SUPABASE_ANON_KEY орнатыңыз (supabase/README.md қараңыз).",
  );
}

export const supabase = createClient(supabaseUrl, supabaseAnonKey);
