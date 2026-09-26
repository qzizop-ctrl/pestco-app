import { useCallback } from "react";
import { reportException } from "../sentry";

// Every user-facing error message App.jsx shows, pulled into one hook.
// These used to be three separate inline callbacks/functions defined
// directly in App.jsx; grouping them here keeps App.jsx focused on
// wiring hooks together instead of also carrying ~50 lines of bilingual
// error-message strings.
export function useErrorReporting({ lang, showAlert }) {
  // Surfaces a failed access-management write (grant/revoke/review/
  // dismiss) instead of leaving it silent. This previously only logged
  // to the browser console, so the owner would see the Settings action
  // "succeed" with no feedback while the underlying Firestore write was
  // actually rejected — most commonly because the security rules
  // deployed on the live Firebase project are out of date (the
  // firestore.rules file has to be deployed on its own; having it in
  // the repo doesn't apply it).
  const reportWorkspaceError = useCallback((e) => {
    reportException(e, { source: "workspace" });
    const code = e && e.code ? ` (${e.code})` : "";
    showAlert(
      lang === "ar"
        ? `حصل خطأ أثناء حفظ التغيير${code}. لو بيتكرر، تأكد إن قواعد الأمان (Firestore Rules) متنشورة فعليًا على مشروع Firebase — وجودها في الكود مش كفاية.`
        : `Failed to save the change${code}. If this keeps happening, confirm the Firestore security rules are actually deployed on the Firebase project — having them in the code isn't enough.`
    );
  }, [lang, showAlert]);

  // Surfaces a save failure to the user instead of swallowing it
  // silently. A "permission-denied" here almost always means the
  // signed-in account's role in Firestore doesn't actually match what
  // Settings shows (e.g. it's still "viewer" server-side) — this makes
  // that visible instead of the save just silently doing nothing.
  const reportSaveError = useCallback((e) => {
    console.error("Save failed:", e);
    const isPermissionError = e && (e.code === "permission-denied" || String(e.code || "").includes("permission-denied"));
    showAlert(
      isPermissionError
        ? (lang === "ar"
            ? "معنديش صلاحية أكتب في البيانات دي. تأكد إن الدور بتاعك مضبوط 'يشوف ويعدل' فعليًا."
            : "You don't have permission to write this data. Confirm your role is actually set to 'editor'.")
        : (lang === "ar" ? `حصل خطأ أثناء الحفظ: ${e && e.message ? e.message : e}` : `Save failed: ${e && e.message ? e.message : e}`)
    );
  }, [lang, showAlert]);

  // Surfaces a *read* failure on the customer list itself — previously
  // this was swallowed entirely by useLiveData, so an account without
  // real server-side access just saw an empty list forever with zero
  // indication why.
  const reportVisitsError = useCallback((visitsError) => {
    const isPermissionError = visitsError.code === "permission-denied";
    showAlert(
      isPermissionError
        ? (lang === "ar"
            ? "معنديش صلاحية أشوف البيانات دي. تأكد إن الإيميل بتاعك مضاف صح في Settings عند صاحب الحساب."
            : "You don't have permission to read this data. Confirm your email is correctly added in the owner's Settings.")
        : (lang === "ar" ? `حصل خطأ أثناء تحميل العملاء: ${visitsError.message}` : `Failed to load customers: ${visitsError.message}`)
    );
  }, [lang, showAlert]);

  return { reportWorkspaceError, reportSaveError, reportVisitsError };
}
