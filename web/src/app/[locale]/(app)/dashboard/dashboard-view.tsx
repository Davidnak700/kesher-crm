import Link from "next/link";
import { connection } from "next/server";
import { format, type Locale } from "@/i18n/config";
import { getDictionary, getLocale, type Dictionary } from "@/i18n/get-dictionary";
import { getDashboard } from "@/lib/data/dashboard";
import { formatMoney } from "@/lib/format";
import { fullName } from "@/lib/names";
import { israelDay } from "@/lib/time";
import { RevenueChart, type MonthBar } from "./revenue-chart";

const numberLocale: Record<Locale, string> = { he: "he-IL", en: "en-US" };
const dateLocale: Record<Locale, string> = { he: "he-IL", en: "en-GB" };
const MONTHS = 6;

/** The last `count` months as YYYY-MM, oldest first, ending with the given month. */
function lastMonths(current: string, count: number) {
  const [y, m] = current.split("-").map(Number);
  return Array.from({ length: count }, (_, i) => {
    const d = new Date(Date.UTC(y, m - 1 - (count - 1 - i), 1));
    return d.toISOString().slice(0, 7);
  });
}

/** A round axis maximum and 4 even steps: 0 / 25K / 50K / 75K / 100K. */
function niceScale(max: number) {
  if (max <= 0) return { top: 4, step: 1 };
  const rough = max / 4;
  const magnitude = 10 ** Math.floor(Math.log10(rough));
  const step = [1, 2, 2.5, 5, 10].map((f) => f * magnitude).find((s) => s >= rough)!;
  return { top: step * 4, step };
}

