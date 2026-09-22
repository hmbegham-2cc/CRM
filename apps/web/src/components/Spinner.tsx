import type { CSSProperties } from "react";

export function Spinner({ size = 20, style }: { size?: number; style?: CSSProperties }) {
  return (
    <div
      className="loader-ring"
      style={{ width: size, height: size, borderWidth: Math.max(2, Math.round(size / 10)), ...style }}
    />
  );
}

export function LoadingState({ label, compact = false }: { label: string; compact?: boolean }) {
  return (
    <div className={compact ? "loading-state loading-state--compact" : "loading-state"}>
      <Spinner size={compact ? 24 : 40} />
      <div className="muted">{label}</div>
    </div>
  );
}
