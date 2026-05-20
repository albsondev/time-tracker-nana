"use client";

import type { SupabaseClient } from "@supabase/supabase-js";
import { useCallback, useEffect, useMemo, useState } from "react";
import {
  calculateAutomaticWeeklyBankMovements,
  calculateHourBankBalance,
  DAILY_REFERENCE_MINUTES,
  getNextEntryType,
  summarizeDay,
  WEEKLY_EXPECTED_MINUTES,
} from "@/domain/time/calculations";
import { toDateKey } from "@/domain/time/format";
import { getNationalHoliday } from "@/domain/time/holidays";
import type {
  BreakCategory,
  BreakEntry,
  CalendarDayStatus,
  DailySummary,
  DayMark,
  HourBankMovement,
  TimeEntry,
} from "@/domain/time/types";
import {
  createBreakEntry,
  createTimeEntry,
  deleteDayMark,
  loadUserTimeTrackingSnapshot,
  updateBreakEntry,
  updateTimeEntry,
  upsertDayMark,
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
  return entries.filter((entry) => toDateKey(new Date(entry.occurredAt)) === date);
}

function getBreaksForDate(breaks: BreakEntry[], date: string) {
  return breaks.filter((entry) => entry.date === date);
}

function getMarkForDate(marks: DayMark[], date: string) {
  const excludedMark = marks.find(
    (mark) => mark.date === date && mark.type === "excluded",
  );

  if (excludedMark) return excludedMark;

  const medicalLeaveMark = marks.find(
    (mark) => mark.date === date && mark.type === "medical_leave",
  );

  if (medicalLeaveMark) return medicalLeaveMark;

  return (
    marks.find((mark) => mark.date === date && mark.type === "holiday") ??
    getNationalHoliday(date) ??
    marks.find((mark) => mark.date === date && mark.type === "completed")
  );
}

function summarizeDates(params: {
  dates: string[];
  entries: TimeEntry[];
  breaks: BreakEntry[];
  marks: DayMark[];
  now: Date;
}) {
  return params.dates.map((date) =>
    summarizeDay({
      date,
      entries: getEntriesForDate(params.entries, date),
      breaks: getBreaksForDate(params.breaks, date),
      mark: getMarkForDate(params.marks, date),
      now: params.now,
    }),
  );
}

function getRegisteredDates(
  entries: TimeEntry[],
  breaks: BreakEntry[],
  marks: DayMark[],
) {
  return Array.from(
    new Set([
      ...entries.map((entry) => toDateKey(new Date(entry.occurredAt))),
      ...breaks.map((entry) => entry.date),
      ...marks.map((mark) => mark.date),
    ]),
  ).sort((first, second) => second.localeCompare(first));
}

