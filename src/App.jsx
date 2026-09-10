import React, { useState, useEffect, useRef, useMemo, useCallback, Suspense, lazy } from "react";
import { Capacitor } from "@capacitor/core";
import {
  ChevronRight, Languages, LogOut, Settings,
  Wifi, WifiOff, Moon, Sun,
} from "lucide-react";
import { Logo, TagChip, VisitCard, BottomNav, beep, SkeletonList } from "./components/Shared";
import { SuppliersListScreen, SupplierFormScreen } from "./components/Suppliers";
import SettingsScreen from "./components/Settings";
import CustomerListScreen from "./components/CustomerList";
import CustomerFormScreen from "./components/CustomerForm";
import CustomerDetailScreen from "./components/CustomerDetail";
import RejectionReasonModal from "./components/RejectionReasonModal";
import ConfirmModal from "./components/ConfirmModal";
// xlsx is loaded lazily (dynamic import) only when Export/Import is
// actually used from Settings, instead of top-level here — it's a sizeable
// library that most sessions never touch, so this keeps it out of the
// app's initial bundle/load.
import { signOut } from "firebase/auth";
import {
  collection, doc, addDoc, updateDoc, deleteDoc, serverTimestamp,
  arrayUnion, arrayRemove,
} from "firebase/firestore";
import { auth, db } from "./firebase";
import AuthScreen from "./AuthScreen";
import {
  scheduleCallReminder, cancelCallReminder,
} from "./notifications";
import { useAppPrefs } from "./hooks/useAppPrefs";
import { useWorkspace } from "./hooks/useWorkspace";
import { useLiveData } from "./hooks/useLiveData";
import { useReminders } from "./hooks/useReminders";
import { useAndroidBackButton } from "./hooks/useAndroidBackButton";
import { getCurrentLocation } from "./geo";
import {
  PRIMARY, PRIMARY_MID, TEXT, MUTED, GOLD,
  STRINGS, SECTOR_IDS, STAGE_IDS, THEME_VARS, STALE_OFFER_DAYS, STALE_ACTIVITY_DAYS,
  findSectorId, findRoleId, findStageId, parseTagsCell,
  parseVisitDate, toISODate, normalizeExcelDate, normalizeExcelDateTime,
  buildActivity, buildOffer, buildVisitEntry,
  visitStatus, fmtReminder, fmtOffersTotals, sumOffersByCurrency, corePhoneDigits,
  findDuplicateGroups, isStaleCustomer, collectSupplierTags, getVisitEvents,
  emptyForm, emptySupplierForm,
} from "./constants";

const ROOT_SCREENS = ["dashboard", "list", "suppliers", "settings"];

// Loaded lazily: the app's default screen is the customer list, not the
// Dashboard, so most sessions never need this chart-heavy screen (and its
// recharts dependency) in the initial bundle at all.
const Dashboard = lazy(() => import("./Dashboard"));

