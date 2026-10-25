"use client";

import { useActionState, useEffect, useRef, useState, useTransition } from "react";
import type { Dictionary } from "@/i18n/get-dictionary";
import { addActivity, deleteActivity, type ActivityFormState } from "./actions";

const TYPES = ["note", "call", "email", "meeting"] as const;

export function ActivityComposer({ contactId, t }: { contactId: string; t: Dictionary["contact"]["timeline"] }) {
  const [state, action, saving] = useActionState<ActivityFormState, FormData>(addActivity.bind(null, contactId), {
    ok: false,
    error: null,
  });
  const formRef = useRef<HTMLFormElement>(null);

  // Clear the text after a successful save; keep the chosen type for the next entry.
  useEffect(() => {
    if (state.savedAt) {
      const body = formRef.current?.elements.namedItem("body");
      if (body instanceof HTMLTextAreaElement) body.value = "";
    }
  }, [state.savedAt]);

  return (
    <form ref={formRef} action={action} aria-label={t.composerLabel} className="rounded-xl border border-line bg-surface p-4">
      <fieldset>
        <legend className="sr-only">{t.typeLabel}</legend>
        <div className="flex flex-wrap gap-1">
          {TYPES.map((type, i) => (
            <label key={type} className="cursor-pointer">
              <input type="radio" name="type" value={type} defaultChecked={i === 0} className="peer sr-only" />
              <span className="block rounded-md px-3 py-1.5 text-sm text-muted peer-checked:bg-brand-soft peer-checked:font-medium peer-checked:text-brand peer-focus-visible:outline-2 peer-focus-visible:outline-offset-2 peer-focus-visible:outline-[var(--focus)] hover:text-ink">
                {t.types[type]}
              </span>
            </label>
          ))}
        </div>
      </fieldset>

      <label htmlFor="activity-body" className="sr-only">{t.placeholder}</label>
      <textarea
        id="activity-body"
        name="body"
        rows={3}
        placeholder={t.placeholder}
        aria-invalid={state.error === "body" || undefined}
        aria-describedby={state.error ? "activity-error" : undefined}
        className="mt-3 w-full resize-y rounded-md border border-line bg-surface px-3 py-2 text-base text-ink placeholder:text-muted focus:border-brand focus:outline-none focus:ring-2 focus:ring-brand/25 aria-invalid:border-danger"
      />

      <div className="mt-3 flex items-center justify-between gap-3">
        <p id="activity-error" role={state.error ? "alert" : undefined} className="text-sm text-danger">
          {state.error ? t.errors[state.error] : null}
        </p>
        <button
          type="submit"
          disabled={saving}
          className="shrink-0 rounded-md bg-brand px-4 py-2 font-medium text-brand-ink hover:bg-brand-hover disabled:opacity-60"
        >
          {saving ? t.saving : t.log}
        </button>
      </div>
    </form>
  );
}

export function DeleteActivityButton({ id, label, failedLabel }: { id: string; label: string; failedLabel: string }) {
  const [pending, start] = useTransition();
  const [failed, setFailed] = useState(false);

  return (
    <>
      {failed && <span role="alert" className="text-xs text-danger">{failedLabel}</span>}
      <button
        type="button"
        disabled={pending}
        aria-label={label}
        title={label}
        onClick={() =>
          start(async () => {
            const result = await deleteActivity(id);
            setFailed(!result.ok);
          })
        }
        className="-me-1 -mt-0.5 shrink-0 rounded p-1 text-muted hover:bg-paper hover:text-danger disabled:opacity-50"
      >
        <svg viewBox="0 0 20 20" className="size-4" aria-hidden="true">
          <path d="M6 6l8 8M14 6l-8 8" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" />
        </svg>
      </button>
    </>
  );
}
