import React, { useState, useEffect, useRef } from "react";
import {
  Search, Plus, X, Trash2, Phone, Mail, Calendar,
  FileText, Building2, User, Pencil, ChevronRight, ShieldCheck, Bell, Languages, LogOut, Settings, MessageCircle,
  Download, Upload,
} from "lucide-react";
import * as XLSX from "xlsx";
import { onAuthStateChanged, signOut } from "firebase/auth";
import {
  collection, doc, onSnapshot, addDoc, updateDoc, deleteDoc, serverTimestamp,
  getDoc, setDoc,
} from "firebase/firestore";
import { auth, db } from "./firebase";
import AuthScreen from "./AuthScreen";
import {
  requestNotificationPermission, scheduleCallReminder, cancelCallReminder,
} from "./notifications";

const PRIMARY = "#12332B";
const PRIMARY_MID = "#1E5245";
const BG = "#E4E0D5";
const CARD_BG = "#F6F3EC";
const TEXT = "#1B241F";
const MUTED = "#6B7168";
const DANGER = "#B3401F";
const GOLD = "#C08A3E";
const GOLD_SOFT = "#F3E6D0";
const LINE = "#E7E2D6";

const STATUS_COLORS = {
  overdue: "#C4443A",
  today: "#DB9A2C",
  upcoming: "#2E6B8F",
  none: "#9AA39B",
};

