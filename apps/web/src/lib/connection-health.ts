import { diag } from "./diag";

/**
 * Connection health monitor.
 *
 * Counts recent fetch outcomes and exposes a coarse "healthy" / "degraded" /
 * "down" state that the UI can subscribe to. When too many requests fail in
 * a short window we treat the connection as down and:
 *  - tell the React tree to show a sticky banner,
 *  - try to refresh the Supabase session (new JWT often forces the SDK to
 *    rebuild its connection pool internally),
 *  - allow the user to retry manually.
 */

export type HealthState = "healthy" | "degraded" | "down";

const WINDOW_SIZE = 8;
const FAIL_DOWN = 4;
const FAIL_DEGRADED = 2;

type Outcome = "ok" | "fail";

const ring: Outcome[] = [];
let state: HealthState = "healthy";
let consecutiveFails = 0;
const listeners = new Set<(s: HealthState) => void>();
let lastRecoveryAttempt = 0;

function recompute() {
  const fails = ring.filter((o) => o === "fail").length;
  const next: HealthState =
    fails >= FAIL_DOWN
      ? "down"
      : fails >= FAIL_DEGRADED
      ? "degraded"
      : "healthy";
  if (next !== state) {
    diag.warn("health", `state ${state} → ${next}`, {
      window: ring.slice(),
      consecutiveFails,
    });
    state = next;
    listeners.forEach((l) => {
      try {
        l(next);
      } catch {
        /* listener errors are not our concern */
      }
    });
  }
}

export const connectionHealth = {
  recordSuccess() {
    consecutiveFails = 0;
    ring.push("ok");
    if (ring.length > WINDOW_SIZE) ring.shift();
    recompute();
  },
  recordFailure() {
    consecutiveFails += 1;
    ring.push("fail");
    if (ring.length > WINDOW_SIZE) ring.shift();
    recompute();
  },
  reset() {
    ring.length = 0;
    consecutiveFails = 0;
    state = "healthy";
    listeners.forEach((l) => l("healthy"));
  },
  get state(): HealthState {
    return state;
  },
  get consecutiveFails(): number {
    return consecutiveFails;
  },
  /** Returns true if a recovery attempt should be made (rate-limited). */
  shouldAttemptRecovery(minIntervalMs = 10_000): boolean {
    const now = Date.now();
    if (now - lastRecoveryAttempt < minIntervalMs) return false;
    lastRecoveryAttempt = now;
    return true;
  },
  subscribe(fn: (s: HealthState) => void): () => void {
    listeners.add(fn);
    return () => {
      listeners.delete(fn);
    };
  },
};
