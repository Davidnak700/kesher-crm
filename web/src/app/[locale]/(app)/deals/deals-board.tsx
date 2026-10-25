"use client";

import { useRef, useState, useTransition, type KeyboardEventHandler, type MouseEventHandler, type TouchEventHandler } from "react";
import {
  DndContext,
  DragOverlay,
  KeyboardSensor,
  MouseSensor,
  TouchSensor,
  closestCorners,
  useDroppable,
  useSensor,
  useSensors,
  type Announcements,
  type DragEndEvent,
  type DragOverEvent,
  type DragStartEvent,
  type UniqueIdentifier,
} from "@dnd-kit/core";
import { SortableContext, arrayMove, sortableKeyboardCoordinates, useSortable, verticalListSortingStrategy } from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";
import { format, type Locale } from "@/i18n/config";
import type { Dictionary } from "@/i18n/get-dictionary";
import type { BoardDeal, BoardStage, ContactOption } from "@/lib/data/deals";
import { formatMoney } from "@/lib/format";
import { moveDeal } from "./actions";
import { DealCard, GripIcon } from "./deal-card";
import { DealDialog } from "./deal-dialog";

type Columns = Record<string, string[]>; // stage id → deal ids, top to bottom
type DealMap = Record<string, BoardDeal>;
type DialogState = null | { mode: "new"; stageId: string } | { mode: "edit"; deal: BoardDeal };

const STEP = 1000; // gap between card positions; new positions go halfway between neighbours

function buildColumns(stages: BoardStage[], deals: BoardDeal[]): Columns {
  const columns: Columns = Object.fromEntries(stages.map((s) => [s.id, []]));
  [...deals].sort((a, b) => a.position - b.position).forEach((d) => columns[d.stage_id]?.push(d.id));
  return columns;
}

const toMap = (deals: BoardDeal[]): DealMap => Object.fromEntries(deals.map((d) => [d.id, d]));

/** A position between the card above and the card below, so only the moved card is written. */
function positionBetween(before: number | undefined, after: number | undefined) {
  if (before === undefined && after === undefined) return STEP;
  if (before === undefined) return after! - STEP;
  if (after === undefined) return before + STEP;
  return (before + after) / 2;
}

