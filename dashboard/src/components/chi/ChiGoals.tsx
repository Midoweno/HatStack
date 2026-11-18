import { useEffect, useMemo, useState, type CSSProperties } from "react";
import {
  DndContext,
  DragOverlay,
  PointerSensor,
  closestCorners,
  useDroppable,
  useSensor,
  useSensors,
  type CollisionDetection,
  type DragEndEvent,
  type DragOverEvent,
  type DragStartEvent,
} from "@dnd-kit/core";
import {
  SortableContext,
  arrayMove,
  useSortable,
  verticalListSortingStrategy,
} from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";
import { differenceInCalendarDays, format, parseISO } from "date-fns";
import { Check, GripVertical, Pencil, Plus } from "lucide-react";
import { toast } from "sonner";
import { URGENCY_META, type Project, type Task } from "@/lib/dashboard-types";
import { useDashboard } from "@/lib/dashboard-store";
import { goalCurrent, isGoalAchieved } from "@/lib/chi-stats";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { TaskItem } from "@/components/dashboard/TaskItem";
import { cn } from "@/lib/utils";
import { Enso } from "./Enso";

interface Props {
  tasks: Task[];
  projects: Project[];
  onNewTask: (goalId?: string) => void;
  onEditTask: (task: Task) => void;
  onNewGoal: (passion?: string) => void;
  onEditGoal: (goal: Project) => void;
}

const UNSORTED = "Unsorted";
const LOOSE = "loose";

// Drag ids: tasks use their plain id; the other droppables are prefixed so
// the collision logic can tell them apart (task ids never contain a colon).
const goalDragId = (id: string) => `goal:${id}`;
const zoneId = (id: string) => `zone:${id}`;
const passionId = (key: string) => `passion:${key}`;
const isTaskDragId = (id: string) => !id.includes(":");

// Everything is held as ordered id lists, like the Priority view, so a card
// can follow the pointer between lists while dragging and only save on drop.
interface Layout {
  passions: string[];
  goals: Record<string, string[]>; // passion -> goal ids
  tasks: Record<string, string[]>; // goal id (or LOOSE) -> open task ids
}

// Manual order first (lower first); anything without one sorts after, by date.
function byManualOrder<T extends { sortOrder?: number; createdAt: number }>(a: T, b: T) {
  if (a.sortOrder !== undefined && b.sortOrder !== undefined) return a.sortOrder - b.sortOrder;
  if (a.sortOrder !== undefined) return -1;
  if (b.sortOrder !== undefined) return 1;
  return a.createdAt - b.createdAt;
}

function byTaskOrder(a: Task, b: Task) {
  if (a.sortOrder !== undefined || b.sortOrder !== undefined) return byManualOrder(a, b);
  if (a.dueDate && b.dueDate && a.dueDate !== b.dueDate) return a.dueDate < b.dueDate ? -1 : 1;
  if (a.dueDate && !b.dueDate) return -1;
  if (!a.dueDate && b.dueDate) return 1;
  return a.createdAt - b.createdAt;
}

function buildLayout(goals: Project[], chiTasks: Task[], knownGoalIds: Set<string>): Layout {
  const byPassion = new Map<string, Project[]>();
  for (const g of goals) {
    const key = g.passion?.trim() || UNSORTED;
    byPassion.set(key, [...(byPassion.get(key) ?? []), g]);
  }
  const passions = [...byPassion.keys()].sort((a, b) =>
    a === UNSORTED ? 1 : b === UNSORTED ? -1 : a.localeCompare(b, undefined, { sensitivity: "base" }),
  );
  const goalLists: Record<string, string[]> = {};
  for (const p of passions) goalLists[p] = byPassion.get(p)!.sort(byManualOrder).map((g) => g.id);

  const taskLists: Record<string, string[]> = { [LOOSE]: [] };
  for (const g of goals) taskLists[g.id] = [];
  for (const t of chiTasks.filter((t) => !t.completed).sort(byTaskOrder)) {
    if (t.projectId && taskLists[t.projectId]) taskLists[t.projectId].push(t.id);
    // A task is only "loose" if it has no goal at all — tasks of an achieved
    // goal stay tucked away with it.
    else if (!t.projectId || !knownGoalIds.has(t.projectId)) taskLists[LOOSE].push(t.id);
  }
  return { passions, goals: goalLists, tasks: taskLists };
}

