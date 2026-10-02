// ============================================================================
// Remembers WHY the app signed the user out across the page reload that
// signOutAndClearLocalData() (firebase.js) performs.
//
// When access is revoked (or an account turns out to have none) the app now
// wipes the device's local Firestore cache and reloads the page. React state
// does not survive a reload, so the "your email is not registered / not
// verified" message AuthScreen shows would be lost and the person would just
// see a bare login form. sessionStorage carries the reason over the reload;
// it is read once, at startup, and removed immediately.
//
// Kept free of Firebase imports so it can be used (and mocked) anywhere.
// ============================================================================

const KEY = "pestco_signout_reason";
const NO_ACCESS = "no-access";

// reason: true ("no access / not registered") | "unverified"
export function rememberSignOutReason(reason) {
  if (!reason) return;
  try {
    sessionStorage.setItem(KEY, reason === true ? NO_ACCESS : String(reason));
  } catch {
    // sessionStorage may be unavailable — the message is just not shown.
  }
}

// Returns the remembered reason as a string — "no-access" | "unverified" —
// or "" when there is none (falsy, so `if (reason)` still works), and
// forgets it. Always a string so callers get one consistent type.
export function consumeSignOutReason() {
  try {
    const raw = sessionStorage.getItem(KEY);
    if (raw === null) return "";
    sessionStorage.removeItem(KEY);
    // "1" is what older builds stored for the "no access" case.
    return raw === "1" ? NO_ACCESS : raw;
  } catch {
    return "";
  }
}