export function DealsBoard({
  stages,
  deals,
  contacts,
  locale,
  today,
  t,
}: {
  stages: BoardStage[];
  deals: BoardDeal[];
  contacts: ContactOption[];
  locale: Locale;
  today: string;
  t: Dictionary["deals"];
}) {
  // Local copy of the board so moves show instantly; replaced whenever the server sends fresh data.
  const [source, setSource] = useState(deals);
  const [columns, setColumns] = useState(() => buildColumns(stages, deals));
  const [dealMap, setDealMap] = useState(() => toMap(deals));
  if (source !== deals) {
    setSource(deals);
    setColumns(buildColumns(stages, deals));
    setDealMap(toMap(deals));
  }

  const [activeId, setActiveId] = useState<string | null>(null);
  const [moveFailed, setMoveFailed] = useState(false);
  const [dialog, setDialog] = useState<DialogState>(null);
  const [, startTransition] = useTransition();
  const beforeDrag = useRef<{ columns: Columns; dealMap: DealMap } | null>(null);

  const sensors = useSensors(
    useSensor(MouseSensor, { activationConstraint: { distance: 6 } }),
    useSensor(TouchSensor, { activationConstraint: { delay: 200, tolerance: 8 } }),
    useSensor(KeyboardSensor, { coordinateGetter: sortableKeyboardCoordinates }),
  );

  const stageById = Object.fromEntries(stages.map((s) => [s.id, s]));
  const stageLabel = (stage: BoardStage) =>
    (stage.key && t.stages[stage.key as keyof typeof t.stages]) || stage.name || "";

  const columnOf = (id: UniqueIdentifier | undefined) => {
    if (id === undefined) return undefined;
    const key = String(id);
    return key in columns ? key : Object.keys(columns).find((stageId) => columns[stageId].includes(key));
  };

  // ---- drag and drop -------------------------------------------------------

  function onDragStart({ active }: DragStartEvent) {
    beforeDrag.current = { columns, dealMap };
    setActiveId(String(active.id));
    setMoveFailed(false);
  }

  /** Crossing into another column moves the card there right away, so the target column makes room. */
  function onDragOver({ active, over }: DragOverEvent) {
    const from = columnOf(active.id);
    const to = columnOf(over?.id);
    if (!over || !from || !to || from === to) return;

    setColumns((cols) => {
      const target = [...cols[to]];
      const overIndex = target.indexOf(String(over.id));
      const translated = active.rect.current.translated;
      const below = translated && overIndex >= 0 && translated.top > over.rect.top + over.rect.height / 2;
      const index = overIndex < 0 ? target.length : overIndex + (below ? 1 : 0);
      target.splice(index, 0, String(active.id));
      return { ...cols, [from]: cols[from].filter((id) => id !== active.id), [to]: target };
    });
  }

  function onDragEnd({ active, over }: DragEndEvent) {
    setActiveId(null);
    const saved = beforeDrag.current;
    beforeDrag.current = null;
    const id = String(active.id);
    const stageId = columnOf(id);
    if (!over || !saved || !stageId) return onDragCancel();

    let next = columns;
    const overIndex = columns[stageId].indexOf(String(over.id));
    const oldIndex = columns[stageId].indexOf(id);
    if (overIndex >= 0 && overIndex !== oldIndex) {
      next = { ...columns, [stageId]: arrayMove(columns[stageId], oldIndex, overIndex) };
    }

    const original = dealMap[id];
    const unchanged =
      original.stage_id === stageId && next[stageId].join() === saved.columns[stageId].join();
    if (unchanged) {
      setColumns(next);
      return;
    }

    const ids = next[stageId];
    const index = ids.indexOf(id);
    const position = positionBetween(dealMap[ids[index - 1]]?.position, dealMap[ids[index + 1]]?.position);
    const kind = stageById[stageId].kind;
    const moved: BoardDeal = {
      ...original,
      stage_id: stageId,
      position,
      closed_at: kind === "open" ? null : (original.closed_at ?? new Date().toISOString()),
    };

    setColumns(next);
    setDealMap({ ...dealMap, [id]: moved });

    startTransition(async () => {
      const result = await moveDeal({ id, stageId, position }).catch(() => ({ ok: false }));
      if (!result.ok) {
        setColumns(saved.columns);
        setDealMap(saved.dealMap);
        setMoveFailed(true);
      }
    });
  }

  function onDragCancel() {
    if (beforeDrag.current) setColumns(beforeDrag.current.columns);
    beforeDrag.current = null;
    setActiveId(null);
  }

  // ---- screen reader announcements, in the interface language --------------

  const dealTitle = (id: UniqueIdentifier) => dealMap[String(id)]?.title ?? "";
  const stageName = (id: UniqueIdentifier | undefined) => {
    const stageId = columnOf(id);
    return stageId ? stageLabel(stageById[stageId]) : "";
  };
  const announcements: Announcements = {
    onDragStart: ({ active }) => format(t.a11y.pickedUp, { title: dealTitle(active.id), stage: stageName(active.id) }),
    onDragOver: ({ active, over }) => (over ? format(t.a11y.over, { title: dealTitle(active.id), stage: stageName(over.id) }) : undefined),
    onDragEnd: ({ active, over }) => (over ? format(t.a11y.dropped, { title: dealTitle(active.id), stage: stageName(over.id) }) : undefined),
    onDragCancel: ({ active }) => {
      const original = dealMap[String(active.id)];
      return format(t.a11y.cancelled, { title: dealTitle(active.id), stage: original ? stageLabel(stageById[original.stage_id]) : "" });
    },
  };

  // ---- totals ---------------------------------------------------------------

  const openStages = stages.filter((s) => s.kind === "open");
  const openDeals = openStages.flatMap((s) => columns[s.id].map((id) => dealMap[id]));
  const openTotal = openDeals.reduce((sum, d) => sum + d.amount, 0);
  const forecast = openStages.reduce(
    (sum, s) => sum + columns[s.id].reduce((acc, id) => acc + dealMap[id].amount, 0) * (s.probability / 100),
    0,
  );
  const currency = deals[0]?.currency ?? "ILS";
  const activeDeal = activeId ? dealMap[activeId] : null;

  return (
    <>
      <div className="mt-1 flex flex-wrap items-center justify-between gap-4">
        <div>
          <p className="text-muted" suppressHydrationWarning>
            {format(t.summary, { count: openDeals.length, total: formatMoney(openTotal, currency, locale) })}
          </p>
          <p className="mt-0.5 text-sm text-muted" title={t.forecastHint} suppressHydrationWarning>
            {format(t.forecast, { amount: formatMoney(forecast, currency, locale) })}
          </p>
        </div>
        <button
          type="button"
          onClick={() => setDialog({ mode: "new", stageId: openStages[0]?.id ?? stages[0].id })}
          className="rounded-md bg-brand px-4 py-2.5 font-medium text-brand-ink transition-colors hover:bg-brand-hover"
        >
          {t.new}
        </button>
      </div>

      {moveFailed && (
        <p role="alert" className="mt-4 rounded-md bg-danger-soft px-4 py-2.5 text-sm text-danger">
          {t.moveFailed}
        </p>
      )}

      <DndContext
        id="deals-board"
        sensors={sensors}
        collisionDetection={closestCorners}
        onDragStart={onDragStart}
        onDragOver={onDragOver}
        onDragEnd={onDragEnd}
        onDragCancel={onDragCancel}
        accessibility={{ announcements, screenReaderInstructions: { draggable: t.a11y.instructions } }}
      >
        <div
          role="region"
          aria-label={t.boardLabel}
          className="-mx-4 mt-6 flex snap-x gap-3 overflow-x-auto px-4 pb-4 md:-mx-10 md:px-10"
        >
          {stages.map((stage) => (
            <Column
              key={stage.id}
              stage={stage}
              label={stageLabel(stage)}
              ids={columns[stage.id]}
              dealMap={dealMap}
              locale={locale}
              today={today}
              t={t}
              onOpen={(deal) => setDialog({ mode: "edit", deal })}
              onCreate={() => setDialog({ mode: "new", stageId: stage.id })}
            />
          ))}
        </div>

        <DragOverlay dropAnimation={{ duration: 180, easing: "ease-out" }}>
          {activeDeal && (
            <DealCard
              deal={activeDeal}
              kind={stageById[activeDeal.stage_id]?.kind ?? "open"}
              locale={locale}
              today={today}
              t={t}
              lifted
            />
          )}
        </DragOverlay>
      </DndContext>

      {dialog && (
        <DealDialog
          key={dialog.mode === "edit" ? dialog.deal.id : `new-${dialog.stageId}`}
          deal={dialog.mode === "edit" ? dialog.deal : null}
          defaultStageId={dialog.mode === "new" ? dialog.stageId : dialog.deal.stage_id}
          stages={stages.map((s) => ({ id: s.id, label: stageLabel(s) }))}
          contacts={contacts}
          t={t}
          onClose={() => setDialog(null)}
        />
      )}
    </>
  );
}

