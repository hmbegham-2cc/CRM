import { jsx as _jsx } from "react/jsx-runtime";
import { createContext, useContext, useEffect, useMemo, useState } from "react";
import { request } from "./api";
const AuthContext = createContext(undefined);
export function AuthProvider({ children }) {
    const [user, setUser] = useState(null);
    const [loading, setLoading] = useState(true);
    useEffect(() => {
        const t = localStorage.getItem("crc_token");
        if (!t) {
            setLoading(false);
            return;
        }
        request("/auth/me")
            .then(setUser)
            .catch(() => localStorage.removeItem("crc_token"))
            .finally(() => setLoading(false));
    }, []);
    const value = useMemo(() => ({
        user,
        loading,
        async login(email, password) {
            const res = await request("/auth/login", "POST", { email, password });
            localStorage.setItem("crc_token", res.token);
            setUser(res.user);
        },
        logout() {
            localStorage.removeItem("crc_token");
            setUser(null);
        },
    }), [user, loading]);
    return _jsx(AuthContext.Provider, { value: value, children: children });
}
export function useAuth() {
    const ctx = useContext(AuthContext);
    if (!ctx)
        throw new Error("AuthContext missing");
    return ctx;
}
