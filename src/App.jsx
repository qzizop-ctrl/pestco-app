import React, { useState, useEffect } from "react";
import {
  Search, Plus, X, Trash2, Phone, Mail, Calendar,
  FileText, Building2, User, Pencil, ChevronRight, ShieldCheck, Bell, Languages, LogOut, Settings,
} from "lucide-react";
import { onAuthStateChanged, signOut } from "firebase/auth";
import {
  collection, doc, onSnapshot, addDoc, updateDoc, deleteDoc, serverTimestamp,
  getDoc, setDoc, writeBatch,
} from "firebase/firestore";
import * as XLSX from "xlsx";
import { auth, db } from "./firebase";
import AuthScreen from "./AuthScreen";
import {
  requestNotificationPermission, scheduleCallReminder, cancelCallReminder,
} from "./notifications";

/* ---------------------------------------------------------
   الإعدادات الثابتة / Constants
--------------------------------------------------------- */
const PRIMARY = "#0F5132";
const BG = "#F7F6F2";
const TEXT = "#22282B";
const MUTED = "#6B7168";
const DANGER = "#B3401F";

/* ---------------------------------------------------------
   الترجمة / Translations
--------------------------------------------------------- */
const STRINGS = {
  ar: {
    dir: "rtl",
    locale: "ar-EG",
    appTitle: "Pest.Co — زيارات العملاء",
    titleEdit: "تعديل الزيارة",
    titleNew: "زيارة جديدة",
    titleDetail: "تفاصيل الزيارة",
    back: "رجوع",
    langToggle: "English",
    dueCalls: (n) => `عندك ${n} مكالمة مستحقة`,
    searchPlaceholder: "ابحث بالشركة أو المسؤول أو الرقم أو الملاحظات",
    loading: "جارِ التحميل...",
    noVisits: "لا توجد زيارات بعد",
    noVisitsHint: 'اضغط على "زيارة جديدة" لإضافة أول عميل',
    newVisit: "زيارة جديدة",
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
    save: "حفظ الزيارة",
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
      construction: "شركات المقاولات",
      education: "قطاع التعليم",
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
    exportExcel: "تصدير إلى Excel",
    importExcel: "استيراد من Excel",
    importEmptyFile: "الملف فاضي",
    importSuccess: (n) => `تم استيراد ${n} عميل بنجاح`,
    importError: "خطأ في الاستيراد: ",
  },
  en: {
    dir: "ltr",
    locale: "en-US",
    appTitle: "Pest.Co — Client Visits",
    titleEdit: "Edit Visit",
    titleNew: "New Visit",
    titleDetail: "Visit Details",
    back: "Back",
    langToggle: "عربي",
    dueCalls: (n) => `You have ${n} call${n === 1 ? "" : "s"} due`,
    searchPlaceholder: "Search by company, contact, phone or notes",
    loading: "Loading...",
    noVisits: "No visits yet",
    noVisitsHint: 'Tap "New Visit" to add your first client',
    newVisit: "New Visit",
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
    save: "Save Visit",
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
      construction: "Construction Companies",
      education: "Education",
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
    exportExcel: "Export to Excel",
    importExcel: "Import from Excel",
    importEmptyFile: "File is empty",
    importSuccess: (n) => `Successfully imported ${n} clients`,
    importError: "Import error: ",
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

const SECTOR_IDS = ["construction", "education", "private"];
const SECTOR_COLORS = {
  construction: "#8C5A2C",
  education: "#2C6E8C",
  private: "#6B4C8C",
};

const sectorColor = (id) => SECTOR_COLORS[id] || SECTOR_COLORS.private;

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

/* ---------------------------------------------------------
   نغمة تنبيه بسيطة (تعمل لما التطبيق مفتوح فقط في هذه المعاينة)
   Simple alert tone (only works while the app is open in this preview)
--------------------------------------------------------- */
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

/* ---------------------------------------------------------
   شعار التطبيق / App logo
--------------------------------------------------------- */
function Logo({ size = 36 }) {
  return (
    <div
      className="flex items-center justify-center"
      style={{ width: size, height: size, background: PRIMARY, borderRadius: 10 }}
    >
      <ShieldCheck size={size * 0.6} color="#F7F6F2" />
    </div>
  );
}

/* ---------------------------------------------------------
   بطاقة الزيارة / Visit card
--------------------------------------------------------- */
function VisitCard({ visit, onOpen, t }) {
  const roleC = roleColor(visit.role);
  const sectorC = sectorColor(visit.sector);
  const roleLabel = t.roles[visit.role] || t.roles.other;
  const sectorLabel = t.sectors[visit.sector] || t.sectors.private;
  return (
    <button
      onClick={() => onOpen(visit)}
      className={`btn-press w-full flex items-stretch ${t.dir === "rtl" ? "text-right" : "text-left"}`}
      style={{
        background: "#fff",
        borderRadius: 12,
        border: "0.5px solid #E1DFD5",
        overflow: "hidden",
        marginBottom: 10,
      }}
    >
      <div style={{ width: 6, background: sectorC, flexShrink: 0 }} />
      <div className="flex-1 px-4 py-3">
        <div className="flex items-center justify-between">
          <span className="font-bold text-base" style={{ color: TEXT }}>
            {visit.companyName || t.noCompanyName}
          </span>
          <span
            className="text-xs font-bold px-2 py-0.5 rounded-full"
            style={{ background: roleC + "1A", color: roleC }}
          >
            {roleLabel}
          </span>
        </div>
        <div className="flex items-center justify-between mt-1">
          <div className="flex items-center gap-1" style={{ color: MUTED }}>
            <User size={13} />
            <span className="text-sm">{visit.contactName || t.noContactName}</span>
          </div>
          <span className="text-xs font-bold" style={{ color: sectorC }}>
            {sectorLabel}
          </span>
        </div>
        <div className="flex items-center justify-between mt-2">
          <div className="flex items-center gap-1" style={{ color: MUTED }}>
            <Calendar size={13} />
            <span className="text-xs">{visit.visitDate}</span>
          </div>
          <ChevronRight size={16} color={MUTED} style={{ transform: t.dir === "rtl" ? "rotate(180deg)" : "none" }} />
        </div>
      </div>
    </button>
  );
}

/* ---------------------------------------------------------
   التطبيق الرئيسي / Main app
--------------------------------------------------------- */
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

  // مراقبة حالة تسجيل الدخول / Watch auth state
  useEffect(() => {
    const unsub = onAuthStateChanged(auth, (u) => {
      setUser(u);
      setAuthChecked(true);
    });
    return () => unsub();
  }, []);

  // تحديد صاحب البيانات التي أشاهدها / Resolve which owner's data to view
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

  // تحميل قائمة الأشخاص المسموح لهم بالوصول / Load access members
  useEffect(() => {
    if (!user) return;
    const ref = doc(db, "access", user.uid);
    const unsub = onSnapshot(ref, (snap) => {
      setMembers(snap.exists() ? snap.data().members || {} : {});
    });
    return () => unsub();
  }, [user]);

  // حفظ اللغة محليًا (تفضيل جهاز، مش جزء من بيانات العميل) / Persist language locally
  useEffect(() => {
    try {
      localStorage.setItem("pestco_lang", lang);
    } catch (e) {
      /* التخزين المحلي غير متاح / local storage unavailable */
    }
  }, [lang]);

  // مزامنة زيارات المستخدم الحالي من Firestore لحظيًا / Live-sync current user's visits from Firestore
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
    } catch (e) {
      /* الإشعارات غير مدعومة / notifications unsupported */
    }
    requestNotificationPermission();
  }, []);

  // فحص دوري لمواعيد الاتصال المستحقة (يعمل فقط طالما التطبيق مفتوح في هذه المعاينة)
  // Periodic check for due calls (only works while the app is open in this preview)
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

  const saveForm = async () => {
    if (!validate() || !user || !ownerUid) return;
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
    } catch (e) {
      /* تجاهل خطأ الحفظ المؤقت / ignore transient save error */
    }
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
    } catch (e) {
      /* تجاهل خطأ الحذف المؤقت / ignore transient delete error */
    }
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
    } catch (e) {
      /* تجاهل خطأ مؤقت */
    }
  };

  const revoke = async (email) => {
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
    } catch (e) {
      /* تجاهل خطأ مؤقت */
    }
  };

  const exportToExcel = () => {
    const rows = visits.map((v) => ({
      [t.companyLabel]: v.companyName || "",
      [t.contactLabel]: v.contactName || "",
      [t.sectorLabel]: t.sectors[v.sector] || "",
      [t.roleLabel]: t.roles[v.role] || "",
      [t.phoneLabel]: v.phone || "",
      [t.emailLabel]: v.email || "",
      [t.visitDateLabel]: v.visitDate || "",
      [t.callDateLabel]: v.callDateTime || "",
      [t.notesLabel]: v.notes || "",
    }));
    const worksheet = XLSX.utils.json_to_sheet(rows);
    const workbook = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(workbook, worksheet, "Visits");
    const dateStr = new Date().toISOString().slice(0, 10);
    XLSX.writeFile(workbook, `visits_${dateStr}.xlsx`);
  };

  const importFromExcel = async (file) => {
    if (!file || !user || !ownerUid) return;
    try {
      const data = await file.arrayBuffer();
      const workbook = XLSX.read(data);
      const sheetName = workbook.SheetNames[0];
      const sheet = workbook.Sheets[sheetName];
      const rows = XLSX.utils.sheet_to_json(sheet);

      if (rows.length === 0) {
        alert(t.importEmptyFile);
        return;
      }

      const sectorRev = Object.fromEntries(SECTOR_IDS.map((id) => [t.sectors[id], id]));
      const roleRev = Object.fromEntries(ROLE_IDS.map((id) => [t.roles[id], id]));
      const visitsRef = collection(db, "users", ownerUid, "visits");

      let batch = writeBatch(db);
      let batchCount = 0;
      let successCount = 0;

      for (const row of rows) {
        const companyName = row[t.companyLabel] || "";
        const contactName = row[t.contactLabel] || "";
        if (!String(companyName).trim() && !String(contactName).trim()) continue;

        const newVisit = {
          companyName: String(companyName),
          contactName: String(contactName),
          sector: sectorRev[row[t.sectorLabel]] || "construction",
          role: roleRev[row[t.roleLabel]] || "purchasing",
          phone: String(row[t.phoneLabel] || ""),
          email: String(row[t.emailLabel] || ""),
          visitDate: String(row[t.visitDateLabel] || new Date().toISOString().slice(0, 10)),
          callDateTime: String(row[t.callDateLabel] || ""),
          notes: String(row[t.notesLabel] || ""),
          notified: false,
          createdAt: serverTimestamp(),
        };

        const newDocRef = doc(visitsRef);
        batch.set(newDocRef, newVisit);
        batchCount++;
        successCount++;

        if (batchCount === 450) {
          await batch.commit();
          batch = writeBatch(db);
          batchCount = 0;
        }
      }

      if (batchCount > 0) {
        await batch.commit();
      }

      alert(t.importSuccess(successCount));
    } catch (e) {
      alert(t.importError + e.message);
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
        (v.companyName || "").includes(q) ||
        (v.contactName || "").includes(q) ||
        (v.phone || "").includes(q) ||
        (v.notes || "").includes(q)
      );
    })
    .sort((a, b) => (a.visitDate < b.visitDate ? 1 : -1));

  // في انتظار معرفة حالة تسجيل الدخول / Waiting to know auth state
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

  // مفيش مستخدم مسجل دخول / No signed-in user
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
          border-color: ${PRIMARY};
        }
        label { font-size: 13px; font-weight: 700; color: ${MUTED}; display:block; margin-bottom:4px; }
        button:focus-visible { outline: 2px solid ${PRIMARY}; outline-offset: 2px; }
      `}</style>

      {/* الشريط العلوي الثابت / Sticky top bar */}
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

      {/* شاشة القائمة / List screen */}
      {screen === "list" && (
        <div className="px-4 pt-4 pb-24">
          {dueReminders.length > 0 && (
            <div
              style={{ background: "#FCEBEB", border: "0.5px solid #F09999", borderRadius: 12, padding: 12, marginBottom: 14 }}
            >
              <div className="flex items-center gap-2 mb-2">
                <Bell size={16} color={DANGER} />
                <span className="text-sm font-bold" style={{ color: DANGER }}>
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
              style={{ [t.dir === "rtl" ? "paddingRight" : "paddingLeft"]: 34 }}
            />
          </div>

          <div className="flex items-center gap-2 mb-4" style={{ overflowX: "auto" }}>
            {["all", ...SECTOR_IDS].map((id) => {
              const isActive = sectorFilter === id;
              const label = id === "all" ? t.sectorAll : t.sectors[id];
              const c = id === "all" ? PRIMARY : sectorColor(id);
              return (
                <button
                  key={id}
                  onClick={() => setSectorFilter(id)}
                  className="btn-press font-bold text-xs"
                  style={{
                    flexShrink: 0,
                    padding: "7px 14px",
                    borderRadius: 999,
                    border: `1px solid ${c}`,
                    background: isActive ? c : "#fff",
                    color: isActive ? "#fff" : c,
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

          {myRole !== "viewer" && (
            <button
              onClick={openNew}
              className="btn-press flex items-center justify-center gap-2 font-bold"
              style={{
                position: "fixed",
                bottom: 20,
                left: 20,
                right: 20,
                maxWidth: 380,
                margin: "0 auto",
                background: PRIMARY,
                color: "#fff",
                borderRadius: 12,
                padding: "14px 0",
                boxShadow: "0 4px 14px rgba(15,81,50,0.35)",
              }}
            >
              <Plus size={20} /> {t.newVisit}
            </button>
          )}
        </div>
      )}

      {/* شاشة الإضافة / التعديل / Add-edit screen */}
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
            style={{ background: PRIMARY, color: "#fff", borderRadius: 10, padding: "12px 0", marginTop: 8 }}
          >
            {t.save}
          </button>
        </div>
      )}

      {/* شاشة التفاصيل / Detail screen */}
      {screen === "detail" && active && (
        <div className="px-4 pt-4 pb-10">
          <div style={{ background: "#fff", borderRadius: 12, border: "0.5px solid #E1DFD5", padding: 16 }}>
            <div className="flex items-center justify-between mb-1">
              <span className="font-bold text-lg">{active.companyName}</span>
              <span
                className="text-xs font-bold px-2 py-0.5 rounded-full"
                style={{ background: roleColor(active.role) + "1A", color: roleColor(active.role) }}
              >
                {t.roles[active.role] || t.roles.other}
              </span>
            </div>
            <div className="flex items-center justify-between mb-4">
              <div className="flex items-center gap-1" style={{ color: MUTED }}>
                <User size={14} /> <span className="text-sm">{active.contactName}</span>
              </div>
              <span className="text-xs font-bold" style={{ color: sectorColor(active.sector) }}>
                {t.sectors[active.sector] || t.sectors.private}
              </span>
            </div>

            <div className="flex flex-col gap-3" style={{ borderTop: "0.5px solid #EEE", paddingTop: 12 }}>
              <a
                href={active.phone ? `tel:${active.phone}` : undefined}
                className="flex items-center justify-between"
                style={{ color: active.phone ? TEXT : "#C7C4B6", textDecoration: "none" }}
              >
                <span className="flex items-center gap-2 text-sm"><Phone size={15} /> {t.phoneRow}</span>
                <span className="text-sm font-bold">{active.phone || "—"}</span>
              </a>
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
                style={{ background: active.notified ? "#F2F1EA" : "#FCEBEB", borderRadius: 10, padding: 10 }}
              >
                <span className="flex items-center gap-2 text-sm font-bold" style={{ color: active.notified ? MUTED : DANGER }}>
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
                  style={{ color: PRIMARY }}
                >
                  {t.callDone}
                </button>
              </div>
            )}

            {active.notes && (
              <div style={{ borderTop: "0.5px solid #EEE", marginTop: 12, paddingTop: 12 }}>
                <span className="flex items-center gap-2 text-sm font-bold mb-1"><FileText size={15} /> {t.notesRow}</span>
                <p className="text-sm" style={{ color: MUTED, lineHeight: 1.7 }}>{active.notes}</p>
              </div>
            )}
          </div>

          {myRole !== "viewer" && (
            <div className="flex gap-3 mt-4">
              <button
                onClick={() => openEdit(active)}
                className="btn-press flex-1 flex items-center justify-center gap-2 font-bold"
                style={{ background: "#fff", border: `1px solid ${PRIMARY}`, color: PRIMARY, borderRadius: 10, padding: "12px 0" }}
              >
                <Pencil size={16} /> {t.edit}
              </button>
              <button
                onClick={() => deleteVisit(active.id)}
                className="btn-press flex items-center justify-center gap-2 font-bold"
                style={{ background: "#fff", border: `1px solid ${DANGER}`, color: DANGER, borderRadius: 10, padding: "12px 20px" }}
              >
                <Trash2 size={16} /> {t.delete}
              </button>
            </div>
          )}
        </div>
      )}

      {/* شاشة الإعدادات / Settings screen */}
      {screen === "settings" && (
        <div className="px-4 pt-4 pb-10">
          <button
            onClick={exportToExcel}
            className="btn-press flex items-center justify-center gap-2 font-bold"
            style={{
              background: PRIMARY,
              color: "#fff",
              borderRadius: 10,
              padding: "12px 0",
              width: "100%",
              marginBottom: 10,
            }}
          >
            <FileText size={16} /> {t.exportExcel}
          </button>

          <input
            type="file"
            id="excelImportInput"
            accept=".xlsx,.xls"
            style={{ display: "none" }}
            onChange={(e) => {
              if (e.target.files[0]) {
                importFromExcel(e.target.files[0]);
                e.target.value = "";
              }
            }}
          />
          <button
            onClick={() => document.getElementById("excelImportInput").click()}
            className="btn-press flex items-center justify-center gap-2 font-bold"
            style={{
              background: "#fff",
              border: `1px solid ${PRIMARY}`,
              color: PRIMARY,
              borderRadius: 10,
              padding: "12px 0",
              width: "100%",
              marginBottom: 16,
            }}
          >
            <FileText size={16} /> {t.importExcel}
          </button>

          <div style={{ background: "#fff", borderRadius: 12, border: "0.5px solid #E1DFD5", padding: 16, marginBottom: 16 }}>
            <p className="font-bold text-base mb-1" style={{ color: TEXT }}>{t.manageAccess}</p>
            <p className="text-xs mb-3" style={{ color: MUTED }}>{t.membersTitle}</p>

            {Object.keys(members).length === 0 && (
              <p className="text-sm text-center py-4" style={{ color: MUTED }}>{t.noMembers}</p>
            )}

            {Object.entries(members).map(([email, role]) => (
              <div
                key={email}
                className="flex items-center justify-between"
                style={{ padding: "8px 0", borderBottom: "0.5px solid #EEE" }}
              >
                <div>
                  <p className="text-sm font-bold" style={{ color: TEXT }}>{email}</p>
                  <p className="text-xs" style={{ color: MUTED }}>{role === "editor" ? t.roleEditor : t.roleViewer}</p>
                </div>
                <button
                  onClick={() => {
                    if (window.confirm(t.removeConfirm)) revoke(email);
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

          <div style={{ background: "#fff", borderRadius: 12, border: "0.5px solid #E1DFD5", padding: 16 }}>
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
              style={{ background: PRIMARY, color: "#fff", borderRadius: 10, padding: "12px 0", marginTop: 12, width: "100%" }}
            >
              {t.addMemberBtn}
            </button>
          </div>
        </div>
      )}
    </div>
  );
      }
