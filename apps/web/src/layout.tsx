import { Link, Outlet, useLocation } from "react-router-dom";
import { useState, useEffect } from "react";
import { useAuth } from "./auth";
import { supabase } from "./supabase";
import { OfflineBanner } from "./components/OfflineBanner";
import { ConnectionBanner } from "./components/ConnectionBanner";
import {
  LayoutDashboard,
  FileEdit,
  History,
  CheckCircle,
  Settings,
  Users,
  Database,
  Download,
  LogOut,
  Bell,
  Key,
} from "lucide-react";

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
    let cancelled = false;
    const checkUnread = async () => {
      // Skip the poll when the tab is hidden: any HTTP/2 connection kept
      // alive while the user was on another tab is likely killed by the
      // corporate proxy, so polling here just produces ERR_CONNECTION_CLOSED
      // noise. We'll re-check as soon as the tab regains focus.
      if (typeof document !== "undefined" && document.visibilityState === "hidden") return;
      try {
        const { data } = await supabase.from("Notification").select("id, read").eq("read", false).limit(1);
        if (!cancelled) setHasUnread((data || []).length > 0);
      } catch {
        // Don't reset the badge on transient network failures — keep the
        // last known state to avoid flickering.
      }
    };
    checkUnread();
    const interval = setInterval(checkUnread, 60000);
    const onVisible = () => {
      if (document.visibilityState === "visible") checkUnread();
    };
    document.addEventListener("visibilitychange", onVisible);
    return () => {
      cancelled = true;
      clearInterval(interval);
      document.removeEventListener("visibilitychange", onVisible);
    };
  }, [location.pathname]);

  return (
    <div className="layout">
      <aside className="sidebar">
        <div className="brand">
          <img src="/logo.png" alt="2C Conseil" style={{ maxWidth: '100%', height: 'auto', display: 'block' }} />
        </div>
        
        <nav style={{ flex: 1 }}>
          {filteredMenu.map((item) => {
            const Icon = item.icon;
            const isActive = location.pathname === item.path;
            return (
              <Link 
                key={item.path} 
                to={item.path} 
                className={`nav-link ${isActive ? "active" : ""}`}
                style={{ position: 'relative' }}
              >
                <Icon size={20} />
                <span>{item.label}</span>
                {item.path === '/notifications' && hasUnread && (
                  <div style={{
                    position: 'absolute',
                    top: '8px',
                    left: '32px',
                    width: '8px',
                    height: '8px',
                    background: 'var(--danger)',
                    borderRadius: '50%',
                    border: '2px solid #1e293b'
                  }} />
                )}
              </Link>
            );
          })}
        </nav>

        <div className="user-info" style={{ marginTop: "auto", padding: "12px", borderTop: "1px solid #334155" }}>
          <div className="user-info-text" style={{ marginBottom: "16px", padding: "0 12px" }}>
            <div style={{ fontSize: "14px", fontWeight: 600, color: "#fff" }}>{user?.name || "Utilisateur"}</div>
            <div style={{ fontSize: "12px", color: "#94a3b8" }}>{user?.email}</div>
          </div>
          <Link to="/changer-mot-de-passe" style={{ display: "flex", alignItems: "center", gap: "8px", padding: "8px 12px", color: "#94a3b8", textDecoration: "none", fontSize: "13px", borderRadius: "8px", marginBottom: "8px", transition: "all 0.2s" }}>
            <Key size={16} />
            <span>Changer le mot de passe</span>
          </Link>
          <button 
            className="btn btn-danger" 
            style={{ width: "100%", justifyContent: "center" }}
            onClick={logout}
          >
            <LogOut size={18} />
            <span className="logout-text">Déconnexion</span>
          </button>
        </div>
      </aside>

      <main className="content">
        <OfflineBanner />
        <ConnectionBanner />
        <Outlet />
      </main>
    </div>
  );
}
