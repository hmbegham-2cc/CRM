import { createClient } from "@supabase/supabase-js";
import { diag, classifyError, networkSnapshot } from "./lib/diag";

const supabaseUrl = import.meta.env.VITE_SUPABASE_URL as string;
const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY as string;

if (!supabaseUrl || !supabaseAnonKey) {
  throw new Error("VITE_SUPABASE_URL and VITE_SUPABASE_ANON_KEY must be set");
}

// Hard cap on every Supabase HTTP request. Without this, a stale TCP
// connection (laptop sleep, proxy timeout, lost wifi) can hang fetch()
// indefinitely, leaving every page stuck on "Chargement...".
const REQUEST_TIMEOUT_MS = 20_000;
// Warn (only) when a request is unusually slow but eventually succeeds.
const SLOW_REQUEST_MS = 5_000;

let reqCounter = 0;

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

  const reqId = ++reqCounter;
  const method = (init.method || "GET").toUpperCase();
  const url =
    typeof input === "string"
      ? input
      : input instanceof URL
      ? input.toString()
      : (input as Request).url;
  const path = diag.shortUrl(url);
  const start = performance.now();

  diag.info("fetch", `→ #${reqId} ${method} ${path}`, networkSnapshot());

  return fetch(input, { ...init, signal: ctrl.signal })
    .then((res) => {
      const ms = Math.round(performance.now() - start);
      const fn = res.ok ? "info" : "warn";
      diag[fn](
        "fetch",
        `← #${reqId} ${method} ${path} ${res.status} ${res.statusText} (${ms}ms)`,
      );
      if (ms > SLOW_REQUEST_MS) {
        diag.warn(
          "fetch",
          `slow request #${reqId} ${method} ${path}: ${ms}ms`,
          networkSnapshot(),
        );
      }
      return res;
    })
    .catch((err) => {
      const ms = Math.round(performance.now() - start);
      const { category, detail } = classifyError(err);
      diag.error(
        "fetch",
        `✗ #${reqId} ${method} ${path} FAILED after ${ms}ms — ${category}: ${detail}`,
        { ...networkSnapshot(), errorName: (err as any)?.name, errorMessage: (err as any)?.message },
      );
      throw err;
    })
    .finally(() => window.clearTimeout(timer));
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

diag.info("boot", "Supabase client created", {
  url: supabaseUrl,
  timeoutMs: REQUEST_TIMEOUT_MS,
  ...networkSnapshot(),
});
