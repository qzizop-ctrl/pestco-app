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

// reason: true ("no access / not registered") | "unverified"
export function rememberSignOutReason(reason) {
  if (!reason) return;
  try {
    sessionStorage.setItem(KEY, reason === true ? "1" : String(reason));
  } catch {
    // sessionStorage may be unavailable — the message is just not shown.
  }
}

// Returns the remembered reason (true | "unverified") or false, and forgets it.
export function consumeSignOutReason() {
  try {
    const raw = sessionStorage.getItem(KEY);
    if (raw === null) return false;
    sessionStorage.removeItem(KEY);
    return raw === "1" ? true : raw;
  } catch {
    return false;
  }
}
