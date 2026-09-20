import RejectionReasonModal from "./RejectionReasonModal";
import ConfirmModal from "./ConfirmModal";

// Groups the two app-wide modals (offer-rejection reason capture, and
// the generic confirm/alert replacement for window.confirm/alert — see
// each component's own header comment for why they exist) that used to
// sit directly in App.jsx's return, one after the other. Pulled out so
// App.jsx's JSX stays focused on the screen layout itself; this has no
// state of its own; rejectionPrompt/confirmDialog still live in
// useDialogState() up in App.jsx.
export default function AppModals({
  t,
  rejectionPrompt, setRejectionPrompt,
  confirmDialog, setConfirmDialog,
}) {
  return (
    <>
      {rejectionPrompt && (
        <RejectionReasonModal
          t={t}
          initialReasonId={rejectionPrompt.initialReasonId}
          initialReasonText={rejectionPrompt.initialReasonText}
          onConfirm={(picked) => {
            const { onConfirm } = rejectionPrompt;
            setRejectionPrompt(null);
            onConfirm(picked);
          }}
          onCancel={() => setRejectionPrompt(null)}
        />
      )}

      {confirmDialog && (
        <ConfirmModal
          t={t}
          message={confirmDialog.message}
          variant={confirmDialog.variant}
          danger={confirmDialog.danger}
          onConfirm={() => {
            const { onConfirm } = confirmDialog;
            setConfirmDialog(null);
            onConfirm();
          }}
          onCancel={() => setConfirmDialog(null)}
        />
      )}
    </>
  );
}
