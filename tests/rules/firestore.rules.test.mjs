// Security-rules tests for src/firestore.rules, run against the Firestore
// emulator:   npm run test:rules   (setup: tests/rules/README.md)
//
// Each test states WHY a request must succeed or fail. The "regression" ones
// pin down holes that used to exist in the rules.
import { readFileSync } from "node:fs";
import { afterAll, beforeAll, beforeEach, describe, expect, it } from "vitest";
import {
  initializeTestEnvironment,
  assertFails,
  assertSucceeds,
} from "@firebase/rules-unit-testing";
import {
  doc, getDoc, setDoc, updateDoc, deleteDoc, deleteField, serverTimestamp, arrayUnion,
} from "firebase/firestore";

const ADMIN = { uid: "admin-uid", email: "admin@pest.test" };
const EDITOR = { uid: "editor-uid", email: "editor@pest.test" };
const VIEWER = { uid: "viewer-uid", email: "viewer@pest.test" };
const STRANGER = { uid: "stranger-uid", email: "stranger@pest.test" };

let testEnv;

// Firestore handle for a signed-in user. `verified` controls the
// email_verified claim on the ID token.
const as = (user, verified = true) =>
  testEnv.authenticatedContext(user.uid, { email: user.email, email_verified: verified }).firestore();

const PENDING = { updatedBy: "Editor", updatedById: EDITOR.uid, updatedAt: "2026-01-01T00:00:00.000Z" };

async function seed() {
  await testEnv.withSecurityRulesDisabled(async (ctx) => {
    const fs = ctx.firestore();
    await setDoc(doc(fs, "config/admins"), { emails: [ADMIN.email], primaryEmail: ADMIN.email });
    await setDoc(doc(fs, `access/${ADMIN.uid}`), {
      members: { [EDITOR.email]: "editor", [VIEWER.email]: "viewer" },
      dashboardAccess: {},
    });
    await setDoc(doc(fs, `access_by_email/${EDITOR.email}`), { owners: { [ADMIN.uid]: "editor" } });
    // v1 has a pending change from the editor, v2 is clean.
    await setDoc(doc(fs, `users/${ADMIN.uid}/visits/v1`), { companyName: "Acme", notes: "", last_change: PENDING });
    await setDoc(doc(fs, `users/${ADMIN.uid}/visits/v2`), { companyName: "Beta", notes: "" });
    // v3: a record with offers / visit history / activity already on it.
    await setDoc(doc(fs, `users/${ADMIN.uid}/visits/v3`), {
      companyName: "Gamma", notes: "", stage: "quote",
      offers: [{ id: "o1", amount: 100 }, { id: "o2", amount: 200 }, { id: "o3", amount: 300 }],
      visitHistory: [{ id: "h1", date: "2026-01-01" }],
      activityLog: [{ id: "a1", text: "hi" }],
    });
    await setDoc(doc(fs, `users/${ADMIN.uid}/suppliers/s1`), { name: "Supplier" });
    await setDoc(doc(fs, `users/${ADMIN.uid}/auditLog/a1`), {
      entityType: "customer", entityId: "v1", action: "update",
      changedById: EDITOR.uid, at: new Date(),
    });
  });
}

beforeAll(async () => {
  testEnv = await initializeTestEnvironment({
    projectId: "pestco-rules-test",
    firestore: { rules: readFileSync(new URL("../../src/firestore.rules", import.meta.url), "utf8") },
  });
});
afterAll(async () => {
  await testEnv.cleanup();
});
beforeEach(async () => {
  await testEnv.clearFirestore();
  await seed();
});

describe("verified email is required (regression: rules ignored email_verified)", () => {
  it("an UNVERIFIED account with an admin's address gets nothing", async () => {
    const fs = as(ADMIN, false);
    await expect(assertFails(getDoc(doc(fs, "config/admins")))).resolves.toBeDefined();
    await expect(assertFails(getDoc(doc(fs, `users/${ADMIN.uid}/visits/v2`)))).resolves.toBeDefined();
  });

  it("an UNVERIFIED account with a member's address can't read the workspace", async () => {
    await expect(assertFails(getDoc(doc(as(EDITOR, false), `users/${ADMIN.uid}/visits/v2`)))).resolves.toBeDefined();
  });

  it("the same accounts work once verified", async () => {
    await expect(assertSucceeds(getDoc(doc(as(ADMIN), `users/${ADMIN.uid}/visits/v2`)))).resolves.not.toBeInstanceOf(Error);
    await expect(assertSucceeds(getDoc(doc(as(EDITOR), `users/${ADMIN.uid}/visits/v2`)))).resolves.not.toBeInstanceOf(Error);
  });
});

