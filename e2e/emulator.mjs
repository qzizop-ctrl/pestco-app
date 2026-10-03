// Talks to the local Firebase emulators over their REST APIs — no extra
// packages. "Authorization: Bearer owner" is the emulators' admin credential:
// it bypasses the Firestore security rules, which is how test data that the
// app itself could never create (the first admin) gets seeded.

// Must match playwright.config.mjs and the `test:e2e` script in package.json.
export const PROJECT_ID = "demo-pestco-e2e";

const AUTH = "http://127.0.0.1:9099";
const FIRESTORE = "http://127.0.0.1:8080";
const DOCS = `${FIRESTORE}/v1/projects/${PROJECT_ID}/databases/(default)/documents`;
const OWNER = { Authorization: "Bearer owner", "Content-Type": "application/json" };

async function call(url, init, what) {
  const res = await fetch(url, init);
  if (!res.ok) throw new Error(`${what} failed: HTTP ${res.status} ${await res.text()}`);
  return res;
}

// Empties both emulators so every test starts from a known state.
export async function resetEmulators() {
  await call(`${AUTH}/emulator/v1/projects/${PROJECT_ID}/accounts`, { method: "DELETE" }, "clear Auth");
  await call(
    `${FIRESTORE}/emulator/v1/projects/${PROJECT_ID}/databases/(default)/documents`,
    { method: "DELETE" },
    "clear Firestore",
  );
}

// Creates an email/password account directly (no UI, no email round-trip).
// `verified: true` matters: the Firestore rules treat an unverified email as
// "no identity" (see hasEmail() in src/firestore.rules).
export async function createUser({ email, password, verified = true }) {
  const res = await call(
    `${AUTH}/identitytoolkit.googleapis.com/v1/projects/${PROJECT_ID}/accounts`,
    { method: "POST", headers: OWNER, body: JSON.stringify({ email, password, emailVerified: verified }) },
    `create user ${email}`,
  );
  const { localId } = await res.json();
  return localId;
}

// The app's access model starts from one hand-made document: config/admins,
// listing who may review signups and own a workspace (README: "first admin").
// An admin with no other grants is auto-provisioned an empty workspace of their
// own on first sign-in (see resolveNextOwners in src/workspaceAccess.js).
export async function seedAdmin(email) {
  const lower = email.toLowerCase();
  const body = {
    fields: {
      emails: { arrayValue: { values: [{ stringValue: lower }] } },
      primaryEmail: { stringValue: lower },
    },
  };
  await call(`${DOCS}/config/admins`, { method: "PATCH", headers: OWNER, body: JSON.stringify(body) }, "seed config/admins");
}

// Emails currently waiting in the reviewer's "pending signups" list.
export async function listSignupEmails() {
  const res = await call(`${DOCS}/signups`, { headers: OWNER }, "list signups");
  const json = await res.json();
  return (json.documents ?? []).map((d) => d.fields?.email?.stringValue);
}

// Plays the part of the person clicking the link in their verification email:
// the Auth emulator records every email it "sends" and exposes the link.
export async function verifyEmail(email) {
  const res = await call(`${AUTH}/emulator/v1/projects/${PROJECT_ID}/oobCodes`, {}, "list emails sent");
  const { oobCodes = [] } = await res.json();
  const match = oobCodes.filter((c) => c.email === email && c.requestType === "VERIFY_EMAIL").pop();
  if (!match) throw new Error(`No verification email was recorded for ${email}`);
  // The link answers with a redirect to the app's continue URL; only the
  // side effect (marking the address verified) matters here.
  await fetch(match.oobLink, { redirect: "manual" });
}

// Gives `memberEmail` a role (`editor` | `viewer`) in `ownerUid`'s workspace, the
// same two documents the app's own "grant access" action writes: the owner's
// member list (read by the security rules) and the member's own lookup document
// (read by the member's client to find the workspace).
export async function grantAccess({ ownerUid, memberEmail, role }) {
  const email = memberEmail.toLowerCase();
  const members = { fields: { members: { mapValue: { fields: { [email]: { stringValue: role } } } } } };
  const lookup = { fields: { owners: { mapValue: { fields: { [ownerUid]: { stringValue: role } } } } } };
  await call(`${DOCS}/access/${ownerUid}`, { method: "PATCH", headers: OWNER, body: JSON.stringify(members) }, "seed access");
  await call(
    `${DOCS}/access_by_email/${encodeURIComponent(email)}`,
    { method: "PATCH", headers: OWNER, body: JSON.stringify(lookup) },
    "seed access_by_email",
  );
}
