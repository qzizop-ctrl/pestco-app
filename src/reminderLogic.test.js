import { describe, it, expect } from "vitest";
import { reminderKey, splitDueReminders, REMINDER_FRESH_WINDOW_MS } from "./reminderLogic";

const NOW = new Date("2026-06-15T12:00:00.000Z").getTime();
const at = (offsetMs) => new Date(NOW + offsetMs).toISOString();
const MIN = 60 * 1000;
const HOUR = 60 * MIN;

const visit = (id, offsetMs, extra = {}) => ({ id, callDateTime: at(offsetMs), ...extra });

describe("splitDueReminders", () => {
  it("puts a just-due reminder in `fresh`", () => {
    const { fresh, missed } = splitDueReminders([visit("a", -5 * MIN)], { now: NOW, seen: new Set() });
    expect(fresh.map((v) => v.id)).toEqual(["a"]);
    expect(missed).toEqual([]);
  });

  it("puts an old overdue reminder in `missed`, not `fresh`", () => {
    const { fresh, missed } = splitDueReminders([visit("a", -3 * HOUR)], { now: NOW, seen: new Set() });
    expect(fresh).toEqual([]);
    expect(missed.map((v) => v.id)).toEqual(["a"]);
  });

  it("treats the exact window edge as still fresh", () => {
    const { fresh } = splitDueReminders([visit("a", -REMINDER_FRESH_WINDOW_MS)], { now: NOW, seen: new Set() });
    expect(fresh).toHaveLength(1);
  });

  it("ignores reminders that are not due yet", () => {
    const { fresh, missed } = splitDueReminders([visit("a", 20 * 1000)], { now: NOW, seen: new Set() });
    expect(fresh).toEqual([]);
    expect(missed).toEqual([]);
  });

  it("skips reminders this device already fired (the viewer repeat bug)", () => {
    const v = visit("a", -1 * MIN);
    const seen = new Set([reminderKey(v)]);
    const { fresh, missed } = splitDueReminders([v], { now: NOW, seen });
    expect(fresh).toEqual([]);
    expect(missed).toEqual([]);
  });

  it("fires again when the call is rescheduled to a new time", () => {
    const original = visit("a", -10 * MIN);
    const seen = new Set([reminderKey(original)]);
    const rescheduled = { ...original, callDateTime: at(-2 * MIN) };
    const { fresh } = splitDueReminders([rescheduled], { now: NOW, seen });
    expect(fresh.map((v) => v.id)).toEqual(["a"]);
  });

  it("ignores missing or invalid call times", () => {
    const { fresh, missed } = splitDueReminders(
      [{ id: "x", callDateTime: "" }, { id: "y", callDateTime: "not a date" }, { id: "z" }, null],
      { now: NOW, seen: new Set() }
    );
    expect(fresh).toEqual([]);
    expect(missed).toEqual([]);
  });

  it("splits a mixed batch correctly", () => {
    const list = [visit("fresh1", -1 * MIN), visit("old1", -5 * HOUR), visit("old2", -30 * HOUR), visit("later", 10 * MIN)];
    const { fresh, missed } = splitDueReminders(list, { now: NOW, seen: new Set() });
    expect(fresh.map((v) => v.id)).toEqual(["fresh1"]);
    expect(missed.map((v) => v.id)).toEqual(["old1", "old2"]);
  });
});
