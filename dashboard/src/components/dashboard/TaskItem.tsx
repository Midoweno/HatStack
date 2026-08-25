import { useEffect, useMemo, useRef, useState } from "react";
import { useDraggable } from "@dnd-kit/core";
import { useSortable } from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";
import { differenceInCalendarDays, isPast, isToday, parseISO } from "date-fns";
import { MoreHorizontal, Trash2, Star, CheckCircle2, ListPlus, X } from "lucide-react";
import { toast } from "sonner";
import type { Project, Task } from "@/lib/dashboard-types";
import { HATS, URGENCY_META } from "@/lib/dashboard-types";
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
}

const COMPLETE_ANIMATION_MS = 450;
const COLLAPSE_ANIMATION_MS = 260;

function dueInfo(dueDate: string | undefined) {
  const due = dueDate ? parseISO(dueDate) : null;
  const overdue = due ? isPast(due) && !isToday(due) : false;
  const label = due
    ? isToday(due)
      ? "Today"
      : (() => {
          const days = Math.abs(differenceInCalendarDays(due, new Date()));
          const unit = days === 1 ? "day" : "days";
          return overdue ? `${days} ${unit} overdue` : `${days} ${unit}`;
        })()
    : null;
  return { due, overdue, label };
}

export function TaskItem({ task, project, onEdit, dragMode = "hat", keepOnComplete = false }: Props) {
  const toggleTask = useDashboard((s) => s.toggleTask);
  const updateTask = useDashboard((s) => s.updateTask);
  const deleteTask = useDashboard((s) => s.deleteTask);
  const toggleStar = useDashboard((s) => s.toggleStar);
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

  const { due, overdue, label: dueLabel } = dueInfo(task.dueDate);
  const urgent = !task.completed && due !== null && (isToday(due) || overdue);
  const hatLabel = HATS.find((h) => h.id === task.hat)?.label;

  // Guards against submitting twice: pressing Enter fires the form's submit,
  // which unmounts the input, which then fires its own blur — without this,
  // both handlers would try to add the same subtask.
  const subtaskSubmittedRef = useRef(false);

  const openAddSubtask = () => {
    subtaskSubmittedRef.current = false;
    setAddingSubtask(true);
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
      className="grid transition-[grid-template-rows] duration-300 ease-in"
      style={{ gridTemplateRows: phase === "leaving" ? "0fr" : "1fr" }}
    >
      <div className={phase === "leaving" ? "overflow-hidden" : "overflow-visible"}>
        <div
          ref={setNodeRef}
          style={style}
          onClick={() => onEdit(task)}
          {...attributes}
          {...listeners}
          className={cn(
            "group relative flex cursor-pointer items-center gap-2 rounded-md border border-transparent px-2 py-2 transition-colors hover:border-hairline hover:bg-surface-elevated active:cursor-grabbing",
            urgent && "border-2 border-black hover:border-black",
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
              <Checkbox checked={task.completed} onCheckedChange={handleToggle} />
            ) : (
              <CheckCircle2 className="h-4 w-4 animate-in zoom-in-50 duration-300 text-green-500" />
            )}
          </div>

          <div
            className={cn(
              "min-w-0 flex-1 rounded-full px-3 py-1.5",
              u.dot,
              u.pillText,
              task.completed && "opacity-50",
            )}
            aria-label={`${u.label} urgency`}
          >
            <div className="flex items-center justify-between gap-2">
              <p className={cn("min-w-0 truncate text-sm leading-snug", task.completed && "line-through")}>
                {task.name}
              </p>
              {hatLabel && (
                <span className="shrink-0 text-[10px] uppercase tracking-wide opacity-70">
                  {hatLabel}
                </span>
              )}
            </div>
            {(project || dueLabel) && (
              <div className="mt-0.5 flex flex-wrap items-center gap-x-2 gap-y-0.5 text-[11px] opacity-80">
                {project && (
                  <span className="inline-flex items-center gap-1">
                    {project.icon && <span>{project.icon}</span>}
                    <span className="truncate">{project.name}</span>
                  </span>
                )}
                {project && dueLabel && <span className="opacity-70">·</span>}
                {dueLabel && <span className={cn(overdue && "font-semibold")}>{dueLabel}</span>}
              </div>
            )}
          </div>

          <Button
            variant="ghost"
            size="icon"
            className={cn(
              "h-6 w-6 shrink-0",
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
            <Star className={cn("h-3.5 w-3.5", task.starred && "fill-current")} />
          </Button>

          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button
                variant="ghost"
                size="icon"
                className="h-6 w-6 shrink-0 opacity-100 sm:opacity-0 sm:group-hover:opacity-100"
                onClick={(e) => e.stopPropagation()}
                onPointerDown={(e) => e.stopPropagation()}
              >
                <MoreHorizontal className="h-3.5 w-3.5" />
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end" onClick={(e) => e.stopPropagation()}>
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
          <div onClick={(e) => e.stopPropagation()} className="mb-1.5 ml-9 mr-2 space-y-1">
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
                    className="h-3.5 w-3.5"
                  />
                  <span
                    className={cn(
                      "flex-1 truncate text-xs text-ink-soft",
                      st.completed && "text-ink-faint line-through",
                    )}
                  >
                    {st.name}
                  </span>
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
