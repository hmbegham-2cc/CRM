import { useEffect, useState } from "react";
import { AlertTriangle, RefreshCw } from "lucide-react";
import { connectionHealth, type HealthState } from "../lib/connection-health";
import { forceReconnect } from "../supabase";

/**
 * Sticky banner that appears when several Supabase requests have failed in
 * a short window (typical signature of a corporate proxy killing keep-alive
 * connections). Gives the user a one-click way to refresh the session and
 * reload the current page if needed.
 */
export function ConnectionBanner() {
  const [state, setState] = useState<HealthState>(connectionHealth.state);
  const [busy, setBusy] = useState(false);

  useEffect(() => connectionHealth.subscribe(setState), []);

  if (state === "healthy") return null;

  const isDown = state === "down";
  const bg = isDown ? "#fee2e2" : "#fef3c7";
  const border = isDown ? "#fca5a5" : "#fcd34d";
  const fg = isDown ? "#7f1d1d" : "#78350f";

  return (
    <div
      role="alert"
      style={{
        position: "sticky",
        top: 0,
        zIndex: 9998,
        background: bg,
        color: fg,
        borderBottom: `1px solid ${border}`,
        padding: "10px 16px",
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        gap: 12,
        fontSize: 14,
        fontWeight: 600,
      }}
    >
      <AlertTriangle size={16} />
      <span>
        {isDown
          ? "Connexion instable — certaines requêtes échouent."
          : "Connexion lente ou intermittente."}
      </span>
      <button
        type="button"
        disabled={busy}
        onClick={async () => {
          setBusy(true);
          try {
            await forceReconnect();
            // Give the SDK a moment to settle before reloading.
            await new Promise((r) => setTimeout(r, 300));
            window.location.reload();
          } finally {
            setBusy(false);
          }
        }}
        style={{
          display: "inline-flex",
          alignItems: "center",
          gap: 6,
          padding: "4px 12px",
          borderRadius: 8,
          border: `1px solid ${fg}`,
          background: "transparent",
          color: fg,
          fontWeight: 700,
          cursor: busy ? "wait" : "pointer",
          fontSize: 13,
        }}
      >
        <RefreshCw size={14} className={busy ? "spin" : undefined} />
        {busy ? "Reconnexion…" : "Reconnecter"}
      </button>
    </div>
  );
}
