import { useState, useCallback, useRef } from "react";
import {
  collection, doc, updateDoc, writeBatch, serverTimestamp, arrayUnion,
} from "firebase/firestore";
import { db } from "../firebase";
import { scheduleCallReminder, cancelCallReminder } from "../notifications";
import { emptyForm } from "../domain";
import { buildActivity, buildVisitEntry } from "../activityHelpers";
import { corePhoneDigits } from "../customerDuplicates";
import { fmtReminder, toISODate, todayLocalISO } from "../dateUtils";
import { buildVisitEditFields } from "../formHelpers";
import { parseTagsCell } from "../tagsAndLinks";
import { queueAudit } from "./useAuditLog";
import { useFlushOnHide } from "./useFlushOnHide";

// Everything to do with a single customer ("visit") record: the edit form,
// opening/closing the detail screen, saving, soft-deleting, pinning,
// stage changes, and logging a visit. Split out of App.jsx, which used to
// hold all of this inline alongside the supplier and offer equivalents.
//
// `appendActivity` is passed in (from useActivityLog) rather than owned
// here, since it's shared with the offers hook too — keeping one single
// implementation instead of two copies that could drift apart.
// Form state -> the plain data object saveForm writes (same field stripping
// and tags parsing it applies), so the form as OPENED and the form as SAVED
// can be diffed field by field.
function toFormData(f) {
  const {
    id: _id, tagsInput, activityLog: _activityLog, offers: _offers, visitHistory: _visitHistory,
    last_change: _last_change, originalCustomer: _originalCustomer, ...rest
  } = f;
  return { ...rest, tags: parseTagsCell(tagsInput) };
}

