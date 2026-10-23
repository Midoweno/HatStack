import { useEffect, useMemo, useState } from "react";
import {
  DndContext,
  DragOverlay,
  PointerSensor,
  closestCorners,
  useDroppable,
  useSensor,
  useSensors,
  type DragEndEvent,
  type DragOverEvent,
  type DragStartEvent,
} from "@dnd-kit/core";
import { SortableContext, arrayMove, verticalListSortingStrategy } from "@dnd-kit/sortable";
import type { Project, StarBucket, Task } from "@/lib/dashboard-types";
import { URGENCY_META } from "@/lib/dashboard-types";
import { useDashboard } from "@/lib/dashboard-store";
import { cn } from "@/lib/utils";
import { TaskItem } from "./TaskItem";

interface Props {
  tasks: Task[];
  projects: Project[];
  onEditTask: (t: Task) => void;
}

type Bucket = StarBucket;
type ColumnState = Record<Bucket, string[]>;

// "Default" is the Today / Priority / Future sections in their persisted drag
// order (starOrder). The other two merge everything into one list and are
// display-only; they never touch starOrder, so switching back to Default
// always restores exactly how things were left.
type SortMode = "default" | "dueDate" | "project";

const SORT_MODES: { id: SortMode; label: string }[] = [
  { id: "default", label: "Default" },
  { id: "dueDate", label: "Due date" },
  { id: "project", label: "Project" },
];

const COLUMNS: { id: Bucket; label: string; empty: string }[] = [
  {
    id: "today",
    label: "Today",
    empty: "Drag a task here from Priority or Future that you need to finish today.",
  },
  {
    id: "priority",
    label: "Priority",
    empty: "Drag a task here from Future when it's ready to act on.",
  },
  {
    id: "future",
    label: "Future",
    empty: "Newly starred tasks land here — drag into Priority when ready.",
  },
];

function bucketOf(t: Task): Bucket {
  if (t.starBucket === "future" || t.starBucket === "today") return t.starBucket;
  return "priority";
}


