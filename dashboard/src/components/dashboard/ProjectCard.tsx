import { format, isPast, isToday, parseISO } from "date-fns";
import { MoreHorizontal, Trash2, Pencil, CheckCircle2 } from "lucide-react";
import type { Project, Task } from "@/lib/dashboard-types";
import { useDashboard } from "@/lib/dashboard-store";
import { Progress } from "@/components/ui/progress";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

interface Props {
  project: Project;
  tasks: Task[];
  onEdit: (project: Project) => void;
  onOpen: (project: Project) => void;
}

export function ProjectCard({ project, tasks, onEdit, onOpen }: Props) {
  const completeProject = useDashboard((s) => s.completeProject);
  const deleteProject = useDashboard((s) => s.deleteProject);

  const projectTasks = tasks.filter((t) => t.projectId === project.id);
  const done = projectTasks.filter((t) => t.completed).length;
  const total = projectTasks.length;
  const pct = total === 0 ? 0 : Math.round((done / total) * 100);

  const due = project.dueDate ? parseISO(project.dueDate) : null;
  const overdue = due && isPast(due) && pct < 100;
  const urgent = pct < 100 && due !== null && (isToday(due) || overdue);

  return (
    <div
      onClick={() => onOpen(project)}
      className={cn(
        "group cursor-pointer rounded-lg border border-hairline bg-surface-elevated p-3 transition-colors hover:border-ink-faint/40",
        urgent && "border-2 border-black hover:border-black",
      )}
    >
      <div className="flex items-start justify-between gap-2">
        <div className="min-w-0 flex-1">
          <div className="flex items-center gap-2">
            {project.icon && (
              <span className="text-base leading-none">{project.icon}</span>
            )}
            <h4 className="truncate text-sm font-medium text-ink">{project.name}</h4>
          </div>
          {due && (
            <p
              className={cn(
                "mt-1 text-xs",
                overdue ? "text-urgency-critical" : "text-ink-faint",
              )}
            >
              Due {format(due, "MMM d, yyyy")}
            </p>
          )}
        </div>

        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button
              variant="ghost"
              size="icon"
              className="h-7 w-7 shrink-0 opacity-100 sm:opacity-0 sm:group-hover:opacity-100"
              onClick={(e) => e.stopPropagation()}
            >
              <MoreHorizontal className="h-4 w-4" />
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end" onClick={(e) => e.stopPropagation()}>
            <DropdownMenuItem onClick={() => onEdit(project)}>
              <Pencil className="mr-2 h-4 w-4" /> Edit
            </DropdownMenuItem>
            <DropdownMenuItem onClick={() => completeProject(project.id)}>
              <CheckCircle2 className="mr-2 h-4 w-4" /> Complete
            </DropdownMenuItem>
            <DropdownMenuItem
              className="text-destructive focus:text-destructive"
              onClick={() => deleteProject(project.id)}
            >
              <Trash2 className="mr-2 h-4 w-4" /> Delete
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      </div>

      {total > 0 && (
        <div className="mt-3 flex items-center gap-2">
          <Progress value={pct} className="h-1 flex-1" />
          <span className="text-[10px] font-medium tabular-nums text-ink-faint">
            {done}/{total}
          </span>
        </div>
      )}
    </div>
  );
}
