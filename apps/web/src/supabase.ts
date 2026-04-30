import { createClient } from "@supabase/supabase-js";

const supabaseUrl = import.meta.env.VITE_SUPABASE_URL as string;
const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY as string;

if (!supabaseUrl || !supabaseAnonKey) {
  throw new Error("VITE_SUPABASE_URL and VITE_SUPABASE_ANON_KEY must be set");
}

// Hard cap on every Supabase HTTP request. Without this, a stale TCP
// connection (laptop sleep, proxy timeout, lost wifi) can hang fetch()
// indefinitely, leaving every page stuck on "Chargement...".
const REQUEST_TIMEOUT_MS = 20_000;

function fetchWithTimeout(input: RequestInfo | URL, init: RequestInit = {}): Promise<Response> {
  const ctrl = new AbortController();
  const userSignal = init.signal;
  if (userSignal) {
    if (userSignal.aborted) ctrl.abort((userSignal as any).reason);
    else userSignal.addEventListener(
      "abort",
      () => ctrl.abort((userSignal as any).reason),
      { once: true },
    );
  }
  const timer = window.setTimeout(
    () => ctrl.abort(new DOMException("Délai d'attente dépassé", "TimeoutError")),
    REQUEST_TIMEOUT_MS,
  );
  return fetch(input, { ...init, signal: ctrl.signal }).finally(() =>
    window.clearTimeout(timer),
  );
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
  global: {
    fetch: fetchWithTimeout,
  },
});
