rules_version = '2';

// ============================================================================
// Data model this file assumes (matches App.jsx):
//
//   users/{ownerUid}/visits/{visitId}
//     - the customer/visit records themselves. ownerUid is the uid of the
//       account that "owns" this data (the account the customer was created
//       under), NOT necessarily the person reading/writing right now.
//
//   access/{ownerUid}
//     - { members: { "someone@email.com": "editor" | "viewer", ... } }
//     - written only by the owner, lists who they've granted access to.
//
//   access_by_email/{lowercasedEmail}
//     - { owners: { "<ownerUid>": "editor" | "viewer", ... } }
//     - a reverse index so a logged-in user can look up, by their own email,
//       which owner account(s) they have access to and at what role.
//
// IMPORTANT: these rules were written to match the client code but could not
// be tested against a live project from this environment. Test them with the
// Firebase Emulator Suite (`firebase emulators:start`) before deploying to
// production, especially the access_by_email map-diff rule below.
// ============================================================================

function isSignedIn() {
  return request.auth != null;
}

function myEmail() {
  return isSignedIn() ? request.auth.token.email.lower() : '';
}

// Looks up the caller's role on ownerUid's account via the access doc that
// the OWNER maintains (access/{ownerUid}.members[myEmail]).
function roleOn(ownerUid) {
  let accessDoc = /databases/$(database)/documents/access/$(ownerUid);
  return exists(accessDoc)
    ? get(accessDoc).data.members[myEmail()]
    : null;
}

function isOwner(ownerUid) {
  return isSignedIn() && request.auth.uid == ownerUid;
}

function canRead(ownerUid) {
  return isOwner(ownerUid) || roleOn(ownerUid) in ['editor', 'viewer'];
}

function canWrite(ownerUid) {
  return isOwner(ownerUid) || roleOn(ownerUid) == 'editor';
}

service cloud.firestore {
  match /databases/{database}/documents {

    // ---- Customer / visit records ----
    match /users/{ownerUid}/visits/{visitId} {
      allow read: if canRead(ownerUid);
      allow create, update, delete: if canWrite(ownerUid);
    }

    // ---- Access grants (owner's list of members) ----
    // Only the owner can read or write their own access document. Members
    // never read this doc directly — they use access_by_email instead.
    match /access/{ownerUid} {
      allow read, write: if isOwner(ownerUid);
    }

    // ---- Reverse lookup: email -> which owners granted this email access ----
    // Doc id is the grantee's lowercased email, so the grantee themselves can
    // always read their own lookup doc to discover which account(s) they can
    // access. Writes happen from the GRANTOR's client (a different uid than
    // the doc id), so instead of checking "who owns this doc", we check that
    // the write only touches the map entry keyed by the grantor's own uid —
    // i.e. nobody can grant/revoke access on someone else's behalf, and
    // nobody can rewrite another owner's entry inside a stranger's doc.
    match /access_by_email/{email} {
      allow read: if isSignedIn() && myEmail() == email;

      allow create: if isSignedIn() &&
        request.resource.data.owners.keys().hasOnly([request.auth.uid]);

      allow update: if isSignedIn() &&
        request.resource.data.owners.diff(resource.data.owners).affectedKeys().hasOnly([request.auth.uid]);

      allow delete: if false; // never hard-deleted by the client; keys are removed via update instead
    }
  }
}
