// Where the Back action leads from a non-root screen. Shared by the header's
// back button and the Android hardware back button so both stay in sync.
// `auditLogTarget` is only set by callers that handle the audit-log screen.
export function resolveBackTarget(screen, { hasFormId, detailBackTarget, auditLogTarget }) {
  if (screen === "form" && hasFormId) return "detail";
  if (screen === "detail") return detailBackTarget;
  if (screen === "supplier-form") return "suppliers";
  if (auditLogTarget && screen === "audit-log") return auditLogTarget;
  return "list";
}
