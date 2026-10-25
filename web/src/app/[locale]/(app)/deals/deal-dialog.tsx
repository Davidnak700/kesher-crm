"use client";

import { useActionState, useEffect, useRef, useState, useTransition } from "react";
import { format } from "@/i18n/config";
import type { Dictionary } from "@/i18n/get-dictionary";
import type { BoardDeal, ContactOption } from "@/lib/data/deals";
import { createDeal, deleteDeal, updateDeal, type DealFormError, type DealFormState } from "./actions";

const field =
  "w-full rounded-md border border-line bg-surface px-3 py-2 text-base text-ink placeholder:text-muted focus:border-brand focus:outline-none focus:ring-2 focus:ring-brand/25 aria-invalid:border-danger";
const label = "mb-1.5 block text-sm font-medium";

export function DealDialog({
  deal,
  defaultStageId,
  stages,
  contacts,
  t,
  onClose,
}: {
  deal: BoardDeal | null;
  defaultStageId: string;
  stages: { id: string; label: string }[];
  contacts: ContactOption[];
  t: Dictionary["deals"];
  onClose: () => void;
}) {
  const dialogRef = useRef<HTMLDialogElement>(null);
  const f = t.form;
  const action = deal ? updateDeal.bind(null, deal.id) : createDeal;
  const [state, formAction, saving] = useActionState<DealFormState, FormData>(action, { ok: false, errors: [] });
  const [confirmingDelete, setConfirmingDelete] = useState(false);
  const [deleteFailed, setDeleteFailed] = useState(false);
  const [deleting, startDelete] = useTransition();

  useEffect(() => {
    dialogRef.current?.showModal();
  }, []);

  useEffect(() => {
    if (state.savedAt) dialogRef.current?.close();
  }, [state.savedAt]);

  const error = (code: Exclude<DealFormError, "generic">) =>
    state.errors.includes(code) ? (
      <p id={`deal-${code}-error`} className="mt-1 text-sm text-danger">
        {f.errors[code]}
      </p>
    ) : null;
  const invalid = (code: DealFormError) =>
    state.errors.includes(code)
      ? { "aria-invalid": true as const, "aria-describedby": `deal-${code}-error` }
      : {};

  function onDelete() {
    if (!deal) return;
    startDelete(async () => {
      const result = await deleteDeal(deal.id);
      if (result.ok) dialogRef.current?.close();
      else setDeleteFailed(true);
    });
  }

  return (
    <dialog
      ref={dialogRef}
      onClose={onClose}
      aria-labelledby="deal-dialog-title"
      className="m-auto w-[calc(100%-2rem)] max-w-lg rounded-xl bg-surface p-0 text-ink shadow-2xl"
    >
      <form action={formAction} noValidate>
        <div className="flex items-center justify-between border-b border-line px-6 py-4">
          <h2 id="deal-dialog-title" className="text-xl font-semibold">
            {deal ? f.editTitle : f.createTitle}
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
          <div className="sm:col-span-2">
            <label htmlFor="deal-title" className={label}>{f.title}</label>
            <input
              id="deal-title"
              name="title"
              defaultValue={deal?.title}
              placeholder={f.titlePlaceholder}
              required
              autoFocus
              className={field}
              {...invalid("title")}
            />
            {error("title")}
          </div>

          <div>
            <label htmlFor="deal-amount" className={label}>{f.amount}</label>
            <input
              id="deal-amount"
              name="amount"
              inputMode="decimal"
              dir="ltr"
              defaultValue={deal ? String(deal.amount) : ""}
              placeholder="0"
              className={`${field} text-start tabular-nums`}
              {...invalid("amount")}
            />
            {error("amount")}
          </div>

          <div>
            <label htmlFor="deal-stage" className={label}>{f.stage}</label>
            <select id="deal-stage" name="stage_id" defaultValue={defaultStageId} className={field} {...invalid("stage")}>
              {stages.map((s) => (
                <option key={s.id} value={s.id}>{s.label}</option>
              ))}
            </select>
            {error("stage")}
          </div>

          <div className="sm:col-span-2">
            <label htmlFor="deal-contact" className={label}>{f.contact}</label>
            <select
              id="deal-contact"
              name="contact_id"
              defaultValue={deal?.contact?.id ?? ""}
              aria-describedby="deal-contact-hint"
              className={field}
            >
              <option value="">{f.noContact}</option>
              {contacts.map((c) => (
                <option key={c.id} value={c.id}>{c.name}</option>
              ))}
            </select>
            <p id="deal-contact-hint" className="mt-1 text-sm text-muted">{f.contactHint}</p>
          </div>

          <div>
            <label htmlFor="deal-close" className={label}>{f.expectedClose}</label>
            <input
              id="deal-close"
              name="expected_close_date"
              type="date"
              defaultValue={deal?.expected_close_date ?? ""}
              className={field}
            />
          </div>

          {state.errors.includes("generic") && (
            <p role="alert" className="rounded-md bg-danger-soft px-3 py-2 text-sm text-danger sm:col-span-2">
              {f.errors.generic}
            </p>
          )}
        </div>

        <div className="flex flex-wrap items-center gap-3 border-t border-line px-6 py-4">
          {deal && !confirmingDelete && (
            <button
              type="button"
              onClick={() => setConfirmingDelete(true)}
              className="rounded-md px-3 py-2 text-danger hover:bg-danger-soft"
            >
              {f.delete}
            </button>
          )}
          <div className="ms-auto flex gap-2">
            <button
              type="button"
              onClick={() => dialogRef.current?.close()}
              className="rounded-md px-4 py-2 text-muted hover:bg-paper hover:text-ink"
            >
              {f.cancel}
            </button>
            <button
              type="submit"
              disabled={saving || deleting}
              className="rounded-md bg-brand px-4 py-2 font-medium text-brand-ink hover:bg-brand-hover disabled:opacity-60"
            >
              {saving ? f.saving : deal ? f.save : f.create}
            </button>
          </div>
        </div>
      </form>

      {deal && confirmingDelete && (
        <div role="alertdialog" aria-labelledby="deal-delete-confirm" className="border-t border-line bg-danger-soft px-6 py-4">
          <p id="deal-delete-confirm" className="text-sm">{format(f.confirmDelete, { title: deal.title })}</p>
          {deleteFailed && <p role="alert" className="mt-2 text-sm text-danger">{f.errors.generic}</p>}
          <div className="mt-3 flex gap-2">
            <button
              type="button"
              onClick={onDelete}
              disabled={deleting}
              className="rounded-md bg-danger px-4 py-2 font-medium text-danger-ink disabled:opacity-60"
            >
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
