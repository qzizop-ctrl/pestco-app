// ============================================================================
// Customer add/edit form screen, extracted from App.jsx. Presentational
// only — form state and saveForm() still live in App.jsx.
// ============================================================================

import {
  Building2, User, Briefcase, Phone, Mail,
  LayoutGrid, Flag, Tag, CalendarDays, PhoneCall, StickyNote,
} from "lucide-react";
import { TagChip } from "./Shared";
import { PRIMARY, PRIMARY_MID, DANGER, MUTED, LINE, SURFACE } from "../theme";
import { STAGE_IDS, SECTOR_IDS, ROLE_IDS } from "../domain";
import { parseTagsCell } from "../helpers";

// Bordered, rounded wrapper that puts a small leading icon in front of a
// field so a form with many inputs is easier to scan at a glance. The
// child input/select/textarea should carry className="field-bare" so its
// own border/background gets stripped and only the wrapper's border shows.
// `top` aligns the icon to the top instead of centering it, for the
// multi-line notes textarea.
export function IconField({ icon: Icon, top, children }) {
  return (
    <div className={`icon-field${top ? " icon-field-top" : ""}`}>
      <Icon size={17} color={MUTED} style={{ flexShrink: 0, marginTop: top ? 2 : 0 }} />
      {children}
    </div>
  );
}

// Small uppercase-ish section header used to group related fields (basic
// info / classification / contact / scheduling / notes) so the form reads
// as a few short groups instead of one long list of inputs.
export function FormSection({ title, first, children }) {
  return (
    <div
      style={{
        borderTop: first ? "none" : `0.5px solid ${LINE}`,
        paddingTop: first ? 0 : 16,
      }}
    >
      <p
        className="text-xs font-bold"
        style={{ color: PRIMARY_MID, letterSpacing: 0.3, marginBottom: 10 }}
      >
        {title}
      </p>
      <div className="flex flex-col gap-3">{children}</div>
    </div>
  );
}

// Same grouping idea as FormSection, but with the header rendered as a
// plain non-interactive label (no toggle) — used for classification /
// scheduling / notes. All fields are always visible; nothing collapses.
function CollapsibleSection({ title, children }) {
  return (
    <div style={{ borderTop: `0.5px solid ${LINE}`, marginTop: 4 }}>
      <div style={{ padding: "14px 0 8px" }}>
        <span className="text-xs font-bold" style={{ color: PRIMARY_MID, letterSpacing: 0.3 }}>
          {title}
        </span>
      </div>
      <div className="flex flex-col gap-3" style={{ paddingBottom: 16 }}>{children}</div>
    </div>
  );
}

