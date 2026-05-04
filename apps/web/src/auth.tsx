import { createContext, useContext, useEffect, useMemo, useRef, useState } from "react";
import type { AuthUser, Role } from "@crc/types";
import { supabase } from "./supabase";
import { diag, classifyError } from "./lib/diag";

interface AuthCtx {
  user: AuthUser | null;
  loading: boolean;
  login: (email: string, password: string) => Promise<void>;
  logout: () => Promise<void>;
}

const AuthContext = createContext<AuthCtx | undefined>(undefined);

const AUTH_OPERATION_TIMEOUT_MS = 12_000;

function withAuthTimeout<T>(name: string, promise: PromiseLike<T>): Promise<T> {
  let timer: ReturnType<typeof setTimeout> | undefined;
  const timeout = new Promise<never>((_, reject) => {
    timer = setTimeout(() => {
      reject(new DOMException(`Opération auth trop longue: ${name}`, "TimeoutError"));
    }, AUTH_OPERATION_TIMEOUT_MS);
  });

  return Promise.race([Promise.resolve(promise), timeout]).finally(() => {
    if (timer) clearTimeout(timer);
  });
}

async function fetchProfile(userId: string): Promise<AuthUser | null> {
  const start = performance.now();
  const readOnce = async (): Promise<AuthUser | null> => {
    const { data, error } = await withAuthTimeout(
      "fetchProfile.readUser",
      supabase
        .from("User")
        .select("id, email, name, role")
        .eq("id", userId)
        .maybeSingle(),
    );
    const ms = Math.round(performance.now() - start);
    if (error) {
      diag.error("auth", `fetchProfile failed in ${ms}ms`, error);
      return null;
    }
    if (!data) return null;
    diag.info("auth", `fetchProfile ok (${ms}ms) role=${data.role}`);
    return { id: data.id, email: data.email, name: data.name, role: data.role as Role };
  };

  try {
    let profile = await readOnce();
    if (!profile) {
      diag.warn("auth", `fetchProfile: no User row for id=${userId} — calling ensure_user_row()`);
      const { error: rpcErr } = await withAuthTimeout(
        "fetchProfile.ensure_user_row",
        supabase.rpc("ensure_user_row"),
      );
      if (rpcErr) diag.error("auth", "ensure_user_row RPC failed", rpcErr);
      else profile = await readOnce();
      if (!profile) {
        diag.warn("auth", "fetchProfile: still no row after ensure_user_row (run migration SQL?)");
      }
    }
    // NOTE: sync_my_role_from_auth removed — it was promoting roles from
    // auth metadata back into the DB, which reverted admin demotions.
    // The update-role Edge Function now correctly syncs both DB and metadata.
    return profile;
  } catch (err) {
    const ms = Math.round(performance.now() - start);
    const { category, detail } = classifyError(err);
    diag.error("auth", `fetchProfile threw after ${ms}ms — ${category}: ${detail}`, err);
    return null;
  }
}

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [user, setUser] = useState<AuthUser | null>(null);
  const [loading, setLoading] = useState(true);
  const lastUserIdRef = useRef<string | null>(null);

  useEffect(() => {
    let mounted = true;

    // Safety net: never keep the UI stuck on "Chargement..." for more than 8s,
    // even if Supabase getSession() hangs (network down, lock issues, etc.).
    const safety = window.setTimeout(() => {
      if (mounted) {
        diag.warn("auth", "safety net fired after 8s — releasing loading state");
        setLoading(false);
      }
    }, 8000);

    (async () => {
      try {
        diag.info("auth", "getSession start");
        const { data: { session } } = await supabase.auth.getSession();
        if (!mounted) return;
        if (session?.user) {
          diag.info("auth", `session restored for ${session.user.email}`);
          lastUserIdRef.current = session.user.id;
          const profile = await fetchProfile(session.user.id);
          if (!mounted) return;
          if (profile) setUser(profile);
        } else {
          diag.info("auth", "no active session");
        }
      } catch (err) {
        const { category, detail } = classifyError(err);
        diag.error("auth", `getSession threw — ${category}: ${detail}`, err);
      } finally {
        // Cancel the safety timer as soon as getSession + profile finish —
        // otherwise it still fires 8s after mount and spams logs even after a
        // fast login or after the user has already signed out.
        window.clearTimeout(safety);
        if (mounted) setLoading(false);
      }
    })();

    const { data: { subscription } } = supabase.auth.onAuthStateChange(async (event, session) => {
      if (!mounted) return;
      diag.info("auth", `onAuthStateChange: ${event}`, { hasSession: !!session?.user });
      try {
        if (
          (event === "SIGNED_IN" || event === "TOKEN_REFRESHED" || event === "USER_UPDATED") &&
          session?.user
        ) {
          lastUserIdRef.current = session.user.id;
          const profile = await fetchProfile(session.user.id);
          if (!mounted) return;
          if (profile) setUser(profile);
          // Ensure route guards never stay blocked on "loading" after auth events.
          setLoading(false);
        } else if (event === "SIGNED_OUT") {
          lastUserIdRef.current = null;
          setUser(null);
          setLoading(false);
        }
      } catch (err) {
        const { category, detail } = classifyError(err);
        diag.error("auth", `onAuthStateChange threw — ${category}: ${detail}`, err);
        setLoading(false);
      }
    });

    // When the tab regains focus after being asleep / backgrounded for a
    // while, the auth token may have expired and Supabase will silently
    // re-auth. We proactively retry the profile fetch so the sidebar /
    // role-gates don't end up empty after a long pause.
    const onVisible = async () => {
      if (document.visibilityState !== "visible") return;
      const uid = lastUserIdRef.current;
      if (!uid) return;
      // We deliberately do NOT call supabase.auth.refreshSession() here.
      // Awaiting it serializes every concurrent .from() call behind the
      // refresh, which under poor connectivity stacks dozens of pending
      // queries that never get dispatched (the SDK's internal queue gets
      // wedged). With autoRefreshToken=true the SDK rotates the JWT
      // transparently on its own; we only refresh the user profile to
      // pick up role/name changes done by another admin while the tab
      // was backgrounded.
      diag.info("auth", "tab visible again — refreshing profile");
      const profile = await fetchProfile(uid);
      if (mounted && profile) setUser(profile);
    };
    document.addEventListener("visibilitychange", onVisible);

    return () => {
      mounted = false;
      window.clearTimeout(safety);
      subscription.unsubscribe();
      document.removeEventListener("visibilitychange", onVisible);
    };
  }, []);

  const value = useMemo<AuthCtx>(() => ({
    user,
    loading,
    async login(email, password) {
      const trimmed = email.trim().toLowerCase();
      if (!trimmed.endsWith("@2cconseil.com")) {
        throw new Error("Seuls les emails @2cconseil.com sont autorisés");
      }
      const { data, error } = await supabase.auth.signInWithPassword({ email: trimmed, password });
      if (error) throw new Error("Email ou mot de passe incorrect");
      const uid = data.user?.id ?? data.session?.user?.id;
      if (!uid) throw new Error("Session introuvable après connexion");
      const profile = await fetchProfile(uid);
      if (!profile) {
        throw new Error(
          "Votre compte existe mais le profil applicatif est absent. Exécutez la migration SQL " +
            "(fonction ensure_user_row) sur Supabase, ou demandez à un administrateur de vous réinviter.",
        );
      }
      setUser(profile);
    },
    async logout() {
      let lastErr: unknown = null;
      try {
        const { error } = await supabase.auth.signOut({ scope: "global" });
        if (error) throw error;
      } catch (err) {
        lastErr = err;
        // On flaky networks, global logout may fail even if local session can
        // still be cleared. Fallback to local so user can always exit.
        diag.warn("auth", "global signOut failed, retrying with local scope", err);
        const { error: localErr } = await supabase.auth.signOut({ scope: "local" });
        if (localErr) {
          lastErr = localErr;
          diag.error("auth", "local signOut failed too", localErr);
        } else {
          lastErr = null;
        }
      } finally {
        lastUserIdRef.current = null;
        setUser(null);
        setLoading(false);
      }
      if (lastErr) {
        // Keep UI logged out anyway; backend token revocation can be retried by
        // signing in then out again when the connection is stable.
        diag.warn("auth", "logout completed locally with remote signOut error", lastErr);
      }
    },
  }), [user, loading]);

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error("AuthContext missing");
  return ctx;
}
