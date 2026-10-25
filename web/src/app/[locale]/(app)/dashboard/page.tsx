import type { Metadata } from "next";
import { ComingNext } from "@/components/coming-next";
import { getDictionary } from "@/i18n/get-dictionary";

export async function generateMetadata(): Promise<Metadata> {
  return { title: (await getDictionary()).nav.dashboard };
}

export default async function Page() {
  const dict = await getDictionary();
  return <ComingNext title={dict.nav.dashboard} />;
}
