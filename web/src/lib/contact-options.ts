import type { Enums } from "@/lib/database.types";

// Shared by server and client code, so it must not import anything server-only.
export const CONTACT_STATUSES = ["lead", "customer", "inactive"] as const satisfies readonly Enums<"contact_status">[];
export const CONTACT_SOURCES = ["website", "referral", "social", "ads", "event", "cold", "other"] as const satisfies readonly Enums<"contact_source">[];
