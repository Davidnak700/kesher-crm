import { Suspense } from "react";
import type { Metadata } from "next";
import { getDictionary } from "@/i18n/get-dictionary";
import { ContactDetailView } from "./contact-detail-view";

export async function generateMetadata(): Promise<Metadata> {
  return { title: (await getDictionary()).contacts.title };
}

export default async function ContactPage({ params }: PageProps<"/[locale]/contacts/[id]">) {
  const dict = await getDictionary();

  return (
    <div className="mx-auto max-w-6xl">
      <Suspense fallback={<DetailSkeleton label={dict.contact.loading} />}>
        <ContactDetailView params={params} />
      </Suspense>
    </div>
  );
}

function DetailSkeleton({ label }: { label: string }) {
  return (
    <div role="status" aria-label={label} className="animate-pulse motion-reduce:animate-none">
      <div className="h-4 w-28 rounded bg-line" />
      <div className="mt-5 h-9 w-72 rounded bg-line" />
      <div className="mt-8 grid gap-6 lg:grid-cols-[minmax(0,2fr)_minmax(0,1fr)]">
        <div className="h-96 rounded-xl bg-line/50" />
        <div className="h-96 rounded-xl bg-line/50" />
      </div>
    </div>
  );
}
