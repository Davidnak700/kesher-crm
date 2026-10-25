"use server";

import { redirect } from "next/navigation";
import { isLocale, defaultLocale } from "@/i18n/config";
import { createClient } from "@/lib/supabase/server";

export type SignInState = { error: "invalid" | "demoUnavailable" | null };

/** Only allow redirects back into this app, in the current language. */
function safeNext(next: FormDataEntryValue | null, locale: string) {
  const value = typeof next === "string" ? next : "";
  return value.startsWith(`/${locale}/`) && !value.startsWith("//") ? value : `/${locale}/contacts`;
}

export async function signIn(_prev: SignInState, formData: FormData): Promise<SignInState> {
  const rawLocale = String(formData.get("locale"));
  const locale = isLocale(rawLocale) ? rawLocale : defaultLocale;
  const isDemo = formData.get("intent") === "demo";

  const email = isDemo ? process.env.DEMO_EMAIL : String(formData.get("email") ?? "");
  const password = isDemo ? process.env.DEMO_PASSWORD : String(formData.get("password") ?? "");

  if (isDemo && (!email || !password)) return { error: "demoUnavailable" };

  const supabase = await createClient();
  const { error } = await supabase.auth.signInWithPassword({ email: email!, password: password! });
  if (error) return { error: isDemo ? "demoUnavailable" : "invalid" };

  redirect(safeNext(formData.get("next"), locale));
}

export async function signOut(locale: string) {
  const supabase = await createClient();
  await supabase.auth.signOut();
  redirect(`/${isLocale(locale) ? locale : defaultLocale}/login`);
}
