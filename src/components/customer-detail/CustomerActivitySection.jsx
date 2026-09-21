import { Clock, Trash2 } from "lucide-react";
import { PRIMARY_MID, TEXT, MUTED, DANGER, LINE, ACTIVITY_COLORS } from "../../theme";
import { fmtActivityDate } from "../../helpers";

export default function CustomerActivitySection({
  t,
  canEdit,
  newActivityText,
  setNewActivityText,
  submitActivity,
  activityLog,
  deleteActivity,
}) {
  return (
    <div style={{ borderTop: `0.5px solid ${LINE}`, marginTop: 12, paddingTop: 12 }}>
      <span className="flex items-center gap-2 text-sm font-bold mb-2"><Clock size={15} /> {t.activityLabel}</span>

      {canEdit && (
        <div className="flex items-center gap-2 mb-3">
          <input
            value={newActivityText}
            onChange={(e) => setNewActivityText(e.target.value)}
            placeholder={t.addActivityPlaceholder}
          />
          <button
            onClick={submitActivity}
            className="btn-press font-bold text-xs flex-shrink-0"
            style={{ background: PRIMARY_MID, color: "#fff", borderRadius: 10, padding: "10px 14px" }}
          >
            {t.addActivityBtn}
          </button>
        </div>
      )}

      {activityLog.length === 0 ? (
        <p className="text-sm text-center py-3" style={{ color: MUTED }}>{t.noActivity}</p>
      ) : (
        <div
          className="flex flex-col gap-3"
          style={{ [t.dir === "rtl" ? "borderRight" : "borderLeft"]: `2px solid ${LINE}`, [t.dir === "rtl" ? "paddingRight" : "paddingLeft"]: 14 }}
        >
          {activityLog.map((entry) => {
            const color = ACTIVITY_COLORS[entry.type] || MUTED;
            return (
              <div key={entry.id} style={{ position: "relative" }}>
                <div
                  style={{
                    position: "absolute",
                    top: 3,
                    [t.dir === "rtl" ? "right" : "left"]: -19,
                    width: 8,
                    height: 8,
                    borderRadius: "50%",
                    background: color,
                  }}
                />
                <div className="flex items-start justify-between gap-2">
                  <div>
                    <p className="text-sm" style={{ margin: 0, color: TEXT }}>{entry.text}</p>
                    <span className="text-xs" style={{ color: MUTED }}>{fmtActivityDate(entry.at, t.locale)}</span>
                  </div>
                  {canEdit && (
                    <button
                      onClick={() => deleteActivity(entry)}
                      className="btn-press flex-shrink-0"
                      style={{ color: DANGER }}
                      aria-label={t.delete}
                    >
                      <Trash2 size={13} />
                    </button>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
