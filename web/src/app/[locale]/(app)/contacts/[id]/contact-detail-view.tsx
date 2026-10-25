import Link from "next/link";
import { notFound } from "next/navigation";
import { StatusBadge } from "@/components/status-badge";
import { format, type Locale } from "@/i18n/config";
import { getDictionary, getLocale, type Dictionary } from "@/i18n/get-dictionary";
import { getContactDetail, type StageInfo } from "@/lib/data/contact-detail";
import { getCompanyOptions } from "@/lib/data/contacts";
import { formatMoney } from "@/lib/format";
import { fullName } from "@/lib/names";
import { ActivityComposer, DeleteActivityButton } from "./activity";
import { ContactActions } from "./contact-actions";
import { TaskList, type TaskItem } from "./task-list";

const dateTimeLocale: Record<Locale, string> = { he: "he-IL", en: "en-GB" };

type TimelineItem =
  | { kind: "activity"; id: string; at: string; type: "note" | "call" | "email" | "meeting"; body: string; deal: string | null }
  | { kind: "stage"; id: string; at: string; text: string }
  | { kind: "created"; id: string; at: string };

export async function ContactDetailView({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const locale = await getLocale();
  const [dict, detail, companies] = await Promise.all([getDictionary(locale), getContactDetail(id), getCompanyOptions()]);
  if (!detail) notFound();

  const t = dict.contact;
  const { contact, deals, tasks, activities, history, stages } = detail;
  const name = fullName(contact);

  // All dates are formatted here, on the server, in Israel's time zone.
  const dateTime = new Intl.DateTimeFormat(dateTimeLocale[locale], {
    day: "numeric", month: "short", year: "numeric", hour: "2-digit", minute: "2-digit", timeZone: "Asia/Jerusalem",
  });
  const dateOnly = new Intl.DateTimeFormat(dateTimeLocale[locale], { day: "numeric", month: "short", year: "numeric", timeZone: "Asia/Jerusalem" });
  const today = new Intl.DateTimeFormat("en-CA", { timeZone: "Asia/Jerusalem" }).format(new Date());
  const israelDay = (iso: string) => new Intl.DateTimeFormat("en-CA", { timeZone: "Asia/Jerusalem" }).format(new Date(iso));

  const stageLabel = (stage: StageInfo | undefined) =>
    stage ? (stage.key && dict.deals.stages[stage.key as keyof Dictionary["deals"]["stages"]]) || stage.name || "" : "";
  const stageById = new Map(stages.map((s) => [s.id, s]));
  const dealTitle = new Map(deals.map((d) => [d.id, d.title]));

  // ---- timeline: logged activities + automatic stage moves + when the contact was added ----
  const timeline: TimelineItem[] = [
    ...activities.map((a) => ({ kind: "activity" as const, id: a.id, at: a.occurred_at, type: a.type, body: a.body, deal: a.deal?.title ?? null })),
    ...history.map((h) => ({
      kind: "stage" as const,
      id: `h${h.id}`,
      at: h.changed_at,
      text: h.from_stage_id
        ? format(t.timeline.stageChange, { deal: dealTitle.get(h.deal_id) ?? "", from: stageLabel(stageById.get(h.from_stage_id)), to: stageLabel(stageById.get(h.to_stage_id)) })
        : format(t.timeline.dealCreated, { deal: dealTitle.get(h.deal_id) ?? "", to: stageLabel(stageById.get(h.to_stage_id)) }),
    })),
    { kind: "created" as const, id: "created", at: contact.created_at },
  ].sort((a, b) => b.at.localeCompare(a.at));

  // ---- tasks, with labels ready to show ----
  const taskItems: TaskItem[] = tasks.map((task) => {
    const due = task.due_at ? israelDay(task.due_at) : null;
    const overdue = !task.completed_at && due !== null && due < today;
    return {
      id: task.id,
      title: task.title,
      priority: task.priority,
      done: Boolean(task.completed_at),
      overdue,
      meta: [
        task.completed_at
          ? format(t.tasks.doneOn, { date: dateOnly.format(new Date(task.completed_at)) })
          : task.due_at
            ? format(overdue ? t.tasks.overdue : t.tasks.dueOn, { date: dateOnly.format(new Date(task.due_at)) })
            : null,
        task.deal ? format(t.tasks.forDeal, { deal: task.deal.title }) : null,
      ].filter((x): x is string => Boolean(x)),
    };
  });

  const wonCount = deals.filter((d) => d.stage?.kind === "won").length;

  return (
    <>
      <Link href={`/${locale}/contacts`} className="text-sm text-muted hover:text-brand">
        {t.back}
      </Link>

      <header className="mt-3 flex flex-wrap items-start justify-between gap-4">
        <div className="min-w-0">
          <div className="flex flex-wrap items-center gap-3">
            <h1 className="text-3xl font-semibold"><bdi>{name}</bdi></h1>
            <StatusBadge status={contact.status} label={dict.contacts.status[contact.status]} />
          </div>
          {(contact.position || contact.company) && (
            <p className="mt-1 text-muted">
              <bdi>{[contact.position, contact.company?.name].filter(Boolean).join(", ")}</bdi>
            </p>
          )}
        </div>
        <ContactActions
          contact={contact}
          companies={companies}
          t={dict.contacts}
          editLabel={t.edit}
          listHref={`/${locale}/contacts`}
        />
      </header>

      <div className="mt-8 grid gap-6 lg:grid-cols-[minmax(0,2fr)_minmax(0,1fr)]">
        {/* ---------------- activity ---------------- */}
        <section aria-labelledby="timeline-title" className="min-w-0">
          <h2 id="timeline-title" className="text-xl font-semibold">{t.timeline.title}</h2>
          <div className="mt-4">
            <ActivityComposer contactId={contact.id} t={t.timeline} />
          </div>

          {timeline.length <= 1 && <p className="mt-6 text-muted">{t.timeline.empty}</p>}

          <ol className="mt-6 space-y-0">
            {timeline.map((item, i) => (
              <li key={item.id} className="relative flex gap-4 pb-6">
                {/* the rail: one line down the inline-start side, interrupted by each marker */}
                {i < timeline.length - 1 && <span className="absolute start-[15px] top-8 bottom-0 w-px bg-line" aria-hidden="true" />}
                <TimelineMarker item={item} />
                <div className="min-w-0 flex-1 pt-1">
                  {item.kind === "activity" ? (
                    <div className="rounded-lg border border-line bg-surface px-4 py-3">
                      <div className="flex items-start justify-between gap-3">
                        <p className="text-sm text-muted">
                          <span className="font-medium text-ink">{t.timeline.types[item.type]}</span>
                          {item.deal && <span className="ms-2"><bdi>{item.deal}</bdi></span>}
                        </p>
                        <DeleteActivityButton id={item.id} label={t.timeline.delete} failedLabel={t.timeline.deleteFailed} />
                      </div>
                      <p className="mt-1 whitespace-pre-line"><bdi>{item.body}</bdi></p>
                      <time dateTime={item.at} className="mt-2 block text-xs text-muted">{dateTime.format(new Date(item.at))}</time>
                    </div>
                  ) : (
                    <>
                      <p className="text-[15px]">
                        {item.kind === "stage" ? <bdi>{item.text}</bdi> : t.timeline.created}
                      </p>
                      <time dateTime={item.at} className="block text-xs text-muted">{dateTime.format(new Date(item.at))}</time>
                    </>
                  )}
                </div>
              </li>
            ))}
          </ol>
        </section>

        {/* ---------------- side column ---------------- */}
        <div className="min-w-0 space-y-6">
          <section aria-labelledby="details-title" className="rounded-xl border border-line bg-surface p-5">
            <h2 id="details-title" className="text-lg font-semibold">{t.details}</h2>
            <dl className="mt-3 grid grid-cols-[auto_minmax(0,1fr)] gap-x-4 gap-y-2.5 text-[15px]">
              <dt className="text-muted">{t.email}</dt>
              <dd className="truncate">
                {contact.email ? <a href={`mailto:${contact.email}`} className="hover:text-brand"><bdi>{contact.email}</bdi></a> : t.none}
              </dd>
              <dt className="text-muted">{t.phone}</dt>
              <dd>{contact.phone ? <a href={`tel:${contact.phone}`} className="hover:text-brand"><bdi>{contact.phone}</bdi></a> : t.none}</dd>
              <dt className="text-muted">{t.company}</dt>
              <dd><bdi>{contact.company?.name ?? t.none}</bdi></dd>
              <dt className="text-muted">{t.source}</dt>
              <dd>{contact.source ? dict.contacts.source[contact.source] : t.none}</dd>
              <dt className="text-muted">{t.added}</dt>
              <dd>{dateOnly.format(new Date(contact.created_at))}</dd>
              {contact.tags.length > 0 && (
                <>
                  <dt className="text-muted">{t.tags}</dt>
                  <dd className="flex flex-wrap gap-1">
                    {contact.tags.map((tag) => (
                      <span key={tag} className="rounded bg-paper px-2 py-0.5 text-sm"><bdi>{tag}</bdi></span>
                    ))}
                  </dd>
                </>
              )}
            </dl>
          </section>

          <section aria-labelledby="deals-title" className="rounded-xl border border-line bg-surface p-5">
            <div className="flex items-baseline justify-between gap-3">
              <h2 id="deals-title" className="text-lg font-semibold">{t.deals.title}</h2>
              {deals.length > 0 && <span className="text-sm text-muted">{format(t.deals.total, { count: deals.length, won: wonCount })}</span>}
            </div>
            {deals.length === 0 ? (
              <p className="mt-3 text-muted">{t.deals.empty}</p>
            ) : (
              <ul className="mt-3 divide-y divide-line">
                {deals.map((d) => (
                  <li key={d.id} className="flex items-baseline justify-between gap-3 py-2.5">
                    <div className="min-w-0">
                      <p className="truncate font-medium"><bdi>{d.title}</bdi></p>
                      <p className={`text-sm ${d.stage?.kind === "won" ? "text-brand" : "text-muted"}`}>{stageLabel(d.stage ?? undefined)}</p>
                    </div>
                    <span className="shrink-0 font-semibold tabular-nums">{formatMoney(d.amount, d.currency, locale)}</span>
                  </li>
                ))}
              </ul>
            )}
            <Link href={`/${locale}/deals`} className="mt-3 inline-block text-sm text-brand hover:underline">
              {t.deals.openBoard}
            </Link>
          </section>

          <section aria-labelledby="tasks-title" className="rounded-xl border border-line bg-surface p-5">
            <h2 id="tasks-title" className="text-lg font-semibold">{t.tasks.title}</h2>
            <TaskList contactId={contact.id} tasks={taskItems} t={t.tasks} />
          </section>
        </div>
      </div>
    </>
  );
}

function TimelineMarker({ item }: { item: TimelineItem }) {
  const style =
    item.kind === "activity" ? "bg-brand-soft text-brand" : item.kind === "stage" ? "bg-lead-soft text-lead" : "bg-inactive-soft text-inactive";
  return (
    <span className={`relative z-10 flex size-8 shrink-0 items-center justify-center rounded-full ${style}`} aria-hidden="true">
      <svg viewBox="0 0 20 20" className={`size-4 ${item.kind === "stage" ? "rtl:-scale-x-100" : ""}`} fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round">
        {item.kind === "created" && <path d="M10 4v12M4 10h12" />}
        {item.kind === "stage" && <path d="M4 10h11M11 6l4 4-4 4" />}
        {item.kind === "activity" && item.type === "note" && <path d="M5 4h10v12H5zM8 8h4M8 11h4" />}
        {item.kind === "activity" && item.type === "call" && (
          <path d="M6 3.5h2.5l1 3.5-1.7 1.2a8 8 0 0 0 4 4l1.2-1.7 3.5 1v2.5A1.5 1.5 0 0 1 15 15.5 11.5 11.5 0 0 1 4.5 5 1.5 1.5 0 0 1 6 3.5z" />
        )}
        {item.kind === "activity" && item.type === "email" && <path d="M3.5 5.5h13v9h-13zM3.5 6l6.5 5 6.5-5" />}
        {item.kind === "activity" && item.type === "meeting" && <path d="M4 6h12v10H4zM4 9h12M7 4v3M13 4v3" />}
      </svg>
    </span>
  );
}
