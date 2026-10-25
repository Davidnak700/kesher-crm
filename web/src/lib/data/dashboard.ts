import "server-only";
import { createClient } from "@/lib/supabase/server";
import type { Database } from "@/lib/database.types";
import { addDays, israelDayStart } from "@/lib/time";

type Views = Database["public"]["Views"];
export type PipelineRow = Views["pipeline_summary"]["Row"];
export type MonthRow = Views["monthly_sales"]["Row"];
export type FunnelRow = Views["funnel"]["Row"];

export type LateDeal = {
  id: string;
  title: string;
  amount: number;
  currency: string;
  expected_close_date: string;
  contact: { id: string; first_name: string; last_name: string | null } | null;
};

/**
 * Everything the dashboard shows. The numbers come from database views (see the migration),
 * so the same definitions of "open", "won" and "forecast" are used everywhere.
 */
export async function getDashboard(today: string) {
  const supabase = await createClient();
  const dayStart = israelDayStart(today).toISOString();
  const nextDayStart = israelDayStart(addDays(today, 1)).toISOString();

  const [pipeline, months, funnel, overdue, dueToday] = await Promise.all([
    supabase.from("pipeline_summary").select("*").order("position"),
    supabase.from("monthly_sales").select("*").order("month"),
    supabase.from("funnel").select("*").order("position"),
    supabase.from("tasks").select("id", { count: "exact", head: true }).is("completed_at", null).lt("due_at", dayStart),
    supabase
      .from("tasks")
      .select("id", { count: "exact", head: true })
      .is("completed_at", null)
      .gte("due_at", dayStart)
      .lt("due_at", nextDayStart),
  ]);
  for (const r of [pipeline, months, funnel, overdue, dueToday]) {
    if (r.error) throw new Error(`Failed to load the dashboard: ${r.error.message}`);
  }

  const openStageIds = (pipeline.data ?? []).filter((s) => s.kind === "open").map((s) => s.stage_id);
  const late = openStageIds.length
    ? await supabase
        .from("deals")
        .select("id, title, amount, currency, expected_close_date, contact:contacts(id, first_name, last_name)")
        .in("stage_id", openStageIds)
        .lt("expected_close_date", today)
        .order("expected_close_date")
        .limit(6)
    : { data: [], error: null };
  if (late.error) throw new Error(`Failed to load late deals: ${late.error.message}`);

  return {
    pipeline: pipeline.data as PipelineRow[],
    months: months.data as MonthRow[],
    funnel: funnel.data as FunnelRow[],
    overdueTasks: overdue.count ?? 0,
    tasksDueToday: dueToday.count ?? 0,
    lateDeals: (late.data as unknown as LateDeal[]).map((d) => ({ ...d, amount: Number(d.amount) })),
  };
}
