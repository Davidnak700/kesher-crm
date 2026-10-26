"use client";

import Link from "next/link";
import { Suspense } from "react";
import { useSelectedLayoutSegment } from "next/navigation";
import { ChartColumn, LayoutDashboard, ListChecks, SquareKanban, Users, type LucideIcon } from "lucide-react";

export type NavItem = { segment: string; href: string; label: string };

// Icons live here (not in the server layout): components can't be passed from server to client.
const icons: Record<string, LucideIcon> = {
  dashboard: LayoutDashboard,
  contacts: Users,
  deals: SquareKanban,
  tasks: ListChecks,
  analytics: ChartColumn,
};

export function NavLinks({ items, label }: { items: NavItem[]; label: string }) {
  // Which link is current depends on the URL, so it streams in; the links themselves are static.
  return (
    <Suspense fallback={<NavList items={items} label={label} active={null} />}>
      <ActiveNavList items={items} label={label} />
    </Suspense>
  );
}

function ActiveNavList({ items, label }: { items: NavItem[]; label: string }) {
  return <NavList items={items} label={label} active={useSelectedLayoutSegment()} />;
}

function NavList({ items, label, active }: { items: NavItem[]; label: string; active: string | null }) {
  return (
    <nav aria-label={label}>
      <ul className="flex gap-1 overflow-x-auto md:flex-col">
        {items.map((item) => {
          const current = item.segment === active;
          const Icon = icons[item.segment];
          return (
            <li key={item.segment}>
              <Link
                href={item.href}
                aria-current={current ? "page" : undefined}
                className={`flex items-center gap-2.5 whitespace-nowrap rounded-md px-3 py-2 text-[15px] transition-colors ${
                  current
                    ? "bg-rail-active font-medium text-rail-ink"
                    : "text-rail-muted hover:bg-rail-active/60 hover:text-rail-ink"
                }`}
              >
                {Icon && <Icon aria-hidden="true" className="size-[18px] shrink-0" strokeWidth={1.75} />}
                {item.label}
              </Link>
            </li>
          );
        })}
      </ul>
    </nav>
  );
}
