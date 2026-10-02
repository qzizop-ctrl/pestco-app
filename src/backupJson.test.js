import { describe, it, expect } from "vitest";
import {
  serializeForBackup, buildBackup, backupFileName, utf8ToBase64, BACKUP_FORMAT, BACKUP_VERSION,
  parseBackupText, prepareRestoreDoc, planRestore,
} from "./backupJson";

const ts = (iso) => ({ toDate: () => new Date(iso) });

describe("serializeForBackup", () => {
  it("turns Firestore Timestamps and Dates into ISO strings, at any depth", () => {
    const out = serializeForBackup({
      createdAt: ts("2026-01-02T03:04:05.000Z"),
      nested: { when: new Date("2026-02-03T00:00:00.000Z"), list: [ts("2026-03-04T00:00:00.000Z")] },
    });
    expect(out.createdAt).toBe("2026-01-02T03:04:05.000Z");
    expect(out.nested.when).toBe("2026-02-03T00:00:00.000Z");
    expect(out.nested.list[0]).toBe("2026-03-04T00:00:00.000Z");
  });

  it("drops undefined / functions in objects, keeps null, and never produces holes in arrays", () => {
    const out = serializeForBackup({ a: undefined, b: () => 1, c: null, d: [1, undefined, 3] });
    expect(out).toEqual({ c: null, d: [1, null, 3] });
  });

  it("turns NaN / Infinity into null (JSON can't hold them)", () => {
    expect(serializeForBackup({ n: NaN, i: Infinity, ok: 5 })).toEqual({ n: null, i: null, ok: 5 });
  });

  it("keeps everything the Excel backup loses: offers, activity log, visit history, last_change", () => {
    const visit = {
      id: "v1",
      companyName: "شركة",
      offers: [{ id: "o1", amount: 1000, status: "rejected", rejectionReason: "price" }],
      activityLog: [{ id: "a1", type: "call", text: "x", at: "2026-01-01T00:00:00.000Z" }],
      visitHistory: [{ id: "h1", date: "2026-01-01" }],
      last_change: { updatedBy: "a@b.c", changes: { notes: { old_value: "x", new_value: "y" } } },
      deleted: true,
    };
    expect(serializeForBackup(visit)).toEqual(visit);
  });
});

describe("buildBackup", () => {
  const now = new Date("2026-10-02T10:00:00.000Z");

  it("describes itself and counts what it holds", () => {
    const b = buildBackup({
      ownerUid: "owner1", exportedBy: "me@x.test",
      visits: [{ id: "1" }, { id: "2" }], suppliers: [{ id: "s" }], auditLog: [{ id: "a", at: ts("2026-01-01T00:00:00.000Z") }],
      now,
    });
    expect(b.format).toBe(BACKUP_FORMAT);
    expect(b.version).toBe(BACKUP_VERSION);
    expect(b.exportedAt).toBe("2026-10-02T10:00:00.000Z");
    expect(b.ownerUid).toBe("owner1");
    expect(b.exportedBy).toBe("me@x.test");
    expect(b.counts).toEqual({ visits: 2, suppliers: 1, auditLog: 1 });
    expect(b.auditLog[0].at).toBe("2026-01-01T00:00:00.000Z");
  });

  it("still produces a usable backup when the audit log could not be read, and says why", () => {
    const b = buildBackup({
      visits: [{ id: "1" }], suppliers: [], auditLog: null, auditLogError: "permission-denied", now,
    });
    expect(b.auditLog).toBeNull();
    expect(b.counts.auditLog).toBeNull();
    expect(b.auditLogError).toBe("permission-denied");
    expect(b.visits).toHaveLength(1);
  });

  it("flags a truncated audit log", () => {
    const b = buildBackup({ visits: [], suppliers: [], auditLog: [{ id: "a" }], auditLogTruncated: true, now });
    expect(b.auditLogTruncated).toBe(true);
  });

  it("survives JSON.stringify -> JSON.parse unchanged", () => {
    const b = buildBackup({ visits: [{ id: "1", companyName: "شركة النور", tags: ["vip"] }], suppliers: [], auditLog: [], now });
    expect(JSON.parse(JSON.stringify(b))).toEqual(b);
  });
});

