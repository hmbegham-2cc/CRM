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
    .single();
  if (error || !data) return null;
  return { id: data.id, email: data.email, name: data.name, role: data.role as Role };
}

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [user, setUser] = useState<AuthUser | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    supabase.auth.getSession().then(async ({ data: { session } }) => {
      if (session?.user) {
        const profile = await fetchProfile(session.user.id);
        setUser(profile);
      }
      setLoading(false);
    });

    const { data: { subscription } } = supabase.auth.onAuthStateChange(async (event, session) => {
      if ((event === "SIGNED_IN" || event === "TOKEN_REFRESHED" || event === "USER_UPDATED") && session?.user) {
        const profile = await fetchProfile(session.user.id);
        setUser(profile);
      } else if (event === "SIGNED_OUT") {
        setUser(null);
      }
    });

    return () => subscription.unsubscribe();
  }, []);

  const value = useMemo<AuthCtx>(() => ({
    user,
    loading,
    async login(email, password) {
      if (!email.endsWith("@2cconseil.com")) {
        throw new Error("Seuls les emails @2cconseil.com sont autorisés");
      }
      const { error } = await supabase.auth.signInWithPassword({ email, password });
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
