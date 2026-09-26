import { History, ChevronRight } from "lucide-react";
import { TEXT, MUTED, LINE, SURFACE, PRIMARY } from "../../theme";

export default function AuditLogLink({ t, openAuditLog }) {
  return (
    <button
      onClick={openAuditLog}
      className={`btn-press w-full flex items-center justify-between ${t.dir === "rtl" ? "text-right" : "text-left"}`}
      style={{ background: SURFACE, borderRadius: 16, border: `1px solid ${LINE}`, padding: 16, marginBottom: 16 }}
    >
      <div className="flex items-center gap-2">
        <History size={17} color={PRIMARY} />
        <div>
          <p className="font-bold text-sm" style={{ color: TEXT }}>{t.auditLogBtn}</p>
          <p className="text-xs" style={{ color: MUTED }}>{t.auditLogHint}</p>
        </div>
      </div>
      <ChevronRight size={16} color={MUTED} style={{ transform: t.dir === "rtl" ? "none" : "rotate(180deg)" }} />
    </button>
  );
}
