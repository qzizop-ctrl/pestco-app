import React, { useState, useEffect, useRef } from "react";
import {
  Search, Plus, X, Trash2, Phone, Mail, Calendar,
  FileText, Building2, User, Pencil, ChevronRight, Shield, Bell, Languages, LogOut, Settings, MessageCircle,
  Download, Upload, Tag, Wifi, WifiOff, Workflow, Clock, StickyNote, LayoutDashboard, Users as UsersIcon, Wallet,
  Moon, Sun, ChevronDown, History, AlertTriangle, Star, Copy, ListFilter, Truck,
} from "lucide-react";
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
  PRIMARY, PRIMARY_MID, TEXT, MUTED, DANGER, GOLD, GOLD_SOFT, LINE, SURFACE, SURFACE_SUBTLE, STATUS_COLORS,
  STRINGS, ROLE_IDS, SECTOR_IDS, STAGE_IDS, OFFER_STATUS_IDS, CURRENCY_IDS, THEME_VARS, STALE_OFFER_DAYS, STALE_ACTIVITY_DAYS,
  sectorColor, stageColor, offerStatusColor,
  findSectorId, findRoleId, findStageId, parseTagsCell,
  parseVisitDate, toISODate, normalizeExcelDate, normalizeExcelDateTime,
  buildActivity, buildOffer, buildVisitEntry, getVisitEvents, ACTIVITY_COLORS,
  visitStatus, fmtReminder, fmtActivityDate, fmtCreatedAt, fmtMoney, fmtOffersTotals, sumOffersByCurrency, corePhoneDigits,
  findDuplicateGroups, isStaleCustomer,
  emptyForm, emptySupplierForm,
} from "./constants";

const ROOT_SCREENS = ["dashboard", "list", "suppliers", "settings"];

function beep() {
  try {
    const ctx = new (window.AudioContext || window.webkitAudioContext)();
    [0, 0.5].forEach((delay) => {
      const o = ctx.createOscillator();
      const g = ctx.createGain();
      o.connect(g);
      g.connect(ctx.destination);
      o.type = "sine";
      o.frequency.value = 880;
      g.gain.setValueAtTime(0.18, ctx.currentTime + delay);
      g.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + delay + 0.4);
      o.start(ctx.currentTime + delay);
      o.stop(ctx.currentTime + delay + 0.4);
    });
  } catch (e) {
    /* الجهاز لا يدعم تشغيل صوت / device doesn't support audio */
  }
}

function Logo({ size = 36 }) {
  return (
    <div
      className="flex items-center justify-center"
      style={{ width: size, height: size, background: "rgba(255,255,255,0.12)", borderRadius: 12 }}
    >
      <Shield size={size * 0.6} color="#F6F3EC" />
    </div>
  );
}

function TagChip({ label, onRemove }) {
  return (
    <span
      className="flex items-center gap-1 text-xs font-bold"
      style={{ background: GOLD_SOFT, color: "#7A5420", borderRadius: 999, padding: "3px 8px" }}
    >
      {label}
      {onRemove && (
        <button
          onClick={onRemove}
          className="btn-press flex items-center justify-center"
          style={{ color: "#7A5420" }}
          aria-label="x"
        >
          <X size={11} />
        </button>
      )}
    </span>
  );
}