describe("only admins own workspaces (regression: any signed-in user could fill their own tree)", () => {
  it("a verified non-admin can't write into users/{their uid}/...", async () => {
    await expect(assertFails(setDoc(doc(as(STRANGER), `users/${STRANGER.uid}/visits/x`), { companyName: "spam" }))).resolves.toBeDefined();
  });

  it("a verified non-admin can't create their own access documents", async () => {
    await expect(assertFails(setDoc(doc(as(STRANGER), `access/${STRANGER.uid}`), { members: {} }))).resolves.toBeDefined();
    await expect(assertFails(
      setDoc(doc(as(STRANGER), `access_by_email/${STRANGER.email}`), { owners: { [STRANGER.uid]: "editor" } })
    )).resolves.toBeDefined();
  });

  it("an admin can write to their own workspace", async () => {
    await expect(assertSucceeds(setDoc(doc(as(ADMIN), `users/${ADMIN.uid}/visits/new`), { companyName: "New" }))).resolves.not.toBeInstanceOf(Error);
  });
});

describe("roles", () => {
  it("editor can create (with a pending change) and edit customers through review", async () => {
    const fs = as(EDITOR);
    await expect(assertSucceeds(
      setDoc(doc(fs, `users/${ADMIN.uid}/visits/e1`), { companyName: "E", last_change: PENDING })
    )).resolves.not.toBeInstanceOf(Error);
    await expect(assertSucceeds(
      updateDoc(doc(fs, `users/${ADMIN.uid}/visits/v2`), { notes: "hello", last_change: PENDING })
    )).resolves.not.toBeInstanceOf(Error);
  });

  it("editor can use the quick actions (offers, stage, pin) without a review", async () => {
    const fs = as(EDITOR);
    await expect(assertSucceeds(updateDoc(doc(fs, `users/${ADMIN.uid}/visits/v2`), { offers: arrayUnion({ id: "o1" }) }))).resolves.not.toBeInstanceOf(Error);
    await expect(assertSucceeds(updateDoc(doc(fs, `users/${ADMIN.uid}/visits/v2`), { stage: "quote" }))).resolves.not.toBeInstanceOf(Error);
    await expect(assertSucceeds(updateDoc(doc(fs, `users/${ADMIN.uid}/visits/v2`), { isPinned: true }))).resolves.not.toBeInstanceOf(Error);
  });

  it("viewer can read but not write", async () => {
    const fs = as(VIEWER);
    await expect(assertSucceeds(getDoc(doc(fs, `users/${ADMIN.uid}/visits/v2`)))).resolves.not.toBeInstanceOf(Error);
    await expect(assertFails(updateDoc(doc(fs, `users/${ADMIN.uid}/visits/v2`), { notes: "x" }))).resolves.toBeDefined();
    await expect(assertFails(setDoc(doc(fs, `users/${ADMIN.uid}/visits/new`), { companyName: "x" }))).resolves.toBeDefined();
  });

  it("someone with no role can't read", async () => {
    await expect(assertFails(getDoc(doc(as(STRANGER), `users/${ADMIN.uid}/visits/v2`)))).resolves.toBeDefined();
  });

  it("an editor can't hard-delete (regression: editors could skip the owner's approval)", async () => {
    await expect(assertFails(deleteDoc(doc(as(EDITOR), `users/${ADMIN.uid}/visits/v2`)))).resolves.toBeDefined();
    await expect(assertFails(deleteDoc(doc(as(EDITOR), `users/${ADMIN.uid}/suppliers/s1`)))).resolves.toBeDefined();
  });

  it("the admin can hard-delete (approving a delete)", async () => {
    await expect(assertSucceeds(deleteDoc(doc(as(ADMIN), `users/${ADMIN.uid}/visits/v2`)))).resolves.not.toBeInstanceOf(Error);
  });

  it("an editor can soft-delete by flagging the record", async () => {
    await expect(assertSucceeds(
      updateDoc(doc(as(EDITOR), `users/${ADMIN.uid}/visits/v2`), {
        deleted: true,
        last_change: { type: "delete", ...PENDING },
      })
    )).resolves.not.toBeInstanceOf(Error);
  });
});

