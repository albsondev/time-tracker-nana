import { describe, expect, it } from "vitest";
import { getDayMarkForDate } from "./holidays";
import type { DayMark } from "./types";

const userId = "user-test";

function mark(date: string, type: DayMark["type"]): DayMark {
  return { id: `${type}-${date}`, userId, date, type };
}

describe("day marks and national holidays", () => {
  it("resolves October 12 as an automatic national holiday", () => {
    const dayMark = getDayMarkForDate([], "2026-10-12");

    expect(dayMark?.type).toBe("holiday");
    expect(dayMark?.note).toBe("Nossa Senhora Aparecida");
  });

  it("lets a working-day override suppress an automatic holiday", () => {
    const dayMark = getDayMarkForDate(
      [mark("2026-10-12", "working_day")],
      "2026-10-12",
    );

    expect(dayMark).toBeUndefined();
  });

  it("keeps the override effective while a stored holiday is being cleaned up", () => {
    const dayMark = getDayMarkForDate(
      [mark("2026-10-12", "working_day"), mark("2026-10-12", "holiday")],
      "2026-10-12",
    );

    expect(dayMark).toBeUndefined();
  });

  it("does not suppress an explicit holiday on another date", () => {
    const dayMark = getDayMarkForDate(
      [mark("2026-10-13", "holiday")],
      "2026-10-13",
    );

    expect(dayMark?.type).toBe("holiday");
  });
});
