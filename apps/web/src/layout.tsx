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
  BarChart3,
} from "lucide-react";

export function AppLayout() {
  const { user, logout } = useAuth();
  const location = useLocation();

  const menuSections = [
    {
      title: "Mon espace",
      items: [
        { path: "/", label: "Dashboard", icon: Database, roles: ["TELECONSEILLER", "SUPERVISEUR", "ADMIN", "COACH_QUALITE"] },
        { path: "/rapport", label: "Mon rapport", icon: FileEdit, roles: ["TELECONSEILLER", "SUPERVISEUR"] },
        { path: "/mes-saisies", label: "Mes saisies", icon: History, roles: ["TELECONSEILLER", "SUPERVISEUR"] },
        { path: "/notifications", label: "Notifications", icon: Bell, roles: ["TELECONSEILLER", "SUPERVISEUR", "ADMIN", "COACH_QUALITE"] },
      ]
    },
    {
      title: "Gestion & Validation",
      items: [
        { path: "/tous-les-rapports", label: "Tous les rapports", icon: LayoutDashboard, roles: ["SUPERVISEUR", "ADMIN", "COACH_QUALITE"] },
        { path: "/validation", label: "Validation", icon: CheckCircle, roles: ["SUPERVISEUR", "ADMIN", "COACH_QUALITE"] },
        { path: "/reporting-campagnes", label: "Reporting Campagnes", icon: BarChart3, roles: ["SUPERVISEUR", "ADMIN", "COACH_QUALITE"] },
      ]
    },
    {
      title: "Administration",
      items: [
        { path: "/campagnes", label: "Campagnes", icon: Settings, roles: ["ADMIN", "COACH_QUALITE"] },
        { path: "/equipes", label: "Équipes", icon: Users, roles: ["ADMIN", "COACH_QUALITE"] },
        { path: "/utilisateurs", label: "Utilisateurs", icon: Users, roles: ["ADMIN", "COACH_QUALITE"] },
        { path: "/export", label: "Export Excel", icon: Download, roles: ["ADMIN", "SUPERVISEUR", "COACH_QUALITE"] },
      ]
    },
  ];

  const filteredSections = menuSections.map(section => ({
    ...section,
    items: section.items.filter(item => item.roles.includes(user?.role || ""))
  })).filter(section => section.items.length > 0);
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
        if (!user?.id) {
          if (!cancelled) setHasUnread(false);
          return;
        }
        const { data, error } = await supabase
          .from("Notification")
          .select("id, read")
          .eq("userId", user.id)
          .eq("read", false)
          .limit(1);
        if (error) throw error;
        if (!cancelled) setHasUnread((data || []).length > 0);
      } catch (err) {
        console.warn("[Layout] unread notifications check failed", err);
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
  }, [location.pathname, user?.id]);

  return (
    <div className="layout">
      <aside className="sidebar">
        <div className="brand">
          <img src="/logo.png" alt="2C Conseil" style={{ maxWidth: '100%', height: 'auto', display: 'block' }} />
        </div>
        
        <nav style={{ flex: 1, overflowY: 'auto' }}>
          {filteredSections.map((section) => (
            <div key={section.title} style={{ marginBottom: '16px' }}>
              <div style={{
                padding: '8px 12px 4px',
                fontSize: '11px',
                fontWeight: 600,
                textTransform: 'uppercase',
                letterSpacing: '0.5px',
                color: '#64748b',
              }}>
                {section.title}
              </div>
              {section.items.map((item: { path: string; label: string; icon: React.ComponentType<{ size: number }>; roles: string[] }) => {
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
            </div>
          ))}
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
