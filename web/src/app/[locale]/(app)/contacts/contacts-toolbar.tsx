"use client";

import Link from "next/link";
import { useEffect, useRef, useState, useTransition } from "react";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import type { Dictionary } from "@/i18n/get-dictionary";

const STATUSES = ["all", "lead", "customer", "inactive"] as const;

export function ContactsToolbar({ t }: { t: Dictionary["contacts"] }) {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const [term, setTerm] = useState(searchParams.get("q") ?? "");
  const [isPending, startTransition] = useTransition();
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const activeStatus = searchParams.get("status") ?? "all";

  useEffect(() => () => {
    if (timer.current) clearTimeout(timer.current);
  }, []);

  function hrefWith(changes: Record<string, string | null>) {
    const params = new URLSearchParams(searchParams.toString());
    for (const [key, value] of Object.entries(changes)) {
      if (value) params.set(key, value);
      else params.delete(key);
    }
    params.delete("page"); // any filter change starts from page 1
    const qs = params.toString();
    return qs ? `${pathname}?${qs}` : pathname;
  }

  function onSearch(value: string) {
    setTerm(value);
    if (timer.current) clearTimeout(timer.current);
    timer.current = setTimeout(() => {
      startTransition(() => router.replace(hrefWith({ q: value.trim() || null }), { scroll: false }));
    }, 300);
  }

  return (
    <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
      <div className="relative w-full lg:max-w-sm">
        <label htmlFor="contact-search" className="sr-only">
          {t.search}
        </label>
        <input
          id="contact-search"
          type="search"
          value={term}
          onChange={(e) => onSearch(e.target.value)}
          placeholder={t.searchPlaceholder}
          className="w-full rounded-md border border-line bg-surface px-3 py-2.5 text-base text-ink placeholder:text-muted focus:border-brand focus:outline-none focus:ring-2 focus:ring-brand/25"
        />
        {isPending && (
          <span className="absolute end-3 top-1/2 size-4 -translate-y-1/2 animate-spin rounded-full border-2 border-line border-t-brand motion-reduce:animate-none" aria-hidden="true" />
        )}
      </div>

      <nav aria-label={t.filterLabel}>
        <ul className="flex flex-wrap gap-1 rounded-lg bg-surface p-1 ring-1 ring-line">
          {STATUSES.map((status) => {
            const active = status === activeStatus;
            return (
              <li key={status}>
                <Link
                  href={hrefWith({ status: status === "all" ? null : status })}
                  scroll={false}
                  aria-current={active ? "page" : undefined}
                  className={`block rounded-md px-3 py-1.5 text-sm transition-colors ${
                    active ? "bg-brand font-medium text-brand-ink" : "text-muted hover:text-ink"
                  }`}
                >
                  {t.filters[status]}
                </Link>
              </li>
            );
          })}
        </ul>
      </nav>
    </div>
  );
}