export function PriorityList({ tasks, projects, onEditTask }: Props) {
  const setStarredOrder = useDashboard((s) => s.setStarredOrder);
  const togglePin = useDashboard((s) => s.togglePin);
  const projectById = new Map(projects.map((p) => [p.id, p]));

  const pinnedTask = tasks.find((t) => t.pinned && !t.completed && !t.parentTaskId);

  const starredTasks = useMemo(
    () =>
      tasks
        .filter((t) => t.starred && !t.completed && !t.parentTaskId)
        .sort((a, b) => (b.starOrder ?? 0) - (a.starOrder ?? 0)),
    [tasks],
  );
  const taskById = new Map(starredTasks.map((t) => [t.id, t]));

  // Pinning a task moves it up into the Current card instead of also
  // leaving it in its Priority/Future column — it reappears there the
  // moment it's unpinned.
  const storeColumns: ColumnState = useMemo(
    () => ({
      today: starredTasks
        .filter((t) => !t.pinned && bucketOf(t) === "today")
        .map((t) => t.id),
      priority: starredTasks
        .filter((t) => !t.pinned && bucketOf(t) === "priority")
        .map((t) => t.id),
      future: starredTasks
        .filter((t) => !t.pinned && bucketOf(t) === "future")
        .map((t) => t.id),
    }),
    [starredTasks],
  );

  // Local, live copy of column order — dnd-kit needs this to update as the
  // user drags across columns (not just on drop) for the item to visually
  // follow between lists instead of only jumping at the end. Resynced from
  // the store whenever it changes, except mid-drag (activeId set), so a
  // drag-in-progress isn't clobbered by its own eventual persistence.
  const [columns, setColumns] = useState<ColumnState>(storeColumns);
  const [activeId, setActiveId] = useState<string | null>(null);
  const [sortMode, setSortMode] = useState<SortMode>("default");

  useEffect(() => {
    if (activeId) return;
    setColumns(storeColumns);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [storeColumns, activeId]);

  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { delay: 200, tolerance: 8 } }),
  );

  const findColumn = (id: string): Bucket | undefined => {
    if (id === "today-column") return "today";
    if (id === "priority-column") return "priority";
    if (id === "future-column") return "future";
    return (Object.keys(columns) as Bucket[]).find((b) => columns[b].includes(id));
  };

  const onDragStart = (e: DragStartEvent) => setActiveId(String(e.active.id));

  const onDragOver = (e: DragOverEvent) => {
    const { active, over } = e;
    if (!over) return;
    const activeId = String(active.id);
    const overId = String(over.id);
    if (activeId === overId) return;

    const fromCol = findColumn(activeId);
    const toCol = findColumn(overId);
    if (!fromCol || !toCol || fromCol === toCol) return;

    setColumns((prev) => {
      const fromIds = prev[fromCol].filter((id) => id !== activeId);
      const overIndex = prev[toCol].indexOf(overId);
      const toIds = [...prev[toCol]];
      toIds.splice(overIndex === -1 ? toIds.length : overIndex, 0, activeId);
      return { ...prev, [fromCol]: fromIds, [toCol]: toIds };
    });
  };

  const onDragEnd = (e: DragEndEvent) => {
    setActiveId(null);
    const { active, over } = e;
    if (!over) return;
    const activeId = String(active.id);
    const overId = String(over.id);

    const col = findColumn(activeId);
    if (!col) return;

    let finalIds = columns[col];
    if (activeId !== overId && findColumn(overId) === col) {
      const oldIndex = finalIds.indexOf(activeId);
      const newIndex = finalIds.indexOf(overId);
      if (oldIndex !== -1 && newIndex !== -1 && oldIndex !== newIndex) {
        finalIds = arrayMove(finalIds, oldIndex, newIndex);
        setColumns((prev) => ({ ...prev, [col]: finalIds }));
      }
    }

    setStarredOrder(col, finalIds);
  };

  const activeTask = activeId ? taskById.get(activeId) : null;
  const columnsEmpty =
    columns.today.length === 0 && columns.priority.length === 0 && columns.future.length === 0;

  return (
    <div className="mx-auto max-w-4xl space-y-5">
      <div className="flex justify-end">
        <div className="inline-flex rounded-full border border-hairline bg-surface p-0.5">
          {SORT_MODES.map((m) => (
            <button
              key={m.id}
              type="button"
              onClick={() => setSortMode(m.id)}
              className={cn(
                "rounded-full px-3.5 py-1.5 text-sm font-medium transition-colors",
                sortMode === m.id ? "bg-ink text-background" : "text-ink-faint hover:text-ink-soft",
              )}
            >
              {m.label}
            </button>
          ))}
        </div>
      </div>

      {pinnedTask && (
        <CurrentTaskCard
          task={pinnedTask}
          project={pinnedTask.projectId ? projectById.get(pinnedTask.projectId) : undefined}
          onEditTask={onEditTask}
          onUnpin={() => togglePin(pinnedTask.id)}
        />
      )}

      {columnsEmpty ? (
        <div className="rounded-2xl border border-dashed border-hairline px-6 py-16 text-center text-sm text-ink-faint">
          No starred tasks yet — hover a task in the Hats view and click the
          star to pin it here.
        </div>
      ) : sortMode === "default" ? (
        <DndContext
          sensors={sensors}
          collisionDetection={closestCorners}
          onDragStart={onDragStart}
          onDragOver={onDragOver}
          onDragEnd={onDragEnd}
          onDragCancel={() => setActiveId(null)}
        >
          {COLUMNS.map((col) => (
            <PriorityColumn
              key={col.id}
              id={col.id}
              label={col.label}
              emptyLabel={col.empty}
              ids={columns[col.id]}
              taskById={taskById}
              projectById={projectById}
              onEditTask={onEditTask}
            />
          ))}
          <DragOverlay>
            {activeTask && (
              <div
                className={cn(
                  "flex items-center rounded-full px-4 py-2 shadow-lg",
                  URGENCY_META[activeTask.urgency].dot,
                  URGENCY_META[activeTask.urgency].pillText,
                )}
              >
                <p className="text-base leading-snug">{activeTask.name}</p>
              </div>
            )}
          </DragOverlay>
        </DndContext>
      ) : sortMode === "project" ? (
        <ProjectGroupedCard
          taskIds={[...storeColumns.today, ...storeColumns.priority, ...storeColumns.future]}
          taskById={taskById}
          projectById={projectById}
          onEditTask={onEditTask}
        />
      ) : (
        <DueDateCard
          taskIds={[...storeColumns.today, ...storeColumns.priority, ...storeColumns.future]}
          taskById={taskById}
          projectById={projectById}
          onEditTask={onEditTask}
        />
      )}
    </div>
  );
}

