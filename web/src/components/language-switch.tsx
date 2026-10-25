"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import type { Locale } from "@/i18n/config";

/** Links to the same page in the other language. */
export function LanguageSwitch({
  locale,
  label,
  ariaLabel,
  className = "",
}: {
  locale: Locale;
  label: string;
  ariaLabel: string;
  className?: string;
}) {
  const pathname = usePathname();
  const target: Locale = locale === "he" ? "en" : "he";
  const href = pathname.replace(/^\/(he|en)(?=\/|$)/, `/${target}`);

  return (
    <Link href={href} hrefLang={target} lang={target} aria-label={ariaLabel} className={className}>
      {label}
    </Link>
  );
}
