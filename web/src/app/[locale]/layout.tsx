import type { Metadata } from "next";
import "@fontsource-variable/rubik";
import "../globals.css";
import { getDirection, locales } from "@/i18n/config";
import { getDictionary, getLocale } from "@/i18n/get-dictionary";

export function generateStaticParams() {
  return locales.map((locale) => ({ locale }));
}

export async function generateMetadata(): Promise<Metadata> {
  const dict = await getDictionary();
  return {
    title: { default: dict.meta.title, template: `%s · ${dict.meta.title}` },
    description: dict.meta.description,
  };
}

export default async function RootLayout({ children }: LayoutProps<"/[locale]">) {
  const locale = await getLocale();

  return (
    <html lang={locale} dir={getDirection(locale)} className="h-full antialiased">
      <body className="min-h-full">{children}</body>
    </html>
  );
}
