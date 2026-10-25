import type { Analytics, SourceRow, StageRow } from "@/lib/data/analytics";

/** Below this many closed deals a number is shown, but no conclusion is drawn from it. */
export const MIN_SAMPLE = 5;

export type CycleInsights = {
  typicalWin: { median: number; p25: number; p75: number; deals: number } | null;
  lostSooner: { lostMedian: number; wonMedian: number } | null;
  bottleneck: { stage: StageRow; avgDays: number; timesOthers: number } | null;
};

export type SourceInsights = {
  bestRate: SourceRow | null;
  topRevenue: SourceRow | null;
  worstRate: SourceRow | null;
  tooSmall: SourceRow[];
};

/**
 * Turns the numbers into the findings the page states in words. Pure, so the rules
 * ("at least 5 closed deals", "slowest stage") live in one place and are easy to test.
 */
export function cycleInsights(a: Analytics): CycleInsights {
  const won = a.won && a.won.deals >= MIN_SAMPLE ? a.won : null;
  const lost = a.lost && a.lost.deals >= MIN_SAMPLE ? a.lost : null;

  const measured = a.stages.filter((s) => s.stays >= MIN_SAMPLE && s.avgDays !== null);
  let bottleneck: CycleInsights["bottleneck"] = null;
  if (measured.length >= 2) {
    const slowest = measured.reduce((m, s) => (s.avgDays! > m.avgDays! ? s : m));
    const others = measured.filter((s) => s !== slowest);
    const othersAvg = others.reduce((sum, s) => sum + s.avgDays!, 0) / others.length;
    bottleneck = { stage: slowest, avgDays: slowest.avgDays!, timesOthers: othersAvg > 0 ? slowest.avgDays! / othersAvg : 0 };
  }

  return {
    typicalWin: won ? { median: won.medianDays, p25: won.p25Days, p75: won.p75Days, deals: won.deals } : null,
    lostSooner: won && lost && lost.medianDays < won.medianDays ? { lostMedian: lost.medianDays, wonMedian: won.medianDays } : null,
    bottleneck,
  };
}

export function sourceInsights(sources: SourceRow[]): SourceInsights {
  const enough = sources.filter((s) => s.closed >= MIN_SAMPLE);
  const tooSmall = sources.filter((s) => s.closed < MIN_SAMPLE);
  if (enough.length === 0) return { bestRate: null, topRevenue: null, worstRate: null, tooSmall };

  const byRate = [...enough].sort((x, y) => y.winRate! - x.winRate! || y.closed - x.closed);
  const bestRate = byRate[0];
  const worst = byRate[byRate.length - 1];
  const topRevenue = [...enough].sort((x, y) => y.wonAmount - x.wonAmount)[0];

  return {
    bestRate,
    topRevenue: topRevenue.wonAmount > 0 ? topRevenue : null,
    worstRate: enough.length >= 2 && worst.winRate! < bestRate.winRate! ? worst : null,
    tooSmall,
  };
}
