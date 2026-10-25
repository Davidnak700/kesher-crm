import type { Locale } from "@/i18n/config";

const numberLocale: Record<Locale, string> = { he: "he-IL", en: "en-US" };
const dateLocale: Record<Locale, string> = { he: "he-IL", en: "en-GB" };

export function formatMoney(amount: number, currency: string, locale: Locale) {
  return new Intl.NumberFormat(numberLocale[locale], {
    style: "currency",
    currency,
    maximumFractionDigits: 0,
  }).format(amount);
}

/**
 * "2026-11-03" is a calendar date and is shown as-is; a full timestamp is shown
 * as the date it was in Israel, where the business works.
 */
export function formatShortDate(value: string, locale: Locale) {
  const isDateOnly = value.length === 10;
  return new Intl.DateTimeFormat(dateLocale[locale], {
    day: "numeric",
    month: "short",
    timeZone: isDateOnly ? "UTC" : "Asia/Jerusalem",
  }).format(new Date(isDateOnly ? `${value}T00:00:00Z` : value));
}
