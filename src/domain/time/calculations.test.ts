import { describe, expect, it } from "vitest";
import {
  calculateHourBankBalance,
  calculateWorkedMinutes,
  getNextEntryType,
  summarizeDay,
  summarizeWeek,
  WEEKLY_EXPECTED_MINUTES,
} from "./calculations";
import type { BreakEntry, TimeEntry } from "./types";

const userId = "user-test";

function entry(id: string, type: TimeEntry["type"], occurredAt: string): TimeEntry {
  return { id, userId, type, occurredAt };
}

describe("time calculations", () => {
  it("discounts lunch and deductible breaks from the daily worked total", () => {
    const entries = [
      entry("1", "arrival", "2026-04-28T08:00:00-03:00"),
      entry("2", "lunch_start", "2026-04-28T12:00:00-03:00"),
      entry("3", "lunch_end", "2026-04-28T13:00:00-03:00"),
      entry("4", "departure", "2026-04-28T17:30:00-03:00"),
    ];
    const breaks: BreakEntry[] = [
      {
        id: "break-1",
        userId,
        date: "2026-04-28",
        category: "personal",
        startsAt: "2026-04-28T15:00:00-03:00",
        endsAt: "2026-04-28T15:20:00-03:00",
        deductsFromWork: true,
      },
    ];

    expect(calculateWorkedMinutes(entries, breaks)).toBe(490);
  });

  it("keeps medical non-deductible pauses as context without reducing worked time", () => {
    const entries = [
      entry("1", "arrival", "2026-04-28T08:00:00-03:00"),
      entry("2", "departure", "2026-04-28T14:00:00-03:00"),
    ];
    const breaks: BreakEntry[] = [
      {
        id: "break-1",
        userId,
        date: "2026-04-28",
        category: "medical",
        startsAt: "2026-04-28T10:00:00-03:00",
        endsAt: "2026-04-28T10:40:00-03:00",
        deductsFromWork: false,
      },
    ];

    expect(calculateWorkedMinutes(entries, breaks)).toBe(360);
  });

  it("summarizes a day with status and balance against the daily reference", () => {
    const summary = summarizeDay({
      date: "2026-04-28",
      entries: [
        entry("1", "arrival", "2026-04-28T08:00:00-03:00"),
        entry("2", "departure", "2026-04-28T15:00:00-03:00"),
      ],
      expectedMinutes: 360,
    });

    expect(summary.status).toBe("closed");
    expect(summary.workedMinutes).toBe(420);
    expect(summary.balanceMinutes).toBe(60);
  });

  it("creates weekly credit or debit based on the 30 hour target", () => {
    const week = summarizeWeek({
      weekStartsAt: "2026-04-27",
      days: [
        { ...summarizeDay({ date: "2026-04-27", entries: [] }), workedMinutes: 420 },
        { ...summarizeDay({ date: "2026-04-28", entries: [] }), workedMinutes: 390 },
        { ...summarizeDay({ date: "2026-04-29", entries: [] }), workedMinutes: 360 },
        { ...summarizeDay({ date: "2026-04-30", entries: [] }), workedMinutes: 360 },
        { ...summarizeDay({ date: "2026-05-01", entries: [] }), workedMinutes: 360 },
      ],
    });

    expect(week.expectedMinutes).toBe(WEEKLY_EXPECTED_MINUTES);
    expect(week.workedMinutes).toBe(1890);
    expect(week.balanceMinutes).toBe(90);
  });

  it("accumulates the hour bank movement balance", () => {
    expect(
      calculateHourBankBalance([
        { minutesDelta: 120 },
        { minutesDelta: -45 },
        { minutesDelta: 45 },
      ]),
    ).toBe(120);
  });

  it("returns the next contextual action from the day status", () => {
    expect(getNextEntryType("not_started")).toBe("arrival");
    expect(getNextEntryType("working")).toBe("lunch_start");
    expect(getNextEntryType("at_lunch")).toBe("lunch_end");
    expect(getNextEntryType("closed")).toBeNull();
  });
});
