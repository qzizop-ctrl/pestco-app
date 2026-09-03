import React from "react";
import ReactDOM from "react-dom/client";
import "./index.css";

const rootEl = document.getElementById("root");

function showFatalError(err) {
  console.error("Fatal startup error:", err);
  rootEl.innerHTML = `
    <div style="padding:24px;font-family:sans-serif;color:#c00;background:#fff">
      <h2>حصل خطأ عند تشغيل التطبيق</h2>
      <pre style="white-space:pre-wrap;font-size:13px;background:#f5f5f5;padding:12px;border-radius:6px">${(err && err.stack) || err}</pre>
    </div>`;
}

async function bootstrap() {
  try {
    const { default: App } = await import("./App.jsx");
    const { default: ErrorBoundary } = await import("./ErrorBoundary.jsx");

    ReactDOM.createRoot(rootEl).render(
      <React.StrictMode>
        <ErrorBoundary>
          <App />
        </ErrorBoundary>
      </React.StrictMode>
    );
  } catch (err) {
    showFatalError(err);
  }
}

bootstrap();
