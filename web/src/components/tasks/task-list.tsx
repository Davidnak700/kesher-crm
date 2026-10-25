"use client";

import Link from "next/link";
import { useActionState, useEffect, useOptimistic, useState, useTransition } from "react";
import { format } from "@/i18n/config";
import type { Dictionary } from "@/i18n/get-dictionary";
import { createTask, deleteTask, setTaskDone, type TaskFormState } from "@/app/[locale]/(app)/tasks/actions";

export type TaskItem = {
  id: string;
  title: string;
  priority: "low" | "medium" | "high";
  done: boolean;
  overdue: boolean;
  /** Which group the task is listed under (see `groups`). */
  group: string;
  /** Ready-to-show lines (due date, linked deal), formatted on the server. */
  meta: string[];
  contact?: { name: string; href: string } | null;
};

type Change = { id: string; done?: boolean; removed?: boolean };
type T = Dictionary["tasks"];

/**
 * A task list with optimistic ticking and deleting.
 * - `groups` decides order and headings (a group without a label has no heading).
 * - `completed: "collapsed"` folds done tasks into one section at the end (contact page);
 *   `"in-place"` leaves a just-ticked task where it is, crossed out, until the page refreshes (tasks page).
 */
export function TaskList({
  tasks,
  groups,
  completed,
  emptyText,
  t,
  newTask,
}: {
  tasks: TaskItem[];
  groups: { key: string; label?: string }[];
  completed: "collapsed" | "in-place";
  emptyText: string;
  t: T;
  newTask?: { contactId?: string; contacts?: { id: string; name: string }[] } | null;
}) {
  const [shown, applyChange] = useOptimistic(tasks, (list, change: Change) =>
    change.removed
      ? list.filter((task) => task.id !== change.id)
      : list.map((task) => (task.id === change.id ? { ...task, done: change.done! } : task)),
  );
  const [, start] = useTransition();
  const [failed, setFailed] = useState(false);
  const [adding, setAdding] = useState(false);

  const run = (change: Change, save: () => Promise<{ ok: boolean }>) =>
    start(async () => {
      setFailed(false);
      applyChange(change);
      const result = await save();
      if (!result.ok) setFailed(true);
    });

  const listed = completed === "collapsed" ? shown.filter((task) => !task.done) : shown;
  const done = completed === "collapsed" ? shown.filter((task) => task.done) : [];

  const row = (task: TaskItem) => (
    <li key={task.id} className="group flex items-start gap-3 py-2.5">
      <input
        type="checkbox"
        checked={task.done}
        onChange={(e) => run({ id: task.id, done: e.target.checked }, () => setTaskDone(task.id, e.target.checked))}
        aria-label={format(task.done ? t.markOpen : t.markDone, { title: task.title })}
        className="mt-1 size-4 shrink-0 accent-[var(--brand)]"
      />
      <div className="min-w-0 flex-1">
        <p className={task.done ? "text-muted line-through" : ""}>
          {task.priority === "high" && !task.done && (
            <span className="me-1.5 inline-block size-2 rounded-full bg-danger align-middle" title={t.priorities.high}>
              <span className="sr-only">{t.priorities.high}</span>
            </span>
          )}
          <bdi>{task.title}</bdi>
        </p>
        {(task.meta.length > 0 || task.contact) && (
          <p className="text-sm text-muted">
            {task.contact && (
              <Link href={task.contact.href} className="me-3 hover:text-brand hover:underline">
                <bdi>{task.contact.name}</bdi>
              </Link>
            )}
            {task.meta.map((line, i) => (
              <span key={i} className={`me-3 inline-block ${i === 0 && task.overdue && !task.done ? "font-medium text-danger" : ""}`}>
                <bdi>{line}</bdi>
              </span>
            ))}
          </p>
        )}
      </div>
      <button
        type="button"
        onClick={() => run({ id: task.id, removed: true }, () => deleteTask(task.id))}
        aria-label={format(t.delete, { title: task.title })}
        title={format(t.delete, { title: task.title })}
        className="rounded p-1 text-muted opacity-60 hover:bg-paper hover:text-danger group-hover:opacity-100 focus-visible:opacity-100"
      >
        <svg viewBox="0 0 20 20" className="size-4" aria-hidden="true">
          <path d="M6 6l8 8M14 6l-8 8" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" />
        </svg>
      </button>
    </li>
  );

  const sections = groups
    .map((g) => ({ ...g, items: listed.filter((task) => task.group === g.key) }))
    .filter((g) => g.items.length > 0);

  return (
    <div>
      {failed && <p role="alert" className="mt-3 rounded-md bg-danger-soft px-3 py-2 text-sm text-danger">{t.failed}</p>}

      {newTask && (adding ? (
        <NewTaskForm t={t} contactId={newTask.contactId} contacts={newTask.contacts} onDone={() => setAdding(false)} />
      ) : (
        <button type="button" onClick={() => setAdding(true)} className="mt-3 text-sm font-medium text-brand hover:underline">
          {t.add}
        </button>
      ))}

      {sections.length === 0 && <p className="mt-3 text-muted">{emptyText}</p>}

      {sections.map((section) => (
        <section key={section.key} aria-label={section.label} className={section.label ? "mt-6 first:mt-4" : "mt-1"}>
          {section.label && (
            <h2 className={`flex items-baseline gap-2 text-sm font-semibold ${section.key === "overdue" ? "text-danger" : ""}`}>
              {section.label}
              <span className="font-normal text-muted">{section.items.length}</span>
            </h2>
          )}
          <ul className="divide-y divide-line">{section.items.map(row)}</ul>
        </section>
      ))}

      {done.length > 0 && (
        <details className="mt-4 border-t border-line pt-3">
          <summary className="cursor-pointer text-sm text-muted hover:text-ink">{format(t.completed, { count: done.length })}</summary>
          <ul className="divide-y divide-line">{done.map(row)}</ul>
        </details>
      )}
    </div>
  );
}

