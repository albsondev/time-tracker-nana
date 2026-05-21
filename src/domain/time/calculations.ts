import type {
  BreakEntry,
  DailySummary,
  DayStatus,
  DayMark,
  HourBankMovement,
  TimeEntry,
  WeekSummary,
} from "./types";
import { formatDateWrittenPtBr, toDateKey } from "./format";
import { getNationalHoliday } from "./holidays";

export const WEEKLY_EXPECTED_MINUTES = 30 * 60;
export const DAILY_REFERENCE_MINUTES = 6 * 60;

function minutesBetween(startIso: string, endIso: string): number {
  const start = new Date(startIso).getTime();
  const end = new Date(endIso).getTime();

  if (Number.isNaN(start) || Number.isNaN(end) || end <= start) {
    return 0;
  }

  return Math.round((end - start) / 60000);
}

function findEntry(entries: TimeEntry[], type: TimeEntry["type"]) {
  return entries
    .filter((entry) => entry.type === type)
    .sort((a, b) => a.occurredAt.localeCompare(b.occurredAt))[0];
}

function getWeekStartKey(dateKey: string) {
  const current = new Date(`${dateKey}T12:00:00`);
  const day = current.getDay();
  const distanceFromMonday = day === 0 ? 6 : day - 1;
  current.setDate(current.getDate() - distanceFromMonday);

  return toDateKey(current);
}

function getWeekEndKey(weekStartsAt: string) {
  const weekEnd = new Date(`${weekStartsAt}T12:00:00`);
  weekEnd.setDate(weekEnd.getDate() + 6);

  return toDateKey(weekEnd);
}

function getWeekdayKeys(weekStartsAt: string) {
  const weekStart = new Date(`${weekStartsAt}T12:00:00`);

  return Array.from({ length: 5 }, (_, index) => {
    const day = new Date(weekStart);
    day.setDate(weekStart.getDate() + index);
    return toDateKey(day);
  });
}

function createEmptyDaySummary(date: string): DailySummary {
  return summarizeDay({
    date,
    entries: [],
    mark: getNationalHoliday(date),
  });
}

function isNonWorkingMark(mark?: DayMark) {
  return (
    mark?.type === "holiday" ||
    mark?.type === "excluded" ||
    mark?.type === "medical_leave"
  );
}

function getExpectedMinutesForDay(day: Pick<DailySummary, "mark" | "workedMinutes">) {
  if (isNonWorkingMark(day.mark)) return 0;
  if (day.mark?.type === "completed") {
    return Math.min(DAILY_REFERENCE_MINUTES, day.workedMinutes);
  }

  return DAILY_REFERENCE_MINUTES;
}

function getWeeklyExpectedMinutesForDay(day: Pick<DailySummary, "mark">) {
  if (isNonWorkingMark(day.mark) || day.mark?.type === "completed") return 0;

  return DAILY_REFERENCE_MINUTES;
}

function isExcludedDay(day: DailySummary) {
  return day.mark?.type === "excluded" || day.mark?.type === "medical_leave";
}

export function calculateBreakMinutes(breaks: BreakEntry[]): number {
  return breaks
    .filter((entry) => entry.deductsFromWork && entry.endsAt)
    .reduce(
      (total, entry) => total + minutesBetween(entry.startsAt, entry.endsAt!),
      0,
    );
}

export function inferDayStatus(
  entries: TimeEntry[],
  breaks: BreakEntry[] = [],
): DayStatus {
  const hasArrival = entries.some((entry) => entry.type === "arrival");
  const hasDeparture = entries.some((entry) => entry.type === "departure");
  const lunchStart = findEntry(entries, "lunch_start");
  const lunchEnd = findEntry(entries, "lunch_end");
  const openBreak = breaks.some((entry) => !entry.endsAt);

  if (!hasArrival) return "not_started";
  if (hasDeparture) return "closed";
  if (openBreak) return "on_break";
  if (lunchStart && !lunchEnd) return "at_lunch";
  if (lunchEnd && !lunchStart) return "incomplete";

  return "working";
}

export function calculateWorkedMinutes(
  entries: TimeEntry[],
  breaks: BreakEntry[] = [],
  now: Date = new Date(),
): number {
  const arrival = findEntry(entries, "arrival");
  const departure = findEntry(entries, "departure");

  if (!arrival) return 0;

  const end = departure?.occurredAt ?? now.toISOString();
  const grossMinutes = minutesBetween(arrival.occurredAt, end);
  const lunchStart = findEntry(entries, "lunch_start");
  const lunchEnd = findEntry(entries, "lunch_end");
  const lunchMinutes =
    lunchStart && lunchEnd
      ? minutesBetween(lunchStart.occurredAt, lunchEnd.occurredAt)
      : 0;

  return Math.max(grossMinutes - lunchMinutes - calculateBreakMinutes(breaks), 0);
}

