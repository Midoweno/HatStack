import { useEffect, useMemo, useRef, useState } from "react";
import { useDraggable } from "@dnd-kit/core";
import { useSortable } from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";
import { differenceInCalendarDays, format, isPast, isToday, parseISO } from "date-fns";
import {
  AlertTriangle,
  CheckCircle2,
  ChevronDown,
  ChevronUp,
  Clock,
  ListPlus,
  MoreHorizontal,
  Pin,
  Star,
  Trash2,
  X,
} from "lucide-react";
import { toast } from "sonner";
import type { DeadlineType, Project, StarBucket, Task } from "@/lib/dashboard-types";
import { DEADLINE_TYPES, HATS, URGENCY_META } from "@/lib/dashboard-types";
import { DEADLINE_ICONS } from "@/lib/deadline-icons";
import { useDashboard } from "@/lib/dashboard-store";
import { Checkbox } from "@/components/ui/checkbox";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { cn } from "@/lib/utils";

interface Props {
  task: Task;
  project?: Project;
  onEdit: (task: Task) => void;
  // "hat" drags the task between hat columns (default). "sortable" reorders
  // it within a single list (the Priority view).
  dragMode?: "hat" | "sortable";
  // When true, a completed task stays in place (e.g. ProjectTasksDialog,
  // which shows completed tasks with a strikethrough) instead of playing
  // the collapse-and-disappear animation.
  keepOnComplete?: boolean;
  // Renders ~25% bigger (Priority view only) — real sizing, not a CSS
  // zoom/transform, so dnd-kit's pointer math stays accurate while dragging.
  large?: boolean;
  // Which Priority-view section this row sits in; when set, the row shows
  // up/down arrows to move it to the neighbouring section.
  sectionBucket?: StarBucket;
}

const SECTION_ORDER: StarBucket[] = ["today", "priority", "future"];
const SECTION_LABELS: Record<StarBucket, string> = {
  today: "Today",
  priority: "Priority",
  future: "Future",
};

const COMPLETE_ANIMATION_MS = 450;
const COLLAPSE_ANIMATION_MS = 260;

function dueInfo(dueDate: string | undefined) {
  const due = dueDate ? parseISO(dueDate) : null;
  const days = due ? differenceInCalendarDays(due, new Date()) : null;
  const overdue = due ? isPast(due) && !isToday(due) : false;
  const label = due
    ? isToday(due)
      ? "Today"
      : (() => {
          const days = Math.abs(differenceInCalendarDays(due, new Date()));
          const unit = days === 1 ? "day" : "days";
          return overdue ? `${days} ${unit} overdue` : `In ${days} ${unit}`;
        })()
    : null;
  return { due, days, overdue, label };
}

// Chip tiers: overdue and today are filled, 1–3 days out is outlined, and
// anything further out gets no chip at all.
function dueChipFor(days: number | null, completed: boolean) {
  if (completed || days === null) return null;
  if (days < 0) {
    const n = -days;
    return { kind: "overdue" as const, text: `${n} ${n === 1 ? "DAY" : "DAYS"} LATE` };
  }
  if (days === 0) return { kind: "today" as const, text: "TODAY" };
  if (days <= 3) {
    return { kind: "soon" as const, text: days === 1 ? "TOMORROW" : `IN ${days} DAYS` };
  }
  return null;
}

function DueChipBadge({
  chip,
  large,
  className,
}: {
  chip: NonNullable<ReturnType<typeof dueChipFor>>;
  large: boolean;
  className?: string;
}) {
  return (
    <span
      className={cn(
        "inline-flex shrink-0 items-center gap-1 whitespace-nowrap rounded-full px-2 py-0.5 text-[10px] font-bold tracking-wide",
        large && "px-2.5 text-xs",
        chip.kind === "soon" && "border-[1.5px] border-ink py-px text-ink",
        chip.kind === "today" && "bg-ink text-background",
        chip.kind === "overdue" &&
          "mr-0.5 animate-due-pulse bg-ink text-background outline-2 outline-offset-2 outline-ink",
        className,
      )}
    >
      {chip.kind === "overdue" ? (
        <AlertTriangle className="h-2.5 w-2.5" />
      ) : (
        <Clock className="h-2.5 w-2.5" />
      )}
      {chip.text}
    </span>
  );
}