function NewTaskForm({
  t,
  contactId,
  contacts,
  onDone,
}: {
  t: T;
  contactId?: string;
  contacts?: { id: string; name: string }[];
  onDone: () => void;
}) {
  const [state, action, saving] = useActionState<TaskFormState, FormData>(createTask, { ok: false, error: null });

  useEffect(() => {
    if (state.savedAt) onDone();
  }, [state.savedAt, onDone]);

  const field =
    "w-full rounded-md border border-line bg-surface px-3 py-2 text-base text-ink placeholder:text-muted focus:border-brand focus:outline-none focus:ring-2 focus:ring-brand/25";

  return (
    <form action={action} aria-label={t.newLabel} className="mt-3 space-y-3 rounded-lg bg-paper p-3">
      {contactId && <input type="hidden" name="contact_id" value={contactId} />}
      <div>
        <label htmlFor="task-title" className="mb-1 block text-sm font-medium">{t.titleLabel}</label>
        <input
          id="task-title"
          name="title"
          autoFocus
          placeholder={t.titlePlaceholder}
          aria-invalid={state.error === "title" || undefined}
          aria-describedby={state.error ? "task-error" : undefined}
          className={`${field} aria-invalid:border-danger`}
        />
      </div>
      <div className="grid gap-3 sm:grid-cols-2">
        <div>
          <label htmlFor="task-due" className="mb-1 block text-sm font-medium">{t.due}</label>
          <input id="task-due" name="due" type="date" className={field} />
        </div>
        <div>
          <label htmlFor="task-priority" className="mb-1 block text-sm font-medium">{t.priority}</label>
          <select id="task-priority" name="priority" defaultValue="medium" className={field}>
            {(["low", "medium", "high"] as const).map((p) => (
              <option key={p} value={p}>{t.priorities[p]}</option>
            ))}
          </select>
        </div>
        {contacts && (
          <div className="sm:col-span-2">
            <label htmlFor="task-contact" className="mb-1 block text-sm font-medium">{t.contact}</label>
            <select id="task-contact" name="contact_id" defaultValue="" className={field}>
              <option value="">{t.noContact}</option>
              {contacts.map((c) => (
                <option key={c.id} value={c.id}>{c.name}</option>
              ))}
            </select>
          </div>
        )}
      </div>
      {state.error && <p id="task-error" role="alert" className="text-sm text-danger">{t.errors[state.error]}</p>}
      <div className="flex justify-end gap-2">
        <button type="button" onClick={onDone} className="rounded-md px-3 py-2 text-sm text-muted hover:text-ink">
          {t.cancel}
        </button>
        <button type="submit" disabled={saving} className="rounded-md bg-brand px-4 py-2 text-sm font-medium text-brand-ink hover:bg-brand-hover disabled:opacity-60">
          {saving ? t.saving : t.add}
        </button>
      </div>
    </form>
  );
}
