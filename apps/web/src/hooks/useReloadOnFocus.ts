import { useEffect, useRef } from "react";

/**
 * useReloadOnFocus — re-runs `load` when the user comes back to the tab.
 *
 * Why: after a few minutes asleep / on another tab, the Supabase access token
 * may have expired silently. The first navigation to a page would then fire a
 * request that hangs (now bounded by the supabase client's fetch timeout, but
 * we still want to refresh data automatically once the connection is back).
 *
 * Behavior:
 * - Triggers on `visibilitychange` (tab becomes visible) and `online`.
 * - Debounced: never fires twice within 2s, so flicking between tabs won't
 *   spam the API.
 * - Skips a trigger if the previous `load()` is still in flight — this avoids
 *   stacking dozens of pending requests when the network is bad.
 * - Caller is expected to also run `load` once on mount via its own useEffect.
 */
export function useReloadOnFocus(load: () => void | Promise<unknown>, enabled: boolean = true) {
  const loadRef = useRef(load);
  loadRef.current = load;

  useEffect(() => {
    if (!enabled) return;
    let lastRun = 0;
    let inFlight = false;

    const trigger = async () => {
      const now = Date.now();
      if (now - lastRun < 2000) return;
      if (inFlight) return;
      lastRun = now;
      inFlight = true;
      try {
        await loadRef.current();
      } catch (err) {
        console.error("[useReloadOnFocus] load threw", err);
      } finally {
        inFlight = false;
      }
    };

    const onVisible = () => {
      if (document.visibilityState === "visible") void trigger();
    };
    const onOnline = () => void trigger();

    document.addEventListener("visibilitychange", onVisible);
    window.addEventListener("online", onOnline);
    return () => {
      document.removeEventListener("visibilitychange", onVisible);
      window.removeEventListener("online", onOnline);
    };
  }, [enabled]);
}
