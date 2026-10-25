"use server";

import { refresh } from "next/cache";
import { z } from "zod";
import { createClient } from "@/lib/supabase/server";

/** Error codes; the dialog translates them, so actions stay language-free. */
export type DealFormError = "title" | "amount" | "stage" | "generic";
export type DealFormState = { ok: boolean; errors: DealFormError[]; savedAt?: number };

const blankToNull = (v: unknown) => (typeof v === "string" && v.trim() === "" ? null : v);

const dealSchema = z.object({
  title: z.string().trim().min(1, "title").max(200, "title"),
  amount: z.preprocess(
    (v) => (typeof v === "string" ? Number(v.replace(/[\s,₪$]/g, "") || 0) : v),
    z.number({ error: "amount" }).finite("amount").min(0, "amount").max(9_999_999_999, "amount"),
  ),
  stage_id: z.string().uuid("stage"),
  contact_id: z.preprocess(blankToNull, z.string().uuid().nullable()),
  expected_close_date: z.preprocess(blankToNull, z.iso.date().nullable()),
});

const KNOWN: DealFormError[] = ["title", "amount", "stage"];

function parse(formData: FormData) {
  const result = dealSchema.safeParse({
    title: formData.get("title") ?? "",
    amount: formData.get("amount") ?? "0",
    stage_id: formData.get("stage_id") ?? "",
    contact_id: formData.get("contact_id"),
    expected_close_date: formData.get("expected_close_date"),
  });
  if (result.success) return { data: result.data };
  const errors = new Set<DealFormError>();
  for (const issue of result.error.issues) {
    errors.add(KNOWN.includes(issue.message as DealFormError) ? (issue.message as DealFormError) : "generic");
  }
  return { errors: [...errors] };
}

type Supabase = Awaited<ReturnType<typeof createClient>>;

/** A deal belongs to the contact's company, so we take it from the contact rather than the form. */
async function companyOf(supabase: Supabase, contactId: string | null) {
  if (!contactId) return null;
  const { data } = await supabase.from("contacts").select("company_id").eq("id", contactId).maybeSingle();
  return data?.company_id ?? null;
}

/** New cards go to the bottom of their column. */
async function nextPosition(supabase: Supabase, stageId: string) {
  const { data } = await supabase
    .from("deals")
    .select("position")
    .eq("stage_id", stageId)
    .order("position", { ascending: false })
    .limit(1)
    .maybeSingle();
  return (data ? Number(data.position) : 0) + 1000;
}

export async function createDeal(_prev: DealFormState, formData: FormData): Promise<DealFormState> {
  const parsed = parse(formData);
  if (!parsed.data) return { ok: false, errors: parsed.errors };

  const supabase = await createClient();
  const { error } = await supabase.from("deals").insert({
    ...parsed.data,
    company_id: await companyOf(supabase, parsed.data.contact_id),
    position: await nextPosition(supabase, parsed.data.stage_id),
  });
  if (error) {
    console.error("createDeal", error);
    return { ok: false, errors: ["generic"] };
  }

  refresh();
  return { ok: true, errors: [], savedAt: Date.now() };
}

export async function updateDeal(id: string, _prev: DealFormState, formData: FormData): Promise<DealFormState> {
  const parsed = parse(formData);
  if (!parsed.data) return { ok: false, errors: parsed.errors };

  const supabase = await createClient();
  const { data: current } = await supabase.from("deals").select("stage_id").eq("id", id).maybeSingle();
  if (!current) return { ok: false, errors: ["generic"] };

  const stageChanged = current.stage_id !== parsed.data.stage_id;
  const { error } = await supabase
    .from("deals")
    .update({
      ...parsed.data,
      company_id: await companyOf(supabase, parsed.data.contact_id),
      ...(stageChanged ? { position: await nextPosition(supabase, parsed.data.stage_id) } : {}),
    })
    .eq("id", id);
  if (error) {
    console.error("updateDeal", error);
    return { ok: false, errors: ["generic"] };
  }

  refresh();
  return { ok: true, errors: [], savedAt: Date.now() };
}

const moveSchema = z.object({ id: z.string().uuid(), stageId: z.string().uuid(), position: z.number().finite() });

/**
 * Drag and drop. The board has already moved the card on screen; this makes it permanent.
 * The database trigger logs the stage change and stamps closed_at for won / lost.
 */
export async function moveDeal(input: { id: string; stageId: string; position: number }): Promise<{ ok: boolean }> {
  const parsed = moveSchema.safeParse(input);
  if (!parsed.success) return { ok: false };

  const supabase = await createClient();
  const { error, count } = await supabase
    .from("deals")
    .update({ stage_id: parsed.data.stageId, position: parsed.data.position }, { count: "exact" })
    .eq("id", parsed.data.id);
  if (error || count === 0) {
    console.error("moveDeal", error ?? "no row updated");
    return { ok: false };
  }

  refresh();
  return { ok: true };
}

export async function deleteDeal(id: string): Promise<{ ok: boolean }> {
  const supabase = await createClient();
  const { error } = await supabase.from("deals").delete().eq("id", id);
  if (error) {
    console.error("deleteDeal", error);
    return { ok: false };
  }
  refresh();
  return { ok: true };
}
