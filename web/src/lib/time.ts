/** Israel's time zone, where the business works. Dates on screen and "today" follow it. */
export const BUSINESS_TZ = "Asia/Jerusalem";

/** Calendar day in Israel as YYYY-MM-DD (sortable as a string). */
export function israelDay(date: Date = new Date()) {
  return new Intl.DateTimeFormat("en-CA", { timeZone: BUSINESS_TZ }).format(date);
}

/** The UTC instant at which a given Israeli calendar day starts (handles summer and winter time). */
export function israelDayStart(day: string) {
  const noonUtc = new Date(`${day}T12:00:00Z`);
  const offset = new Intl.DateTimeFormat("en-US", { timeZone: BUSINESS_TZ, timeZoneName: "longOffset" })
    .formatToParts(noonUtc)
    .find((p) => p.type === "timeZoneName")!
    .value.replace("GMT", "") || "+00:00";
  return new Date(`${day}T00:00:00${offset}`);
}

export function addDays(day: string, days: number) {
  const d = new Date(`${day}T12:00:00Z`);
  d.setUTCDate(d.getUTCDate() + days);
  return d.toISOString().slice(0, 10);
}
