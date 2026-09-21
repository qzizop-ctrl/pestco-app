import { Phone, MessageCircle, Mail, Calendar, Clock, History } from "lucide-react";
import { PRIMARY_MID, TEXT, MUTED, LINE, SURFACE_SUBTLE } from "../../theme";
import { getVisitEvents, fmtCreatedAt, buildWhatsAppLink } from "../../helpers";
import { openWhatsApp } from "../../nativeWhatsApp";

export default function CustomerContactRows({ t, active, canEdit, logVisitToday }) {
  return (
    <div className="flex flex-col gap-3" style={{ borderTop: `0.5px solid ${LINE}`, paddingTop: 12 }}>
      <a
        href={active.phone ? `tel:${active.phone}` : undefined}
        className="flex items-center justify-between"
        style={{ color: active.phone ? TEXT : "#C7C4B6", textDecoration: "none" }}
      >
        <span className="flex items-center gap-2 text-sm"><Phone size={15} /> {t.phoneRow}</span>
        <span className="text-sm font-bold">{active.phone || "—"}</span>
      </a>
      {active.phone && (
        <a
          href={buildWhatsAppLink(active.phone)}
          onClick={(e) => {
            e.preventDefault();
            openWhatsApp(active.phone);
          }}
          className="flex items-center justify-between"
          style={{ color: "#25A245", textDecoration: "none" }}
        >
          <span className="flex items-center gap-2 text-sm"><MessageCircle size={15} /> {t.whatsapp}</span>
          <span className="text-sm font-bold">{active.phone}</span>
        </a>
      )}
      <a
        href={active.email ? `mailto:${active.email}` : undefined}
        className="flex items-center justify-between"
        style={{ color: active.email ? TEXT : "#C7C4B6", textDecoration: "none" }}
      >
        <span className="flex items-center gap-2 text-sm"><Mail size={15} /> {t.emailRow}</span>
        <span className="text-sm font-bold">{active.email || "—"}</span>
      </a>
      <div className="flex items-center justify-between">
        <span className="flex items-center gap-2 text-sm" style={{ color: TEXT }}><Calendar size={15} /> {t.visitDateRow}</span>
        <span className="text-sm font-bold">{active.visitDate || "—"}</span>
      </div>
      {active.createdAt && (
        <div className="flex items-center justify-between">
          <span className="flex items-center gap-2 text-sm" style={{ color: TEXT }}><Clock size={15} /> {t.dateAddedRow}</span>
          <span className="text-sm font-bold">{fmtCreatedAt(active.createdAt, t.locale)}</span>
        </div>
      )}
      <div className="flex items-center justify-between">
        <span className="flex items-center gap-2 text-sm" style={{ color: TEXT }}><History size={15} /> {t.visitCountLabel(getVisitEvents(active).length)}</span>
        {canEdit && (
          <button
            onClick={() => logVisitToday(active)}
            className="btn-press text-xs font-bold"
            style={{ color: PRIMARY_MID }}
          >
            {t.logVisitBtn}
          </button>
        )}
      </div>

      {getVisitEvents(active).length > 0 && (
        <div style={{ marginTop: 8 }}>
          <div className="flex items-center flex-wrap gap-1">
            {[...getVisitEvents(active)]
              .sort((a, b) => (a.date < b.date ? 1 : -1))
              .map((ev) => (
                <span
                  key={ev.id}
                  className="flex items-center gap-1 text-xs font-bold"
                  style={{ background: SURFACE_SUBTLE, color: MUTED, borderRadius: 999, padding: "4px 10px" }}
                >
                  {ev.date}
                </span>
              ))}
          </div>
        </div>
      )}
    </div>
  );
}
