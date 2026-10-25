import { Suspense } from "react";
import type { Metadata } from "next";
import { getDictionary } from "@/i18n/get-dictionary";
import { DashboardView } from "./dashboard-view";

export async function generateMetadata(): Promise<Metadata> {
  return { title: (await getDictionary()).dashboard.title };
}

export default async function DashboardPage() {
  const dict = await getDictionary();

  return (
    <div className="mx-auto max-w-6xl">
      <h1 className="text-3xl font-semibold">{dict.dashboard.title}</h1>
      <Suspense
        fallback={
          <div role="status" aria-label={dict.dashboard.loading} className="mt-6 animate-pulse space-y-6 motion-reduce:animate-none">
            <div className="h-36 rounded-xl bg-line/50" />
            <div className="grid gap-6 lg:grid-cols-3">
              <div className="h-80 rounded-xl bg-line/50 lg:col-span-2" />
              <div className="h-80 rounded-xl bg-line/50" />
            </div>
          </div>
        }
      >
        <DashboardView />
      </Suspense>
    </div>
  );
}