describe("pending changes (last_change)", () => {
  it("editor can attach a last_change that names themselves", async () => {
    await expect(assertSucceeds(
      updateDoc(doc(as(EDITOR), `users/${ADMIN.uid}/visits/v2`), { notes: "x", last_change: PENDING })
    )).resolves.not.toBeInstanceOf(Error);
  });

  it("editor can't attribute a change to someone else (regression)", async () => {
    await expect(assertFails(
      updateDoc(doc(as(EDITOR), `users/${ADMIN.uid}/visits/v2`), {
        notes: "x", last_change: { ...PENDING, updatedById: ADMIN.uid },
      })
    )).resolves.toBeDefined();
    await expect(assertFails(
      setDoc(doc(as(EDITOR), `users/${ADMIN.uid}/visits/spoof`), {
        companyName: "x", last_change: { ...PENDING, updatedById: ADMIN.uid },
      })
    )).resolves.toBeDefined();
  });

  it("editor can't approve/roll back (clear) a pending change", async () => {
    await expect(assertFails(updateDoc(doc(as(EDITOR), `users/${ADMIN.uid}/visits/v1`), { last_change: deleteField() }))).resolves.toBeDefined();
  });

  it("admin can approve (clear) a pending change", async () => {
    await expect(assertSucceeds(updateDoc(doc(as(ADMIN), `users/${ADMIN.uid}/visits/v1`), { last_change: deleteField() }))).resolves.not.toBeInstanceOf(Error);
  });

  it("editor can still make an update that leaves last_change untouched (pin, stage)", async () => {
    await expect(assertSucceeds(updateDoc(doc(as(EDITOR), `users/${ADMIN.uid}/visits/v1`), { isPinned: true }))).resolves.not.toBeInstanceOf(Error);
  });
});

