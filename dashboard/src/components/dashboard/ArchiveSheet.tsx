import { useMemo, useState } from "react";
import { format, isToday, isYesterday } from "date-fns";
import { Download, RotateCcw, Trash2 } from "lucide-react";
import { useDashboard } from "@/lib/dashboard-store";
import { HATS, URGENCY_META, type Space, type Task } from "@/lib/dashboard-types";
import { goalCurrent } from "@/lib/chi-stats";
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
  // Which tab's archive to show: Hats/Priority items, or CHI items.
  space?: Space;
}

type ArchiveTab = "tasks" | "completedProjects" | "progress";

export function ArchiveSheet({ open, onOpenChange, space = "hats" }: Props) {
  const isChi = space === "chi";
  const [tab, setTab] = useState<ArchiveTab>("tasks");

  const allProjects = useDashboard((s) => s.projects);
  const projects = allProjects.filter((p) => (p.space === "chi") === isChi);
  const uncompleteProject = useDashboard((s) => s.uncompleteProject);
  const deleteProject = useDashboard((s) => s.deleteProject);
  const deleteGoal = useDashboard((s) => s.deleteGoal);
  const removeProgress = useDashboard((s) => s.removeProgress);
  const completedProjects = projects
    .filter((p) => p.completed)
    .sort((a, b) => (b.completedAt ?? 0) - (a.completedAt ?? 0));

  const tasks = useDashboard((s) => s.tasks).filter((t) => (t.space === "chi") === isChi);
  const projectById = new Map(projects.map((p) => [p.id, p]));
  const toggleTask = useDashboard((s) => s.toggleTask);
  const deleteTask = useDashboard((s) => s.deleteTask);
  const completedTasks = tasks
    .filter((t) => t.completed && !t.parentTaskId)
    .sort((a, b) => (b.completedAt ?? 0) - (a.completedAt ?? 0));

  const groupedCompletedTasks = useMemo(() => {
    const byDay = new Map<string, Task[]>();
    for (const t of completedTasks) {
      const key = t.completedAt ? format(new Date(t.completedAt), "yyyy-MM-dd") : "unknown";
      if (!byDay.has(key)) byDay.set(key, []);
      byDay.get(key)!.push(t);
    }
    return Array.from(byDay.entries()).map(([key, dayTasks]) => {
      const date = key !== "unknown" ? new Date(dayTasks[0].completedAt!) : null;
      const label = !date
        ? "No date"
        : isToday(date)
          ? "Today"
          : isYesterday(date)
            ? "Yesterday"
            : format(date, "MMMM d, yyyy");
      return { key, label, tasks: dayTasks };
    });
  }, [completedTasks]);

  // Un-completing a task of a goal that was marked done reopens the goal too
  // (unless it's finished by a number rather than its tasks).
  const restoreTask = (t: Task) => {
    toggleTask(t.id);
    const goal = t.projectId ? projectById.get(t.projectId) : undefined;
    if (isChi && goal?.completed && !goal.target) uncompleteProject(goal.id);
  };

  const removeGoal = (id: string, name: string) => {
    if (!isChi) return deleteProject(id);
    if (window.confirm(`Delete "${name}" and all of its tasks? This can't be undone.`)) deleteGoal(id);
  };

  // Every progress entry you've logged, newest first, so a mistaken one can be undone.
  const progressEntries = projects
    .flatMap((g) => (g.progress ?? []).map((e) => ({ ...e, goal: g })))
    .sort((a, b) => (a.date < b.date ? 1 : a.date > b.date ? -1 : 0));

  const exportCompletedTasks = () => {
    const rows: string[][] = isChi
      ? [
          ["Task", "Goal", "Passion", "Completed date", "Due date"],
          ...completedTasks.map((t) => {
            const goal = t.projectId ? projectById.get(t.projectId) : undefined;
            return [
              t.name,
              goal?.name ?? "",
              goal?.passion ?? "",
              t.completedAt ? format(new Date(t.completedAt), "yyyy-MM-dd HH:mm") : "",
              t.dueDate ?? "",
            ];
          }),
        ]
      : [
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
          <SheetTitle className="font-display text-2xl">
            Archive{isChi && <span className="ml-2 text-sm font-sans text-chi">CHI</span>}
          </SheetTitle>
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
            {isChi ? "Achieved goals" : "Completed projects"}
          </button>
          {isChi && (
            <button
              onClick={() => setTab("progress")}
              className={cn(
                "rounded-md px-3 py-1.5 text-xs font-medium transition-colors",
                tab === "progress"
                  ? "bg-accent text-accent-foreground"
                  : "text-ink-faint hover:text-ink-soft",
              )}
            >
              Progress log
            </button>
          )}
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
                <div className="space-y-5">
                  {groupedCompletedTasks.map((group) => (
                    <div key={group.key}>
                      <h4 className="mb-2 text-[10px] font-semibold uppercase tracking-[0.14em] text-ink-faint">
                        {group.label}
                      </h4>
                      <div className="space-y-2">
                        {group.tasks.map((t) => {
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
                                  {!isChi && (
                                    <>
                                      <span>·</span>
                                      <span>{hatLabel}</span>
                                    </>
                                  )}
                                  {project && (
                                    <>
                                      <span>·</span>
                                      <span className="truncate">{project.name}</span>
                                    </>
                                  )}
                                </div>
                              </div>
                              <div className="flex shrink-0 gap-1">
                                <Button
                                  variant="ghost"
                                  size="icon"
                                  className="h-7 w-7"
                                  onClick={() => restoreTask(t)}
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
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}

          {tab === "completedProjects" && (
            <div>
              {completedProjects.length === 0 ? (
                <p className="text-sm text-ink-faint">
                  {isChi ? "Achieved goals will land here." : "Completed projects will land here."}
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
                            <span>
                              {isChi
                                ? [p.passion, p.target ? `${goalCurrent(p)} ${p.unit ?? ""}`.trim() : ""]
                                    .filter(Boolean)
                                    .join(" · ") || "Goal"
                                : hatLabel}
                            </span>
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
                            aria-label={isChi ? "Reopen goal" : "Restore to active projects"}
                          >
                            <RotateCcw className="h-3.5 w-3.5" />
                          </Button>
                          <Button
                            variant="ghost"
                            size="icon"
                            className="h-7 w-7"
                            onClick={() => removeGoal(p.id, p.name)}
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

          {tab === "progress" && isChi && (
            <div>
              {progressEntries.length === 0 ? (
                <p className="text-sm text-ink-faint">Progress you log toward a goal will land here.</p>
              ) : (
                <div className="space-y-2">
                  {progressEntries.map((e) => (
                    <div
                      key={e.id}
                      className="flex items-center justify-between rounded-lg border border-hairline bg-surface-elevated px-3 py-2"
                    >
                      <div className="min-w-0">
                        <p className="truncate text-sm text-ink">
                          +{e.amount}
                          {e.goal.unit ? ` ${e.goal.unit}` : ""}
                          <span className="text-ink-faint"> · {e.goal.name}</span>
                        </p>
                        <p className="mt-0.5 text-xs text-ink-faint">
                          {format(new Date(`${e.date}T12:00:00`), "EEE, MMM d, yyyy")}
                        </p>
                      </div>
                      <Button
                        variant="ghost"
                        size="icon"
                        className="h-7 w-7 shrink-0"
                        onClick={() => removeProgress(e.goal.id, e.id)}
                        aria-label="Undo this entry"
                      >
                        <RotateCcw className="h-3.5 w-3.5" />
                      </Button>
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}
        </div>
      </SheetContent>
    </Sheet>
  );
}