function VisitCard({ visit, onOpen, onTogglePin, canEdit, t }) {
  const status = visitStatus(visit);
  const statusColor = STATUS_COLORS[status];
  const statusLabel = {
    overdue: t.statusOverdue,
    today: t.statusToday,
    upcoming: t.statusUpcoming,
    none: t.statusNone,
  }[status];
  const sectorLabel = t.sectors[visit.sector] || t.sectors.private;
  const stageId = visit.stage || "";
  const stageLabel = stageId ? (t.stages[stageId] || "") : "";
  const tags = visit.tags || [];
  const stale = isStaleCustomer(visit, STALE_ACTIVITY_DAYS);

  const stop = (fn) => (e) => {
    e.stopPropagation();
    fn();
  };

  return (
    <div
      className="w-full"
      style={{
        background: SURFACE,
        borderRadius: 16,
        border: `1px solid ${LINE}`,
        overflow: "hidden",
        boxShadow: "0 1px 2px rgba(0,0,0,.04)",
        position: "relative",
        marginBottom: 12,
      }}
    >
      <div
        style={{
          position: "absolute",
          top: 0,
          bottom: 0,
          [t.dir === "rtl" ? "right" : "left"]: 0,
          width: 5,
          background: statusColor,
        }}
      />
      {canEdit && (
        <button
          onClick={stop(() => onTogglePin(visit))}
          className="btn-press flex items-center justify-center"
          style={{
            position: "absolute",
            top: 10,
            [t.dir === "rtl" ? "left" : "right"]: 10,
            width: 28,
            height: 28,
            zIndex: 2,
            color: visit.isPinned ? GOLD : "#C7C4B6",
          }}
          aria-label={visit.isPinned ? t.unpinBtn : t.pinBtn}
        >
          <Star size={17} fill={visit.isPinned ? GOLD : "none"} />
        </button>
      )}
      <button
        onClick={() => onOpen(visit)}
        className={`btn-press w-full ${t.dir === "rtl" ? "text-right" : "text-left"}`}
        style={{
          padding: t.dir === "rtl" ? "14px 14px 14px 10px" : "14px 10px 14px 14px",
        }}
      >
        <div className="flex items-start justify-between gap-2">
          <div style={{ [t.dir === "rtl" ? "paddingLeft" : "paddingRight"]: 32 }}>
            <p className="font-extrabold text-base" style={{ margin: 0, color: TEXT }}>
              {visit.companyName || t.noCompanyName}
            </p>
            <p className="text-xs font-bold" style={{ margin: "2px 0 0", color: GOLD }}>
              {sectorLabel}
            </p>
          </div>
          <span
            className="text-xs font-extrabold"
            style={{
              background: statusColor,
              color: "#fff",
              borderRadius: 999,
              padding: "4px 10px",
              whiteSpace: "nowrap",
              flexShrink: 0,
            }}
          >
            {statusLabel}
          </span>
        </div>

        <div className="flex items-center flex-wrap gap-1 mt-2">
          {stageLabel && (
            <span
              className="text-xs font-bold"
              style={{ background: stageColor(stageId), color: "#fff", borderRadius: 999, padding: "3px 9px" }}
            >
              {stageLabel}
            </span>
          )}
          {!visit.phone && (
            <span
              className="text-xs font-bold"
              style={{ background: "rgba(196,68,58,.12)", color: DANGER, borderRadius: 999, padding: "3px 9px" }}
            >
              {t.missingPhoneBadge}
            </span>
          )}
          {!visit.email && (
            <span
              className="text-xs font-bold"
              style={{ background: "rgba(196,68,58,.12)", color: DANGER, borderRadius: 999, padding: "3px 9px" }}
            >
              {t.missingEmailBadge}
            </span>
          )}
          {stale && (
            <span
              className="text-xs font-bold"
              style={{ background: "rgba(219,154,44,.15)", color: "#8C6110", borderRadius: 999, padding: "3px 9px" }}
              title={t.staleHint(STALE_ACTIVITY_DAYS)}
            >
              {t.staleBadge}
            </span>
          )}
          {tags.slice(0, 3).map((tag) => (
            <TagChip key={tag} label={tag} />
          ))}
          {tags.length > 3 && (
            <span className="text-xs" style={{ color: MUTED }}>+{tags.length - 3}</span>
          )}
        </div>

        <div className="flex items-center gap-1 mt-2" style={{ color: MUTED }}>
          <User size={13} />
          <span className="text-sm">{visit.contactName || t.noContactName}</span>
        </div>

        <div
          className="flex items-center justify-between"
          style={{ marginTop: 12, paddingTop: 10, borderTop: `1px dashed ${LINE}` }}
        >
          <div className="flex items-center gap-1" style={{ color: MUTED, fontSize: 12 }}>
            <Calendar size={13} />
            {status === "none" ? (
              <span>{visit.visitDate || t.noVisitYet}</span>
            ) : (
              <span>{fmtReminder(visit.callDateTime, t.locale)}</span>
            )}
          </div>
          <div className="flex items-center gap-2">
            {visit.phone && (
              <a
                href={`tel:${visit.phone}`}
                onClick={stop(() => {})}
                className="btn-press flex items-center justify-center"
                style={{ width: 32, height: 32, borderRadius: 10, background: "#E5F1EA", color: "#2F9E58" }}
                aria-label={t.phoneRow}
              >
                <Phone size={14} />
              </a>
            )}
            {visit.phone && (
              <a
                href={`https://wa.me/${visit.phone.replace(/[^0-9]/g, "")}`}
                target="_blank"
                rel="noreferrer"
                onClick={stop(() => {})}
                className="btn-press flex items-center justify-center"
                style={{ width: 32, height: 32, borderRadius: 10, background: "#E4F5EA", color: "#25A245" }}
                aria-label={t.whatsapp}
              >
                <MessageCircle size={14} />
              </a>
            )}
          </div>
        </div>
      </button>
    </div>
  );
}

