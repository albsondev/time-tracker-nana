"use client";

import type { SupabaseClient } from "@supabase/supabase-js";
import { useCallback, useEffect, useMemo, useState } from "react";
import {
  calculateHourBankBalance,
  getNextEntryType,
  summarizeDay,
  WEEKLY_EXPECTED_MINUTES,
} from "@/domain/time/calculations";
import { toDateKey } from "@/domain/time/format";
import type {
  BreakCategory,
  BreakEntry,
  CalendarDayStatus,
  DailySummary,
  HourBankMovement,
  TimeEntry,
} from "@/domain/time/types";
import {
  createBreakEntry,
  createTimeEntry,
  loadUserTimeTrackingSnapshot,
  updateBreakEntry,
  updateTimeEntry,
} from "../data/time-tracking-repository";

export type TimeTrackerState = ReturnType<typeof useTimeTracker>;

type LoadingState = "idle" | "loading" | "ready" | "error";

function getMonthDays(date: Date) {
  const year = date.getFullYear();
  const month = date.getMonth();
  const days = new Date(year, month + 1, 0).getDate();

  return Array.from({ length: days }, (_, index) => {
    const day = new Date(year, month, index + 1, 12);
    return toDateKey(day);
  });
}

function getWeekDays(date: Date) {
  const current = new Date(date);
  const day = current.getDay();
  const distanceFromMonday = day === 0 ? 6 : day - 1;
  current.setDate(current.getDate() - distanceFromMonday);
  current.setHours(12, 0, 0, 0);

  return Array.from({ length: 5 }, (_, index) => {
    const weekDay = new Date(current);
    weekDay.setDate(current.getDate() + index);
    return toDateKey(weekDay);
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

function inferNextAction(entries: TimeEntry[], breaks: BreakEntry[]) {
  const baseStatus = summarizeDay({
    date: toDateKey(new Date()),
    entries,
    breaks,
    now: new Date(),
  }).status;

  if (baseStatus === "closed") return null;

  const hasArrival = entries.some((entry) => entry.type === "arrival");
  const hasLunchStart = entries.some((entry) => entry.type === "lunch_start");
  const hasLunchEnd = entries.some((entry) => entry.type === "lunch_end");
  const hasOpenBreak = breaks.some((entry) => !entry.endsAt);

  if (hasOpenBreak) return "break_end";
  if (!hasArrival) return "arrival";
  if (hasLunchStart && !hasLunchEnd) return "lunch_end";
  if (!hasLunchStart) return "lunch_start";
  if (hasLunchEnd) return "departure";

  return getNextEntryType(baseStatus);
}

export function useTimeTracker(params: {
  supabase: SupabaseClient | null;
  userId: string | null;
}) {
  const [entries, setEntries] = useState<TimeEntry[]>([]);
  const [breaks, setBreaks] = useState<BreakEntry[]>([]);
  const [movements, setMovements] = useState<HourBankMovement[]>([]);
  const [state, setState] = useState<LoadingState>("idle");
  const [error, setError] = useState<string | null>(null);
  const today = useMemo(() => new Date(), []);
  const todayKey = toDateKey(today);

  const reload = useCallback(async () => {
    if (!params.supabase || !params.userId) return;

    setState("loading");
    setError(null);

    try {
      const snapshot = await loadUserTimeTrackingSnapshot(
        params.supabase,
        params.userId,
      );
      setEntries(snapshot.entries);
      setBreaks(snapshot.breaks);
      setMovements(snapshot.movements);
      setState("ready");
    } catch (unknownError) {
      const message =
        unknownError instanceof Error
          ? unknownError.message
          : "Nao foi possivel carregar os registros.";
      setError(message);
      setState("error");
    }
  }, [params.supabase, params.userId]);

  useEffect(() => {
    queueMicrotask(() => {
      void reload();
    });
  }, [reload]);

  const todayEntries = useMemo(
    () => getEntriesForDate(entries, todayKey),
    [entries, todayKey],
  );

  const todayBreaks = useMemo(
    () => getBreaksForDate(breaks, todayKey),
    [breaks, todayKey],
  );

  const todaySummary = useMemo(
    () =>
      summarizeDay({
        date: todayKey,
        entries: todayEntries,
        breaks: todayBreaks,
        now: today,
      }),
    [today, todayBreaks, todayEntries, todayKey],
  );

  const monthDays = useMemo(() => getMonthDays(today), [today]);
  const weekDays = useMemo(() => getWeekDays(today), [today]);

  const dailySummaries = useMemo(
    () =>
      monthDays.map((date) =>
        summarizeDay({
          date,
          entries: getEntriesForDate(entries, date),
          breaks: getBreaksForDate(breaks, date),
          now: today,
        }),
      ),
    [breaks, entries, monthDays, today],
  );

  const weekDailySummaries = useMemo(
    () => dailySummaries.filter((summary) => weekDays.includes(summary.date)),
    [dailySummaries, weekDays],
  );

  const hasTodayEntries = todayEntries.length > 0;
  const hasWeekEntries = weekDailySummaries.some((summary) => summary.entries.length > 0);
  const hasHourBankMovements = movements.length > 0;

  const weekWorkedMinutes = useMemo(
    () => weekDailySummaries.reduce((total, day) => total + day.workedMinutes, 0),
    [weekDailySummaries],
  );

  const weekReferenceDelta = weekWorkedMinutes - WEEKLY_EXPECTED_MINUTES;

  const calendarDays = useMemo(
    () =>
      dailySummaries.map((summary) => ({
        date: summary.date,
        day: Number(summary.date.slice(8, 10)),
        status: getCalendarStatus(summary, todayKey),
        workedMinutes: summary.workedMinutes,
        balanceMinutes: summary.balanceMinutes,
        entries: summary.entries,
        breaks: summary.breaks,
        dayStatus: summary.status,
      })),
    [dailySummaries, todayKey],
  );

  const hourBankBalance = useMemo(
    () => calculateHourBankBalance(movements),
    [movements],
  );

  async function addTimeEntry(
    type: TimeEntry["type"],
    occurredAt: string,
    note?: string,
  ) {
    if (!params.supabase || !params.userId) return;

    setState("loading");
    await createTimeEntry(params.supabase, {
      userId: params.userId,
      type,
      occurredAt,
      note,
    });
    await reload();
  }

  async function addBreak(
    category: BreakCategory,
    startsAt: string,
    endsAt: string,
    note?: string,
  ) {
    if (!params.supabase || !params.userId) return;

    const deductsFromWork = !["medical", "sick"].includes(category);

    setState("loading");
    await createBreakEntry(params.supabase, {
      userId: params.userId,
      date: startsAt.slice(0, 10),
      category,
      startsAt,
      endsAt,
      deductsFromWork,
      note,
    });
    await reload();
  }

  async function editTimeEntry(
    entryId: string,
    type: TimeEntry["type"],
    occurredAt: string,
    note?: string,
  ) {
    if (!params.supabase || !params.userId) return;

    setState("loading");
    await updateTimeEntry(params.supabase, {
      id: entryId,
      userId: params.userId,
      type,
      occurredAt,
      note,
    });
    await reload();
  }

  async function editBreak(
    breakId: string,
    category: BreakCategory,
    startsAt: string,
    endsAt: string,
    note?: string,
  ) {
    if (!params.supabase || !params.userId) return;

    const deductsFromWork = !["medical", "sick"].includes(category);

    setState("loading");
    await updateBreakEntry(params.supabase, {
      id: breakId,
      userId: params.userId,
      date: startsAt.slice(0, 10),
      category,
      startsAt,
      endsAt,
      deductsFromWork,
      note,
    });
    await reload();
  }

  return {
    today,
    todayKey,
    entries,
    breaks,
    movements,
    todaySummary,
    hasTodayEntries,
    hasWeekEntries,
    hasHourBankMovements,
    weekWorkedMinutes,
    weekReferenceDelta,
    dailySummaries,
    calendarDays,
    hourBankBalance,
    nextEntryType: inferNextAction(todayEntries, todayBreaks),
    state,
    error,
    reload,
    addTimeEntry,
    addBreak,
    editTimeEntry,
    editBreak,
  };
}
