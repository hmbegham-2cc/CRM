import { createContext, useContext, useEffect, useMemo, useRef, useState } from "react";
import type { AuthUser, Role } from "@crc/types";
import { supabase } from "./supabase";

interface AuthCtx {
  user: AuthUser | null;
  loading: boolean;
  login: (email: string, password: string) => Promise<void>;
  logout: () => Promise<void>;
}

const AuthContext = createContext<AuthCtx | undefined>(undefined);

async function fetchProfile(userId: string): Promise<AuthUser | null> {
  try {
    const { data, error } = await supabase
      .from("User")
      .select("id, email, name, role")
      .eq("id", userId)
      .maybeSingle();
    if (error) {
      console.error("[fetchProfile]", error);
      return null;
    }
    if (!data) return null;
    return { id: data.id, email: data.email, name: data.name, role: data.role as Role };
  } catch (err) {
    console.error("[fetchProfile] threw", err);
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
      if (mounted) setLoading(false);
    }, 8000);

    (async () => {
      try {
        const { data: { session } } = await supabase.auth.getSession();
        if (!mounted) return;
        if (session?.user) {
          lastUserIdRef.current = session.user.id;
          const profile = await fetchProfile(session.user.id);
          if (!mounted) return;
          // Don't clear the user on transient profile fetch failures.
          if (profile) setUser(profile);
        }
      } catch (err) {
        console.error("[AuthProvider.getSession]", err);
      } finally {
        if (mounted) setLoading(false);
      }
    })();

    const { data: { subscription } } = supabase.auth.onAuthStateChange(async (event, session) => {
      if (!mounted) return;
      try {
        if (
          (event === "SIGNED_IN" || event === "TOKEN_REFRESHED" || event === "USER_UPDATED") &&
          session?.user
        ) {
          lastUserIdRef.current = session.user.id;
          const profile = await fetchProfile(session.user.id);
          if (!mounted) return;
          // Keep current user if profile refresh fails intermittently (don't
          // wipe the UI just because the network glitched).
          if (profile) setUser(profile);
        } else if (event === "SIGNED_OUT") {
          lastUserIdRef.current = null;
          setUser(null);
        }
      } catch (err) {
        console.error("[AuthProvider.onAuthStateChange]", err);
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
      const { error } = await supabase.auth.signInWithPassword({ email: trimmed, password });
      if (error) throw new Error("Email ou mot de passe incorrect");
    },
    async logout() {
      await supabase.auth.signOut();
      setUser(null);
    },
  }), [user, loading]);

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error("AuthContext missing");
  return ctx;
}
