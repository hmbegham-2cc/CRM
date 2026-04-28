import { createContext, useContext, useEffect, useMemo, useState } from "react";
import type { AuthUser, LoginResponse } from "@crc/types";
import { request } from "./api";

interface AuthCtx {
  user: AuthUser | null;
  loading: boolean;
  login: (email: string, password: string) => Promise<void>;
  logout: () => void;
}

const AuthContext = createContext<AuthCtx | undefined>(undefined);

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [user, setUser] = useState<AuthUser | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const t = localStorage.getItem("crc_token");
    if (!t) {
      setLoading(false);
      return;
    }
    request<AuthUser>("/auth/me")
      .then(setUser)
      .catch(() => localStorage.removeItem("crc_token"))
      .finally(() => setLoading(false));
  }, []);

  const value = useMemo<AuthCtx>(() => ({
    user,
    loading,
    async login(email, password) {
      const res = await request<LoginResponse>("/auth/login", "POST", { email, password });
      localStorage.setItem("crc_token", res.token);
      setUser(res.user);
    },
    logout() {
      localStorage.removeItem("crc_token");
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
