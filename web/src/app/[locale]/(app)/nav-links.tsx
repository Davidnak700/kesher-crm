"use client";

import Link from "next/link";
import { useSelectedLayoutSegment } from "next/navigation";

export type NavItem = { segment: string; href: string; label: string };

export function NavLinks({ items, label }: { items: NavItem[]; label: string }) {
  const active = useSelectedLayoutSegment();

  return (
    <nav aria-label={label}>
      <ul className="flex gap-1 overflow-x-auto md:flex-col">
        {items.map((item) => {
          const current = item.segment === active;
          return (
            <li key={item.segment}>
              <Link
                href={item.href}
                aria-current={current ? "page" : undefined}
                className={`block whitespace-nowrap rounded-md px-3 py-2 text-[15px] transition-colors ${
                  current
                    ? "bg-rail-active font-medium text-rail-ink"
                    : "text-rail-muted hover:bg-rail-active/60 hover:text-rail-ink"
                }`}
              >
                {item.label}
              </Link>
            </li>
          );
        })}
      </ul>
    </nav>
  );
}
