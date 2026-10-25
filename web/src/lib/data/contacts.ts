import "server-only";
import { createClient } from "@/lib/supabase/server";
import type { Enums } from "@/lib/database.types";
import { CONTACT_STATUSES } from "@/lib/contact-options";

export const PAGE_SIZE = 25;

export type ContactStatus = Enums<"contact_status">;
export type ContactSource = Enums<"contact_source">;

export type ContactListItem = {
  id: string;
  first_name: string;
  last_name: string | null;
  email: string | null;
  phone: string | null;
  position: string | null;
  status: ContactStatus;
  source: ContactSource | null;
  tags: string[];
  created_at: string;
  company: { id: string; name: string } | null;
};

export type ContactQuery = { q: string; status: ContactStatus | null; page: number };

export function isContactStatus(value: unknown): value is ContactStatus {
  return CONTACT_STATUSES.includes(value as ContactStatus);
}

/** Turn raw searchParams into a safe, normalised query. */
export function parseContactQuery(params: Record<string, string | string[] | undefined>): ContactQuery {
  const one = (v: string | string[] | undefined) => (Array.isArray(v) ? v[0] : v) ?? "";
  const page = Number.parseInt(one(params.page), 10);
  const status = one(params.status);
  return {
    q: one(params.q).trim().slice(0, 100),
    status: isContactStatus(status) ? status : null,
    page: Number.isFinite(page) && page > 0 ? page : 1,
  };
}

/** Characters that have meaning inside a PostgREST `or=(...)` filter or an ILIKE pattern. */
function escapeSearch(term: string) {
  return term.replace(/[,()\\%_*"]/g, " ").replace(/\s+/g, " ").trim();
}

export async function getContacts({ q, status, page }: ContactQuery) {
  const supabase = await createClient();
  const from = (page - 1) * PAGE_SIZE;

  let query = supabase
    .from("contacts")
    .select(
      "id, first_name, last_name, email, phone, position, status, source, tags, created_at, company:companies(id, name)",
      { count: "exact" },
    )
    .order("created_at", { ascending: false })
    .range(from, from + PAGE_SIZE - 1);

  if (status) query = query.eq("status", status);

  const term = escapeSearch(q);
  if (term) {
    const pattern = `%${term}%`;
    query = query.or(
      ["first_name", "last_name", "email", "phone"].map((column) => `${column}.ilike.${pattern}`).join(","),
    );
  }

  const { data, count, error } = await query;
  if (error) throw new Error(`Failed to load contacts: ${error.message}`);

  return {
    contacts: (data ?? []) as unknown as ContactListItem[],
    total: count ?? 0,
    pages: Math.max(1, Math.ceil((count ?? 0) / PAGE_SIZE)),
  };
}

export async function getCompanyOptions() {
  const supabase = await createClient();
  const { data, error } = await supabase.from("companies").select("id, name").order("name");
  if (error) throw new Error(`Failed to load companies: ${error.message}`);
  return data ?? [];
}
