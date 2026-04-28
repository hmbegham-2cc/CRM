import { jsx as _jsx, jsxs as _jsxs, Fragment as _Fragment } from "react/jsx-runtime";
import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import { BrowserRouter, Navigate, Route, Routes } from "react-router-dom";
import { AuthProvider, useAuth } from "./auth";
import { AppLayout } from "./layout";
import "./styles.css";
import { Toaster } from "sonner";
import { CampagnesPage, ChangePasswordPage, DashboardPage, EquipesPage, ExportPage, ForgotPasswordPage, LoginPage, MesSaisiesPage, RapportPage, UtilisateursPage, ValidationPage, SetupPasswordPage, NotificationsPage, AllReportsPage, } from "./pages";
function RequireRole({ roles, children }) {
    const { user } = useAuth();
    if (!user || !roles.includes(user.role)) {
        return (_jsxs("div", { style: { padding: 48, textAlign: "center" }, children: [_jsx("h2", { children: "Acc\u00E8s refus\u00E9" }), _jsx("p", { className: "muted", children: "Vous n'avez pas les permissions n\u00E9cessaires pour acc\u00E9der \u00E0 cette page." })] }));
    }
    return _jsx(_Fragment, { children: children });
}
function ProtectedApp() {
    const { user, loading } = useAuth();
    if (loading)
        return _jsx("div", { style: { padding: 24 }, children: "Chargement..." });
    if (!user)
        return _jsx(Navigate, { to: "/login", replace: true });
    return (_jsx(Routes, { children: _jsxs(Route, { path: "/", element: _jsx(AppLayout, {}), children: [_jsx(Route, { index: true, element: _jsx(DashboardPage, {}) }), _jsx(Route, { path: "rapport", element: _jsx(RequireRole, { roles: ["TELECONSEILLER", "SUPERVISEUR"], children: _jsx(RapportPage, {}) }) }), _jsx(Route, { path: "mes-saisies", element: _jsx(RequireRole, { roles: ["TELECONSEILLER", "SUPERVISEUR"], children: _jsx(MesSaisiesPage, {}) }) }), _jsx(Route, { path: "validation", element: _jsx(RequireRole, { roles: ["SUPERVISEUR", "ADMIN"], children: _jsx(ValidationPage, {}) }) }), _jsx(Route, { path: "dashboard", element: _jsx(DashboardPage, {}) }), _jsx(Route, { path: "campagnes", element: _jsx(RequireRole, { roles: ["ADMIN"], children: _jsx(CampagnesPage, {}) }) }), _jsx(Route, { path: "equipes", element: _jsx(RequireRole, { roles: ["ADMIN"], children: _jsx(EquipesPage, {}) }) }), _jsx(Route, { path: "utilisateurs", element: _jsx(RequireRole, { roles: ["ADMIN"], children: _jsx(UtilisateursPage, {}) }) }), _jsx(Route, { path: "notifications", element: _jsx(NotificationsPage, {}) }), _jsx(Route, { path: "tous-les-rapports", element: _jsx(RequireRole, { roles: ["SUPERVISEUR", "ADMIN"], children: _jsx(AllReportsPage, {}) }) }), _jsx(Route, { path: "export", element: _jsx(RequireRole, { roles: ["ADMIN", "SUPERVISEUR"], children: _jsx(ExportPage, {}) }) }), _jsx(Route, { path: "changer-mot-de-passe", element: _jsx(ChangePasswordPage, {}) })] }) }));
}
function AppRouter() {
    const { user } = useAuth();
    return (_jsxs(_Fragment, { children: [_jsx(Toaster, { position: "bottom-right", richColors: true, closeButton: true, theme: "light", expand: true, style: { zIndex: 99999 }, toastOptions: {
                    style: {
                        zIndex: 99999,
                        position: 'relative'
                    }
                } }), _jsxs(Routes, { children: [_jsx(Route, { path: "/login", element: user ? _jsx(Navigate, { to: "/", replace: true }) : _jsx(LoginPage, {}) }), _jsx(Route, { path: "/setup-password", element: _jsx(SetupPasswordPage, {}) }), _jsx(Route, { path: "/forgot-password", element: _jsx(ForgotPasswordPage, {}) }), _jsx(Route, { path: "/*", element: _jsx(ProtectedApp, {}) })] })] }));
}
createRoot(document.getElementById("root")).render(_jsx(StrictMode, { children: _jsx(BrowserRouter, { children: _jsx(AuthProvider, { children: _jsx(AppRouter, {}) }) }) }));