export function summarizeDay(params: {
  date: string;
  entries: TimeEntry[];
  breaks?: BreakEntry[];
  mark?: DayMark;
  expectedMinutes?: number;
  now?: Date;
}): DailySummary {
  const breaks = params.breaks ?? [];
  const now = params.now ?? new Date();
  const effectiveNow =
    params.date === toDateKey(now) ? now : new Date(`${params.date}T00:00:00`);
  const shouldIgnoreWorkedTime =
    params.mark?.type === "excluded" || params.mark?.type === "medical_leave";
  const rawWorkedMinutes = calculateWorkedMinutes(
    params.entries,
    breaks,
    effectiveNow,
  );
  const workedMinutes = shouldIgnoreWorkedTime ? 0 : rawWorkedMinutes;
  const breakMinutes = shouldIgnoreWorkedTime ? 0 : calculateBreakMinutes(breaks);
  const expectedMinutes =
    params.expectedMinutes ??
    getExpectedMinutesForDay({ mark: params.mark, workedMinutes });

  return {
    date: params.date,
    status: inferDayStatus(params.entries, breaks),
    workedMinutes,
    breakMinutes,
    balanceMinutes: workedMinutes - expectedMinutes,
    entries: params.entries,
    breaks,
    mark: params.mark,
  };
}

export function summarizeWeek(params: {
  weekStartsAt: string;
  days: DailySummary[];
  expectedMinutes?: number;
}): WeekSummary {
  const expectedMinutes =
    params.expectedMinutes ??
    Math.min(
      WEEKLY_EXPECTED_MINUTES,
      params.days.reduce((total, day) => total + getWeeklyExpectedMinutesForDay(day), 0),
    );
  const workedMinutes = params.days.reduce(
    (total, day) => total + day.workedMinutes,
    0,
  );
  const weekStart = new Date(`${params.weekStartsAt}T12:00:00`);
  const weekEnd = new Date(weekStart);
  weekEnd.setDate(weekStart.getDate() + 6);

  return {
    weekStartsAt: params.weekStartsAt,
    weekEndsAt: weekEnd.toISOString().slice(0, 10),
    expectedMinutes,
    workedMinutes,
    balanceMinutes: workedMinutes - expectedMinutes,
    days: params.days,
  };
}

export function calculateHourBankBalance(
  movements: { minutesDelta: number }[],
): number {
  return movements.reduce((total, movement) => total + movement.minutesDelta, 0);
}

export function calculateAutomaticWeeklyBankMovements(
  days: DailySummary[],
  expectedMinutes = WEEKLY_EXPECTED_MINUTES,
  now: Date = new Date(),
): HourBankMovement[] {
  const groupedDays = days.reduce<Record<string, DailySummary[]>>(
    (groups, day) => {
      const weekStartsAt = getWeekStartKey(day.date);
      groups[weekStartsAt] = [...(groups[weekStartsAt] ?? []), day];
      return groups;
    },
    {},
  );

  return Object.entries(groupedDays)
    .reduce<HourBankMovement[]>((weeklyMovements, [weekStartsAt, weekDays]) => {
      const sortedDays = [...weekDays].sort((first, second) =>
        first.date.localeCompare(second.date),
      );
      const hasWorkRecords = sortedDays.some(
        (day) =>
          !isExcludedDay(day) && (day.entries.length > 0 || day.breaks.length > 0),
      );
      const hasPendingRecords = sortedDays.some(
        (day) =>
          !isExcludedDay(day) &&
          (day.entries.length > 0 || day.breaks.length > 0) &&
          day.status !== "closed",
      );
      const weekEndsAt = getWeekEndKey(weekStartsAt);
      const todayKey = toDateKey(now);

      if (!hasWorkRecords || hasPendingRecords || weekEndsAt >= todayKey) {
        return weeklyMovements;
      }

      const weekDetails = getWeekdayKeys(weekStartsAt).map(
        (date) =>
          sortedDays.find((day) => day.date === date) ??
          createEmptyDaySummary(date),
      );
      const workedMinutes = weekDetails.reduce(
        (total, day) => total + day.workedMinutes,
        0,
      );
      const weeklyExpectedMinutes = Math.min(
        expectedMinutes,
        weekDetails.reduce((total, day) => total + getWeeklyExpectedMinutesForDay(day), 0),
      );
      const minutesDelta = workedMinutes - weeklyExpectedMinutes;

      if (minutesDelta === 0) return weeklyMovements;

      weeklyMovements.push({
        id: `weekly-balance-${weekStartsAt}`,
        date: weekEndsAt,
        source: "weekly_balance" as const,
        minutesDelta,
        description: `${minutesDelta > 0 ? "Crédito" : "Débito"} automático da semana ${formatDateWrittenPtBr(
          weekStartsAt,
        )} a ${formatDateWrittenPtBr(weekEndsAt)}`,
        details: weekDetails,
      });

      return weeklyMovements;
    }, [])
    .sort((first, second) => second.date.localeCompare(first.date));
}

export function getNextEntryType(
  status: DayStatus,
): TimeEntry["type"] | "pause" | null {
  switch (status) {
    case "not_started":
      return "arrival";
    case "working":
      return "lunch_start";
    case "at_lunch":
      return "lunch_end";
    case "on_break":
      return "break_end";
    case "incomplete":
      return "departure";
    case "closed":
      return null;
  }
}
