"use client";

import { useState, type ReactNode } from "react";
import type { Dictionary } from "@/i18n/get-dictionary";
import { format } from "@/i18n/config";
import type { ContactListItem, ContactStatus } from "@/lib/data/contacts";
import { ContactDialog } from "./contact-dialog";

export type ContactRow = ContactListItem & { added: string };
export type CompanyOption = { id: string; name: string };

const statusStyle: Record<ContactStatus, string> = {
  lead: "bg-lead-soft text-lead",
  customer: "bg-brand-soft text-brand",
  inactive: "bg-inactive-soft text-inactive",
};

export function fullName(c: { first_name: string; last_name: string | null }) {
  return [c.first_name, c.last_name].filter(Boolean).join(" ");
}

export function ContactsManager({
  countLabel,
  toolbar,
  rows,
  companies,
  t,
  emptyMessage,
}: {
  countLabel: string;
  toolbar: ReactNode;
  rows: ContactRow[];
  companies: CompanyOption[];
  t: Dictionary["contacts"];
  emptyMessage: string | null;
}) {
  // null = closed, "new" = create form, otherwise the contact being edited
  const [open, setOpen] = useState<"new" | ContactRow | null>(null);

  return (
    <>
      <div className="mt-1 flex items-center justify-between gap-4">
        <p className="text-muted">{countLabel}</p>
        <button
          type="button"
          onClick={() => setOpen("new")}
          className="rounded-md bg-brand px-4 py-2.5 font-medium text-brand-ink transition-colors hover:bg-brand-hover"
        >
          {t.new}
        </button>
      </div>

      <div className="mt-6 mb-5">{toolbar}</div>

      {rows.length === 0 ? (
        <EmptyState t={t} message={emptyMessage} onCreate={() => setOpen("new")} />
      ) : (
        <div className="overflow-hidden rounded-lg border border-line bg-surface">
          <table className="w-full text-start text-[15px]">
            <thead className="border-b border-line text-sm text-muted">
              <tr>
                <th scope="col" className="px-4 py-3 text-start font-medium">{t.columns.name}</th>
                <th scope="col" className="hidden px-4 py-3 text-start font-medium sm:table-cell">{t.columns.company}</th>
                <th scope="col" className="hidden px-4 py-3 text-start font-medium lg:table-cell">{t.columns.email}</th>
                <th scope="col" className="hidden px-4 py-3 text-start font-medium md:table-cell">{t.columns.phone}</th>
                <th scope="col" className="px-4 py-3 text-start font-medium">{t.columns.status}</th>
                <th scope="col" className="hidden px-4 py-3 text-start font-medium xl:table-cell">{t.columns.added}</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-line">
              {rows.map((c) => (
                <tr key={c.id} className="hover:bg-paper/60">
                  <td className="px-4 py-3">
                    <button
                      type="button"
                      onClick={() => setOpen(c)}
                      aria-label={format(t.edit, { name: fullName(c) })}
                      className="text-start font-medium hover:text-brand hover:underline"
                    >
                      <bdi>{fullName(c)}</bdi>
                    </button>
                    {c.position && <div className="text-sm text-muted"><bdi>{c.position}</bdi></div>}
                  </td>
                  <td className="hidden px-4 py-3 sm:table-cell"><bdi>{c.company?.name ?? "—"}</bdi></td>
                  <td className="hidden px-4 py-3 lg:table-cell">
                    {c.email ? <a href={`mailto:${c.email}`} className="text-muted hover:text-brand"><bdi>{c.email}</bdi></a> : "—"}
                  </td>
                  <td className="hidden px-4 py-3 md:table-cell">
                    {c.phone ? <a href={`tel:${c.phone}`} className="whitespace-nowrap text-muted hover:text-brand"><bdi>{c.phone}</bdi></a> : "—"}
                  </td>
                  <td className="px-4 py-3">
                    <span className={`inline-block rounded-full px-2.5 py-0.5 text-sm font-medium ${statusStyle[c.status]}`}>
                      {t.status[c.status]}
                    </span>
                  </td>
                  <td className="hidden whitespace-nowrap px-4 py-3 text-muted xl:table-cell">{c.added}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {open && (
        <ContactDialog
          key={open === "new" ? "new" : open.id}
          contact={open === "new" ? null : open}
          companies={companies}
          t={t}
          onClose={() => setOpen(null)}
        />
      )}
    </>
  );
}

function EmptyState({ t, message, onCreate }: { t: Dictionary["contacts"]; message: string | null; onCreate: () => void }) {
  if (message) {
    return <p className="rounded-lg border border-line bg-surface px-6 py-10 text-center text-muted">{message}</p>;
  }
  return (
    <div className="rounded-lg border border-dashed border-line px-6 py-14 text-center">
      <p className="text-lg font-medium">{t.emptyTitle}</p>
      <p className="mt-1 text-muted">{t.emptyBody}</p>
      <button type="button" onClick={onCreate} className="mt-5 rounded-md bg-brand px-4 py-2.5 font-medium text-brand-ink hover:bg-brand-hover">
        {t.new}
      </button>
    </div>
  );
}
