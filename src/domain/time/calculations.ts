import type {
  BreakEntry,
  DailySummary,
  DayStatus,
  DayMark,
  HourBankMovement,
  TimeEntry,
  WeekSummary,
} from "./types";
import { toDateKey } from "./format";

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
  const isHoliday = params.mark?.type === "holiday";
  const workedMinutes = calculateWorkedMinutes(
    params.entries,
    breaks,
    effectiveNow,
  );
  const expectedMinutes =
    params.expectedMinutes ?? (isHoliday ? 0 : DAILY_REFERENCE_MINUTES);

  return {
    date: params.date,
    status: inferDayStatus(params.entries, breaks),
    workedMinutes,
    breakMinutes: calculateBreakMinutes(breaks),
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
  const expectedMinutes = params.expectedMinutes ?? WEEKLY_EXPECTED_MINUTES;
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
): HourBankMovement[] {
  const closedDays = days.filter((day) => day.status === "closed");
  const groupedDays = closedDays.reduce<Record<string, DailySummary[]>>(
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
      const workedMinutes = sortedDays.reduce(
        (total, day) => total + day.workedMinutes,
        0,
      );
      const minutesDelta = workedMinutes - expectedMinutes;
      const weekEndsAt = getWeekEndKey(weekStartsAt);

      if (minutesDelta <= 0) return weeklyMovements;

      weeklyMovements.push({
        id: `weekly-balance-${weekStartsAt}`,
        date: weekEndsAt,
        source: "weekly_balance" as const,
        minutesDelta,
        description: `Crédito automático da semana ${weekStartsAt} a ${weekEndsAt}`,
        details: sortedDays,
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