const STRINGS = {
  ar: {
    dir: "rtl",
    locale: "ar-EG",
    appTitle: "Pest.Co — زيارات العملاء",
    titleEdit: "تعديل الزيارة",
    titleNew: "عميل جديد",
    titleDetail: "تفاصيل الزيارة",
    back: "رجوع",
    langToggle: "English",
    dueCalls: (n) => `عندك ${n} مكالمة مستحقة`,
    searchPlaceholder: "ابحث بالشركة أو المسؤول أو الرقم أو الملاحظات",
    loading: "جارِ التحميل...",
    noVisits: "لا توجد زيارات بعد",
    noVisitsHint: 'اضغط على "عميل جديد" لإضافة أول عميل',
    newVisit: "عميل جديد",
    noCompanyName: "بدون اسم شركة",
    noContactName: "بدون اسم",
    companyLabel: "اسم الشركة *",
    companyPlaceholder: "مثال: شركة النور للصناعات",
    companyError: "اكتب اسم الشركة",
    contactLabel: "اسم الشخص المسؤول *",
    contactPlaceholder: "مثال: أحمد محمد",
    contactError: "اكتب اسم الشخص المسؤول",
    roleLabel: "الجهة / المسمى الوظيفي",
    phoneLabel: "رقم الهاتف",
    phonePlaceholder: "01xxxxxxxxx",
    emailLabel: "البريد الإلكتروني",
    emailPlaceholder: "name@company.com",
    visitDateLabel: "تاريخ الزيارة",
    callDateLabel: "موعد الاتصال القادم (اختياري)",
    callDateHint: "في نسخة الأندرويد: التطبيق هيبعتلك تنبيه حقيقي في المعاد ده حتى لو التطبيق مقفول. في نسخة المتصفح: لازم التطبيق يكون شغال.",
    notesLabel: "ملاحظات الزيارة",
    notesPlaceholder: "تفاصيل الزيارة، المطلوب متابعته، إلخ",
    save: "إضافة عميل",
    phoneRow: "رقم الهاتف",
    emailRow: "البريد الإلكتروني",
    visitDateRow: "تاريخ الزيارة",
    callDueLabel: "موعد الاتصال:",
    callDone: "تم الاتصال ✓",
    notesRow: "ملاحظات",
    edit: "تعديل",
    delete: "حذف",
    roles: {
      purchasing: "مسؤول المشتريات",
      it: "تقنية المعلومات",
      technical: "المكتب الفني",
      other: "أخرى",
    },
    sectorLabel: "القطاع",
    sectorAll: "الكل",
    sectors: {
      construction: "قطاع المقاولات",
      education: "قطاع التعليم",
      consultants: "قطاع الاستشاريين",
      private: "شركات خاصة",
    },
    signOut: "تسجيل الخروج",
    reminderTitle: "تذكير اتصال:",
    reminderBody: (contact) => `موعد الاتصال بـ ${contact} حان الآن`,
    settingsTitle: "الإعدادات",
    manageAccess: "إدارة المشاركة",
    membersTitle: "الأشخاص الذين لديهم صلاحية الوصول",
    addMemberEmail: "البريد الإلكتروني",
    addMemberRole: "الصلاحية",
    roleEditor: "يشوف ويعدل",
    roleViewer: "يشوف فقط",
    addMemberBtn: "إضافة",
    noMembers: "لا يوجد أشخاص مضافين بعد",
    removeConfirm: "هل تريد إلغاء صلاحية هذا الشخص؟",
    statusOverdue: "متأخرة",
    statusToday: "اليوم",
    statusUpcoming: "قادمة",
    statusNone: "بدون موعد",
    whatsapp: "واتساب",
    excelTitle: "استيراد / تصدير إكسيل",
    exportBtn: "تصدير كل الزيارات (إكسيل)",
    importBtn: "استيراد من ملف إكسيل",
    importHint: "الملف لازم يكون بنفس أعمدة ملف التصدير (اسم الشركة، الشخص المسؤول، إلخ). الصفوف هتتضاف كزيارات جديدة.",
    importSuccess: (n) => `تم استيراد ${n} زيارة بنجاح`,
    importError: "حصل خطأ أثناء قراءة الملف، تأكد من صيغة الملف",
    importing: "جارِ الاستيراد...",
    duplicatePhoneWarning: (company) => `رقم الهاتف ده مسجل بالفعل عند "${company}". هل تريد الإضافة برضو؟`,
  },
  en: {
    dir: "ltr",
    locale: "en-US",
    appTitle: "Pest.Co — Client Visits",
    titleEdit: "Edit Visit",
    titleNew: "New Customer",
    titleDetail: "Visit Details",
    back: "Back",
    langToggle: "عربي",
    dueCalls: (n) => `You have ${n} call${n === 1 ? "" : "s"} due`,
    searchPlaceholder: "Search by company, contact, phone or notes",
    loading: "Loading...",
    noVisits: "No visits yet",
    noVisitsHint: 'Tap "New Customer" to add your first client',
    newVisit: "New Customer",
    noCompanyName: "No company name",
    noContactName: "No name",
    companyLabel: "Company Name *",
    companyPlaceholder: "e.g. Al Nour Industries",
    companyError: "Enter the company name",
    contactLabel: "Contact Person *",
    contactPlaceholder: "e.g. Ahmed Mohamed",
    contactError: "Enter the contact person's name",
    roleLabel: "Department / Job Title",
    phoneLabel: "Phone Number",
    phonePlaceholder: "01xxxxxxxxx",
    emailLabel: "Email",
    emailPlaceholder: "name@company.com",
    visitDateLabel: "Visit Date",
    callDateLabel: "Next Call Date (optional)",
    callDateHint: "On the Android app: you'll get a real alert at this time even if the app is closed. On the web version: the app needs to be open.",
    notesLabel: "Visit Notes",
    notesPlaceholder: "Visit details, follow-ups needed, etc.",
    save: "Add Customer",
    phoneRow: "Phone Number",
    emailRow: "Email",
    visitDateRow: "Visit Date",
    callDueLabel: "Call due:",
    callDone: "Called ✓",
    notesRow: "Notes",
    edit: "Edit",
    delete: "Delete",
    roles: {
      purchasing: "Purchasing Manager",
      it: "IT",
      technical: "Technical Office",
      other: "Other",
    },
    sectorLabel: "Sector",
    sectorAll: "All",
    sectors: {
      construction: "Construction Sector",
      education: "Education",
      consultants: "Consultants",
      private: "Private Companies",
    },
    signOut: "Sign Out",
    reminderTitle: "Call reminder:",
    reminderBody: (contact) => `It's time to call ${contact}`,
    settingsTitle: "Settings",
    manageAccess: "Manage Access",
    membersTitle: "People with access",
    addMemberEmail: "Email",
    addMemberRole: "Role",
    roleEditor: "Can view & edit",
    roleViewer: "View only",
    addMemberBtn: "Add",
    noMembers: "No one added yet",
    removeConfirm: "Remove this person's access?",
    statusOverdue: "Overdue",
    statusToday: "Today",
    statusUpcoming: "Upcoming",
    statusNone: "No call set",
    whatsapp: "WhatsApp",
    excelTitle: "Excel Import / Export",
    exportBtn: "Export all visits (Excel)",
    importBtn: "Import from Excel file",
    importHint: "The file must use the same columns as the exported file (Company Name, Contact Person, etc). Rows will be added as new visits.",
    importSuccess: (n) => `Successfully imported ${n} visit${n === 1 ? "" : "s"}`,
    importError: "Something went wrong reading the file, please check the file format",
    importing: "Importing...",
    duplicatePhoneWarning: (company) => `This phone number is already saved for "${company}". Add anyway?`,
  },
};