// The Due date sort also drops the Today/Priority/Future split: one list,
// soonest first, tasks with no due date last. Ties keep their existing order.
function DueDateCard({
  taskIds,
  taskById,
  projectById,
  onEditTask,
}: {
  taskIds: string[];
  taskById: Map<string, Task>;
  projectById: Map<string, Project>;
  onEditTask: (t: Task) => void;
}) {
  const tasks = taskIds
    .map((id) => taskById.get(id))
    .filter((t): t is Task => !!t)
    .sort((a, b) => {
      if (!a.dueDate && !b.dueDate) return 0;
      if (!a.dueDate) return 1;
      if (!b.dueDate) return -1;
      return a.dueDate < b.dueDate ? -1 : a.dueDate > b.dueDate ? 1 : 0;
    });

  return (
    <div className="rounded-2xl border border-hairline-strong bg-surface">
      <header className="flex items-baseline justify-between border-b border-hairline px-4 pt-5 pb-4 sm:px-6 sm:pt-6 sm:pb-5">
        <h2 className="font-display text-2xl sm:text-3xl text-ink">By due date</h2>
        <span className="text-sm tabular-nums text-ink-faint">{tasks.length}</span>
      </header>
      <div className="space-y-1 p-2 sm:p-4">
        {tasks.map((t) => (
          <TaskItem
            key={t.id}
            task={t}
            project={t.projectId ? projectById.get(t.projectId) : undefined}
            onEdit={onEditTask}
            large
          />
        ))}
      </div>
    </div>
  );
}

// The Project sort drops the Today/Priority/Future split: everything starred
// merges into one list, grouped under a small header per project (A–Z, tasks
// with no project last). Within a project, tasks keep their existing order.
function ProjectGroupedCard({
  taskIds,
  taskById,
  projectById,
  onEditTask,
}: {
  taskIds: string[];
  taskById: Map<string, Task>;
  projectById: Map<string, Project>;
  onEditTask: (t: Task) => void;
}) {
  const tasks = taskIds.map((id) => taskById.get(id)).filter((t): t is Task => !!t);

  const byProject = new Map<string, Task[]>();
  const standalone: Task[] = [];
  for (const t of tasks) {
    if (t.projectId && projectById.has(t.projectId)) {
      byProject.set(t.projectId, [...(byProject.get(t.projectId) ?? []), t]);
    } else {
      standalone.push(t);
    }
  }
  const groups = [...byProject.entries()]
    .map(([projectId, items]) => ({
      key: projectId,
      name: projectById.get(projectId)?.name ?? "",
      items,
      muted: false,
    }))
    .sort((a, b) => a.name.localeCompare(b.name, undefined, { sensitivity: "base" }));
  if (standalone.length > 0) {
    groups.push({ key: "none", name: "No project", items: standalone, muted: true });
  }

  return (
    <div className="rounded-2xl border border-hairline-strong bg-surface">
      <header className="flex items-baseline justify-between border-b border-hairline px-4 pt-5 pb-4 sm:px-6 sm:pt-6 sm:pb-5">
        <h2 className="font-display text-2xl sm:text-3xl text-ink">By project</h2>
        <span className="text-sm tabular-nums text-ink-faint">{tasks.length}</span>
      </header>
      <div className="p-2 sm:p-4">
        {groups.map((g) => (
          <section key={g.key}>
            <div className="mb-1.5 mt-5 flex items-center gap-2 px-0.5 first:mt-1">
              <span
                className={cn(
                  "whitespace-nowrap text-xs uppercase tracking-[0.1em]",
                  g.muted ? "font-medium text-ink-faint" : "font-bold text-ink-soft",
                )}
              >
                {g.name}
              </span>
              <span className="text-xs tabular-nums text-ink-faint">{g.items.length}</span>
              <span className="h-px flex-1 bg-hairline" />
            </div>
            <div className="space-y-1">
              {g.items.map((t) => (
                // No project passed on purpose: the header already names it.
                <TaskItem key={t.id} task={t} onEdit={onEditTask} large />
              ))}
            </div>
          </section>
        ))}
      </div>
    </div>
  );
}