function Column({
  stage,
  label,
  ids,
  dealMap,
  locale,
  today,
  t,
  onOpen,
  onCreate,
}: {
  stage: BoardStage;
  label: string;
  ids: string[];
  dealMap: DealMap;
  locale: Locale;
  today: string;
  t: Dictionary["deals"];
  onOpen: (deal: BoardDeal) => void;
  onCreate: () => void;
}) {
  const { setNodeRef, isOver } = useDroppable({ id: stage.id });
  const total = ids.reduce((sum, id) => sum + dealMap[id].amount, 0);
  const currency = ids.length ? dealMap[ids[0]].currency : "ILS";
  const headingId = `stage-${stage.id}`;

  return (
    <section
      aria-labelledby={headingId}
      className={`flex w-72 shrink-0 snap-start flex-col rounded-xl transition-colors ${
        isOver ? "bg-brand-soft" : "bg-line/40"
      }`}
    >
      <header className="px-3 pt-3 pb-2">
        <div className="flex items-center justify-between gap-2">
          <h2 id={headingId} className="font-semibold">
            {label}
          </h2>
          <div className="flex items-center gap-1">
            <span className="rounded-full bg-surface px-2 py-0.5 text-xs font-medium text-muted tabular-nums">
              {ids.length}
            </span>
            {stage.kind === "open" && (
              <button
                type="button"
                onClick={onCreate}
                aria-label={format(t.newIn, { stage: label })}
                className="rounded-md p-1 text-muted hover:bg-surface hover:text-ink"
              >
                <svg viewBox="0 0 20 20" className="size-4" aria-hidden="true">
                  <path d="M10 4v12M4 10h12" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" />
                </svg>
              </button>
            )}
          </div>
        </div>

        <p
          className={`mt-1 text-xl font-semibold tabular-nums ${
            stage.kind === "won" ? "text-brand" : stage.kind === "lost" ? "text-muted" : ""
          }`}
          suppressHydrationWarning
        >
          {formatMoney(total, currency, locale)}
        </p>

        {stage.kind === "open" ? (
          <div className="mt-2 flex items-center gap-2 text-xs text-muted">
            {/* The bar is the stage's chance of closing — the weight it carries in the forecast. */}
            <span className="h-1 flex-1 overflow-hidden rounded-full bg-surface" aria-hidden="true">
              <span className="block h-full rounded-full bg-brand" style={{ width: `${stage.probability}%` }} />
            </span>
            {format(t.chance, { p: stage.probability })}
          </div>
        ) : (
          <p className="mt-2 text-xs text-muted">{t.closedWindow}</p>
        )}
      </header>

      <SortableContext id={stage.id} items={ids} strategy={verticalListSortingStrategy}>
        <ul ref={setNodeRef} className="flex min-h-28 flex-1 flex-col gap-2 px-2 pb-2">
          {ids.map((id) => (
            <SortableDeal
              key={id}
              deal={dealMap[id]}
              kind={stage.kind}
              locale={locale}
              today={today}
              t={t}
              onOpen={() => onOpen(dealMap[id])}
            />
          ))}
          {ids.length === 0 && (
            <li className="rounded-lg border border-dashed border-line px-3 py-6 text-center text-sm text-muted">
              {t.emptyColumn}
            </li>
          )}
        </ul>
      </SortableContext>
    </section>
  );
}

