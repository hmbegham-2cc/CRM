import { StrictMode, Suspense, lazy } from "react";
import { createRoot } from "react-dom/client";
import { BrowserRouter, Navigate, Route, Routes } from "react-router-dom";
import { AuthProvider, useAuth } from "./auth";
import { AppLayout } from "./layout";
import { ErrorBoundary } from "./error-boundary";
import { diag, classifyError, networkSnapshot } from "./lib/diag";
import "./styles.css";
import { Toaster } from "sonner";

// ── Diagnostics: capture any uncaught error / promise rejection ────────────
// These two listeners turn silent JavaScript failures into visible
// `[CRC global] ...` lines in DevTools. Run `crcDiag.dump()` in the console
// to copy the last 200 events when reporting an issue to the network admin.
diag.info("boot", `app start ${new Date().toISOString()}`, {
  userAgent: navigator.userAgent,
  ...networkSnapshot(),
});
window.addEventListener("error", (e) => {
  const { category, detail } = classifyError(e.error || e.message);
  diag.error("global", `window.error — ${category}: ${detail}`, {
    filename: e.filename,
    lineno: e.lineno,
    colno: e.colno,
    error: e.error,
  });
});
window.addEventListener("unhandledrejection", (e) => {
  const { category, detail } = classifyError(e.reason);
  diag.error("global", `unhandledrejection — ${category}: ${detail}`, e.reason);
});
window.addEventListener("online", () =>
  diag.info("net", "navigator online", networkSnapshot()),
);
window.addEventListener("offline", () =>
  diag.warn("net", "navigator offline", networkSnapshot()),
);

// All pages are code-split — the big `pages.tsx` chunk is only fetched
// when the user actually navigates somewhere, keeping the initial bundle small.
const lazyPage = <K extends keyof typeof import("./pages")>(name: K) =>
  lazy(async () => {
    const mod = await import("./pages");
    return { default: mod[name] as React.ComponentType };
  });

const LoginPage = lazyPage("LoginPage");
const SetupPasswordPage = lazyPage("SetupPasswordPage");
const ForgotPasswordPage = lazyPage("ForgotPasswordPage");
const DashboardPage = lazyPage("DashboardPage");
const RapportPage = lazyPage("RapportPage");
const MesSaisiesPage = lazyPage("MesSaisiesPage");
const ValidationPage = lazyPage("ValidationPage");
const CampagnesPage = lazyPage("CampagnesPage");
const EquipesPage = lazyPage("EquipesPage");
const UtilisateursPage = lazyPage("UtilisateursPage");
const NotificationsPage = lazyPage("NotificationsPage");
const AllReportsPage = lazyPage("AllReportsPage");
const ExportPage = lazyPage("ExportPage");
const ChangePasswordPage = lazyPage("ChangePasswordPage");

function PageFallback() {
  return (
    <div style={{ padding: 48, textAlign: "center", color: "#64748b" }}>
      Chargement…
    </div>
  );
}

function RequireRole({ roles, children }: { roles: string[]; children: React.ReactNode }) {
  const { user } = useAuth();
  if (!user || !roles.includes(user.role)) {
    return (
      <div style={{ padding: 48, textAlign: "center" }}>
        <h2>Accès refusé</h2>
        <p className="muted">Vous n'avez pas les permissions nécessaires pour accéder à cette page.</p>
      </div>
    );
  }
  return <>{children}</>;
}

function ProtectedApp() {
  const { user, loading } = useAuth();
  if (loading) return <div style={{ padding: 24 }}>Chargement...</div>;
  if (!user) return <Navigate to="/login" replace />;

  return (
    <Suspense fallback={<PageFallback />}>
      <Routes>
        <Route path="/" element={<AppLayout />}>
          <Route index element={<DashboardPage />} />
          <Route path="rapport" element={<RequireRole roles={["TELECONSEILLER","SUPERVISEUR"]}><RapportPage /></RequireRole>} />
          <Route path="mes-saisies" element={<RequireRole roles={["TELECONSEILLER","SUPERVISEUR"]}><MesSaisiesPage /></RequireRole>} />
          <Route path="validation" element={<RequireRole roles={["SUPERVISEUR","ADMIN"]}><ValidationPage /></RequireRole>} />
          <Route path="dashboard" element={<DashboardPage />} />
          <Route path="campagnes" element={<RequireRole roles={["ADMIN"]}><CampagnesPage /></RequireRole>} />
          <Route path="equipes" element={<RequireRole roles={["ADMIN"]}><EquipesPage /></RequireRole>} />
          <Route path="utilisateurs" element={<RequireRole roles={["ADMIN"]}><UtilisateursPage /></RequireRole>} />
          <Route path="notifications" element={<NotificationsPage />} />
          <Route path="tous-les-rapports" element={<RequireRole roles={["SUPERVISEUR","ADMIN"]}><AllReportsPage /></RequireRole>} />
          <Route path="export" element={<RequireRole roles={["ADMIN","SUPERVISEUR"]}><ExportPage /></RequireRole>} />
          <Route path="changer-mot-de-passe" element={<ChangePasswordPage />} />
        </Route>
      </Routes>
    </Suspense>
  );
}

function AppRouter() {
  const { user } = useAuth();
  return (
    <>
      <Toaster
        position="bottom-right"
        richColors
        closeButton
        theme="light"
        expand={true}
        style={{ zIndex: 99999 }}
        toastOptions={{
          style: {
            zIndex: 99999,
            position: "relative",
          },
        }}
      />
      <Suspense fallback={<PageFallback />}>
        <Routes>
          <Route path="/login" element={user ? <Navigate to="/" replace /> : <LoginPage />} />
          <Route path="/setup-password" element={<SetupPasswordPage />} />
          <Route path="/forgot-password" element={<ForgotPasswordPage />} />
          <Route path="/*" element={<ProtectedApp />} />
        </Routes>
      </Suspense>
    </>
  );
}

createRoot(document.getElementById("root")!).render(
  <StrictMode>
    <ErrorBoundary>
      <BrowserRouter>
        <AuthProvider>
          <AppRouter />
        </AuthProvider>
      </BrowserRouter>
    </ErrorBoundary>
  </StrictMode>,
);