describe("review workflow can't be bypassed through the SDK (regression)", () => {
  it("editor can't change reviewed fields without raising a last_change", async () => {
    const fs = as(EDITOR);
    await expect(assertFails(updateDoc(doc(fs, `users/${ADMIN.uid}/visits/v2`), { companyName: "Hacked" }))).resolves.toBeDefined();
    await expect(assertFails(updateDoc(doc(fs, `users/${ADMIN.uid}/visits/v2`), { notes: "silent edit" }))).resolves.toBeDefined();
    await expect(assertFails(updateDoc(doc(fs, `users/${ADMIN.uid}/suppliers/s1`), { name: "Hacked" }))).resolves.toBeDefined();
  });

  it("editor can't un-delete or delete a record silently", async () => {
    const fs = as(EDITOR);
    await expect(assertFails(updateDoc(doc(fs, `users/${ADMIN.uid}/visits/v2`), { deleted: true }))).resolves.toBeDefined();
    await expect(assertFails(updateDoc(doc(fs, `users/${ADMIN.uid}/visits/v2`), { deleted: false }))).resolves.toBeDefined();
  });

  it("editor can't edit reviewed fields on a record with someone else's pending change unless they raise their own", async () => {
    await expect(assertFails(updateDoc(doc(as(EDITOR), `users/${ADMIN.uid}/visits/v1`), { notes: "x" }))).resolves.toBeDefined();
    await expect(assertSucceeds(
      updateDoc(doc(as(EDITOR), `users/${ADMIN.uid}/visits/v1`), {
        notes: "x",
        // A NEW last_change (different updatedAt). Re-sending the identical one
        // that is already stored does not count as "raising" a change.
        last_change: { ...PENDING, updatedAt: "2026-02-02T00:00:00.000Z" },
      })
    )).resolves.not.toBeInstanceOf(Error);
  });

  it("a last_change can't be used to smuggle in createdAt or unknown fields", async () => {
    const fs = as(EDITOR);
    await expect(assertFails(
      updateDoc(doc(fs, `users/${ADMIN.uid}/visits/v2`), { createdAt: new Date(0), last_change: PENDING })
    )).resolves.toBeDefined();
    await expect(assertFails(
      updateDoc(doc(fs, `users/${ADMIN.uid}/visits/v2`), { isAdmin: true, last_change: PENDING })
    )).resolves.toBeDefined();
  });

  it("an editor can't create a customer or supplier without a last_change", async () => {
    const fs = as(EDITOR);
    await expect(assertFails(setDoc(doc(fs, `users/${ADMIN.uid}/visits/nolc`), { companyName: "x" }))).resolves.toBeDefined();
    await expect(assertFails(setDoc(doc(fs, `users/${ADMIN.uid}/suppliers/nolc`), { name: "x" }))).resolves.toBeDefined();
  });

  it("an editor's create can't carry unknown fields", async () => {
    await expect(assertFails(
      setDoc(doc(as(EDITOR), `users/${ADMIN.uid}/visits/extra`), {
        companyName: "x", last_change: PENDING, junk: "y",
      })
    )).resolves.toBeDefined();
  });

  it("suppliers: reviewed edit and pin work, arbitrary fields don't", async () => {
    const fs = as(EDITOR);
    await expect(assertSucceeds(updateDoc(doc(fs, `users/${ADMIN.uid}/suppliers/s1`), { name: "New", last_change: PENDING }))).resolves.not.toBeInstanceOf(Error);
    await expect(assertSucceeds(updateDoc(doc(fs, `users/${ADMIN.uid}/suppliers/s1`), { isPinned: true }))).resolves.not.toBeInstanceOf(Error);
    await expect(assertFails(updateDoc(doc(fs, `users/${ADMIN.uid}/suppliers/s1`), { role: "x", last_change: PENDING }))).resolves.toBeDefined();
  });

  it("the admin is not restricted (import, tag rename, rollback)", async () => {
    const fs = as(ADMIN);
    await expect(assertSucceeds(setDoc(doc(fs, `users/${ADMIN.uid}/visits/imp`), { companyName: "Imported", createdAt: serverTimestamp() }))).resolves.not.toBeInstanceOf(Error);
    await expect(assertSucceeds(updateDoc(doc(fs, `users/${ADMIN.uid}/visits/v2`), { tags: ["a"], companyName: "Renamed" }))).resolves.not.toBeInstanceOf(Error);
  });

  it("audit entries can't carry unknown fields", async () => {
    await expect(assertFails(
      setDoc(doc(as(EDITOR), `users/${ADMIN.uid}/auditLog/junk`), {
        entityType: "customer", entityId: "v2", entityName: "Beta", action: "update",
        changedBy: EDITOR.email, changedById: EDITOR.uid, at: serverTimestamp(), payload: "x".repeat(50),
      })
    )).resolves.toBeDefined();
  });
});

