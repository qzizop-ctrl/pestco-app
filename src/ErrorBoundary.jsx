import React from "react";
import { AlertTriangle, RefreshCw, ChevronDown } from "lucide-react";
import { reportException } from "./sentry";

// Friendly copy for the two languages the app supports. Kept local (not in
// constants.js/STRINGS) since this component has to render even if the rest
// of the app's state — including language selection — never finished
// loading, and it can't rely on any other module having initialized.
const COPY = {
  ar: {
    title: "حصل خطأ غير متوقع",
    body: "التطبيق واجه مشكلة ومحتاج يعيد تحميل نفسه. بياناتك محفوظة على السيرفر ومش هتتأثر.",
    reload: "إعادة تحميل",
    details: "تفاصيل تقنية (للدعم الفني)",
  },
  en: {
    title: "Something went wrong",
    body: "The app hit a problem and needs to reload. Your data is saved on the server and won't be affected.",
    reload: "Reload",
    details: "Technical details (for support)",
  },
};

function getLang() {
  try {
    const saved = localStorage.getItem("pestco_lang");
    return saved === "en" ? "en" : "ar";
  } catch (e) {
    return "ar";
  }
}

export default class ErrorBoundary extends React.Component {
  constructor(props) {
    super(props);
    this.state = { error: null, info: null, showDetails: false };
  }

  static getDerivedStateFromError(error) {
    return { error };
  }

  componentDidCatch(error, info) {
    this.setState({ info });
    // Also log to the device console in case the person can pull logs later.
    console.error("App crashed:", error, info);
    reportException(error, { componentStack: info?.componentStack });
  }

  render() {
    if (this.state.error) {
      const lang = getLang();
      const c = COPY[lang];
      const dir = lang === "ar" ? "rtl" : "ltr";

      return (
        <div
          dir={dir}
          style={{
            minHeight: "100vh",
            display: "flex",
            flexDirection: "column",
            alignItems: "center",
            justifyContent: "center",
            padding: 24,
            background: "#0F2E5E",
            color: "#fff",
            fontFamily: "'Tajawal', sans-serif",
            textAlign: "center",
          }}
        >
          <div
            style={{
              width: 56, height: 56, borderRadius: "50%",
              background: "rgba(255,255,255,.12)",
              display: "flex", alignItems: "center", justifyContent: "center",
              marginBottom: 16,
            }}
          >
            <AlertTriangle size={28} color="#FFD166" />
          </div>

          <h2 style={{ fontSize: 18, fontWeight: 800, marginBottom: 8 }}>{c.title}</h2>
          <p style={{ fontSize: 14, opacity: 0.85, maxWidth: 320, lineHeight: 1.7, marginBottom: 20 }}>
            {c.body}
          </p>

          <button
            onClick={() => window.location.reload()}
            className="btn-press"
            style={{
              display: "flex", alignItems: "center", gap: 8,
              background: "#C08A3E", color: "#fff", border: "none",
              borderRadius: 12, padding: "12px 24px", fontWeight: 800, fontSize: 14,
            }}
          >
            <RefreshCw size={16} /> {c.reload}
          </button>

          <button
            onClick={() => this.setState((s) => ({ showDetails: !s.showDetails }))}
            className="btn-press"
            style={{
              display: "flex", alignItems: "center", gap: 6,
              background: "transparent", border: "none", color: "rgba(255,255,255,.6)",
              fontSize: 12, marginTop: 28, cursor: "pointer",
            }}
          >
            {c.details}
            <ChevronDown
              size={14}
              style={{ transform: this.state.showDetails ? "rotate(180deg)" : "none", transition: "transform 150ms" }}
            />
          </button>

          {this.state.showDetails && (
            <div
              dir="ltr"
              style={{
                marginTop: 12,
                width: "100%",
                maxWidth: 480,
                textAlign: "left",
                background: "rgba(0,0,0,.25)",
                borderRadius: 12,
                padding: 14,
                fontFamily: "monospace",
                fontSize: 11,
                lineHeight: 1.6,
                whiteSpace: "pre-wrap",
                overflow: "auto",
                maxHeight: 240,
                color: "rgba(255,255,255,.8)",
              }}
            >
              <div style={{ marginBottom: 10 }}>
                <strong>Error:</strong>
                <div>{String(this.state.error && this.state.error.message)}</div>
              </div>
              <div style={{ marginBottom: 10 }}>
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
          )}
        </div>
      );
    }
    return this.props.children;
  }
}
