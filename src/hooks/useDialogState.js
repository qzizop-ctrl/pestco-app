import { useCallback, useState } from "react";

// The in-app confirm/alert modal state, plus the rejection-reason prompt.
// Pulled out of App.jsx (which had grown large) — this is pure UI state
// with no dependency on any other hook, so moving it here changes nothing
// about behavior or call order; it's created at the same point in App()
// and destructured with the same names as before.
export function useDialogState() {
  // Drives the in-app rejection-reason modal (replaces window.prompt).
  // { initialReason, onConfirm(reason) } while the modal is open, else null.
  const [rejectionPrompt, setRejectionPrompt] = useState(null);
  // Drives the generic in-app confirm/alert modal (replaces window.confirm
  // and window.alert). { message, variant: "confirm"|"alert", danger, onConfirm }
  const [confirmDialog, setConfirmDialog] = useState(null);
  // Replacement for `if (!window.confirm(msg)) return; doThing();` — pass the
  // message and a callback to run only if the user confirms.
  const confirmAction = useCallback((message, onConfirm, { danger = false } = {}) => {
    setConfirmDialog({ message, variant: "confirm", danger, onConfirm });
  }, []);
  // Replacement for window.alert(msg) — shows the same message, but as a
  // dismissible in-app modal instead of a blocking native dialog.
  const showAlert = useCallback((message) => {
    setConfirmDialog({ message, variant: "alert", onConfirm: () => setConfirmDialog(null) });
  }, []);

  return {
    rejectionPrompt, setRejectionPrompt,
    confirmDialog, setConfirmDialog,
    confirmAction, showAlert,
  };
}
