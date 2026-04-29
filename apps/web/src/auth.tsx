import { createContext, useContext, useEffect, useMemo, useState } from "react";
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
}

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [user, setUser] = useState<AuthUser | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let mounted = true;

    // Safety net: if anything stalls (e.g. network down, lock issues),
    // never keep the UI stuck on "Chargement..." for more than 8 seconds.
    const safety = window.setTimeout(() => {
      if (mounted) setLoading(false);
    }, 8000);

    (async () => {
      try {
        const { data: { session } } = await supabase.auth.getSession();
        if (!mounted) return;
        if (session?.user) {
          const profile = await fetchProfile(session.user.id);
          if (!mounted) return;
          setUser(profile);
        }
      } catch (err) {
        console.error("[AuthProvider.getSession]", err);
      } finally {
        if (mounted) setLoading(false);
      }
    })();

    const { data: { subscription } } = supabase.auth.onAuthStateChange(async (event, session) => {
      if (!mounted) return;
      if (
        (event === "SIGNED_IN" || event === "TOKEN_REFRESHED" || event === "USER_UPDATED") &&
        session?.user
      ) {
        const profile = await fetchProfile(session.user.id);
        if (!mounted) return;
        setUser(profile);
      } else if (event === "SIGNED_OUT") {
        setUser(null);
      }
    });

    return () => {
      mounted = false;
      window.clearTimeout(safety);
      subscription.unsubscribe();
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
