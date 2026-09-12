import React, { useState } from 'react';
import { db } from '../firebase'; // تصحيح المسار للخروج من مجلد components
import { doc, updateDoc, deleteField } from 'firebase/firestore';
import { AlertTriangle, Check, RotateCcw } from 'lucide-react';

const MUTED = "#6B7280";
const TEXT = "#1F2937";
const SURFACE = "#FFFFFF";
const LINE = "#E5E7EB";
const DANGER = "#DC2626";

export default function CustomerDetail({ active, isOwner, onClose }) {
  const [loading, setLoading] = useState(false);

  // 1. دالة الاعتماد (تنظيف مساحة last_change من المستند)
  const handleApprove = async () => {
    if (!active?.id) return;
    setLoading(true);
    try {
      const docRef = doc(db, "customers", active.id);
      await updateDoc(docRef, {
        last_change: deleteField()
      });
      alert("تم اعتماد البيانات وتنظيف المساحة بنجاح.");
    } catch (err) {
      console.error("خطأ أثناء الاعتماد:", err);
      alert("حدث خطأ أثناء الاعتماد: " + err.message);
    } finally {
      setLoading(false);
    }
  };

  // 2. دالة التراجع عن التعديل (إعادة القيم القديمة وحذف last_change)
  const handleRollback = async () => {
    if (!active?.id || !active.last_change) return;
    setLoading(true);
    try {
      const rawChanges = active.last_change.changes || active.last_change.details || active.last_change;
      const docRef = doc(db, "customers", active.id);
      const rollbackPayload = {};

      if (typeof rawChanges === "object") {
        Object.entries(rawChanges).forEach(([field, val]) => {
          if (!["changed_by", "updatedBy", "updated_at", "updatedAt", "changes", "details"].includes(field)) {
            if (val && typeof val === "object" && "old_value" in val) {
              rollbackPayload[field] = val.old_value;
            }
          }
        });
      }

      // إزالة التغيير المعلق عند التراجع
      rollbackPayload.last_change = deleteField();

      await updateDoc(docRef, rollbackPayload);
      alert("تم التراجع عن التعديلات وإعادة البيانات القديمة بنجاح.");
    } catch (err) {
      console.error("خطأ أثناء التراجع:", err);
      alert("حدث خطأ أثناء التراجع: " + err.message);
    } finally {
      setLoading(false);
    }
  };

  if (!active) return null;

  return (
    <div className="p-4 dir-rtl text-right">
      {/* ----------------- صندوق الاعتماد والتراجع (خاص بالمالك) ----------------- */}
      {isOwner && active.last_change && (
        <div 
          className="mb-4 text-right shadow-sm"
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
              const rawChanges = active.last_change.changes || active.last_change.details || active.last_change;
              
              if (!rawChanges || typeof rawChanges !== "object") {
                return <div className="text-gray-500">لا توجد تفاصيل تفصيلية للتغيير</div>;
              }

              const entries = Object.entries(rawChanges).filter(
                ([k]) => !["changed_by", "updatedBy", "updated_at", "updatedAt", "changes", "details"].includes(k)
              );

              if (entries.length === 0) {
                return <div className="text-gray-500">تم إجراء تعديلات عامة على بيانات العميل</div>;
              }

              return entries.map(([field, val]) => {
                const oldValue = typeof val === "object" && val !== null ? val.old_value : undefined;
                const newValue = typeof val === "object" && val !== null ? val.new_value : val;

                return (
                  <div key={field} className="flex items-center gap-2 border-b border-gray-100 last:border-0 pb-1">
                    <span className="font-semibold min-w-[90px]" style={{ color: MUTED }}>{field}:</span>
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
              disabled={loading}
              className="btn-press flex-1 flex items-center justify-center gap-1 text-xs font-bold"
              style={{ background: "#059669", color: "#fff", borderRadius: 10, padding: "8px 0", opacity: loading ? 0.6 : 1 }}
            >
              <Check size={14} /> اعتماد (تنظيف المساحة)
            </button>
            <button
              onClick={handleRollback}
              disabled={loading}
              className="btn-press flex-1 flex items-center justify-center gap-1 text-xs font-bold"
              style={{ background: DANGER, color: "#fff", borderRadius: 10, padding: "8px 0", opacity: loading ? 0.6 : 1 }}
            >
              <RotateCcw size={14} /> تراجع عن التعديل
            </button>
          </div>
        </div>
      )}

      {/* هنا باقي واجهة تفاصيل العميل الخاصة بك */}
    </div>
  );
}
