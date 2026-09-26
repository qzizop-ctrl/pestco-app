import { describe, it, expect } from "vitest";
import { buildAuditEntry } from "./auditLog";

const t = { unknownUser: "غير معروف" };
const user = { displayName: "Ali Rep", uid: "uid123", email: "ali@example.com" };

describe("buildAuditEntry", () => {
  it("builds a create entry with no changes field", () => {
    const entry = buildAuditEntry({
      entityType: "customer", entityId: "c1", entityName: "Acme", action: "create", user, t,
    });
    expect(entry.entityType).toBe("customer");
    expect(entry.entityId).toBe("c1");
    expect(entry.entityName).toBe("Acme");
    expect(entry.action).toBe("create");
    expect(entry.changes).toBeUndefined();
    expect(entry.changedBy).toBe("Ali Rep");
    expect(entry.changedById).toBe("uid123");
    expect(typeof entry.at).toBe("string");
  });

  it("keeps real field diffs and strips metadata keys out of `changes`", () => {
    const entry = buildAuditEntry({
      entityType: "supplier",
      entityId: "s1",
      entityName: "SupplierCo",
      action: "update",
      changes: {
        name: { old_value: "Old", new_value: "New" },
        changed_by: "someone",
        updatedAt: "2024-01-01",
        updatedById: "xyz",
      },
      user,
      t,
    });
    expect(entry.changes).toEqual({ name: { old_value: "Old", new_value: "New" } });
    expect(entry.changes).not.toHaveProperty("changed_by");
    expect(entry.changes).not.toHaveProperty("updatedAt");
  });

  it("omits `changes` entirely when the diff is empty or all-metadata", () => {
    const entry = buildAuditEntry({
      entityType: "customer", entityId: "c1", entityName: "Acme", action: "approve",
      changes: { changed_by: "someone", updatedAt: "2024-01-01" },
      user, t,
    });
    expect(entry.changes).toBeUndefined();
  });

  it("falls back to email when displayName is missing, then to unknownUser with no user", () => {
    const byEmail = buildAuditEntry({
      entityType: "customer", entityId: "c1", entityName: "Acme", action: "delete",
      user: { email: "no-name@example.com" }, t,
    });
    expect(byEmail.changedBy).toBe("no-name@example.com");

    const noUser = buildAuditEntry({
      entityType: "customer", entityId: "c1", entityName: "Acme", action: "delete", user: null, t,
    });
    expect(noUser.changedBy).toBe(t.unknownUser);
    expect(noUser.changedById).toBeNull();
  });
});