describe("quick actions are validated (regression: any value could be written without review)", () => {
  const v3 = (fs) => doc(fs, `users/${ADMIN.uid}/visits/v3`);

  it("stage must be a real stage id (or empty to clear it)", async () => {
    const fs = as(EDITOR);
    await expect(assertFails(updateDoc(v3(fs), { stage: "hacked" }))).resolves.toBeDefined();
    await expect(assertFails(updateDoc(v3(fs), { stage: 7 }))).resolves.toBeDefined();
    await expect(assertSucceeds(updateDoc(v3(fs), { stage: "install" }))).resolves.not.toBeInstanceOf(Error);
    await expect(assertSucceeds(updateDoc(v3(fs), { stage: "" }))).resolves.not.toBeInstanceOf(Error);
  });

  it("flags and dates must have the right type", async () => {
    const fs = as(EDITOR);
    await expect(assertFails(updateDoc(v3(fs), { isPinned: "yes" }))).resolves.toBeDefined();
    await expect(assertFails(updateDoc(v3(fs), { notified: 1 }))).resolves.toBeDefined();
    await expect(assertFails(updateDoc(v3(fs), { callDateTime: { x: 1 } }))).resolves.toBeDefined();
    await expect(assertFails(updateDoc(v3(fs), { visitDate: "x".repeat(500) }))).resolves.toBeDefined();
    await expect(assertSucceeds(updateDoc(v3(fs), { callDateTime: "", notified: false }))).resolves.not.toBeInstanceOf(Error);
    await expect(assertSucceeds(updateDoc(v3(fs), { visitDate: "2026-10-04", updatedAt: new Date().toISOString() }))).resolves.not.toBeInstanceOf(Error);
  });

  it("visitHistory can only grow: no deleting or rewriting history, no flooding", async () => {
    const fs = as(EDITOR);
    await expect(assertFails(updateDoc(v3(fs), { visitHistory: [] }))).resolves.toBeDefined();
    await expect(assertFails(updateDoc(v3(fs), { visitHistory: [{ id: "h1", date: "1999-01-01" }] }))).resolves.toBeDefined();
    await expect(assertFails(updateDoc(v3(fs), { visitHistory: "gone" }))).resolves.toBeDefined();
    const flood = Array.from({ length: 10 }, (_, i) => ({ id: `n${i}`, date: "2026-10-04" }));
    await expect(assertFails(updateDoc(v3(fs), { visitHistory: [{ id: "h1", date: "2026-01-01" }, ...flood] }))).resolves.toBeDefined();
    await expect(assertSucceeds(updateDoc(v3(fs), { visitHistory: arrayUnion({ id: "h2", date: "2026-10-04" }) }))).resolves.not.toBeInstanceOf(Error);
  });

  it("activityLog must stay a list under the ceiling; removing an entry is fine", async () => {
    const fs = as(EDITOR);
    await expect(assertFails(updateDoc(v3(fs), { activityLog: "x" }))).resolves.toBeDefined();
    const many = Array.from({ length: 150 }, (_, i) => ({ id: `a${i}`, text: "t" }));
    await expect(assertFails(updateDoc(v3(fs), { activityLog: many }))).resolves.toBeDefined();
    await expect(assertSucceeds(updateDoc(v3(fs), { activityLog: [] }))).resolves.not.toBeInstanceOf(Error);
  });

  it("offers: one offer may change per write (add / edit / remove), never all of them", async () => {
    const fs = as(EDITOR);
    const base = [{ id: "o1", amount: 100 }, { id: "o2", amount: 200 }, { id: "o3", amount: 300 }];
    // zeroing every amount in one write
    await expect(assertFails(updateDoc(v3(fs), { offers: base.map((o) => ({ ...o, amount: 0 })) }))).resolves.toBeDefined();
    // wiping the list
    await expect(assertFails(updateDoc(v3(fs), { offers: [] }))).resolves.toBeDefined();
    // not a list
    await expect(assertFails(updateDoc(v3(fs), { offers: "free money" }))).resolves.toBeDefined();
    // edit exactly one (one removed + one added)
    await expect(assertSucceeds(updateDoc(v3(fs), { offers: [base[0], { id: "o2", amount: 250 }, base[2]] }))).resolves.not.toBeInstanceOf(Error);
  });

  it("offers: adding one and removing one still work", async () => {
    const fs = as(EDITOR);
    await expect(assertSucceeds(updateDoc(v3(fs), { offers: arrayUnion({ id: "o4", amount: 5 }) }))).resolves.not.toBeInstanceOf(Error);
    await expect(assertSucceeds(updateDoc(v3(fs), { offers: [{ id: "o2", amount: 200 }, { id: "o3", amount: 300 }] }))).resolves.not.toBeInstanceOf(Error);
  });

  it("the same value checks apply to a reviewed edit, not just to quick actions", async () => {
    const fs = as(EDITOR);
    await expect(assertFails(updateDoc(v3(fs), { notes: "n", stage: "hacked", last_change: PENDING }))).resolves.toBeDefined();
    await expect(assertSucceeds(updateDoc(v3(fs), { notes: "n", stage: "survey", last_change: PENDING }))).resolves.not.toBeInstanceOf(Error);
  });

  it("an editor's new customer must carry valid values", async () => {
    const fs = as(EDITOR);
    await expect(assertFails(setDoc(doc(fs, `users/${ADMIN.uid}/visits/c1`), { companyName: "C", stage: "hacked", last_change: PENDING }))).resolves.toBeDefined();
    await expect(assertFails(setDoc(doc(fs, `users/${ADMIN.uid}/visits/c2`), { companyName: "C", offers: "x", last_change: PENDING }))).resolves.toBeDefined();
    await expect(assertSucceeds(setDoc(doc(fs, `users/${ADMIN.uid}/visits/c3`), {
      companyName: "C", stage: "survey", offers: [], activityLog: [], visitHistory: [], isPinned: false, last_change: PENDING,
    }))).resolves.not.toBeInstanceOf(Error);
  });

  it("suppliers: isPinned must be a boolean", async () => {
    const fs = as(EDITOR);
    await expect(assertFails(updateDoc(doc(fs, `users/${ADMIN.uid}/suppliers/s1`), { isPinned: "yes" }))).resolves.toBeDefined();
    await expect(assertSucceeds(updateDoc(doc(fs, `users/${ADMIN.uid}/suppliers/s1`), { isPinned: true }))).resolves.not.toBeInstanceOf(Error);
  });

  it("the owner is not restricted (rollback may shrink history, restore may rewrite offers)", async () => {
    const fs = as(ADMIN);
    await expect(assertSucceeds(updateDoc(v3(fs), { visitHistory: [], offers: [] }))).resolves.not.toBeInstanceOf(Error);
  });
});

