import { Fragment, type ReactNode } from "react";
import { format, type Locale } from "@/i18n/config";
import { getDictionary, getLocale, type Dictionary } from "@/i18n/get-dictionary";
import { getAnalytics } from "@/lib/data/analytics";
import { MIN_SAMPLE, cycleInsights, sourceInsights } from "@/lib/analytics-insights";
import { formatMoney } from "@/lib/format";

const numberLocale: Record<Locale, string> = { he: "he-IL", en: "en-US" };

/** Fills a "{key}" template and puts each value in bold, so findings read as sentences with the numbers standing out. */
function rich(template: string, values: Record<string, string | number>): ReactNode {
  return template.split(/(\{\w+\})/).map((part, i) => {
    const key = part.match(/^\{(\w+)\}$/)?.[1];
    if (key && key in values) return <strong key={i} className="font-semibold">{values[key]}</strong>;
    return <Fragment key={i}>{part}</Fragment>;
  });
}

export async function AnalyticsView() {
  const locale = await getLocale();
  const [dict, data] = await Promise.all([getDictionary(locale), getAnalytics()]);
  const t = dict.analytics;
  const currency = "ILS";

  const n0 = new Intl.NumberFormat(numberLocale[locale], { maximumFractionDigits: 0 });
  const n1 = new Intl.NumberFormat(numberLocale[locale], { maximumFractionDigits: 1 });
  const percent = new Intl.NumberFormat(numberLocale[locale], { style: "percent", maximumFractionDigits: 0 });
  const days = (n: number, digits: 0 | 1 = 0) => format(t.days, { n: (digits ? n1 : n0).format(n) });
  const money = (n: number) => formatMoney(n, currency, locale);
  const stageLabel = (key: string | null, name: string | null) =>
    (key && dict.deals.stages[key as keyof Dictionary["deals"]["stages"]]) || name || "";
  const sourceLabel = (s: string) => dict.contacts.source[s as keyof Dictionary["contacts"]["source"]] ?? s;

  const cycle = cycleInsights(data);
  const src = sourceInsights(data.sources);
  const closedTotal = (data.won?.deals ?? 0) + (data.lost?.deals ?? 0);

  // ---- time in stage: bars scaled to the slowest stage ----
  const maxStage = Math.max(0, ...data.stages.map((s) => (s.stays >= MIN_SAMPLE ? s.avgDays ?? 0 : 0)));

  // ---- sources: conclusions first (enough closed deals, by win rate), small groups after ----
  const sources = [...data.sources].sort((a, b) => {
    const aOk = a.closed >= MIN_SAMPLE, bOk = b.closed >= MIN_SAMPLE;
    if (aOk !== bOk) return aOk ? -1 : 1;
    return (b.winRate ?? -1) - (a.winRate ?? -1) || b.deals - a.deals;
  });

  return (
    <div className="mt-6 space-y-6">
      {/* ======================= Q1: how long does a sale take ======================= */}
      <section aria-labelledby="cycle-title" className="rounded-xl border border-line bg-surface p-5">
        <h2 id="cycle-title" className="text-xl font-semibold">{t.cycle.question}</h2>

        {closedTotal < MIN_SAMPLE ? (
          <p className="mt-3 text-muted">{format(t.cycle.empty, { min: MIN_SAMPLE })}</p>
        ) : (
          <>
            <dl className="mt-4 grid gap-px overflow-hidden rounded-lg border border-line bg-line sm:grid-cols-3">
              <Stat label={t.cycle.wonMedian} value={data.won ? days(data.won.medianDays) : "—"} hint={t.cycle.wonHint} />
              <Stat label={t.cycle.lostMedian} value={data.lost ? days(data.lost.medianDays) : "—"} hint={t.cycle.lostHint} />
              <Stat
                label={t.cycle.closed}
                value={n0.format(closedTotal)}
                hint={format(t.cycle.closedHint, { won: data.won?.deals ?? 0, lost: data.lost?.deals ?? 0 })}
              />
            </dl>

            <div className="mt-6 grid gap-8 lg:grid-cols-[minmax(0,1fr)_minmax(0,1.2fr)]">
              <div>
                <h3 className="text-sm font-semibold text-muted">{t.findings}</h3>
                <ul className="mt-2 space-y-3 text-[15px] leading-relaxed">
                  {cycle.typicalWin && (
                    <Finding>
                      {rich(t.cycle.typicalWin, {
                        median: days(cycle.typicalWin.median),
                        p25: days(cycle.typicalWin.p25),
                        p75: days(cycle.typicalWin.p75),
                      })}
                    </Finding>
                  )}
                  {cycle.bottleneck && (
                    <Finding>
                      {rich(t.cycle.bottleneck, {
                        stage: stageLabel(cycle.bottleneck.stage.key, cycle.bottleneck.stage.name),
                        days: days(cycle.bottleneck.avgDays, 1),
                        times: n1.format(cycle.bottleneck.timesOthers),
                      })}
                    </Finding>
                  )}
                  {cycle.lostSooner && <Finding>{rich(t.cycle.lostSooner, { lost: days(cycle.lostSooner.lostMedian) })}</Finding>}
                </ul>
              </div>

              <div>
                <h3 className="font-semibold">{t.cycle.stagesTitle}</h3>
                <p className="text-sm text-muted">{t.cycle.stagesSubtitle}</p>
                <ol className="mt-4 space-y-3">
                  {data.stages.map((s) => {
                    const measured = s.stays >= MIN_SAMPLE && s.avgDays !== null;
                    const slowest = cycle.bottleneck?.stage.stageId === s.stageId;
                    const width = measured && maxStage > 0 ? (s.avgDays! / maxStage) * 100 : 0;
                    return (
                      <li key={s.stageId} className="grid grid-cols-[6.5rem_minmax(0,1fr)_7.5rem] items-center gap-3 sm:grid-cols-[8rem_minmax(0,1fr)_9rem]">
                        <span className="truncate text-sm">
                          {stageLabel(s.key, s.name)}
                          {slowest && <span className="sr-only"> ({t.cycle.slowest})</span>}
                        </span>
                        {measured ? (
                          <>
                            {/* the track is a fixed width, so bar lengths compare directly */}
                            <div aria-hidden="true">
                              <div
                                className={`h-6 rounded-e ${slowest ? "bg-chart" : "bg-chart/35"}`}
                                style={{ width: `max(${width}%, 4px)` }}
                              />
                            </div>
                            <span className="text-sm leading-tight">
                              <span className="font-semibold tabular-nums">{days(s.avgDays!, 1)}</span>
                              {slowest && (
                                <span aria-hidden="true" className="ms-2 whitespace-nowrap rounded bg-brand-soft px-1.5 py-0.5 text-xs font-medium text-brand">
                                  {t.cycle.slowest}
                                </span>
                              )}
                              <span className="block text-xs text-muted">{format(t.cycle.moves, { count: s.stays })}</span>
                            </span>
                          </>
                        ) : (
                          <span className="col-span-2 text-sm text-muted">{t.cycle.notMeasured}</span>
                        )}
                      </li>
                    );
                  })}
                </ol>
              </div>
            </div>
          </>
        )}
      </section>

      {/* ======================= Q2: where do the best clients come from ======================= */}
      <section aria-labelledby="sources-title" className="rounded-xl border border-line bg-surface p-5">
        <h2 id="sources-title" className="text-xl font-semibold">{t.sources.question}</h2>
        <p className="text-sm text-muted">{t.sources.subtitle}</p>

        {sources.length === 0 ? (
          <p className="mt-3 text-muted">{t.sources.empty}</p>
        ) : (
          <>
            {(src.bestRate || src.topRevenue || src.worstRate) && (
              <div className="mt-4">
                <h3 className="text-sm font-semibold text-muted">{t.findings}</h3>
                <ul className="mt-2 space-y-3 text-[15px] leading-relaxed">
                  {src.bestRate && (
                    <Finding>
                      {rich(t.sources.bestRate, {
                        source: sourceLabel(src.bestRate.source),
                        rate: percent.format(src.bestRate.winRate!),
                        days: src.bestRate.medianDaysToWin === null ? "—" : days(src.bestRate.medianDaysToWin),
                      })}
                    </Finding>
                  )}
                  {src.topRevenue && (
                    <Finding>
                      {rich(t.sources.topRevenue, {
                        source: sourceLabel(src.topRevenue.source),
                        amount: money(src.topRevenue.wonAmount),
                        won: src.topRevenue.won,
                      })}
                    </Finding>
                  )}
                  {src.worstRate && (
                    <Finding>
                      {rich(t.sources.worstRate, {
                        source: sourceLabel(src.worstRate.source),
                        rate: percent.format(src.worstRate.winRate!),
                        lost: src.worstRate.lost,
                        closed: src.worstRate.closed,
                      })}
                    </Finding>
                  )}
                </ul>
                {src.tooSmall.length > 0 && (
                  <p className="mt-3 text-sm text-muted">
                    {format(t.sources.tooSmall, {
                      min: MIN_SAMPLE,
                      list: new Intl.ListFormat(locale, { type: "conjunction" }).format(src.tooSmall.map((s) => sourceLabel(s.source))),
                    })}
                  </p>
                )}
              </div>
            )}

            {/* phones: one card per source; wider screens: the table below */}
            <ul className="mt-6 divide-y divide-line border-y border-line sm:hidden">
              {sources.map((s) => {
                const enough = s.closed >= MIN_SAMPLE;
                return (
                  <li key={s.source} className="py-3 text-sm">
                    <p className="font-medium">
                      {sourceLabel(s.source)}
                      {!enough && <span className="ms-2 text-xs font-normal text-muted">({t.sources.fewClosed})</span>}
                    </p>
                    {s.winRate !== null && (
                      <div className="mt-1.5 flex items-center gap-2">
                        <span className="w-10 shrink-0 font-semibold tabular-nums">{percent.format(s.winRate)}</span>
                        <div className="h-2 flex-1 rounded-full bg-line" aria-hidden="true">
                          <div className={`h-2 rounded-full ${enough ? "bg-chart" : "bg-muted/40"}`} style={{ width: `${s.winRate * 100}%` }} />
                        </div>
                        <span className="shrink-0 text-xs text-muted">{format(t.sources.winRateOf, { won: s.won, closed: s.closed })}</span>
                      </div>
                    )}
                    <dl className="mt-2 grid grid-cols-3 gap-2 text-xs">
                      <div>
                        <dt className="text-muted">{t.sources.deals}</dt>
                        <dd className="font-semibold tabular-nums">{s.deals}</dd>
                      </div>
                      <div>
                        <dt className="text-muted">{t.sources.revenue}</dt>
                        <dd className="font-semibold tabular-nums">{money(s.wonAmount)}</dd>
                      </div>
                      <div>
                        <dt className="text-muted">{t.sources.daysToWin}</dt>
                        <dd className="font-semibold tabular-nums">{s.medianDaysToWin === null ? "—" : n1.format(s.medianDaysToWin)}</dd>
                      </div>
                    </dl>
                  </li>
                );
              })}
            </ul>

            <div className="mt-6 hidden overflow-x-auto sm:block">
              <table className="w-full min-w-[40rem] text-sm">
                <thead className="border-b border-line text-start text-muted">
                  <tr>
                    <th scope="col" className="py-2 pe-3 text-start font-medium">{t.sources.source}</th>
                    <th scope="col" className="px-3 py-2 text-end font-medium">{t.sources.deals}</th>
                    <th scope="col" className="w-[30%] px-3 py-2 text-start font-medium">{t.sources.winRate}</th>
                    <th scope="col" className="px-3 py-2 text-end font-medium">{t.sources.revenue}</th>
                    <th scope="col" className="px-3 py-2 text-end font-medium">{t.sources.avgDeal}</th>
                    <th scope="col" className="ps-3 py-2 text-end font-medium">
                      {t.sources.daysToWin} <span className="font-normal">({t.sources.daysToWinHint})</span>
                    </th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-line">
                  {sources.map((s) => {
                    const enough = s.closed >= MIN_SAMPLE;
                    return (
                      <tr key={s.source}>
                        <th scope="row" className="py-3 pe-3 text-start font-medium">
                          {sourceLabel(s.source)}
                          {!enough && <span className="ms-2 text-xs font-normal text-muted">({t.sources.fewClosed})</span>}
                        </th>
                        <td className="px-3 py-3 text-end tabular-nums">
                          {s.deals}
                          {s.open > 0 && <span className="block text-xs text-muted">{format(t.sources.openCount, { count: s.open })}</span>}
                        </td>
                        <td className="px-3 py-3">
                          {s.winRate === null ? (
                            <span className="text-muted">—</span>
                          ) : (
                            <div className="flex items-center gap-2">
                              <span className="w-10 shrink-0 font-semibold tabular-nums">{percent.format(s.winRate)}</span>
                              <div className="h-2 min-w-12 flex-1 rounded-full bg-line" aria-hidden="true">
                                <div
                                  className={`h-2 rounded-full ${enough ? "bg-chart" : "bg-muted/40"}`}
                                  style={{ width: `${s.winRate * 100}%` }}
                                />
                              </div>
                              <span className="shrink-0 text-xs text-muted">{format(t.sources.winRateOf, { won: s.won, closed: s.closed })}</span>
                            </div>
                          )}
                        </td>
                        <td className="px-3 py-3 text-end tabular-nums">{money(s.wonAmount)}</td>
                        <td className="px-3 py-3 text-end tabular-nums">{s.avgWonAmount === null ? "—" : money(s.avgWonAmount)}</td>
                        <td className="ps-3 py-3 text-end tabular-nums">{s.medianDaysToWin === null ? "—" : n1.format(s.medianDaysToWin)}</td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </>
        )}
      </section>

      {/* ======================= definitions ======================= */}
      <details className="rounded-xl border border-line bg-surface p-5 text-sm">
        <summary className="cursor-pointer font-semibold">{t.method.title}</summary>
        <ul className="mt-3 list-disc space-y-2 ps-5 text-muted">
          {t.method.items.map((item) => (
            <li key={item}>{format(item, { min: MIN_SAMPLE })}</li>
          ))}
        </ul>
      </details>
    </div>
  );
}

function Finding({ children }: { children: ReactNode }) {
  return (
    <li className="flex gap-2">
      <span aria-hidden="true" className="mt-2.5 h-1.5 w-1.5 shrink-0 rounded-full bg-brand" />
      <span>{children}</span>
    </li>
  );
}

function Stat({ label, value, hint }: { label: string; value: string; hint: string }) {
  return (
    <div className="bg-surface p-4">
      <dt className="text-sm text-muted">{label}</dt>
      <dd className="mt-1 text-2xl font-semibold">{value}</dd>
      <dd className="mt-1 text-sm text-muted">{hint}</dd>
    </div>
  );
}
