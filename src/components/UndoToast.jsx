import { PRIMARY, GOLD } from "../theme";

// Floating "X deleted — Undo" toast, shown after deleting a customer or a
// supplier. Was duplicated verbatim in App.jsx for the two cases; this is
// the one shared version, driven entirely by props.
export default function UndoToast({ companyName, onUndo, isRootScreen, t }) {
  return (
    <div
      className="flex items-center justify-between gap-3"
      style={{
        position: "fixed",
        left: 16,
        right: 16,
        bottom: isRootScreen ? 78 : 16,
        background: PRIMARY,
        color: "#fff",
        borderRadius: 14,
        padding: "12px 16px",
        boxShadow: "0 8px 20px rgba(0,0,0,.25)",
        zIndex: 30,
      }}
    >
      <span className="text-sm font-bold">{t.deletedUndoMsg(companyName || "")}</span>
      <button
        onClick={onUndo}
        className="btn-press font-extrabold text-sm flex-shrink-0"
        style={{ color: GOLD }}
      >
        {t.undoBtn}
      </button>
    </div>
  );
}
