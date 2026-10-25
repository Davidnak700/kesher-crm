import { getDictionary } from "@/i18n/get-dictionary";

/** Placeholder for sections that are planned but not built yet. */
export async function ComingNext({ title }: { title: string }) {
  const dict = await getDictionary();
  return (
    <>
      <h1 className="text-3xl font-semibold">{title}</h1>
      <div className="mt-8 max-w-lg rounded-lg border border-dashed border-line p-8">
        <p className="font-medium">{dict.placeholder.title}</p>
        <p className="mt-1 text-muted">{dict.placeholder.body}</p>
      </div>
    </>
  );
}
