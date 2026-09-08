import React, { useState, useEffect, useRef } from "react";
import {
  ChevronRight, Languages, LogOut, Settings,
  Wifi, WifiOff, Moon, Sun,
} from "lucide-react";
import { Logo, TagChip, VisitCard, BottomNav, beep } from "./components/Shared";
import { SuppliersListScreen, SupplierFormScreen } from "./components/Suppliers";
import SettingsScreen from "./components/Settings";
import CustomerListScreen from "./components/CustomerList";
import CustomerFormScreen from "./components/CustomerForm";
import CustomerDetailScreen from "./components/CustomerDetail";
import * as XLSX from "xlsx";
import { onAuthStateChanged, signOut } from "firebase/auth";
import {
  collection, doc, onSnapshot, addDoc, updateDoc, deleteDoc, serverTimestamp,
  getDoc, setDoc, runTransaction, arrayUnion, arrayRemove,
} from "firebase/firestore";
import { auth, db } from "./firebase";
import AuthScreen from "./AuthScreen";
import Dashboard from "./Dashboard";
import {
  requestNotificationPermission, scheduleCallReminder, cancelCallReminder,
} from "./notifications";
import {
  PRIMARY, PRIMARY_MID, TEXT, MUTED, GOLD,
  STRINGS, SECTOR_IDS, STAGE_IDS, THEME_VARS, STALE_OFFER_DAYS, STALE_ACTIVITY_DAYS,
  findSectorId, findRoleId, findStageId, parseTagsCell,
  parseVisitDate, toISODate, normalizeExcelDate, normalizeExcelDateTime,
  buildActivity, buildOffer, buildVisitEntry,
  visitStatus, fmtReminder, fmtOffersTotals, sumOffersByCurrency, corePhoneDigits,
  findDuplicateGroups, isStaleCustomer, collectSupplierTags,
  emptyForm, emptySupplierForm,
} from "./constants";

const ROOT_SCREENS = ["dashboard", "list", "suppliers", "settings"];

