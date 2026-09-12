// ============================================================================
// Customer add/edit form screen, extracted from App.jsx. Presentational
// only — form state and saveForm() still live in App.jsx.
// ============================================================================

import React, { useState } from "react";
import { ChevronDown } from "lucide-react";
import { TagChip } from "./Shared";
import {
  PRIMARY, PRIMARY_MID, DANGER, MUTED, LINE, SURFACE,
  STAGE_IDS, SECTOR_IDS, ROLE_IDS, parseTagsCell,
} from "../constants";

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

// Same grouping idea as FormSection, but the group starts collapsed and
// only renders its fields once the person taps the header — used for the
// less-frequently-touched sections (classification / scheduling / notes)
// so the form isn't one long scroll of every field at once. The "basic
// info" section stays as a plain always-open FormSection since it's what
// almost everyone fills in first.
function CollapsibleSection({ title, defaultOpen = false, children }) {
  const [open, setOpen] = useState(defaultOpen);
  return (
    <div style={{ borderTop: `0.5px solid ${LINE}`, marginTop: 4 }}>
      <button
        type="button"
        onClick={() => setOpen((o) => !o)}
        className="btn-press w-full flex items-center justify-between"
        style={{ padding: "14px 0" }}
      >
        <span className="text-xs font-bold" style={{ color: PRIMARY_MID, letterSpacing: 0.3 }}>
          {title}
        </span>
        <ChevronDown
          size={16}
          color={MUTED}
          style={{ transform: open ? "rotate(180deg)" : "none", transition: "transform 150ms ease" }}
        />
      </button>
      {open && <div className="flex flex-col gap-3" style={{ paddingBottom: 16 }}>{children}</div>}
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
  return (
    <div className="px-4 pt-4 pb-10 flex flex-col gap-4">
     <div
      className="flex flex-col"
      style={{ background: SURFACE, borderRadius: 16, border: `1px solid ${LINE}`, padding: 16 }}
     >
      <FormSection title={t.formSectionBasic} first>
        <div>
          <label>{t.companyLabel}</label>
          <input
            value={form.companyName}
            onChange={(e) => setForm({ ...form, companyName: e.target.value })}
            placeholder={t.companyPlaceholder}
          />
          {errors.companyName && <p className="text-xs mt-1" style={{ color: DANGER }}>{errors.companyName}</p>}
        </div>

        <div className="grid grid-cols-2 gap-3">
          <div>
            <label>{t.contactLabel}</label>
            <input
              value={form.contactName}
              onChange={(e) => setForm({ ...form, contactName: e.target.value })}
              placeholder={t.contactPlaceholder}
            />
            {errors.contactName && <p className="text-xs mt-1" style={{ color: DANGER }}>{errors.contactName}</p>}
          </div>

          <div>
            <label>{t.roleLabel}</label>
            <select value={form.role} onChange={(e) => setForm({ ...form, role: e.target.value })}>
              {ROLE_IDS.map((id) => (
                <option key={id} value={id}>{t.roles[id]}</option>
              ))}
            </select>
          </div>
        </div>

        <div className="grid grid-cols-2 gap-3">
          <div>
            <label>{t.phoneLabel}</label>
            <input
              type="tel"
              value={form.phone}
              onChange={(e) => setForm({ ...form, phone: e.target.value })}
              placeholder={t.phonePlaceholder}
            />
          </div>

          <div>
            <label>{t.emailLabel}</label>
            <input
              type="email"
              value={form.email}
              onChange={(e) => setForm({ ...form, email: e.target.value })}
              placeholder={t.emailPlaceholder}
            />
          </div>
        </div>
      </FormSection>

      <CollapsibleSection title={t.formSectionClassification}>
        <div className="grid grid-cols-2 gap-3">
          <div>
            <label>{t.sectorLabel}</label>
            <select value={form.sector} onChange={(e) => setForm({ ...form, sector: e.target.value })}>
              {SECTOR_IDS.map((id) => (
                <option key={id} value={id}>{t.sectors[id]}</option>
              ))}
            </select>
          </div>

          <div>
            <label>{t.pipelineLabel}</label>
            <select value={form.stage} onChange={(e) => setForm({ ...form, stage: e.target.value })}>
              <option value="">{t.stageNone}</option>
              {STAGE_IDS.map((id) => (
                <option key={id} value={id}>{t.stages[id]}</option>
              ))}
            </select>
          </div>
        </div>

        <div>
          <label>{t.tagsLabel}</label>
          <input
            value={form.tagsInput}
            onChange={(e) => setForm({ ...form, tagsInput: e.target.value })}
            placeholder={t.tagsPlaceholder}
          />
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
            <label>{t.visitDateLabel}</label>
            <input
              type="date"
              value={form.visitDate}
              onChange={(e) => setForm({ ...form, visitDate: e.target.value })}
            />
            <p className="text-xs mt-1" style={{ color: MUTED }}>
              {t.visitDateHint}
            </p>
          </div>

          <div>
            <label>{t.callDateLabel}</label>
            <input
              type="datetime-local"
              value={form.callDateTime}
              onChange={(e) => setForm({ ...form, callDateTime: e.target.value, notified: false })}
            />
            <p className="text-xs mt-1" style={{ color: MUTED }}>
              {t.callDateHint}
            </p>
          </div>
        </div>
      </CollapsibleSection>

      <CollapsibleSection title={t.formSectionNotes}>
        <div>
          <label>{t.notesLabel}</label>
          <textarea
            rows={5}
            value={form.notes}
            onChange={(e) => setForm({ ...form, notes: e.target.value })}
            placeholder={t.notesPlaceholder}
          />
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
