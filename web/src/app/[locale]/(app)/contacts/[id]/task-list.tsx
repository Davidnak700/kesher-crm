"use client";

import { useActionState, useEffect, useOptimistic, useState, useTransition } from "react";
import { format } from "@/i18n/config";
import type { Dictionary } from "@/i18n/get-dictionary";
import { createTask, deleteTask, setTaskDone, type TaskFormState } from "./actions";

export type TaskItem = {
  id: string;
  title: string;
  priority: "low" | "medium" | "high";
  done: boolean;
  overdue: boolean;
  /** Ready-to-show lines (due date, linked deal), formatted on the server. */
  meta: string[];
};

type Change = { id: string; done?: boolean; removed?: boolean };

export function TaskList({ contactId, tasks, t }: { contactId: string; tasks: TaskItem[]; t: Dictionary["contact"]["tasks"] }) {
  // Ticking a box shows immediately; the server's answer replaces it (or puts it back on failure).
  const [shown, applyChange] = useOptimistic(tasks, (list, change: Change) =>
    change.removed ? list.filter((task) => task.id !== change.id) : list.map((task) => (task.id === change.id ? { ...task, done: change.done! } : task)),
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

  const open = shown.filter((task) => !task.done);
  const done = shown.filter((task) => task.done);

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
        {task.meta.length > 0 && (
          <p className={`text-sm ${task.overdue ? "font-medium text-danger" : "text-muted"}`}>
            {task.meta.map((line, i) => (
              <span key={i} className="block"><bdi>{line}</bdi></span>
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

  return (
    <div>
      {failed && <p role="alert" className="mt-3 rounded-md bg-danger-soft px-3 py-2 text-sm text-danger">{t.failed}</p>}

      {open.length === 0 ? <p className="mt-3 text-muted">{t.empty}</p> : <ul className="mt-1 divide-y divide-line">{open.map(row)}</ul>}

      {adding ? (
        <NewTaskForm contactId={contactId} t={t} onDone={() => setAdding(false)} />
      ) : (
        <button type="button" onClick={() => setAdding(true)} className="mt-3 text-sm font-medium text-brand hover:underline">
          {t.add}
        </button>
      )}

      {done.length > 0 && (
        <details className="mt-4 border-t border-line pt-3">
          <summary className="cursor-pointer text-sm text-muted hover:text-ink">{format(t.completed, { count: done.length })}</summary>
          <ul className="divide-y divide-line">{done.map(row)}</ul>
        </details>
      )}
    </div>
  );
}

function NewTaskForm({ contactId, t, onDone }: { contactId: string; t: Dictionary["contact"]["tasks"]; onDone: () => void }) {
  const [state, action, saving] = useActionState<TaskFormState, FormData>(createTask.bind(null, contactId), { ok: false, error: null });

  useEffect(() => {
    if (state.savedAt) onDone();
  }, [state.savedAt, onDone]);

  const field =
    "w-full rounded-md border border-line bg-surface px-3 py-2 text-base text-ink placeholder:text-muted focus:border-brand focus:outline-none focus:ring-2 focus:ring-brand/25";

  return (
    <form action={action} aria-label={t.newLabel} className="mt-3 space-y-3 rounded-lg bg-paper p-3">
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
      <div className="grid grid-cols-2 gap-3">
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
