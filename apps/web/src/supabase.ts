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

/**
 * True when an error looks like a stale-connection failure that succeeds on
 * retry (e.g. ERR_CONNECTION_CLOSED, ECONNRESET, "Failed to fetch" with no
 * response yet). These happen when a proxy/firewall silently kills idle
 * HTTP/2 keep-alive connections without sending a GOAWAY frame.
 *
 * We only retry GETs (idempotent) and only once.
 */
function isTransientNetworkError(err: unknown, hasResponded: boolean): boolean {
  if (hasResponded) return false;
  if (typeof navigator !== "undefined" && navigator.onLine === false) return false;
  const msg = ((err as any)?.message || "").toLowerCase();
  return (
    msg.includes("failed to fetch") ||
    msg.includes("err_connection_closed") ||
    msg.includes("err_connection_reset") ||
    msg.includes("err_network_changed") ||
    msg.includes("networkerror") ||
    msg.includes("network error") ||
    msg.includes("load failed")
  );
}

function doFetch(
  input: RequestInfo | URL,
  init: RequestInit,
  reqId: number,
  attempt: number,
): Promise<Response> {
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

  const method = (init.method || "GET").toUpperCase();
  const url =
    typeof input === "string"
      ? input
      : input instanceof URL
      ? input.toString()
      : (input as Request).url;
  const path = diag.shortUrl(url);
  const start = performance.now();
  const tag = attempt > 0 ? `#${reqId}.${attempt}` : `#${reqId}`;

  diag.info("fetch", `→ ${tag} ${method} ${path}`, networkSnapshot());

  return fetch(input, { ...init, signal: ctrl.signal })
    .then((res) => {
      const ms = Math.round(performance.now() - start);
      const fn = res.ok ? "info" : "warn";
      diag[fn](
        "fetch",
        `← ${tag} ${method} ${path} ${res.status} ${res.statusText} (${ms}ms)`,
      );
      if (ms > SLOW_REQUEST_MS) {
        diag.warn(
          "fetch",
          `slow request ${tag} ${method} ${path}: ${ms}ms`,
          networkSnapshot(),
        );
      }
      return res;
    })
    .catch(async (err) => {
      const ms = Math.round(performance.now() - start);
      const { category, detail } = classifyError(err);

      // Transient stale-connection failures: retry once for idempotent GETs.
      // The browser will open a fresh TCP connection on the second attempt,
      // which works around proxies that silently kill idle HTTP/2 streams.
      const canRetry =
        attempt === 0 &&
        method === "GET" &&
        isTransientNetworkError(err, false);
      if (canRetry) {
        diag.warn(
          "fetch",
          `↻ ${tag} ${method} ${path} retrying after ${ms}ms — ${category}: ${detail}`,
        );
        // Small backoff to let the browser realize the old socket is dead.
        await new Promise((r) => window.setTimeout(r, 200));
        return doFetch(input, init, reqId, attempt + 1);
      }

      diag.error(
        "fetch",
        `✗ ${tag} ${method} ${path} FAILED after ${ms}ms — ${category}: ${detail}`,
        { ...networkSnapshot(), errorName: (err as any)?.name, errorMessage: (err as any)?.message },
      );
      throw err;
    })
    .finally(() => window.clearTimeout(timer));
}

function fetchWithTimeout(input: RequestInfo | URL, init: RequestInit = {}): Promise<Response> {
  const reqId = ++reqCounter;
  return doFetch(input, init, reqId, 0);
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
