import { createClient } from "@supabase/supabase-js";

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseKey =
  process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY ||
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

export const supabaseConfigError =
  !supabaseUrl || !supabaseKey
    ? "Missing NEXT_PUBLIC_SUPABASE_URL or NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY."
    : supabaseUrl.includes("/dashboard/project/")
      ? "NEXT_PUBLIC_SUPABASE_URL must be the project API URL, for example https://PROJECT_REF.supabase.co."
      : null;

export const supabase = createClient(supabaseUrl || "https://example.supabase.co", supabaseKey || "missing-key", {
  auth: {
    autoRefreshToken: true,
    persistSession: true,
    detectSessionInUrl: true,
  },
});
