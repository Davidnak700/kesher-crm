import Link from "next/link";
import { TaskList, type TaskItem } from "@/components/tasks/task-list";
import { format, type Locale } from "@/i18n/config";
import { getDictionary, getLocale } from "@/i18n/get-dictionary";
import { getContactOptions } from "@/lib/data/deals";
import { getCompletedTasks, getOpenTasks, type TaskRow } from "@/lib/data/tasks";
import { fullName } from "@/lib/names";
import { addDays, israelDay } from "@/lib/time";

const dateLocale: Record<Locale, string> = { he: "he-IL", en: "en-GB" };
const GROUPS = ["overdue", "today", "week", "later", "none"] as const;


export async function TasksView({ searchParams }: { searchParams: Promise<Record<string, string | string[] | undefined>> }) {
  const view = (await searchParams).view === "done" ? "done" : "open";
  const locale = await getLocale();
  const [dict, rows, contacts] = await Promise.all([
    getDictionary(locale),
    view === "done" ? getCompletedTasks() : getOpenTasks(),
    view === "open" ? getContactOptions() : Promise.resolve([]),
  ]);
  const t = dict.tasks;

  const today = israelDay();
  const weekEnd = addDays(today, 7);
  const date = new Intl.DateTimeFormat(dateLocale[locale], { weekday: "short", day: "numeric", month: "short", timeZone: "Asia/Jerusalem" });

  const groupOf = (task: TaskRow) => {
    if (task.completed_at) return "done";
    if (!task.due_at) return "none";
    const day = israelDay(new Date(task.due_at));
    return day < today ? "overdue" : day === today ? "today" : day <= weekEnd ? "week" : "later";
  };

  const items: TaskItem[] = rows.map((task) => {
    const group = groupOf(task);
    const overdue = group === "overdue";
    return {
      id: task.id,
      title: task.title,
      priority: task.priority,
      done: Boolean(task.completed_at),
      overdue,
      group,
      contact: task.contact ? { name: fullName(task.contact), href: `/${locale}/contacts/${task.contact.id}` } : null,
      meta: [
        task.completed_at
          ? format(t.doneOn, { date: date.format(new Date(task.completed_at)) })
          : task.due_at && group !== "today"
            ? format(overdue ? t.overdue : t.dueOn, { date: date.format(new Date(task.due_at)) })
            : null,
        task.deal ? format(t.forDeal, { deal: task.deal.title }) : null,
      ].filter((x): x is string => Boolean(x)),
    };
  });

  const overdueCount = items.filter((i) => i.group === "overdue").length;
  const tab = (key: "open" | "done") => (
    <Link
      href={key === "open" ? `/${locale}/tasks` : `/${locale}/tasks?view=done`}
      aria-current={view === key ? "page" : undefined}
      className={`block rounded-md px-3 py-1.5 text-sm transition-colors ${view === key ? "bg-brand font-medium text-brand-ink" : "text-muted hover:text-ink"}`}
    >
      {t.views[key]}
    </Link>
  );

  return (
    <>
      <div className="mt-1 flex flex-wrap items-center justify-between gap-4">
        <p className="text-muted">
          {view === "open" ? format(t.summary, { open: items.length, overdue: overdueCount }) : t.views.done}
        </p>
        <nav aria-label={t.views.label}>
          <ul className="flex gap-1 rounded-lg bg-surface p-1 ring-1 ring-line">
            <li>{tab("open")}</li>
            <li>{tab("done")}</li>
          </ul>
        </nav>
      </div>

      <div className="mt-6 rounded-xl border border-line bg-surface px-5 pb-5 pt-1">
        <TaskList
          // a fresh list per view, so optimistic state never leaks between tabs
          key={view}
          tasks={items}
          groups={view === "open" ? GROUPS.map((key) => ({ key, label: t.groups[key] })) : [{ key: "done" }]}
          completed="in-place"
          emptyText={view === "open" ? t.emptyAll : t.emptyDone}
          t={t}
          newTask={view === "open" ? { contacts } : null}
        />
      </div>
    </>
  );
}
