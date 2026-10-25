import { Suspense } from "react";
import type { Metadata } from "next";
import { getDictionary } from "@/i18n/get-dictionary";
import { TasksView } from "./tasks-view";

export async function generateMetadata(): Promise<Metadata> {
  return { title: (await getDictionary()).tasks.title };
}

export default async function TasksPage({ searchParams }: PageProps<"/[locale]/tasks">) {
  const dict = await getDictionary();

  return (
    <div className="mx-auto max-w-3xl">
      <h1 className="text-3xl font-semibold">{dict.tasks.title}</h1>
      <Suspense
        fallback={
          <div role="status" aria-label={dict.tasks.loading} className="mt-6 animate-pulse space-y-3 motion-reduce:animate-none">
            <div className="h-5 w-40 rounded bg-line" />
            <div className="h-80 rounded-xl bg-line/50" />
          </div>
        }
      >
        <TasksView searchParams={searchParams} />
      </Suspense>
    </div>
  );
}
