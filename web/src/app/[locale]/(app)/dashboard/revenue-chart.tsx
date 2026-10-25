"use client";

import { useState } from "react";

export type MonthBar = {
  key: string; // YYYY-MM
  label: string; // "Oct"
  fullLabel: string; // "October 2026"
  value: number;
  valueLabel: string; // "₪48,500"
  deals: number;
  dealsLabel: string; // "3 deals won"
  partial: boolean; // the current month, still in progress
};

/**
 * Columns of won revenue per month. Plain HTML so the time axis follows the page direction
 * (right-to-left in Hebrew). Hover or focus a column for its numbers; a table carries the same data.
 */
export function RevenueChart({
  bars,
  ticks,
  max,
  soFar,
  tableToggle,
  columns,
}: {
  bars: MonthBar[];
  ticks: { value: number; label: string }[];
  max: number;
  soFar: string;
  tableToggle: string;
  columns: { month: string; amount: string; deals: string };
}) {
  const [active, setActive] = useState<number | null>(null);
  // Label only what the story needs: the best month and the current one.
  const best = bars.reduce((b, bar, i) => (bar.value > bars[b].value ? i : b), 0);
  const labelled = new Set([best, bars.length - 1]);

  return (
    <figure>
      <div className="relative h-56 ps-14" onMouseLeave={() => setActive(null)}>
        {/* recessive gridlines with clean tick labels */}
        {ticks.map((tick) => (
          <div key={tick.value} className="pointer-events-none absolute inset-x-0" style={{ bottom: `${(tick.value / max) * 100}%` }} aria-hidden="true">
            <div className="ms-14 border-t border-line" />
            <span className="absolute start-0 -translate-y-1/2 text-xs tabular-nums text-muted">{tick.label}</span>
          </div>
        ))}

        <ol className="relative flex h-full items-end justify-around">
          {bars.map((bar, i) => {
            const height = max > 0 ? (bar.value / max) * 100 : 0;
            const showLabel = labelled.has(i) && bar.value > 0;
            return (
              <li
                key={bar.key}
                tabIndex={0}
                aria-label={`${bar.fullLabel}: ${bar.valueLabel}${bar.partial ? ` (${soFar})` : ""}, ${bar.dealsLabel}`}
                onMouseEnter={() => setActive(i)}
                onFocus={() => setActive(i)}
                onBlur={() => setActive(null)}
                // the hit target is the whole column slot, not just the thin bar
                className="relative flex h-full flex-1 cursor-default items-end justify-center rounded outline-offset-2"
              >
                {active === i && (
                  <div role="tooltip" className="absolute bottom-full z-10 mb-2 whitespace-nowrap rounded-md border border-line bg-surface px-3 py-2 text-sm shadow-lg">
                    <p className="font-semibold tabular-nums">{bar.valueLabel}</p>
                    <p className="text-muted">
                      {bar.fullLabel}
                      {bar.partial && `, ${soFar}`}
                    </p>
                    <p className="text-muted">{bar.dealsLabel}</p>
                  </div>
                )}
                <div className="relative flex w-6 flex-col items-center" style={{ height: `${height}%` }}>
                  {showLabel && active !== i && (
                    <span className="absolute bottom-full mb-1 whitespace-nowrap text-xs font-medium tabular-nums">{bar.valueLabel}</span>
                  )}
                  <div
                    className={`h-full w-full rounded-t ${bar.partial ? "bg-chart/55" : "bg-chart"} ${active === i ? "brightness-110" : ""}`}
                  />
                </div>
              </li>
            );
          })}
        </ol>
      </div>

      <ol className="mt-2 flex justify-around ps-14 text-xs text-muted" aria-hidden="true">
        {bars.map((bar) => (
          <li key={bar.key} className="flex-1 text-center">
            {bar.label}
            {bar.partial && <span className="block">{soFar}</span>}
          </li>
        ))}
      </ol>

      <details className="mt-4">
        <summary className="cursor-pointer text-sm text-muted hover:text-ink">{tableToggle}</summary>
        <table className="mt-2 w-full text-sm">
          <thead className="text-muted">
            <tr>
              <th scope="col" className="py-1 text-start font-medium">{columns.month}</th>
              <th scope="col" className="py-1 text-end font-medium">{columns.amount}</th>
              <th scope="col" className="py-1 text-end font-medium">{columns.deals}</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-line">
            {bars.map((bar) => (
              <tr key={bar.key}>
                <th scope="row" className="py-1.5 text-start font-normal">
                  {bar.fullLabel}
                  {bar.partial && ` (${soFar})`}
                </th>
                <td className="py-1.5 text-end tabular-nums">{bar.valueLabel}</td>
                <td className="py-1.5 text-end tabular-nums">{bar.deals}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </details>
    </figure>
  );
}
