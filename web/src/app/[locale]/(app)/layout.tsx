import { Suspense } from "react";
import { LogOut } from "lucide-react";
import { Wordmark } from "@/components/wordmark";
import { LanguageSwitch } from "@/components/language-switch";
import { getDictionary, getLocale } from "@/i18n/get-dictionary";
import { createClient } from "@/lib/supabase/server";
import { signOut } from "../login/actions";
import { NavLinks } from "./nav-links";

export default async function AppLayout({ children }: LayoutProps<"/[locale]">) {
  const locale = await getLocale();
  const dict = await getDictionary(locale);

  const items = (["dashboard", "contacts", "deals", "tasks", "analytics"] as const).map((segment) => ({
    segment,
    href: `/${locale}/${segment}`,
    label: dict.nav[segment],
  }));

  return (
    <div className="min-h-screen md:grid md:grid-cols-[15rem_minmax(0,1fr)]">
      <aside className="flex flex-col gap-6 bg-rail px-4 py-5 text-rail-ink md:sticky md:top-0 md:h-screen md:py-8">
        <div className="px-3">
          <Wordmark />
        </div>
        <NavLinks items={items} label={dict.nav.label} />

        <div className="mt-auto flex flex-wrap items-center gap-1 border-t border-rail-ink/15 pt-3 md:block md:space-y-1 md:pt-4">
          <Suspense fallback={<div className="hidden h-5 md:block" />}>
            <CurrentUser />
          </Suspense>
          <LanguageSwitch
            locale={locale}
            label={dict.nav.switchLanguage}
            ariaLabel={dict.nav.switchLanguageLabel}
            icon
            className="flex items-center gap-2.5 rounded-md px-3 py-2 text-[15px] text-rail-muted hover:bg-rail-active/60 hover:text-rail-ink"
          />
          <form action={signOut.bind(null, locale)}>
            <button
              type="submit"
              className="flex w-full items-center gap-2.5 rounded-md px-3 py-2 text-start text-[15px] text-rail-muted hover:bg-rail-active/60 hover:text-rail-ink"
            >
              {/* the arrow points out of the page, so it flips in right-to-left */}
              <LogOut aria-hidden="true" className="size-[18px] shrink-0 rtl:-scale-x-100" strokeWidth={1.75} />
              {dict.nav.signOut}
            </button>
          </form>
        </div>
      </aside>

      <main className="min-w-0 px-4 py-6 md:px-10 md:py-10">{children}</main>
    </div>
  );
}

async function CurrentUser() {
  const supabase = await createClient();
  const { data } = await supabase.auth.getClaims();
  const email = data?.claims?.email as string | undefined;
  if (!email) return null;

  return (
    <p className="hidden truncate px-3 pb-2 text-sm text-rail-muted md:block" title={email}>
      <bdi>{email}</bdi>
    </p>
  );
}
