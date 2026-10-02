// Shared markup for the bottom sheets and centered confirm dialogs.
//
// Why this exists: each of these used to be a <div role="presentation"
// onClick> backdrop wrapping a <div role="dialog">. Static analysis
// (Sonar S6819) wants the native elements instead of ARIA roles on divs, so:
//
//   ModalOverlay — the fixed full-screen layer. The dimmed backdrop is a real
//                  (non-tabbable, aria-hidden) <button> behind the dialog, so
//                  "tap outside to close" no longer needs a click handler on
//                  a non-interactive element.
//   ModalDialog  — a native <dialog open>. Browsers give <dialog> its own
//                  default look (absolute position, border, auto margins,
//                  canvas colors); the reset below turns that off so the
//                  inline styles each sheet passes in behave exactly as they
//                  did on the old <div>.

const ALIGN_CLASS = {
  end: "flex items-end justify-center",
  center: "flex items-center justify-center",
};

const BACKDROP_STYLE = {
  position: "absolute",
  inset: 0,
  width: "100%",
  height: "100%",
  margin: 0,
  padding: 0,
  border: "none",
  background: "rgba(0,0,0,.45)",
  cursor: "default",
};

const DIALOG_RESET = {
  position: "relative",
  margin: 0,
  border: "none",
  color: "inherit",
  maxHeight: "none",
};

export function ModalOverlay({ onClose, align = "end", zIndex = 90, padding, children }) {
  return (
    <div className={ALIGN_CLASS[align] ?? ALIGN_CLASS.end} style={{ position: "fixed", inset: 0, zIndex, padding }}>
      <button type="button" tabIndex={-1} aria-hidden="true" onClick={onClose} style={BACKDROP_STYLE} />
      {children}
    </div>
  );
}

export function ModalDialog({ style, children, ...rest }) {
  return (
    <dialog open aria-modal="true" style={{ ...DIALOG_RESET, ...style }} {...rest}>
      {children}
    </dialog>
  );
}

export default ModalOverlay;
