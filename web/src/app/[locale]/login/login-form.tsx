"use client";

import { Suspense, useActionState } from "react";
import { useSearchParams } from "next/navigation";
import type { Dictionary } from "@/i18n/get-dictionary";
import type { Locale } from "@/i18n/config";
import { signIn, type SignInState } from "./actions";

const inputClass =
  "w-full rounded-md border border-line bg-surface px-3 py-2.5 text-base text-ink placeholder:text-muted focus:border-brand focus:outline-none focus:ring-2 focus:ring-brand/25";

export function LoginForm({ t, locale }: { t: Dictionary["auth"]; locale: Locale }) {
  const [state, action, pending] = useActionState<SignInState, FormData>(signIn, { error: null });

  return (
    <form action={action} className="space-y-5">
      <input type="hidden" name="locale" value={locale} />
      {/* The form itself is static HTML; only the redirect target depends on the URL. */}
      <Suspense fallback={<input type="hidden" name="next" value="" />}>
        <NextField />
      </Suspense>

      <div className="space-y-1.5">
        <label htmlFor="email" className="block text-sm font-medium">
          {t.email}
        </label>
        <input id="email" name="email" type="email" autoComplete="email" dir="ltr" className={inputClass} />
      </div>

      <div className="space-y-1.5">
        <label htmlFor="password" className="block text-sm font-medium">
          {t.password}
        </label>
        <input id="password" name="password" type="password" autoComplete="current-password" dir="ltr" className={inputClass} />
      </div>

      {state.error && (
        <p role="alert" className="rounded-md bg-danger-soft px-3 py-2 text-sm text-danger">
          {t[state.error]}
        </p>
      )}

      <button
        type="submit"
        name="intent"
        value="password"
        disabled={pending}
        className="w-full rounded-md bg-brand px-4 py-2.5 font-medium text-brand-ink transition-colors hover:bg-brand-hover disabled:opacity-60"
      >
        {pending ? t.submitting : t.submit}
      </button>

      <div className="flex items-center gap-3 text-sm text-muted" aria-hidden="true">
        <span className="h-px flex-1 bg-line" />
        {t.or}
        <span className="h-px flex-1 bg-line" />
      </div>

      <div className="space-y-2">
        <button
          type="submit"
          name="intent"
          value="demo"
          formNoValidate
          disabled={pending}
          className="w-full rounded-md border border-brand px-4 py-2.5 font-medium text-brand transition-colors hover:bg-brand-soft disabled:opacity-60"
        >
          {t.demo}
        </button>
        <p className="text-sm text-muted">{t.demoHint}</p>
      </div>
    </form>
  );
}

function NextField() {
  return <input type="hidden" name="next" value={useSearchParams().get("next") ?? ""} />;
}
