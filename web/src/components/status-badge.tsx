import type { Enums } from "@/lib/database.types";

const statusStyle: Record<Enums<"contact_status">, string> = {
  lead: "bg-lead-soft text-lead",
  customer: "bg-brand-soft text-brand",
  inactive: "bg-inactive-soft text-inactive",
};

export function StatusBadge({ status, label }: { status: Enums<"contact_status">; label: string }) {
  return (
    <span className={`inline-block rounded-full px-2.5 py-0.5 text-sm font-medium ${statusStyle[status]}`}>{label}</span>
  );
}