const TILE_STYLES = {
  far: "border-ink/40 bg-surface-elevated text-ink",
  soon: "border-2 border-ink bg-surface-elevated text-ink",
  today: "border-ink bg-ink text-background",
  overdue: "animate-due-pulse border-ink bg-ink text-background outline-2 outline-offset-2 outline-ink",
} as const;

// Large icon at the left of the row, about as tall as a task pill, showing
// which kind of deadline this is (exam / assignment / project).
function DeadlineBadge({ type }: { type: DeadlineType }) {
  const Icon = DEADLINE_ICONS[type];
  const label = DEADLINE_TYPES.find((d) => d.id === type)?.label ?? type;
  return (
    <div
      role="img"
      aria-label={label}
      title={label}
      className="flex h-7 w-7 shrink-0 items-center justify-center text-ink sm:h-10 sm:w-10"
    >
      <Icon className="h-6 w-6 sm:h-[34px] sm:w-[34px]" />
    </div>
  );
}

function DeadlineTile({
  tier,
  days,
  sub,
}: {
  tier: keyof typeof TILE_STYLES;
  days: number;
  sub: string;
}) {
  const big = tier === "today" ? "TODAY" : tier === "overdue" ? `−${-days}d` : `${days}d`;

  return (
    <div
      aria-label={`Deadline: ${big}`}
      className={cn(
        "w-[50px] shrink-0 rounded-lg border-[1.5px] px-0.5 py-1.5 text-center sm:w-[62px] sm:px-1",
        TILE_STYLES[tier],
      )}
    >
      <div
        className={cn("font-extrabold leading-none", tier === "today" ? "text-[11px]" : "text-[17px]")}
      >
        {big}
      </div>
      <span className="mt-1 block text-[9px] font-semibold leading-none opacity-70">{sub}</span>
    </div>
  );
}