export async function DashboardView() {
  // "Today" is decided per request, never baked into a prerendered page.
  await connection();
  const locale = await getLocale();
  const today = israelDay();
  const [dict, data] = await Promise.all([getDictionary(locale), getDashboard(today)]);
  const t = dict.dashboard;
  const currency = "ILS";
  const money = (n: number) => formatMoney(n, currency, locale);
  const compactMoney = new Intl.NumberFormat(numberLocale[locale], { style: "currency", currency, notation: "compact", maximumFractionDigits: 1 });
  const stageLabel = (key: string | null, name: string | null) =>
    (key && dict.deals.stages[key as keyof Dictionary["deals"]["stages"]]) || name || "";

  // ---- monthly results ----
  const byMonth = new Map(data.months.map((m) => [m.month.slice(0, 7), m]));
  const keys = lastMonths(today.slice(0, 7), MONTHS);
  const monthName = (key: string, style: "short" | "long") =>
    new Intl.DateTimeFormat(dateLocale[locale], { month: style, ...(style === "long" ? { year: "numeric" } : {}), timeZone: "UTC" }).format(new Date(`${key}-01T00:00:00Z`));
  const bars: MonthBar[] = keys.map((key, i) => {
    const row = byMonth.get(key);
    const value = Number(row?.won_amount ?? 0);
    const deals = Number(row?.won_count ?? 0);
    return {
      key,
      label: monthName(key, "short"),
      fullLabel: monthName(key, "long"),
      value,
      valueLabel: money(value),
      deals,
      dealsLabel: format(dict.dashboard.revenue.tooltipDeals, { count: deals }),
      partial: i === keys.length - 1,
    };
  });
  const scale = niceScale(Math.max(...bars.map((b) => b.value)));
  const ticks = Array.from({ length: 5 }, (_, i) => ({ value: i * scale.step, label: compactMoney.format(i * scale.step) }));

  const thisMonth = bars[bars.length - 1].value;
  const lastMonth = bars[bars.length - 2].value;
  const delta = lastMonth > 0 ? Math.round(((thisMonth - lastMonth) / lastMonth) * 100) : null;

  const period = keys.map((k) => byMonth.get(k)).filter(Boolean);
  const won = period.reduce((s, m) => s + Number(m!.won_count), 0);
  const lost = period.reduce((s, m) => s + Number(m!.lost_count), 0);
  const wonAmount = period.reduce((s, m) => s + Number(m!.won_amount), 0);
  const winRate = won + lost > 0 ? Math.round((won / (won + lost)) * 100) : null;
  const avgWon = won > 0 ? wonAmount / won : null;

  // ---- pipeline ----
  const open = data.pipeline.filter((s) => s.kind === "open");
  const openTotal = open.reduce((s, r) => s + Number(r.total_amount), 0);
  const openCount = open.reduce((s, r) => s + Number(r.deals_count), 0);
  const forecast = open.reduce((s, r) => s + Number(r.weighted_amount), 0);

  // ---- funnel ----
  const funnelTop = Number(data.funnel[0]?.deals_reached ?? 0);

  const percent = new Intl.NumberFormat(numberLocale[locale], { style: "percent", maximumFractionDigits: 0 });
  const shortDate = new Intl.DateTimeFormat(dateLocale[locale], { day: "numeric", month: "short", timeZone: "UTC" });

  return (
    <div className="mt-6 space-y-6">
      {/* ---------------- headline numbers ---------------- */}
      <section aria-label={t.title} className="grid gap-px overflow-hidden rounded-xl border border-line bg-line lg:grid-cols-[minmax(0,1.4fr)_repeat(4,minmax(0,1fr))]">
        <div className="bg-surface p-5">
          <p className="text-sm text-muted">{t.wonThisMonth}</p>
          <p className="mt-1 text-5xl font-semibold tracking-tight">{money(thisMonth)}</p>
          <p className="mt-2 text-sm">
            {delta === null ? (
              <span className="text-muted">{t.noLastMonth}</span>
            ) : (
              <span className={delta >= 0 ? "text-brand" : "text-danger"}>
                <span aria-hidden="true">{delta >= 0 ? "↑ " : "↓ "}</span>
                <span className="sr-only">{delta >= 0 ? t.up : t.down}: </span>
                {format(t.vsLastMonth, { delta: percent.format(Math.abs(delta) / 100) })}
              </span>
            )}
          </p>
        </div>
        <Stat label={t.openPipeline} value={money(openTotal)} hint={format(t.openDeals, { count: openCount })} />
        <Stat label={t.forecast} value={money(forecast)} hint={t.forecastHint} />
        <Stat
          label={t.winRate}
          value={winRate === null ? "—" : percent.format(winRate / 100)}
          hint={winRate === null ? t.noClosed : format(t.winRateHint, { won, closed: won + lost })}
        />
        <Stat label={t.avgDeal} value={avgWon === null ? "—" : money(avgWon)} hint={t.avgDealHint} />
      </section>

      <div className="grid gap-6 lg:grid-cols-3">
        {/* ---------------- revenue by month ---------------- */}
        <section aria-labelledby="revenue-title" className="rounded-xl border border-line bg-surface p-5 lg:col-span-2">
          <h2 id="revenue-title" className="text-lg font-semibold">{t.revenue.title}</h2>
          <p className="text-sm text-muted">{t.revenue.subtitle}</p>
          <div className="mt-10">
            <RevenueChart
              bars={bars}
              ticks={ticks}
              max={scale.top}
              soFar={t.revenue.soFar}
              tableToggle={t.revenue.tableToggle}
              columns={{ month: t.revenue.month, amount: t.revenue.amount, deals: t.revenue.deals }}
            />
          </div>
        </section>

        {/* ---------------- needs attention ---------------- */}
        <section aria-labelledby="attention-title" className="rounded-xl border border-line bg-surface p-5">
          <h2 id="attention-title" className="text-lg font-semibold">{t.attention.title}</h2>
          <dl className="mt-4 grid grid-cols-2 gap-3">
            <div className={`rounded-lg p-3 ${data.overdueTasks > 0 ? "bg-danger-soft" : "bg-paper"}`}>
              <dt className="text-sm text-muted">{t.attention.overdueTasks}</dt>
              <dd className={`text-2xl font-semibold ${data.overdueTasks > 0 ? "text-danger" : ""}`}>{data.overdueTasks}</dd>
            </div>
            <div className="rounded-lg bg-paper p-3">
              <dt className="text-sm text-muted">{t.attention.dueToday}</dt>
              <dd className="text-2xl font-semibold">{data.tasksDueToday}</dd>
            </div>
          </dl>
          <Link href={`/${locale}/tasks`} className="mt-3 inline-block text-sm text-brand hover:underline">
            {t.attention.openTasks}
          </Link>

          <h3 className="mt-6 text-sm font-semibold">{t.attention.pastClose}</h3>
          {data.lateDeals.length === 0 ? (
            <p className="mt-2 text-sm text-muted">{t.attention.noPastClose}</p>
          ) : (
            <ul className="mt-2 divide-y divide-line">
              {data.lateDeals.map((deal) => (
                <li key={deal.id} className="flex items-baseline justify-between gap-3 py-2">
                  <div className="min-w-0">
                    <p className="truncate text-[15px] font-medium"><bdi>{deal.title}</bdi></p>
                    <p className="text-sm text-muted">
                      {deal.contact && (
                        <Link href={`/${locale}/contacts/${deal.contact.id}`} className="me-2 hover:text-brand hover:underline">
                          <bdi>{fullName(deal.contact)}</bdi>
                        </Link>
                      )}
                      <span className="text-danger">
                        {format(t.attention.closeWas, { date: shortDate.format(new Date(`${deal.expected_close_date}T00:00:00Z`)) })}
                      </span>
                    </p>
                  </div>
                  <span className="shrink-0 text-sm font-semibold tabular-nums">{formatMoney(deal.amount, deal.currency, locale)}</span>
                </li>
              ))}
            </ul>
          )}
        </section>
      </div>

      {/* ---------------- funnel ---------------- */}
      <section aria-labelledby="funnel-title" className="rounded-xl border border-line bg-surface p-5">
        <h2 id="funnel-title" className="text-lg font-semibold">{t.funnel.title}</h2>
        <p className="text-sm text-muted">{t.funnel.subtitle}</p>
        <ol className="mt-5 space-y-3">
          {data.funnel.map((row, i) => {
            const reached = Number(row.deals_reached);
            const previous = i > 0 ? Number(data.funnel[i - 1].deals_reached) : null;
            const width = funnelTop > 0 ? (reached / funnelTop) * 100 : 0;
            const conversion = previous ? reached / previous : null;
            return (
              <li key={row.stage_id} className="grid grid-cols-[8rem_minmax(0,1fr)] items-center gap-3 sm:grid-cols-[10rem_minmax(0,1fr)]">
                <span className="truncate text-sm">{stageLabel(row.key, row.name)}</span>
                <div className="flex items-center gap-3">
                  <div className="h-5 rounded-e bg-chart" style={{ width: `max(${width}%, 4px)` }} aria-hidden="true" />
                  <span className="shrink-0 text-sm">
                    <span className="font-semibold tabular-nums">{reached}</span>
                    {conversion !== null && (
                      <span className="ms-2 text-muted">{format(t.funnel.conversion, { pct: Math.round(conversion * 100) })}</span>
                    )}
                  </span>
                </div>
              </li>
            );
          })}
        </ol>
      </section>
    </div>
  );
}

function Stat({ label, value, hint }: { label: string; value: string; hint: string }) {
  return (
    <div className="bg-surface p-5">
      <p className="text-sm text-muted">{label}</p>
      <p className="mt-1 text-2xl font-semibold">{value}</p>
      <p className="mt-1 text-sm text-muted">{hint}</p>
    </div>
  );
}