const containerOfTask = (l: Layout, id: string) =>
  Object.keys(l.tasks).find((k) => l.tasks[k].includes(id));
const passionOfGoal = (l: Layout, id: string) => l.passions.find((p) => l.goals[p].includes(id));

function targetLabel(dueDate: string | undefined) {
  if (!dueDate) return "No target date";
  const days = differenceInCalendarDays(parseISO(dueDate), new Date());
  const when =
    days > 1 ? `${days} days left` : days === 1 ? "tomorrow" : days === 0 ? "today" : `${-days}d past`;
  return `By ${format(parseISO(dueDate), "MMM d")} · ${when}`;
}

// While a task is dragged, only task rows and goal drop-zones can be targets;
// while a goal is dragged, only goals and passion sections.
const collisionDetection: CollisionDetection = (args) => {
  const goalDrag = String(args.active.id).startsWith("goal:");
  const droppableContainers = args.droppableContainers.filter((c) => {
    const id = String(c.id);
    const goalLevel = id.startsWith("goal:") || id.startsWith("passion:");
    return goalDrag ? goalLevel : !goalLevel;
  });
  return closestCorners({ ...args, droppableContainers });
};

export function ChiGoals({ tasks, projects, onNewTask, onEditTask, onNewGoal, onEditGoal }: Props) {
  const reorderTasks = useDashboard((s) => s.reorderTasks);
  const reorderGoals = useDashboard((s) => s.reorderGoals);

  // Achieved goals live in the Achievements tab, not here.
  const goals = projects.filter((p) => p.space === "chi" && !p.completed);
  const chiTasks = tasks.filter((t) => t.space === "chi" && !t.parentTaskId);
  const goalById = new Map(goals.map((g) => [g.id, g]));
  const taskById = new Map(chiTasks.map((t) => [t.id, t]));

  const storeLayout = useMemo(() => {
    const known = new Set(projects.filter((p) => p.space === "chi").map((p) => p.id));
    return buildLayout(
      projects.filter((p) => p.space === "chi" && !p.completed),
      tasks.filter((t) => t.space === "chi" && !t.parentTaskId),
      known,
    );
  }, [tasks, projects]);

  // Local live copy, resynced from the store except mid-drag.
  const [layout, setLayout] = useState<Layout>(storeLayout);
  const [active, setActive] = useState<{ kind: "task" | "goal"; id: string } | null>(null);
  useEffect(() => {
    if (!active) setLayout(storeLayout);
  }, [storeLayout, active]);

  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { delay: 200, tolerance: 8 } }),
  );

  const onDragStart = (e: DragStartEvent) => {
    const id = String(e.active.id);
    setActive(
      id.startsWith("goal:") ? { kind: "goal", id: id.slice(5) } : { kind: "task", id },
    );
  };

  const onDragOver = (e: DragOverEvent) => {
    const { active: a, over } = e;
    if (!over) return;
    const activeId = String(a.id);
    const overId = String(over.id);
    if (activeId === overId) return;

    if (activeId.startsWith("goal:")) {
      const gid = activeId.slice(5);
      const from = passionOfGoal(layout, gid);
      const to = overId.startsWith("passion:")
        ? overId.slice(8)
        : overId.startsWith("goal:")
          ? passionOfGoal(layout, overId.slice(5))
          : undefined;
      if (!from || !to || from === to || !layout.goals[to]) return;
      setLayout((prev) => {
        const toIds = [...prev.goals[to]];
        const at = toIds.indexOf(overId.slice(5));
        toIds.splice(at === -1 ? toIds.length : at, 0, gid);
        return {
          ...prev,
          goals: { ...prev.goals, [from]: prev.goals[from].filter((id) => id !== gid), [to]: toIds },
        };
      });
      return;
    }

    const from = containerOfTask(layout, activeId);
    const to = overId.startsWith("zone:")
      ? overId.slice(5)
      : isTaskDragId(overId)
        ? containerOfTask(layout, overId)
        : undefined;
    if (!from || !to || from === to || !layout.tasks[to]) return;
    setLayout((prev) => {
      const toIds = [...prev.tasks[to]];
      const at = toIds.indexOf(overId);
      toIds.splice(at === -1 ? toIds.length : at, 0, activeId);
      return {
        ...prev,
        tasks: { ...prev.tasks, [from]: prev.tasks[from].filter((id) => id !== activeId), [to]: toIds },
      };
    });
  };

  const onDragEnd = (e: DragEndEvent) => {
    setActive(null);
    const { active: a, over } = e;
    if (!over) return;
    const activeId = String(a.id);
    const overId = String(over.id);

    if (activeId.startsWith("goal:")) {
      const gid = activeId.slice(5);
      const passion = passionOfGoal(layout, gid);
      if (!passion) return;
      let ids = layout.goals[passion];
      if (overId.startsWith("goal:") && overId !== activeId && passionOfGoal(layout, overId.slice(5)) === passion) {
        const oldIndex = ids.indexOf(gid);
        const newIndex = ids.indexOf(overId.slice(5));
        if (oldIndex !== -1 && newIndex !== -1 && oldIndex !== newIndex) {
          ids = arrayMove(ids, oldIndex, newIndex);
          setLayout((prev) => ({ ...prev, goals: { ...prev.goals, [passion]: ids } }));
        }
      }
      reorderGoals(passion === UNSORTED ? undefined : passion, ids);
      return;
    }

    const container = containerOfTask(layout, activeId);
    if (!container) return;
    let ids = layout.tasks[container];
    if (isTaskDragId(overId) && overId !== activeId && containerOfTask(layout, overId) === container) {
      const oldIndex = ids.indexOf(activeId);
      const newIndex = ids.indexOf(overId);
      if (oldIndex !== -1 && newIndex !== -1 && oldIndex !== newIndex) {
        ids = arrayMove(ids, oldIndex, newIndex);
        setLayout((prev) => ({ ...prev, tasks: { ...prev.tasks, [container]: ids } }));
      }
    }
    reorderTasks(container === LOOSE ? null : container, ids);
  };

  const looseIds = layout.tasks[LOOSE] ?? [];
  const nothingToShow = goals.length === 0 && looseIds.length === 0;

  if (nothingToShow && !active) {
    return (
      <div className="flex flex-col items-center rounded-3xl border border-dashed border-hairline-strong px-6 py-20 text-center">
        <Enso className="h-20 w-20 text-chi" strokeWidth={1.6} />
        <h3 className="mt-6 font-display text-3xl text-ink">Start with a goal</h3>
        <p className="mt-2 max-w-xs text-sm text-ink-soft">
          Name what you want to make real, then break it into tasks. Every finished task becomes
          visible progress.
        </p>
        <Button className="mt-6 bg-chi text-white hover:bg-chi/90" onClick={() => onNewGoal()}>
          <Plus className="mr-1.5 h-4 w-4" /> New goal
        </Button>
      </div>
    );
  }

  const activeTask = active?.kind === "task" ? taskById.get(active.id) : undefined;
  const activeGoal = active?.kind === "goal" ? goalById.get(active.id) : undefined;

  return (
    <DndContext
      sensors={sensors}
      collisionDetection={collisionDetection}
      onDragStart={onDragStart}
      onDragOver={onDragOver}
      onDragEnd={onDragEnd}
      onDragCancel={() => setActive(null)}
    >
      <div className="space-y-9">
        <div className="flex items-center justify-between gap-3">
          <p className="hidden text-xs text-ink-faint sm:block">
            Press and hold to drag goals and tasks into the order you want.
          </p>
          <Button
            variant="outline"
            size="sm"
            className="ml-auto border-chi/40 text-chi hover:bg-chi-soft hover:text-chi"
            onClick={() => onNewGoal()}
          >
            <Plus className="mr-1 h-4 w-4" /> New goal
          </Button>
        </div>

        {layout.passions.map((passion) => {
          const ids = layout.goals[passion] ?? [];
          if (ids.length === 0 && active?.kind !== "goal") return null;
          return (
            <PassionSection key={passion} passion={passion} goalIds={ids}>
              {ids.map((gid) => {
                const goal = goalById.get(gid);
                if (!goal) return null;
                return (
                  <GoalCard
                    key={gid}
                    goal={goal}
                    taskIds={layout.tasks[gid] ?? []}
                    taskById={taskById}
                    allTasks={chiTasks.filter((t) => t.projectId === gid)}
                    onNewTask={onNewTask}
                    onEditTask={onEditTask}
                    onEditGoal={onEditGoal}
                  />
                );
              })}
            </PassionSection>
          );
        })}

        {(looseIds.length > 0 || active?.kind === "task") && (
          <LooseSection
            ids={looseIds}
            taskById={taskById}
            onEditTask={onEditTask}
            onNewTask={onNewTask}
          />
        )}
      </div>

      <DragOverlay>
        {activeTask && (
          <div
            className={cn(
              "flex items-center rounded-full px-4 py-2 shadow-lg",
              URGENCY_META[activeTask.urgency].dot,
              URGENCY_META[activeTask.urgency].pillText,
            )}
          >
            <p className="text-sm leading-snug">{activeTask.name}</p>
          </div>
        )}
        {activeGoal && (
          <div className="rounded-2xl border border-chi/50 bg-surface px-5 py-4 shadow-lg">
            <p className="font-display text-xl text-ink">{activeGoal.name}</p>
          </div>
        )}
      </DragOverlay>
    </DndContext>
  );
}

