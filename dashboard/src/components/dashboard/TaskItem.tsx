import { useDraggable } from "@dnd-kit/core";
import { differenceInCalendarDays, isPast, isToday, parseISO } from "date-fns";
import { MoreHorizontal, Pencil, Trash2, GripVertical } from "lucide-react";
import { toast } from "sonner";
import type { Project, Task } from "@/lib/dashboard-types";
import { URGENCY_META } from "@/lib/dashboard-types";
import { useDashboard } from "@/lib/dashboard-store";
import { Checkbox } from "@/components/ui/checkbox";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { cn } from "@/lib/utils";

interface Props {
  task: Task;
  project?: Project;
  onEdit: (task: Task) => void;
}

export function TaskItem({ task, project, onEdit }: Props) {
  const toggleTask = useDashboard((s) => s.toggleTask);
  const deleteTask = useDashboard((s) => s.deleteTask);
  const u = URGENCY_META[task.urgency];

  const handleToggle = () => {
    const wasCompleted = task.completed;
    const createdId = toggleTask(task.id);

    if (!wasCompleted) {
      toast(`"${task.name}" completed`, {
        action: {
          label: "Undo",
          onClick: () => {
            toggleTask(task.id);
            if (createdId) deleteTask(createdId);
          },
        },
        duration: 4000,
      });
    }
  };

  const { attributes, listeners, setNodeRef, transform, isDragging } = useDraggable({
    id: `task-${task.id}`,
    data: { taskId: task.id },
  });

  const style = transform
    ? { transform: `translate3d(${transform.x}px, ${transform.y}px, 0)` }
    : undefined;

  const due = task.dueDate ? parseISO(task.dueDate) : null;
  const overdue = due ? isPast(due) && !isToday(due) : false;
  const dueLabel = due
    ? isToday(due)
      ? "Today"
      : (() => {
          const days = Math.abs(differenceInCalendarDays(due, new Date()));
          const unit = days === 1 ? "day" : "days";
          return overdue ? `${days} ${unit} overdue` : `${days} ${unit}`;
        })()
    : null;

  return (
    <div
      ref={setNodeRef}
      style={style}
      className={cn(
        "group relative flex items-center gap-2 rounded-md border border-transparent px-2 py-2 transition-colors hover:border-hairline hover:bg-surface-elevated",
        isDragging && "opacity-40",
      )}
    >
      <button
        {...attributes}
        {...listeners}
        className="shrink-0 cursor-grab text-ink-faint/50 opacity-0 transition-opacity group-hover:opacity-100 active:cursor-grabbing"
        aria-label="Drag task"
      >
        <GripVertical className="h-3.5 w-3.5" />
      </button>

      <Checkbox
        checked={task.completed}
        onCheckedChange={handleToggle}
        className="shrink-0"
      />

      <div
        className={cn(
          "min-w-0 flex-1 rounded-full px-3 py-1.5",
          u.dot,
          u.pillText,
          task.completed && "opacity-50",
        )}
        aria-label={`${u.label} urgency`}
      >
        <p className={cn("text-sm leading-snug", task.completed && "line-through")}>
          {task.name}
        </p>
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

      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <Button
            variant="ghost"
            size="icon"
            className="h-6 w-6 shrink-0 opacity-0 group-hover:opacity-100"
          >
            <MoreHorizontal className="h-3.5 w-3.5" />
          </Button>
        </DropdownMenuTrigger>
        <DropdownMenuContent align="end">
          <DropdownMenuItem onClick={() => onEdit(task)}>
            <Pencil className="mr-2 h-4 w-4" /> Edit
          </DropdownMenuItem>
          <DropdownMenuItem
            className="text-destructive focus:text-destructive"
            onClick={() => deleteTask(task.id)}
          >
            <Trash2 className="mr-2 h-4 w-4" /> Delete
          </DropdownMenuItem>
        </DropdownMenuContent>
      </DropdownMenu>
    </div>
  );
}
