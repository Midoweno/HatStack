import { useMemo } from "react";
import { Plus } from "lucide-react";
import type { Project, Task } from "@/lib/dashboard-types";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { TaskItem } from "./TaskItem";

interface Props {
  project: Project | null;
  onOpenChange: (v: boolean) => void;
  tasks: Task[];
  onEditTask: (t: Task) => void;
  onAddTask: (project: Project) => void;
}

export function ProjectTasksDialog({
  project,
  onOpenChange,
  tasks,
  onEditTask,
  onAddTask,
}: Props) {
  const projectTasks = useMemo(() => {
    if (!project) return [];
    return tasks
      .filter((t) => t.projectId === project.id)
      .sort((a, b) => {
        if (a.completed !== b.completed) return a.completed ? 1 : -1;
        return (a.dueDate ?? "9999").localeCompare(b.dueDate ?? "9999");
      });
  }, [tasks, project]);

  return (
    <Dialog open={project !== null} onOpenChange={onOpenChange}>
      <DialogContent className="max-h-[85vh] overflow-y-auto">
        {project && (
          <>
            <DialogHeader>
              <DialogTitle className="flex items-center gap-2">
                {project.icon && <span>{project.icon}</span>}
                {project.name}
              </DialogTitle>
            </DialogHeader>

            {project.description && (
              <p className="whitespace-pre-wrap text-sm text-ink-soft">
                {project.description}
              </p>
            )}

            <div className="flex items-center justify-between">
              <p className="text-xs text-ink-faint">
                {projectTasks.length} {projectTasks.length === 1 ? "task" : "tasks"}
              </p>
              <Button size="sm" onClick={() => onAddTask(project)}>
                <Plus className="mr-1 h-4 w-4" />
                Add task
              </Button>
            </div>

            {projectTasks.length === 0 ? (
              <p className="py-6 text-center text-sm text-ink-faint">
                No tasks in this project yet.
              </p>
            ) : (
              <div className="-mx-2 space-y-0.5">
                {projectTasks.map((t) => (
                  <TaskItem key={t.id} task={t} project={project} onEdit={onEditTask} />
                ))}
              </div>
            )}
          </>
        )}
      </DialogContent>
    </Dialog>
  );
}
