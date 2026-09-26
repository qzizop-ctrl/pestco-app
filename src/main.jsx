import React from "react";
import ReactDOM from "react-dom/client";
import "./index.css";
import { initErrorReporting, reportException } from "./sentry";
import { registerServiceWorker } from "./registerServiceWorker";

initErrorReporting();

const rootEl = document.getElementById("root");

function showFatalError(err) {
  console.error("Fatal startup error:", err);
  reportException(err, { context: "Fatal startup error" });
  // Built with DOM nodes + textContent (not innerHTML): the error text can
  // contain arbitrary strings (a failed import URL, a message from a
  // response body) and must never be parsed as HTML.
  const box = document.createElement("div");
  box.style.cssText = "padding:24px;font-family:sans-serif;color:#c00;background:#fff";
  const title = document.createElement("h2");
  title.textContent = "حصل خطأ عند تشغيل التطبيق";
  const details = document.createElement("pre");
  details.style.cssText = "white-space:pre-wrap;font-size:13px;background:#f5f5f5;padding:12px;border-radius:6px";
  details.textContent = String((err && err.stack) || err);
  box.append(title, details);
  rootEl.replaceChildren(box);
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
registerServiceWorker();
