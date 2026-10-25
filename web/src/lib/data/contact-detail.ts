import "server-only";
import { createClient } from "@/lib/supabase/server";
import type { Enums } from "@/lib/database.types";
import type { ContactListItem } from "./contacts";

export type ContactDeal = {
  id: string;
  title: string;
  amount: number;
  currency: string;
  expected_close_date: string | null;
  closed_at: string | null;
  stage: { id: string; key: string | null; name: string | null; kind: Enums<"stage_kind"> } | null;
};

export type ContactTask = {
  id: string;
  title: string;
  priority: Enums<"task_priority">;
  due_at: string | null;
  completed_at: string | null;
  deal: { id: string; title: string } | null;
};

export type ContactActivity = {
  id: string;
  type: Enums<"activity_type">;
  body: string;
  occurred_at: string;
  deal: { id: string; title: string } | null;
};

export type StageChange = {
  id: number;
  deal_id: string;
  from_stage_id: string | null;
  to_stage_id: string;
  changed_at: string;
};

export type StageInfo = { id: string; key: string | null; name: string | null };

const isUuid = (v: string) => /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(v);

/** Everything the contact page shows. Returns null if the contact doesn't exist for this user. */
export async function getContactDetail(id: string) {
  if (!isUuid(id)) return null;
  const supabase = await createClient();

  const { data: contact, error } = await supabase
    .from("contacts")
    .select("id, first_name, last_name, email, phone, position, status, source, tags, created_at, company:companies(id, name)")
    .eq("id", id)
    .maybeSingle();
  if (error) throw new Error(`Failed to load contact: ${error.message}`);
  if (!contact) return null;

  const [deals, activities, stages] = await Promise.all([
    supabase
      .from("deals")
      .select("id, title, amount, currency, expected_close_date, closed_at, stage:pipeline_stages(id, key, name, kind)")
      .eq("contact_id", id)
      .order("created_at", { ascending: false }),
    supabase
      .from("activities")
      .select("id, type, body, occurred_at, deal:deals(id, title)")
      .eq("contact_id", id)
      .order("occurred_at", { ascending: false })
      .limit(100),
    supabase.from("pipeline_stages").select("id, key, name"),
  ]);
  if (deals.error) throw new Error(`Failed to load deals: ${deals.error.message}`);
  if (activities.error) throw new Error(`Failed to load activities: ${activities.error.message}`);
  if (stages.error) throw new Error(`Failed to load stages: ${stages.error.message}`);

  const dealIds = deals.data.map((d) => d.id);

  // Tasks for the contact itself or for any of their deals; stage moves of their deals.
  const [tasks, history] = await Promise.all([
    supabase
      .from("tasks")
      .select("id, title, priority, due_at, completed_at, deal:deals(id, title)")
      .or(dealIds.length ? `contact_id.eq.${id},deal_id.in.(${dealIds.join(",")})` : `contact_id.eq.${id}`)
      .order("completed_at", { ascending: false, nullsFirst: true })
      .order("due_at", { ascending: true, nullsFirst: false })
      .limit(200),
    dealIds.length
      ? supabase
          .from("deal_stage_history")
          .select("id, deal_id, from_stage_id, to_stage_id, changed_at")
          .in("deal_id", dealIds)
          .order("changed_at", { ascending: false })
          .limit(200)
      : Promise.resolve({ data: [] as StageChange[], error: null }),
  ]);
  if (tasks.error) throw new Error(`Failed to load tasks: ${tasks.error.message}`);
  if (history.error) throw new Error(`Failed to load stage history: ${history.error.message}`);

  return {
    contact: contact as unknown as ContactListItem,
    deals: (deals.data as unknown as ContactDeal[]).map((d) => ({ ...d, amount: Number(d.amount) })),
    tasks: tasks.data as unknown as ContactTask[],
    activities: activities.data as unknown as ContactActivity[],
    history: history.data as StageChange[],
    stages: stages.data as StageInfo[],
  };
}