const ROLE_IDS = ["purchasing", "it", "technical", "other"];
const ROLE_COLORS = {
  purchasing: "#B9832A",
  it: "#2C6E8C",
  technical: "#0F5132",
  other: "#6B7168",
};

const roleColor = (id) => ROLE_COLORS[id] || ROLE_COLORS.other;

const SECTOR_IDS = ["construction", "education", "consultants", "private"];
const SECTOR_COLORS = {
  construction: "#8C5A2C",
  education: "#2C6E8C",
  consultants: "#3D8C6C",
  private: "#6B4C8C",
};

const sectorColor = (id) => SECTOR_COLORS[id] || SECTOR_COLORS.private;

// Matches an imported Excel cell value (Arabic or English label, or raw id) to a sector id
function findSectorId(value) {
  const v = (value || "").toString().trim();
  if (SECTOR_IDS.includes(v)) return v;
  for (const langKey of Object.keys(STRINGS)) {
    const map = STRINGS[langKey].sectors;
    const found = Object.entries(map).find(([, label]) => label === v);
    if (found) return found[0];
  }
  return "private";
}

// Matches an imported Excel cell value (Arabic or English label, or raw id) to a role id
function findRoleId(value) {
  const v = (value || "").toString().trim();
  if (ROLE_IDS.includes(v)) return v;
  for (const langKey of Object.keys(STRINGS)) {
    const map = STRINGS[langKey].roles;
    const found = Object.entries(map).find(([, label]) => label === v);
    if (found) return found[0];
  }
  return "other";
}

// Normalizes an Excel cell (Date object or string) into a yyyy-mm-dd date string
function normalizeExcelDate(val) {
  if (!val) return "";
  if (val instanceof Date) {
    const pad = (n) => String(n).padStart(2, "0");
    return `${val.getFullYear()}-${pad(val.getMonth() + 1)}-${pad(val.getDate())}`;
  }
  return String(val).trim();
}

// Normalizes an Excel cell (Date object or string) into a yyyy-mm-ddThh:mm datetime-local string
function normalizeExcelDateTime(val) {
  if (!val) return "";
  if (val instanceof Date) {
    const pad = (n) => String(n).padStart(2, "0");
    return `${val.getFullYear()}-${pad(val.getMonth() + 1)}-${pad(val.getDate())}T${pad(val.getHours())}:${pad(val.getMinutes())}`;
  }
  return String(val).trim();
}

