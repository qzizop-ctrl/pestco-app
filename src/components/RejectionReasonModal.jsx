// ============================================================================
// In-app replacement for window.prompt() when rejecting an offer.
//
// window.prompt() is unreliable inside the Android WebView the app ships
// in via Capacitor — some WebView versions silently return null instead of
// showing a dialog, which meant a rejection could be saved with an empty
// reason with no indication anything went wrong. This modal is built with
// ordinary React state instead, so it works the same on every platform.
// ============================================================================

import React, { useState } from "react";
import { X } from "lucide-react";
import { PRIMARY_MID, TEXT, MUTED, LINE, SURFACE } from "../constants";

export default function RejectionReasonModal({ t, initialReason, onConfirm, onCancel }) {
  const [reason, setReason] = useState(initialReason || "");

  return (
    <div
      className="flex items-center justify-center"
      style={{
        position: "fixed",
        inset: 0,
        background: "rgba(0,0,0,.45)",
        zIndex: 100,
        padding: 20,
      }}
      onClick={onCancel}
    >
      <div
        onClick={(e) => e.stopPropagation()}
        style={{
          background: SURFACE,
          borderRadius: 16,
          padding: 18,
          width: "100%",
          maxWidth: 380,
        }}
      >
        <div className="flex items-center justify-between mb-3">
          <span className="font-bold text-base" style={{ color: TEXT }}>{t.rejectionModalTitle}</span>
          <button
            onClick={onCancel}
            className="btn-press flex items-center justify-center"
            style={{ color: MUTED }}
            aria-label={t.rejectionModalCancel}
          >
            <X size={18} />
          </button>
        </div>

        <textarea
          autoFocus
          rows={3}
          value={reason}
          onChange={(e) => setReason(e.target.value)}
          placeholder={t.rejectionModalPlaceholder}
          style={{ width: "100%" }}
        />

        <div className="flex gap-3 mt-4">
          <button
            onClick={onCancel}
            className="btn-press flex-1 font-bold"
            style={{ background: SURFACE, border: `1px solid ${LINE}`, color: MUTED, borderRadius: 12, padding: "10px 0" }}
          >
            {t.rejectionModalCancel}
          </button>
          <button
            onClick={() => onConfirm(reason.trim())}
            className="btn-press flex-1 font-bold"
            style={{ background: PRIMARY_MID, color: "#fff", borderRadius: 12, padding: "10px 0" }}
          >
            {t.rejectionModalConfirm}
          </button>
        </div>
      </div>
    </div>
  );
}
