import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { renderHook } from "@testing-library/react";
import { STRINGS } from "../i18n";

// Everything that touches the outside world is mocked: Firestore writes, the
// beep, and the native-notification module. Notifications are captured by a
// fake `Notification` class so each test can count exactly what a person
// would have seen/heard.
const mocks = vi.hoisted(() => ({
  updateDoc: vi.fn(() => Promise.resolve()),
  doc: vi.fn((...args) => ({ path: args.slice(1).join("/") })),
  beep: vi.fn(),
  requestNotificationPermission: vi.fn(),
  syncCallReminders: vi.fn(),
}));

vi.mock("firebase/firestore", () => ({ doc: mocks.doc, updateDoc: mocks.updateDoc }));
vi.mock("../firebase", () => ({ db: {} }));
vi.mock("../sound", () => ({ beep: mocks.beep }));
vi.mock("../notifications", () => ({
  requestNotificationPermission: mocks.requestNotificationPermission,
  syncCallReminders: mocks.syncCallReminders,
}));

import { useReminders } from "./useReminders";

const t = STRINGS.en;
const NOW = new Date("2026-06-15T12:00:00.000Z");
const SEC = 1000;
const MIN = 60 * SEC;
const HOUR = 60 * MIN;
const TICK = 15 * SEC;

const at = (offsetMs) => new Date(NOW.getTime() + offsetMs).toISOString();
const visit = (id, company, contact, offsetMs, extra = {}) => ({
  id,
  companyName: company,
  contactName: contact,
  callDateTime: at(offsetMs),
  ...extra,
});

const created = [];
class FakeNotification {
  static permission = "granted";
  static requestPermission = vi.fn();
  constructor(title, options) {
    created.push({ title, body: options && options.body });
  }
}

const base = { user: { uid: "u1" }, ownerUid: "owner1", canEdit: true, t, visitsLoaded: true };

beforeEach(() => {
  vi.clearAllMocks();
  created.length = 0;
  vi.stubGlobal("Notification", FakeNotification);
  // Fake only what the hook uses, so React/RTL internals keep real timers.
  vi.useFakeTimers({ toFake: ["setInterval", "clearInterval", "Date"] });
  vi.setSystemTime(NOW);
});

afterEach(() => {
  vi.useRealTimers();
  vi.unstubAllGlobals();
});

describe("useReminders — in-app alerts", () => {
  it("alerts once for a just-due reminder and marks it notified (editor)", () => {
    const visits = [visit("v1", "Acme", "Ali", -5 * MIN)];
    renderHook(() => useReminders({ ...base, visits }));

    vi.advanceTimersByTime(TICK * 3); // several ticks — must still fire only once

    expect(created).toHaveLength(1);
    expect(created[0].title).toBe(`${t.reminderTitle} Acme`);
    expect(created[0].body).toBe(t.reminderBody("Ali"));
    expect(mocks.beep).toHaveBeenCalledTimes(1);
    expect(mocks.updateDoc).toHaveBeenCalledTimes(1);
    expect(mocks.updateDoc.mock.calls[0][1]).toEqual({ notified: true });
    expect(mocks.doc).toHaveBeenCalledWith(expect.anything(), "users", "owner1", "visits", "v1");
  });

  it("does NOT repeat every tick for a viewer, who can never write `notified`", () => {
    const visits = [visit("v1", "Acme", "Ali", -5 * MIN)];
    renderHook(() => useReminders({ ...base, canEdit: false, visits }));

    vi.advanceTimersByTime(TICK * 6);

    expect(created).toHaveLength(1);
    expect(mocks.beep).toHaveBeenCalledTimes(1);
    expect(mocks.updateDoc).not.toHaveBeenCalled();
  });

  it("collapses long-overdue reminders into one summary instead of one alert each", () => {
    const visits = [
      visit("fresh", "Fresh Co", "Fay", -2 * MIN),
      visit("old1", "Old One", "A", -3 * HOUR),
      visit("old2", "Old Two", "B", -30 * HOUR),
      visit("old3", "Old Three", "C", -80 * HOUR),
    ];
    renderHook(() => useReminders({ ...base, visits }));

    vi.advanceTimersByTime(TICK);

    expect(created).toHaveLength(2);
    expect(created[0].title).toBe(`${t.reminderTitle} Fresh Co`);
    expect(created[1].title).toBe(t.remindersMissedTitle);
    expect(created[1].body).toBe(t.remindersMissedBody(3));
    expect(mocks.beep).toHaveBeenCalledTimes(1); // one sound for the whole batch
    expect(mocks.updateDoc).toHaveBeenCalledTimes(4); // all four get marked notified
  });

  it("waits until the reminder is actually due", () => {
    const visits = [visit("v1", "Acme", "Ali", 20 * SEC)];
    renderHook(() => useReminders({ ...base, visits }));

    vi.advanceTimersByTime(TICK); // t+15s: still 5s early
    expect(created).toHaveLength(0);

    vi.advanceTimersByTime(TICK); // t+30s: due
    expect(created).toHaveLength(1);
  });

  it("alerts again when the call is rescheduled to a new time", () => {
    const original = visit("v1", "Acme", "Ali", -5 * MIN);
    const { rerender } = renderHook((props) => useReminders(props), {
      initialProps: { ...base, visits: [original] },
    });
    vi.advanceTimersByTime(TICK);
    expect(created).toHaveLength(1);

    // Someone reschedules: new call time, `notified` reset to false.
    rerender({ ...base, visits: [{ ...original, callDateTime: at(10 * SEC), notified: false }] });
    vi.advanceTimersByTime(TICK);

    expect(created).toHaveLength(2);
  });

  it("ignores reminders for soft-deleted customers", () => {
    const visits = [visit("v1", "Acme", "Ali", -5 * MIN, { deleted: true })];
    renderHook(() => useReminders({ ...base, visits }));
    vi.advanceTimersByTime(TICK * 2);
    expect(created).toHaveLength(0);
    expect(mocks.beep).not.toHaveBeenCalled();
  });

  it("ignores reminders already marked notified", () => {
    const visits = [visit("v1", "Acme", "Ali", -5 * MIN, { notified: true })];
    renderHook(() => useReminders({ ...base, visits }));
    vi.advanceTimersByTime(TICK * 2);
    expect(created).toHaveLength(0);
  });

  it("does nothing until the first snapshot has loaded", () => {
    const visits = [visit("v1", "Acme", "Ali", -5 * MIN)];
    renderHook(() => useReminders({ ...base, visitsLoaded: false, visits }));
    vi.advanceTimersByTime(TICK * 2);
    expect(created).toHaveLength(0);
    expect(mocks.syncCallReminders).not.toHaveBeenCalled();
  });

  it("does nothing when signed out", () => {
    const visits = [visit("v1", "Acme", "Ali", -5 * MIN)];
    renderHook(() => useReminders({ ...base, user: null, visits }));
    vi.advanceTimersByTime(TICK * 2);
    expect(created).toHaveLength(0);
  });
});

describe("useReminders — native sync", () => {
  it("hands the live visit list to the native reminder sync once loaded", () => {
    const visits = [visit("v1", "Acme", "Ali", 30 * MIN)];
    renderHook(() => useReminders({ ...base, visits }));
    expect(mocks.syncCallReminders).toHaveBeenCalledWith(visits, t);
  });

  it("asks for notification permission on mount", () => {
    renderHook(() => useReminders({ ...base, visits: [] }));
    expect(mocks.requestNotificationPermission).toHaveBeenCalledTimes(1);
  });
});
