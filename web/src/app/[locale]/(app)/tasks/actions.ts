"use server";

import { refresh } from "next/cache";
import { z } from "zod";
import { createClient } from "@/lib/supabase/server";

export type TaskFormState = { ok: boolean; error: "title" | "generic" | null; savedAt?: number };

const uuid = z.string().uuid();

const taskSchema = z.object({
  title: z.string().trim().min(1).max(300),
  due: z.preprocess((v) => (v === "" ? null : v), z.iso.date().nullable()),
  priority: z.enum(["low", "medium", "high"]),
  contact_id: z.preprocess((v) => (v === "" || v === null ? null : v), z.string().uuid().nullable()),
});

/** Used by the tasks page and the contact page (which sends its contact id as a hidden field). */
export async function createTask(_prev: TaskFormState, formData: FormData): Promise<TaskFormState> {
  const parsed = taskSchema.safeParse({
    title: formData.get("title") ?? "",
    due: formData.get("due") ?? "",
    priority: formData.get("priority") ?? "medium",
    contact_id: formData.get("contact_id"),
  });
  if (!parsed.success) {
    return { ok: false, error: parsed.error.issues.some((i) => i.path[0] === "title") ? "title" : "generic" };
  }

  const supabase = await createClient();
  const { error } = await supabase.from("tasks").insert({
    title: parsed.data.title,
    priority: parsed.data.priority,
    // A due *date*: stored at midday UTC, which is the same calendar day in Israel all year round.
    due_at: parsed.data.due ? `${parsed.data.due}T12:00:00Z` : null,
    contact_id: parsed.data.contact_id,
  });
  if (error) {
    console.error("createTask", error);
    return { ok: false, error: "generic" };
  }
  refresh();
  return { ok: true, error: null, savedAt: Date.now() };
}

export async function setTaskDone(id: string, done: boolean): Promise<{ ok: boolean }> {
  if (!uuid.safeParse(id).success) return { ok: false };
  const supabase = await createClient();
  const { error, count } = await supabase
    .from("tasks")
    .update({ completed_at: done ? new Date().toISOString() : null }, { count: "exact" })
    .eq("id", id);
  if (error || count === 0) return { ok: false };
  refresh();
  return { ok: true };
}

export async function deleteTask(id: string): Promise<{ ok: boolean }> {
  if (!uuid.safeParse(id).success) return { ok: false };
  const supabase = await createClient();
  const { error, count } = await supabase.from("tasks").delete({ count: "exact" }).eq("id", id);
  if (error || count === 0) return { ok: false };
  refresh();
  return { ok: true };
}