export default function App() {
  const { lang, setLang, darkMode, setDarkMode, isOnline } = useAppPrefs();

  const [screen, setScreen] = useState("list"); // dashboard | list | form | detail | settings
  const [query, setQuery] = useState("");
  // The input stays bound to `query` directly so typing feels instant; the
  // list filter below reads `debouncedQuery` instead, which only updates
  // 250ms after the user stops typing. That avoids re-filtering the full
  // customer list on every single keystroke.
  const [debouncedQuery, setDebouncedQuery] = useState("");
  useEffect(() => {
    const id = setTimeout(() => setDebouncedQuery(query), 250);
    return () => clearTimeout(id);
  }, [query]);
  const [sectorFilter, setSectorFilter] = useState("all");
  const [stageFilter, setStageFilter] = useState("all");
  const [tagFilter, setTagFilter] = useState("all");
  const [missingDataOnly, setMissingDataOnly] = useState(false);
  const [noVisitsOnly, setNoVisitsOnly] = useState(false);
  const [form, setForm] = useState(emptyForm);
  const [activeId, setActiveId] = useState(null);
  const [errors, setErrors] = useState({});
  const [newMemberEmail, setNewMemberEmail] = useState("");
  const [newMemberRole, setNewMemberRole] = useState("viewer");
  const [importing, setImporting] = useState(false);
  const [newActivityText, setNewActivityText] = useState("");
  const [newOffer, setNewOffer] = useState({
    name: "", offerNumber: "", amount: "", currency: "EGP", offerDate: new Date().toISOString().slice(0, 10), status: "pending",
  });
  const [pendingDelete, setPendingDelete] = useState(null); // { id, companyName, timeoutId }
  // Drives the in-app rejection-reason modal (replaces window.prompt).
  // { initialReason, onConfirm(reason) } while the modal is open, else null.
  const [rejectionPrompt, setRejectionPrompt] = useState(null);
  // Drives the generic in-app confirm/alert modal (replaces window.confirm
  // and window.alert). { message, variant: "confirm"|"alert", danger, onConfirm }
  const [confirmDialog, setConfirmDialog] = useState(null);
  // Replacement for `if (!window.confirm(msg)) return; doThing();` — pass the
  // message and a callback to run only if the user confirms.
  const confirmAction = useCallback((message, onConfirm, { danger = false } = {}) => {
    setConfirmDialog({ message, variant: "confirm", danger, onConfirm });
  }, []);
  // Replacement for window.alert(msg) — shows the same message, but as a
  // dismissible in-app modal instead of a blocking native dialog.
  const showAlert = useCallback((message) => {
    setConfirmDialog({ message, variant: "alert", onConfirm: () => setConfirmDialog(null) });
  }, []);
  const [showDuplicates, setShowDuplicates] = useState(false);
  const [expandedOfferId, setExpandedOfferId] = useState(null);

  // ---- Suppliers (separate from customers — contacts only) ----
  const [supplierQuery, setSupplierQuery] = useState("");
  // Same pattern as the customer search: the input stays bound to
  // supplierQuery directly for instant typing feedback, while filtering
  // reads the debounced value 250ms after the user stops typing.
  const [debouncedSupplierQuery, setDebouncedSupplierQuery] = useState("");
  useEffect(() => {
    const id = setTimeout(() => setDebouncedSupplierQuery(supplierQuery), 250);
    return () => clearTimeout(id);
  }, [supplierQuery]);
  const [supplierForm, setSupplierForm] = useState(emptySupplierForm);
  const [activeSupplierId, setActiveSupplierId] = useState(null);
  const [supplierErrors, setSupplierErrors] = useState({});
  const [supplierTagFilter, setSupplierTagFilter] = useState("all");
  const fileInputRef = useRef(null);

  const t = STRINGS[lang];
  const isRootScreen = ROOT_SCREENS.includes(screen);

  // Blocks any write attempt while offline instead of queueing it for later sync.
  const requireOnline = useCallback(() => {
    if (!isOnline) {
      showAlert(t.requireOnlineMsg);
      return false;
    }
    return true;
  }, [isOnline, t, showAlert]);

  // Surfaces a failed access-management write (grant/revoke/review/dismiss)
  // instead of leaving it silent. This previously only logged to the
  // browser console, so the owner would see the Settings action "succeed"
  // with no feedback while the underlying Firestore write was actually
  // rejected — most commonly because the security rules deployed on the
  // live Firebase project are out of date (the firestore.rules file has to
  // be deployed on its own; having it in the repo doesn't apply it).
  const reportWorkspaceError = useCallback((e) => {
    const code = e && e.code ? ` (${e.code})` : "";
    showAlert(
      lang === "ar"
        ? `حصل خطأ أثناء حفظ التغيير${code}. لو بيتكرر، تأكد إن قواعد الأمان (Firestore Rules) متنشورة فعليًا على مشروع Firebase — وجودها في الكود مش كفاية.`
        : `Failed to save the change${code}. If this keeps happening, confirm the Firestore security rules are actually deployed on the Firebase project — having them in the code isn't enough.`
    );
  }, [lang, showAlert]);

  const {
    authChecked, user, authError, clearAuthError, ownerUid, availableOwners, permissionLoading,
    canEdit, isOwnerAccount, members,
    pendingSignups, isReviewer, reviewSignup, dismissSignup,
    switchOwnerWorkspace, grantAccess, revokeAccess,
  } = useWorkspace({ requireOnline, reportError: reportWorkspaceError, screen, setScreen, setActiveId });

  const { visits, loaded, visitsError, suppliers, suppliersLoaded } = useLiveData(user, ownerUid);

  const active = visits.find((v) => v.id === activeId) || null;

  useReminders({ visits, user, ownerUid, canEdit, t });

  useAndroidBackButton({
    screen,
    setScreen,
    form,
    isRootScreen,
    hasOpenModal: !!rejectionPrompt || !!confirmDialog,
    closeModal: () => {
      setRejectionPrompt(null);
      setConfirmDialog(null);
    },
  });

  // Surfaces a *read* failure on the customer list itself — previously this
  // was swallowed entirely by useLiveData, so an account without real
  // server-side access just saw an empty list forever with zero indication
  // why. Alerts once per failed ownerUid, not on every re-render.
  const reportedVisitsErrorRef = useRef(null);
  useEffect(() => {
    if (!visitsError || reportedVisitsErrorRef.current === ownerUid) return;
    reportedVisitsErrorRef.current = ownerUid;
    const isPermissionError = visitsError.code === "permission-denied";
    showAlert(
      isPermissionError
        ? (lang === "ar"
            ? "معنديش صلاحية أشوف البيانات دي. تأكد إن الإيميل بتاعك مضاف صح في Settings عند صاحب الحساب."
            : "You don't have permission to read this data. Confirm your email is correctly added in the owner's Settings.")
        : (lang === "ar" ? `حصل خطأ أثناء تحميل العملاء: ${visitsError.message}` : `Failed to load customers: ${visitsError.message}`)
    );
  }, [visitsError, ownerUid, lang, showAlert]);

  // Surfaces a save failure to the user instead of swallowing it silently.
  // A "permission-denied" here almost always means the signed-in account's
  // role in Firestore doesn't actually match what Settings shows (e.g. it's
  // still "viewer" server-side) — this makes that visible instead of the
  // save just silently doing nothing.
  const reportSaveError = (e) => {
    console.error("Save failed:", e);
    const isPermissionError = e && (e.code === "permission-denied" || String(e.code || "").includes("permission-denied"));
    showAlert(
      isPermissionError
        ? (lang === "ar"
            ? "معنديش صلاحية أكتب في البيانات دي. تأكد إن الدور بتاعك مضبوط 'يشوف ويعدل' فعليًا."
            : "You don't have permission to write this data. Confirm your role is actually set to 'editor'.")
        : (lang === "ar" ? `حصل خطأ أثناء الحفظ: ${e && e.message ? e.message : e}` : `Save failed: ${e && e.message ? e.message : e}`)
    );
  };


  // Appends one entry to a visit's activity timeline without overwriting the rest of the log.
  const appendActivity = async (visitId, activity) => {
    if (!ownerUid) return;
    try {
      await updateDoc(doc(db, "users", ownerUid, "visits", visitId), {
        activityLog: arrayUnion(activity),
      });
    } catch (e) {
      reportSaveError(e);
    }
  };

  // Removes one entry from a visit's activity timeline (with confirmation).
  const deleteActivity = (entry) => {
    if (!canEdit || !active || !ownerUid) return;
    if (!requireOnline()) return;
    confirmAction(t.deleteActivityConfirm, async () => {
      try {
        await updateDoc(doc(db, "users", ownerUid, "visits", active.id), {
          activityLog: arrayRemove(entry),
        });
      } catch (e) {
        reportSaveError(e);
      }
    }, { danger: true });
  };

  // ---- Offers CRUD (stored as an array field on the customer document, same
  // pattern as activityLog, so a customer's offers always stay attached to
  // their own record and inherit the customer's sector automatically). ----

  const addOffer = async (visit) => {
    if (!canEdit || !visit || !ownerUid) return;
    if (!requireOnline()) return;
    if (!newOffer.name.trim()) return;

    const saveOffer = async (offerToSave) => {
      const offer = buildOffer(offerToSave);
      try {
        await updateDoc(doc(db, "users", ownerUid, "visits", visit.id), {
          offers: arrayUnion(offer),
        });
        await appendActivity(visit.id, buildActivity("offer", t.activityOfferAdded(offer.name)));
        setNewOffer({ name: "", offerNumber: "", amount: "", currency: "EGP", offerDate: new Date().toISOString().slice(0, 10), status: "pending" });
      } catch (e) {
        reportSaveError(e);
      }
    };

    if (newOffer.status === "rejected") {
      setRejectionPrompt({
        initialReason: "",
        onConfirm: (reason) => saveOffer({ ...newOffer, rejectionReason: reason }),
      });
      return;
    }
    await saveOffer(newOffer);
  };

  const updateOfferStatus = async (visit, offer, newStatus) => {
    if (!canEdit || !visit || !ownerUid) return;
    if (!requireOnline()) return;
    if (newStatus === offer.status) return;

    const saveStatus = async (rejectionReason) => {
      const updated = (visit.offers || []).map((o) =>
        o.id === offer.id ? { ...o, status: newStatus, rejectionReason: newStatus === "rejected" ? rejectionReason : "" } : o
      );
      try {
        await updateDoc(doc(db, "users", ownerUid, "visits", visit.id), { offers: updated });
        await appendActivity(visit.id, buildActivity("offer", t.activityOfferStatus(offer.name, t.offerStatuses[newStatus] || newStatus)));
      } catch (e) {
        reportSaveError(e);
      }
    };

    if (newStatus === "rejected") {
      setRejectionPrompt({
        initialReason: offer.rejectionReason || "",
        onConfirm: (reason) => saveStatus(reason),
      });
      return;
    }
    await saveStatus("");
  };

  const deleteOffer = (visit, offer) => {
    if (!canEdit || !visit || !ownerUid) return;
    if (!requireOnline()) return;
    confirmAction(t.deleteOfferConfirm, async () => {
      try {
        await updateDoc(doc(db, "users", ownerUid, "visits", visit.id), {
          offers: arrayRemove(offer),
        });
      } catch (e) {
        reportSaveError(e);
      }
    }, { danger: true });
  };

  const openNew = () => {
    if (!canEdit) return;
    setForm(emptyForm);
    setErrors({});
    setScreen("form");
  };

  const openEdit = (visit) => {
    if (!canEdit) return;
    setForm({
      ...emptyForm,
      ...visit,
      stage: visit.stage || "",
      visitDate: toISODate(visit.visitDate),
      tagsInput: (visit.tags || []).join(", "),
    });
    setErrors({});
    setScreen("form");
  };

  // Stable reference (empty deps — only calls setState setters, which React
  // guarantees never change) so VisitCard's React.memo can actually skip
  // re-rendering rows on unrelated App re-renders, e.g. while typing in
  // the search box.
  const openDetail = useCallback((visit) => {
    setActiveId(visit.id);
    setNewActivityText("");
    setNewOffer({ name: "", offerNumber: "", amount: "", currency: "EGP", offerDate: new Date().toISOString().slice(0, 10), status: "pending" });
    setExpandedOfferId(null);
    setScreen("detail");
  }, []);

  // ---- Suppliers CRUD (simple contact records — no visits/pipeline/offers) ----

  const openNewSupplier = () => {
    if (!canEdit) return;
    setSupplierForm(emptySupplierForm);
    setSupplierErrors({});
    setActiveSupplierId(null);
    setScreen("supplier-form");
  };

  // Loads the supplier's tags array back into the comma-separated text field
  // the form uses, the same way openEdit does for customer tags.
  const openEditSupplier = (supplier) => {
    if (!canEdit) return;
    setSupplierForm({
      ...emptySupplierForm,
      ...supplier,
      tagsInput: (supplier.tags || []).join(", "),
    });
    setSupplierErrors({});
    setActiveSupplierId(supplier.id);
    setScreen("supplier-form");
  };

  const validateSupplier = () => {
    const e = {};
    if (!supplierForm.name.trim()) e.name = t.supplierNameError;
    setSupplierErrors(e);
    return Object.keys(e).length === 0;
  };

  // Removes one tag from the supplier form's comma-separated tags text,
  // mirroring removeTagFromForm for customers.
  const removeTagFromSupplierForm = (tag) => {
    const remaining = (supplierForm.tagsInput || "")
      .split(",")
      .map((s) => s.trim())
      .filter((s) => s && s !== tag);
    setSupplierForm({ ...supplierForm, tagsInput: remaining.join(", ") });
  };

  const saveSupplierForm = async () => {
    if (!canEdit) return;
    if (!requireOnline()) return;
    if (!validateSupplier() || !user || !ownerUid) return;

    const { id, tagsInput, ...rest } = supplierForm;
    const data = { ...rest, tags: parseTagsCell(tagsInput) };
    try {
      if (activeSupplierId) {
        await updateDoc(doc(db, "users", ownerUid, "suppliers", activeSupplierId), data);
      } else {
        await addDoc(collection(db, "users", ownerUid, "suppliers"), {
          ...data,
          createdAt: serverTimestamp(),
        });
      }
      setScreen("suppliers");
    } catch (e) {
      reportSaveError(e);
    }
  };

  const deleteSupplier = (id) => {
    if (!canEdit) return;
    if (!requireOnline()) return;
    if (!user || !ownerUid) return;
    confirmAction(t.deleteSupplierConfirm, async () => {
      try {
        await deleteDoc(doc(db, "users", ownerUid, "suppliers", id));
        setScreen("suppliers");
      } catch (e) {
        reportSaveError(e);
      }
    }, { danger: true });
  };

  const togglePinSupplier = async (supplier) => {
    if (!canEdit || !ownerUid) return;
    if (!requireOnline()) return;
    try {
      await updateDoc(doc(db, "users", ownerUid, "suppliers", supplier.id), { isPinned: !supplier.isPinned });
    } catch (e) {
      reportSaveError(e);
    }
  };

  const validate = () => {
    const e = {};
    if (!form.companyName.trim()) e.companyName = t.companyError;
    if (!form.contactName.trim()) e.contactName = t.contactError;
    setErrors(e);
    return Object.keys(e).length === 0;
  };

  const findDuplicatePhone = (phone, excludeId) => {
    const clean = corePhoneDigits(phone);
    if (!clean) return null;
    return (
      visits.find(
        (v) => v.id !== excludeId && corePhoneDigits(v.phone) === clean
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
      const { id, tagsInput, activityLog, offers, visitHistory, ...rest } = form;
      const data = { ...rest, tags: parseTagsCell(tagsInput) };
      const original = id ? visits.find((v) => v.id === id) : null;

      try {
        let savedId = id;
        if (id) {
          const updatePayload = { ...data };
          if (original && original.visitDate !== data.visitDate && data.visitDate) {
            updatePayload.visitHistory = arrayUnion(buildVisitEntry(data.visitDate));
          }
          await updateDoc(doc(db, "users", ownerUid, "visits", id), updatePayload);
        } else {
          const ref = await addDoc(collection(db, "users", ownerUid, "visits"), {
            ...data,
            activityLog: [],
            offers: [],
            visitHistory: data.visitDate ? [buildVisitEntry(data.visitDate)] : [],
            createdAt: serverTimestamp(),
          });
          savedId = ref.id;
        }

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

  const proceedDeleteVisit = async (id) => {

    const visit = visits.find((v) => v.id === id);
    setScreen("list");

    // Soft delete: hide immediately from the UI, but only actually delete
    // from Firestore after a few seconds, giving the user a chance to undo.
    const timeoutId = setTimeout(async () => {
      try {
        await deleteDoc(doc(db, "users", ownerUid, "visits", id));
        await cancelCallReminder(id);
      } catch (e) {
        reportSaveError(e);
      }
      setPendingDelete((cur) => (cur && cur.id === id ? null : cur));
    }, 5000);

    setPendingDelete({ id, companyName: visit ? visit.companyName : "", timeoutId });
  };

  const undoDelete = () => {
    if (!pendingDelete) return;
    clearTimeout(pendingDelete.timeoutId);
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
  }, [canEdit, ownerUid, requireOnline]);

  // Records that an actual visit happened today: pushes a new visit-history
  // entry (so the Dashboard's visit count reflects real repeat visits) and
  // bumps the customer's visitDate to today.
  const logVisitToday = async (visit) => {
    if (!canEdit || !visit || !ownerUid) return;
    if (!requireOnline()) return;
    const today = new Date().toISOString().slice(0, 10);
    // Best-effort GPS capture: never blocks the save. If the user denies the
    // permission, the browser/WebView doesn't support it, or it times out,
    // `location` just resolves to null and the visit is logged with no pin
    // — same as before this feature existed.
    const location = await getCurrentLocation();
    try {
      await updateDoc(doc(db, "users", ownerUid, "visits", visit.id), {
        visitDate: today,
        visitHistory: arrayUnion(buildVisitEntry(today, location)),
        // Kept as a top-level field (in addition to living inside the
        // visitHistory entry above) so the detail screen can show an
        // "open on map" link for the latest visit without having to scan
        // the whole history array.
        lastVisitLocation: location || null,
      });
      await appendActivity(visit.id, buildActivity("visit", t.activityVisitLogged(today)));
    } catch (e) {
      reportSaveError(e);
    }
  };

  // Clears a customer's pending call reminder: cancels the local
  // notification and logs it as a completed call in the activity feed.
  const clearCallReminder = async (visit) => {
    if (!requireOnline()) return;
    if (!user || !ownerUid || !visit) return;
    updateDoc(doc(db, "users", ownerUid, "visits", visit.id), {
      callDateTime: "",
      notified: false,
    }).catch(() => {});
    cancelCallReminder(visit.id);
    await appendActivity(visit.id, buildActivity("call", t.activityCallDone));
  };

  const submitActivity = async () => {
    if (!canEdit || !active) return;
    if (!requireOnline()) return;
    const text = newActivityText.trim();
    if (!text) return;
    await appendActivity(active.id, buildActivity("note", text));
    setNewActivityText("");
  };

  const visitsToRows = (rows) =>
    rows.map((v) => ({
      [t.companyLabel.replace(" *", "")]: v.companyName || "",
      [t.contactLabel.replace(" *", "")]: v.contactName || "",
      [t.sectorLabel]: t.sectors[v.sector] || v.sector || "",
      [t.roleLabel]: t.roles[v.role] || v.role || "",
      [t.pipelineLabel]: t.stages[v.stage] || v.stage || "",
      [t.tagsLabel]: (v.tags || []).join(", "),
      [t.phoneLabel]: v.phone || "",
      [t.emailLabel]: v.email || "",
      [t.visitDateLabel]: v.visitDate || "",
      [t.callDateLabel]: v.callDateTime || "",
      [t.notesLabel]: v.notes || "",
    }));

  const writeExcel = async (rows, filenameSuffix) => {
    const XLSX = await import("xlsx");
    const ws = XLSX.utils.json_to_sheet(visitsToRows(rows));
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, "Visits");
    const fileName = `pestco_visits_${filenameSuffix}_${new Date().toISOString().slice(0, 10)}.xlsx`;

    if (Capacitor.isNativePlatform()) {
      // XLSX.writeFile() is a plain browser Blob download under the hood,
      // which has no native handler inside the Android WebView (same issue
      // as the PDF export — see pdfReport.js). Write the bytes to disk via
      // Capacitor Filesystem instead.
      const { saveFileNative } = await import("./nativeFileSave");
      const base64Data = XLSX.write(wb, { type: "base64", bookType: "xlsx" });
      await saveFileNative(fileName, base64Data);
    } else {
      XLSX.writeFile(wb, fileName);
    }
  };

  // The live listener already holds every customer (no pagination limit),
  // so exporting "all" is just exporting the current in-memory list.
  const exportAllToExcel = async () => {
    if (!canEdit) return;
    await writeExcel(visibleVisits, "all");
  };

  // Exports only what's currently loaded and passing the active filters on
  // the customers list screen.
  const exportFilteredToExcel = async () => {
    if (!canEdit) return;
    await writeExcel(filtered, "filtered");
  };

  const triggerImportPicker = () => {
    if (!canEdit) return;
    if (!requireOnline()) return;
    if (fileInputRef.current) fileInputRef.current.click();
  };

  const handleImportFile = async (e) => {
    const file = e.target.files && e.target.files[0];
    e.target.value = "";
    if (!canEdit) return;
    if (!requireOnline()) return;
    if (!file || !user || !ownerUid) return;

    setImporting(true);
    try {
      const XLSX = await import("xlsx");
      const data = await file.arrayBuffer();
      const wb = XLSX.read(data, { type: "array", cellDates: true });
      const sheet = wb.Sheets[wb.SheetNames[0]];
      const rows = XLSX.utils.sheet_to_json(sheet, { defval: "" });

      const headerMap = {
        companyName: [
          STRINGS.ar.companyLabel, STRINGS.en.companyLabel,
          STRINGS.ar.companyLabel.replace(" *", ""), STRINGS.en.companyLabel.replace(" *", ""),
        ],
        contactName: [
          STRINGS.ar.contactLabel, STRINGS.en.contactLabel,
          STRINGS.ar.contactLabel.replace(" *", ""), STRINGS.en.contactLabel.replace(" *", ""),
        ],
        sector: [STRINGS.ar.sectorLabel, STRINGS.en.sectorLabel],
        role: [STRINGS.ar.roleLabel, STRINGS.en.roleLabel],
        stage: [STRINGS.ar.pipelineLabel, STRINGS.en.pipelineLabel],
        tags: [STRINGS.ar.tagsLabel, STRINGS.en.tagsLabel],
        phone: [STRINGS.ar.phoneLabel, STRINGS.en.phoneLabel],
        email: [STRINGS.ar.emailLabel, STRINGS.en.emailLabel],
        visitDate: [STRINGS.ar.visitDateLabel, STRINGS.en.visitDateLabel],
        callDateTime: [STRINGS.ar.callDateLabel, STRINGS.en.callDateLabel],
        notes: [STRINGS.ar.notesLabel, STRINGS.en.notesLabel],
      };

      const getField = (row, key) => {
        for (const candidate of headerMap[key]) {
          if (row[candidate] !== undefined && row[candidate] !== "") return row[candidate];
        }
        return "";
      };

      let count = 0;
      for (const row of rows) {
        const companyName = String(getField(row, "companyName") || "").trim();
        const contactName = String(getField(row, "contactName") || "").trim();
        if (!companyName && !contactName) continue;

        const callDateTime = normalizeExcelDateTime(getField(row, "callDateTime"));
        const visitData = {
          companyName,
          contactName,
          sector: findSectorId(getField(row, "sector")),
          role: findRoleId(getField(row, "role")),
          stage: findStageId(getField(row, "stage")),
          tags: parseTagsCell(getField(row, "tags")),
          phone: String(getField(row, "phone") || "").trim(),
          email: String(getField(row, "email") || "").trim(),
          visitDate: normalizeExcelDate(getField(row, "visitDate")),
          notes: String(getField(row, "notes") || "").trim(),
          callDateTime,
          notified: false,
          activityLog: [],
          offers: [],
          createdAt: serverTimestamp(),
        };

        const ref = await addDoc(collection(db, "users", ownerUid, "visits"), visitData);
        await appendActivity(ref.id, buildActivity("created", t.activityCreated));
        if (callDateTime) {
          await scheduleCallReminder(
            ref.id,
            callDateTime,
            `${t.reminderTitle} ${companyName}`,
            t.reminderBody(contactName)
          );
        }
        count++;
      }
      showAlert(t.importSuccess(count));
    } catch (err) {
      showAlert(t.importError);
    } finally {
      setImporting(false);
    }
  };

  // Bucketed to the minute rather than Date.now() directly: using the raw
  // timestamp as a useMemo dependency below would defeat the memoization
  // (it's a different value on every render), but none of these lists need
  // finer-than-a-minute precision to be correct.
  const nowBucket = Math.floor(Date.now() / 60000);
  const now = nowBucket * 60000;
  const visibleVisits = useMemo(
    () => (pendingDelete ? visits.filter((v) => v.id !== pendingDelete.id) : visits),
    [visits, pendingDelete]
  );

  // These were recomputed from scratch on every render (including unrelated
  // ones, e.g. typing in a form field elsewhere), each scanning the full
  // customer list. With 500+ customers that showed up as visible jank while
  // typing in the search box. useMemo skips the work unless the customer
  // list actually changed or a minute has passed.
  const dueReminders = useMemo(
    () =>
      visibleVisits
        .filter((v) => v.callDateTime && new Date(v.callDateTime).getTime() <= now + 24 * 3600 * 1000)
        .sort((a, b) => new Date(a.callDateTime) - new Date(b.callDateTime)),
    [visibleVisits, nowBucket]
  );

  const staleOffers = useMemo(
    () =>
      visibleVisits.flatMap((v) =>
        (v.offers || [])
          .filter((o) => {
            if (o.status !== "pending") return false;
            const d = parseVisitDate(o.offerDate);
            if (!d) return false;
            return (now - d.getTime()) / (1000 * 3600 * 24) > STALE_OFFER_DAYS;
          })
          .map((o) => ({ ...o, customer: v }))
      ),
    [visibleVisits, nowBucket]
  );

  // Customers with a follow-up call scheduled for today specifically (same
  // calendar day), used for the always-visible "Today's Customers" panel.
  const todaysCustomers = useMemo(
    () =>
      visibleVisits
        .filter((v) => {
          if (!v.callDateTime) return false;
          const d = new Date(v.callDateTime);
          const n = new Date(now);
          return (
            d.getFullYear() === n.getFullYear() &&
            d.getMonth() === n.getMonth() &&
            d.getDate() === n.getDate()
          );
        })
        .sort((a, b) => new Date(a.callDateTime) - new Date(b.callDateTime)),
    [visibleVisits, nowBucket]
  );

  // Customers with no recent activity (visit, call, or note) — a nudge to
  // follow up before they go completely cold.
  const staleCustomers = useMemo(
    () => visibleVisits.filter((v) => isStaleCustomer(v, STALE_ACTIVITY_DAYS)),
    [visibleVisits, nowBucket]
  );

  // Possible duplicate customers (same phone or a near-identical company
  // name), reviewed from the Settings screen.
  const duplicateGroups = useMemo(() => findDuplicateGroups(visibleVisits), [visibleVisits]);

  // Memoized: these were recomputed from scratch on every render (including
  // unrelated ones, e.g. typing in a form field elsewhere), scanning the
  // full customer list. useMemo skips that work unless the
  // underlying data or the relevant filter actually changed.
  const allTags = useMemo(
    () => Array.from(new Set(visibleVisits.flatMap((v) => v.tags || []))).sort(),
    [visibleVisits]
  );

  const sectorCounts = useMemo(
    () =>
      SECTOR_IDS.reduce((acc, id) => {
        acc[id] = visibleVisits.filter((v) => v.sector === id).length;
        return acc;
      }, {}),
    [visibleVisits]
  );
  const totalCustomers = visibleVisits.length;
  const missingDataCount = useMemo(
    () => visibleVisits.filter((v) => !v.phone || !v.email).length,
    [visibleVisits]
  );
  const noVisitsCount = useMemo(
    () => visibleVisits.filter((v) => getVisitEvents(v).length === 0).length,
    [visibleVisits]
  );

  const filtered = useMemo(
    () =>
      visibleVisits
        .filter((v) => sectorFilter === "all" || v.sector === sectorFilter)
        .filter((v) => stageFilter === "all" || v.stage === stageFilter)
        .filter((v) => tagFilter === "all" || (v.tags || []).includes(tagFilter))
        .filter((v) => !missingDataOnly || !v.phone || !v.email)
        .filter((v) => !noVisitsOnly || getVisitEvents(v).length === 0)
        .filter((v) => {
          const q = debouncedQuery.trim().toLowerCase();
          if (!q) return true;
          return (
            v.companyName.toLowerCase().includes(q) ||
            v.contactName.toLowerCase().includes(q) ||
            (v.phone || "").toLowerCase().includes(q) ||
            (v.notes || "").toLowerCase().includes(q) ||
            (v.visitDate || "").toLowerCase().includes(q) ||
            (v.callDateTime || "").toLowerCase().includes(q) ||
            (v.tags || []).some((tag) => tag.toLowerCase().includes(q)) ||
            (v.activityLog || []).some((entry) => (entry.text || "").toLowerCase().includes(q)) ||
            fmtReminder(v.callDateTime, t.locale).toLowerCase().includes(q)
          );
        })
        .sort((a, b) => {
          if (!!a.isPinned !== !!b.isPinned) return a.isPinned ? -1 : 1;
          const sa = visitStatus(a);
          const sb = visitStatus(b);
          const order = { overdue: 0, today: 1, upcoming: 2, none: 3 };
          if (order[sa] !== order[sb]) return order[sa] - order[sb];
          const da = parseVisitDate(a.visitDate);
          const db = parseVisitDate(b.visitDate);
          if (!da && !db) return 0;
          if (!da) return 1;
          if (!db) return -1;
          return db - da;
        }),
    [visibleVisits, sectorFilter, stageFilter, tagFilter, missingDataOnly, noVisitsOnly, debouncedQuery, t.locale]
  );

  // All unique product tags across every supplier, used to populate the
  // "filter by product" chip row on the Suppliers list.
  const allSupplierTags = useMemo(() => collectSupplierTags(suppliers), [suppliers]);

  const filteredSuppliers = useMemo(
    () =>
      suppliers
        .filter((s) => supplierTagFilter === "all" || (s.tags || []).includes(supplierTagFilter))
        .filter((s) => {
          const q = debouncedSupplierQuery.trim().toLowerCase();
          if (!q) return true;
          return (
            (s.name || "").toLowerCase().includes(q) ||
            (s.contactName || "").toLowerCase().includes(q) ||
            (s.phone || "").toLowerCase().includes(q) ||
            (s.email || "").toLowerCase().includes(q) ||
            (s.category || "").toLowerCase().includes(q) ||
            (s.notes || "").toLowerCase().includes(q) ||
            (s.tags || []).some((tag) => tag.toLowerCase().includes(q))
          );
        })
        .sort((a, b) => {
          if (!!a.isPinned !== !!b.isPinned) return a.isPinned ? -1 : 1;
          return (a.name || "").localeCompare(b.name || "", "ar");
        }),
    [suppliers, supplierTagFilter, debouncedSupplierQuery]
  );

  const activeStageIdx = active ? STAGE_IDS.indexOf(active.stage || "") : -1;
  const activityLog = active ? [...(active.activityLog || [])].sort((a, b) => (a.at < b.at ? 1 : -1)) : [];
  const activeOffers = active ? [...(active.offers || [])].sort((a, b) => {
    const da = parseVisitDate(a.offerDate);
    const db = parseVisitDate(b.offerDate);
    if (!da && !db) return 0;
    if (!da) return 1;
    if (!db) return -1;
    return db - da;
  }) : [];
  const activeOffersTotals = sumOffersByCurrency(activeOffers);
  const activeOffersValueText = fmtOffersTotals(activeOffersTotals, t);

  const themeVars = darkMode ? THEME_VARS.dark : THEME_VARS.light;

  if (!authChecked) {
    return (
      <div
        style={{
          ...themeVars,
          minHeight: "100vh",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          background: "var(--bg)",
          fontFamily: "'Tajawal', sans-serif",
        }}
      >
        <p style={{ color: MUTED, fontSize: 14 }}>{t.loading}</p>
      </div>
    );
  }

  if (!user) {
    return (
      <AuthScreen
        lang={lang}
        setLang={setLang}
        authError={authError}
        onClearAuthError={clearAuthError}
      />
    );
  }

  return (
    <div
      className="w-full min-h-full"
      style={{
        ...themeVars,
        fontFamily: "'Tajawal', sans-serif",
        background: "var(--bg)",
        minHeight: "100vh",
        direction: t.dir,
        color: TEXT,
      }}
    >
      <div
        className="flex items-center gap-2 px-4 py-3"
        style={{ background: PRIMARY, position: "sticky", top: 0, zIndex: 10 }}
      >
        {!isRootScreen ? (
          <button
            onClick={() => setScreen(
              screen === "form" && form.id ? "detail" :
              screen === "detail" ? "list" :
              screen === "supplier-form" ? "suppliers" :
              "list"
            )}
            className="btn-press"
            style={{ color: "#fff" }}
            aria-label={t.back}
          >
            <ChevronRight size={22} style={{ transform: t.dir === "rtl" ? "none" : "rotate(180deg)" }} />
          </button>
        ) : (
          <Logo size={30} />
        )}
        <span className="font-bold text-lg flex-1" style={{ color: "#fff" }}>
          {screen === "dashboard" && t.titleDashboard}
          {screen === "list" && t.appTitle}
          {screen === "form" && (form.id ? t.titleEdit : t.titleNew)}
          {screen === "detail" && t.titleDetail}
          {screen === "suppliers" && t.suppliersTitle}
          {screen === "supplier-form" && (activeSupplierId ? t.titleEditSupplier : t.titleNewSupplier)}
          {screen === "settings" && t.settingsTitle}
        </span>
        {isRootScreen && (
          <span
            className="flex items-center"
            style={{ color: "#fff", opacity: 0.9 }}
            aria-label={isOnline ? "online" : "offline"}
            title={isOnline ? "" : t.offlineBanner}
          >
            {isOnline ? <Wifi size={15} /> : <WifiOff size={15} />}
          </span>
        )}
        <button
          onClick={() => setDarkMode((d) => !d)}
          className="btn-press flex items-center"
          style={{ color: "#fff", background: "rgba(255,255,255,0.15)", borderRadius: 8, padding: "6px 8px" }}
          aria-label={darkMode ? t.lightModeToggle : t.darkModeToggle}
          title={darkMode ? t.lightModeToggle : t.darkModeToggle}
        >
          {darkMode ? <Sun size={14} /> : <Moon size={14} />}
        </button>
        <button
          onClick={() => setLang(lang === "ar" ? "en" : "ar")}
          className="btn-press flex items-center gap-1 font-bold text-xs"
          style={{ color: "#fff", background: "rgba(255,255,255,0.15)", borderRadius: 8, padding: "6px 10px" }}
          aria-label={t.langToggle}
        >
          <Languages size={14} /> {t.langToggle}
        </button>
        <button
          onClick={() => signOut(auth).catch(() => {})}
          className="btn-press flex items-center"
          style={{ color: "#fff", background: "rgba(255,255,255,0.15)", borderRadius: 8, padding: "6px 8px" }}
          aria-label={t.signOut}
        >
          <LogOut size={14} />
        </button>
      </div>

      <div key={screen} className="animate-screen-in">
      {screen === "dashboard" && (
        <Suspense fallback={<div className="px-4 pt-4"><SkeletonList count={3} /></div>}>
          <Dashboard visits={visibleVisits} lang={lang} onOpenCustomer={openDetail} showAlert={showAlert} />
        </Suspense>
      )}

      {screen === "list" && (
        <CustomerListScreen
          t={t}
          isOnline={isOnline}
          dueReminders={dueReminders}
          staleOffers={staleOffers}
          staleCustomers={staleCustomers}
          openDetail={openDetail}
          query={query}
          setQuery={setQuery}
          todaysCustomers={todaysCustomers}
          totalCustomers={totalCustomers}
          sectorCounts={sectorCounts}
          sectorFilter={sectorFilter}
          setSectorFilter={setSectorFilter}
          stageFilter={stageFilter}
          setStageFilter={setStageFilter}
          allTags={allTags}
          tagFilter={tagFilter}
          setTagFilter={setTagFilter}
          missingDataOnly={missingDataOnly}
          setMissingDataOnly={setMissingDataOnly}
          missingDataCount={missingDataCount}
          noVisitsOnly={noVisitsOnly}
          setNoVisitsOnly={setNoVisitsOnly}
          noVisitsCount={noVisitsCount}
          loaded={loaded}
          filtered={filtered}
          togglePin={togglePin}
          canEdit={canEdit}
          openNew={openNew}
        />
      )}

      {screen === "form" && canEdit && (
        <CustomerFormScreen
          t={t}
          form={form}
          setForm={setForm}
          errors={errors}
          removeTagFromForm={removeTagFromForm}
          saveForm={saveForm}
        />
      )}

      {screen === "detail" && active && (
        <CustomerDetailScreen
          t={t}
          active={active}
          canEdit={canEdit}
          togglePin={togglePin}
          activeStageIdx={activeStageIdx}
          changeStage={changeStage}
          clearCallReminder={clearCallReminder}
          logVisitToday={logVisitToday}
          activeOffersValueText={activeOffersValueText}
          activeOffers={activeOffers}
          expandedOfferId={expandedOfferId}
          setExpandedOfferId={setExpandedOfferId}
          updateOfferStatus={updateOfferStatus}
          deleteOffer={deleteOffer}
          newOffer={newOffer}
          setNewOffer={setNewOffer}
          addOffer={addOffer}
          activityLog={activityLog}
          newActivityText={newActivityText}
          setNewActivityText={setNewActivityText}
          submitActivity={submitActivity}
          deleteActivity={deleteActivity}
          openEdit={openEdit}
          deleteVisit={deleteVisit}
        />
      )}

      {screen === "suppliers" && (
        <SuppliersListScreen
          t={t}
          canEdit={canEdit}
          supplierQuery={supplierQuery}
          setSupplierQuery={setSupplierQuery}
          allSupplierTags={allSupplierTags}
          supplierTagFilter={supplierTagFilter}
          setSupplierTagFilter={setSupplierTagFilter}
          suppliersLoaded={suppliersLoaded}
          filteredSuppliers={filteredSuppliers}
          togglePinSupplier={togglePinSupplier}
          openEditSupplier={openEditSupplier}
          openNewSupplier={openNewSupplier}
        />
      )}

      {screen === "supplier-form" && canEdit && (
        <SupplierFormScreen
          t={t}
          supplierForm={supplierForm}
          setSupplierForm={setSupplierForm}
          supplierErrors={supplierErrors}
          removeTagFromSupplierForm={removeTagFromSupplierForm}
          saveSupplierForm={saveSupplierForm}
          activeSupplierId={activeSupplierId}
          deleteSupplier={deleteSupplier}
        />
      )}

      {screen === "settings" && isOwnerAccount && (
        <SettingsScreen
          t={t}
          availableOwners={availableOwners}
          ownerUid={ownerUid}
          user={user}
          switchOwnerWorkspace={switchOwnerWorkspace}
          canEdit={canEdit}
          showDuplicates={showDuplicates}
          setShowDuplicates={setShowDuplicates}
          duplicateGroups={duplicateGroups}
          openDetail={openDetail}
          isOwnerAccount={isOwnerAccount}
          members={members}
          revokeAccess={revokeAccess}
          pendingSignups={pendingSignups}
          isReviewer={isReviewer}
          reviewSignup={reviewSignup}
          dismissSignup={dismissSignup}
          confirmAction={confirmAction}
          exportAllToExcel={exportAllToExcel}
          exportFilteredToExcel={exportFilteredToExcel}
          filteredCount={filtered.length}
          triggerImportPicker={triggerImportPicker}
          importing={importing}
          fileInputRef={fileInputRef}
          handleImportFile={handleImportFile}
          newMemberEmail={newMemberEmail}
          setNewMemberEmail={setNewMemberEmail}
          newMemberRole={newMemberRole}
          setNewMemberRole={setNewMemberRole}
          grantAccess={grantAccess}
        />
      )}
      </div>

      {pendingDelete && (
        <div
          className="flex items-center justify-between gap-3"
          style={{
            position: "fixed",
            left: 16,
            right: 16,
            bottom: isRootScreen ? 78 : 16,
            background: PRIMARY,
            color: "#fff",
            borderRadius: 14,
            padding: "12px 16px",
            boxShadow: "0 8px 20px rgba(0,0,0,.25)",
            zIndex: 30,
          }}
        >
          <span className="text-sm font-bold">{t.deletedUndoMsg(pendingDelete.companyName || "")}</span>
          <button
            onClick={undoDelete}
            className="btn-press font-extrabold text-sm flex-shrink-0"
            style={{ color: GOLD }}
          >
            {t.undoBtn}
          </button>
        </div>
      )}

      {isRootScreen && <BottomNav screen={screen} setScreen={setScreen} t={t} isOwnerAccount={isOwnerAccount} />}

      {rejectionPrompt && (
        <RejectionReasonModal
          t={t}
          initialReason={rejectionPrompt.initialReason}
          onConfirm={(reason) => {
            const { onConfirm } = rejectionPrompt;
            setRejectionPrompt(null);
            onConfirm(reason);
          }}
          onCancel={() => setRejectionPrompt(null)}
        />
      )}

      {confirmDialog && (
        <ConfirmModal
          t={t}
          message={confirmDialog.message}
          variant={confirmDialog.variant}
          danger={confirmDialog.danger}
          onConfirm={() => {
            const { onConfirm } = confirmDialog;
            setConfirmDialog(null);
            onConfirm();
          }}
          onCancel={() => setConfirmDialog(null)}
        />
      )}
    </div>
  );
}
