// Security-rules tests for src/firestore.rules, run against the Firestore
// emulator:   npm run test:rules   (setup: tests/rules/README.md)
//
// Each test states WHY a request must succeed or fail. The "regression" ones
// pin down holes that used to exist in the rules.
import { readFileSync } from "node:fs";
import { afterAll, beforeAll, beforeEach, describe, it } from "vitest";
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
    await assertFails(getDoc(doc(fs, "config/admins")));
    await assertFails(getDoc(doc(fs, `users/${ADMIN.uid}/visits/v2`)));
  });

  it("an UNVERIFIED account with a member's address can't read the workspace", async () => {
    await assertFails(getDoc(doc(as(EDITOR, false), `users/${ADMIN.uid}/visits/v2`)));
  });

  it("the same accounts work once verified", async () => {
    await assertSucceeds(getDoc(doc(as(ADMIN), `users/${ADMIN.uid}/visits/v2`)));
    await assertSucceeds(getDoc(doc(as(EDITOR), `users/${ADMIN.uid}/visits/v2`)));
  });
});

describe("only admins own workspaces (regression: any signed-in user could fill their own tree)", () => {
  it("a verified non-admin can't write into users/{their uid}/...", async () => {
    await assertFails(setDoc(doc(as(STRANGER), `users/${STRANGER.uid}/visits/x`), { companyName: "spam" }));
  });

  it("a verified non-admin can't create their own access documents", async () => {
    await assertFails(setDoc(doc(as(STRANGER), `access/${STRANGER.uid}`), { members: {} }));
    await assertFails(
      setDoc(doc(as(STRANGER), `access_by_email/${STRANGER.email}`), { owners: { [STRANGER.uid]: "editor" } })
    );
  });

  it("an admin can write to their own workspace", async () => {
    await assertSucceeds(setDoc(doc(as(ADMIN), `users/${ADMIN.uid}/visits/new`), { companyName: "New" }));
  });
});

describe("roles", () => {
  it("editor can create and edit customers", async () => {
    const fs = as(EDITOR);
    await assertSucceeds(setDoc(doc(fs, `users/${ADMIN.uid}/visits/e1`), { companyName: "E" }));
    await assertSucceeds(updateDoc(doc(fs, `users/${ADMIN.uid}/visits/v2`), { notes: "hello" }));
    await assertSucceeds(updateDoc(doc(fs, `users/${ADMIN.uid}/visits/v2`), { offers: arrayUnion({ id: "o1" }) }));
  });

  it("viewer can read but not write", async () => {
    const fs = as(VIEWER);
    await assertSucceeds(getDoc(doc(fs, `users/${ADMIN.uid}/visits/v2`)));
    await assertFails(updateDoc(doc(fs, `users/${ADMIN.uid}/visits/v2`), { notes: "x" }));
    await assertFails(setDoc(doc(fs, `users/${ADMIN.uid}/visits/new`), { companyName: "x" }));
  });

  it("someone with no role can't read", async () => {
    await assertFails(getDoc(doc(as(STRANGER), `users/${ADMIN.uid}/visits/v2`)));
  });

  it("an editor can't hard-delete (regression: editors could skip the owner's approval)", async () => {
    await assertFails(deleteDoc(doc(as(EDITOR), `users/${ADMIN.uid}/visits/v2`)));
    await assertFails(deleteDoc(doc(as(EDITOR), `users/${ADMIN.uid}/suppliers/s1`)));
  });

  it("the admin can hard-delete (approving a delete)", async () => {
    await assertSucceeds(deleteDoc(doc(as(ADMIN), `users/${ADMIN.uid}/visits/v2`)));
  });

  it("an editor can soft-delete by flagging the record", async () => {
    await assertSucceeds(
      updateDoc(doc(as(EDITOR), `users/${ADMIN.uid}/visits/v2`), {
        deleted: true,
        last_change: { type: "delete", ...PENDING },
      })
    );
  });
});

describe("pending changes (last_change)", () => {
  it("editor can attach a last_change that names themselves", async () => {
    await assertSucceeds(
      updateDoc(doc(as(EDITOR), `users/${ADMIN.uid}/visits/v2`), { notes: "x", last_change: PENDING })
    );
  });

  it("editor can't attribute a change to someone else (regression)", async () => {
    await assertFails(
      updateDoc(doc(as(EDITOR), `users/${ADMIN.uid}/visits/v2`), {
        notes: "x", last_change: { ...PENDING, updatedById: ADMIN.uid },
      })
    );
    await assertFails(
      setDoc(doc(as(EDITOR), `users/${ADMIN.uid}/visits/spoof`), {
        companyName: "x", last_change: { ...PENDING, updatedById: ADMIN.uid },
      })
    );
  });

  it("editor can't approve/roll back (clear) a pending change", async () => {
    await assertFails(updateDoc(doc(as(EDITOR), `users/${ADMIN.uid}/visits/v1`), { last_change: deleteField() }));
  });

  it("admin can approve (clear) a pending change", async () => {
    await assertSucceeds(updateDoc(doc(as(ADMIN), `users/${ADMIN.uid}/visits/v1`), { last_change: deleteField() }));
  });

  it("editor can still make an update that leaves last_change untouched (pin, stage)", async () => {
    await assertSucceeds(updateDoc(doc(as(EDITOR), `users/${ADMIN.uid}/visits/v1`), { isPinned: true }));
  });
});

