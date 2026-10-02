// ============================================================================
// Opens a customer/supplier's WhatsApp chat, preferring WhatsApp Business on
// Android.
//
// A WebView (which is all a Capacitor app's UI really is) has no way to pick
// one specific app to handle a link — that's only possible through a real
// Android Intent with setPackage(), which requires native code. This calls
// into WhatsAppPlugin.java (committed under android/app/src/main/java, next
// to StorageAccessPlugin.java — see nativeFileSave.js), which
// opens WhatsApp Business directly if it's installed, falling back to
// regular WhatsApp, then to the OS's own app-picker.
//
// Web, iOS, and the Windows/Electron build have no such native layer, so
// they always just use the plain wa.me link.
// ============================================================================

import { Capacitor, registerPlugin } from "@capacitor/core";

const WhatsApp = registerPlugin("WhatsApp");

export async function openWhatsApp(phone) {
  const digits = (phone || "").replace(/\D/g, "");
  if (!digits) return;

  if (Capacitor.getPlatform() === "android") {
    try {
      await WhatsApp.open({ phone: digits });
      return;
    } catch {
      // Falls through to the wa.me link below.
    }
  }

  openInNewTab(`https://wa.me/${digits}`);
}

// Opens `url` OUTSIDE the app. This used to be `window.location.href = url`,
// which replaces the app itself with the external page: in the Windows
// (Electron) build there is no back button, so the window was stuck on
// wa.me, and on the web/PWA every unsaved form state was lost. A
// programmatic <a target="_blank"> click is used instead of window.open():
// with "noopener" window.open() always returns null, so a blocked popup
// can't be detected, whereas a click made during the user's tap works
// everywhere. Electron routes it to the system browser (see electron.js,
// setWindowOpenHandler); Capacitor hands it to the OS.
function openInNewTab(url) {
  const a = document.createElement("a");
  a.href = url;
  a.target = "_blank";
  a.rel = "noopener noreferrer";
  a.style.display = "none";
  document.body.appendChild(a);
  a.click();
  a.remove();
}
