"use server";

import { refresh } from "next/cache";
import { z } from "zod";
import { createClient } from "@/lib/supabase/server";
import { CONTACT_SOURCES, CONTACT_STATUSES } from "@/lib/contact-options";

/** Error codes; the form translates them, so actions stay language-free. */
export type ContactFormError = "firstName" | "email" | "generic";
export type ContactFormState = { ok: boolean; errors: ContactFormError[]; savedAt?: number };

const blankToNull = (v: unknown) => (typeof v === "string" && v.trim() === "" ? null : v);

const contactSchema = z.object({
  first_name: z.string().trim().min(1, "firstName").max(100),
  last_name: z.preprocess(blankToNull, z.string().trim().max(100).nullable()),
  email: z.preprocess(blankToNull, z.string().trim().email("email").max(200).nullable()),
  phone: z.preprocess(blankToNull, z.string().trim().max(40).nullable()),
  position: z.preprocess(blankToNull, z.string().trim().max(100).nullable()),
  company_id: z.preprocess(blankToNull, z.string().uuid().nullable()),
  status: z.enum(CONTACT_STATUSES),
  source: z.preprocess(blankToNull, z.enum(CONTACT_SOURCES).nullable()),
  tags: z
    .string()
    .transform((raw) => [...new Set(raw.split(",").map((t) => t.trim().toLowerCase()).filter(Boolean))].slice(0, 20)),
});

function parse(formData: FormData) {
  const result = contactSchema.safeParse({
    first_name: formData.get("first_name") ?? "",
    last_name: formData.get("last_name"),
    email: formData.get("email"),
    phone: formData.get("phone"),
    position: formData.get("position"),
    company_id: formData.get("company_id"),
    status: formData.get("status") ?? "lead",
    source: formData.get("source"),
    tags: formData.get("tags") ?? "",
  });
  if (result.success) return { data: result.data };

  const errors = new Set<ContactFormError>();
  for (const issue of result.error.issues) {
    errors.add(issue.message === "firstName" || issue.message === "email" ? issue.message : "generic");
  }
  return { errors: [...errors] };
}

export async function createContact(_prev: ContactFormState, formData: FormData): Promise<ContactFormState> {
  const parsed = parse(formData);
  if (!parsed.data) return { ok: false, errors: parsed.errors };

  const supabase = await createClient();
  // owner_id is filled by the database from the signed-in user; RLS rejects anything else.
  const { error } = await supabase.from("contacts").insert(parsed.data);
  if (error) {
    console.error("createContact", error);
    return { ok: false, errors: ["generic"] };
  }

  refresh();
  return { ok: true, errors: [], savedAt: Date.now() };
}

export async function updateContact(id: string, _prev: ContactFormState, formData: FormData): Promise<ContactFormState> {
  const parsed = parse(formData);
  if (!parsed.data) return { ok: false, errors: parsed.errors };

  const supabase = await createClient();
  const { error, count } = await supabase.from("contacts").update(parsed.data, { count: "exact" }).eq("id", id);
  if (error || count === 0) {
    console.error("updateContact", error ?? "no row updated");
    return { ok: false, errors: ["generic"] };
  }

  refresh();
  return { ok: true, errors: [], savedAt: Date.now() };
}

export async function deleteContact(id: string): Promise<{ ok: boolean }> {
  const supabase = await createClient();
  const { error } = await supabase.from("contacts").delete().eq("id", id);
  if (error) {
    console.error("deleteContact", error);
    return { ok: false };
  }

  refresh();
  return { ok: true };
}
