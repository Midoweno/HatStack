import { useDroppable } from "@dnd-kit/core";
import { Plus } from "lucide-react";
import type { Hat, Project, Task } from "@/lib/dashboard-types";
import { URGENCY_ORDER } from "@/lib/dashboard-types";
import { Button } from "@/components/ui/button";
import { ProjectCard } from "./ProjectCard";
import { TaskItem } from "./TaskItem";
import { cn } from "@/lib/utils";

interface Props {
  hat: Hat;
  label: string;
  projects: Project[];
  tasks: Task[];
  onAddProject: () => void;
  onAddTask: () => void;
  onEditProject: (p: Project) => void;
  onEditTask: (t: Task) => void;
  onOpenProject: (p: Project) => void;
}

export function HatColumn({
  hat,
  label,
  projects,
  tasks,
  onAddProject,
  onAddTask,
  onEditProject,
  onEditTask,
  onOpenProject,
}: Props) {
  const { setNodeRef, isOver } = useDroppable({ id: `hat-${hat}`, data: { hat } });

  const activeProjects = projects
    .filter((p) => p.hat === hat && !p.completed)
    .sort((a, b) => (a.dueDate ?? "9999").localeCompare(b.dueDate ?? "9999"));

  const activeTasks = tasks
    .filter((t) => t.hat === hat && !t.completed)
    .sort((a, b) => {
      const ua = URGENCY_ORDER[a.urgency];
      const ub = URGENCY_ORDER[b.urgency];
      if (ua !== ub) return ua - ub;
      return (a.dueDate ?? "9999").localeCompare(b.dueDate ?? "9999");
    });

  const projectById = new Map(projects.map((p) => [p.id, p]));

  return (
    <div
      ref={setNodeRef}
      className={cn(
        "flex min-h-[70vh] flex-col rounded-2xl border border-hairline-strong bg-surface transition-colors",
        isOver && "border-ink/30 bg-accent/40",
      )}
    >
      <header className="flex items-baseline justify-between border-b border-hairline px-5 pt-5 pb-4">
        <div className="min-w-0">
          <h2 className="font-display text-2xl text-ink">{label}</h2>
        </div>
        <span className="text-xs tabular-nums text-ink-faint">
          {activeTasks.length}
        </span>
      </header>

      <section className="border-b border-hairline px-5 pt-4 pb-5">
        <div className="mb-3 flex items-center justify-between">
          <h3 className="text-[10px] font-semibold uppercase tracking-[0.14em] text-ink-faint">
            Active projects
          </h3>
          <Button
            variant="ghost"
            size="icon"
            className="h-6 w-6"
            onClick={onAddProject}
            aria-label="Add project"
          >
            <Plus className="h-3.5 w-3.5" />
          </Button>
        </div>
        {activeProjects.length === 0 ? (
          <button
            onClick={onAddProject}
            className="w-full rounded-lg border border-dashed border-hairline px-3 py-4 text-xs text-ink-faint transition-colors hover:border-ink-faint/50 hover:text-ink-soft"
          >
            No active projects — add one
          </button>
        ) : (
          <div className="space-y-2">
            {activeProjects.map((p) => (
              <ProjectCard
                key={p.id}
                project={p}
                tasks={tasks}
                onEdit={onEditProject}
                onOpen={onOpenProject}
              />
            ))}
          </div>
        )}
      </section>

      <section className="flex flex-1 flex-col px-5 pt-4 pb-5">
        <div className="mb-2 flex items-center justify-between">
          <h3 className="text-[10px] font-semibold uppercase tracking-[0.14em] text-ink-faint">
            Task list
          </h3>
          <Button
            variant="ghost"
            size="icon"
            className="h-6 w-6"
            onClick={onAddTask}
            aria-label="Add task"
          >
            <Plus className="h-3.5 w-3.5" />
          </Button>
        </div>
        {activeTasks.length === 0 ? (
          <button
            onClick={onAddTask}
            className="mt-1 w-full rounded-lg border border-dashed border-hairline px-3 py-6 text-xs text-ink-faint transition-colors hover:border-ink-faint/50 hover:text-ink-soft"
          >
            Nothing to do — add a task
          </button>
        ) : (
          <div className="-mx-2 space-y-0.5">
            {activeTasks.map((t) => (
              <TaskItem
                key={t.id}
                task={t}
                project={t.projectId ? projectById.get(t.projectId) : undefined}
                onEdit={onEditTask}
              />
            ))}
          </div>
        )}
      </section>
    </div>
  );
}
