/**
 * The product name is the Hebrew word קשר ("connection", "contact") in both languages —
 * the one bold element of the identity.
 */
export function Wordmark({ className = "" }: { className?: string }) {
  return (
    <span className={`inline-flex items-baseline gap-2 ${className}`}>
      <span className="text-3xl font-bold leading-none tracking-tight" lang="he" dir="rtl">
        קשר
      </span>
      <span className="text-sm font-medium opacity-70" lang="en" dir="ltr">
        CRM
      </span>
    </span>
  );
}