describe("access_by_email", () => {
  it("only admins can hand out access", async () => {
    await expect(assertSucceeds(
      setDoc(doc(as(ADMIN), "access_by_email/new@pest.test"), { owners: { [ADMIN.uid]: "editor" }, dashboardAccess: false })
    )).resolves.not.toBeInstanceOf(Error);
  });

  it("a non-admin can't plant an entry in someone else's picker (regression)", async () => {
    await expect(assertFails(
      setDoc(doc(as(STRANGER), `access_by_email/${EDITOR.email}`), { owners: { [STRANGER.uid]: "viewer" } })
    )).resolves.toBeDefined();
    await expect(assertFails(
      updateDoc(doc(as(STRANGER), `access_by_email/${EDITOR.email}`), { [`owners.${STRANGER.uid}`]: "viewer" })
    )).resolves.toBeDefined();
  });

  it("a member can read only their own entry", async () => {
    await expect(assertSucceeds(getDoc(doc(as(EDITOR), `access_by_email/${EDITOR.email}`)))).resolves.not.toBeInstanceOf(Error);
    await expect(assertFails(getDoc(doc(as(VIEWER), `access_by_email/${EDITOR.email}`)))).resolves.toBeDefined();
  });

  it("an admin can revoke access", async () => {
    await expect(assertSucceeds(
      setDoc(doc(as(ADMIN), `access_by_email/${EDITOR.email}`), { owners: {}, dashboardAccess: false })
    )).resolves.not.toBeInstanceOf(Error);
  });
});

