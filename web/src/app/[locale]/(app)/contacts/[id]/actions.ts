"use server";

import { refresh } from "next/cache";
import { z } from "zod";
import { createClient } from "@/lib/supabase/server";

export type ActivityFormState = { ok: boolean; error: "body" | "generic" | null; savedAt?: number };
export type TaskFormState = { ok: boolean; error: "title" | "generic" | null; savedAt?: number };

const uuid = z.string().uuid();

const activitySchema = z.object({
  type: z.enum(["note", "call", "email", "meeting"]),
  body: z.string().trim().min(1).max(5000),
});

export async function addActivity(contactId: string, _prev: ActivityFormState, formData: FormData): Promise<ActivityFormState> {
  const parsed = activitySchema.safeParse({ type: formData.get("type") ?? "note", body: formData.get("body") ?? "" });
  if (!uuid.safeParse(contactId).success) return { ok: false, error: "generic" };
  if (!parsed.success) {
    return { ok: false, error: parsed.error.issues.some((i) => i.path[0] === "body") ? "body" : "generic" };
  }

  const supabase = await createClient();
  const { error } = await supabase.from("activities").insert({ ...parsed.data, contact_id: contactId });
  if (error) {
    console.error("addActivity", error);
    return { ok: false, error: "generic" };
  }
  refresh();
  return { ok: true, error: null, savedAt: Date.now() };
}

export async function deleteActivity(id: string): Promise<{ ok: boolean }> {
  if (!uuid.safeParse(id).success) return { ok: false };
  const supabase = await createClient();
  const { error, count } = await supabase.from("activities").delete({ count: "exact" }).eq("id", id);
  if (error || count === 0) return { ok: false };
  refresh();
  return { ok: true };
}

const taskSchema = z.object({
  title: z.string().trim().min(1).max(300),
  due: z.preprocess((v) => (v === "" ? null : v), z.iso.date().nullable()),
  priority: z.enum(["low", "medium", "high"]),
});

export async function createTask(contactId: string, _prev: TaskFormState, formData: FormData): Promise<TaskFormState> {
  const parsed = taskSchema.safeParse({
    title: formData.get("title") ?? "",
    due: formData.get("due") ?? "",
    priority: formData.get("priority") ?? "medium",
  });
  if (!uuid.safeParse(contactId).success) return { ok: false, error: "generic" };
  if (!parsed.success) {
    return { ok: false, error: parsed.error.issues.some((i) => i.path[0] === "title") ? "title" : "generic" };
  }

  const supabase = await createClient();
  const { error } = await supabase.from("tasks").insert({
    title: parsed.data.title,
    priority: parsed.data.priority,
    // A due *date*: stored at midday UTC, which is the same calendar day in Israel all year round.
    due_at: parsed.data.due ? `${parsed.data.due}T12:00:00Z` : null,
    contact_id: contactId,
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
