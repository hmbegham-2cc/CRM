import { createClient } from "@supabase/supabase-js";

const supabaseUrl = import.meta.env.VITE_SUPABASE_URL as string;
const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY as string;

if (!supabaseUrl || !supabaseAnonKey) {
  throw new Error("VITE_SUPABASE_URL and VITE_SUPABASE_ANON_KEY must be set");
}

export const supabase = createClient(supabaseUrl, supabaseAnonKey, {
  auth: {
    persistSession: true,
    autoRefreshToken: true,
    detectSessionInUrl: true,
    // navigatorLock causes a ~5s deadlock under React 19 + StrictMode/Suspense
    // because mount → unmount → re-mount makes the 2nd getSession() wait for
    // the 1st (already cancelled) to release. We don't need cross-tab sync,
    // so a no-op lock is safe.
    lock: async (_name, _acquireTimeout, fn) => fn(),
  },
});