export default function App() {
  const [authChecked, setAuthChecked] = useState(false);
  const [user, setUser] = useState(null);

  const [visits, setVisits] = useState([]);
  const [loaded, setLoaded] = useState(false);
  const [screen, setScreen] = useState("list"); // dashboard | list | form | detail | settings
  const [query, setQuery] = useState("");
  const [sectorFilter, setSectorFilter] = useState("all");
  const [stageFilter, setStageFilter] = useState("all");
  const [tagFilter, setTagFilter] = useState("all");
  const [missingDataOnly, setMissingDataOnly] = useState(false);
  const [form, setForm] = useState(emptyForm);
  const [activeId, setActiveId] = useState(null);
  const [errors, setErrors] = useState({});
  const [members, setMembers] = useState({});
  const [newMemberEmail, setNewMemberEmail] = useState("");
  const [newMemberRole, setNewMemberRole] = useState("viewer");
  const [ownerUid, setOwnerUid] = useState(null);
  const [myRole, setMyRole] = useState(null);
  const [availableOwners, setAvailableOwners] = useState([]);
  const [permissionLoading, setPermissionLoading] = useState(true);
  const previousResolvedOwnerRef = useRef(null);
  const [importing, setImporting] = useState(false);
  const [newActivityText, setNewActivityText] = useState("");
  const [newOffer, setNewOffer] = useState({
    name: "", offerNumber: "", amount: "", currency: "EGP", offerDate: new Date().toISOString().slice(0, 10), status: "pending",
  });
  const [isOnline, setIsOnline] = useState(() => (typeof navigator !== "undefined" ? navigator.onLine : true));
  const [darkMode, setDarkMode] = useState(() => {
    try {
      return localStorage.getItem("pestco_dark") === "1";
    } catch (e) {
      return false;
    }
  });
  const [pendingDelete, setPendingDelete] = useState(null); // { id, companyName, timeoutId }
  const [showDuplicates, setShowDuplicates] = useState(false);
  const [expandedOfferId, setExpandedOfferId] = useState(null);

  // ---- Suppliers (separate from customers — contacts only) ----
  const [suppliers, setSuppliers] = useState([]);
  const [suppliersLoaded, setSuppliersLoaded] = useState(false);
  const [supplierQuery, setSupplierQuery] = useState("");
  const [supplierForm, setSupplierForm] = useState(emptySupplierForm);
  const [activeSupplierId, setActiveSupplierId] = useState(null);
  const [supplierErrors, setSupplierErrors] = useState({});
  const [supplierTagFilter, setSupplierTagFilter] = useState("all");
  const fileInputRef = useRef(null);

  const [lang, setLang] = useState(() => {
    try {
      const saved = localStorage.getItem("pestco_lang");
      return saved && STRINGS[saved] ? saved : "ar";
    } catch (e) {
      return "ar";
    }
  });

  const t = STRINGS[lang];
  const active = visits.find((v) => v.id === activeId) || null;
  const isRootScreen = ROOT_SCREENS.includes(screen);

  // Permission flags derived from myRole (set from the access_by_email lookup).
  const canEdit = !permissionLoading && (myRole === "owner" || myRole === "editor");
  const isOwnerAccount = !permissionLoading && myRole === "owner";

  useEffect(() => {
    const goOnline = () => setIsOnline(true);
    const goOffline = () => setIsOnline(false);
    window.addEventListener("online", goOnline);
    window.addEventListener("offline", goOffline);
    return () => {
      window.removeEventListener("online", goOnline);
      window.removeEventListener("offline", goOffline);
    };
  }, []);

  useEffect(() => {
    const unsub = onAuthStateChanged(auth, (u) => {
      setUser(u);
      setAuthChecked(true);
    });
    return () => unsub();
  }, []);

  // Live permission/workspace listener. A user may belong to more than one
  // owner/workspace, so we keep all valid owners and remember the last choice.
  useEffect(() => {
    if (!user) {
      setOwnerUid(null);
      setMyRole(null);
      setAvailableOwners([]);
      setPermissionLoading(false);
      previousResolvedOwnerRef.current = null;
      return;
    }

    setPermissionLoading(true);
    const emailKey = (user.email || "").trim().toLowerCase();

    if (!emailKey) {
      setOwnerUid(user.uid);
      setMyRole("owner");
      setAvailableOwners([{ uid: user.uid, role: "owner" }]);
      setPermissionLoading(false);
      previousResolvedOwnerRef.current = user.uid;
      return;
    }

    const lookupRef = doc(db, "access_by_email", emailKey);

    const unsub = onSnapshot(
      lookupRef,
      (snap) => {
        const ownersMap = snap.exists() ? snap.data().owners || {} : {};
        const externalOwners = Object.entries(ownersMap)
          .filter(([, role]) => role === "editor" || role === "viewer")
          .map(([uid, role]) => ({ uid, role }));

        // The signed-in account is always an owner of its own workspace on
        // initial login, but only when they have no other granted access —
        // someone who was invited as a viewer/editor should land straight
        // in the workspace they were granted, never in a phantom empty
        // "Owner" workspace of their own. A revoked external user must also
        // NOT be converted into a new owner workspace.
        const previousOwner = previousResolvedOwnerRef.current;
        const hasKnownExternalAccess = Boolean(previousOwner && previousOwner !== user.uid);

        let nextOwners = externalOwners;
        if (externalOwners.some((x) => x.uid === user.uid)) {
          nextOwners = externalOwners.map((x) => x.uid === user.uid ? { ...x, role: "owner" } : x);
        } else if (!hasKnownExternalAccess && externalOwners.length === 0) {
          nextOwners = [{ uid: user.uid, role: "owner" }, ...externalOwners];
        }

        // Remove duplicates and keep a stable order.
        const seen = new Set();
        nextOwners = nextOwners.filter((x) => {
          if (seen.has(x.uid)) return false;
          seen.add(x.uid);
          return true;
        });

        if (nextOwners.length === 0) {
          setOwnerUid(null);
          setMyRole(null);
          setAvailableOwners([]);
          previousResolvedOwnerRef.current = null;
          setScreen("list");
          setActiveId(null);
          setPermissionLoading(false);
          return;
        }

        setAvailableOwners(nextOwners);

        let savedOwner = null;
        try {
          savedOwner = localStorage.getItem("pestco_selected_owner");
        } catch (e) {}

        const currentOwner = previousResolvedOwnerRef.current;
        const currentStillValid = nextOwners.some((x) => x.uid === currentOwner);
        const savedStillValid = nextOwners.some((x) => x.uid === savedOwner);
        const selected = currentStillValid
          ? currentOwner
          : savedStillValid
            ? savedOwner
            : nextOwners[0].uid;

        const selectedEntry = nextOwners.find((x) => x.uid === selected);
        setOwnerUid(selected);
        setMyRole(selectedEntry?.role || null);
        previousResolvedOwnerRef.current = selected;
        try {
          localStorage.setItem("pestco_selected_owner", selected);
        } catch (e) {}
        setPermissionLoading(false);
      },
      (error) => {
        console.error("Permission listener failed:", error);
        setOwnerUid(null);
        setMyRole(null);
        setAvailableOwners([]);
        previousResolvedOwnerRef.current = null;
        setPermissionLoading(false);
        setScreen("list");
        setActiveId(null);
      }
    );

    return () => unsub();
  }, [user]);

  // Keep the selected workspace and role synchronized when the user changes
  // workspace from Settings.
  const switchOwnerWorkspace = (nextOwnerUid) => {
    const selected = availableOwners.find((x) => x.uid === nextOwnerUid);
    if (!selected) return;
    setOwnerUid(selected.uid);
    setMyRole(selected.role);
    previousResolvedOwnerRef.current = selected.uid;
    setActiveId(null);
    setScreen("list");
    try {
      localStorage.setItem("pestco_selected_owner", selected.uid);
    } catch (e) {}
  };

  useEffect(() => {
    if (!user) return;
    const ref = doc(db, "access", user.uid);
    const unsub = onSnapshot(ref, (snap) => {
      setMembers(snap.exists() ? snap.data().members || {} : {});
    });
    return () => unsub();
  }, [user]);

  useEffect(() => {
    try {
      localStorage.setItem("pestco_lang", lang);
    } catch (e) {}
  }, [lang]);

  useEffect(() => {
    try {
      localStorage.setItem("pestco_dark", darkMode ? "1" : "0");
    } catch (e) {}
  }, [darkMode]);

  // Single unlimited listener: the customer count (~900) is small enough
  // that loading everything up front is simpler and safer than pagination —
  // it also guarantees search/filters always see every customer, and the
  // Dashboard's stats are never skewed by how much of the list is "loaded".
  useEffect(() => {
    if (!user || !ownerUid) {
      setVisits([]);
      setLoaded(false);
      return;
    }
    setLoaded(false);
    const ref = collection(db, "users", ownerUid, "visits");
    const unsub = onSnapshot(
      ref,
      (snap) => {
        setVisits(snap.docs.map((d) => ({ id: d.id, ...d.data() })));
        setLoaded(true);
      },
      () => setLoaded(true)
    );
    return () => unsub();
  }, [user, ownerUid]);

  // Suppliers listener — same ownership model as visits, separate collection.
  useEffect(() => {
    if (!user || !ownerUid) {
      setSuppliers([]);
      setSuppliersLoaded(false);
      return;
    }
    setSuppliersLoaded(false);
    const ref = collection(db, "users", ownerUid, "suppliers");
    const unsub = onSnapshot(
      ref,
      (snap) => {
        setSuppliers(snap.docs.map((d) => ({ id: d.id, ...d.data() })));
        setSuppliersLoaded(true);
      },
      () => setSuppliersLoaded(true)
    );
    return () => unsub();
  }, [user, ownerUid]);

  useEffect(() => {
    try {
      if (window.Notification && Notification.permission === "default") {
        Notification.requestPermission();
      }
    } catch (e) {}
    requestNotificationPermission();
  }, []);

  // Settings is owner-only. If a non-owner ever ends up on this screen
  // (e.g. they switch to a workspace where they're a viewer/editor while
  // already on Settings), bounce them back to the customer list.
  useEffect(() => {
    if (!permissionLoading && screen === "settings" && !isOwnerAccount) {
      setScreen("list");
    }
  }, [permissionLoading, screen, isOwnerAccount]);

  useEffect(() => {
    if (!user || !ownerUid) return;
    const id = setInterval(() => {
      const now = Date.now();
      visits.forEach((v) => {
        if (v.callDateTime && !v.notified && new Date(v.callDateTime).getTime() <= now) {
          beep();
          try {
            if (window.Notification && Notification.permission === "granted") {
              new Notification(`${t.reminderTitle} ${v.companyName}`, {
                body: t.reminderBody(v.contactName),
              });
            }
          } catch (e) {}
          if (canEdit) {
            updateDoc(doc(db, "users", ownerUid, "visits", v.id), { notified: true }).catch(() => {});
          }
        }
      });
    }, 15000);
    return () => clearInterval(id);
  }, [visits, t, user, ownerUid]);

  // Blocks any write attempt while offline instead of queueing it for later sync.
  // Surfaces a save failure to the user instead of swallowing it silently.
  // A "permission-denied" here almost always means the signed-in account's
  // role in Firestore doesn't actually match what Settings shows (e.g. it's
  // still "viewer" server-side) — this makes that visible instead of the
  // save just silently doing nothing.
  const reportSaveError = (e) => {
    console.error("Save failed:", e);
    const isPermissionError = e && (e.code === "permission-denied" || String(e.code || "").includes("permission-denied"));
    alert(
      isPermissionError
        ? (lang === "ar"
            ? "معنديش صلاحية أكتب في البيانات دي. تأكد إن الدور بتاعك مضبوط 'يشوف ويعدل' فعليًا."
            : "You don't have permission to write this data. Confirm your role is actually set to 'editor'.")
        : (lang === "ar" ? `حصل خطأ أثناء الحفظ: ${e && e.message ? e.message : e}` : `Save failed: ${e && e.message ? e.message : e}`)
    );
  };

  const requireOnline = () => {
    if (!isOnline) {
      alert(t.requireOnlineMsg);
      return false;
    }
    return true;
  };

  // Appends one entry to a visit's activity timeline without overwriting the rest of the log.
  const appendActivity = async (visitId, activity) => {
    if (!ownerUid) return;
    try {
      await updateDoc(doc(db, "users", ownerUid, "visits", visitId), {
        activityLog: arrayUnion(activity),
      });
    } catch (e) {}
  };

  // Removes one entry from a visit's activity timeline (with confirmation).
  const deleteActivity = async (entry) => {
    if (!canEdit || !active || !ownerUid) return;
    if (!requireOnline()) return;
    if (!window.confirm(t.deleteActivityConfirm)) return;
    try {
      await updateDoc(doc(db, "users", ownerUid, "visits", active.id), {
        activityLog: arrayRemove(entry),
      });
    } catch (e) {}
  };

  // ---- Offers CRUD (stored as an array field on the customer document, same
  // pattern as activityLog, so a customer's offers always stay attached to
  // their own record and inherit the customer's sector automatically). ----

  const addOffer = async (visit) => {
    if (!canEdit || !visit || !ownerUid) return;
    if (!requireOnline()) return;
    if (!newOffer.name.trim()) return;

    let offerToSave = newOffer;
    if (newOffer.status === "rejected") {
      const reason = window.prompt(t.offerRejectionReasonPrompt, "") || "";
      offerToSave = { ...newOffer, rejectionReason: reason };
    }

    const offer = buildOffer(offerToSave);
    try {
      await updateDoc(doc(db, "users", ownerUid, "visits", visit.id), {
        offers: arrayUnion(offer),
      });
      await appendActivity(visit.id, buildActivity("offer", t.activityOfferAdded(offer.name)));
      setNewOffer({ name: "", offerNumber: "", amount: "", currency: "EGP", offerDate: new Date().toISOString().slice(0, 10), status: "pending" });
    } catch (e) {}
  };

  const updateOfferStatus = async (visit, offer, newStatus) => {
    if (!canEdit || !visit || !ownerUid) return;
    if (!requireOnline()) return;
    if (newStatus === offer.status) return;
    let rejectionReason = offer.rejectionReason || "";
    if (newStatus === "rejected") {
      rejectionReason = window.prompt(t.offerRejectionReasonPrompt, rejectionReason) || "";
    }
    const updated = (visit.offers || []).map((o) =>
      o.id === offer.id ? { ...o, status: newStatus, rejectionReason: newStatus === "rejected" ? rejectionReason : "" } : o
    );
    try {
      await updateDoc(doc(db, "users", ownerUid, "visits", visit.id), { offers: updated });
      await appendActivity(visit.id, buildActivity("offer", t.activityOfferStatus(offer.name, t.offerStatuses[newStatus] || newStatus)));
    } catch (e) {}
  };

  const deleteOffer = async (visit, offer) => {
    if (!canEdit || !visit || !ownerUid) return;
    if (!requireOnline()) return;
    if (!window.confirm(t.deleteOfferConfirm)) return;
    try {
      await updateDoc(doc(db, "users", ownerUid, "visits", visit.id), {
        offers: arrayRemove(offer),
      });
    } catch (e) {}
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

  const openDetail = (visit) => {
    setActiveId(visit.id);
    setNewActivityText("");
    setNewOffer({ name: "", offerNumber: "", amount: "", currency: "EGP", offerDate: new Date().toISOString().slice(0, 10), status: "pending" });
    setExpandedOfferId(null);
    setScreen("detail");
  };

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

  const deleteSupplier = async (id) => {
    if (!canEdit) return;
    if (!requireOnline()) return;
    if (!user || !ownerUid) return;
    if (!window.confirm(t.deleteSupplierConfirm)) return;
    try {
      await deleteDoc(doc(db, "users", ownerUid, "suppliers", id));
      setScreen("suppliers");
    } catch (e) {}
  };

  const togglePinSupplier = async (supplier) => {
    if (!canEdit || !ownerUid) return;
    if (!requireOnline()) return;
    try {
      await updateDoc(doc(db, "users", ownerUid, "suppliers", supplier.id), { isPinned: !supplier.isPinned });
    } catch (e) {}
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

  const saveForm = async () => {
    // Defense in depth: even if the UI hid the buttons, never let a
    // viewer's client write. The Firestore rules enforce this too.
    if (!canEdit) return;
    if (!requireOnline()) return;
    if (!validate() || !user || !ownerUid) return;

    if (!form.phone.trim()) {
      if (!window.confirm(t.phoneMissingWarning)) return;
    }

    const duplicate = form.phone ? findDuplicatePhone(form.phone, form.id) : null;
    if (duplicate) {
      const proceed = window.confirm(t.duplicatePhoneWarning(duplicate.companyName));
      if (!proceed) return;
    }

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

  const deleteVisit = async (id) => {
    if (!canEdit) return;
    if (!requireOnline()) return;
    if (!user || !ownerUid) return;
    const confirmMsg = lang === "ar"
      ? "هل أنت متأكد من حذف هذا العميل؟"
      : "Are you sure you want to delete this customer?";
    if (!window.confirm(confirmMsg)) return;

    const visit = visits.find((v) => v.id === id);
    setScreen("list");

    // Soft delete: hide immediately from the UI, but only actually delete
    // from Firestore after a few seconds, giving the user a chance to undo.
    const timeoutId = setTimeout(async () => {
      try {
        await deleteDoc(doc(db, "users", ownerUid, "visits", id));
        await cancelCallReminder(id);
      } catch (e) {}
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
    } catch (e) {}
  };

  // Pins/unpins a customer so it stays sorted to the top of the list.
  const togglePin = async (visit) => {
    if (!canEdit || !ownerUid) return;
    if (!requireOnline()) return;
    try {
      await updateDoc(doc(db, "users", ownerUid, "visits", visit.id), { isPinned: !visit.isPinned });
    } catch (e) {}
  };

  // Records that an actual visit happened today: pushes a new visit-history
  // entry (so the Dashboard's visit count reflects real repeat visits) and
  // bumps the customer's visitDate to today.
  const logVisitToday = async (visit) => {
    if (!canEdit || !visit || !ownerUid) return;
    if (!requireOnline()) return;
    const today = new Date().toISOString().slice(0, 10);
    try {
      await updateDoc(doc(db, "users", ownerUid, "visits", visit.id), {
        visitDate: today,
        visitHistory: arrayUnion(buildVisitEntry(today)),
      });
      await appendActivity(visit.id, buildActivity("visit", t.activityVisitLogged(today)));
    } catch (e) {}
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

  const grantAccess = async (email, role) => {
    if (!isOwnerAccount || !user) return;
    if (!requireOnline()) return;

    const cleanEmail = email.trim().toLowerCase();
    if (!cleanEmail || !["editor", "viewer"].includes(role)) return;

    const accessRef = doc(db, "access", user.uid);
    const lookupRef = doc(db, "access_by_email", cleanEmail);

    try {
      // Transaction prevents concurrent owner changes from overwriting each
      // other when multiple clients edit the same members/owners maps.
      await runTransaction(db, async (tx) => {
        const [accessSnap, lookupSnap] = await Promise.all([
          tx.get(accessRef),
          tx.get(lookupRef),
        ]);

        const members = accessSnap.exists()
          ? { ...(accessSnap.data().members || {}) }
          : {};
        const owners = lookupSnap.exists()
          ? { ...(lookupSnap.data().owners || {}) }
          : {};

        members[cleanEmail] = role;
        owners[user.uid] = role;

        tx.set(accessRef, { members }, { merge: true });
        tx.set(lookupRef, { owners }, { merge: true });
      });
    } catch (e) {
      console.error("grantAccess failed:", e);
    }
  };

  const revokeAccess = async (email) => {
    if (!isOwnerAccount || !user) return;
    if (!requireOnline()) return;

    const cleanEmail = email.trim().toLowerCase();
    if (!cleanEmail) return;

    const accessRef = doc(db, "access", user.uid);
    const lookupRef = doc(db, "access_by_email", cleanEmail);

    try {
      await runTransaction(db, async (tx) => {
        const [accessSnap, lookupSnap] = await Promise.all([
          tx.get(accessRef),
          tx.get(lookupRef),
        ]);

        const members = accessSnap.exists()
          ? { ...(accessSnap.data().members || {}) }
          : {};
        const owners = lookupSnap.exists()
          ? { ...(lookupSnap.data().owners || {}) }
          : {};

        delete members[cleanEmail];
        delete owners[user.uid];

        tx.set(accessRef, { members }, { merge: false });
        // Keep the reverse-index document instead of deleting it, because
        // delete is intentionally disallowed by the security rules.
        tx.set(lookupRef, { owners }, { merge: false });
      });
    } catch (e) {
      console.error("revokeAccess failed:", e);
    }
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

  const writeExcel = (rows, filenameSuffix) => {
    const ws = XLSX.utils.json_to_sheet(visitsToRows(rows));
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, "Visits");
    XLSX.writeFile(wb, `pestco_visits_${filenameSuffix}_${new Date().toISOString().slice(0, 10)}.xlsx`);
  };

  // The live listener already holds every customer (no pagination limit),
  // so exporting "all" is just exporting the current in-memory list.
  const exportAllToExcel = () => {
    if (!canEdit) return;
    writeExcel(visibleVisits, "all");
  };

  // Exports only what's currently loaded and passing the active filters on
  // the customers list screen.
  const exportFilteredToExcel = () => {
    if (!canEdit) return;
    writeExcel(filtered, "filtered");
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
      alert(t.importSuccess(count));
    } catch (err) {
      alert(t.importError);
    } finally {
      setImporting(false);
    }
  };

  const now = Date.now();
  const visibleVisits = pendingDelete ? visits.filter((v) => v.id !== pendingDelete.id) : visits;

  const dueReminders = visibleVisits
    .filter((v) => v.callDateTime && new Date(v.callDateTime).getTime() <= now + 24 * 3600 * 1000)
    .sort((a, b) => new Date(a.callDateTime) - new Date(b.callDateTime));

  const staleOffers = visibleVisits.flatMap((v) =>
    (v.offers || [])
      .filter((o) => {
        if (o.status !== "pending") return false;
        const d = parseVisitDate(o.offerDate);
        if (!d) return false;
        return (now - d.getTime()) / (1000 * 3600 * 24) > STALE_OFFER_DAYS;
      })
      .map((o) => ({ ...o, customer: v }))
  );

  // Customers with a follow-up call scheduled for today specifically (same
  // calendar day), used for the always-visible "Today's Customers" panel.
  const todaysCustomers = visibleVisits
    .filter((v) => {
      if (!v.callDateTime) return false;
      const d = new Date(v.callDateTime);
      const n = new Date();
      return (
        d.getFullYear() === n.getFullYear() &&
        d.getMonth() === n.getMonth() &&
        d.getDate() === n.getDate()
      );
    })
    .sort((a, b) => new Date(a.callDateTime) - new Date(b.callDateTime));

  // Customers with no recent activity (visit, call, or note) — a nudge to
  // follow up before they go completely cold.
  const staleCustomers = visibleVisits.filter((v) => isStaleCustomer(v, STALE_ACTIVITY_DAYS));

  // Possible duplicate customers (same phone or a near-identical company
  // name), reviewed from the Settings screen.
  const duplicateGroups = findDuplicateGroups(visibleVisits);

  const allTags = Array.from(new Set(visibleVisits.flatMap((v) => v.tags || []))).sort();

  const sectorCounts = SECTOR_IDS.reduce((acc, id) => {
    acc[id] = visibleVisits.filter((v) => v.sector === id).length;
    return acc;
  }, {});
  const totalCustomers = visibleVisits.length;
  const missingDataCount = visibleVisits.filter((v) => !v.phone || !v.email).length;

  const filtered = visibleVisits
    .filter((v) => sectorFilter === "all" || v.sector === sectorFilter)
    .filter((v) => stageFilter === "all" || v.stage === stageFilter)
    .filter((v) => tagFilter === "all" || (v.tags || []).includes(tagFilter))
    .filter((v) => !missingDataOnly || !v.phone || !v.email)
    .filter((v) => {
      const q = query.trim().toLowerCase();
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
    });

  // All unique product tags across every supplier, used to populate the
  // "filter by product" chip row on the Suppliers list.
  const allSupplierTags = collectSupplierTags(suppliers);

  const filteredSuppliers = suppliers
    .filter((s) => supplierTagFilter === "all" || (s.tags || []).includes(supplierTagFilter))
    .filter((s) => {
      const q = supplierQuery.trim().toLowerCase();
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
    });

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
    return <AuthScreen lang={lang} setLang={setLang} />;
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
      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=Tajawal:wght@400;500;700;900&display=swap');
        .btn-press:active { transform: scale(0.98); }
        input, textarea, select {
          font-family: 'Tajawal', sans-serif;
          width: 100%;
          background: var(--surface);
          border: 0.5px solid var(--line);
          border-radius: 10px;
          padding: 10px 12px;
          font-size: 14px;
          color: ${TEXT};
          box-sizing: border-box;
        }
        input:focus, textarea:focus, select:focus {
          outline: none;
          border-color: ${PRIMARY_MID};
        }
        label { font-size: 13px; font-weight: 700; color: ${MUTED}; display:block; margin-bottom:4px; }
        button:focus-visible { outline: 2px solid ${PRIMARY_MID}; outline-offset: 2px; }
      `}</style>

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

      {screen === "dashboard" && (
        <Dashboard visits={visibleVisits} lang={lang} onOpenCustomer={openDetail} />
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
    </div>
  );
}
