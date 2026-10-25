"use client";

import Link from "next/link";
import type { ReactNode } from "react";
import { format, type Locale } from "@/i18n/config";
import type { Dictionary } from "@/i18n/get-dictionary";
import type { BoardDeal, StageKind } from "@/lib/data/deals";
import { formatMoney, formatShortDate } from "@/lib/format";

export function contactName(deal: BoardDeal) {
  return deal.contact ? [deal.contact.first_name, deal.contact.last_name].filter(Boolean).join(" ") : null;
}

/** The card's face. Used on the board and, unchanged, as the picture under the pointer while dragging. */
export function DealCard({
  deal,
  kind,
  locale,
  today,
  t,
  handle,
  onOpen,
  lifted = false,
}: {
  deal: BoardDeal;
  kind: StageKind;
  locale: Locale;
  today: string;
  t: Dictionary["deals"];
  handle?: ReactNode;
  onOpen?: () => void;
  lifted?: boolean;
}) {
  const person = contactName(deal);
  const overdue = kind === "open" && deal.expected_close_date !== null && deal.expected_close_date < today;

  let dateLine: string | null = null;
  if (kind !== "open" && deal.closed_at) dateLine = format(t.closedOn, { date: formatShortDate(deal.closed_at, locale) });
  else if (deal.expected_close_date)
    dateLine = format(overdue ? t.overdue : t.closeBy, { date: formatShortDate(deal.expected_close_date, locale) });

  return (
    <article
      className={`rounded-lg border bg-surface p-3 ${
        lifted ? "rotate-1 border-brand shadow-xl" : "border-line"
      } ${kind === "lost" ? "opacity-75" : ""}`}
    >
      <div className="flex items-start gap-2">
        <h3 className="min-w-0 flex-1 text-[15px] font-medium leading-snug">
          {onOpen ? (
            <button
              type="button"
              onClick={onOpen}
              aria-label={format(t.edit, { title: deal.title })}
              className="text-start hover:text-brand hover:underline"
            >
              <bdi>{deal.title}</bdi>
            </button>
          ) : (
            <bdi>{deal.title}</bdi>
          )}
        </h3>
        {handle}
      </div>

      <p className="mt-1 truncate text-sm text-muted">
        {person && deal.contact && onOpen ? (
          <Link href={`/${locale}/contacts/${deal.contact.id}`} className="hover:text-brand hover:underline">
            <bdi>{person}</bdi>
          </Link>
        ) : (
          person && <bdi>{person}</bdi>
        )}
        {person && deal.company && ", "}
        {deal.company && <bdi>{deal.company.name}</bdi>}
        {!person && !deal.company && t.noContact}
      </p>

      <div className="mt-3 flex items-baseline justify-between gap-2">
        <span className="font-semibold tabular-nums" suppressHydrationWarning>
          {formatMoney(deal.amount, deal.currency, locale)}
        </span>
        {dateLine && (
          <span className={`text-xs ${overdue ? "font-medium text-danger" : "text-muted"}`} suppressHydrationWarning>
            {dateLine}
          </span>
        )}
      </div>
    </article>
  );
}

export function GripIcon() {
  return (
    <svg viewBox="0 0 12 18" className="h-4 w-3" aria-hidden="true">
      {[3, 9].map((x) => [3, 9, 15].map((y) => <circle key={`${x}-${y}`} cx={x} cy={y} r="1.5" fill="currentColor" />))}
    </svg>
  );
}
