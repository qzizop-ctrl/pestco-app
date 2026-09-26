import { useState, useEffect } from "react";
import { doc, onSnapshot } from "firebase/firestore";
import { db } from "../firebase";
import { resolvePrimaryAdminEmail } from "../adminPermissions";

// Subscribes to config/admins and exposes the reviewer email list plus the
// primary admin email. Split out of useWorkspace.js (which used to hold the
// whole "read side" of workspace/access in one file) — this piece has no
// dependency on anything else in that hook besides `user`, so it stands on
// its own.
export function useAdminConfig(user) {
  // Mirrors firestore.rules' isReviewer() — replaces the old hardcoded
  // REVIEWER_EMAIL. null means "not loaded yet"; every permission decision
  // downstream waits for this instead of assuming an empty/no-admin state,
  // since treating "not loaded" as "no admins" would incorrectly sign the
  // real admin back out on every fresh app open before this listener resolves.
  const [adminEmails, setAdminEmails] = useState(null);
  // The primary admin used to be inferred as "whichever email happens to
  // sit first in the emails array" — fragile, since array order depends on
  // exactly how/when the config/admins doc was hand-edited in the Firebase
  // console, and a wrong guess here means the wrong account gets treated as
  // primary (this caused a real bug: a newly added admin ended up seeing
  // the actual primary's email). Now it's read from an explicit
  // `primaryEmail` field on the same document, set by hand once in the
  // console — no more guessing from position. `emails[0]` is kept only as
  // a fallback for a doc that hasn't been migrated to have the field yet.
  const [primaryAdminEmail, setPrimaryAdminEmail] = useState(null);

  useEffect(() => {
    // This must be re-subscribed whenever `user` changes (not just once on
    // mount). A Firestore onSnapshot listener that gets permission-denied
    // is torn down for good — it does not silently retry once auth state
    // later becomes valid. Previously this ran once with an empty
    // dependency array, so it could open *before* sign-in resolved (no
    // request.auth yet), get permission-denied per the rules (correctly,
    // for that unauthenticated moment), and then just sit dead: never
    // re-subscribing after a real, valid sign-in happened moments later.
    // From then on adminEmails was permanently stuck at [] for the rest of
    // the session, which made every admin account look unauthorized and
    // get signed back out — even though the rules and the config/admins
    // document were both completely correct. Keying this off `user` (and
    // skipping entirely while signed out) means a fresh, authenticated
    // subscription is made right after every sign-in.
    if (!user) {
      setAdminEmails(null);
      setPrimaryAdminEmail(null);
      return;
    }
    // Waiting unconditionally for the server-confirmed (non-cache) snapshot
    // below is what the comment on it says: it stops a stale cached read
    // from signing a legitimate admin back out. But "wait unconditionally"
    // has no upper bound — if the very first Firestore round trip after a
    // cold app start on Android stalls (a slow-to-establish Watch stream,
    // a flaky connection at that exact moment), this listener sits with
    // adminEmails stuck at null forever. That cascades: the permission
    // effect in useAccessResolution.js refuses to proceed while
    // adminEmails === null, so ownerUid never resolves, permissionLoading
    // never turns false, and the whole app is left sitting on its loading
    // skeletons indefinitely — reported as the app never finishing loading
    // except right after clearing app storage (which, being a truly empty
    // cache, happens not to hit whatever is slow/stuck about that server
    // round trip). staleFallbackTimer gives the server a bounded window
    // (8s) to confirm before falling back to the cached read just to
    // unblock the UI; a real confirmed snapshot, whenever it does arrive,
    // always overrides that fallback below, so the original stale-admin
    // protection still applies in the normal (fast network) case.
    let settled = false;
    let staleFallbackTimer = null;
    const applyAdminsSnap = (snap) => {
      const emails = (snap.data()?.emails || [])
        .map((e) => String(e).trim().toLowerCase())
        .filter(Boolean);
      setAdminEmails(emails);
      // See adminPermissions.js — explicit primaryEmail field wins, only
      // falling back to "first in the array" for a doc that predates it.
      setPrimaryAdminEmail(resolvePrimaryAdminEmail(snap.data()?.primaryEmail, emails));
    };
    const unsub = onSnapshot(
      doc(db, "config", "admins"),
      (snap) => {
        if (snap.metadata.fromCache) {
          if (!settled && !staleFallbackTimer) {
            staleFallbackTimer = setTimeout(() => {
              if (!settled) applyAdminsSnap(snap);
            }, 8000);
          }
          return;
        }
        settled = true;
        if (staleFallbackTimer) {
          clearTimeout(staleFallbackTimer);
          staleFallbackTimer = null;
        }
        applyAdminsSnap(snap);
      },
      (_error) => {
        settled = true;
        if (staleFallbackTimer) {
          clearTimeout(staleFallbackTimer);
          staleFallbackTimer = null;
        }
        setAdminEmails([]);
        setPrimaryAdminEmail(null);
      }
    );
    return () => {
      if (staleFallbackTimer) clearTimeout(staleFallbackTimer);
      unsub();
    };
  }, [user]);

  return { adminEmails, primaryAdminEmail };
}