function SortableDeal({
  deal,
  kind,
  locale,
  today,
  t,
  onOpen,
}: {
  deal: BoardDeal;
  kind: BoardStage["kind"];
  locale: Locale;
  today: string;
  t: Dictionary["deals"];
  onOpen: () => void;
}) {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({ id: deal.id });
  const on = listeners as Partial<{
    onMouseDown: MouseEventHandler;
    onTouchStart: TouchEventHandler;
    onKeyDown: KeyboardEventHandler;
  }> | undefined;

  // Mouse and touch can grab the whole card; the keyboard uses the handle, so Enter on the
  // title still opens the deal instead of picking it up.
  return (
    <li
      ref={setNodeRef}
      style={{ transform: CSS.Translate.toString(transform), transition }}
      onMouseDown={on?.onMouseDown}
      onTouchStart={on?.onTouchStart}
      className={`cursor-grab active:cursor-grabbing ${isDragging ? "opacity-40" : ""}`}
    >
      <DealCard
        deal={deal}
        kind={kind}
        locale={locale}
        today={today}
        t={t}
        onOpen={onOpen}
        handle={
          <button
            type="button"
            {...attributes}
            onKeyDown={on?.onKeyDown}
            aria-label={format(t.move, { title: deal.title })}
            className="-me-1 rounded p-1 text-muted hover:bg-paper hover:text-ink"
          >
            <GripIcon />
          </button>
        }
      />
    </li>
  );
}
