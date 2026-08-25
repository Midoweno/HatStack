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
import type { Project, Task } from "@/lib/dashboard-types";
import { URGENCY_META } from "@/lib/dashboard-types";
import { useDashboard } from "@/lib/dashboard-store";
import { cn } from "@/lib/utils";
import { TaskItem } from "./TaskItem";

interface Props {
  tasks: Task[];
  projects: Project[];
  onEditTask: (t: Task) => void;
}

type Bucket = "priority" | "future";
type ColumnState = Record<Bucket, string[]>;

const COLUMNS: { id: Bucket; label: string; empty: string }[] = [
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
  return t.starBucket === "future" ? "future" : "priority";
}

export function PriorityList({ tasks, projects, onEditTask }: Props) {
  const setStarredOrder = useDashboard((s) => s.setStarredOrder);
  const projectById = new Map(projects.map((p) => [p.id, p]));

  const starredTasks = useMemo(
    () =>
      tasks
        .filter((t) => t.starred && !t.completed && !t.parentTaskId)
        .sort((a, b) => (b.starOrder ?? 0) - (a.starOrder ?? 0)),
    [tasks],
  );
  const taskById = new Map(starredTasks.map((t) => [t.id, t]));

  const storeColumns: ColumnState = useMemo(
    () => ({
      priority: starredTasks.filter((t) => bucketOf(t) === "priority").map((t) => t.id),
      future: starredTasks.filter((t) => bucketOf(t) === "future").map((t) => t.id),
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

  useEffect(() => {
    if (activeId) return;
    setColumns(storeColumns);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [storeColumns, activeId]);

  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { delay: 200, tolerance: 8 } }),
  );

  const findColumn = (id: string): Bucket | undefined => {
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

  if (starredTasks.length === 0) {
    return (
      <div className="mx-auto max-w-xl rounded-2xl border border-dashed border-hairline px-6 py-16 text-center text-sm text-ink-faint">
        No starred tasks yet — hover a task in the Hats view and click the
        star to pin it here.
      </div>
    );
  }

  return (
    <div className="mx-auto max-w-xl space-y-5">
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
                "flex items-center rounded-full px-3 py-1.5 shadow-lg",
                URGENCY_META[activeTask.urgency].dot,
                URGENCY_META[activeTask.urgency].pillText,
              )}
            >
              <p className="text-sm leading-snug">{activeTask.name}</p>
            </div>
          )}
        </DragOverlay>
      </DndContext>
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
      <header className="flex items-baseline justify-between border-b border-hairline px-5 pt-5 pb-4">
        <h2 className="font-display text-2xl text-ink">{label}</h2>
        <span className="text-xs tabular-nums text-ink-faint">{items.length}</span>
      </header>
      <div ref={setNodeRef} className="min-h-[64px] p-3">
        <SortableContext items={ids} strategy={verticalListSortingStrategy}>
          {items.length === 0 ? (
            <p className="px-2 py-4 text-center text-xs text-ink-faint">{emptyLabel}</p>
          ) : (
            <div className="space-y-0.5">
              {items.map((t) => (
                <TaskItem
                  key={t.id}
                  task={t}
                  project={t.projectId ? projectById.get(t.projectId) : undefined}
                  onEdit={onEditTask}
                  dragMode="sortable"
                />
              ))}
            </div>
          )}
        </SortableContext>
      </div>
    </div>
  );
}
