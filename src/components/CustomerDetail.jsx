import React, { useState } from 'react';
import { db } from '../firebase';
import { doc, updateDoc, deleteField } from 'firebase/firestore';
import { AlertTriangle, Check, RotateCcw, Phone, MessageSquare, Mail, Calendar, Clock, History, FileText, Briefcase } from 'lucide-react';

const MUTED = "#6B7280";
const TEXT = "#1F2937";
const SURFACE = "#FFFFFF";
const LINE = "#E5E7EB";
const DANGER = "#DC2626";

export default function CustomerDetail({ active, isOwner, onClose, onRegisterVisit }) {
  const [loading, setLoading] = useState(false);

  // 1. دالة الاعتماد (تنظيف مساحة last_change)
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
    <div className="p-4 dir-rtl text-right min-h-screen" style={{ background: "#F3F4F6" }}>
      
      {/* ----------------- 1. صندوق الاعتماد والتراجع (خاص بالمالك) ----------------- */}
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

      {/* ----------------- 2. كارت تفاصيل العميل الأساسية ----------------- */}
      <div className="bg-white rounded-2xl p-4 shadow-sm space-y-4 text-right">
        
        {/* Header / Name */}
        <div className="flex justify-between items-start border-b border-gray-100 pb-3">
          <div>
            <span className="text-xs text-gray-400 bg-gray-100 px-2 py-0.5 rounded-full">
              {active.reminder ? "تذكير" : "بدون تذكير"}
            </span>
            <h2 className="text-xl font-bold text-gray-800 mt-1">{active.name || active.company_name || "بدون اسم"}</h2>
            {active.contact_person && (
              <p className="text-sm text-gray-500 flex items-center gap-1 mt-0.5">
                <span className="text-gray-400">👤</span> {active.contact_person}
              </p>
            )}
            {active.sector && (
              <p className="text-xs text-amber-600 font-semibold mt-1">{active.sector}</p>
            )}
          </div>
        </div>

        {/* Project Stage */}
        {active.stage && (
          <div>
            <label className="text-xs text-gray-400 block mb-1">مرحلة المشروع</label>
            <div className="flex gap-1 overflow-x-auto pb-1">
              {['معاينة', 'عرض سعر', 'تركيب', 'صيانة'].map((stg) => (
                <span 
                  key={stg} 
                  className={`text-xs px-3 py-1 rounded-lg border ${
                    active.stage === stg 
                      ? 'bg-blue-50 text-blue-600 border-blue-200 font-bold' 
                      : 'bg-gray-50 text-gray-400 border-gray-100'
                  }`}
                >
                  {stg}
                </span>
              ))}
            </div>
          </div>
        )}

        {/* Contact info */}
        <div className="space-y-2 text-sm pt-2 border-t border-gray-100">
          {active.phone && (
            <div className="flex justify-between items-center">
              <span className="font-mono dir-ltr font-bold text-gray-700">{active.phone}</span>
              <span className="text-gray-400 text-xs flex items-center gap-1">رقم الهاتف <Phone size={14} /></span>
            </div>
          )}
          {active.whatsapp && (
            <div className="flex justify-between items-center">
              <span className="font-mono dir-ltr font-bold text-emerald-600">{active.whatsapp}</span>
              <span className="text-gray-400 text-xs flex items-center gap-1">واتساب <MessageSquare size={14} /></span>
            </div>
          )}
          {active.email && (
            <div className="flex justify-between items-center">
              <span className="text-gray-700">{active.email}</span>
              <span className="text-gray-400 text-xs flex items-center gap-1">البريد الإلكتروني <Mail size={14} /></span>
            </div>
          )}
        </div>

        {/* Dates & Visits */}
        <div className="space-y-2 text-xs text-gray-500 pt-2 border-t border-gray-100">
          {active.visit_date && (
            <div className="flex justify-between items-center">
              <span className="font-bold text-gray-700">{active.visit_date}</span>
              <span className="flex items-center gap-1"><Calendar size={14} /> تاريخ الزيارة</span>
            </div>
          )}
          
          <div className="flex justify-between items-center">
            <span className="font-bold text-gray-700">
              {active.created_at ? new Date(active.created_at).toLocaleString('ar-EG') : '—'}
            </span>
            <span className="flex items-center gap-1"><Clock size={14} /> تاريخ إضافة العميل</span>
          </div>

          <div className="flex justify-between items-center">
            <span className="font-bold text-blue-600">{active.visit_count || 1}</span>
            <span className="flex items-center gap-1"><History size={14} /> عدد الزيارات</span>
          </div>
        </div>

        {/* Action Button */}
        {onRegisterVisit && (
          <button 
            onClick={() => onRegisterVisit(active)}
            className="w-full py-2 bg-blue-50 text-blue-600 text-xs font-bold rounded-xl border border-blue-100 mt-2"
          >
            تسجيل زيارة اليوم
          </button>
        )}

        {/* Notes */}
        {active.notes && (
          <div className="pt-3 border-t border-gray-100">
            <h4 className="text-xs font-bold text-gray-700 flex items-center gap-1 mb-1">
              <FileText size={14} /> ملاحظات
            </h4>
            <p className="text-xs text-gray-600 leading-relaxed bg-gray-50 p-2.5 rounded-xl border border-gray-100">
              {active.notes}
            </p>
          </div>
        )}

        {/* Offers */}
        <div className="pt-3 border-t border-gray-100">
          <h4 className="text-xs font-bold text-gray-700 flex items-center gap-1 mb-1">
            <Briefcase size={14} /> الأوفرات
          </h4>
          <p className="text-xs text-gray-400">لا يوجد أوفرات مسجلة بعد</p>
        </div>

      </div>
    </div>
  );
}
