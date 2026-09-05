import React, { useState } from "react";
import {
  createUserWithEmailAndPassword,
  signInWithEmailAndPassword,
  sendPasswordResetEmail,
} from "firebase/auth";
import { Shield, Languages } from "lucide-react";
import { auth } from "./firebase";
import { PRIMARY } from "./constants";

const BG = "#F7F6F2";
const TEXT = "#22282B";
const MUTED = "#6B7168";
const DANGER = "#B3401F";

const STRINGS = {
  ar: {
    dir: "rtl",
    appTitle: "Pest.Co",
    subtitle: "زيارات العملاء",
    langToggle: "English",
    loginTab: "تسجيل الدخول",
    registerTab: "حساب جديد",
    emailLabel: "البريد الإلكتروني",
    passwordLabel: "كلمة السر (٦ أحرف على الأقل)",
    loginBtn: "دخول",
    registerBtn: "إنشاء حساب",
    forgotPassword: "نسيت كلمة السر؟",
    resetSent: "تم إرسال لينك استرجاع كلمة السر على بريدك",
    resetTitle: "استرجاع كلمة السر",
    sendReset: "إرسال لينك الاسترجاع",
    backToLogin: "رجوع لتسجيل الدخول",
    errors: {
      "auth/invalid-email": "البريد الإلكتروني غير صحيح",
      "auth/user-not-found": "لا يوجد حساب بهذا البريد",
      "auth/wrong-password": "كلمة السر غير صحيحة",
      "auth/email-already-in-use": "البريد الإلكتروني مستخدم بالفعل",
      "auth/weak-password": "كلمة السر ضعيفة، استخدم ٦ أحرف على الأقل",
      "auth/invalid-credential": "البريد الإلكتروني أو كلمة السر غير صحيحة",
      "auth/too-many-requests": "محاولات كتيرة، حاول تاني بعد شوية",
      "auth/network-request-failed": "تأكد من الاتصال بالإنترنت",
      "auth/api-key-not-valid.-please-pass-a-valid-api-key.": "لسه محطوطش إعدادات Firebase الصحيحة في src/firebase.js",
      default: "حصل خطأ، حاول تاني",
    },
  },
  en: {
    dir: "ltr",
    appTitle: "Pest.Co",
    subtitle: "Client Visits",
    langToggle: "عربي",
    loginTab: "Sign In",
    registerTab: "Create Account",
    emailLabel: "Email",
    passwordLabel: "Password (min 6 characters)",
    loginBtn: "Sign In",
    registerBtn: "Create Account",
    forgotPassword: "Forgot password?",
    resetSent: "Password reset link sent to your email",
    resetTitle: "Reset Password",
    sendReset: "Send Reset Link",
    backToLogin: "Back to Sign In",
    errors: {
      "auth/invalid-email": "Invalid email address",
      "auth/user-not-found": "No account found with this email",
      "auth/wrong-password": "Incorrect password",
      "auth/email-already-in-use": "Email already in use",
      "auth/weak-password": "Password is too weak, use at least 6 characters",
      "auth/invalid-credential": "Incorrect email or password",
      "auth/too-many-requests": "Too many attempts, try again later",
      "auth/network-request-failed": "Check your internet connection",
      "auth/api-key-not-valid.-please-pass-a-valid-api-key.": "Firebase config in src/firebase.js hasn't been set up yet",
      default: "Something went wrong, please try again",
    },
  },
};

