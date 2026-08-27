import React from "react";

export default class ErrorBoundary extends React.Component {
  constructor(props) {
    super(props);
    this.state = { error: null, info: null };
  }

  static getDerivedStateFromError(error) {
    return { error };
  }

  componentDidCatch(error, info) {
    this.setState({ info });
    // Also log to the device console in case the person can pull logs later.
    console.error("App crashed:", error, info);
  }

  render() {
    if (this.state.error) {
      return (
        <div
          style={{
            minHeight: "100vh",
            padding: 20,
            background: "#2A1414",
            color: "#FFD9D9",
            fontFamily: "monospace",
            fontSize: 13,
            direction: "ltr",
            textAlign: "left",
            whiteSpace: "pre-wrap",
            overflow: "auto",
          }}
        >
          <h2 style={{ color: "#FF6B6B", marginBottom: 10 }}>App crashed — please screenshot this and send it back</h2>
          <div style={{ marginBottom: 14 }}>
            <strong>Error:</strong>
            <div>{String(this.state.error && this.state.error.message)}</div>
          </div>
          <div style={{ marginBottom: 14 }}>
            <strong>Stack:</strong>
            <div>{this.state.error && this.state.error.stack}</div>
          </div>
          {this.state.info && (
            <div>
              <strong>Component stack:</strong>
              <div>{this.state.info.componentStack}</div>
            </div>
          )}
        </div>
      );
    }
    return this.props.children;
  }
}