function getCalendarStatus(summary: DailySummary, todayKey: string): CalendarDayStatus {
  if (summary.mark?.type === "excluded") return "excluded";
  if (summary.mark?.type === "medical_leave") return "medical_leave";
  if (summary.mark?.type === "holiday") return "holiday";
  if (summary.mark?.type === "completed") return "completed";
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

function canCloseDayDirectly(entries: TimeEntry[], breaks: BreakEntry[]) {
  const summary = summarizeDay({
    date: toDateKey(new Date()),
    entries,
    breaks,
    now: new Date(),
  });
  const hasArrival = entries.some((entry) => entry.type === "arrival");

  return hasArrival && summary.status !== "closed";
}

export function useTimeTracker(params: {
  supabase: SupabaseClient | null;
  userId: string | null;
}) {
  const [entries, setEntries] = useState<TimeEntry[]>([]);
  const [breaks, setBreaks] = useState<BreakEntry[]>([]);
  const [marks, setMarks] = useState<DayMark[]>([]);
  const [movements, setMovements] = useState<HourBankMovement[]>([]);
  const [state, setState] = useState<LoadingState>("idle");
  const [error, setError] = useState<string | null>(null);
  const today = useMemo(() => new Date(), []);
  const [calendarMonth, setCalendarMonth] = useState(() => {
    const initialMonth = new Date();
    initialMonth.setDate(1);
    initialMonth.setHours(12, 0, 0, 0);
    return initialMonth;
  });
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
      setMarks(snapshot.marks);
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
  const calendarMonthDays = useMemo(
    () => getMonthDays(calendarMonth),
    [calendarMonth],
  );
  const weekDays = useMemo(() => getWeekDays(today), [today]);

  const dailySummaries = useMemo(
    () =>
      summarizeDates({
        dates: monthDays,
        entries,
        breaks,
        marks,
        now: today,
      }),
    [breaks, entries, marks, monthDays, today],
  );

  const weekDailySummaries = useMemo(
    () =>
      summarizeDates({
        dates: weekDays,
        entries,
        breaks,
        marks,
        now: today,
      }),
    [breaks, entries, marks, today, weekDays],
  );

  const calendarDailySummaries = useMemo(
    () =>
      summarizeDates({
        dates: calendarMonthDays,
        entries,
        breaks,
        marks,
        now: today,
      }),
    [breaks, calendarMonthDays, entries, marks, today],
  );

  const historySummaries = useMemo(
    () =>
      summarizeDates({
        dates: getRegisteredDates(entries, breaks, marks),
        entries,
        breaks,
        marks,
        now: today,
      }),
    [breaks, entries, marks, today],
  );

  const hasTodayEntries = todayEntries.length > 0;
  const hasWeekEntries = weekDailySummaries.some((summary) => summary.entries.length > 0);
  const weekWorkedMinutes = useMemo(
    () => weekDailySummaries.reduce((total, day) => total + day.workedMinutes, 0),
    [weekDailySummaries],
  );

  const weekExpectedMinutes = useMemo(
    () =>
      Math.min(
        WEEKLY_EXPECTED_MINUTES,
        weekDailySummaries.reduce(
          (total, day) => {
            const isNonWorkingDay =
              day.mark?.type === "holiday" ||
              day.mark?.type === "excluded" ||
              day.mark?.type === "medical_leave";

            return total + (isNonWorkingDay ? 0 : DAILY_REFERENCE_MINUTES);
          },
          0,
        ),
      ),
    [weekDailySummaries],
  );

  const weekReferenceDelta = weekWorkedMinutes - weekExpectedMinutes;

  const calendarDays = useMemo(
    () =>
      calendarDailySummaries.map((summary) => ({
        date: summary.date,
        day: Number(summary.date.slice(8, 10)),
        status: getCalendarStatus(summary, todayKey),
        workedMinutes: summary.workedMinutes,
        balanceMinutes: summary.balanceMinutes,
        entries: summary.entries,
        breaks: summary.breaks,
        mark: summary.mark,
        dayStatus: summary.status,
      })),
    [calendarDailySummaries, todayKey],
  );

  function moveCalendarMonth(monthDelta: number) {
    setCalendarMonth((current) => {
      const nextMonth = new Date(current);
      nextMonth.setMonth(current.getMonth() + monthDelta, 1);
      nextMonth.setHours(12, 0, 0, 0);
      return nextMonth;
    });
  }

  function resetCalendarMonth() {
    const currentMonth = new Date(today);
    currentMonth.setDate(1);
    currentMonth.setHours(12, 0, 0, 0);
    setCalendarMonth(currentMonth);
  }

  const automaticHourBankMovements = useMemo(
    () => calculateAutomaticWeeklyBankMovements(historySummaries, undefined, today),
    [historySummaries, today],
  );

  const hourBankMovements = useMemo(
    () =>
      [
        ...automaticHourBankMovements,
        ...movements.filter((movement) => movement.source !== "weekly_balance"),
      ].sort((first, second) => second.date.localeCompare(first.date)),
    [automaticHourBankMovements, movements],
  );

  const hasHourBankMovements = hourBankMovements.length > 0;

  const hourBankBalance = useMemo(
    () => calculateHourBankBalance(hourBankMovements),
    [hourBankMovements],
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
    if (type === "departure") {
      await upsertDayMark(params.supabase, {
        userId: params.userId,
        date: toDateKey(new Date(occurredAt)),
        type: "completed",
        note: "Expediente encerrado manualmente: dia concluído sem débito.",
      });
    }
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
      date: toDateKey(new Date(startsAt)),
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

    const previousEntry = entries.find((entry) => entry.id === entryId);

    setState("loading");
    await updateTimeEntry(params.supabase, {
      id: entryId,
      userId: params.userId,
      type,
      occurredAt,
      note,
    });
    const previousDate = previousEntry
      ? toDateKey(new Date(previousEntry.occurredAt))
      : null;
    const nextDate = toDateKey(new Date(occurredAt));
    if (
      previousEntry?.type === "departure" &&
      previousDate &&
      (type !== "departure" || previousDate !== nextDate)
    ) {
      await deleteDayMark(params.supabase, {
        userId: params.userId,
        date: previousDate,
        type: "completed",
      });
    }
    if (type === "departure") {
      await upsertDayMark(params.supabase, {
        userId: params.userId,
        date: nextDate,
        type: "completed",
        note: "Expediente encerrado manualmente: dia concluído sem débito.",
      });
    }
    await reload();
  }

  async function completeDayWithoutDebit(date: string) {
    if (!params.supabase || !params.userId) return;

    setState("loading");
    await upsertDayMark(params.supabase, {
      userId: params.userId,
      date,
      type: "completed",
      note: "Dia marcado como concluído: não gera débito de horas.",
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
      date: toDateKey(new Date(startsAt)),
      category,
      startsAt,
      endsAt,
      deductsFromWork,
      note,
    });
    await reload();
  }

  async function toggleHoliday(date: string) {
    if (!params.supabase || !params.userId) return;

    const existingMark = marks.find(
      (mark) => mark.date === date && mark.type === "holiday",
    );

    setState("loading");

    if (existingMark) {
      await deleteDayMark(params.supabase, {
        userId: params.userId,
        date,
        type: "holiday",
      });
    } else {
      await deleteDayMark(params.supabase, {
        userId: params.userId,
        date,
        type: "medical_leave",
      });
      await deleteDayMark(params.supabase, {
        userId: params.userId,
        date,
        type: "completed",
      });
      await upsertDayMark(params.supabase, {
        userId: params.userId,
        date,
        type: "holiday",
      });
    }

    await reload();
  }

  async function toggleMedicalLeave(date: string) {
    if (!params.supabase || !params.userId) return;

    const existingMark = marks.find(
      (mark) => mark.date === date && mark.type === "medical_leave",
    );

    setState("loading");

    if (existingMark) {
      await deleteDayMark(params.supabase, {
        userId: params.userId,
        date,
        type: "medical_leave",
      });
    } else {
      await deleteDayMark(params.supabase, {
        userId: params.userId,
        date,
        type: "excluded",
      });
      await deleteDayMark(params.supabase, {
        userId: params.userId,
        date,
        type: "completed",
      });
      await upsertDayMark(params.supabase, {
        userId: params.userId,
        date,
        type: "medical_leave",
        note: "Ausência justificada por atestado ou declaração médica.",
      });
    }

    await reload();
  }

  async function toggleExcludedDay(date: string) {
    if (!params.supabase || !params.userId) return;

    const existingMark = marks.find(
      (mark) => mark.date === date && mark.type === "excluded",
    );

    setState("loading");

    if (existingMark) {
      await deleteDayMark(params.supabase, {
        userId: params.userId,
        date,
        type: "excluded",
      });
    } else {
      await deleteDayMark(params.supabase, {
        userId: params.userId,
        date,
        type: "completed",
      });
      await upsertDayMark(params.supabase, {
        userId: params.userId,
        date,
        type: "excluded",
        note: "Dia limpo: ignorado na contabilização.",
      });
    }

    await reload();
  }

  return {
    today,
    todayKey,
    entries,
    breaks,
    marks,
    movements: hourBankMovements,
    todaySummary,
    hasTodayEntries,
    hasWeekEntries,
    hasHourBankMovements,
    weekWorkedMinutes,
    weekExpectedMinutes,
    weekReferenceDelta,
    dailySummaries,
    historySummaries,
    calendarMonth,
    calendarDays,
    moveCalendarMonth,
    resetCalendarMonth,
    hourBankBalance,
    nextEntryType: inferNextAction(todayEntries, todayBreaks),
    canCloseDayDirectly: canCloseDayDirectly(todayEntries, todayBreaks),
    state,
    error,
    reload,
    addTimeEntry,
    addBreak,
    editTimeEntry,
    editBreak,
    completeDayWithoutDebit,
    toggleHoliday,
    toggleExcludedDay,
    toggleMedicalLeave,
  };
}
