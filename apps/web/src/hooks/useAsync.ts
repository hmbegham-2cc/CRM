import { useCallback, useEffect, useRef, useState } from "react";

/**
 * useAsync — wraps an async callback to expose a `busy` flag.
 *
 * Goals:
 * - Prevent double-submit on rapid clicks (returns immediately if already busy).
 * - Centralize try/finally bookkeeping so callers don't forget setBusy(false).
 * - Tolerate component unmount during the call (no setState on dead component).
 *
 * Usage:
 *   const [busy, run] = useAsync();
 *   <button disabled={busy} onClick={() => run(async () => {
 *     await deleteCampaign(c.id);
 *     reload();
 *   })} />
 */
export function useAsync(): [boolean, <T>(fn: () => Promise<T>) => Promise<T | undefined>] {
  const [busy, setBusy] = useState(false);
  const inFlight = useRef(false);
  const mounted = useRef(true);

  useEffect(() => {
    // Reset on (re)mount: under React 19 StrictMode the cleanup of the first
    // mount sets mounted.current=false; without re-setting it to true here,
    // the second mount would never call setBusy(false), leaving buttons
    // permanently disabled.
    mounted.current = true;
    return () => {
      mounted.current = false;
    };
  }, []);

  const run = useCallback(async <T,>(fn: () => Promise<T>): Promise<T | undefined> => {
    if (inFlight.current) return undefined;
    inFlight.current = true;
    setBusy(true);
    try {
      return await fn();
    } finally {
      inFlight.current = false;
      if (mounted.current) setBusy(false);
    }
  }, []);

  return [busy, run];
}
