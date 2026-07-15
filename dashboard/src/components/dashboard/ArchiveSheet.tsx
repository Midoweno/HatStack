import { useState } from "react";
import { format } from "date-fns";
import { Download, RotateCcw, Trash2 } from "lucide-react";
import { useDashboard } from "@/lib/dashboard-store";
import { HATS, URGENCY_META } from "@/lib/dashboard-types";
import { downloadCsv } from "@/lib/csv";
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
} from "@/components/ui/sheet";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

interface Props {
  open: boolean;
  onOpenChange: (v: boolean) => void;
}

export function ArchiveSheet({ open, onOpenChange }: Props) {
  const [tab, setTab] = useState<"tasks" | "completedProjects">("tasks");

  const projects = useDashboard((s) => s.projects);
  const uncompleteProject = useDashboard((s) => s.uncompleteProject);
  const deleteProject = useDashboard((s) => s.deleteProject);
  const completedProjects = projects
    .filter((p) => p.completed)
    .sort((a, b) => (b.completedAt ?? 0) - (a.completedAt ?? 0));

  const tasks = useDashboard((s) => s.tasks);
  const projectById = new Map(projects.map((p) => [p.id, p]));
  const toggleTask = useDashboard((s) => s.toggleTask);
  const deleteTask = useDashboard((s) => s.deleteTask);
  const completedTasks = tasks
    .filter((t) => t.completed)
    .sort((a, b) => (b.completedAt ?? 0) - (a.completedAt ?? 0));

  const exportCompletedTasks = () => {
    const rows: string[][] = [
      ["Task", "Hat", "Project", "Priority", "Completed date", "Due date"],
      ...completedTasks.map((t) => {
        const hatLabel = HATS.find((h) => h.id === t.hat)?.label ?? t.hat;
        const project = t.projectId ? projectById.get(t.projectId) : undefined;
        return [
          t.name,
          hatLabel,
          project?.name ?? "",
          URGENCY_META[t.urgency].label,
          t.completedAt ? format(new Date(t.completedAt), "yyyy-MM-dd HH:mm") : "",
          t.dueDate ?? "",
        ];
      }),
    ];
    downloadCsv(`completed-tasks-${format(new Date(), "yyyy-MM-dd")}.csv`, rows);
  };

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent className="w-full sm:max-w-md">
        <SheetHeader>
          <SheetTitle className="font-display text-2xl">Archive</SheetTitle>
        </SheetHeader>

        <div className="mt-4 flex gap-1 px-4">
          <button
            onClick={() => setTab("tasks")}
            className={cn(
              "rounded-md px-3 py-1.5 text-xs font-medium transition-colors",
              tab === "tasks"
                ? "bg-accent text-accent-foreground"
                : "text-ink-faint hover:text-ink-soft",
            )}
          >
            Completed tasks
          </button>
          <button
            onClick={() => setTab("completedProjects")}
            className={cn(
              "rounded-md px-3 py-1.5 text-xs font-medium transition-colors",
              tab === "completedProjects"
                ? "bg-accent text-accent-foreground"
                : "text-ink-faint hover:text-ink-soft",
            )}
          >
            Completed projects
          </button>
        </div>

        <div className="mt-4 space-y-6 px-4 pb-6">
          {tab === "tasks" && (
            <div>
              <div className="mb-3 flex items-center justify-between">
                <p className="text-xs text-ink-faint">
                  {completedTasks.length} completed{" "}
                  {completedTasks.length === 1 ? "task" : "tasks"}
                </p>
                <Button
                  variant="outline"
                  size="sm"
                  className="h-7 text-xs"
                  disabled={completedTasks.length === 0}
                  onClick={exportCompletedTasks}
                >
                  <Download className="mr-1.5 h-3.5 w-3.5" />
                  Export CSV
                </Button>
              </div>

              {completedTasks.length === 0 ? (
                <p className="text-sm text-ink-faint">
                  Completed tasks will land here.
                </p>
              ) : (
                <div className="space-y-2">
                  {completedTasks.map((t) => {
                    const hatLabel = HATS.find((h) => h.id === t.hat)?.label ?? t.hat;
                    const project = t.projectId
                      ? projectById.get(t.projectId)
                      : undefined;
                    const u = URGENCY_META[t.urgency];
                    return (
                      <div
                        key={t.id}
                        className="flex items-center justify-between rounded-lg border border-hairline bg-surface-elevated px-3 py-2"
                      >
                        <div className="min-w-0">
                          <p className="truncate text-sm text-ink line-through">
                            {t.name}
                          </p>
                          <div className="mt-0.5 flex flex-wrap items-center gap-x-1.5 text-xs text-ink-faint">
                            <span className={cn("font-medium", u.text)}>
                              {u.label}
                            </span>
                            <span>·</span>
                            <span>{hatLabel}</span>
                            {project && (
                              <>
                                <span>·</span>
                                <span className="truncate">{project.name}</span>
                              </>
                            )}
                            {t.completedAt && (
                              <>
                                <span>·</span>
                                <span>
                                  {format(new Date(t.completedAt), "MMM d, yyyy")}
                                </span>
                              </>
                            )}
                          </div>
                        </div>
                        <div className="flex shrink-0 gap-1">
                          <Button
                            variant="ghost"
                            size="icon"
                            className="h-7 w-7"
                            onClick={() => toggleTask(t.id)}
                            aria-label="Restore to task list"
                          >
                            <RotateCcw className="h-3.5 w-3.5" />
                          </Button>
                          <Button
                            variant="ghost"
                            size="icon"
                            className="h-7 w-7"
                            onClick={() => deleteTask(t.id)}
                            aria-label="Delete permanently"
                          >
                            <Trash2 className="h-3.5 w-3.5" />
                          </Button>
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
            </div>
          )}

          {tab === "completedProjects" && (
            <div>
              {completedProjects.length === 0 ? (
                <p className="text-sm text-ink-faint">
                  Completed projects will land here.
                </p>
              ) : (
                <div className="space-y-2">
                  {completedProjects.map((p) => {
                    const hatLabel = HATS.find((h) => h.id === p.hat)?.label ?? p.hat;
                    return (
                      <div
                        key={p.id}
                        className="flex items-center justify-between rounded-lg border border-hairline bg-surface-elevated px-3 py-2"
                      >
                        <div className="min-w-0">
                          <div className="flex items-center gap-2 text-sm text-ink">
                            {p.icon && <span>{p.icon}</span>}
                            <span className="truncate line-through">{p.name}</span>
                          </div>
                          <div className="mt-0.5 flex flex-wrap items-center gap-x-1.5 text-xs text-ink-faint">
                            <span>{hatLabel}</span>
                            {p.completedAt && (
                              <>
                                <span>·</span>
                                <span>
                                  Completed{" "}
                                  {format(new Date(p.completedAt), "MMM d, yyyy")}
                                </span>
                              </>
                            )}
                          </div>
                        </div>
                        <div className="flex shrink-0 gap-1">
                          <Button
                            variant="ghost"
                            size="icon"
                            className="h-7 w-7"
                            onClick={() => uncompleteProject(p.id)}
                            aria-label="Restore to active projects"
                          >
                            <RotateCcw className="h-3.5 w-3.5" />
                          </Button>
                          <Button
                            variant="ghost"
                            size="icon"
                            className="h-7 w-7"
                            onClick={() => deleteProject(p.id)}
                            aria-label="Delete permanently"
                          >
                            <Trash2 className="h-3.5 w-3.5" />
                          </Button>
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
            </div>
          )}
        </div>
      </SheetContent>
    </Sheet>
  );
}
