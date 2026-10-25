import { Suspense } from "react";
import type { Metadata } from "next";
import { getDictionary } from "@/i18n/get-dictionary";
import { ContactsView } from "./contacts-view";

export async function generateMetadata(): Promise<Metadata> {
  return { title: (await getDictionary()).contacts.title };
}

export default async function ContactsPage({ searchParams }: PageProps<"/[locale]/contacts">) {
  const dict = await getDictionary();

  return (
    <div className="mx-auto max-w-6xl">
      <h1 className="text-3xl font-semibold">{dict.contacts.title}</h1>
      <Suspense fallback={<ContactsSkeleton label={dict.contacts.loading} />}>
        <ContactsView searchParams={searchParams} />
      </Suspense>
    </div>
  );
}

function ContactsSkeleton({ label }: { label: string }) {
  return (
    <div role="status" aria-label={label} className="mt-6 animate-pulse motion-reduce:animate-none">
      <div className="h-5 w-32 rounded bg-line" />
      <div className="mt-6 h-11 max-w-md rounded-md bg-line/70" />
      <div className="mt-6 h-96 rounded-lg border border-line bg-surface" />
    </div>
  );
}