describe("audit log", () => {
  const entry = (user, extra = {}) => ({
    entityType: "customer", entityId: "v2", entityName: "Beta", action: "update",
    changedBy: user.email, changedById: user.uid, at: serverTimestamp(), ...extra,
  });

  it("an editor can append an entry about themselves", async () => {
    await expect(assertSucceeds(setDoc(doc(as(EDITOR), `users/${ADMIN.uid}/auditLog/n1`), entry(EDITOR)))).resolves.not.toBeInstanceOf(Error);
  });

  it("can't write as someone else, or with a made-up action", async () => {
    await expect(assertFails(setDoc(doc(as(EDITOR), `users/${ADMIN.uid}/auditLog/n2`), entry(ADMIN)))).resolves.toBeDefined();
    await expect(assertFails(setDoc(doc(as(EDITOR), `users/${ADMIN.uid}/auditLog/n3`), entry(EDITOR, { action: "purge" })))).resolves.toBeDefined();
  });

  it("changedBy must be the caller's own email (regression: any name could be written next to a right uid)", async () => {
    const fs = as(EDITOR);
    await expect(assertFails(setDoc(doc(fs, `users/${ADMIN.uid}/auditLog/n5`), entry(EDITOR, { changedBy: ADMIN.email })))).resolves.toBeDefined();
    await expect(assertFails(setDoc(doc(fs, `users/${ADMIN.uid}/auditLog/n6`), entry(EDITOR, { changedBy: "The Owner" })))).resolves.toBeDefined();
    await expect(assertFails(setDoc(doc(fs, `users/${ADMIN.uid}/auditLog/n7`), entry(EDITOR, { changedBy: "" })))).resolves.toBeDefined();
    await expect(assertFails(setDoc(doc(fs, `users/${ADMIN.uid}/auditLog/n8`), entry(EDITOR, { changedBy: 42 })))).resolves.toBeDefined();
  });

  it("changedBy may differ from the token email only in letter case", async () => {
    await expect(assertSucceeds(
      setDoc(doc(as(EDITOR), `users/${ADMIN.uid}/auditLog/n9`), entry(EDITOR, { changedBy: EDITOR.email.toUpperCase() }))
    )).resolves.not.toBeInstanceOf(Error);
  });

  it("the token's name claim is accepted as changedBy when it exists", async () => {
    const fs = testEnv
      .authenticatedContext(EDITOR.uid, { email: EDITOR.email, email_verified: true, name: "Sara Editor" })
      .firestore();
    await expect(assertSucceeds(
      setDoc(doc(fs, `users/${ADMIN.uid}/auditLog/n10`), entry(EDITOR, { changedBy: "Sara Editor" }))
    )).resolves.not.toBeInstanceOf(Error);
  });

  it("can't backdate an entry (at must be the server time)", async () => {
    await expect(assertFails(setDoc(doc(as(EDITOR), `users/${ADMIN.uid}/auditLog/n4`), entry(EDITOR, { at: new Date(0) })))).resolves.toBeDefined();
  });

  it("entries can't be edited, even by the admin", async () => {
    await expect(assertFails(updateDoc(doc(as(ADMIN), `users/${ADMIN.uid}/auditLog/a1`), { action: "create" }))).resolves.toBeDefined();
  });

  it("only the owner can delete entries (auto-trim to the newest 40)", async () => {
    await expect(assertFails(deleteDoc(doc(as(EDITOR), `users/${ADMIN.uid}/auditLog/a1`)))).resolves.toBeDefined();
    await expect(assertSucceeds(deleteDoc(doc(as(ADMIN), `users/${ADMIN.uid}/auditLog/a1`)))).resolves.not.toBeInstanceOf(Error);
  });

  it("only admins read the log", async () => {
    await expect(assertSucceeds(getDoc(doc(as(ADMIN), `users/${ADMIN.uid}/auditLog/a1`)))).resolves.not.toBeInstanceOf(Error);
    await expect(assertFails(getDoc(doc(as(EDITOR), `users/${ADMIN.uid}/auditLog/a1`)))).resolves.toBeDefined();
  });
});

describe("admin list", () => {
  it("a non-admin can't make themselves an admin", async () => {
    await expect(assertFails(
      updateDoc(doc(as(STRANGER), "config/admins"), { emails: [ADMIN.email, STRANGER.email] })
    )).resolves.toBeDefined();
  });

  it("an admin can add another admin", async () => {
    await expect(assertSucceeds(
      updateDoc(doc(as(ADMIN), "config/admins"), { emails: [ADMIN.email, EDITOR.email] })
    )).resolves.not.toBeInstanceOf(Error);
  });
});

describe("admin list read (regression: any verified user could read the full admin list)", () => {
  it("a verified non-admin (editor, viewer, or a stranger) can't read it", async () => {
    await expect(assertFails(getDoc(doc(as(EDITOR), "config/admins")))).resolves.toBeDefined();
    await expect(assertFails(getDoc(doc(as(VIEWER), "config/admins")))).resolves.toBeDefined();
    await expect(assertFails(getDoc(doc(as(STRANGER), "config/admins")))).resolves.toBeDefined();
  });

  it("an admin can still read it (Settings needs the full list to manage admins)", async () => {
    await expect(assertSucceeds(getDoc(doc(as(ADMIN), "config/admins")))).resolves.not.toBeInstanceOf(Error);
  });
});

