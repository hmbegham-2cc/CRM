import { useEffect, useRef } from "react";

export interface ConfirmModalProps {
  open: boolean;
  title: string;
  message: React.ReactNode;
  confirmLabel?: string;
  cancelLabel?: string;
  variant?: "danger" | "primary";
  busy?: boolean;
  onConfirm: () => void;
  onCancel: () => void;
}

/**
 * Reusable confirm dialog (Esc to cancel, click backdrop to cancel,
 * autofocus on cancel for safety on destructive actions).
 */
export function ConfirmModal({
  open,
  title,
  message,
  confirmLabel = "Confirmer",
  cancelLabel = "Annuler",
  variant = "danger",
  busy = false,
  onConfirm,
  onCancel,
}: ConfirmModalProps) {
  const cancelBtn = useRef<HTMLButtonElement>(null);

  useEffect(() => {
    if (!open) return;
    cancelBtn.current?.focus();
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape" && !busy) onCancel();
    };
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, [open, busy, onCancel]);

  if (!open) return null;

  const confirmClass = variant === "danger" ? "btn btn-danger" : "btn btn-primary";

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-labelledby="confirm-title"
      onClick={() => !busy && onCancel()}
      style={{
        position: "fixed",
        inset: 0,
        background: "rgba(15, 23, 42, 0.55)",
        zIndex: 10000,
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        padding: 16,
      }}
    >
      <div
        onClick={(e) => e.stopPropagation()}
        style={{
          background: "#fff",
          borderRadius: 12,
          padding: 24,
          maxWidth: 460,
          width: "100%",
          boxShadow: "0 20px 50px rgba(0,0,0,0.25)",
        }}
      >
        <h3 id="confirm-title" style={{ marginTop: 0, marginBottom: 12 }}>{title}</h3>
        <div style={{ color: "#475569", marginBottom: 24, lineHeight: 1.5 }}>{message}</div>
        <div style={{ display: "flex", justifyContent: "flex-end", gap: 8 }}>
          <button
            ref={cancelBtn}
            className="btn btn-secondary"
            onClick={onCancel}
            disabled={busy}
          >
            {cancelLabel}
          </button>
          <button className={confirmClass} onClick={onConfirm} disabled={busy}>
            {busy ? "..." : confirmLabel}
          </button>
        </div>
      </div>
    </div>
  );
}
