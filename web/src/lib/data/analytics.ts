import "server-only";
import { createClient } from "@/lib/supabase/server";
import type { Database } from "@/lib/database.types";

type Views = Database["public"]["Views"];
type Num = number | string | null;

export type CycleRow = { outcome: "won" | "lost"; deals: number; avgDays: number; medianDays: number; p25Days: number; p75Days: number };
export type StageRow = { stageId: string; key: string | null; name: string | null; position: number; stays: number; avgDays: number | null; medianDays: number | null };
export type SourceRow = {
  source: Views["source_performance"]["Row"]["source"];
  deals: number;
  won: number;
  lost: number;
  open: number;
  closed: number;
  winRate: number | null; // 0..1
  wonAmount: number;
  avgWonAmount: number | null;
  medianDaysToWin: number | null;
};

// PostgREST may send numeric columns as strings; normalise once here.
const num = (v: Num) => (v === null || v === undefined ? null : Number(v));

/**
 * The two analytics questions, answered by database views (see the analytics migration):
 * how long a sale takes and where it stalls, and which lead sources pay off.
 */
export async function getAnalytics() {
  const supabase = await createClient();
  const [cycle, stages, sources] = await Promise.all([
    supabase.from("sales_cycle_summary").select("*"),
    supabase.from("stage_durations").select("*").order("position"),
    supabase.from("source_performance").select("*"),
  ]);
  for (const r of [cycle, stages, sources]) {
    if (r.error) throw new Error(`Failed to load analytics: ${r.error.message}`);
  }

  const cycleRows: CycleRow[] = (cycle.data ?? [])
    .filter((r) => r.outcome === "won" || r.outcome === "lost")
    .map((r) => ({
      outcome: r.outcome as "won" | "lost",
      deals: num(r.deals)!,
      avgDays: num(r.avg_days)!,
      medianDays: num(r.median_days)!,
      p25Days: num(r.p25_days)!,
      p75Days: num(r.p75_days)!,
    }));

  return {
    won: cycleRows.find((r) => r.outcome === "won") ?? null,
    lost: cycleRows.find((r) => r.outcome === "lost") ?? null,
    stages: (stages.data ?? []).map<StageRow>((r) => ({
      stageId: r.stage_id,
      key: r.key,
      name: r.name,
      position: r.position,
      stays: num(r.stays)!,
      avgDays: num(r.avg_days),
      medianDays: num(r.median_days),
    })),
    sources: (sources.data ?? []).map<SourceRow>((r) => {
      const won = num(r.won)!;
      const lost = num(r.lost)!;
      return {
        source: r.source,
        deals: num(r.deals)!,
        won,
        lost,
        open: num(r.open)!,
        closed: won + lost,
        winRate: won + lost > 0 ? won / (won + lost) : null,
        wonAmount: num(r.won_amount) ?? 0,
        avgWonAmount: num(r.avg_won_amount),
        medianDaysToWin: num(r.median_days_to_win),
      };
    }),
  };
}

export type Analytics = Awaited<ReturnType<typeof getAnalytics>>;
