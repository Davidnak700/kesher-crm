import "server-only";
import { createClient } from "@/lib/supabase/server";
import type { Enums } from "@/lib/database.types";

/** Won / lost columns show only recently closed deals, so the board stays about current work. */
export const CLOSED_WINDOW_DAYS = 30;

export type StageKind = Enums<"stage_kind">;

export type BoardStage = {
  id: string;
  key: string | null;
  name: string | null;
  position: number;
  kind: StageKind;
  probability: number;
};

export type BoardDeal = {
  id: string;
  title: string;
  amount: number;
  currency: string;
  stage_id: string;
  position: number;
  expected_close_date: string | null;
  closed_at: string | null;
  contact: { id: string; first_name: string; last_name: string | null } | null;
  company: { id: string; name: string } | null;
};

export type ContactOption = { id: string; name: string; company_id: string | null };

export async function getBoard() {
  const supabase = await createClient();
  const since = new Date(Date.now() - CLOSED_WINDOW_DAYS * 24 * 60 * 60 * 1000).toISOString();

  const [stages, deals] = await Promise.all([
    supabase
      .from("pipeline_stages")
      .select("id, key, name, position, kind, probability")
      .order("position"),
    supabase
      .from("deals")
      .select(
        "id, title, amount, currency, stage_id, position, expected_close_date, closed_at, contact:contacts(id, first_name, last_name), company:companies(id, name)",
      )
      .or(`closed_at.is.null,closed_at.gte."${since}"`)
      .order("position"),
  ]);

  if (stages.error) throw new Error(`Failed to load stages: ${stages.error.message}`);
  if (deals.error) throw new Error(`Failed to load deals: ${deals.error.message}`);

  return {
    stages: stages.data as BoardStage[],
    deals: (deals.data as unknown as BoardDeal[]).map((d) => ({ ...d, amount: Number(d.amount), position: Number(d.position) })),
  };
}

export async function getContactOptions(): Promise<ContactOption[]> {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("contacts")
    .select("id, first_name, last_name, company_id")
    .order("first_name")
    .limit(1000);
  if (error) throw new Error(`Failed to load contacts: ${error.message}`);
  return data.map((c) => ({
    id: c.id,
    name: [c.first_name, c.last_name].filter(Boolean).join(" "),
    company_id: c.company_id,
  }));
}