export default function CustomerFormScreen({
  t,
  form,
  setForm,
  errors,
  removeTagFromForm,
  saveForm,
  saving,
}) {
  // ملحوظة: تسجيل التغييرات (last_change.changes) بيتحسب جوه saveForm
  // نفسها في useCustomerRecords.js (مش App.jsx — الملف ده كان اتنقل منه)،
  // لأنها هي اللي عندها السجل الأصلي الموثوق من Firestore (visits state)
  // وهي اللي بتكتب فعليًا على قاعدة البيانات. الاعتماد على نسخة محلية هنا
  // كان بيدّي نتائج غلط دايمًا لأن الحفظ الفعلي (saveForm) كان بيتجاهل أي
  // بيانات ممرّرة له ويبني last_change من جديد بدون تفاصيل.

  return (
    <div className="px-4 pt-4 pb-10 flex flex-col gap-4">
     <div
      className="flex flex-col"
      style={{ background: SURFACE, borderRadius: 16, border: `1px solid ${LINE}`, padding: 16 }}
     >
      <FormSection title={t.formSectionBasic} first>
        <div>
          <label htmlFor="cf-companyName">{t.companyLabel}</label>
          <IconField icon={Building2}>
            <input
              id="cf-companyName"
              className="field-bare"
              value={form.companyName}
              onChange={(e) => setForm({ ...form, companyName: e.target.value })}
              placeholder={t.companyPlaceholder}
            />
          </IconField>
          {errors.companyName && <p className="text-xs mt-1" style={{ color: DANGER }}>{errors.companyName}</p>}
        </div>

        <div className="grid grid-cols-2 gap-3">
          <div>
            <label htmlFor="cf-contactName">{t.contactLabel}</label>
            <IconField icon={User}>
              <input
                id="cf-contactName"
                className="field-bare"
                value={form.contactName}
                onChange={(e) => setForm({ ...form, contactName: e.target.value })}
                placeholder={t.contactPlaceholder}
              />
            </IconField>
            {errors.contactName && <p className="text-xs mt-1" style={{ color: DANGER }}>{errors.contactName}</p>}
          </div>

          <div>
            <label htmlFor="cf-role">{t.roleLabel}</label>
            <IconField icon={Briefcase}>
              <select id="cf-role" className="field-bare" value={form.role} onChange={(e) => setForm({ ...form, role: e.target.value })}>
                {ROLE_IDS.map((id) => (
                  <option key={id} value={id}>{t.roles[id]}</option>
                ))}
              </select>
            </IconField>
          </div>
        </div>

        <div className="grid grid-cols-2 gap-3">
          <div>
            <label htmlFor="cf-phone">{t.phoneLabel}</label>
            <IconField icon={Phone}>
              <input
                id="cf-phone"
                className="field-bare"
                type="tel"
                value={form.phone}
                onChange={(e) => setForm({ ...form, phone: e.target.value })}
                placeholder={t.phonePlaceholder}
              />
            </IconField>
          </div>

          <div>
            <label htmlFor="cf-email">{t.emailLabel}</label>
            <IconField icon={Mail}>
              <input
                id="cf-email"
                className="field-bare"
                type="email"
                value={form.email}
                onChange={(e) => setForm({ ...form, email: e.target.value })}
                placeholder={t.emailPlaceholder}
              />
            </IconField>
          </div>
        </div>
      </FormSection>

      <CollapsibleSection title={t.formSectionClassification}>
        <div className="grid grid-cols-2 gap-3">
          <div>
            <label htmlFor="cf-sector">{t.sectorLabel}</label>
            <IconField icon={LayoutGrid}>
              <select id="cf-sector" className="field-bare" value={form.sector} onChange={(e) => setForm({ ...form, sector: e.target.value })}>
                <option value="" disabled>{t.sectorPlaceholder}</option>
                {SECTOR_IDS.map((id) => (
                  <option key={id} value={id}>{t.sectors[id]}</option>
                ))}
              </select>
            </IconField>
            {errors.sector && <p className="text-xs mt-1" style={{ color: DANGER }}>{errors.sector}</p>}
          </div>

          <div>
            <label htmlFor="cf-stage">{t.pipelineLabel}</label>
            <IconField icon={Flag}>
              <select id="cf-stage" className="field-bare" value={form.stage} onChange={(e) => setForm({ ...form, stage: e.target.value })}>
                <option value="">{t.stageNone}</option>
                {STAGE_IDS.map((id) => (
                  <option key={id} value={id}>{t.stages[id]}</option>
                ))}
              </select>
            </IconField>
          </div>
        </div>

        <div>
          <label htmlFor="cf-tags">{t.tagsLabel}</label>
          <IconField icon={Tag}>
            <input
              id="cf-tags"
              className="field-bare"
              value={form.tagsInput}
              onChange={(e) => setForm({ ...form, tagsInput: e.target.value })}
              placeholder={t.tagsPlaceholder}
            />
          </IconField>
          {parseTagsCell(form.tagsInput).length > 0 && (
            <div className="flex items-center flex-wrap gap-1 mt-2">
              {parseTagsCell(form.tagsInput).map((tag) => (
                <TagChip key={tag} label={tag} onRemove={() => removeTagFromForm(tag)} />
              ))}
            </div>
          )}
        </div>
      </CollapsibleSection>

      <CollapsibleSection title={t.formSectionSchedule}>
        <div className="grid grid-cols-2 gap-3">
          <div>
            <label htmlFor="cf-visitDate">{t.visitDateLabel}</label>
            <IconField icon={CalendarDays}>
              <input
                id="cf-visitDate"
                className="field-bare"
                type="date"
                value={form.visitDate}
                onChange={(e) => setForm({ ...form, visitDate: e.target.value })}
              />
            </IconField>
            <p className="text-xs mt-1" style={{ color: MUTED }}>
              {t.visitDateHint}
            </p>
          </div>

          <div>
            <label htmlFor="cf-callDateTime">{t.callDateLabel}</label>
            <IconField icon={PhoneCall}>
              <input
                id="cf-callDateTime"
                className="field-bare"
                type="datetime-local"
                value={form.callDateTime}
                onChange={(e) => setForm({ ...form, callDateTime: e.target.value, notified: false })}
              />
            </IconField>
            <p className="text-xs mt-1" style={{ color: MUTED }}>
              {t.callDateHint}
            </p>
          </div>
        </div>
      </CollapsibleSection>

      <CollapsibleSection title={t.formSectionNotes}>
        <div>
          <label htmlFor="cf-notes">{t.notesLabel}</label>
          <IconField icon={StickyNote} top>
            <textarea
              id="cf-notes"
              className="field-bare"
              rows={5}
              value={form.notes}
              onChange={(e) => setForm({ ...form, notes: e.target.value })}
              placeholder={t.notesPlaceholder}
            />
          </IconField>
        </div>
      </CollapsibleSection>
     </div>

      <button
        onClick={saveForm}
        disabled={saving}
        className="btn-press font-bold"
        style={{ background: PRIMARY, color: "#fff", borderRadius: 14, padding: "12px 0", opacity: saving ? 0.7 : 1 }}
      >
        {saving ? t.saving : t.save}
      </button>
    </div>
  );
}
