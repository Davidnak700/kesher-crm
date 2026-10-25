"use client";

import { useActionState, useEffect, useRef, useState, useTransition } from "react";
import type { Dictionary } from "@/i18n/get-dictionary";
import { format } from "@/i18n/config";
import { CONTACT_SOURCES, CONTACT_STATUSES } from "@/lib/contact-options";
import { createContact, deleteContact, updateContact, type ContactFormState } from "./actions";
import type { ContactListItem } from "@/lib/data/contacts";
import { fullName } from "@/lib/names";
import type { CompanyOption } from "./contacts-manager";

export type EditableContact = Omit<ContactListItem, "created_at">;

const field =
  "w-full rounded-md border border-line bg-surface px-3 py-2 text-base text-ink placeholder:text-muted focus:border-brand focus:outline-none focus:ring-2 focus:ring-brand/25 aria-invalid:border-danger";
const label = "mb-1.5 block text-sm font-medium";

export function ContactDialog({
  contact,
  companies,
  t,
  onClose,
  onDeleted,
}: {
  contact: EditableContact | null;
  companies: CompanyOption[];
  t: Dictionary["contacts"];
  onClose: () => void;
  /** Called after a successful delete, e.g. to leave the contact's own page. */
  onDeleted?: () => void;
}) {
  const dialogRef = useRef<HTMLDialogElement>(null);
  const f = t.form;
  const action = contact ? updateContact.bind(null, contact.id) : createContact;
  const [state, formAction, saving] = useActionState<ContactFormState, FormData>(action, { ok: false, errors: [] });
  const [confirmingDelete, setConfirmingDelete] = useState(false);
  const [deleteFailed, setDeleteFailed] = useState(false);
  const [deleting, startDelete] = useTransition();

  useEffect(() => {
    dialogRef.current?.showModal();
  }, []);

  useEffect(() => {
    if (state.savedAt) dialogRef.current?.close();
  }, [state.savedAt]);

  const hasError = (code: "firstName" | "email") => state.errors.includes(code);

  function onDelete() {
    if (!contact) return;
    startDelete(async () => {
      const result = await deleteContact(contact.id);
      if (result.ok) {
        dialogRef.current?.close();
        onDeleted?.();
      }
      else setDeleteFailed(true);
    });
  }

  return (
    <dialog
      ref={dialogRef}
      onClose={onClose}
      aria-labelledby="contact-dialog-title"
      className="m-auto w-[calc(100%-2rem)] max-w-xl rounded-xl bg-surface p-0 text-ink shadow-2xl"
    >
      <form action={formAction} noValidate>
        <div className="flex items-center justify-between border-b border-line px-6 py-4">
          <h2 id="contact-dialog-title" className="text-xl font-semibold">
            {contact ? f.editTitle : f.createTitle}
          </h2>
          <button
            type="button"
            onClick={() => dialogRef.current?.close()}
            aria-label={f.close}
            className="rounded-md p-1.5 text-muted hover:bg-paper hover:text-ink"
          >
            <svg viewBox="0 0 20 20" className="size-5" aria-hidden="true">
              <path d="M5 5l10 10M15 5L5 15" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" />
            </svg>
          </button>
        </div>

        <div className="grid max-h-[70vh] gap-4 overflow-y-auto px-6 py-5 sm:grid-cols-2">
          <div>
            <label htmlFor="first_name" className={label}>{f.firstName}</label>
            <input
              id="first_name"
              name="first_name"
              defaultValue={contact?.first_name}
              required
              autoFocus
              aria-invalid={hasError("firstName") || undefined}
              aria-describedby={hasError("firstName") ? "first_name-error" : undefined}
              className={field}
            />
            {hasError("firstName") && <p id="first_name-error" className="mt-1 text-sm text-danger">{f.errors.firstName}</p>}
          </div>
          <div>
            <label htmlFor="last_name" className={label}>{f.lastName}</label>
            <input id="last_name" name="last_name" defaultValue={contact?.last_name ?? ""} className={field} />
          </div>

          <div>
            <label htmlFor="email" className={label}>{f.email}</label>
            <input
              id="email"
              name="email"
              type="email"
              dir="ltr"
              defaultValue={contact?.email ?? ""}
              aria-invalid={hasError("email") || undefined}
              aria-describedby={hasError("email") ? "email-error" : undefined}
              className={`${field} text-start`}
            />
            {hasError("email") && <p id="email-error" className="mt-1 text-sm text-danger">{f.errors.email}</p>}
          </div>
          <div>
            <label htmlFor="phone" className={label}>{f.phone}</label>
            <input id="phone" name="phone" type="tel" dir="ltr" defaultValue={contact?.phone ?? ""} className={`${field} text-start`} />
          </div>

          <div>
            <label htmlFor="company_id" className={label}>{f.company}</label>
            <select id="company_id" name="company_id" defaultValue={contact?.company?.id ?? ""} className={field}>
              <option value="">{f.noCompany}</option>
              {companies.map((c) => (
                <option key={c.id} value={c.id}>{c.name}</option>
              ))}
            </select>
          </div>
          <div>
            <label htmlFor="position" className={label}>{f.position}</label>
            <input id="position" name="position" defaultValue={contact?.position ?? ""} className={field} />
          </div>

          <div>
            <label htmlFor="status" className={label}>{f.status}</label>
            <select id="status" name="status" defaultValue={contact?.status ?? "lead"} className={field}>
              {CONTACT_STATUSES.map((s) => (
                <option key={s} value={s}>{t.status[s]}</option>
              ))}
            </select>
          </div>
          <div>
            <label htmlFor="source" className={label}>{f.source}</label>
            <select id="source" name="source" defaultValue={contact?.source ?? ""} className={field}>
              <option value="">{f.noSource}</option>
              {CONTACT_SOURCES.map((s) => (
                <option key={s} value={s}>{t.source[s]}</option>
              ))}
            </select>
          </div>

          <div className="sm:col-span-2">
            <label htmlFor="tags" className={label}>{f.tags}</label>
            <input id="tags" name="tags" defaultValue={contact?.tags.join(", ") ?? ""} aria-describedby="tags-hint" className={field} />
            <p id="tags-hint" className="mt-1 text-sm text-muted">{f.tagsHint}</p>
          </div>

          {state.errors.includes("generic") && (
            <p role="alert" className="rounded-md bg-danger-soft px-3 py-2 text-sm text-danger sm:col-span-2">{f.errors.generic}</p>
          )}
        </div>

        <div className="flex flex-wrap items-center gap-3 border-t border-line px-6 py-4">
          {contact && !confirmingDelete && (
            <button type="button" onClick={() => setConfirmingDelete(true)} className="rounded-md px-3 py-2 text-danger hover:bg-danger-soft">
              {f.delete}
            </button>
          )}
          <div className="ms-auto flex gap-2">
            <button type="button" onClick={() => dialogRef.current?.close()} className="rounded-md px-4 py-2 text-muted hover:bg-paper hover:text-ink">
              {f.cancel}
            </button>
            <button type="submit" disabled={saving || deleting} className="rounded-md bg-brand px-4 py-2 font-medium text-brand-ink hover:bg-brand-hover disabled:opacity-60">
              {saving ? f.saving : contact ? f.save : f.create}
            </button>
          </div>
        </div>
      </form>

      {contact && confirmingDelete && (
        <div role="alertdialog" aria-labelledby="delete-confirm" className="border-t border-line bg-danger-soft px-6 py-4">
          <p id="delete-confirm" className="text-sm">{format(f.confirmDelete, { name: fullName(contact) })}</p>
          {deleteFailed && <p role="alert" className="mt-2 text-sm text-danger">{f.errors.generic}</p>}
          <div className="mt-3 flex gap-2">
            <button type="button" onClick={onDelete} disabled={deleting} className="rounded-md bg-danger px-4 py-2 font-medium text-danger-ink disabled:opacity-60">
              {f.delete}
            </button>
            <button type="button" onClick={() => setConfirmingDelete(false)} className="rounded-md px-4 py-2 hover:bg-surface">
              {f.cancel}
            </button>
          </div>
        </div>
      )}
    </dialog>
  );
}
