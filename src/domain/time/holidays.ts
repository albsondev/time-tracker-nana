import type { DayMark } from "./types";

const fixedNationalHolidays: Record<string, string> = {
  "01-01": "Confraternização Universal",
  "04-21": "Tiradentes",
  "05-01": "Dia Mundial do Trabalho",
  "09-07": "Independência do Brasil",
  "10-12": "Nossa Senhora Aparecida",
  "11-02": "Finados",
  "11-15": "Proclamação da República",
  "11-20": "Dia Nacional de Zumbi e da Consciência Negra",
  "12-25": "Natal",
};

function calculateEasterDate(year: number) {
  const a = year % 19;
  const b = Math.floor(year / 100);
  const c = year % 100;
  const d = Math.floor(b / 4);
  const e = b % 4;
  const f = Math.floor((b + 8) / 25);
  const g = Math.floor((b - f + 1) / 3);
  const h = (19 * a + b - d - g + 15) % 30;
  const i = Math.floor(c / 4);
  const k = c % 4;
  const l = (32 + 2 * e + 2 * i - h - k) % 7;
  const m = Math.floor((a + 11 * h + 22 * l) / 451);
  const month = Math.floor((h + l - 7 * m + 114) / 31);
  const day = ((h + l - 7 * m + 114) % 31) + 1;

  return new Date(year, month - 1, day, 12);
}

function toMonthDay(dateKey: string) {
  return dateKey.slice(5);
}

function toDateKey(date: Date) {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");

  return `${year}-${month}-${day}`;
}

export function getNationalHoliday(dateKey: string): DayMark | undefined {
  const fixedHoliday = fixedNationalHolidays[toMonthDay(dateKey)];

  if (fixedHoliday) {
    return {
      id: `national-holiday-${dateKey}`,
      userId: "national",
      date: dateKey,
      type: "holiday",
      note: fixedHoliday,
    };
  }

  const year = Number(dateKey.slice(0, 4));
  const easter = calculateEasterDate(year);
  const goodFriday = new Date(easter);
  goodFriday.setDate(easter.getDate() - 2);

  if (dateKey === toDateKey(goodFriday)) {
    return {
      id: `national-holiday-${dateKey}`,
      userId: "national",
      date: dateKey,
      type: "holiday",
      note: "Paixão de Cristo",
    };
  }

  return undefined;
}
