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
 * - Debounced: never fires twice within 1s, so flicking between tabs won't
 *   spam the API.
 * - Caller is expected to also run `load` once on mount via its own useEffect.
 */
export function useReloadOnFocus(load: () => void, enabled: boolean = true) {
  const loadRef = useRef(load);
  loadRef.current = load;

  useEffect(() => {
    if (!enabled) return;
    let lastRun = 0;

    const trigger = () => {
      const now = Date.now();
      if (now - lastRun < 1000) return;
      lastRun = now;
      try {
        loadRef.current();
      } catch (err) {
        console.error("[useReloadOnFocus] load threw", err);
      }
    };

    const onVisible = () => {
      if (document.visibilityState === "visible") trigger();
    };
    const onOnline = () => trigger();

    document.addEventListener("visibilitychange", onVisible);
    window.addEventListener("online", onOnline);
    return () => {
      document.removeEventListener("visibilitychange", onVisible);
      window.removeEventListener("online", onOnline);
    };
  }, [enabled]);
}