function CurrentTaskCard({
  task,
  project,
  onEditTask,
  onUnpin,
}: {
  task: Task;
  project?: Project;
  onEditTask: (t: Task) => void;
  onUnpin: () => void;
}) {
  return (
    <div className="overflow-hidden rounded-2xl border border-hairline-strong bg-surface">
      <header className="flex items-baseline justify-between bg-ink px-4 pt-4 pb-3 sm:px-6 sm:pt-5 sm:pb-4">
        <h2 className="font-display text-2xl sm:text-3xl text-background">Current</h2>
        <button
          type="button"
          onClick={onUnpin}
          className="text-sm text-background/60 transition-colors hover:text-background"
        >
          Clear
        </button>
      </header>
      <div className="p-2 sm:p-4">
        <TaskItem task={task} project={project} onEdit={onEditTask} large />
      </div>
    </div>
  );
}

function PriorityColumn({
  id,
  label,
  emptyLabel,
  ids,
  taskById,
  projectById,
  onEditTask,
}: {
  id: Bucket;
  label: string;
  emptyLabel: string;
  ids: string[];
  taskById: Map<string, Task>;
  projectById: Map<string, Project>;
  onEditTask: (t: Task) => void;
}) {
  const { setNodeRef, isOver } = useDroppable({ id: `${id}-column` });
  const items = ids.map((id) => taskById.get(id)).filter((t): t is Task => !!t);

  return (
    <div
      className={cn(
        "rounded-2xl border border-hairline-strong bg-surface transition-colors",
        isOver && "border-ink/30 bg-accent/40",
      )}
    >
      <header className="flex items-baseline justify-between border-b border-hairline px-4 pt-5 pb-4 sm:px-6 sm:pt-6 sm:pb-5">
        <h2 className="font-display text-2xl sm:text-3xl text-ink">{label}</h2>
        <span className="text-sm tabular-nums text-ink-faint">{items.length}</span>
      </header>
      <div ref={setNodeRef} className="min-h-[64px] p-2 sm:p-4">
        <SortableContext items={ids} strategy={verticalListSortingStrategy}>
          {items.length === 0 ? (
            <p className="px-2 py-4 text-center text-sm text-ink-faint">{emptyLabel}</p>
          ) : (
            <div className="space-y-1">
              {items.map((t) => (
                <TaskItem
                  key={t.id}
                  task={t}
                  project={t.projectId ? projectById.get(t.projectId) : undefined}
                  onEdit={onEditTask}
                  dragMode="sortable"
                  sectionBucket={id}
                  large
                />
              ))}
            </div>
          )}
        </SortableContext>
      </div>
    </div>
  );
}
