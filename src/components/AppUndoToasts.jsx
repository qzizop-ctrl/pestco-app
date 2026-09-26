import UndoToast from "./UndoToast";

// Groups the two "X deleted — Undo" toast renders (customer delete,
// supplier delete) that used to sit directly in App.jsx's return, one
// after the other. UndoToast.jsx itself is already the single shared
// component for both cases (see its own header comment) — this just
// removes the duplicated `{pendingX && <UndoToast .../>}` wiring from
// App.jsx's JSX. No state of its own; pendingDelete/pendingSupplierDelete
// still live in useCustomerRecords()/useSupplierRecords() up in App.jsx.
export default function AppUndoToasts({
  t, isRootScreen,
  pendingDelete, undoDelete,
  pendingSupplierDelete, undoSupplierDelete,
}) {
  return (
    <>
      {pendingDelete && (
        <UndoToast
          companyName={pendingDelete.companyName}
          onUndo={undoDelete}
          isRootScreen={isRootScreen}
          t={t}
        />
      )}

      {pendingSupplierDelete && (
        <UndoToast
          companyName={pendingSupplierDelete.companyName}
          onUndo={undoSupplierDelete}
          isRootScreen={isRootScreen}
          t={t}
        />
      )}
    </>
  );
}