// A second admin. Being in config/admins must NOT open another admin's
// workspace: access is per workspace (owner, or a role the owner granted).
describe("admins are isolated from each other's workspaces (regression: isReviewer() opened every workspace)", () => {
  const ADMIN2 = { uid: "admin2-uid", email: "admin2@pest.test" };

  beforeEach(async () => {
    await testEnv.withSecurityRulesDisabled(async (ctx) => {
      const fs = ctx.firestore();
      await setDoc(doc(fs, "config/admins"), {
        emails: [ADMIN.email, ADMIN2.email], primaryEmail: ADMIN.email,
      });
      // ADMIN2 owns an empty workspace of their own, and was only granted
      // 'viewer' on ADMIN's workspace.
      await setDoc(doc(fs, `access/${ADMIN.uid}`), {
        members: { [EDITOR.email]: "editor", [VIEWER.email]: "viewer", [ADMIN2.email]: "viewer" },
        dashboardAccess: {},
      });
      await setDoc(doc(fs, `users/${ADMIN2.uid}/visits/w1`), { companyName: "Other", notes: "" });
    });
  });

  it("an admin can't read another admin's workspace unless granted a role there", async () => {
    await testEnv.withSecurityRulesDisabled(async (ctx) => {
      await setDoc(doc(ctx.firestore(), `access/${ADMIN.uid}`), { members: {}, dashboardAccess: {} });
    });
    await expect(assertFails(getDoc(doc(as(ADMIN2), `users/${ADMIN.uid}/visits/v2`)))).resolves.toBeDefined();
    await expect(assertFails(getDoc(doc(as(ADMIN), `users/${ADMIN2.uid}/visits/w1`)))).resolves.toBeDefined();
  });

  it("an admin with only a 'viewer' grant reads but can't write, approve or hard-delete", async () => {
    await expect(assertSucceeds(getDoc(doc(as(ADMIN2), `users/${ADMIN.uid}/visits/v2`)))).resolves.not.toBeInstanceOf(Error);
    await expect(assertFails(updateDoc(doc(as(ADMIN2), `users/${ADMIN.uid}/visits/v2`), { isPinned: true }))).resolves.toBeDefined();
    await expect(assertFails(
      updateDoc(doc(as(ADMIN2), `users/${ADMIN.uid}/visits/v1`), { last_change: deleteField() })
    )).resolves.toBeDefined();
    await expect(assertFails(deleteDoc(doc(as(ADMIN2), `users/${ADMIN.uid}/visits/v2`)))).resolves.toBeDefined();
  });

  it("an admin without a grant can't write into another admin's workspace", async () => {
    await expect(assertFails(
      updateDoc(doc(as(ADMIN), `users/${ADMIN2.uid}/visits/w1`), { notes: "hijack" })
    )).resolves.toBeDefined();
    await expect(assertFails(deleteDoc(doc(as(ADMIN), `users/${ADMIN2.uid}/visits/w1`)))).resolves.toBeDefined();
  });

  it("an admin can't rewrite or read another admin's access document", async () => {
    await expect(assertFails(
      setDoc(doc(as(ADMIN2), `access/${ADMIN.uid}`), { members: { [ADMIN2.email]: "editor" } })
    )).resolves.toBeDefined();
    await expect(assertFails(getDoc(doc(as(ADMIN2), `access/${ADMIN.uid}`)))).resolves.toBeDefined();
  });

  it("an admin can't read another admin's audit log", async () => {
    await expect(assertFails(getDoc(doc(as(ADMIN2), `users/${ADMIN.uid}/auditLog/a1`)))).resolves.toBeDefined();
  });

  it("each admin still has full control of their own workspace", async () => {
    await expect(assertSucceeds(updateDoc(doc(as(ADMIN2), `users/${ADMIN2.uid}/visits/w1`), { notes: "mine" }))).resolves.not.toBeInstanceOf(Error);
    await expect(assertSucceeds(updateDoc(doc(as(ADMIN), `users/${ADMIN.uid}/visits/v2`), { notes: "mine" }))).resolves.not.toBeInstanceOf(Error);
  });
});
