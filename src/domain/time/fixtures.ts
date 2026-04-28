import type { BreakEntry, HourBankMovement, TimeEntry } from "./types";

const userId = "demo-user";

export const demoEntries: TimeEntry[] = [
  {
    id: "entry-1",
    userId,
    type: "arrival",
    occurredAt: "2026-04-27T08:04:00-03:00",
  },
  {
    id: "entry-2",
    userId,
    type: "lunch_start",
    occurredAt: "2026-04-27T12:02:00-03:00",
  },
  {
    id: "entry-3",
    userId,
    type: "lunch_end",
    occurredAt: "2026-04-27T13:03:00-03:00",
  },
  {
    id: "entry-4",
    userId,
    type: "departure",
    occurredAt: "2026-04-27T17:42:00-03:00",
  },
  {
    id: "entry-5",
    userId,
    type: "arrival",
    occurredAt: "2026-04-28T08:15:00-03:00",
  },
  {
    id: "entry-6",
    userId,
    type: "lunch_start",
    occurredAt: "2026-04-28T12:10:00-03:00",
  },
  {
    id: "entry-7",
    userId,
    type: "lunch_end",
    occurredAt: "2026-04-28T13:05:00-03:00",
  },
];

export const demoBreaks: BreakEntry[] = [
  {
    id: "break-1",
    userId,
    date: "2026-04-28",
    category: "medical",
    startsAt: "2026-04-28T15:00:00-03:00",
    endsAt: "2026-04-28T15:30:00-03:00",
    deductsFromWork: false,
    note: "Declaração médica",
  },
];

export const demoHourBankMovements: HourBankMovement[] = [
  {
    id: "bank-1",
    date: "2026-04-10",
    source: "weekly_balance",
    minutesDelta: 180,
    description: "Semana com três horas acima da meta.",
  },
  {
    id: "bank-2",
    date: "2026-04-17",
    source: "weekly_balance",
    minutesDelta: 120,
    description: "Crédito acumulado para viagem futura.",
  },
  {
    id: "bank-3",
    date: "2026-04-24",
    source: "compensation",
    minutesDelta: -90,
    description: "Compensação parcial de ausência.",
  },
];
