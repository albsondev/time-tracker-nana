export type TimeEntryType =
  | "arrival"
  | "lunch_start"
  | "lunch_end"
  | "break_start"
  | "break_end"
  | "departure";

export type BreakCategory =
  | "lunch"
  | "medical"
  | "sick"
  | "travel"
  | "personal"
  | "other";

export type DayStatus =
  | "not_started"
  | "working"
  | "at_lunch"
  | "on_break"
  | "closed"
  | "incomplete";

export type CalendarDayStatus =
  | "today"
  | "complete"
  | "exceeded"
  | "negative"
  | "pending"
  | "holiday"
  | "empty";

export type DayMarkType = "holiday";

export type DayMark = {
  id: string;
  userId: string;
  date: string;
  type: DayMarkType;
  note?: string;
};

export type TimeEntry = {
  id: string;
  userId: string;
  occurredAt: string;
  type: TimeEntryType;
  note?: string;
  isModified?: boolean;
  modifiedAt?: string;
};

export type BreakEntry = {
  id: string;
  userId: string;
  date: string;
  category: BreakCategory;
  startsAt: string;
  endsAt?: string;
  note?: string;
  deductsFromWork: boolean;
  isModified?: boolean;
  modifiedAt?: string;
};

export type DailySummary = {
  date: string;
  status: DayStatus;
  workedMinutes: number;
  breakMinutes: number;
  balanceMinutes: number;
  entries: TimeEntry[];
  breaks: BreakEntry[];
  mark?: DayMark;
};

export type WeekSummary = {
  weekStartsAt: string;
  weekEndsAt: string;
  expectedMinutes: number;
  workedMinutes: number;
  balanceMinutes: number;
  days: DailySummary[];
};

export type HourBankMovement = {
  id: string;
  date: string;
  source: "weekly_balance" | "manual_adjustment" | "compensation";
  minutesDelta: number;
  description: string;
  details?: DailySummary[];
};