function BottomNav({ screen, setScreen, t }) {
  const items = [
    { id: "dashboard", label: t.navDashboard, icon: LayoutDashboard },
    { id: "list", label: t.navCustomers, icon: UsersIcon },
    { id: "suppliers", label: t.navSuppliers, icon: Truck },
    { id: "settings", label: t.navSettings, icon: Settings },
  ];
  return (
    <div
      className="flex items-center"
      style={{
        position: "fixed",
        bottom: 0,
        left: 0,
        right: 0,
        background: SURFACE,
        borderTop: `1px solid ${LINE}`,
        zIndex: 15,
        paddingBottom: "env(safe-area-inset-bottom, 0px)",
      }}
    >
      {items.map(({ id, label, icon: Icon }) => {
        const isActive = screen === id;
        return (
          <button
            key={id}
            onClick={() => setScreen(id)}
            className="btn-press flex-1 flex flex-col items-center gap-1"
            style={{ padding: "10px 0 8px", color: isActive ? PRIMARY : MUTED }}
          >
            <Icon size={20} strokeWidth={isActive ? 2.4 : 2} />
            <span className="text-xs font-bold">{label}</span>
          </button>
        );
      })}
    </div>
  );
}

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
        // initial login, but a revoked external user must NOT be converted
        // into a new owner workspace.
        const previousOwner = previousResolvedOwnerRef.current;
        const hasKnownExternalAccess = Boolean(previousOwner && previousOwner !== user.uid);

        let nextOwners = externalOwners;
        if (externalOwners.some((x) => x.uid === user.uid)) {
          nextOwners = externalOwners.map((x) => x.uid === user.uid ? { ...x, role: "owner" } : x);
        } else if (!hasKnownExternalAccess) {
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
          ? ownerUid
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
    const offer = buildOffer(newOffer);
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

  const openEditSupplier = (supplier) => {
    if (!canEdit) return;
    setSupplierForm({ ...emptySupplierForm, ...supplier });
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

  const saveSupplierForm = async () => {
    if (!canEdit) return;
    if (!requireOnline()) return;
    if (!validateSupplier() || !user || !ownerUid) return;

    const { id, ...rest } = supplierForm;
    try {
      if (activeSupplierId) {
        await updateDoc(doc(db, "users", ownerUid, "suppliers", activeSupplierId), rest);
      } else {
        await addDoc(collection(db, "users", ownerUid, "suppliers"), {
          ...rest,
          createdAt: serverTimestamp(),
        });
      }
      setScreen("suppliers");
    } catch (e) {}
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
    } catch (e) {}
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

  const filteredSuppliers = suppliers
    .filter((s) => {
      const q = supplierQuery.trim().toLowerCase();
      if (!q) return true;
      return (
        (s.name || "").toLowerCase().includes(q) ||
        (s.phone || "").toLowerCase().includes(q) ||
        (s.category || "").toLowerCase().includes(q) ||
        (s.notes || "").toLowerCase().includes(q)
      );
    })
    .sort((a, b) => (a.name || "").localeCompare(b.name || "", "ar"));

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
        <div className="px-4 pt-4 pb-24">
          {!isOnline && (
            <div
              className="flex items-center gap-2"
              style={{
                background: "rgba(219,154,44,.12)",
                border: "1px solid rgba(219,154,44,.4)",
                borderRadius: 12,
                padding: "8px 12px",
                marginBottom: 12,
              }}
            >
              <WifiOff size={14} color={STATUS_COLORS.today} />
              <span className="text-xs font-bold" style={{ color: "#8C6110" }}>{t.offlineBanner}</span>
            </div>
          )}

          {dueReminders.length > 0 && (
            <div
              style={{
                background: "rgba(196,68,58,.1)",
                border: "1px solid rgba(196,68,58,.35)",
                borderRadius: 14,
                padding: 12,
                marginBottom: 14,
              }}
            >
              <div className="flex items-center gap-2 mb-2">
                <Bell size={16} color={STATUS_COLORS.overdue} />
                <span className="text-sm font-bold" style={{ color: STATUS_COLORS.overdue }}>
                  {t.dueCalls(dueReminders.length)}
                </span>
              </div>
              {dueReminders.map((v) => (
                <button
                  key={v.id}
                  onClick={() => openDetail(v)}
                  className={`btn-press w-full flex items-center justify-between ${t.dir === "rtl" ? "text-right" : "text-left"}`}
                  style={{ padding: "6px 0" }}
                >
                  <span className="text-sm font-bold" style={{ color: TEXT }}>{v.companyName}</span>
                  <span className="text-xs" style={{ color: MUTED }}>{fmtReminder(v.callDateTime, t.locale)}</span>
                </button>
              ))}
            </div>
          )}

          {staleOffers.length > 0 && (
            <div
              style={{
                background: "rgba(219,154,44,.1)",
                border: "1px solid rgba(219,154,44,.35)",
                borderRadius: 14,
                padding: 12,
                marginBottom: 14,
              }}
            >
              <div className="flex items-center gap-2 mb-2">
                <AlertTriangle size={16} color={STATUS_COLORS.today} />
                <span className="text-sm font-bold" style={{ color: "#8C6110" }}>
                  {t.staleOffersBanner(staleOffers.length)}
                </span>
              </div>
              {staleOffers.map((o) => (
                <button
                  key={o.id}
                  onClick={() => openDetail(o.customer)}
                  className={`btn-press w-full flex items-center justify-between ${t.dir === "rtl" ? "text-right" : "text-left"}`}
                  style={{ padding: "6px 0" }}
                >
                  <span className="text-sm font-bold" style={{ color: TEXT }}>{o.customer.companyName}</span>
                  <span className="text-xs" style={{ color: MUTED }}>{o.name}</span>
                </button>
              ))}
            </div>
          )}

          {staleCustomers.length > 0 && (
            <div
              style={{
                background: "rgba(219,154,44,.1)",
                border: "1px solid rgba(219,154,44,.35)",
                borderRadius: 14,
                padding: 12,
                marginBottom: 14,
              }}
            >
              <div className="flex items-center gap-2 mb-2">
                <AlertTriangle size={16} color={STATUS_COLORS.today} />
                <span className="text-sm font-bold" style={{ color: "#8C6110" }}>
                  {t.staleBadge} ({staleCustomers.length})
                </span>
              </div>
              {staleCustomers.map((v) => (
                <button
                  key={v.id}
                  onClick={() => openDetail(v)}
                  className={`btn-press w-full flex items-center justify-between ${t.dir === "rtl" ? "text-right" : "text-left"}`}
                  style={{ padding: "6px 0" }}
                >
                  <span className="text-sm font-bold" style={{ color: TEXT }}>{v.companyName}</span>
                  <span className="text-xs" style={{ color: MUTED }}>{t.staleHint(STALE_ACTIVITY_DAYS)}</span>
                </button>
              ))}
            </div>
          )}

          <div className="relative mb-4">
            <Search
              size={16}
              color={MUTED}
              style={{ position: "absolute", [t.dir === "rtl" ? "right" : "left"]: 12, top: "50%", transform: "translateY(-50%)" }}
            />
            <input
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder={t.searchPlaceholder}
              style={{ [t.dir === "rtl" ? "paddingRight" : "paddingLeft"]: 34, borderRadius: 14 }}
            />
          </div>

          <div style={{ background: SURFACE, border: `1px solid ${LINE}`, borderRadius: 14, padding: 12, marginBottom: 14 }}>
            <div className="flex items-center gap-2 mb-2">
              <Clock size={15} color={PRIMARY_MID} />
              <span className="text-sm font-bold" style={{ color: TEXT }}>{t.todaysCustomersTitle}</span>
            </div>
            {todaysCustomers.length === 0 ? (
              <p className="text-xs text-center py-2" style={{ color: MUTED }}>{t.noTodaysCustomers}</p>
            ) : (
              todaysCustomers.map((v) => (
                <div
                  key={v.id}
                  className="flex items-center justify-between"
                  style={{ padding: "8px 0", borderTop: `1px dashed ${LINE}` }}
                >
                  <button
                    onClick={() => openDetail(v)}
                    className={`btn-press flex-1 ${t.dir === "rtl" ? "text-right" : "text-left"}`}
                  >
                    <p className="text-sm font-bold" style={{ margin: 0, color: TEXT }}>{v.companyName}</p>
                    <p className="text-xs" style={{ margin: 0, color: MUTED }}>{fmtReminder(v.callDateTime, t.locale)}</p>
                  </button>
                  <div className="flex items-center gap-2">
                    {v.phone && (
                      <a
                        href={`tel:${v.phone}`}
                        className="btn-press flex items-center justify-center"
                        style={{ width: 30, height: 30, borderRadius: 9, background: "#E5F1EA", color: "#2F9E58" }}
                        aria-label={t.phoneRow}
                      >
                        <Phone size={13} />
                      </a>
                    )}
                    {v.phone && (
                      <a
                        href={`https://wa.me/${v.phone.replace(/[^0-9]/g, "")}`}
                        target="_blank"
                        rel="noreferrer"
                        className="btn-press flex items-center justify-center"
                        style={{ width: 30, height: 30, borderRadius: 9, background: "#E4F5EA", color: "#25A245" }}
                        aria-label={t.whatsapp}
                      >
                        <MessageCircle size={13} />
                      </a>
                    )}
                  </div>
                </div>
              ))
            )}
          </div>

          <div style={{ background: SURFACE, border: `1px solid ${LINE}`, borderRadius: 14, padding: 12, marginBottom: 14 }}>
            <div className="flex items-center justify-between mb-2">
              <span className="text-sm font-bold" style={{ color: TEXT }}>{t.totalCustomersLabel}</span>
              <span className="text-sm font-extrabold" style={{ color: PRIMARY }}>{totalCustomers}</span>
            </div>
            <div className="flex flex-col gap-1">
              {SECTOR_IDS.map((id) => (
                <div key={id} className="flex items-center justify-between">
                  <span className="text-xs font-bold" style={{ color: MUTED }}>{t.sectors[id]}</span>
                  <span className="text-xs font-extrabold" style={{ color: sectorColor(id) }}>{sectorCounts[id]}</span>
                </div>
              ))}
            </div>
          </div>

          <div className="flex items-center gap-2 mb-2" style={{ overflowX: "auto" }}>
            {["all", ...SECTOR_IDS].map((id) => {
              const isActive = sectorFilter === id;
              const label = id === "all" ? t.sectorAll : t.sectors[id];
              const count = id === "all" ? totalCustomers : sectorCounts[id];
              return (
                <button
                  key={id}
                  onClick={() => setSectorFilter(id)}
                  className="btn-press font-bold text-xs"
                  style={{
                    flexShrink: 0,
                    padding: "8px 16px",
                    borderRadius: 999,
                    border: `1.4px solid ${isActive ? PRIMARY : LINE}`,
                    background: isActive ? PRIMARY : SURFACE,
                    color: isActive ? "#fff" : MUTED,
                  }}
                >
                  {label} ({count})
                </button>
              );
            })}
          </div>

          <div className="flex items-center gap-2 mb-2" style={{ overflowX: "auto" }}>
            {["all", ...STAGE_IDS].map((id) => {
              const isActive = stageFilter === id;
              const label = id === "all" ? t.pipelineAll : t.stages[id];
              const bg = id === "all" ? (isActive ? PRIMARY : SURFACE) : (isActive ? stageColor(id) : SURFACE);
              return (
                <button
                  key={id}
                  onClick={() => setStageFilter(id)}
                  className="btn-press font-bold text-xs"
                  style={{
                    flexShrink: 0,
                    padding: "8px 16px",
                    borderRadius: 999,
                    border: `1.4px solid ${isActive ? bg : LINE}`,
                    background: bg,
                    color: isActive ? "#fff" : MUTED,
                  }}
                >
                  {label}
                </button>
              );
            })}
          </div>

          {allTags.length > 0 && (
            <div className="flex items-center gap-2 mb-4" style={{ overflowX: "auto" }}>
              <button
                onClick={() => setTagFilter("all")}
                className="btn-press font-bold text-xs flex items-center gap-1"
                style={{
                  flexShrink: 0,
                  padding: "8px 16px",
                  borderRadius: 999,
                  border: `1.4px solid ${tagFilter === "all" ? PRIMARY : LINE}`,
                  background: tagFilter === "all" ? PRIMARY : SURFACE,
                  color: tagFilter === "all" ? "#fff" : MUTED,
                }}
              >
                <Tag size={12} /> {t.tagsAll}
              </button>
              {allTags.map((tag) => {
                const isActive = tagFilter === tag;
                return (
                  <button
                    key={tag}
                    onClick={() => setTagFilter(tag)}
                    className="btn-press font-bold text-xs"
                    style={{
                      flexShrink: 0,
                      padding: "8px 16px",
                      borderRadius: 999,
                      border: `1.4px solid ${isActive ? GOLD : LINE}`,
                      background: isActive ? GOLD : SURFACE,
                      color: isActive ? "#fff" : MUTED,
                    }}
                  >
                    {tag}
                  </button>
                );
              })}
            </div>
          )}

          <div className="flex items-center gap-2 mb-4" style={{ overflowX: "auto" }}>
            <button
              onClick={() => setMissingDataOnly((m) => !m)}
              className="btn-press font-bold text-xs flex items-center gap-1"
              style={{
                flexShrink: 0,
                padding: "8px 16px",
                borderRadius: 999,
                border: `1.4px solid ${missingDataOnly ? DANGER : LINE}`,
                background: missingDataOnly ? DANGER : SURFACE,
                color: missingDataOnly ? "#fff" : MUTED,
              }}
            >
              <ListFilter size={12} /> {t.missingDataFilter} ({missingDataCount})
            </button>
          </div>

          {!loaded && <p className="text-sm text-center py-8" style={{ color: MUTED }}>{t.loading}</p>}

          {loaded && filtered.length === 0 && (
            <div className="text-center py-16">
              <Building2 size={40} color="#C7C4B6" className="mx-auto mb-2" />
              <p className="font-bold" style={{ color: TEXT }}>{t.noVisits}</p>
              <p className="text-sm mt-1" style={{ color: MUTED }}>{t.noVisitsHint}</p>
            </div>
          )}

          {filtered.map((v) => (
            <VisitCard key={v.id} visit={v} onOpen={openDetail} onTogglePin={togglePin} canEdit={canEdit} t={t} />
          ))}

          {canEdit && (
            <button
              onClick={openNew}
              className="btn-press flex items-center justify-center"
              style={{
                position: "fixed",
                bottom: 84,
                left: 20,
                width: 56,
                height: 56,
                borderRadius: "50%",
                background: GOLD,
                color: "#fff",
                border: "none",
                boxShadow: "0 10px 20px rgba(192,138,62,.4)",
                zIndex: 20,
              }}
              aria-label={t.newVisit}
            >
              <Plus size={26} />
            </button>
          )}
        </div>
      )}

      {screen === "form" && canEdit && (
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
      )}

      {screen === "detail" && active && (
        <div className="px-4 pt-4 pb-10">
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
                      .map((ev) => (
                        <span
                          key={ev.id}
                          className="text-xs font-bold"
                          style={{ background: SURFACE_SUBTLE, color: MUTED, borderRadius: 999, padding: "4px 10px" }}
                        >
                          {ev.date}
                        </span>
                      ))}
                  </div>
                </div>
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
                    onClick={async () => {
                      if (!requireOnline()) return;
                      if (!user || !ownerUid) return;
                      updateDoc(doc(db, "users", ownerUid, "visits", active.id), {
                        callDateTime: "",
                        notified: false,
                      }).catch(() => {});
                      cancelCallReminder(active.id);
                      await appendActivity(active.id, buildActivity("call", t.activityCallDone));
                    }}
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
                        </button>

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
        </div>
      )}

      {screen === "suppliers" && (
        <div className="px-4 pt-4 pb-24">
          <div className="relative mb-4">
            <Search
              size={16}
              color={MUTED}
              style={{ position: "absolute", [t.dir === "rtl" ? "right" : "left"]: 12, top: "50%", transform: "translateY(-50%)" }}
            />
            <input
              value={supplierQuery}
              onChange={(e) => setSupplierQuery(e.target.value)}
              placeholder={t.searchSuppliersPlaceholder}
              style={{ [t.dir === "rtl" ? "paddingRight" : "paddingLeft"]: 34, borderRadius: 14 }}
            />
          </div>

          {!suppliersLoaded && <p className="text-sm text-center py-8" style={{ color: MUTED }}>{t.loading}</p>}

          {suppliersLoaded && filteredSuppliers.length === 0 && (
            <div className="text-center py-16">
              <Truck size={40} color="#C7C4B6" className="mx-auto mb-2" />
              <p className="font-bold" style={{ color: TEXT }}>{t.noSuppliers}</p>
              <p className="text-sm mt-1" style={{ color: MUTED }}>{t.noSuppliersHint}</p>
            </div>
          )}

          {filteredSuppliers.map((s) => (
            <button
              key={s.id}
              onClick={() => openEditSupplier(s)}
              className={`btn-press w-full ${t.dir === "rtl" ? "text-right" : "text-left"}`}
              style={{
                display: "block",
                background: SURFACE,
                border: `1px solid ${LINE}`,
                borderRadius: 16,
                padding: 14,
                marginBottom: 12,
              }}
            >
              <div className="flex items-start justify-between gap-2">
                <p className="font-extrabold text-base" style={{ margin: 0, color: TEXT }}>
                  {s.name || t.noSupplierName}
                </p>
                {s.category && (
                  <span
                    className="text-xs font-bold flex-shrink-0"
                    style={{ background: GOLD_SOFT, color: "#7A5420", borderRadius: 999, padding: "3px 9px" }}
                  >
                    {s.category}
                  </span>
                )}
              </div>
              {s.notes && (
                <p className="text-sm mt-1" style={{ color: MUTED, margin: "4px 0 0" }}>{s.notes}</p>
              )}
              <div
                className="flex items-center justify-between"
                style={{ marginTop: 10, paddingTop: 10, borderTop: `1px dashed ${LINE}` }}
              >
                <span className="text-sm" style={{ color: MUTED }}>{s.phone || "—"}</span>
                <div className="flex items-center gap-2">
                  {s.phone && (
                    <a
                      href={`tel:${s.phone}`}
                      onClick={(e) => e.stopPropagation()}
                      className="btn-press flex items-center justify-center"
                      style={{ width: 32, height: 32, borderRadius: 10, background: "#E5F1EA", color: "#2F9E58" }}
                      aria-label={t.phoneRow}
                    >
                      <Phone size={14} />
                    </a>
                  )}
                  {s.phone && (
                    <a
                      href={`https://wa.me/${s.phone.replace(/[^0-9]/g, "")}`}
                      target="_blank"
                      rel="noreferrer"
                      onClick={(e) => e.stopPropagation()}
                      className="btn-press flex items-center justify-center"
                      style={{ width: 32, height: 32, borderRadius: 10, background: "#E4F5EA", color: "#25A245" }}
                      aria-label={t.whatsapp}
                    >
                      <MessageCircle size={14} />
                    </a>
                  )}
                </div>
              </div>
            </button>
          ))}

          {canEdit && (
            <button
              onClick={openNewSupplier}
              className="btn-press flex items-center justify-center"
              style={{
                position: "fixed",
                bottom: 84,
                left: 20,
                width: 56,
                height: 56,
                borderRadius: "50%",
                background: GOLD,
                color: "#fff",
                border: "none",
                boxShadow: "0 10px 20px rgba(192,138,62,.4)",
                zIndex: 20,
              }}
              aria-label={t.newSupplierBtn}
            >
              <Plus size={26} />
            </button>
          )}
        </div>
      )}

      {screen === "supplier-form" && canEdit && (
        <div className="px-4 pt-4 pb-10 flex flex-col gap-4">
          <div>
            <label>{t.supplierNameLabel}</label>
            <input
              value={supplierForm.name}
              onChange={(e) => setSupplierForm({ ...supplierForm, name: e.target.value })}
              placeholder={t.supplierNamePlaceholder}
            />
            {supplierErrors.name && <p className="text-xs mt-1" style={{ color: DANGER }}>{supplierErrors.name}</p>}
          </div>

          <div>
            <label>{t.phoneLabel}</label>
            <input
              type="tel"
              value={supplierForm.phone}
              onChange={(e) => setSupplierForm({ ...supplierForm, phone: e.target.value })}
              placeholder={t.phonePlaceholder}
            />
          </div>

          <div>
            <label>{t.supplierCategoryLabel}</label>
            <input
              value={supplierForm.category}
              onChange={(e) => setSupplierForm({ ...supplierForm, category: e.target.value })}
              placeholder={t.supplierCategoryPlaceholder}
            />
          </div>

          <div>
            <label>{t.supplierNotesLabel}</label>
            <textarea
              rows={5}
              value={supplierForm.notes}
              onChange={(e) => setSupplierForm({ ...supplierForm, notes: e.target.value })}
              placeholder={t.notesPlaceholder}
            />
          </div>

          <button
            onClick={saveSupplierForm}
            className="btn-press font-bold"
            style={{ background: PRIMARY, color: "#fff", borderRadius: 14, padding: "12px 0", marginTop: 8 }}
          >
            {t.save}
          </button>

          {activeSupplierId && (
            <button
              onClick={() => deleteSupplier(activeSupplierId)}
              className="btn-press flex items-center justify-center gap-2 font-bold"
              style={{ background: SURFACE, border: `1px solid ${DANGER}`, color: DANGER, borderRadius: 14, padding: "12px 0" }}
            >
              <Trash2 size={16} /> {t.delete}
            </button>
          )}
        </div>
      )}

      {screen === "settings" && (
        <div className="px-4 pt-4 pb-24">
          {availableOwners.length > 1 && (
            <div style={{ background: SURFACE, borderRadius: 16, border: `1px solid ${LINE}`, padding: 16, marginBottom: 16 }}>
              <p className="font-bold text-base mb-1" style={{ color: TEXT }}>مساحات العمل</p>
              <p className="text-xs mb-3" style={{ color: MUTED }}>اختار الشركة/الحساب الذي تريد العمل عليه.</p>
              <select
                value={ownerUid || ""}
                onChange={(e) => switchOwnerWorkspace(e.target.value)}
                style={{ width: "100%", padding: "12px", borderRadius: 12, border: `1px solid ${LINE}`, background: SURFACE_SUBTLE, color: TEXT }}
              >
                {availableOwners.map((workspace, index) => (
                  <option key={workspace.uid} value={workspace.uid}>
                    {workspace.uid === user?.uid ? "حسابي (Owner)" : `مساحة عمل ${index + 1} — ${workspace.role === "editor" ? "Editor" : "Viewer"}`}
                  </option>
                ))}
              </select>
            </div>
          )}

          {canEdit && (
            <div style={{ background: SURFACE, borderRadius: 16, border: `1px solid ${LINE}`, padding: 16, marginBottom: 16 }}>
              <p className="font-bold text-base mb-1" style={{ color: TEXT }}>{t.duplicatesTitle}</p>
              <p className="text-xs mb-3" style={{ color: MUTED }}>{t.duplicatesHint}</p>

              <button
                onClick={() => setShowDuplicates((s) => !s)}
                className="btn-press flex items-center justify-center gap-2 font-bold"
                style={{
                  background: showDuplicates ? SURFACE : PRIMARY_MID,
                  border: showDuplicates ? `1px solid ${PRIMARY_MID}` : "none",
                  color: showDuplicates ? PRIMARY_MID : "#fff",
                  borderRadius: 14,
                  padding: "12px 0",
                  width: "100%",
                }}
              >
                <Copy size={16} /> {t.duplicatesBtn}
              </button>

              {showDuplicates && (
                <div style={{ marginTop: 12 }}>
                  {duplicateGroups.length === 0 ? (
                    <p className="text-sm text-center py-4" style={{ color: MUTED }}>{t.noDuplicatesFound}</p>
                  ) : (
                    duplicateGroups.map((group, idx) => (
                      <div
                        key={idx}
                        style={{ background: SURFACE_SUBTLE, borderRadius: 12, padding: 10, marginBottom: 8 }}
                      >
                        <span className="text-xs font-bold" style={{ color: GOLD }}>
                          {group.reason === "phone" ? t.samePhoneReason : t.similarNameReason}
                        </span>
                        {group.customers.map((c) => (
                          <button
                            key={c.id}
                            onClick={() => openDetail(c)}
                            className={`btn-press w-full flex items-center justify-between ${t.dir === "rtl" ? "text-right" : "text-left"}`}
                            style={{ padding: "6px 0" }}
                          >
                            <span className="text-sm font-bold" style={{ color: TEXT }}>{c.companyName || t.noCompanyName}</span>
                            <span className="text-xs" style={{ color: MUTED }}>{c.phone || "—"}</span>
                          </button>
                        ))}
                      </div>
                    ))
                  )}
                </div>
              )}
            </div>
          )}

          {isOwnerAccount && (
            <div style={{ background: SURFACE, borderRadius: 16, border: `1px solid ${LINE}`, padding: 16, marginBottom: 16 }}>
              <p className="font-bold text-base mb-1" style={{ color: TEXT }}>{t.manageAccess}</p>
              <p className="text-xs mb-3" style={{ color: MUTED }}>{t.membersTitle}</p>

              {Object.keys(members).length === 0 && (
                <p className="text-sm text-center py-4" style={{ color: MUTED }}>{t.noMembers}</p>
              )}

              {Object.entries(members).map(([email, role]) => (
                <div
                  key={email}
                  className="flex items-center justify-between"
                  style={{ padding: "8px 0", borderBottom: `0.5px solid ${LINE}` }}
                >
                  <div>
                    <p className="text-sm font-bold" style={{ color: TEXT }}>{email}</p>
                    <p className="text-xs" style={{ color: MUTED }}>{role === "editor" ? t.roleEditor : t.roleViewer}</p>
                  </div>
                  <button
                    onClick={() => {
                      if (window.confirm(t.removeConfirm)) revokeAccess(email);
                    }}
                    className="btn-press"
                    style={{ color: DANGER }}
                    aria-label={t.delete}
                  >
                    <Trash2 size={16} />
                  </button>
                </div>
              ))}
            </div>
          )}

          {canEdit && (
            <div style={{ background: SURFACE, borderRadius: 16, border: `1px solid ${LINE}`, padding: 16, marginBottom: 16 }}>
              <p className="font-bold text-base mb-3" style={{ color: TEXT }}>{t.excelTitle}</p>

              <button
                onClick={exportAllToExcel}
                className="btn-press flex items-center justify-center gap-2 font-bold"
                style={{
                  background: PRIMARY_MID,
                  color: "#fff",
                  borderRadius: 14,
                  padding: "12px 0",
                  width: "100%",
                  marginBottom: 10,
                }}
              >
                <Download size={16} /> {t.exportAllBtn}
              </button>

              <button
                onClick={exportFilteredToExcel}
                className="btn-press flex items-center justify-center gap-2 font-bold"
                style={{
                  background: SURFACE,
                  border: `1px solid ${PRIMARY_MID}`,
                  color: PRIMARY_MID,
                  borderRadius: 14,
                  padding: "12px 0",
                  width: "100%",
                  marginBottom: 10,
                }}
              >
                <Download size={16} /> {t.exportFilteredBtn(filtered.length)}
              </button>

              <button
                onClick={triggerImportPicker}
                disabled={importing}
                className="btn-press flex items-center justify-center gap-2 font-bold"
                style={{
                  background: SURFACE,
                  border: `1px solid ${PRIMARY_MID}`,
                  color: PRIMARY_MID,
                  borderRadius: 14,
                  padding: "12px 0",
                  width: "100%",
                  opacity: importing ? 0.6 : 1,
                }}
              >
                <Upload size={16} /> {importing ? t.importing : t.importBtn}
              </button>
              <input
                ref={fileInputRef}
                type="file"
                accept=".xlsx,.xls,.csv"
                onChange={handleImportFile}
                style={{ display: "none" }}
              />
              <p className="text-xs mt-2" style={{ color: MUTED }}>{t.importHint}</p>
            </div>
          )}

          {isOwnerAccount && (
            <div style={{ background: SURFACE, borderRadius: 16, border: `1px solid ${LINE}`, padding: 16 }}>
              <label>{t.addMemberEmail}</label>
              <input
                type="email"
                value={newMemberEmail}
                onChange={(e) => setNewMemberEmail(e.target.value)}
                placeholder={t.emailPlaceholder}
              />
              <div style={{ marginTop: 10 }}>
                <label>{t.addMemberRole}</label>
                <select value={newMemberRole} onChange={(e) => setNewMemberRole(e.target.value)}>
                  <option value="viewer">{t.roleViewer}</option>
                  <option value="editor">{t.roleEditor}</option>
                </select>
              </div>
              <button
                onClick={async () => {
                  if (!newMemberEmail.trim()) return;
                  await grantAccess(newMemberEmail, newMemberRole);
                  setNewMemberEmail("");
                }}
                className="btn-press font-bold"
                style={{ background: PRIMARY, color: "#fff", borderRadius: 14, padding: "12px 0", marginTop: 12, width: "100%" }}
              >
                {t.addMemberBtn}
              </button>
              <p className="text-xs mt-2" style={{ color: MUTED }}>{t.memberInviteHint}</p>
            </div>
          )}
        </div>
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

      {isRootScreen && <BottomNav screen={screen} setScreen={setScreen} t={t} />}
    </div>
  );
}