const emptyForm = {
  id: null,
  companyName: "",
  contactName: "",
  sector: "construction",
  role: "purchasing",
  phone: "",
  email: "",
  visitDate: new Date().toISOString().slice(0, 10),
  notes: "",
  callDateTime: "",
  notified: false,
};

function visitStatus(visit) {
  if (!visit.callDateTime) return "none";
  const call = new Date(visit.callDateTime);
  const now = new Date();
  if (call.getTime() < now.getTime()) return "overdue";
  const sameDay =
    call.getFullYear() === now.getFullYear() &&
    call.getMonth() === now.getMonth() &&
    call.getDate() === now.getDate();
  if (sameDay) return "today";
  return "upcoming";
}

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

function fmtReminder(dt, locale) {
  try {
    const d = new Date(dt);
    return d.toLocaleString(locale, { day: "numeric", month: "short", hour: "2-digit", minute: "2-digit" });
  } catch (e) {
    return dt;
  }
}

function Logo({ size = 36 }) {
  return (
    <div
      className="flex items-center justify-center"
      style={{ width: size, height: size, background: "rgba(255,255,255,0.12)", borderRadius: 12 }}
    >
      <ShieldCheck size={size * 0.6} color="#F6F3EC" />
    </div>
  );
}

function VisitCard({ visit, onOpen, t }) {
  const status = visitStatus(visit);
  const statusColor = STATUS_COLORS[status];
  const statusLabel = {
    overdue: t.statusOverdue,
    today: t.statusToday,
    upcoming: t.statusUpcoming,
    none: t.statusNone,
  }[status];
  const sectorLabel = t.sectors[visit.sector] || t.sectors.private;

  const stop = (fn) => (e) => {
    e.stopPropagation();
    fn();
  };

  return (
    <div
      className="w-full"
      style={{
        background: "#fff",
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
      <button
        onClick={() => onOpen(visit)}
        className={`btn-press w-full ${t.dir === "rtl" ? "text-right" : "text-left"}`}
        style={{
          padding: t.dir === "rtl" ? "14px 14px 14px 10px" : "14px 10px 14px 14px",
        }}
      >
        <div className="flex items-start justify-between gap-2">
          <div>
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
              <span>{visit.visitDate}</span>
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

export default function App() {
  const [authChecked, setAuthChecked] = useState(false);
  const [user, setUser] = useState(null);

  const [visits, setVisits] = useState([]);
  const [loaded, setLoaded] = useState(false);
  const [screen, setScreen] = useState("list"); // list | form | detail
  const [query, setQuery] = useState("");
  const [sectorFilter, setSectorFilter] = useState("all");
  const [form, setForm] = useState(emptyForm);
  const [activeId, setActiveId] = useState(null);
  const [errors, setErrors] = useState({});
  const [members, setMembers] = useState({});
  const [newMemberEmail, setNewMemberEmail] = useState("");
  const [newMemberRole, setNewMemberRole] = useState("viewer");
  const [ownerUid, setOwnerUid] = useState(null);
  const [myRole, setMyRole] = useState("owner");
  const [importing, setImporting] = useState(false);
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

  useEffect(() => {
    const unsub = onAuthStateChanged(auth, (u) => {
      setUser(u);
      setAuthChecked(true);
    });
    return () => unsub();
  }, []);

  useEffect(() => {
    if (!user) {
      setOwnerUid(null);
      setMyRole("owner");
      return;
    }
    const emailKey = (user.email || "").toLowerCase();
    const lookupRef = doc(db, "access_by_email", emailKey);
    getDoc(lookupRef)
      .then((snap) => {
        const owners = snap.exists() ? snap.data().owners || {} : {};
        const ownerIds = Object.keys(owners);
        if (ownerIds.length > 0) {
          setOwnerUid(ownerIds[0]);
          setMyRole(owners[ownerIds[0]]);
        } else {
          setOwnerUid(user.uid);
          setMyRole("owner");
        }
      })
      .catch(() => {
        setOwnerUid(user.uid);
        setMyRole("owner");
      });
  }, [user]);

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
        const next = snap.docs.map((d) => ({ id: d.id, ...d.data() }));
        setVisits(next);
        setLoaded(true);
      },
      () => setLoaded(true)
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
          updateDoc(doc(db, "users", ownerUid, "visits", v.id), { notified: true }).catch(() => {});
        }
      });
    }, 15000);
    return () => clearInterval(id);
  }, [visits, t, user, ownerUid]);

  const openNew = () => {
    setForm(emptyForm);
    setErrors({});
    setScreen("form");
  };

  const openEdit = (visit) => {
    setForm(visit);
    setErrors({});
    setScreen("form");
  };

  const openDetail = (visit) => {
    setActiveId(visit.id);
    setScreen("detail");
  };

  const validate = () => {
    const e = {};
    if (!form.companyName.trim()) e.companyName = t.companyError;
    if (!form.contactName.trim()) e.contactName = t.contactError;
    setErrors(e);
    return Object.keys(e).length === 0;
  };

  // Normalizes a phone number to its core digits, ignoring +2 / 0020 / leading 0 variations
  const corePhoneDigits = (phone) => {
    let d = (phone || "").replace(/[^0-9]/g, "");
    if (!d) return "";
    if (d.startsWith("00")) d = d.slice(2);
    if (d.startsWith("20") && d.length > 10) d = d.slice(2);
    if (d.startsWith("0")) d = d.slice(1);
    return d;
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

  const saveForm = async () => {
    if (!validate() || !user || !ownerUid) return;

    const duplicate = form.phone ? findDuplicatePhone(form.phone, form.id) : null;
    if (duplicate) {
      const proceed = window.confirm(t.duplicatePhoneWarning(duplicate.companyName));
      if (!proceed) return;
    }

    const { id, ...data } = form;
    try {
      let savedId = id;
      if (id) {
        await updateDoc(doc(db, "users", ownerUid, "visits", id), data);
      } else {
        const ref = await addDoc(collection(db, "users", ownerUid, "visits"), {
          ...data,
          createdAt: serverTimestamp(),
        });
        savedId = ref.id;
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
    if (!user || !ownerUid) return;
    const confirmMsg = lang === "ar"
      ? "هل أنت متأكد من حذف هذا العميل؟"
      : "Are you sure you want to delete this customer?";
    if (!window.confirm(confirmMsg)) return;
    try {
      await deleteDoc(doc(db, "users", ownerUid, "visits", id));
      await cancelCallReminder(id);
    } catch (e) {}
    setScreen("list");
  };

  const grantAccess = async (email, role) => {
    if (!user) return;
    const cleanEmail = email.trim().toLowerCase();
    if (!cleanEmail) return;
    const ref = doc(db, "access", user.uid);
    try {
      const snap = await getDoc(ref);
      const existing = snap.exists() ? snap.data().members || {} : {};
      await setDoc(ref, { members: { ...existing, [cleanEmail]: role } }, { merge: true });

      const lookupRef = doc(db, "access_by_email", cleanEmail);
      const lookupSnap = await getDoc(lookupRef);
      const existingOwners = lookupSnap.exists() ? lookupSnap.data().owners || {} : {};
      await setDoc(lookupRef, { owners: { ...existingOwners, [user.uid]: role } }, { merge: true });
    } catch (e) {}
  };

  const revokeAccess = async (email) => {
    if (!user) return;
    const cleanEmail = email.trim().toLowerCase();
    const ref = doc(db, "access", user.uid);
    try {
      const snap = await getDoc(ref);
      if (snap.exists()) {
        const existing = { ...(snap.data().members || {}) };
        delete existing[cleanEmail];
        await setDoc(ref, { members: existing }, { merge: false });
      }

      const lookupRef = doc(db, "access_by_email", cleanEmail);
      const lookupSnap = await getDoc(lookupRef);
      if (lookupSnap.exists()) {
        const existingOwners = { ...(lookupSnap.data().owners || {}) };
        delete existingOwners[user.uid];
        await setDoc(lookupRef, { owners: existingOwners }, { merge: false });
      }
    } catch (e) {}
  };

  const exportToExcel = () => {
    const rows = visits.map((v) => ({
      [t.companyLabel.replace(" *", "")]: v.companyName || "",
      [t.contactLabel.replace(" *", "")]: v.contactName || "",
      [t.sectorLabel]: t.sectors[v.sector] || v.sector || "",
      [t.roleLabel]: t.roles[v.role] || v.role || "",
      [t.phoneLabel]: v.phone || "",
      [t.emailLabel]: v.email || "",
      [t.visitDateLabel]: v.visitDate || "",
      [t.callDateLabel]: v.callDateTime || "",
      [t.notesLabel]: v.notes || "",
    }));
    const ws = XLSX.utils.json_to_sheet(rows);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, "Visits");
    XLSX.writeFile(wb, `pestco_visits_${new Date().toISOString().slice(0, 10)}.xlsx`);
  };

  const triggerImportPicker = () => {
    if (fileInputRef.current) fileInputRef.current.click();
  };

  const handleImportFile = async (e) => {
    const file = e.target.files && e.target.files[0];
    e.target.value = "";
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
          phone: String(getField(row, "phone") || "").trim(),
          email: String(getField(row, "email") || "").trim(),
          visitDate: normalizeExcelDate(getField(row, "visitDate")) || new Date().toISOString().slice(0, 10),
          notes: String(getField(row, "notes") || "").trim(),
          callDateTime,
          notified: false,
          createdAt: serverTimestamp(),
        };

        const ref = await addDoc(collection(db, "users", ownerUid, "visits"), visitData);
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
  const dueReminders = visits
    .filter((v) => v.callDateTime && new Date(v.callDateTime).getTime() <= now + 24 * 3600 * 1000)
    .sort((a, b) => new Date(a.callDateTime) - new Date(b.callDateTime));

  const filtered = visits
    .filter((v) => sectorFilter === "all" || v.sector === sectorFilter)
    .filter((v) => {
      const q = query.trim();
      if (!q) return true;
      return (
        v.companyName.includes(q) ||
        v.contactName.includes(q) ||
        (v.phone || "").includes(q) ||
        (v.notes || "").includes(q)
      );
    })
    .sort((a, b) => {
      const sa = visitStatus(a);
      const sb = visitStatus(b);
      const order = { overdue: 0, today: 1, upcoming: 2, none: 3 };
      if (order[sa] !== order[sb]) return order[sa] - order[sb];
      return (a.visitDate < b.visitDate ? 1 : -1);
    });

  if (!authChecked) {
    return (
      <div
        style={{
          minHeight: "100vh",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          background: BG,
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
        fontFamily: "'Tajawal', sans-serif",
        background: BG,
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
          background: #fff;
          border: 0.5px solid #D8D5C8;
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
        {screen !== "list" ? (
          <button
            onClick={() => setScreen("list")}
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
          {screen === "list" && t.appTitle}
          {screen === "form" && (form.id ? t.titleEdit : t.titleNew)}
          {screen === "detail" && t.titleDetail}
          {screen === "settings" && t.settingsTitle}
        </span>
        {screen === "list" && (
          <button
            onClick={() => setScreen("settings")}
            className="btn-press flex items-center"
            style={{ color: "#fff", background: "rgba(255,255,255,0.15)", borderRadius: 8, padding: "6px 8px" }}
            aria-label={t.settingsTitle}
          >
            <Settings size={14} />
          </button>
        )}
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

      {screen === "list" && (
        <div className="px-4 pt-4 pb-24">
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

          <div className="flex items-center gap-2 mb-4" style={{ overflowX: "auto" }}>
            {["all", ...SECTOR_IDS].map((id) => {
              const isActive = sectorFilter === id;
              const label = id === "all" ? t.sectorAll : t.sectors[id];
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
                    background: isActive ? PRIMARY : "#fff",
                    color: isActive ? "#fff" : MUTED,
                  }}
                >
                  {label}
                </button>
              );
            })}
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
            <VisitCard key={v.id} visit={v} onOpen={openDetail} t={t} />
          ))}

          <button
            onClick={openNew}
            className="btn-press flex items-center justify-center"
            style={{
              position: "fixed",
              bottom: 20,
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
        </div>
      )}

      {screen === "form" && (
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
          <div style={{ background: "#fff", borderRadius: 16, border: `1px solid ${LINE}`, padding: 16 }}>
            <div className="flex items-center justify-between mb-1">
              <span className="font-bold text-lg">{active.companyName}</span>
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
            <div className="flex items-center justify-between mb-4">
              <div className="flex items-center gap-1" style={{ color: MUTED }}>
                <User size={14} /> <span className="text-sm">{active.contactName}</span>
              </div>
              <span className="text-xs font-bold" style={{ color: GOLD }}>
                {t.sectors[active.sector] || t.sectors.private}
              </span>
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
                <span className="text-sm font-bold">{active.visitDate}</span>
              </div>
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
                <button
                  onClick={() => {
                    if (!user || !ownerUid) return;
                    updateDoc(doc(db, "users", ownerUid, "visits", active.id), {
                      callDateTime: "",
                      notified: false,
                    }).catch(() => {});
                    cancelCallReminder(active.id);
                  }}
                  className="btn-press text-xs font-bold"
                  style={{ color: PRIMARY_MID }}
                >
                  {t.callDone}
                </button>
              </div>
            )}

            {active.notes && (
              <div style={{ borderTop: `0.5px solid ${LINE}`, marginTop: 12, paddingTop: 12 }}>
                <span className="flex items-center gap-2 text-sm font-bold mb-1"><FileText size={15} /> {t.notesRow}</span>
                <p className="text-sm" style={{ color: MUTED, lineHeight: 1.7 }}>{active.notes}</p>
              </div>
            )}
          </div>

          <div className="flex gap-3 mt-4">
            <button
              onClick={() => openEdit(active)}
              className="btn-press flex-1 flex items-center justify-center gap-2 font-bold"
              style={{ background: "#fff", border: `1px solid ${PRIMARY_MID}`, color: PRIMARY_MID, borderRadius: 14, padding: "12px 0" }}
            >
              <Pencil size={16} /> {t.edit}
            </button>
            <button
              onClick={() => deleteVisit(active.id)}
              className="btn-press flex items-center justify-center gap-2 font-bold"
              style={{ background: "#fff", border: `1px solid ${DANGER}`, color: DANGER, borderRadius: 14, padding: "12px 20px" }}
            >
              <Trash2 size={16} /> {t.delete}
            </button>
          </div>
        </div>
      )}

      {screen === "settings" && (
        <div className="px-4 pt-4 pb-10">
          <div style={{ background: "#fff", borderRadius: 16, border: `1px solid ${LINE}`, padding: 16, marginBottom: 16 }}>
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

          <div style={{ background: "#fff", borderRadius: 16, border: `1px solid ${LINE}`, padding: 16, marginBottom: 16 }}>
            <p className="font-bold text-base mb-3" style={{ color: TEXT }}>{t.excelTitle}</p>

            <button
              onClick={exportToExcel}
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
              <Download size={16} /> {t.exportBtn}
            </button>

            <button
              onClick={triggerImportPicker}
              disabled={importing}
              className="btn-press flex items-center justify-center gap-2 font-bold"
              style={{
                background: "#fff",
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

          <div style={{ background: "#fff", borderRadius: 16, border: `1px solid ${LINE}`, padding: 16 }}>
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
          </div>
        </div>
      )}
    </div>
  );
}