export function useCustomerRecords({
  ownerUid, user, visits, canEdit, requireOnline, confirmAction, reportSaveError,
  appendActivity, t, lang, setScreen, resetDetailPanels, setIsSaving,
  activeId, setActiveId,
}) {
  const [form, setForm] = useState(emptyForm);
  const [errors, setErrors] = useState({});
  const [pendingDelete, setPendingDelete] = useState(null); // { id, companyName, timeoutId }
  // Mirror of pendingDelete readable from event handlers (pagehide / visibility)
  // without a stale closure — see useFlushOnHide.
  const pendingDeleteRef = useRef(null);
  // The form exactly as it was when the edit screen opened. Saving diffs
  // against THIS (not the live record) so only the fields the person really
  // edited are written — see diffVisitFields in helpers.js.
  const editBaselineRef = useRef(null);

  const openNew = () => {
    if (!canEdit) return;
    editBaselineRef.current = null;
    setForm(emptyForm);
    setErrors({});
    setScreen("form");
  };

  const openEdit = (visit) => {
    if (!canEdit) return;
    const initialForm = {
      ...emptyForm,
      ...visit,
      stage: visit.stage || "",
      visitDate: toISODate(visit.visitDate),
      tagsInput: (visit.tags || []).join(", "),
    };
    editBaselineRef.current = initialForm;
    setForm(initialForm);
    setErrors({});
    setScreen("form");
  };

  // Stable reference (empty deps — only calls setState setters, which React
  // guarantees never change) so VisitCard's React.memo can actually skip
  // re-rendering rows on unrelated App re-renders, e.g. while typing in
  // the search box.
  const openDetail = useCallback((visit) => {
    setActiveId(visit.id);
    resetDetailPanels && resetDetailPanels();
    setScreen("detail");
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const validate = () => {
    const e = {};
    if (!form.companyName.trim()) e.companyName = t.companyError;
    if (!form.contactName.trim()) e.contactName = t.contactError;
    if (!form.sector) e.sector = t.sectorError;
    setErrors(e);
    return Object.keys(e).length === 0;
  };

  const findDuplicatePhone = (phone, excludeId) => {
    const clean = corePhoneDigits(phone);
    if (!clean) return null;
    return (
      // Excludes soft-deleted records (deleted: true) — otherwise a phone
      // number that only matches a customer someone already deleted would
      // still trigger a "duplicate phone" warning, which is confusing since
      // that customer is gone as far as the user can see.
      visits.find(
        (v) => v.id !== excludeId && !v.deleted && corePhoneDigits(v.phone) === clean
      ) || null
    );
  };

  const removeTagFromForm = (tag) => {
    const remaining = (form.tagsInput || "")
      .split(",")
      .map((s) => s.trim())
      .filter((s) => s && s !== tag);
    setForm({ ...form, tagsInput: remaining.join(", ") });
  };

  const saveForm = () => {
    // Defense in depth: even if the UI hid the buttons, never let a
    // viewer's client write. The Firestore rules enforce this too.
    if (!canEdit) return;
    if (!requireOnline()) return;
    if (!validate() || !user || !ownerUid) return;

    const proceedSave = async () => {
      const { id, tagsInput, activityLog: _activityLog, offers: _offers, visitHistory: _visitHistory, last_change: _last_change, originalCustomer: _originalCustomer, ...rest } = form;
      const data = { ...rest, tags: parseTagsCell(tagsInput) };
      const original = id ? visits.find((v) => v.id === id) : null;
      const baselineForm = id && editBaselineRef.current && editBaselineRef.current.id === id
        ? editBaselineRef.current
        : null;
      const baselineData = baselineForm ? toFormData(baselineForm) : null;
      // What this person actually changed (whole form when creating / when
      // there is no baseline). Both the write and the audit trail use it, so
      // a stale value for a field someone else changed meanwhile is neither
      // written nor recorded as if this person had edited it.
      const editFields = id ? buildVisitEditFields(baselineData, data) : data;

      // تجهيز كائن التتبع (Audit Log) — بيقارن كل حقل في البيانات الجديدة
      // بالسجل الأصلي الموجود فعليًا في Firestore (visits state)، عشان
      // القيم القديمة في last_change.changes تبقى حقيقية، مش "فارغ" لكل حقل.
      const auditIgnoreKeys = ["tags", "createdAt", "updatedAt", "notified"];
      const changes = {};
      if (original) {
        Object.keys(editFields).forEach((key) => {
          if (auditIgnoreKeys.includes(key)) return;
          const oldVal = original[key];
          const newVal = data[key];
          const oldCompare = oldVal ?? "";
          const newCompare = newVal ?? "";
          if (oldCompare !== newCompare) {
            changes[key] = { old_value: oldVal ?? "فارغ", new_value: newVal ?? "فارغ" };
          }
        });
      }

      const lastChangeData = {
        updatedBy: user?.displayName || user?.email || "موظف غير معروف",
        updatedById: user?.uid || null,
        updatedAt: new Date().toISOString(),
        ...(Object.keys(changes).length > 0 ? { changes } : {}),
      };

      setIsSaving(true);
      try {
        let savedId = id;
        // Record write and its audit entry go in ONE batch, so they either
        // both land or both fail (see queueAudit).
        const batch = writeBatch(db);
        if (id) {
          // Send only the fields this person actually changed since opening
          // the form — writing the whole form back would overwrite a
          // concurrent pin / stage change / reschedule made by someone else
          // while it was open.
          const updatePayload = {
            ...editFields,
            last_change: lastChangeData,
            updatedAt: new Date().toISOString()
          };
          if (original && original.visitDate !== data.visitDate && data.visitDate) {
            updatePayload.visitHistory = arrayUnion(buildVisitEntry(data.visitDate));
          }
          batch.update(doc(db, "users", ownerUid, "visits", id), updatePayload);
          queueAudit(batch, ownerUid, {
            entityType: "customer", entityId: id, entityName: data.companyName,
            action: "update", changes, user, t,
          });
        } else {
          const ref = doc(collection(db, "users", ownerUid, "visits"));
          savedId = ref.id;
          batch.set(ref, {
            ...data,
            last_change: lastChangeData,
            activityLog: [],
            offers: [],
            visitHistory: data.visitDate ? [buildVisitEntry(data.visitDate)] : [],
            createdAt: serverTimestamp(),
            updatedAt: new Date().toISOString()
          });
          queueAudit(batch, ownerUid, {
            entityType: "customer", entityId: savedId, entityName: data.companyName,
            action: "create", user, t,
          });
        }
        await batch.commit();

        if (!id) {
          await appendActivity(savedId, buildActivity("created", t.activityCreated));
        } else {
          if (original && original.stage !== data.stage) {
            await appendActivity(
              savedId,
              buildActivity(
                "stage",
                data.stage ? t.activityStageChanged(t.stages[data.stage] || data.stage) : t.activityStageCleared
              )
            );
          }
          if (original && original.callDateTime !== data.callDateTime && data.callDateTime) {
            await appendActivity(savedId, buildActivity("call", t.activityCallSet(fmtReminder(data.callDateTime, t.locale))));
          }
        }

        if (data.callDateTime) {
          await scheduleCallReminder(
            savedId,
            data.callDateTime,
            `${t.reminderTitle} ${data.companyName}`,
            t.reminderBody(data.contactName)
          );
        } else {
          await cancelCallReminder(savedId);
        }
        setScreen("list");
      } catch (e) {
        reportSaveError(e);
      } finally {
        setIsSaving(false);
      }
    };

    // Chain: phone-missing warning -> duplicate-phone warning -> actual save.
    // Each step only runs once the previous one's confirm modal is accepted.
    const checkDuplicateThenSave = () => {
      const duplicate = form.phone ? findDuplicatePhone(form.phone, form.id) : null;
      if (duplicate) {
        confirmAction(t.duplicatePhoneWarning(duplicate.companyName), proceedSave);
        return;
      }
      proceedSave();
    };

    if (!form.phone.trim()) {
      confirmAction(t.phoneMissingWarning, checkDuplicateThenSave);
      return;
    }
    checkDuplicateThenSave();
  };

  // The actual (soft) delete write, plus its audit entry in the same batch.
  const commitDeleteVisit = async (id, companyName) => {
    try {
      const batch = writeBatch(db);
      batch.update(doc(db, "users", ownerUid, "visits", id), {
        deleted: true,
        last_change: {
          type: "delete",
          updatedBy: user?.displayName || user?.email || "موظف غير معروف",
          updatedById: user?.uid || null,
          updatedAt: new Date().toISOString(),
        },
      });
      queueAudit(batch, ownerUid, {
        entityType: "customer", entityId: id, entityName: companyName,
        action: "delete", user, t,
      });
      await batch.commit();
      await cancelCallReminder(id);
    } catch (e) {
      reportSaveError(e);
    }
    setPendingDelete((cur) => (cur && cur.id === id ? null : cur));
  };

  // App backgrounded/closed inside the 5-second undo window: commit the
  // delete now instead of losing it (see useFlushOnHide).
  useFlushOnHide(() => {
    const p = pendingDeleteRef.current;
    if (!p) return;
    clearTimeout(p.timeoutId);
    pendingDeleteRef.current = null;
    commitDeleteVisit(p.id, p.companyName);
  });

  const proceedDeleteVisit = async (id) => {
    const visit = visits.find((v) => v.id === id);
    setScreen("list");

    // Soft delete: hide immediately from the UI (self-undo window for the
    // person deleting), then — after a few seconds — flag the document as
    // deleted instead of actually removing it from Firestore. Flagging it
    // (rather than deleteDoc) sets last_change just like a normal edit does,
    // so it shows up in the owner's pending-edits bell/sheet and can be
    // approved (final delete) or rolled back (restored) from CustomerDetail,
    // the same review flow edits already get. Only the owner's approval
    // actually calls deleteDoc.
    const companyName = visit ? visit.companyName : "";
    const timeoutId = setTimeout(() => {
      pendingDeleteRef.current = null;
      commitDeleteVisit(id, companyName);
    }, 5000);

    const pending = { id, companyName, timeoutId };
    pendingDeleteRef.current = pending;
    setPendingDelete(pending);
  };

  const deleteVisit = (id) => {
    if (!canEdit) return;
    if (!requireOnline()) return;
    if (!user || !ownerUid) return;
    const confirmMsg = lang === "ar"
      ? "هل أنت متأكد من حذف هذا العميل؟"
      : "Are you sure you want to delete this customer?";
    confirmAction(confirmMsg, () => {
      proceedDeleteVisit(id);
    }, { danger: true });
  };

  const undoDelete = () => {
    if (!pendingDelete) return;
    clearTimeout(pendingDelete.timeoutId);
    pendingDeleteRef.current = null;
    setPendingDelete(null);
  };

  // Quick stage change from the detail screen, without opening the full edit form.
  // Tapping the currently-active stage again clears it instead of no-op'ing.
  const changeStage = async (visit, newStage) => {
    if (!canEdit) return;
    if (!requireOnline()) return;
    if (!ownerUid) return;
    const current = visit.stage || "";
    const target = newStage === current ? "" : newStage;
    try {
      await updateDoc(doc(db, "users", ownerUid, "visits", visit.id), { stage: target });
      await appendActivity(
        visit.id,
        buildActivity(
          "stage",
          target ? t.activityStageChanged(t.stages[target] || target) : t.activityStageCleared
        )
      );
    } catch (e) {
      reportSaveError(e);
    }
  };

  // Pins/unpins a customer so it stays sorted to the top of the list.
  // Stable across renders unless canEdit/ownerUid/requireOnline actually
  // change — same reasoning as openDetail above.
  const togglePin = useCallback(async (visit) => {
    if (!canEdit || !ownerUid) return;
    if (!requireOnline()) return;
    try {
      await updateDoc(doc(db, "users", ownerUid, "visits", visit.id), { isPinned: !visit.isPinned });
    } catch (e) {
      reportSaveError(e);
    }
  }, [canEdit, ownerUid, requireOnline, reportSaveError]);

  // Records that an actual visit happened today: pushes a new visit-history
  // entry (so the Dashboard's visit count reflects real repeat visits) and
  // bumps the customer's visitDate to today.
  const logVisitToday = async (visit) => {
    if (!canEdit || !visit || !ownerUid) return;
    if (!requireOnline()) return;
    const today = todayLocalISO();
    try {
      await updateDoc(doc(db, "users", ownerUid, "visits", visit.id), {
        visitDate: today,
        visitHistory: arrayUnion(buildVisitEntry(today)),
      });
      await appendActivity(visit.id, buildActivity("visit", t.activityVisitLogged(today)));
    } catch (e) {
      reportSaveError(e);
    }
  };

  // Clears a customer's pending call reminder: cancels the local
  // notification and logs it as a completed call in the activity feed.
  const clearCallReminder = async (visit) => {
    // Same defense-in-depth as every other write here: the button is hidden
    // for viewers, but the hook itself must never attempt the write.
    if (!canEdit) return;
    if (!requireOnline()) return;
    if (!user || !ownerUid || !visit) return;
    // Awaited (and reported through reportSaveError like every other write
    // in this file) rather than fired-and-forgotten: previously a failed
    // update here was swallowed silently, so cancelCallReminder() and the
    // "call done" activity entry below would still run even though the
    // Firestore write never actually went through, leaving the reminder
    // looking cleared everywhere except the database.
    try {
      await updateDoc(doc(db, "users", ownerUid, "visits", visit.id), {
        callDateTime: "",
        notified: false,
      });
    } catch (e) {
      reportSaveError(e);
      return;
    }
    cancelCallReminder(visit.id);
    await appendActivity(visit.id, buildActivity("call", t.activityCallDone));
  };

  return {
    form, setForm, errors, activeId, setActiveId, pendingDelete,
    openNew, openEdit, openDetail, removeTagFromForm, saveForm,
    deleteVisit, undoDelete, changeStage, togglePin, logVisitToday, clearCallReminder,
    findDuplicatePhone,
  };
}