export function TaskItem({
  task,
  project,
  onEdit,
  dragMode = "hat",
  keepOnComplete = false,
  large = false,
  sectionBucket,
}: Props) {
  const toggleTask = useDashboard((s) => s.toggleTask);
  const updateTask = useDashboard((s) => s.updateTask);
  const deleteTask = useDashboard((s) => s.deleteTask);
  const toggleStar = useDashboard((s) => s.toggleStar);
  const togglePin = useDashboard((s) => s.togglePin);
  const addTask = useDashboard((s) => s.addTask);
  const allTasks = useDashboard((s) => s.tasks);
  const u = URGENCY_META[task.urgency];

  const subtasks = useMemo(
    () => allTasks.filter((t) => t.parentTaskId === task.id),
    [allTasks, task.id],
  );

  const [phase, setPhase] = useState<"idle" | "checking" | "leaving">("idle");
  const [addingSubtask, setAddingSubtask] = useState(false);
  const [subtaskName, setSubtaskName] = useState("");
  const [subtaskDueDate, setSubtaskDueDate] = useState("");
  const [editingSubtaskDue, setEditingSubtaskDue] = useState<string | null>(null);
  const [editingSubtaskName, setEditingSubtaskName] = useState<string | null>(null);
  const [subtaskNameDraft, setSubtaskNameDraft] = useState("");

  const commitComplete = () => {
    toggleTask(task.id);
    toast(`"${task.name}" completed`, {
      action: {
        label: "Undo",
        onClick: () => toggleTask(task.id),
      },
      duration: 4000,
    });
    setPhase("idle");
  };

  const handleToggle = () => {
    if (task.completed) {
      toggleTask(task.id);
      return;
    }
    setPhase("checking");
  };

  useEffect(() => {
    if (phase !== "checking") return;
    const t = setTimeout(() => {
      if (keepOnComplete) commitComplete();
      else setPhase("leaving");
    }, COMPLETE_ANIMATION_MS);
    return () => clearTimeout(t);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [phase]);

  useEffect(() => {
    if (phase !== "leaving") return;
    const t = setTimeout(commitComplete, COLLAPSE_ANIMATION_MS);
    return () => clearTimeout(t);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [phase]);

  const hatDrag = useDraggable({
    id: `task-${task.id}`,
    data: { taskId: task.id },
    disabled: dragMode !== "hat",
  });
  const sortableDrag = useSortable({ id: task.id, disabled: dragMode !== "sortable" });

  const { attributes, listeners, setNodeRef, isDragging } =
    dragMode === "sortable" ? sortableDrag : hatDrag;

  const style =
    dragMode === "sortable"
      ? { transform: CSS.Transform.toString(sortableDrag.transform), transition: sortableDrag.transition }
      : hatDrag.transform
        ? { transform: `translate3d(${hatDrag.transform.x}px, ${hatDrag.transform.y}px, 0)` }
        : undefined;

  const { days, overdue, label: dueLabel } = dueInfo(task.dueDate);
  const dueChip = dueChipFor(days, task.completed);

  // Countdown tile for any task with a date (Priority view only). It counts
  // down to the recurrence end date for a typed task or a "daily until due"
  // series, and to the task's own due date otherwise.
  const rec = task.recurrence;
  const isDailyUntil = rec?.freq === "daily" && rec.interval === 1 && !!rec.until;
  const deadlineDate =
    task.deadlineType || isDailyUntil ? (rec?.until ?? task.dueDate) : task.dueDate;
  const deadlineDays = deadlineDate ? differenceInCalendarDays(parseISO(deadlineDate), new Date()) : null;
  const deadlineTier =
    deadlineDays === null
      ? null
      : deadlineDays < 0
        ? "overdue"
        : deadlineDays === 0
          ? "today"
          : deadlineDays <= 3
            ? "soon"
            : "far";
  // The icon needs a Type; the countdown tile only needs a date to count to.
  const showDeadlineIcon = large && !task.completed && !!task.deadlineType;
  const showDeadlineTile = large && !task.completed && deadlineTier !== null;
  const hatLabel = HATS.find((h) => h.id === task.hat)?.label;

  // Up/down arrows between the Today / Priority / Future sections (Default
  // sort only — the caller passes sectionBucket only there). A moved task
  // lands at the top of its new section.
  const sectionIndex = sectionBucket ? SECTION_ORDER.indexOf(sectionBucket) : -1;
  const moveUpTo = sectionIndex > 0 ? SECTION_ORDER[sectionIndex - 1] : null;
  const moveDownTo =
    sectionIndex >= 0 && sectionIndex < SECTION_ORDER.length - 1
      ? SECTION_ORDER[sectionIndex + 1]
      : null;
  const moveToSection = (bucket: StarBucket) =>
    updateTask(task.id, { starBucket: bucket, starOrder: Date.now() });

  // Guards against submitting twice: pressing Enter fires the form's submit,
  // which unmounts the input, which then fires its own blur — without this,
  // both handlers would try to add the same subtask.
  const subtaskSubmittedRef = useRef(false);

  const openAddSubtask = () => {
    subtaskSubmittedRef.current = false;
    setAddingSubtask(true);
  };

  const startEditSubtaskName = (st: Task) => {
    setEditingSubtaskName(st.id);
    setSubtaskNameDraft(st.name);
  };

  // Escape sets this so the blur that follows (closing the input) doesn't
  // also commit the draft text — Escape means discard, not save.
  const cancelingSubtaskNameRef = useRef(false);

  const commitSubtaskName = (id: string) => {
    if (cancelingSubtaskNameRef.current) {
      cancelingSubtaskNameRef.current = false;
      setEditingSubtaskName(null);
      return;
    }
    const trimmed = subtaskNameDraft.trim();
    if (trimmed) updateTask(id, { name: trimmed });
    setEditingSubtaskName(null);
  };

  const cancelEditSubtaskName = () => {
    cancelingSubtaskNameRef.current = true;
    setEditingSubtaskName(null);
  };

  const submitSubtask = () => {
    if (subtaskSubmittedRef.current) return;
    subtaskSubmittedRef.current = true;
    const name = subtaskName.trim();
    if (name) {
      addTask({
        hat: task.hat,
        urgency: task.urgency,
        name,
        dueDate: subtaskDueDate || undefined,
        parentTaskId: task.id,
      });
    }
    setSubtaskName("");
    setSubtaskDueDate("");
    setAddingSubtask(false);
  };

  return (
    <div
      className="grid min-w-0 transition-[grid-template-rows] duration-300 ease-in"
      style={{ gridTemplateRows: phase === "leaving" ? "0fr" : "1fr" }}
    >
      <div className={cn("min-w-0", phase === "leaving" ? "overflow-hidden" : "overflow-visible")}>
        <div
          ref={setNodeRef}
          style={style}
          onClick={() => onEdit(task)}
          {...attributes}
          {...listeners}
          className={cn(
            "group relative flex min-w-0 cursor-pointer items-center gap-2 rounded-md border border-transparent px-2 py-2 transition-colors hover:border-hairline hover:bg-surface-elevated active:cursor-grabbing",
            large && "gap-2 px-1.5 py-2 sm:gap-2.5 sm:px-2.5 sm:py-2.5",
            isDragging && "opacity-0",
            phase === "leaving" && "opacity-0 transition-opacity duration-200",
          )}
        >
          <div
            onClick={(e) => e.stopPropagation()}
            onPointerDown={(e) => e.stopPropagation()}
            className="shrink-0"
          >
            {phase === "idle" ? (
              <Checkbox
                checked={task.completed}
                onCheckedChange={handleToggle}
                className={cn(large && "h-5 w-5")}
              />
            ) : (
              <CheckCircle2
                className={cn(
                  "h-4 w-4 animate-in zoom-in-50 duration-300 text-green-500",
                  large && "h-5 w-5",
                )}
              />
            )}
          </div>

          {showDeadlineIcon && task.deadlineType && <DeadlineBadge type={task.deadlineType} />}

          <div
            className={cn(
              "min-w-0 flex-1 rounded-full px-3 py-1.5",
              large && "px-4 py-2",
              u.dot,
              u.pillText,
              task.completed && "opacity-50",
            )}
            aria-label={`${u.label} urgency`}
          >
            <div className="flex min-w-0 items-center justify-between gap-2">
              <p
                className={cn(
                  "min-w-0 flex-1 truncate text-sm leading-snug",
                  large && "text-base",
                  task.completed && "line-through",
                )}
              >
                {task.name}
              </p>
              {dueChip ? (
                // On phones the Priority view moves the chip under the name
                // (below) so the name keeps its room.
                <DueChipBadge chip={dueChip} large={large} className={large ? "hidden sm:inline-flex" : undefined} />
              ) : (
                hatLabel && (
                  <span
                    className={cn(
                      "shrink-0 text-[10px] uppercase tracking-wide opacity-70",
                      large && "text-xs",
                    )}
                  >
                    {hatLabel}
                  </span>
                )
              )}
            </div>
            {large && dueChip && (
              <div className="mt-1 sm:hidden">
                <DueChipBadge chip={dueChip} large />
              </div>
            )}
            {(project || dueLabel || (dueChip && hatLabel)) && (
              <div
                className={cn(
                  "mt-0.5 flex flex-wrap items-center gap-x-2 gap-y-0.5 text-[11px] opacity-80",
                  large && "text-xs",
                )}
              >
                {dueChip && hatLabel && (
                  <span className="uppercase tracking-wide">{hatLabel}</span>
                )}
                {dueChip && hatLabel && project && <span className="opacity-70">·</span>}
                {project && (
                  <span className="inline-flex items-center gap-1">
                    {project.icon && <span>{project.icon}</span>}
                    <span className="truncate">{project.name}</span>
                  </span>
                )}
                {!dueChip && project && dueLabel && <span className="opacity-70">·</span>}
                {!dueChip && dueLabel && (
                  <span className={cn(overdue && "font-semibold")}>{dueLabel}</span>
                )}
              </div>
            )}
          </div>

          {showDeadlineTile && deadlineTier && deadlineDays !== null && (
            <DeadlineTile
              tier={deadlineTier}
              days={deadlineDays}
              sub={
                deadlineDate && deadlineDate !== task.dueDate
                  ? format(parseISO(deadlineDate), "MMM d")
                  : deadlineTier === "overdue"
                    ? "late"
                    : "due"
              }
            />
          )}

          {sectionIndex >= 0 && (
            <div
              className="hidden shrink-0 flex-col overflow-hidden rounded-md border border-hairline bg-surface-elevated sm:flex sm:opacity-0 sm:group-hover:opacity-100"
              onClick={(e) => e.stopPropagation()}
              onPointerDown={(e) => e.stopPropagation()}
            >
              <button
                type="button"
                disabled={!moveUpTo}
                onClick={() => moveUpTo && moveToSection(moveUpTo)}
                title={moveUpTo ? `Move to ${SECTION_LABELS[moveUpTo]}` : undefined}
                aria-label={moveUpTo ? `Move to ${SECTION_LABELS[moveUpTo]}` : "Already in the top section"}
                className="flex h-5 w-7 items-center justify-center text-ink transition-colors hover:bg-accent disabled:cursor-default disabled:opacity-25 disabled:hover:bg-transparent"
              >
                <ChevronUp className="h-4 w-4" />
              </button>
              <button
                type="button"
                disabled={!moveDownTo}
                onClick={() => moveDownTo && moveToSection(moveDownTo)}
                title={moveDownTo ? `Move to ${SECTION_LABELS[moveDownTo]}` : undefined}
                aria-label={
                  moveDownTo ? `Move to ${SECTION_LABELS[moveDownTo]}` : "Already in the bottom section"
                }
                className="flex h-5 w-7 items-center justify-center border-t border-hairline text-ink transition-colors hover:bg-accent disabled:cursor-default disabled:opacity-25 disabled:hover:bg-transparent"
              >
                <ChevronDown className="h-4 w-4" />
              </button>
            </div>
          )}

          <Button
            variant="ghost"
            size="icon"
            className={cn(
              "h-6 w-6 shrink-0",
              // On phones the Priority view keeps just the ⋯ button; star,
              // pin and the move arrows live in its menu instead.
              large && "hidden h-7 w-7 sm:inline-flex",
              task.starred
                ? "text-amber-500 opacity-100"
                : "opacity-100 sm:opacity-0 sm:group-hover:opacity-100",
            )}
            onClick={(e) => {
              e.stopPropagation();
              toggleStar(task.id);
            }}
            onPointerDown={(e) => e.stopPropagation()}
            aria-label={task.starred ? "Remove from Priority view" : "Add to Priority view"}
          >
            <Star className={cn("h-3.5 w-3.5", large && "h-4 w-4", task.starred && "fill-current")} />
          </Button>

          <Button
            variant="ghost"
            size="icon"
            className={cn(
              "h-6 w-6 shrink-0",
              large && "hidden h-7 w-7 sm:inline-flex",
              task.pinned
                ? "text-blue-500 opacity-100"
                : "opacity-100 sm:opacity-0 sm:group-hover:opacity-100",
            )}
            onClick={(e) => {
              e.stopPropagation();
              togglePin(task.id);
            }}
            onPointerDown={(e) => e.stopPropagation()}
            aria-label={task.pinned ? "Unpin as current task" : "Pin as current task"}
          >
            <Pin className={cn("h-3.5 w-3.5", large && "h-4 w-4", task.pinned && "fill-current")} />
          </Button>

          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button
                variant="ghost"
                size="icon"
                className={cn(
                  "h-6 w-6 shrink-0 opacity-100 sm:opacity-0 sm:group-hover:opacity-100",
                  large && "h-7 w-7",
                )}
                onClick={(e) => e.stopPropagation()}
                onPointerDown={(e) => e.stopPropagation()}
              >
                <MoreHorizontal className={cn("h-3.5 w-3.5", large && "h-4 w-4")} />
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end" onClick={(e) => e.stopPropagation()}>
              {large && (
                <div className="sm:hidden">
                  {moveUpTo && (
                    <DropdownMenuItem onClick={() => moveToSection(moveUpTo)}>
                      <ChevronUp className="mr-2 h-4 w-4" /> Move to {SECTION_LABELS[moveUpTo]}
                    </DropdownMenuItem>
                  )}
                  {moveDownTo && (
                    <DropdownMenuItem onClick={() => moveToSection(moveDownTo)}>
                      <ChevronDown className="mr-2 h-4 w-4" /> Move to {SECTION_LABELS[moveDownTo]}
                    </DropdownMenuItem>
                  )}
                  <DropdownMenuItem onClick={() => togglePin(task.id)}>
                    <Pin className="mr-2 h-4 w-4" />
                    {task.pinned ? "Unpin as current task" : "Pin as current task"}
                  </DropdownMenuItem>
                  <DropdownMenuItem onClick={() => toggleStar(task.id)}>
                    <Star className="mr-2 h-4 w-4" />
                    {task.starred ? "Remove from Priority view" : "Add to Priority view"}
                  </DropdownMenuItem>
                  <DropdownMenuSeparator />
                </div>
              )}
              <DropdownMenuItem onClick={openAddSubtask}>
                <ListPlus className="mr-2 h-4 w-4" /> Add subtask
              </DropdownMenuItem>
              <DropdownMenuSeparator />
              <DropdownMenuItem
                className="text-destructive focus:text-destructive"
                onClick={() => deleteTask(task.id)}
              >
                <Trash2 className="mr-2 h-4 w-4" /> Delete
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        </div>

        {(subtasks.length > 0 || addingSubtask) && (
          <div
            onClick={(e) => e.stopPropagation()}
            className={cn("mb-1.5 ml-9 mr-2 space-y-1", large && "ml-10")}
          >
            {subtasks.map((st) => {
              const stDue = dueInfo(st.dueDate);
              return (
                <div
                  key={st.id}
                  className="group/subtask flex items-center gap-2 rounded px-1 py-0.5 hover:bg-surface-elevated"
                >
                  <Checkbox
                    checked={st.completed}
                    onCheckedChange={() => toggleTask(st.id)}
                    className={cn("h-3.5 w-3.5", large && "h-4 w-4")}
                  />
                  {editingSubtaskName === st.id ? (
                    <input
                      autoFocus
                      value={subtaskNameDraft}
                      onChange={(e) => setSubtaskNameDraft(e.target.value)}
                      onBlur={() => commitSubtaskName(st.id)}
                      onKeyDown={(e) => {
                        if (e.key === "Enter") {
                          e.preventDefault();
                          commitSubtaskName(st.id);
                        } else if (e.key === "Escape") {
                          e.preventDefault();
                          cancelEditSubtaskName();
                        } else if (e.key === "Tab" && !e.shiftKey) {
                          // Same rapid-add shortcut as the "add subtask" row:
                          // save this rename and open a fresh blank one.
                          e.preventDefault();
                          commitSubtaskName(st.id);
                          openAddSubtask();
                        }
                      }}
                      className="h-6 min-w-0 flex-1 rounded border border-hairline bg-transparent px-1 text-xs text-ink outline-none focus-visible:ring-1 focus-visible:ring-ring"
                    />
                  ) : (
                    <span
                      onClick={() => startEditSubtaskName(st)}
                      className={cn(
                        "min-w-0 flex-1 cursor-text truncate text-xs text-ink-soft",
                        st.completed && "text-ink-faint line-through",
                      )}
                    >
                      {st.name}
                    </span>
                  )}
                  {editingSubtaskDue === st.id ? (
                    <input
                      type="date"
                      autoFocus
                      defaultValue={st.dueDate ?? ""}
                      onChange={(e) => updateTask(st.id, { dueDate: e.target.value || undefined })}
                      onBlur={() => setEditingSubtaskDue(null)}
                      className="h-6 shrink-0 rounded border border-hairline bg-transparent px-1 text-[11px] text-ink outline-none focus-visible:ring-1 focus-visible:ring-ring"
                    />
                  ) : (
                    <button
                      onClick={() => setEditingSubtaskDue(st.id)}
                      className={cn(
                        "shrink-0 text-[11px]",
                        stDue.label
                          ? cn("text-ink-faint", stDue.overdue && "font-semibold text-urgency-critical")
                          : "text-ink-faint opacity-0 group-hover/subtask:opacity-100",
                      )}
                    >
                      {stDue.label ?? "+ due date"}
                    </button>
                  )}
                  <button
                    onClick={() => deleteTask(st.id)}
                    className="shrink-0 text-ink-faint/50 opacity-0 transition-opacity hover:text-destructive group-hover/subtask:opacity-100"
                    aria-label="Delete subtask"
                  >
                    <X className="h-3 w-3" />
                  </button>
                </div>
              );
            })}
            {addingSubtask && (
              <form
                onSubmit={(e) => {
                  e.preventDefault();
                  submitSubtask();
                }}
                onBlur={(e) => {
                  if (!e.currentTarget.contains(e.relatedTarget as Node | null)) {
                    submitSubtask();
                  }
                }}
                className="flex items-center gap-2 px-1"
              >
                <input
                  autoFocus
                  value={subtaskName}
                  onChange={(e) => setSubtaskName(e.target.value)}
                  onKeyDown={(e) => {
                    // Tab saves this subtask and immediately opens a fresh
                    // one, so you can rapid-fire several without reaching
                    // for the mouse or the "Add subtask" menu item again.
                    if (e.key === "Tab" && !e.shiftKey) {
                      e.preventDefault();
                      submitSubtask();
                      openAddSubtask();
                    }
                  }}
                  placeholder="Subtask name"
                  className="h-6 flex-1 rounded border border-hairline bg-transparent px-1.5 text-xs text-ink outline-none focus-visible:ring-1 focus-visible:ring-ring"
                />
                <input
                  type="date"
                  value={subtaskDueDate}
                  onChange={(e) => setSubtaskDueDate(e.target.value)}
                  className="h-6 shrink-0 rounded border border-hairline bg-transparent px-1 text-[11px] text-ink outline-none focus-visible:ring-1 focus-visible:ring-ring"
                />
              </form>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
