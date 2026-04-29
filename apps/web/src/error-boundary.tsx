import { Component, type ErrorInfo, type ReactNode } from "react";

interface Props {
  children: ReactNode;
}

interface State {
  error: Error | null;
}

export class ErrorBoundary extends Component<Props, State> {
  state: State = { error: null };

  static getDerivedStateFromError(error: Error): State {
    return { error };
  }

  componentDidCatch(error: Error, info: ErrorInfo) {
    console.error("[ErrorBoundary]", error, info);
  }

  handleReload = () => {
    this.setState({ error: null });
    window.location.reload();
  };

  handleHome = () => {
    this.setState({ error: null });
    window.location.href = "/";
  };

  render() {
    if (!this.state.error) return this.props.children;

    return (
      <div
        style={{
          minHeight: "100vh",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          padding: 24,
          background: "#f8fafc",
        }}
      >
        <div
          className="card"
          style={{
            maxWidth: 520,
            padding: 32,
            textAlign: "center",
            background: "#fff",
            border: "1px solid #e2e8f0",
            borderRadius: 12,
            boxShadow: "0 4px 12px rgba(0,0,0,0.05)",
          }}
        >
          <div
            style={{
              width: 64,
              height: 64,
              margin: "0 auto 16px",
              background: "rgba(239,68,68,0.1)",
              borderRadius: 16,
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              fontSize: 32,
            }}
          >
            ⚠️
          </div>
          <h2 style={{ marginBottom: 8 }}>Une erreur est survenue</h2>
          <p style={{ color: "#64748b", marginBottom: 24 }}>
            L'application a rencontré un problème inattendu. Vous pouvez essayer de
            recharger la page ou de revenir à l'accueil.
          </p>
          {import.meta.env.DEV && (
            <pre
              style={{
                textAlign: "left",
                background: "#0f172a",
                color: "#f8fafc",
                padding: 12,
                borderRadius: 8,
                fontSize: 12,
                overflow: "auto",
                maxHeight: 160,
                marginBottom: 16,
              }}
            >
              {this.state.error.stack || this.state.error.message}
            </pre>
          )}
          <div style={{ display: "flex", gap: 8, justifyContent: "center" }}>
            <button className="btn btn-primary" onClick={this.handleReload}>
              Recharger
            </button>
            <button className="btn" onClick={this.handleHome}>
              Accueil
            </button>
          </div>
        </div>
      </div>
    );
  }
}
