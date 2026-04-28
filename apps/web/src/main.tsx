import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import { BrowserRouter, Navigate, Route, Routes } from "react-router-dom";
import { AuthProvider, useAuth } from "./auth";
import { AppLayout } from "./layout";
import "./styles.css";
import { Toaster } from "sonner";
import {
  CampagnesPage,
  ChangePasswordPage,
  DashboardPage,
  EquipesPage,
  ExportPage,
  ForgotPasswordPage,
  LoginPage,
  MesSaisiesPage,
  RapportPage,
  UtilisateursPage,
  ValidationPage,
  SetupPasswordPage,
  NotificationsPage,
  AllReportsPage,
} from "./pages";

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
            position: 'relative'
          }
        }}
      />
      <Routes>
        <Route path="/login" element={user ? <Navigate to="/" replace /> : <LoginPage />} />
        <Route path="/setup-password" element={<SetupPasswordPage />} />
        <Route path="/forgot-password" element={<ForgotPasswordPage />} />
        <Route path="/*" element={<ProtectedApp />} />
      </Routes>
    </>
  );
}

createRoot(document.getElementById("root")!).render(
  <StrictMode>
    <BrowserRouter>
      <AuthProvider>
        <AppRouter />
      </AuthProvider>
    </BrowserRouter>
  </StrictMode>,
);
