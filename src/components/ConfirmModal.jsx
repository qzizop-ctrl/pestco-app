// ============================================================================
// In-app replacement for window.confirm() / window.alert().
//
// window.confirm() has the same reliability problem inside the Android
// WebView as window.prompt() (see RejectionReasonModal) — it also blocks
// the whole UI thread, which reads as "frozen" rather than "modern" even
// when it works. This renders a normal React modal instead, driven by
// simple state in App.jsx, so behavior is consistent on every platform.
//
// Two modes:
//   - variant="confirm" (default): Cancel + Confirm buttons, used wherever
//     the app used to call window.confirm(message).
//   - variant="alert": a single dismiss button, used wherever the app used
//     to call window.alert(message).
// ============================================================================

import React from "react";
import { AlertTriangle } from "lucide-react";
import { PRIMARY_MID, DANGER, TEXT, MUTED, LINE, SURFACE } from "../theme";

export default function ConfirmModal({
  t,
  message,
  variant = "confirm",
  danger = false,
  onConfirm,
  onCancel,
}) {
  return (
    <div
      className="flex items-center justify-center"
      style={{ position: "fixed", inset: 0, background: "rgba(0,0,0,.45)", zIndex: 100, padding: 20 }}
      onClick={onCancel}
    >
      <div
        onClick={(e) => e.stopPropagation()}
        className="animate-screen-in"
        style={{ background: SURFACE, borderRadius: 16, padding: 18, width: "100%", maxWidth: 380 }}
      >
        <div className="flex items-start gap-3 mb-4">
          <div
            className="flex items-center justify-center"
            style={{
              width: 36, height: 36, borderRadius: "50%", flexShrink: 0,
              background: danger ? "rgba(179,64,31,.12)" : "rgba(42,95,168,.12)",
              color: danger ? DANGER : PRIMARY_MID,
            }}
          >
            <AlertTriangle size={18} />
          </div>
          <p className="text-sm font-bold leading-6 pt-1" style={{ color: TEXT }}>{message}</p>
        </div>

        <div className="flex gap-3">
          {variant === "confirm" && (
            <button
              onClick={onCancel}
              className="btn-press flex-1 font-bold"
              style={{ background: SURFACE, border: `1px solid ${LINE}`, color: MUTED, borderRadius: 12, padding: "10px 0" }}
            >
              {t.confirmModalCancel}
            </button>
          )}
          <button
            onClick={onConfirm}
            className="btn-press flex-1 font-bold"
            style={{ background: danger ? DANGER : PRIMARY_MID, color: "#fff", borderRadius: 12, padding: "10px 0" }}
          >
            {variant === "confirm" ? t.confirmModalConfirm : t.confirmModalOk}
          </button>
        </div>
      </div>
    </div>
  );
}