describe("access_by_email", () => {
  it("only admins can hand out access", async () => {
    await assertSucceeds(
      setDoc(doc(as(ADMIN), "access_by_email/new@pest.test"), { owners: { [ADMIN.uid]: "editor" }, dashboardAccess: false })
    );
  });

  it("a non-admin can't plant an entry in someone else's picker (regression)", async () => {
    await assertFails(
      setDoc(doc(as(STRANGER), `access_by_email/${EDITOR.email}`), { owners: { [STRANGER.uid]: "viewer" } })
    );
    await assertFails(
      updateDoc(doc(as(STRANGER), `access_by_email/${EDITOR.email}`), { [`owners.${STRANGER.uid}`]: "viewer" })
    );
  });

  it("a member can read only their own entry", async () => {
    await assertSucceeds(getDoc(doc(as(EDITOR), `access_by_email/${EDITOR.email}`)));
    await assertFails(getDoc(doc(as(VIEWER), `access_by_email/${EDITOR.email}`)));
  });

  it("an admin can revoke access", async () => {
    await assertSucceeds(
      setDoc(doc(as(ADMIN), `access_by_email/${EDITOR.email}`), { owners: {}, dashboardAccess: false })
    );
  });
});

describe("audit log", () => {
  const entry = (user, extra = {}) => ({
    entityType: "customer", entityId: "v2", entityName: "Beta", action: "update",
    changedBy: "x", changedById: user.uid, at: serverTimestamp(), ...extra,
  });

  it("an editor can append an entry about themselves", async () => {
    await assertSucceeds(setDoc(doc(as(EDITOR), `users/${ADMIN.uid}/auditLog/n1`), entry(EDITOR)));
  });

  it("can't write as someone else, or with a made-up action", async () => {
    await assertFails(setDoc(doc(as(EDITOR), `users/${ADMIN.uid}/auditLog/n2`), entry(ADMIN)));
    await assertFails(setDoc(doc(as(EDITOR), `users/${ADMIN.uid}/auditLog/n3`), entry(EDITOR, { action: "purge" })));
  });

  it("can't backdate an entry (at must be the server time)", async () => {
    await assertFails(setDoc(doc(as(EDITOR), `users/${ADMIN.uid}/auditLog/n4`), entry(EDITOR, { at: new Date(0) })));
  });

  it("entries are immutable, even for the admin", async () => {
    await assertFails(updateDoc(doc(as(ADMIN), `users/${ADMIN.uid}/auditLog/a1`), { action: "create" }));
    await assertFails(deleteDoc(doc(as(ADMIN), `users/${ADMIN.uid}/auditLog/a1`)));
  });

  it("only admins read the log", async () => {
    await assertSucceeds(getDoc(doc(as(ADMIN), `users/${ADMIN.uid}/auditLog/a1`)));
    await assertFails(getDoc(doc(as(EDITOR), `users/${ADMIN.uid}/auditLog/a1`)));
  });
});

describe("admin list", () => {
  it("a non-admin can't make themselves an admin", async () => {
    await assertFails(
      updateDoc(doc(as(STRANGER), "config/admins"), { emails: [ADMIN.email, STRANGER.email] })
    );
  });

  it("an admin can add another admin", async () => {
    await assertSucceeds(
      updateDoc(doc(as(ADMIN), "config/admins"), { emails: [ADMIN.email, EDITOR.email] })
    );
  });
});

describe("admin list read (regression: any verified user could read the full admin list)", () => {
  it("a verified non-admin (editor, viewer, or a stranger) can't read it", async () => {
    await assertFails(getDoc(doc(as(EDITOR), "config/admins")));
    await assertFails(getDoc(doc(as(VIEWER), "config/admins")));
    await assertFails(getDoc(doc(as(STRANGER), "config/admins")));
  });

  it("an admin can still read it (Settings needs the full list to manage admins)", async () => {
    await assertSucceeds(getDoc(doc(as(ADMIN), "config/admins")));
  });
});
