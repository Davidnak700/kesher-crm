import { Suspense } from "react";
import type { Metadata } from "next";
import { getDictionary } from "@/i18n/get-dictionary";
import { AnalyticsView } from "./analytics-view";

export async function generateMetadata(): Promise<Metadata> {
  return { title: (await getDictionary()).analytics.title };
}

export default async function AnalyticsPage() {
  const dict = await getDictionary();

  return (
    <div className="mx-auto max-w-6xl">
      <h1 className="text-3xl font-semibold">{dict.analytics.title}</h1>
      <p className="mt-1 text-muted">{dict.analytics.subtitle}</p>
      <Suspense
        fallback={
          <div role="status" aria-label={dict.analytics.loading} className="mt-6 animate-pulse space-y-6 motion-reduce:animate-none">
            <div className="h-96 rounded-xl bg-line/50" />
            <div className="h-96 rounded-xl bg-line/50" />
          </div>
        }
      >
        <AnalyticsView />
      </Suspense>
    </div>
  );
}
