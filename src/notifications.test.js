import { describe, it, expect, vi, beforeEach } from "vitest";

// syncCallReminders keeps module-level state (what it already scheduled this
// session), so each test loads a fresh copy of the module.
const native = vi.hoisted(() => ({
  isNative: true,
  cancel: vi.fn(() => Promise.resolve()),
  schedule: vi.fn(() => Promise.resolve()),
  reportException: vi.fn(),
}));

vi.mock("@capacitor/core", () => ({ Capacitor: { isNativePlatform: () => native.isNative } }));
vi.mock("@capacitor/local-notifications", () => ({
  LocalNotifications: {
    cancel: native.cancel,
    schedule: native.schedule,
    requestPermissions: vi.fn(() => Promise.resolve()),
  },
}));
vi.mock("./sentry", () => ({ reportException: native.reportException }));

const t = { reminderTitle: "Follow-up:", reminderBody: (c) => `call ${c}` };
const inMinutes = (m) => new Date(Date.now() + m * 60000).toISOString();

let sync;
let MAX;

beforeEach(async () => {
  vi.clearAllMocks();
  // clearAllMocks keeps implementations, so undo any rejection a test set up.
  native.cancel.mockImplementation(() => Promise.resolve());
  native.schedule.mockImplementation(() => Promise.resolve());
  native.isNative = true;
  localStorage.clear();
  vi.resetModules();
  ({ syncCallReminders: sync, MAX_SCHEDULED_REMINDERS: MAX } = await import("./notifications"));
});

const scheduledCalls = () => native.schedule.mock.calls.map((c) => c[0].notifications);
const cancelledIds = () => native.cancel.mock.calls.flatMap((c) => c[0].notifications.map((n) => n.id));

describe("syncCallReminders", () => {
  const visits = () => [
    { id: "a", companyName: "Acme", contactName: "Ali", callDateTime: inMinutes(30) },
    { id: "b", companyName: "Beta", contactName: "Bo", callDateTime: inMinutes(60) },
    { id: "past", companyName: "Old", contactName: "X", callDateTime: inMinutes(-30) },
    { id: "done", companyName: "Done", contactName: "D", callDateTime: inMinutes(90), notified: true },
    { id: "del", companyName: "Del", contactName: "D", callDateTime: inMinutes(90), deleted: true },
    { id: "none", companyName: "None", contactName: "N", callDateTime: "" },
  ];

  it("schedules only future, un-notified, non-deleted reminders", async () => {
    await sync(visits(), t);
    const [batch] = scheduledCalls();
    expect(batch).toHaveLength(2);
    expect(batch[0].title).toBe("Follow-up: Acme");
    expect(batch[0].body).toBe("call Ali");
  });

  it("does nothing on web/Windows", async () => {
    native.isNative = false;
    await sync(visits(), t);
    expect(native.schedule).not.toHaveBeenCalled();
    expect(native.cancel).not.toHaveBeenCalled();
  });

  it("makes no native calls when nothing changed", async () => {
    const list = visits();
    await sync(list, t);
    vi.clearAllMocks();
    await sync(list, t);
    expect(native.schedule).not.toHaveBeenCalled();
    expect(native.cancel).not.toHaveBeenCalled();
  });

  it("cancels a reminder another device already marked notified", async () => {
    const list = visits();
    await sync(list, t);
    const idA = scheduledCalls()[0][0].id;
    vi.clearAllMocks();

    await sync(list.map((v) => (v.id === "a" ? { ...v, notified: true } : v)), t);
    expect(cancelledIds()).toEqual([idA]);
    expect(native.schedule).not.toHaveBeenCalled();
  });

  it("cancels the reminder of a customer deleted elsewhere", async () => {
    const list = visits();
    await sync(list, t);
    const idB = scheduledCalls()[0][1].id;
    vi.clearAllMocks();

    await sync(list.map((v) => (v.id === "b" ? { ...v, deleted: true } : v)), t);
    expect(cancelledIds()).toEqual([idB]);
  });

  it("re-schedules a moved reminder under the SAME id, cancelling first", async () => {
    const list = visits();
    await sync(list, t);
    const idB = scheduledCalls()[0][1].id;
    vi.clearAllMocks();

    await sync(list.map((v) => (v.id === "b" ? { ...v, callDateTime: inMinutes(120) } : v)), t);
    expect(cancelledIds()).toContain(idB);
    expect(scheduledCalls()[0]).toHaveLength(1);
    expect(scheduledCalls()[0][0].id).toBe(idB);
  });

  it("never cancels anything for an empty list (e.g. other workspace / not loaded)", async () => {
    await sync(visits(), t);
    vi.clearAllMocks();
    await sync([], t);
    expect(native.cancel).not.toHaveBeenCalled();
    expect(native.schedule).not.toHaveBeenCalled();
  });

  it("caps pending reminders to the soonest MAX_SCHEDULED_REMINDERS", async () => {
    const many = Array.from({ length: MAX + 25 }, (_, i) => ({
      id: `m${i}`, companyName: `C${i}`, contactName: "c", callDateTime: inMinutes(200 + i),
    }));
    await sync(many, t);
    const [batch] = scheduledCalls();
    expect(batch).toHaveLength(MAX);
    expect(batch[0].title).toBe("Follow-up: C0");
    expect(new Set(batch.map((n) => n.id)).size).toBe(MAX); // unique ids
  });

  it("reports a failure once per session, not on every sync", async () => {
    native.schedule.mockRejectedValue(new Error("permission denied"));
    const list = visits();
    await sync(list, t);
    await sync([...list, { id: "c", companyName: "Gamma", contactName: "G", callDateTime: inMinutes(45) }], t);
    expect(native.reportException).toHaveBeenCalledTimes(1);
  });
});
