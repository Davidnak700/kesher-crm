"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import type { Dictionary } from "@/i18n/get-dictionary";
import { ContactDialog, type EditableContact } from "../contact-dialog";
import type { CompanyOption } from "../contacts-manager";

export function ContactActions({
  contact,
  companies,
  t,
  editLabel,
  listHref,
}: {
  contact: EditableContact;
  companies: CompanyOption[];
  t: Dictionary["contacts"];
  editLabel: string;
  listHref: string;
}) {
  const [editing, setEditing] = useState(false);
  const router = useRouter();

  return (
    <>
      <button
        type="button"
        onClick={() => setEditing(true)}
        className="rounded-md border border-line bg-surface px-4 py-2 font-medium hover:border-brand hover:text-brand"
      >
        {editLabel}
      </button>
      {editing && (
        <ContactDialog
          contact={contact}
          companies={companies}
          t={t}
          onClose={() => setEditing(false)}
          onDeleted={() => router.replace(listHref)}
        />
      )}
    </>
  );
}