function PassionSection({
  passion,
  goalIds,
  children,
}: {
  passion: string;
  goalIds: string[];
  children: React.ReactNode;
}) {
  const { setNodeRef } = useDroppable({ id: passionId(passion) });
  return (
    <section ref={setNodeRef}>
      <h3 className="mb-3 px-1 text-[11px] font-semibold uppercase tracking-[0.2em] text-chi">
        {passion}
      </h3>
      <SortableContext items={goalIds.map(goalDragId)} strategy={verticalListSortingStrategy}>
        <div className="min-h-12 space-y-4">{children}</div>
      </SortableContext>
    </section>
  );
}

function LooseSection({
  ids,
  taskById,
  onEditTask,
  onNewTask,
}: {
  ids: string[];
  taskById: Map<string, Task>;
  onEditTask: (task: Task) => void;
  onNewTask: (goalId?: string) => void;
}) {
  const { setNodeRef, isOver } = useDroppable({ id: zoneId(LOOSE) });
  return (
    <section>
      <h3 className="mb-3 px-1 text-[11px] font-semibold uppercase tracking-[0.2em] text-ink-faint">
        Loose tasks
      </h3>
      <div
        ref={setNodeRef}
        className={cn(
          "min-h-16 rounded-2xl border border-hairline-strong bg-surface p-3 transition-colors",
          isOver && "border-chi/50 bg-chi-soft/40",
        )}
      >
        <SortableContext items={ids} strategy={verticalListSortingStrategy}>
          {ids.map((id) => {
            const t = taskById.get(id);
            return t ? <TaskItem key={id} task={t} onEdit={onEditTask} dragMode="sortable" chi /> : null;
          })}
        </SortableContext>
        <AddTaskButton onClick={() => onNewTask(undefined)} />
      </div>
    </section>
  );
}

