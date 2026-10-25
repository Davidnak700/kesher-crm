import { getDictionary, getLocale } from "@/i18n/get-dictionary";
import { getBoard, getContactOptions } from "@/lib/data/deals";
import { DealsBoard } from "./deals-board";

export async function BoardView() {
  const locale = await getLocale();
  const [dict, board, contacts] = await Promise.all([getDictionary(locale), getBoard(), getContactOptions()]);

  // "Today" in the business's time zone, decided once on the server so the browser agrees with it.
  const today = new Intl.DateTimeFormat("en-CA", { timeZone: "Asia/Jerusalem" }).format(new Date());

  return (
    <DealsBoard
      stages={board.stages}
      deals={board.deals}
      contacts={contacts}
      locale={locale}
      today={today}
      t={dict.deals}
    />
  );
}
