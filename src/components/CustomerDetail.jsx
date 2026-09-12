import React, { useState } from "react";
import {
  Star, User, Phone, MessageCircle, Mail, Calendar, Clock, History, Bell,
  FileText, Wallet, Trash2, Pencil, MapPin, Truck, AlertTriangle, Check, RotateCcw
} from "lucide-react";
import { TagChip } from "./Shared";
import SupplierPickerSheet from "./SupplierPickerSheet";
import {
  PRIMARY_MID, TEXT, MUTED, DANGER, GOLD, LINE, SURFACE, SURFACE_SUBTLE,
  STATUS_COLORS, STAGE_IDS, CURRENCY_IDS, OFFER_STATUS_IDS, ACTIVITY_COLORS,
  stageColor, offerStatusColor, visitStatus, getVisitEvents,
  fmtCreatedAt, fmtReminder, fmtActivityDate, fmtMoney,
} from "../constants";
import { mapsUrl } from "../geo";
import { db } from "../firebase";
import { doc, updateDoc, deleteField } from "firebase/firestore";

export default function CustomerDetailScreen({
  t,
  active,
  ownerUid,
  canEdit,
  isOwnerAccount,
  togglePin,
  activeStageIdx,
  changeStage,
  clearCallReminder,
  logVisitToday,
  activeOffersValueText,
  activeOffers,
  expandedOfferId,
  setExpandedOfferId,
  updateOfferStatus,
  deleteOffer,
  newOffer,
  setNewOffer,
  addOffer,
  suppliers,
  supplierPickerOpen,
  setSupplierPickerOpen,
  toggleOfferSupplier,
  activityLog,
  newActivityText,
  setNewActivityText,
  submitActivity,
  deleteActivity,
  openEdit,
  deleteVisit,
}) {
  const [loadingAction, setLoadingAction] = useState(false);

  if (!active) return null;

  // مرجع مستند العميل الصحيح في Firestore — نفس المسار المستخدم في باقي
  // التطبيق (App.jsx وuseLiveData.js): users/{ownerUid}/visits/{id}.
  // العميل مخزّن في كولكشن اسمه "visits" مش "customers"، وownerUid بييجي
  // من الـ workspace الحالي مش من بيانات العميل نفسه.
  const getDocRef = () => {
    if (!ownerUid) return null;
    return doc(db, "users", ownerUid, "visits", active.id);
  };

  // 1. دالة الاعتماد (حذف تنبيه التعديل وتنظيف المساحة)
  const handleApprove = async () => {
    if (!isOwnerAccount || !active?.id) return;
    const docRef = getDocRef();
    if (!docRef) {
      alert("تعذّر تحديد مساحة العمل الحالية.");
      return;
    }
    setLoadingAction(true);
    try {
      await updateDoc(docRef, { last_change: deleteField() });
      alert("تم اعتماد البيانات وتنظيف المساحة بنجاح.");
    } catch (err) {
      console.error("خطأ أثناء الاعتماد:", err);
      alert("حدث خطأ أثناء الاعتماد: " + err.message);
    } finally {
      setLoadingAction(false);
    }
  };

  // 2. دالة التراجع عن التعديل (إعادة القيم القديمة وحذف التنبيه)
  const handleRollback = async () => {
    if (!isOwnerAccount || !active?.id || !active.last_change) return;
    const docRef = getDocRef();
    if (!docRef) {
      alert("تعذّر تحديد مساحة العمل الحالية.");
      return;
    }
    setLoadingAction(true);
    try {
      const rawChanges = active.last_change.changes || active.last_change.details || active.last_change;
      const rollbackPayload = {};

      if (typeof rawChanges === "object" && rawChanges !== null) {
        Object.entries(rawChanges).forEach(([field, val]) => {
          const ignoreKeys = ["changed_by", "updatedBy", "updatedById", "updated_at", "updatedAt", "changes", "details"];
          if (!ignoreKeys.includes(field)) {
            if (val && typeof val === "object" && "old_value" in val) {
              rollbackPayload[field] = val.old_value;
            } else if (typeof val !== "object") {
              rollbackPayload[field] = val;
            }
          }
        });
      }

      rollbackPayload.last_change = deleteField();

      await updateDoc(docRef, rollbackPayload);

      alert("تم التراجع عن التعديلات وإعادة البيانات بنجاح.");
    } catch (err) {
      console.error("خطأ أثناء التراجع:", err);
      alert("حدث خطأ أثناء التراجع: " + err.message);
    } finally {
      setLoadingAction(false);
    }
  };

  return (
    <div className="px-4 pt-4 pb-10">

      {/* ----------------- صندوق تنبيه تعديل البيانات ----------------- */}
      {/* يظهر لصاحب الـworkspace (المالك) فقط — مش لأي editor عنده صلاحية تعديل عادية */}
      {isOwnerAccount && active.last_change && (
        <div 
          className="mb-4 shadow-sm"
          style={{ 
            background: "#FFFBEB", 
            border: "1px solid #FCD34D", 
            borderRadius: 16, 
            padding: 14 
          }}
        >
          <div className="flex items-center justify-between mb-2">
            <span className="font-bold text-xs flex items-center gap-1" style={{ color: "#92400E" }}>
              <AlertTriangle size={15} color="#D97706" /> تنبيه تعديل بيانات (خاص بك)
            </span>
            <span className="text-xs" style={{ color: MUTED }}>
              {active.last_change.updated_at
                ? new Date(active.last_change.updated_at).toLocaleString("ar-EG")
                : active.last_change.updatedAt
                ? new Date(active.last_change.updatedAt).toLocaleString("ar-EG")
                : ""}
            </span>
          </div>

          <div className="text-xs mb-2" style={{ color: TEXT }}>
            قام المستخدم{" "}
            <span className="font-bold">
              {active.last_change.changed_by || active.last_change.updatedBy || "غير معروف"}
            </span>{" "}
            بتعديل البيانات التالية:
          </div>

          <div 
            className="flex flex-col gap-1.5 text-xs mb-3" 
            style={{ background: SURFACE, border: `1px solid ${LINE}`, borderRadius: 10, padding: 10 }}
          >
            {(() => {
              const fieldLabels = {
                companyName: "اسم الشركة",
                contactName: "الشخص المسؤول",
                phone: "رقم الهاتف",
                email: "البريد الإلكتروني",
                notes: "الملاحظات",
                sector: "القطاع",
                stage: "مرحلة المشروع",
                visitDate: "تاريخ الزيارة",
                callDateTime: "موعد التذكير",
              };

              const ignoreKeys = [
                "changed_by", "updatedBy", "updatedById", "updated_at", 
                "updatedAt", "changes", "details", "last_change"
              ];

              const rawChanges = active.last_change.changes || active.last_change.details || active.last_change;
              
              if (!rawChanges || typeof rawChanges !== "object") {
                return <div style={{ color: MUTED }}>تعديلات عامة على السجل</div>;
              }

              const entries = Object.entries(rawChanges).filter(([k]) => !ignoreKeys.includes(k));

              if (entries.length === 0) {
                return <div style={{ color: MUTED }}>تم إجراء تعديل على بيانات السجل (بدون تفاصيل قيم قديمة)</div>;
              }

              return entries.map(([field, val]) => {
                const arabicLabel = fieldLabels[field] || field;
                const oldValue = typeof val === "object" && val !== null ? val.old_value : undefined;
                const newValue = typeof val === "object" && val !== null ? val.new_value : val;

                return (
                  <div key={field} className="flex items-center gap-2 border-b border-gray-100 last:border-0 pb-1">
                    <span className="font-semibold min-w-[90px]" style={{ color: MUTED }}>{arabicLabel}:</span>
                    {oldValue !== undefined && (
                      <>
                        <span className="line-through font-bold px-1.5 py-0.5 rounded" style={{ background: "#FEE2E2", color: DANGER }}>
                          {String(oldValue || "—")}
                        </span>
                        <span>←</span>
                      </>
                    )}
                    <span className="font-bold px-1.5 py-0.5 rounded" style={{ background: "#D1FAE5", color: "#047857" }}>
                      {String(newValue !== undefined && newValue !== null ? newValue : "—")}
                    </span>
                  </div>
                );
              });
            })()}
          </div>

          <div className="flex gap-2">
            <button
              onClick={handleApprove}
              disabled={loadingAction}
              className="btn-press flex-1 flex items-center justify-center gap-1 text-xs font-bold"
              style={{ background: "#059669", color: "#fff", borderRadius: 10, padding: "8px 0", opacity: loadingAction ? 0.6 : 1 }}
            >
              <Check size={14} /> اعتماد (تنظيف المساحة)
            </button>
            <button
              onClick={handleRollback}
              disabled={loadingAction}
              className="btn-press flex-1 flex items-center justify-center gap-1 text-xs font-bold"
              style={{ background: DANGER, color: "#fff", borderRadius: 10, padding: "8px 0", opacity: loadingAction ? 0.6 : 1 }}
            >
              <RotateCcw size={14} /> تراجع عن التعديل
            </button>
          </div>
        </div>
      )}

      {/* ----------------- باقي الواجهة والبيانات ----------------- */}
      <div style={{ background: SURFACE, borderRadius: 16, border: `1px solid ${LINE}`, padding: 16 }}>
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
            <User size={14} /> <span className="text-sm">{active.contactName}</span>
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
              href={`https://wa.me/${active.phone.replace(/[^0-9]/g, "")}`}
              target="_blank"
              rel="noreferrer"
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
                  .map((ev) => {
                    const evMapsUrl = mapsUrl(ev.location);
                    return (
                      <span
                        key={ev.id}
                        className="flex items-center gap-1 text-xs font-bold"
                        style={{ background: SURFACE_SUBTLE, color: MUTED, borderRadius: 999, padding: "4px 10px" }}
                      >
                        {ev.date}
                        {evMapsUrl && (
                          <a
                            href={evMapsUrl}
                            target="_blank"
                            rel="noreferrer"
                            onClick={(e) => e.stopPropagation()}
                            className="btn-press flex items-center justify-center"
                            style={{ color: PRIMARY_MID }}
                            aria-label={t.visitLocationPin}
                            title={t.visitLocationPin}
                          >
                            <MapPin size={12} />
                          </a>
                        )}
                      </span>
                    );
                  })}
              </div>
            </div>
          )}

          {mapsUrl(active.lastVisitLocation) && (
            <a
              href={mapsUrl(active.lastVisitLocation)}
              target="_blank"
              rel="noreferrer"
              className="flex items-center justify-between"
              style={{ color: PRIMARY_MID, textDecoration: "none", marginTop: 8 }}
            >
              <span className="flex items-center gap-2 text-sm"><MapPin size={15} /> {t.lastVisitLocationLabel}</span>
              <span className="text-sm font-bold">{t.openInMaps}</span>
            </a>
          )}
        </div>

        {active.callDateTime && (
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
        )}

        {active.notes && (
          <div style={{ borderTop: `0.5px solid ${LINE}`, marginTop: 12, paddingTop: 12 }}>
            <span className="flex items-center gap-2 text-sm font-bold mb-1"><FileText size={15} /> {t.notesRow}</span>
            <p className="text-sm" style={{ color: MUTED, lineHeight: 1.7 }}>{active.notes}</p>
          </div>
        )}

        {/* Offers */}
        <div style={{ borderTop: `0.5px solid ${LINE}`, marginTop: 12, paddingTop: 12 }}>
          <div className="flex items-center justify-between mb-2">
            <span className="flex items-center gap-2 text-sm font-bold"><Wallet size={15} /> {t.offersLabel}</span>
            {activeOffersValueText && (
              <span className="text-xs font-bold" style={{ color: PRIMARY_MID }}>
                {activeOffersValueText}
              </span>
            )}
          </div>

          {activeOffers.length === 0 ? (
            <p className="text-sm text-center py-2" style={{ color: MUTED }}>{t.noOffers}</p>
          ) : (
            <div className="flex flex-col gap-2 mb-3">
              {activeOffers.map((offer) => {
                const isExpanded = expandedOfferId === offer.id;
                return (
                  <div key={offer.id} style={{ background: SURFACE_SUBTLE, borderRadius: 12, padding: 10 }}>
                    <button
                      onClick={() => setExpandedOfferId(isExpanded ? null : offer.id)}
                      className={`btn-press w-full ${t.dir === "rtl" ? "text-right" : "text-left"}`}
                    >
                      <div className="flex items-center justify-between gap-2">
                        <span className="text-sm font-bold" style={{ color: TEXT }}>
                          {offer.name}{offer.offerNumber ? ` — ${offer.offerNumber}` : ""}
                        </span>
                        <span
                          className="text-xs font-bold flex-shrink-0"
                          style={{
                            background: offerStatusColor(offer.status),
                            color: "#fff",
                            borderRadius: 999,
                            padding: "3px 9px",
                          }}
                        >
                          {t.offerStatuses[offer.status] || offer.status}
                        </span>
                      </div>
                      <div className="flex items-center justify-between mt-1">
                        <span className="text-xs" style={{ color: MUTED }}>{offer.offerDate}</span>
                        <span className="text-sm font-extrabold" style={{ color: PRIMARY_MID }}>
                          {fmtMoney(offer.amount, t.locale)} {t.currencies[offer.currency] || t.currencies.EGP}
                        </span>
                      </div>
                      {offer.status === "rejected" && offer.rejectionReason && (
                        <p className="text-xs mt-1" style={{ color: DANGER, margin: "4px 0 0" }}>
                          {t.rejectionReasonRow} {offer.rejectionReason}
                        </p>
                      )}
                      {offer.supplierNames && offer.supplierNames.length > 0 && (
                        <div className="flex items-center gap-1 text-xs mt-1" style={{ color: PRIMARY_MID }}>
                          <Truck size={13} />
                          {t.offerSuppliersCount(offer.supplierNames.length)}
                        </div>
                      )}
                    </button>

                    {isExpanded && offer.supplierNames && offer.supplierNames.length > 0 && (
                      <div className="flex items-center flex-wrap gap-1" style={{ marginTop: 8 }}>
                        {offer.supplierNames.map((name) => (
                          <TagChip key={name} label={name} />
                        ))}
                      </div>
                    )}

                    {isExpanded && canEdit && (
                      <div style={{ marginTop: 10, paddingTop: 10, borderTop: `1px dashed ${LINE}` }}>
                        <p className="text-xs font-bold mb-2" style={{ color: MUTED }}>{t.changeStatusLabel}</p>
                        <div className="flex items-center flex-wrap gap-1">
                          {OFFER_STATUS_IDS.map((sid) => {
                            const isActive = offer.status === sid;
                            return (
                              <button
                                key={sid}
                                onClick={() => updateOfferStatus(active, offer, sid)}
                                className="btn-press text-xs font-bold"
                                style={{
                                  padding: "4px 10px",
                                  borderRadius: 999,
                                  border: `1.2px solid ${isActive ? offerStatusColor(sid) : LINE}`,
                                  background: isActive ? offerStatusColor(sid) : SURFACE,
                                  color: isActive ? "#fff" : MUTED,
                                }}
                              >
                                {t.offerStatuses[sid]}
                              </button>
                            );
                          })}
                        </div>
                        <button
                          onClick={() => deleteOffer(active, offer)}
                          className="btn-press flex items-center gap-1 text-xs font-bold"
                          style={{ color: DANGER, marginTop: 10 }}
                        >
                          <Trash2 size={13} /> {t.delete}
                        </button>
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          )}

          {canEdit && (
            <div className="flex flex-col gap-2" style={{ background: SURFACE_SUBTLE, borderRadius: 12, padding: 10 }}>
              <input
                value={newOffer.name}
                onChange={(e) => setNewOffer({ ...newOffer, name: e.target.value })}
                placeholder={t.offerNamePlaceholder}
              />
              <div className="flex items-center gap-2">
                <input
                  value={newOffer.offerNumber}
                  onChange={(e) => setNewOffer({ ...newOffer, offerNumber: e.target.value })}
                  placeholder={t.offerNumberLabel}
                />
                <input
                  type="number"
                  value={newOffer.amount}
                  onChange={(e) => setNewOffer({ ...newOffer, amount: e.target.value })}
                  placeholder={t.offerAmountLabel}
                />
                <select
                  value={newOffer.currency}
                  onChange={(e) => setNewOffer({ ...newOffer, currency: e.target.value })}
                >
                  {CURRENCY_IDS.map((cid) => (
                    <option key={cid} value={cid}>{t.currencies[cid]}</option>
                  ))}
                </select>
              </div>
              <div className="flex items-center gap-2">
                <input
                  type="date"
                  value={newOffer.offerDate}
                  onChange={(e) => setNewOffer({ ...newOffer, offerDate: e.target.value })}
                />
                <select
                  value={newOffer.status}
                  onChange={(e) => setNewOffer({ ...newOffer, status: e.target.value })}
                >
                  {OFFER_STATUS_IDS.map((sid) => (
                    <option key={sid} value={sid}>{t.offerStatuses[sid]}</option>
                  ))}
                </select>
              </div>

              <button
                onClick={() => setSupplierPickerOpen(true)}
                className="btn-press flex items-center justify-center gap-1 text-xs font-bold"
                style={{
                  border: `1px dashed ${GOLD}`,
                  color: "#7A5420",
                  background: SURFACE_SUBTLE,
                  borderRadius: 8,
                  padding: "8px 0",
                }}
              >
                <Truck size={14} />
                {(newOffer.supplierNames || []).length > 0
                  ? t.offerSuppliersCount(newOffer.supplierNames.length)
                  : t.offerSuppliersBtn}
              </button>

              <button
                onClick={() => addOffer(active)}
                className="btn-press font-bold text-sm"
                style={{ background: PRIMARY_MID, color: "#fff", borderRadius: 10, padding: "10px 0" }}
              >
                {t.addOfferBtn}
              </button>
            </div>
          )}
        </div>

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
      </div>

      {canEdit && (
        <div className="flex gap-3 mt-4">
          <button
            onClick={() => openEdit(active)}
            className="btn-press flex-1 flex items-center justify-center gap-2 font-bold"
            style={{ background: SURFACE, border: `1px solid ${PRIMARY_MID}`, color: PRIMARY_MID, borderRadius: 14, padding: "12px 0" }}
          >
            <Pencil size={16} /> {t.edit}
          </button>
          <button
            onClick={() => deleteVisit(active.id)}
            className="btn-press flex items-center justify-center gap-2 font-bold"
            style={{ background: SURFACE, border: `1px solid ${DANGER}`, color: DANGER, borderRadius: 14, padding: "12px 20px" }}
          >
            <Trash2 size={16} /> {t.delete}
          </button>
        </div>
      )}

      <SupplierPickerSheet
        t={t}
        open={supplierPickerOpen}
        onClose={() => setSupplierPickerOpen(false)}
        suppliers={suppliers || []}
        selectedIds={newOffer.supplierIds || []}
        onToggle={toggleOfferSupplier}
      />
    </div>
  );
}
