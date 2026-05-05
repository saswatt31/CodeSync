"use client";
import { Component } from "react";

/**
 * M-6: Global React Error Boundary.
 * Catches render errors from any child component tree and shows a safe fallback
 * instead of crashing the entire application with a white screen.
 */
export default class ErrorBoundary extends Component {
  constructor(props) {
    super(props);
    this.state = { hasError: false, error: null };
  }

  static getDerivedStateFromError(error) {
    return { hasError: true, error };
  }

  componentDidCatch(error, info) {
    console.error("🔥 Unhandled render error caught by ErrorBoundary:", error, info);
  }

  render() {
    if (this.state.hasError) {
      return (
        <div
          style={{
            minHeight: "100vh",
            display: "flex",
            flexDirection: "column",
            alignItems: "center",
            justifyContent: "center",
            background: "#0a0a0a",
            color: "#e8e8e8",
            fontFamily: "monospace",
            gap: "1rem",
            padding: "2rem",
          }}
        >
          <div style={{ fontSize: "2rem" }}>⚠️</div>
          <h2 style={{ color: "#ff4444", margin: 0 }}>Something went wrong</h2>
          <p style={{ color: "#666", maxWidth: "480px", textAlign: "center", lineHeight: 1.6 }}>
            {this.state.error?.message || "An unexpected error occurred."}
          </p>
          <button
            onClick={() => {
              this.setState({ hasError: false, error: null });
              window.location.href = "/dashboard";
            }}
            style={{
              padding: "0.625rem 1.5rem",
              borderRadius: "0.75rem",
              background: "rgba(0,255,136,0.1)",
              border: "1px solid rgba(0,255,136,0.3)",
              color: "#00ff88",
              cursor: "pointer",
              fontFamily: "monospace",
              fontSize: "0.875rem",
            }}
          >
            ← Return to dashboard
          </button>
        </div>
      );
    }

    return this.props.children;
  }
}