function AddTaskButton({ onClick }: { onClick: () => void }) {
  return (
    <button
      type="button"
      onClick={onClick}
      className="mt-1 flex w-full items-center justify-center gap-1.5 rounded-lg py-2 text-xs text-ink-faint transition-colors hover:bg-chi-soft hover:text-chi"
    >
      <Plus className="h-3.5 w-3.5" /> Add task
    </button>
  );
}

function GoalCard({
  goal,
  taskIds,
  taskById,
  allTasks,
  onNewTask,
  onEditTask,
  onEditGoal,
}: {
  goal: Project;
  taskIds: string[];
  taskById: Map<string, Task>;
  allTasks: Task[];
  onNewTask: (goalId?: string) => void;
  onEditTask: (task: Task) => void;
  onEditGoal: (goal: Project) => void;
}) {
  const logProgress = useDashboard((s) => s.logProgress);
  const removeProgress = useDashboard((s) => s.removeProgress);
  const completeProject = useDashboard((s) => s.completeProject);
  const uncompleteProject = useDashboard((s) => s.uncompleteProject);
  const [logging, setLogging] = useState(false);
  const [amount, setAmount] = useState("");

  const {
    attributes,
    listeners,
    setNodeRef,
    setActivatorNodeRef,
    transform,
    transition,
    isDragging,
  } = useSortable({ id: goalDragId(goal.id) });
  const { setNodeRef: setZoneRef, isOver } = useDroppable({ id: zoneId(goal.id) });
  const style: CSSProperties = { transform: CSS.Transform.toString(transform), transition };

  const done = allTasks.filter((t) => t.completed).length;
  const total = allTasks.length;
  const hasTarget = !!goal.target && goal.target > 0;
  const current = goalCurrent(goal);
  const pct = hasTarget
    ? Math.min(100, Math.round((current / goal.target!) * 100))
    : total > 0
      ? Math.round((done / total) * 100)
      : 0;
  const achieved = isGoalAchieved(goal, allTasks);
  const unit = goal.unit ? ` ${goal.unit}` : "";
  const todayKey = format(new Date(), "yyyy-MM-dd");
  const loggedToday = (goal.progress ?? [])
    .filter((e) => e.date === todayKey)
    .reduce((sum, e) => sum + e.amount, 0);

  const submitLog = () => {
    const n = Number(amount);
    if (!(n > 0)) return;
    const entryId = logProgress(goal.id, n);
    toast(`Logged +${n}${unit} toward "${goal.name}"`, {
      action: { label: "Undo", onClick: () => removeProgress(goal.id, entryId) },
      duration: 4000,
    });
    setAmount("");
    setLogging(false);
  };

  return (
    <article
      ref={setNodeRef}
      style={style}
      className={cn(
        "group/goal rounded-2xl border bg-surface p-4 sm:p-5",
        achieved ? "border-chi/50 bg-chi-soft/50" : "border-hairline-strong",
        isDragging && "opacity-40",
      )}
    >
      <header className="flex items-start justify-between gap-3">
        <div className="flex min-w-0 items-start gap-2">
          <button
            type="button"
            ref={setActivatorNodeRef}
            {...attributes}
            {...listeners}
            aria-label="Drag goal"
            className="mt-1.5 shrink-0 cursor-grab touch-none rounded p-0.5 text-ink-faint opacity-100 hover:text-ink active:cursor-grabbing sm:opacity-0 sm:group-hover/goal:opacity-100"
          >
            <GripVertical className="h-4 w-4" />
          </button>
          <div className="min-w-0">
            <h4 className="font-display text-2xl leading-tight text-ink">{goal.name}</h4>
            {goal.description && (
              <p className="mt-1 text-sm italic text-ink-soft">{goal.description}</p>
            )}
          </div>
        </div>
        <div className="flex shrink-0 items-center gap-1">
          {achieved && (
            <span className="inline-flex items-center gap-1 rounded-full bg-chi px-2 py-0.5 text-[10px] font-bold uppercase tracking-wide text-white">
              <Check className="h-3 w-3" /> Done
            </span>
          )}
          <button
            type="button"
            onClick={() => onEditGoal(goal)}
            aria-label="Edit goal"
            className="rounded-md p-1.5 text-ink-faint opacity-100 transition-opacity hover:text-ink sm:opacity-0 sm:group-hover/goal:opacity-100"
          >
            <Pencil className="h-3.5 w-3.5" />
          </button>
        </div>
      </header>

      <div className="mt-3 flex items-center justify-between text-xs text-ink-faint">
        <span>{targetLabel(goal.dueDate)}</span>
        <span className="tabular-nums">
          {hasTarget ? `${current} / ${goal.target}${unit}` : `${done} / ${total}`}
        </span>
      </div>
      <div className="mt-1.5 h-1 overflow-hidden rounded-full bg-hairline">
        <div
          className="h-full rounded-full bg-chi transition-all duration-700"
          style={{ width: `${pct}%` }}
        />
      </div>

      {achieved && (
        <button
          type="button"
          onClick={() => completeProject(goal.id)}
          className="mt-3 w-full rounded-lg bg-chi py-2 text-xs font-semibold text-white transition-opacity hover:opacity-90"
        >
          Move to Achievements
        </button>
      )}

      {hasTarget && !achieved && (
        <div className="mt-3">
          {logging ? (
            <div className="flex items-center gap-2">
              <Input
                type="number"
                min={1}
                autoFocus
                value={amount}
                onChange={(e) => setAmount(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === "Enter") {
                    e.preventDefault();
                    submitLog();
                  } else if (e.key === "Escape") {
                    setLogging(false);
                  }
                }}
                placeholder={goal.unit ? `How many ${goal.unit}?` : "How many?"}
                className="h-8 w-40 text-sm"
              />
              <Button size="sm" className="bg-chi text-white hover:bg-chi/90" onClick={submitLog}>
                Log
              </Button>
              <Button variant="ghost" size="sm" onClick={() => setLogging(false)}>
                Cancel
              </Button>
            </div>
          ) : (
            <div className="flex items-center justify-between">
              <button
                type="button"
                onClick={() => setLogging(true)}
                className="inline-flex items-center gap-1 text-xs font-medium text-chi hover:underline"
              >
                <Plus className="h-3.5 w-3.5" /> Log progress
              </button>
              {loggedToday > 0 && (
                <span className="text-[11px] text-ink-faint">
                  Today +{loggedToday}
                  {unit}
                </span>
              )}
            </div>
          )}
        </div>
      )}

      <div
        ref={setZoneRef}
        className={cn(
          "-mx-1 mt-3 min-h-14 rounded-xl px-1 transition-colors",
          isOver && "bg-chi-soft/60",
        )}
      >
        <SortableContext items={taskIds} strategy={verticalListSortingStrategy}>
          <div className="space-y-0.5">
            {taskIds.map((id) => {
              const t = taskById.get(id);
              return t ? (
                <TaskItem key={id} task={t} onEdit={onEditTask} dragMode="sortable" chi />
              ) : null;
            })}
          </div>
        </SortableContext>
        <div className="mt-1 flex items-center gap-1">
          <AddTaskButton onClick={() => onNewTask(goal.id)} />
          {!achieved && (
            <button
              type="button"
              onClick={() => {
                completeProject(goal.id);
                toast(`"${goal.name}" completed`, {
                  description: "Moved to Achievements.",
                  action: { label: "Undo", onClick: () => uncompleteProject(goal.id) },
                  duration: 6000,
                });
              }}
              className="mt-1 flex w-full items-center justify-center gap-1.5 rounded-lg py-2 text-xs text-ink-faint transition-colors hover:bg-chi-soft hover:text-chi"
            >
              <Check className="h-3.5 w-3.5" /> Complete goal
            </button>
          )}
        </div>
      </div>
    </article>
  );
}
