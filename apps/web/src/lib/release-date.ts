import { DEFAULT_TIME_ZONE, todayIn } from "@spleen/validators";
import type { useFormatter } from "next-intl";

type Formatter = ReturnType<typeof useFormatter>;

/** A catalog date shown with the precision it is known with ("1959", "août 1959", full date). */
export function formatReleaseDate(
  format: Formatter,
  date: string,
  precision: "year" | "month" | "day" | null,
): string {
  const value = new Date(`${date}T12:00:00Z`);
  if (precision === "year") return date.slice(0, 4);
  if (precision === "month") {
    return format.dateTime(value, { year: "numeric", month: "long", timeZone: "UTC" });
  }
  return format.dateTime(value, { dateStyle: "long", timeZone: "UTC" });
}

/**
 * An upcoming date, short: "ven. 21 nov." for a day ("mer. 10 nov. 2027" outside the current
 * year, so it never reads as a past date), "novembre 2026" for a month, "2027" for a year
 * (never an invented day). `today` defaults to the day in Europe/Paris.
 */
export function formatUpcomingDate(
  format: Formatter,
  date: string,
  precision: "year" | "month" | "day",
  today: string = todayIn(DEFAULT_TIME_ZONE, new Date()),
): string {
  if (precision !== "day") return formatReleaseDate(format, date, precision);
  return format.dateTime(new Date(`${date}T12:00:00Z`), {
    weekday: "short",
    day: "numeric",
    month: "short",
    ...(date.slice(0, 4) !== today.slice(0, 4) && { year: "numeric" }),
    timeZone: "UTC",
  });
}

export function formatDuration(ms: number): string {
  const total = Math.round(ms / 1000);
  const hours = Math.floor(total / 3600);
  const minutes = Math.floor((total % 3600) / 60);
  const seconds = String(total % 60).padStart(2, "0");
  return hours > 0
    ? `${hours}:${String(minutes).padStart(2, "0")}:${seconds}`
    : `${minutes}:${seconds}`;
}
