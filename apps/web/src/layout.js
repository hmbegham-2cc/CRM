import { jsx as _jsx, jsxs as _jsxs } from "react/jsx-runtime";
import { Link, Outlet, useLocation } from "react-router-dom";
import { useState, useEffect } from "react";
import { useAuth } from "./auth";
import { request } from "./api";
import { LayoutDashboard, FileEdit, History, CheckCircle, Settings, Users, Database, Download, LogOut, Bell, Key } from "lucide-react";
export function AppLayout() {
    const { user, logout } = useAuth();
    const location = useLocation();
    const menuItems = [
        { path: "/", label: "Dashboard", icon: Database, roles: ["TELECONSEILLER", "SUPERVISEUR", "ADMIN"] },
        { path: "/rapport", label: "Mon rapport", icon: FileEdit, roles: ["TELECONSEILLER", "SUPERVISEUR"] },
        { path: "/mes-saisies", label: "Mes saisies", icon: History, roles: ["TELECONSEILLER", "SUPERVISEUR"] },
        { path: "/tous-les-rapports", label: "Tous les rapports", icon: LayoutDashboard, roles: ["SUPERVISEUR", "ADMIN"] },
        { path: "/validation", label: "Validation", icon: CheckCircle, roles: ["SUPERVISEUR", "ADMIN"] },
        { path: "/campagnes", label: "Campagnes", icon: Settings, roles: ["ADMIN"] },
        { path: "/equipes", label: "Équipes", icon: Users, roles: ["ADMIN"] },
        { path: "/utilisateurs", label: "Utilisateurs", icon: Users, roles: ["ADMIN"] },
        { path: "/notifications", label: "Notifications", icon: Bell, roles: ["TELECONSEILLER", "SUPERVISEUR", "ADMIN"] },
        { path: "/export", label: "Export Excel", icon: Download, roles: ["ADMIN", "SUPERVISEUR"] },
    ];
    const filteredMenu = menuItems.filter(item => item.roles.includes(user?.role || ""));
    const [hasUnread, setHasUnread] = useState(false);
    useEffect(() => {
        const checkUnread = async () => {
            try {
                const notifications = await request('/notifications');
                setHasUnread(notifications.some(n => !n.read));
            }
            catch {
                setHasUnread(false);
            }
        };
        checkUnread();
        const interval = setInterval(checkUnread, 30000);
        return () => clearInterval(interval);
    }, [location.pathname]);
    return (_jsxs("div", { className: "layout", children: [_jsxs("aside", { className: "sidebar", children: [_jsx("div", { className: "brand", children: "CRC Reporting" }), _jsx("nav", { style: { flex: 1 }, children: filteredMenu.map((item) => {
                            const Icon = item.icon;
                            const isActive = location.pathname === item.path;
                            return (_jsxs(Link, { to: item.path, className: `nav-link ${isActive ? "active" : ""}`, style: { position: 'relative' }, children: [_jsx(Icon, { size: 20 }), _jsx("span", { children: item.label }), item.path === '/notifications' && hasUnread && (_jsx("div", { style: {
                                            position: 'absolute',
                                            top: '8px',
                                            left: '32px',
                                            width: '8px',
                                            height: '8px',
                                            background: 'var(--danger)',
                                            borderRadius: '50%',
                                            border: '2px solid #1e293b'
                                        } }))] }, item.path));
                        }) }), _jsxs("div", { className: "user-info", style: { marginTop: "auto", padding: "12px", borderTop: "1px solid #334155" }, children: [_jsxs("div", { className: "user-info-text", style: { marginBottom: "16px", padding: "0 12px" }, children: [_jsx("div", { style: { fontSize: "14px", fontWeight: 600, color: "#fff" }, children: user?.name || "Utilisateur" }), _jsx("div", { style: { fontSize: "12px", color: "#94a3b8" }, children: user?.email })] }), _jsxs(Link, { to: "/changer-mot-de-passe", style: { display: "flex", alignItems: "center", gap: "8px", padding: "8px 12px", color: "#94a3b8", textDecoration: "none", fontSize: "13px", borderRadius: "8px", marginBottom: "8px", transition: "all 0.2s" }, children: [_jsx(Key, { size: 16 }), _jsx("span", { children: "Changer le mot de passe" })] }), _jsxs("button", { className: "btn btn-danger", style: { width: "100%", justifyContent: "center" }, onClick: logout, children: [_jsx(LogOut, { size: 18 }), _jsx("span", { className: "logout-text", children: "D\u00E9connexion" })] })] })] }), _jsx("main", { className: "content", children: _jsx(Outlet, {}) })] }));
}
