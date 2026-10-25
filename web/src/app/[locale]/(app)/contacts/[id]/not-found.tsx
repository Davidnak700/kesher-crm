import Link from "next/link";
import { getDictionary, getLocale } from "@/i18n/get-dictionary";

export default async function ContactNotFound() {
  const locale = await getLocale();
  const dict = await getDictionary(locale);

  return (
    <div className="mx-auto max-w-6xl">
      <h1 className="text-3xl font-semibold">{dict.contact.notFoundTitle}</h1>
      <p className="mt-2 text-muted">{dict.contact.notFoundBody}</p>
      <Link href={`/${locale}/contacts`} className="mt-6 inline-block rounded-md bg-brand px-4 py-2.5 font-medium text-brand-ink hover:bg-brand-hover">
        {dict.contact.back}
      </Link>
    </div>
  );
}
