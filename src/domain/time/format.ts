const MINUTES_PER_HOUR = 60;

export function minutesToHoursLabel(minutes: number): string {
  const sign = minutes < 0 ? "-" : "";
  const absoluteMinutes = Math.abs(minutes);
  const hours = Math.floor(absoluteMinutes / MINUTES_PER_HOUR);
  const remainingMinutes = absoluteMinutes % MINUTES_PER_HOUR;

  if (hours === 0) {
    return `${sign}${remainingMinutes}min`;
  }

  if (remainingMinutes === 0) {
    return `${sign}${hours}h`;
  }

  return `${sign}${hours}h ${remainingMinutes}min`;
}

export function minutesToDecimalHours(minutes: number): string {
  return (minutes / MINUTES_PER_HOUR).toFixed(1).replace(".", ",");
}

export function toDateKey(date: Date): string {
  return date.toISOString().slice(0, 10);
}

export function formatDatePtBr(dateKey: string): string {
  return new Intl.DateTimeFormat("pt-BR", {
    day: "2-digit",
    month: "short",
    weekday: "short",
  }).format(new Date(`${dateKey}T12:00:00`));
}

export function formatWeekdayLongPtBr(dateKey: string): string {
  return new Intl.DateTimeFormat("pt-BR", {
    weekday: "long",
  }).format(new Date(`${dateKey}T12:00:00`));
}

export function formatWeekdayShortPtBr(dateKey: string): string {
  return new Intl.DateTimeFormat("pt-BR", {
    weekday: "short",
  })
    .format(new Date(`${dateKey}T12:00:00`))
    .replace(".", "")
    .slice(0, 3)
    .toUpperCase();
}

export function formatTimePtBr(isoDate: string): string {
  return new Intl.DateTimeFormat("pt-BR", {
    hour: "2-digit",
    minute: "2-digit",
  }).format(new Date(isoDate));
}

export function formatMonthPtBr(date: Date): string {
  return new Intl.DateTimeFormat("pt-BR", {
    month: "long",
    year: "numeric",
  }).format(date);
}