export default function AuthScreen({ lang, setLang }) {
  const t = STRINGS[lang];
  const [mode, setMode] = useState("login"); // login | register | reset
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [info, setInfo] = useState("");
  const [busy, setBusy] = useState(false);

  const errMsg = (code) => t.errors[code] || t.errors.default;

  const switchMode = (next) => {
    setMode(next);
    setError("");
    setInfo("");
  };

  const submit = async (e) => {
    e.preventDefault();
    setError("");
    setInfo("");
    setBusy(true);
    try {
      if (mode === "login") {
        await signInWithEmailAndPassword(auth, email.trim(), password);
      } else if (mode === "register") {
        await createUserWithEmailAndPassword(auth, email.trim(), password);
      } else if (mode === "reset") {
        await sendPasswordResetEmail(auth, email.trim());
        setInfo(t.resetSent);
      }
    } catch (err) {
      setError(errMsg(err.code));
    } finally {
      setBusy(false);
    }
  };

  return (
    <div
      style={{
        minHeight: "100vh",
        background: BG,
        direction: t.dir,
        fontFamily: "'Tajawal', sans-serif",
        display: "flex",
        flexDirection: "column",
      }}
    >
      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=Tajawal:wght@400;500;700;900&display=swap');
        .auth-input {
          font-family: 'Tajawal', sans-serif;
          width: 100%;
          background: #fff;
          border: 0.5px solid #D8D5C8;
          border-radius: 10px;
          padding: 12px 14px;
          font-size: 14px;
          color: ${TEXT};
          box-sizing: border-box;
        }
        .auth-input:focus { outline: none; border-color: ${PRIMARY}; }
        .btn-press:active { transform: scale(0.98); }
      `}</style>

      <div style={{ display: "flex", justifyContent: "flex-end", padding: 16 }}>
        <button
          onClick={() => setLang(lang === "ar" ? "en" : "ar")}
          className="btn-press flex items-center gap-1 font-bold text-xs"
          style={{
            color: PRIMARY,
            background: "#fff",
            border: `1px solid ${PRIMARY}`,
            borderRadius: 8,
            padding: "6px 10px",
          }}
        >
          <Languages size={14} /> {t.langToggle}
        </button>
      </div>

      <div
        style={{
          flex: 1,
          display: "flex",
          flexDirection: "column",
          justifyContent: "center",
          padding: 24,
          maxWidth: 380,
          margin: "0 auto",
          width: "100%",
          boxSizing: "border-box",
        }}
      >
        <div style={{ textAlign: "center", marginBottom: 24 }}>
          <div
            style={{
              width: 56,
              height: 56,
              background: PRIMARY,
              borderRadius: 14,
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              margin: "0 auto 12px",
            }}
          >
            <Shield size={32} color="#fff" />
          </div>
          <div style={{ fontWeight: 900, fontSize: 22, color: TEXT }}>{t.appTitle}</div>
          <div style={{ color: MUTED, fontSize: 13 }}>{t.subtitle}</div>
        </div>

        {mode !== "reset" && (
          <div
            style={{
              display: "flex",
              gap: 8,
              marginBottom: 18,
              background: "#EFEDE3",
              borderRadius: 10,
              padding: 4,
            }}
          >
            <button
              onClick={() => switchMode("login")}
              className="btn-press font-bold text-sm"
              style={{
                flex: 1,
                padding: "8px 0",
                borderRadius: 8,
                background: mode === "login" ? "#fff" : "transparent",
                color: mode === "login" ? PRIMARY : MUTED,
              }}
            >
              {t.loginTab}
            </button>
            <button
              onClick={() => switchMode("register")}
              className="btn-press font-bold text-sm"
              style={{
                flex: 1,
                padding: "8px 0",
                borderRadius: 8,
                background: mode === "register" ? "#fff" : "transparent",
                color: mode === "register" ? PRIMARY : MUTED,
              }}
            >
              {t.registerTab}
            </button>
          </div>
        )}

        {mode === "reset" && (
          <div style={{ fontWeight: 700, fontSize: 16, color: TEXT, marginBottom: 14, textAlign: "center" }}>
            {t.resetTitle}
          </div>
        )}

        <form onSubmit={submit} style={{ display: "flex", flexDirection: "column", gap: 12 }}>
          <input
            className="auth-input"
            type="email"
            required
            placeholder={t.emailLabel}
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            autoComplete="email"
          />
          {mode !== "reset" && (
            <input
              className="auth-input"
              type="password"
              required
              minLength={6}
              placeholder={t.passwordLabel}
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              autoComplete={mode === "login" ? "current-password" : "new-password"}
            />
          )}

          {error && <p style={{ color: DANGER, fontSize: 13, fontWeight: 700, margin: 0 }}>{error}</p>}
          {info && <p style={{ color: PRIMARY, fontSize: 13, fontWeight: 700, margin: 0 }}>{info}</p>}

          <button
            type="submit"
            disabled={busy}
            className="btn-press font-bold"
            style={{
              background: PRIMARY,
              color: "#fff",
              borderRadius: 10,
              padding: "12px 0",
              opacity: busy ? 0.7 : 1,
              border: "none",
            }}
          >
            {mode === "login" ? t.loginBtn : mode === "register" ? t.registerBtn : t.sendReset}
          </button>

          {mode === "login" && (
            <button
              type="button"
              onClick={() => switchMode("reset")}
              className="btn-press text-xs font-bold"
              style={{ color: MUTED, textAlign: "center", background: "none", border: "none" }}
            >
              {t.forgotPassword}
            </button>
          )}
          {mode === "reset" && (
            <button
              type="button"
              onClick={() => switchMode("login")}
              className="btn-press text-xs font-bold"
              style={{ color: MUTED, textAlign: "center", background: "none", border: "none" }}
            >
              {t.backToLogin}
            </button>
          )}
        </form>
      </div>
    </div>
  );
}
