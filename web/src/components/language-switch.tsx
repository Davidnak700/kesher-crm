"use client";

import Link from "next/link";
import { Suspense } from "react";
import { usePathname } from "next/navigation";
import { Languages } from "lucide-react";
import type { Locale } from "@/i18n/config";

type Props = { locale: Locale; label: string; ariaLabel: string; className?: string; icon?: boolean };

/** Links to the same page in the other language. */
export function LanguageSwitch(props: Props) {
  const target: Locale = props.locale === "he" ? "en" : "he";
  // The current path is URL data, so it streams in; until then the link goes to the other language's home.
  return (
    <Suspense fallback={<SwitchLink {...props} target={target} href={`/${target}`} />}>
      <CurrentPageSwitch {...props} target={target} />
    </Suspense>
  );
}

function CurrentPageSwitch(props: Props & { target: Locale }) {
  const href = usePathname().replace(/^\/(he|en)(?=\/|$)/, `/${props.target}`);
  return <SwitchLink {...props} href={href} />;
}

function SwitchLink({ target, href, label, ariaLabel, className = "", icon }: Props & { target: Locale; href: string }) {
  return (
    <Link href={href} hrefLang={target} lang={target} aria-label={ariaLabel} className={className}>
      {icon && <Languages aria-hidden="true" className="size-[18px] shrink-0" strokeWidth={1.75} />}
      {label}
    </Link>
  );
}