describe("file helpers", () => {
  it("names the file by date", () => {
    expect(backupFileName("2026-10-02")).toBe("pestco_full_backup_2026-10-02.json");
  });

  it("encodes Arabic text to base64 as UTF-8 (btoa alone would throw)", () => {
    const text = JSON.stringify({ name: "شركة النور للكاميرات" });
    const decoded = new TextDecoder().decode(Uint8Array.from(atob(utf8ToBase64(text)), (c) => c.charCodeAt(0)));
    expect(decoded).toBe(text);
  });

  it("handles a large payload without overflowing the call stack", () => {
    const text = "ع".repeat(300000);
    const decoded = new TextDecoder().decode(Uint8Array.from(atob(utf8ToBase64(text)), (c) => c.charCodeAt(0)));
    expect(decoded).toBe(text);
  });
});


describe("parseBackupText", () => {
  const good = (over = {}) => JSON.stringify({
    format: BACKUP_FORMAT, version: BACKUP_VERSION,
    visits: [{ id: "v1", companyName: "شركة" }], suppliers: [{ id: "s1", name: "مورد" }], ...over,
  });

  it("accepts a file produced by buildBackup", () => {
    const text = JSON.stringify(buildBackup({
      visits: [{ id: "v1", companyName: "شركة" }], suppliers: [], auditLog: null,
    }));
    const res = parseBackupText(text);
    expect(res.ok).toBe(true);
    expect(res.backup.visits).toHaveLength(1);
  });

  it("rejects things that are not our backup", () => {
    expect(parseBackupText("not json").reason).toBe("invalid_json");
    expect(parseBackupText("[1,2]").reason).toBe("wrong_format");
    expect(parseBackupText(JSON.stringify({ format: "other", version: 1 })).reason).toBe("wrong_format");
    expect(parseBackupText(good({ version: BACKUP_VERSION + 1 })).reason).toBe("newer_version");
    expect(parseBackupText(good({ visits: [{ companyName: "no id" }] })).reason).toBe("bad_records");
    expect(parseBackupText(good({ suppliers: [{ id: "s1" }] })).reason).toBe("bad_records");
    expect(parseBackupText(good({ visits: [], suppliers: [] })).reason).toBe("empty");
  });
});

describe("prepareRestoreDoc", () => {
  it("moves id out and turns createdAt back into a Date", () => {
    const { id, data } = prepareRestoreDoc({ id: "v1", companyName: "x", createdAt: "2026-01-02T03:04:05.000Z", updatedAt: "2026-02-01T00:00:00.000Z" }, "owner1");
    expect(id).toBe("v1");
    expect(data.id).toBeUndefined();
    expect(data.createdAt).toBeInstanceOf(Date);
    expect(data.createdAt.toISOString()).toBe("2026-01-02T03:04:05.000Z");
    expect(data.updatedAt).toBe("2026-02-01T00:00:00.000Z");
  });

  it("drops an unreadable createdAt instead of writing garbage", () => {
    expect(prepareRestoreDoc({ id: "v1", companyName: "x", createdAt: "nope" }, "owner1").data.createdAt).toBeUndefined();
  });

  it("keeps the owner's own last_change but drops another member's (the rules would reject it)", () => {
    const mine = prepareRestoreDoc({ id: "v1", companyName: "x", last_change: { updatedById: "owner1" } }, "owner1");
    expect(mine.data.last_change).toBeDefined();
    expect(mine.droppedPending).toBe(false);
    const theirs = prepareRestoreDoc({ id: "v2", companyName: "x", last_change: { updatedById: "editor9" } }, "owner1");
    expect(theirs.data.last_change).toBeUndefined();
    expect(theirs.droppedPending).toBe(true);
  });
});

describe("planRestore", () => {
  const backup = {
    visits: [{ id: "a", companyName: "A" }, { id: "b", companyName: "B" }],
    suppliers: [{ id: "s1", name: "S1" }],
  };
  const existingVisits = [{ id: "b" }, { id: "c" }];

  it("merge adds only missing records and deletes nothing", () => {
    const p = planRestore(backup, existingVisits, [], "merge", "owner1");
    expect(p.visits.write.map((w) => w.id)).toEqual(["a"]);
    expect(p.visits.remove).toEqual([]);
    expect(p.suppliers.write.map((w) => w.id)).toEqual(["s1"]);
  });

  it("replace writes everything in the backup and removes the rest", () => {
    const p = planRestore(backup, existingVisits, [{ id: "old" }], "replace", "owner1");
    expect(p.visits.write.map((w) => w.id)).toEqual(["a", "b"]);
    expect(p.visits.remove).toEqual(["c"]);
    expect(p.suppliers.remove).toEqual(["old"]);
  });
});
