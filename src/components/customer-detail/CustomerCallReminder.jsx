import { Bell } from "lucide-react";
import { PRIMARY_MID, MUTED, STATUS_COLORS } from "../../theme";
import { fmtReminder } from "../../helpers";

export default function CustomerCallReminder({ t, active, canEdit, clearCallReminder }) {
  if (!active.callDateTime) return null;
  return (
    <div
      className="flex items-center justify-between mt-3"
      style={{
        background: active.notified ? "#F2F1EA" : "rgba(196,68,58,.1)",
        borderRadius: 10,
        padding: 10,
      }}
    >
      <span
        className="flex items-center gap-2 text-sm font-bold"
        style={{ color: active.notified ? MUTED : STATUS_COLORS.overdue }}
      >
        <Bell size={15} /> {t.callDueLabel} {fmtReminder(active.callDateTime, t.locale)}
      </span>
      {canEdit && (
        <button
          onClick={() => clearCallReminder(active)}
          className="btn-press text-xs font-bold"
          style={{ color: PRIMARY_MID }}
        >
          {t.callDone}
        </button>
      )}
    </div>
  );
}
