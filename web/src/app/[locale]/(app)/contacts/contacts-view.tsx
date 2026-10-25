import Link from "next/link";
import { format, type Locale } from "@/i18n/config";
import { getDictionary, getLocale } from "@/i18n/get-dictionary";
import { getCompanyOptions, getContacts, parseContactQuery, type ContactQuery } from "@/lib/data/contacts";
import { ContactsManager, type ContactRow } from "./contacts-manager";
import { ContactsToolbar } from "./contacts-toolbar";

const dateLocale: Record<Locale, string> = { he: "he-IL", en: "en-GB" };

export async function ContactsView({ searchParams }: { searchParams: Promise<Record<string, string | string[] | undefined>> }) {
  const query = parseContactQuery(await searchParams);
  const locale = await getLocale();
  const dict = await getDictionary(locale);
  const t = dict.contacts;

  const [{ contacts, total, pages }, companies] = await Promise.all([getContacts(query), getCompanyOptions()]);

  // Format on the server so the browser's time zone can't cause a hydration mismatch.
  const dateFormat = new Intl.DateTimeFormat(dateLocale[locale], { day: "numeric", month: "short", year: "numeric", timeZone: "Asia/Jerusalem" });
  const rows: ContactRow[] = contacts.map((c) => ({ ...c, added: dateFormat.format(new Date(c.created_at)) }));

  const emptyMessage = query.q ? format(t.noResults, { q: query.q }) : query.status ? t.noResultsFiltered : null;

  return (
    <>
      <ContactsManager
        countLabel={format(t.count, { count: total.toLocaleString(dateLocale[locale]) })}
        toolbar={<ContactsToolbar t={t} />}
        rows={rows}
        companies={companies}
        t={t}
        emptyMessage={emptyMessage}
      />

      {pages > 1 && <Pagination query={query} pages={pages} locale={locale} t={t.pagination} />}
    </>
  );
}

function Pagination({ query, pages, locale, t }: { query: ContactQuery; pages: number; locale: Locale; t: { label: string; prev: string; next: string; page: string } }) {
  const href = (page: number) => {
    const params = new URLSearchParams();
    if (query.q) params.set("q", query.q);
    if (query.status) params.set("status", query.status);
    if (page > 1) params.set("page", String(page));
    const qs = params.toString();
    return `/${locale}/contacts${qs ? `?${qs}` : ""}`;
  };
  const linkClass = "rounded-md border border-line bg-surface px-3 py-1.5 hover:border-brand";
  const disabledClass = "rounded-md border border-line px-3 py-1.5 opacity-40";

  return (
    <nav aria-label={t.label} className="mt-5 flex items-center justify-between gap-4 text-sm">
      {query.page > 1 ? <Link href={href(query.page - 1)} className={linkClass}>{t.prev}</Link> : <span className={disabledClass}>{t.prev}</span>}
      <span className="text-muted">{format(t.page, { page: query.page, pages })}</span>
      {query.page < pages ? <Link href={href(query.page + 1)} className={linkClass}>{t.next}</Link> : <span className={disabledClass}>{t.next}</span>}
    </nav>
  );
}
