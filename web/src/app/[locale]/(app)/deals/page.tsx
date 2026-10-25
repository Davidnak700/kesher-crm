import { Suspense } from "react";
import type { Metadata } from "next";
import { getDictionary } from "@/i18n/get-dictionary";
import { BoardView } from "./board-view";

export async function generateMetadata(): Promise<Metadata> {
  return { title: (await getDictionary()).deals.title };
}

export default async function DealsPage() {
  const dict = await getDictionary();

  return (
    <div>
      <h1 className="text-3xl font-semibold">{dict.deals.title}</h1>
      <Suspense fallback={<BoardSkeleton label={dict.deals.loading} />}>
        <BoardView />
      </Suspense>
    </div>
  );
}

function BoardSkeleton({ label }: { label: string }) {
  return (
    <div role="status" aria-label={label} className="animate-pulse motion-reduce:animate-none">
      <div className="mt-2 h-5 w-64 rounded bg-line" />
      <div className="mt-8 flex gap-4 overflow-hidden">
        {Array.from({ length: 5 }, (_, i) => (
          <div key={i} className="h-[28rem] w-72 shrink-0 rounded-xl bg-line/50" />
        ))}
      </div>
    </div>
  );
}
