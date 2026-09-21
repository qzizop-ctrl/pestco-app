import React from "react";
import { Star, User } from "lucide-react";
import { TagChip } from "../Shared";
import { TEXT, MUTED, GOLD, STATUS_COLORS, stageColor } from "../../theme";
import { STAGE_IDS } from "../../domain";
import { visitStatus } from "../../helpers";

export default function CustomerHeaderCard({ t, active, canEdit, togglePin, activeStageIdx, changeStage }) {
  return (
    <>
      <div className="flex items-center justify-between mb-1">
        <div className="flex items-center gap-2">
          <span className="font-bold text-lg">{active.companyName}</span>
          {canEdit && (
            <button
              onClick={() => togglePin(active)}
              className="btn-press flex items-center justify-center"
              style={{ color: active.isPinned ? GOLD : "#C7C4B6" }}
              aria-label={active.isPinned ? t.unpinBtn : t.pinBtn}
            >
              <Star size={18} fill={active.isPinned ? GOLD : "none"} />
            </button>
          )}
        </div>
        <span
          className="text-xs font-extrabold px-2 py-0.5 rounded-full"
          style={{ background: STATUS_COLORS[visitStatus(active)], color: "#fff" }}
        >
          {{
            overdue: t.statusOverdue,
            today: t.statusToday,
            upcoming: t.statusUpcoming,
            none: t.statusNone,
          }[visitStatus(active)]}
        </span>
      </div>
      <div className="flex items-center justify-between mb-3">
        <div className="flex items-center gap-1" style={{ color: MUTED }}>
          <User size={14} />
          <span className="text-sm">
            {active.contactName}
            {active.role && t.roles[active.role] ? ` · ${t.roles[active.role]}` : ""}
          </span>
        </div>
        <span className="text-xs font-bold" style={{ color: GOLD }}>
          {t.sectors[active.sector] || t.sectors.private}
        </span>
      </div>

      {(active.tags || []).length > 0 && (
        <div className="flex items-center flex-wrap gap-1 mb-3">
          {active.tags.map((tag) => (
            <TagChip key={tag} label={tag} />
          ))}
        </div>
      )}

      <div style={{ marginBottom: 14 }}>
        <label style={{ marginBottom: 8 }}>{t.pipelineLabel}</label>
        <div className="flex items-center" style={{ gap: 4 }}>
          {STAGE_IDS.map((id, idx) => {
            const isCurrent = id === active.stage;
            const isPast = activeStageIdx >= 0 && idx < activeStageIdx;
            return (
              <React.Fragment key={id}>
                <button
                  onClick={() => changeStage(active, id)}
                  disabled={!canEdit}
                  className="btn-press flex-1 text-center"
                  style={{
                    padding: "8px 2px",
                    borderRadius: 10,
                    fontSize: 11,
                    fontWeight: 700,
                    background: isCurrent || isPast ? stageColor(id) : "#F2F1EA",
                    color: isCurrent || isPast ? "#fff" : MUTED,
                    border: "none",
                  }}
                >
                  {t.stages[id]}
                </button>
                {idx < STAGE_IDS.length - 1 && (
                  <div style={{ width: 6, height: 2, background: isPast ? stageColor(id) : "#F2F1EA", flexShrink: 0 }} />
                )}
              </React.Fragment>
            );
          })}
        </div>
      </div>
    </>
  );
}
