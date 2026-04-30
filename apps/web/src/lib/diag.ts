/**
 * Diagnostic / network logger.
 *
 * Goal: when users (or the network admin) report "the app gets stuck on
 * Chargement...", they can open DevTools → Console and immediately see:
 *  - which Supabase endpoint was called,
 *  - how long it took,
 *  - the HTTP status (or the type of failure: timeout / TLS / offline / abort),
 *  - the navigator's online state at that moment.
 *
 * All logs are prefixed with `[CRC]` so they're easy to filter.
 * Last ~200 events are kept in memory and exposed via `window.crcDiag.dump()`
 * so the user can paste them in a ticket.
 */

type DiagLevel = "info" | "warn" | "error";

type DiagEvent = {
  ts: string;
  level: DiagLevel;
  tag: string;
  message: string;
  data?: any;
};

const RING_SIZE = 200;
const ring: DiagEvent[] = [];

function shortUrl(u: string | URL): string {
  try {
    const url = typeof u === "string" ? new URL(u) : u;
    // Strip query strings except for keys (no values) to keep logs compact + safe.
    const keys = [...url.searchParams.keys()];
    const q = keys.length ? `?${keys.join("&")}` : "";
    return `${url.pathname}${q}`;
  } catch {
    return String(u);
  }
}

function fmt(level: DiagLevel, tag: string, message: string, data?: any) {
  const ts = new Date().toISOString();
  const evt: DiagEvent = { ts, level, tag, message, data };
  ring.push(evt);
  if (ring.length > RING_SIZE) ring.shift();

  const head = `[CRC ${tag}]`;
  const fn = level === "error" ? console.error : level === "warn" ? console.warn : console.log;
  if (data !== undefined) fn(head, message, data);
  else fn(head, message);
}

export const diag = {
  info(tag: string, message: string, data?: any) {
    fmt("info", tag, message, data);
  },
  warn(tag: string, message: string, data?: any) {
    fmt("warn", tag, message, data);
  },
  error(tag: string, message: string, data?: any) {
    fmt("error", tag, message, data);
  },
  shortUrl,
  dump(): DiagEvent[] {
    return [...ring];
  },
};

// Expose on window for easy support: in DevTools console, type
//   crcDiag.dump()
// or
//   copy(JSON.stringify(crcDiag.dump(), null, 2))
// to copy the last 200 events to the clipboard.
if (typeof window !== "undefined") {
  (window as any).crcDiag = diag;
}

/** Classify a fetch / supabase error into a short, human-readable category. */
export function classifyError(err: unknown): {
  category:
    | "timeout"
    | "abort"
    | "offline"
    | "tls"
    | "dns"
    | "cors"
    | "network"
    | "http"
    | "unknown";
  detail: string;
} {
  if (typeof navigator !== "undefined" && navigator.onLine === false) {
    return { category: "offline", detail: "navigator.onLine = false" };
  }
  if (err instanceof DOMException) {
    if (err.name === "TimeoutError") return { category: "timeout", detail: err.message };
    if (err.name === "AbortError") return { category: "abort", detail: err.message };
  }
  const msg = (err as any)?.message || String(err);
  const lower = msg.toLowerCase();
  if (lower.includes("ssl") || lower.includes("tls") || lower.includes("certificate")) {
    return { category: "tls", detail: msg };
  }
  if (lower.includes("err_name_not_resolved") || lower.includes("dns")) {
    return { category: "dns", detail: msg };
  }
  if (lower.includes("cors")) return { category: "cors", detail: msg };
  if (
    lower.includes("failed to fetch") ||
    lower.includes("networkerror") ||
    lower.includes("err_connection") ||
    lower.includes("err_internet_disconnected") ||
    lower.includes("err_network")
  ) {
    return { category: "network", detail: msg };
  }
  return { category: "unknown", detail: msg };
}

/** Snapshot of the network conditions at a point in time (best-effort). */
export function networkSnapshot(): Record<string, any> {
  const out: Record<string, any> = {
    online: typeof navigator !== "undefined" ? navigator.onLine : null,
  };
  const conn = (typeof navigator !== "undefined" ? (navigator as any).connection : null) || null;
  if (conn) {
    out.effectiveType = conn.effectiveType;
    out.downlinkMbps = conn.downlink;
    out.rttMs = conn.rtt;
    out.saveData = conn.saveData;
  }
  return out;
}
