import "server-only";
import { createClient } from "@/lib/supabase/server";
import type { Enums } from "@/lib/database.types";

export type TaskRow = {
  id: string;
  title: string;
  priority: Enums<"task_priority">;
  due_at: string | null;
  completed_at: string | null;
  contact: { id: string; first_name: string; last_name: string | null } | null;
  deal: { id: string; title: string } | null;
};

const SELECT = "id, title, priority, due_at, completed_at, contact:contacts(id, first_name, last_name), deal:deals(id, title)";

export async function getOpenTasks() {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("tasks")
    .select(SELECT)
    .is("completed_at", null)
    .order("due_at", { ascending: true, nullsFirst: false })
    .order("created_at", { ascending: true })
    .limit(500);
  if (error) throw new Error(`Failed to load tasks: ${error.message}`);
  return data as unknown as TaskRow[];
}

export async function getCompletedTasks() {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("tasks")
    .select(SELECT)
    .not("completed_at", "is", null)
    .order("completed_at", { ascending: false })
    .limit(100);
  if (error) throw new Error(`Failed to load tasks: ${error.message}`);
  return data as unknown as TaskRow[];
}
