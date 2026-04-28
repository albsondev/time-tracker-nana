"use client";

import { useMemo, useState } from "react";
import {
  calculateHourBankBalance,
  getNextEntryType,
  summarizeDay,
  summarizeWeek,
} from "@/domain/time/calculations";
import { demoBreaks, demoEntries, demoHourBankMovements } from "@/domain/time/fixtures";
import { toDateKey } from "@/domain/time/format";
import type {
  BreakCategory,
  BreakEntry,
  CalendarDayStatus,
  DailySummary,
  HourBankMovement,
  TimeEntry,
} from "@/domain/time/types";

const demoToday = new Date("2026-04-28T16:20:00-03:00");
const userId = "demo-user";

export type TimeTrackerState = ReturnType<typeof useTimeTracker>;

function getMonthDays(date: Date) {
  const year = date.getFullYear();
  const month = date.getMonth();
  const days = new Date(year, month + 1, 0).getDate();

  return Array.from({ length: days }, (_, index) => {
    const day = new Date(year, month, index + 1, 12);
    return toDateKey(day);
  });
}

function getEntriesForDate(entries: TimeEntry[], date: string) {
  return entries.filter((entry) => entry.occurredAt.slice(0, 10) === date);
}

function getBreaksForDate(breaks: BreakEntry[], date: string) {
  return breaks.filter((entry) => entry.date === date);
}

function getCalendarStatus(summary: DailySummary, todayKey: string): CalendarDayStatus {
  if (summary.date === todayKey) return "today";
  if (summary.entries.length === 0) return "empty";
  if (summary.status !== "closed") return "pending";
  if (summary.balanceMinutes > 0) return "exceeded";
  if (summary.balanceMinutes < 0) return "negative";
  return "complete";
}

export function useTimeTracker() {
  const [entries, setEntries] = useState<TimeEntry[]>(demoEntries);
  const [breaks, setBreaks] = useState<BreakEntry[]>(demoBreaks);
  const [movements] = useState<HourBankMovement[]>(demoHourBankMovements);
  const todayKey = toDateKey(demoToday);

  const todaySummary = useMemo(
    () =>
      summarizeDay({
        date: todayKey,
        entries: getEntriesForDate(entries, todayKey),
        breaks: getBreaksForDate(breaks, todayKey),
        now: demoToday,
      }),
    [breaks, entries, todayKey],
  );

  const monthDays = useMemo(() => getMonthDays(demoToday), []);

  const dailySummaries = useMemo(
    () =>
      monthDays.map((date) =>
        summarizeDay({
          date,
          entries: getEntriesForDate(entries, date),
          breaks: getBreaksForDate(breaks, date),
          now: demoToday,
        }),
      ),
    [breaks, entries, monthDays],
  );

  const weekSummary = useMemo(
    () =>
      summarizeWeek({
        weekStartsAt: "2026-04-27",
        days: dailySummaries.filter((summary) =>
          ["2026-04-27", "2026-04-28", "2026-04-29", "2026-04-30", "2026-05-01"].includes(
            summary.date,
          ),
        ),
      }),
    [dailySummaries],
  );

  const calendarDays = useMemo(
    () =>
      dailySummaries.map((summary) => ({
        date: summary.date,
        day: Number(summary.date.slice(8, 10)),
        status: getCalendarStatus(summary, todayKey),
        workedMinutes: summary.workedMinutes,
        balanceMinutes: summary.balanceMinutes,
      })),
    [dailySummaries, todayKey],
  );

  const hourBankBalance = useMemo(
    () => calculateHourBankBalance(movements) + weekSummary.balanceMinutes,
    [movements, weekSummary.balanceMinutes],
  );

  function addTimeEntry(type: TimeEntry["type"], occurredAt: string, note?: string) {
    setEntries((current) => [
      ...current,
      {
        id: crypto.randomUUID(),
        userId,
        type,
        occurredAt,
        note,
      },
    ]);
  }

  function addBreak(category: BreakCategory, startsAt: string, note?: string) {
    const deductsFromWork = !["medical", "sick"].includes(category);

    setBreaks((current) => [
      ...current,
      {
        id: crypto.randomUUID(),
        userId,
        date: startsAt.slice(0, 10),
        category,
        startsAt,
        endsAt: new Date(new Date(startsAt).getTime() + 30 * 60000).toISOString(),
        deductsFromWork,
        note,
      },
    ]);
  }

  return {
    today: demoToday,
    todayKey,
    entries,
    breaks,
    movements,
    todaySummary,
    weekSummary,
    dailySummaries,
    calendarDays,
    hourBankBalance,
    nextEntryType: getNextEntryType(todaySummary.status),
    addTimeEntry,
    addBreak,
  };
}
