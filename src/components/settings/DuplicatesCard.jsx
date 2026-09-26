import { Copy } from "lucide-react";
import { TEXT, MUTED, GOLD, LINE, SURFACE, SURFACE_SUBTLE, PRIMARY_MID } from "../../theme";

export default function DuplicatesCard({ t, showDuplicates, setShowDuplicates, duplicateGroups, openDetail }) {
  return (
    <div style={{ background: SURFACE, borderRadius: 16, border: `1px solid ${LINE}`, padding: 16, marginBottom: 16 }}>
      <p className="font-bold text-base mb-1" style={{ color: TEXT }}>{t.duplicatesTitle}</p>
      <p className="text-xs mb-3" style={{ color: MUTED }}>{t.duplicatesHint}</p>

      <button
        onClick={() => setShowDuplicates((s) => !s)}
        className="btn-press flex items-center justify-center gap-2 font-bold"
        style={{
          background: showDuplicates ? SURFACE : PRIMARY_MID,
          border: showDuplicates ? `1px solid ${PRIMARY_MID}` : "none",
          color: showDuplicates ? PRIMARY_MID : "#fff",
          borderRadius: 14,
          padding: "12px 0",
          width: "100%",
        }}
      >
        <Copy size={16} /> {t.duplicatesBtn}
      </button>

      {showDuplicates && (
        <div style={{ marginTop: 12 }}>
          {duplicateGroups.length === 0 ? (
            <p className="text-sm text-center py-4" style={{ color: MUTED }}>{t.noDuplicatesFound}</p>
          ) : (
            duplicateGroups.map((group, idx) => (
              <div
                key={idx}
                style={{ background: SURFACE_SUBTLE, borderRadius: 12, padding: 10, marginBottom: 8 }}
              >
                <span className="text-xs font-bold" style={{ color: GOLD }}>
                  {group.reason === "phone" ? t.samePhoneReason : t.similarNameReason}
                </span>
                {group.customers.map((c) => (
                  <button
                    key={c.id}
                    onClick={() => openDetail(c)}
                    className={`btn-press w-full flex items-center justify-between ${t.dir === "rtl" ? "text-right" : "text-left"}`}
                    style={{ padding: "6px 0" }}
                  >
                    <span className="text-sm font-bold" style={{ color: TEXT }}>{c.companyName || t.noCompanyName}</span>
                    <span className="text-xs" style={{ color: MUTED }}>{c.phone || "—"}</span>
                  </button>
                ))}
              </div>
            ))
          )}
        </div>
      )}
    </div>
  );
}
