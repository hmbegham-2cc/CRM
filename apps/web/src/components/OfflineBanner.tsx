import { useEffect, useState } from "react";
import { WifiOff } from "lucide-react";

/**
 * Shows a sticky banner at the top of the viewport whenever the browser
 * reports `navigator.onLine === false`. Useful so users don't lose data
 * by clicking submit while disconnected.
 */
export function OfflineBanner() {
  const [online, setOnline] = useState(
    typeof navigator !== "undefined" ? navigator.onLine : true,
  );

  useEffect(() => {
    const onOnline = () => setOnline(true);
    const onOffline = () => setOnline(false);
    window.addEventListener("online", onOnline);
    window.addEventListener("offline", onOffline);
    return () => {
      window.removeEventListener("online", onOnline);
      window.removeEventListener("offline", onOffline);
    };
  }, []);

  if (online) return null;

  return (
    <div
      role="alert"
      style={{
        position: "sticky",
        top: 0,
        zIndex: 9999,
        background: "#fef3c7",
        color: "#78350f",
        borderBottom: "1px solid #fcd34d",
        padding: "10px 16px",
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        gap: 8,
        fontSize: 14,
        fontWeight: 600,
      }}
    >
      <WifiOff size={16} />
      Vous êtes hors ligne. Les modifications ne seront pas enregistrées tant que la connexion n'est pas rétablie.
    </div>
  );
}
