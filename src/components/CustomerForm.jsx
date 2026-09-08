// ============================================================================
// Customer add/edit form screen, extracted from App.jsx. Presentational
// only — form state and saveForm() still live in App.jsx.
// ============================================================================

import React from "react";
import { TagChip } from "./Shared";
import {
  PRIMARY, DANGER, MUTED,
  STAGE_IDS, SECTOR_IDS, ROLE_IDS, parseTagsCell,
} from "../constants";

export default function CustomerFormScreen({
  t,
  form,
  setForm,
  errors,
  removeTagFromForm,
  saveForm,
}) {
  return (
    <div className="px-4 pt-4 pb-10 flex flex-col gap-4">
      <div>
        <label>{t.companyLabel}</label>
        <input
          value={form.companyName}
          onChange={(e) => setForm({ ...form, companyName: e.target.value })}
          placeholder={t.companyPlaceholder}
        />
        {errors.companyName && <p className="text-xs mt-1" style={{ color: DANGER }}>{errors.companyName}</p>}
      </div>

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
        <label>{t.pipelineLabel}</label>
        <select value={form.stage} onChange={(e) => setForm({ ...form, stage: e.target.value })}>
          <option value="">{t.stageNone}</option>
          {STAGE_IDS.map((id) => (
            <option key={id} value={id}>{t.stages[id]}</option>
          ))}
        </select>
      </div>

      <div>
        <label>{t.sectorLabel}</label>
        <select value={form.sector} onChange={(e) => setForm({ ...form, sector: e.target.value })}>
          {SECTOR_IDS.map((id) => (
            <option key={id} value={id}>{t.sectors[id]}</option>
          ))}
        </select>
      </div>

      <div>
        <label>{t.roleLabel}</label>
        <select value={form.role} onChange={(e) => setForm({ ...form, role: e.target.value })}>
          {ROLE_IDS.map((id) => (
            <option key={id} value={id}>{t.roles[id]}</option>
          ))}
        </select>
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

      <div>
        <label>{t.notesLabel}</label>
        <textarea
          rows={5}
          value={form.notes}
          onChange={(e) => setForm({ ...form, notes: e.target.value })}
          placeholder={t.notesPlaceholder}
        />
      </div>

      <button
        onClick={saveForm}
        className="btn-press font-bold"
        style={{ background: PRIMARY, color: "#fff", borderRadius: 14, padding: "12px 0", marginTop: 8 }}
      >
        {t.save}
      </button>
    </div>
  );
}
