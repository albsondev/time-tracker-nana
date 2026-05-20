import { describe, expect, it } from "vitest";
import {
  calculateAutomaticWeeklyBankMovements,
  calculateHourBankBalance,
  calculateWorkedMinutes,
  getNextEntryType,
  summarizeDay,
  summarizeWeek,
  WEEKLY_EXPECTED_MINUTES,
} from "./calculations";
import type { BreakEntry, DayMark, TimeEntry } from "./types";

const userId = "user-test";

function entry(id: string, type: TimeEntry["type"], occurredAt: string): TimeEntry {
  return { id, userId, type, occurredAt };
}

function mark(id: string, date: string, type: DayMark["type"]): DayMark {
  return { id, userId, date, type };
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

  it("uses zero expected minutes for a marked holiday", () => {
    const summary = summarizeDay({
      date: "2026-05-01",
      entries: [],
      mark: {
        id: "mark-1",
        userId,
        date: "2026-05-01",
        type: "holiday",
      },
    });

    expect(summary.balanceMinutes).toBe(0);
    expect(summary.mark?.type).toBe("holiday");
  });

  it("ignores a cleared day without deleting its records", () => {
    const summary = summarizeDay({
      date: "2026-04-29",
      entries: [
        entry("1", "arrival", "2026-04-29T08:00:00-03:00"),
        entry("2", "departure", "2026-04-29T15:00:00-03:00"),
      ],
      mark: {
        id: "excluded-1",
        userId,
        date: "2026-04-29",
        type: "excluded",
      },
    });

    expect(summary.entries).toHaveLength(2);
    expect(summary.workedMinutes).toBe(0);
    expect(summary.breakMinutes).toBe(0);
    expect(summary.balanceMinutes).toBe(0);
  });

  it("does not debit a day justified by a medical certificate", () => {
    const summary = summarizeDay({
      date: "2026-05-06",
      entries: [],
      mark: {
        id: "medical-1",
        userId,
        date: "2026-05-06",
        type: "medical_leave",
      },
    });

    expect(summary.workedMinutes).toBe(0);
    expect(summary.balanceMinutes).toBe(0);
    expect(summary.mark?.type).toBe("medical_leave");
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

  it("reduces the weekly target when a weekday is a holiday", () => {
    const week = summarizeWeek({
      weekStartsAt: "2026-04-27",
      days: [
        { ...summarizeDay({ date: "2026-04-27", entries: [] }), workedMinutes: 360 },
        { ...summarizeDay({ date: "2026-04-28", entries: [] }), workedMinutes: 360 },
        { ...summarizeDay({ date: "2026-04-29", entries: [] }), workedMinutes: 360 },
        { ...summarizeDay({ date: "2026-04-30", entries: [] }), workedMinutes: 360 },
        summarizeDay({
          date: "2026-05-01",
          entries: [],
          mark: {
            id: "holiday-1",
            userId,
            date: "2026-05-01",
            type: "holiday",
          },
        }),
      ],
    });

    expect(week.expectedMinutes).toBe(24 * 60);
    expect(week.balanceMinutes).toBe(0);
  });

  it("reduces the weekly target when a weekday is cleared", () => {
    const week = summarizeWeek({
      weekStartsAt: "2026-04-27",
      days: [
        { ...summarizeDay({ date: "2026-04-27", entries: [] }), workedMinutes: 360 },
        { ...summarizeDay({ date: "2026-04-28", entries: [] }), workedMinutes: 360 },
        { ...summarizeDay({ date: "2026-04-29", entries: [] }), workedMinutes: 360 },
        { ...summarizeDay({ date: "2026-04-30", entries: [] }), workedMinutes: 360 },
        summarizeDay({
          date: "2026-05-01",
          entries: [
            entry("1", "arrival", "2026-05-01T08:00:00-03:00"),
            entry("2", "departure", "2026-05-01T15:00:00-03:00"),
          ],
          mark: {
            id: "excluded-1",
            userId,
            date: "2026-05-01",
            type: "excluded",
          },
        }),
      ],
    });

    expect(week.expectedMinutes).toBe(24 * 60);
    expect(week.balanceMinutes).toBe(0);
  });

  it("reduces the weekly target when a weekday has a medical certificate", () => {
    const week = summarizeWeek({
      weekStartsAt: "2026-05-04",
      days: [
        { ...summarizeDay({ date: "2026-05-04", entries: [] }), workedMinutes: 360 },
        { ...summarizeDay({ date: "2026-05-05", entries: [] }), workedMinutes: 360 },
        summarizeDay({
          date: "2026-05-06",
          entries: [],
          mark: {
            id: "medical-1",
            userId,
            date: "2026-05-06",
            type: "medical_leave",
          },
        }),
        { ...summarizeDay({ date: "2026-05-07", entries: [] }), workedMinutes: 360 },
        { ...summarizeDay({ date: "2026-05-08", entries: [] }), workedMinutes: 360 },
      ],
    });

    expect(week.expectedMinutes).toBe(24 * 60);
    expect(week.balanceMinutes).toBe(0);
  });

  it("does not keep counting an old day without departure until now", () => {
    const summary = summarizeDay({
      date: "2026-04-28",
      entries: [entry("1", "arrival", "2026-04-28T08:00:00-03:00")],
      now: new Date("2026-05-04T15:00:00-03:00"),
    });

    expect(summary.status).toBe("working");
    expect(summary.workedMinutes).toBe(0);
  });

  it("closes the day when departure is recorded before the lunch return", () => {
    const summary = summarizeDay({
      date: "2026-05-20",
      entries: [
        entry("1", "arrival", "2026-05-20T08:00:00-03:00"),
        entry("2", "lunch_start", "2026-05-20T12:00:00-03:00"),
        entry("3", "departure", "2026-05-20T12:00:00-03:00"),
      ],
    });

    expect(summary.status).toBe("closed");
    expect(summary.workedMinutes).toBe(240);
    expect(summary.balanceMinutes).toBe(-120);
  });

  it("does not debit a manually completed short day", () => {
    const summary = summarizeDay({
      date: "2026-05-15",
      entries: [
        entry("1", "arrival", "2026-05-15T08:00:00-03:00"),
        entry("2", "departure", "2026-05-15T12:30:00-03:00"),
      ],
      mark: mark("completed-1", "2026-05-15", "completed"),
    });

    expect(summary.status).toBe("closed");
    expect(summary.workedMinutes).toBe(270);
    expect(summary.balanceMinutes).toBe(0);
  });

  it("creates automatic weekly hour bank credit above 30 hours", () => {
    const closedCredit = summarizeDay({
      date: "2026-05-05",
      entries: [
        entry("1", "arrival", "2026-05-05T08:00:00-03:00"),
        entry("2", "departure", "2026-05-05T20:00:00-03:00"),
      ],
    });
    const secondClosedCredit = summarizeDay({
      date: "2026-05-06",
      entries: [
        entry("3", "arrival", "2026-05-06T08:00:00-03:00"),
        entry("4", "departure", "2026-05-06T20:00:00-03:00"),
      ],
    });
    const thirdClosedCredit = summarizeDay({
      date: "2026-05-07",
      entries: [
        entry("5", "arrival", "2026-05-07T08:00:00-03:00"),
        entry("6", "departure", "2026-05-07T20:00:00-03:00"),
      ],
    });
    const movements = calculateAutomaticWeeklyBankMovements(
      [closedCredit, secondClosedCredit, thirdClosedCredit],
      undefined,
      new Date("2026-05-11T15:00:00-03:00"),
    );

    expect(movements).toHaveLength(1);
    expect(movements[0].description).toBe(
      "Crédito automático da semana 04/maio/2026 a 10/maio/2026",
    );
    expect(movements[0].minutesDelta).toBe(360);
    expect(movements[0].details).toHaveLength(5);
  });

  it("creates automatic weekly hour bank debit below 30 hours", () => {
    const movements = calculateAutomaticWeeklyBankMovements(
      [
        summarizeDay({
          date: "2026-05-04",
          entries: [
            entry("1", "arrival", "2026-05-04T08:00:00-03:00"),
            entry("2", "departure", "2026-05-04T14:00:00-03:00"),
          ],
        }),
        summarizeDay({
          date: "2026-05-05",
          entries: [
            entry("3", "arrival", "2026-05-05T08:00:00-03:00"),
            entry("4", "departure", "2026-05-05T14:00:00-03:00"),
          ],
        }),
        summarizeDay({
          date: "2026-05-06",
          entries: [
            entry("5", "arrival", "2026-05-06T08:00:00-03:00"),
            entry("6", "departure", "2026-05-06T14:00:00-03:00"),
          ],
        }),
        summarizeDay({
          date: "2026-05-07",
          entries: [
            entry("7", "arrival", "2026-05-07T08:00:00-03:00"),
            entry("8", "departure", "2026-05-07T14:00:00-03:00"),
          ],
        }),
      ],
      undefined,
      new Date("2026-05-11T15:00:00-03:00"),
    );

    expect(movements).toHaveLength(1);
    expect(movements[0].description).toBe(
      "Débito automático da semana 04/maio/2026 a 10/maio/2026",
    );
    expect(movements[0].minutesDelta).toBe(-360);
    expect(movements[0].details?.at(4)?.date).toBe("2026-05-08");
    expect(movements[0].details?.at(4)?.workedMinutes).toBe(0);
  });

  it("does not create weekly debit for a manually completed short day", () => {
    const movements = calculateAutomaticWeeklyBankMovements(
      [
        summarizeDay({
          date: "2026-05-11",
          entries: [
            entry("1", "arrival", "2026-05-11T08:00:00-03:00"),
            entry("2", "departure", "2026-05-11T12:30:00-03:00"),
          ],
          mark: mark("completed-1", "2026-05-11", "completed"),
        }),
        summarizeDay({
          date: "2026-05-12",
          entries: [
            entry("3", "arrival", "2026-05-12T08:00:00-03:00"),
            entry("4", "departure", "2026-05-12T14:00:00-03:00"),
          ],
        }),
        summarizeDay({
          date: "2026-05-13",
          entries: [
            entry("5", "arrival", "2026-05-13T08:00:00-03:00"),
            entry("6", "departure", "2026-05-13T14:00:00-03:00"),
          ],
        }),
        summarizeDay({
          date: "2026-05-14",
          entries: [
            entry("7", "arrival", "2026-05-14T08:00:00-03:00"),
            entry("8", "departure", "2026-05-14T14:00:00-03:00"),
          ],
        }),
        summarizeDay({
          date: "2026-05-15",
          entries: [
            entry("9", "arrival", "2026-05-15T08:00:00-03:00"),
            entry("10", "departure", "2026-05-15T14:00:00-03:00"),
          ],
        }),
      ],
      undefined,
      new Date("2026-05-18T09:00:00-03:00"),
    );

    expect(movements).toHaveLength(0);
  });

  it("does not create weekly debit when the missing day is a holiday", () => {
    const movements = calculateAutomaticWeeklyBankMovements(
      [
        summarizeDay({
          date: "2026-04-27",
          entries: [
            entry("1", "arrival", "2026-04-27T08:00:00-03:00"),
            entry("2", "departure", "2026-04-27T14:00:00-03:00"),
          ],
        }),
        summarizeDay({
          date: "2026-04-28",
          entries: [
            entry("3", "arrival", "2026-04-28T08:00:00-03:00"),
            entry("4", "departure", "2026-04-28T14:00:00-03:00"),
          ],
        }),
        summarizeDay({
          date: "2026-04-29",
          entries: [
            entry("5", "arrival", "2026-04-29T08:00:00-03:00"),
            entry("6", "departure", "2026-04-29T14:00:00-03:00"),
          ],
        }),
        summarizeDay({
          date: "2026-04-30",
          entries: [
            entry("7", "arrival", "2026-04-30T08:00:00-03:00"),
            entry("8", "departure", "2026-04-30T14:00:00-03:00"),
          ],
        }),
        summarizeDay({
          date: "2026-05-01",
          entries: [],
          mark: {
            id: "holiday-1",
            userId,
            date: "2026-05-01",
            type: "holiday",
          },
        }),
      ],
      undefined,
      new Date("2026-05-04T15:00:00-03:00"),
    );

    expect(movements).toHaveLength(0);
  });

  it("does not create weekly debit when the missing day is a national holiday", () => {
    const movements = calculateAutomaticWeeklyBankMovements(
      [
        summarizeDay({
          date: "2026-04-27",
          entries: [
            entry("1", "arrival", "2026-04-27T08:00:00-03:00"),
            entry("2", "departure", "2026-04-27T14:00:00-03:00"),
          ],
        }),
        summarizeDay({
          date: "2026-04-28",
          entries: [
            entry("3", "arrival", "2026-04-28T08:00:00-03:00"),
            entry("4", "departure", "2026-04-28T14:00:00-03:00"),
          ],
        }),
        summarizeDay({
          date: "2026-04-29",
          entries: [
            entry("5", "arrival", "2026-04-29T08:00:00-03:00"),
            entry("6", "departure", "2026-04-29T14:00:00-03:00"),
          ],
        }),
        summarizeDay({
          date: "2026-04-30",
          entries: [
            entry("7", "arrival", "2026-04-30T08:00:00-03:00"),
            entry("8", "departure", "2026-04-30T14:00:00-03:00"),
          ],
        }),
      ],
      undefined,
      new Date("2026-05-04T15:00:00-03:00"),
    );

    expect(movements).toHaveLength(0);
  });

  it("does not create weekly debit for launch week days marked as cleared", () => {
    const movements = calculateAutomaticWeeklyBankMovements(
      [
        summarizeDay({
          date: "2026-04-27",
          entries: [],
          mark: {
            id: "excluded-1",
            userId,
            date: "2026-04-27",
            type: "excluded",
          },
        }),
        summarizeDay({
          date: "2026-04-28",
          entries: [],
          mark: {
            id: "excluded-2",
            userId,
            date: "2026-04-28",
            type: "excluded",
          },
        }),
        summarizeDay({
          date: "2026-04-29",
          entries: [],
          mark: {
            id: "excluded-3",
            userId,
            date: "2026-04-29",
            type: "excluded",
          },
        }),
        summarizeDay({
          date: "2026-04-30",
          entries: [
            entry("1", "arrival", "2026-04-30T08:00:00-03:00"),
            entry("2", "departure", "2026-04-30T14:00:00-03:00"),
          ],
        }),
        summarizeDay({
          date: "2026-05-01",
          entries: [
            entry("3", "arrival", "2026-05-01T08:00:00-03:00"),
            entry("4", "departure", "2026-05-01T14:00:00-03:00"),
          ],
        }),
      ],
      undefined,
      new Date("2026-05-04T15:00:00-03:00"),
    );

    expect(movements).toHaveLength(0);
  });

  it("does not create weekly debit for a medical certificate absence", () => {
    const movements = calculateAutomaticWeeklyBankMovements(
      [
        summarizeDay({
          date: "2026-05-04",
          entries: [
            entry("1", "arrival", "2026-05-04T08:00:00-03:00"),
            entry("2", "departure", "2026-05-04T14:00:00-03:00"),
          ],
        }),
        summarizeDay({
          date: "2026-05-05",
          entries: [
            entry("3", "arrival", "2026-05-05T08:00:00-03:00"),
            entry("4", "departure", "2026-05-05T14:00:00-03:00"),
          ],
        }),
        summarizeDay({
          date: "2026-05-06",
          entries: [],
          mark: {
            id: "medical-1",
            userId,
            date: "2026-05-06",
            type: "medical_leave",
          },
        }),
        summarizeDay({
          date: "2026-05-07",
          entries: [
            entry("5", "arrival", "2026-05-07T08:00:00-03:00"),
            entry("6", "departure", "2026-05-07T14:00:00-03:00"),
          ],
        }),
        summarizeDay({
          date: "2026-05-08",
          entries: [
            entry("7", "arrival", "2026-05-08T08:00:00-03:00"),
            entry("8", "departure", "2026-05-08T14:00:00-03:00"),
          ],
        }),
      ],
      undefined,
      new Date("2026-05-11T15:00:00-03:00"),
    );

    expect(movements).toHaveLength(0);
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
