import { act, renderHook, waitFor } from "@testing-library/react";
import type { SupabaseClient } from "@supabase/supabase-js";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import type { DayMark, TimeEntry } from "@/domain/time/types";

const repository = vi.hoisted(() => ({
  createBreakEntry: vi.fn(),
  createTimeEntry: vi.fn(),
  deleteDayMark: vi.fn(),
  loadUserTimeTrackingSnapshot: vi.fn(),
  updateBreakEntry: vi.fn(),
  updateTimeEntry: vi.fn(),
  upsertDayMark: vi.fn(),
}));

vi.mock("../data/time-tracking-repository", () => repository);

import { useTimeTracker } from "./use-time-tracker";

const date = "2026-10-12";
const userId = "user-test";
const supabase = {} as SupabaseClient;
const entries: TimeEntry[] = [
  {
    id: "arrival-1",
    userId,
    type: "arrival",
    occurredAt: "2026-10-12T08:15:00-03:00",
  },
  {
    id: "lunch-start-1",
    userId,
    type: "lunch_start",
    occurredAt: "2026-10-12T12:00:00-03:00",
  },
  {
    id: "lunch-end-1",
    userId,
    type: "lunch_end",
    occurredAt: "2026-10-12T14:26:00-03:00",
  },
  {
    id: "departure-1",
    userId,
    type: "departure",
    occurredAt: "2026-10-12T17:48:00-03:00",
  },
];

describe("useTimeTracker holiday overrides", () => {
  let persistedMarks: DayMark[];

  beforeEach(() => {
    vi.useFakeTimers({ toFake: ["Date"] });
    vi.setSystemTime(new Date(2026, 9, 13, 12));
    persistedMarks = [];

    repository.loadUserTimeTrackingSnapshot.mockImplementation(async () => ({
      entries,
      breaks: [],
      marks: [...persistedMarks],
      movements: [],
    }));
    repository.upsertDayMark.mockImplementation(
      async (_client: SupabaseClient, mark: Omit<DayMark, "id">) => {
        persistedMarks = persistedMarks.filter(
          (existingMark) =>
            !(
              existingMark.date === mark.date &&
              existingMark.type === mark.type
            ),
        );
        persistedMarks.push({ ...mark, id: `${mark.type}-${mark.date}` });
      },
    );
    repository.deleteDayMark.mockImplementation(
      async (
        _client: SupabaseClient,
        mark: Pick<DayMark, "userId" | "date" | "type">,
      ) => {
        persistedMarks = persistedMarks.filter(
          (existingMark) =>
            !(
              existingMark.userId === mark.userId &&
              existingMark.date === mark.date &&
              existingMark.type === mark.type
            ),
        );
      },
    );
  });

  afterEach(() => {
    vi.useRealTimers();
    vi.clearAllMocks();
  });

  it("credits every worked minute when removing a persisted holiday with time records", async () => {
    persistedMarks = [
      {
        id: "holiday-2026-10-12",
        userId,
        date,
        type: "holiday",
        note: "Nossa Senhora Aparecida",
      },
    ];
    const { result } = renderHook(() => useTimeTracker({ supabase, userId }));

    await waitFor(() => expect(result.current.state).toBe("ready"));
    expect(
      result.current.calendarDays.find((day) => day.date === date)?.mark?.type,
    ).toBe("holiday");
    expect(result.current.weekWorkedMinutes).toBe(7 * 60 + 7);
    expect(result.current.weekExpectedMinutes).toBe(24 * 60);

    await act(async () => {
      await result.current.toggleHoliday(date);
    });

    const selectedDay = result.current.calendarDays.find(
      (day) => day.date === date,
    );

    expect(repository.upsertDayMark).toHaveBeenCalledWith(supabase, {
      userId,
      date,
      type: "worked_holiday",
      note: "Feriado trabalhado: todas as horas registradas contam como crédito.",
    });
    expect(repository.deleteDayMark).toHaveBeenCalledWith(supabase, {
      userId,
      date,
      type: "holiday",
    });
    expect(selectedDay?.mark?.type).toBe("worked_holiday");
    expect(selectedDay?.workedMinutes).toBe(7 * 60 + 7);
    expect(selectedDay?.balanceMinutes).toBe(7 * 60 + 7);
    expect(result.current.weekWorkedMinutes).toBe(7 * 60 + 7);
    expect(result.current.weekExpectedMinutes).toBe(24 * 60);
    expect(result.current.weekReferenceDelta).toBe(-(16 * 60 + 53));
  });

  it("can mark the overridden national holiday again", async () => {
    persistedMarks = [
      {
        id: "working-day-1",
        userId,
        date,
        type: "working_day",
      },
    ];
    const { result } = renderHook(() => useTimeTracker({ supabase, userId }));

    await waitFor(() => expect(result.current.state).toBe("ready"));
    expect(
      result.current.calendarDays.find((day) => day.date === date)?.mark,
    ).toBeUndefined();

    await act(async () => {
      await result.current.toggleHoliday(date);
    });

    expect(
      repository.deleteDayMark.mock.calls.some(
        ([, mark]) => mark.date === date && mark.type === "working_day",
      ),
    ).toBe(true);
    expect(
      result.current.calendarDays.find((day) => day.date === date)?.mark?.type,
    ).toBe("holiday");
  });

  it("returns a worked holiday to a regular workday when its special mark is removed", async () => {
    persistedMarks = [
      {
        id: "worked-holiday-2026-10-12",
        userId,
        date,
        type: "worked_holiday",
      },
    ];
    const { result } = renderHook(() => useTimeTracker({ supabase, userId }));

    await waitFor(() => expect(result.current.state).toBe("ready"));
    await act(async () => {
      await result.current.toggleHoliday(date);
    });

    expect(repository.deleteDayMark).toHaveBeenCalledWith(supabase, {
      userId,
      date,
      type: "worked_holiday",
    });
    expect(repository.upsertDayMark).toHaveBeenCalledWith(supabase, {
      userId,
      date,
      type: "working_day",
      note: "Dia útil: substitui o feriado nacional automático.",
    });
    expect(
      result.current.calendarDays.find((day) => day.date === date)?.mark,
    ).toBeUndefined();
  });
});
