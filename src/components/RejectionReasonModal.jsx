// ============================================================================
// In-app replacement for window.prompt() when rejecting an offer.
//
// window.prompt() is unreliable inside the Android WebView the app ships
// in via Capacitor — some WebView versions silently return null instead of
// showing a dialog, which meant a rejection could be saved with an empty
// reason with no indication anything went wrong. This modal is built with
// ordinary React state instead, so it works the same on every platform.
//
// Reason capture is now two-step (see domain.js#REJECTION_REASON_IDS):
// pick a predefined reason from a dropdown, and only type free text when
// "other" is picked. This is what feeds the Dashboard's rejection-reasons
// report — grouping by reasonId only works if most rejections use one of
// the fixed ids instead of arbitrary free text.
// ============================================================================

import { useState } from "react";
import { X } from "lucide-react";
import { PRIMARY_MID, TEXT, MUTED, LINE, SURFACE } from "../theme";
import { REJECTION_REASON_IDS } from "../domain";

export default function RejectionReasonModal({ t, initialReasonId, initialReasonText, onConfirm, onCancel }) {
  const [reasonId, setReasonId] = useState(initialReasonId || "");
  const [otherText, setOtherText] = useState(initialReasonText || "");

  const isOther = reasonId === "other";

  const handleConfirm = () => {
    // reasonId left blank counts as "other" with whatever free text (if
    // any) was typed — keeps the old "just type something, or leave it
    // blank" behavior available instead of forcing a choice.
    const finalId = reasonId || "other";
    const label = finalId === "other" ? otherText.trim() : (t.rejectionReasons[finalId] || finalId);
    onConfirm({ reasonId: finalId, label });
  };

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

        <label className="text-xs font-bold mb-1 block" style={{ color: MUTED }}>
          {t.rejectionModalReasonLabel}
        </label>
        <select
          className="field-bare mb-3"
          value={reasonId}
          onChange={(e) => setReasonId(e.target.value)}
          style={{ width: "100%" }}
        >
          <option value="" disabled>{t.rejectionModalReasonPlaceholder}</option>
          {REJECTION_REASON_IDS.map((id) => (
            <option key={id} value={id}>{t.rejectionReasons[id]}</option>
          ))}
        </select>

        {isOther && (
          <>
            <label className="text-xs font-bold mb-1 block" style={{ color: MUTED }}>
              {t.rejectionModalOtherLabel}
            </label>
            <textarea
              autoFocus
              rows={3}
              value={otherText}
              onChange={(e) => setOtherText(e.target.value)}
              placeholder={t.rejectionModalPlaceholder}
              style={{ width: "100%" }}
            />
          </>
        )}

        <div className="flex gap-3 mt-4">
          <button
            onClick={onCancel}
            className="btn-press flex-1 font-bold"
            style={{ background: SURFACE, border: `1px solid ${LINE}`, color: MUTED, borderRadius: 12, padding: "10px 0" }}
          >
            {t.rejectionModalCancel}
          </button>
          <button
            onClick={handleConfirm}
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
