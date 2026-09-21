import { useState } from "react";
import { X } from "lucide-react";
import { TEXT, MUTED, GOLD, LINE, SURFACE, PRIMARY } from "../../theme";

export default function AdminsCard({
  t,
  adminEmails,
  primaryAdminEmail,
  isPrimaryAdmin,
  confirmAction,
  removeAdminEmail,
  addAdminEmail,
}) {
  const [newAdminEmail, setNewAdminEmail] = useState("");

  return (
    <div style={{ background: SURFACE, borderRadius: 16, border: `1px solid ${LINE}`, padding: 16, marginBottom: 16 }}>
      <p className="font-bold text-base mb-1" style={{ color: TEXT }}>{t.adminsTitle}</p>
      <p className="text-xs mb-3" style={{ color: MUTED }}>{t.adminsHint}</p>

      {(adminEmails || []).map((email) => {
        // Match by the explicit primaryAdminEmail, not array position —
        // relying on "whoever's first in the array" was the bug that
        // let a newly added admin end up seeing the primary's email.
        const isPrimary = primaryAdminEmail && email === primaryAdminEmail;
        // The primary admin's email is only ever shown to the primary
        // admin themself — everyone else just doesn't get this row at
        // all, per the request that it stay invisible to other admins.
        if (isPrimary && !isPrimaryAdmin) return null;
        const canRemoveThis = isPrimaryAdmin && !isPrimary && (adminEmails || []).length > 1;
        return (
          <div
            key={email}
            className="flex items-center justify-between"
            style={{ padding: "8px 0", borderBottom: `0.5px solid ${LINE}` }}
          >
            <div className="flex items-center gap-2">
              <p className="text-sm" style={{ color: TEXT }}>{email}</p>
              {isPrimary && (
                <span
                  className="text-xs font-bold"
                  style={{ background: "rgba(196,68,58,.08)", color: GOLD, borderRadius: 999, padding: "2px 8px" }}
                  title={t.primaryAdminHint}
                >
                  {t.primaryAdminBadge}
                </span>
              )}
            </div>
            {canRemoveThis && (
              <button
                onClick={() => confirmAction(t.removeAdminConfirm, () => removeAdminEmail(email), { danger: true })}
                className="btn-press"
                style={{ color: MUTED }}
                aria-label={t.delete}
              >
                <X size={16} />
              </button>
            )}
          </div>
        );
      })}

      {!isPrimaryAdmin && (adminEmails || []).length > 0 && (
        <p className="text-xs mt-2" style={{ color: MUTED }}>{t.primaryAdminHiddenNote}</p>
      )}

      {(adminEmails || []).length <= 1 && (
        <p className="text-xs mt-2" style={{ color: MUTED }}>{t.lastAdminHint}</p>
      )}

      <div className="flex items-center gap-2" style={{ marginTop: 12 }}>
        <input
          type="email"
          value={newAdminEmail}
          onChange={(e) => setNewAdminEmail(e.target.value)}
          placeholder={t.addAdminPlaceholder}
          className="field-bare"
          style={{ flex: 1, border: `1px solid ${LINE}`, borderRadius: 10, padding: "8px 10px", fontSize: 13 }}
        />
        <button
          onClick={() => {
            const email = newAdminEmail.trim();
            if (!email) return;
            addAdminEmail(email);
            setNewAdminEmail("");
          }}
          className="btn-press font-bold"
          style={{ background: PRIMARY, color: "#fff", borderRadius: 10, padding: "8px 16px", fontSize: 13 }}
        >
          {t.addAdminBtn}
        </button>
      </div>
    </div>
  );
}
