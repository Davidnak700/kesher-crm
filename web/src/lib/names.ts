/** "First Last", skipping a missing last name. Safe to use on the server and in the browser. */
export function fullName(c: { first_name: string; last_name: string | null }) {
  return [c.first_name, c.last_name].filter(Boolean).join(" ");
}
