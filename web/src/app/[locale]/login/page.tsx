import type { Metadata } from "next";
import { Wordmark } from "@/components/wordmark";
import { LanguageSwitch } from "@/components/language-switch";
import { getDictionary, getLocale } from "@/i18n/get-dictionary";
import { LoginForm } from "./login-form";

export async function generateMetadata(): Promise<Metadata> {
  const dict = await getDictionary();
  return { title: dict.auth.title };
}

export default async function LoginPage() {
  const locale = await getLocale();
  const dict = await getDictionary(locale);

  return (
    <div className="grid min-h-screen md:grid-cols-[minmax(0,5fr)_minmax(0,6fr)]">
      <section className="flex flex-col justify-between bg-rail p-8 text-rail-ink md:p-12">
        <Wordmark />
        <p className="mt-10 max-w-sm text-2xl font-medium leading-snug md:text-3xl">{dict.auth.subtitle}</p>
      </section>

      <main className="flex flex-col p-6 md:p-12">
        <div className="flex justify-end">
          <LanguageSwitch
            locale={locale}
            label={dict.nav.switchLanguage}
            ariaLabel={dict.nav.switchLanguageLabel}
            className="rounded-md px-3 py-1.5 text-sm font-medium text-muted hover:bg-surface hover:text-ink"
          />
        </div>
        <div className="mx-auto my-auto w-full max-w-sm py-10">
          <h1 className="mb-8 text-3xl font-semibold">{dict.auth.title}</h1>
          <LoginForm t={dict.auth} locale={locale} />
        </div>
      </main>
    </div>
  );
}
