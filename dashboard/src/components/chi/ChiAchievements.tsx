import { useMemo } from "react";
import { format } from "date-fns";
import { Trophy } from "lucide-react";
import { useDashboard } from "@/lib/dashboard-store";
import type { Project, Task } from "@/lib/dashboard-types";
import { computeChiStats, goalCurrent } from "@/lib/chi-stats";
import { computeAchievements } from "@/lib/chi-achievements";
import { cn } from "@/lib/utils";

export function ChiAchievements({ tasks, projects }: { tasks: Task[]; projects: Project[] }) {
  const uncompleteProject = useDashboard((s) => s.uncompleteProject);
  const achievements = useMemo(
    () => computeAchievements(computeChiStats(tasks, projects)),
    [tasks, projects],
  );
  const earned = achievements.filter((a) => a.earned).length;

  const achievedGoals = useMemo(
    () =>
      projects
        .filter((p) => p.space === "chi" && p.completed)
        .sort((a, b) => (b.completedAt ?? 0) - (a.completedAt ?? 0)),
    [projects],
  );

  const resultOf = (goal: Project) => {
    if (goal.target) return `${goalCurrent(goal)} ${goal.unit ?? ""}`.trim();
    const done = tasks.filter(
      (t) => t.space === "chi" && !t.parentTaskId && t.projectId === goal.id && t.completed,
    ).length;
    return `${done} task${done === 1 ? "" : "s"} done`;
  };

  return (
    <div className="space-y-12">
      {achievedGoals.length > 0 && (
        <section>
          <h3 className="mb-3 px-1 text-[11px] font-semibold uppercase tracking-[0.2em] text-chi">
            Goals achieved · {achievedGoals.length}
          </h3>
          <div className="grid gap-3 sm:grid-cols-2">
            {achievedGoals.map((g) => (
              <article
                key={g.id}
                className="flex items-start gap-3 rounded-2xl border border-chi/40 bg-chi-soft/50 p-4"
              >
                <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-full bg-chi text-white">
                  <Trophy className="h-5 w-5" strokeWidth={1.8} />
                </div>
                <div className="min-w-0 flex-1">
                  <h4 className="font-display text-xl leading-tight text-ink">{g.name}</h4>
                  <p className="mt-0.5 text-xs text-ink-soft">
                    {resultOf(g)}
                    {g.passion ? ` · ${g.passion}` : ""}
                  </p>
                  <div className="mt-2 flex items-center justify-between text-[11px] text-ink-faint">
                    <span>
                      {g.completedAt ? `Achieved ${format(new Date(g.completedAt), "MMM d, yyyy")}` : ""}
                    </span>
                    <button
                      type="button"
                      onClick={() => uncompleteProject(g.id)}
                      className="underline-offset-2 hover:text-ink hover:underline"
                    >
                      Reopen
                    </button>
                  </div>
                </div>
              </article>
            ))}
          </div>
        </section>
      )}

      <section>
        <p className="mb-6 text-center text-sm text-ink-soft">
          <span className="font-display text-3xl text-ink">{earned}</span>
          <span className="ml-1.5 text-ink-faint">of {achievements.length} badges earned</span>
        </p>
        <div className="grid grid-cols-3 gap-x-3 gap-y-8">
          {achievements.map((a) => {
            const Icon = a.icon;
            return (
              <div key={a.id} className="flex flex-col items-center gap-2 text-center">
                <div
                  className={cn(
                    "flex h-16 w-16 items-center justify-center rounded-full sm:h-20 sm:w-20",
                    a.earned
                      ? "bg-chi text-white ring-4 ring-chi-soft"
                      : "border-[1.5px] border-dashed border-hairline-strong text-hairline-strong",
                  )}
                >
                  <Icon className="h-7 w-7 sm:h-8 sm:w-8" strokeWidth={1.7} />
                </div>
                <div
                  className={cn("text-xs font-semibold leading-tight", !a.earned && "text-ink-faint")}
                >
                  {a.name}
                </div>
                <div className="-mt-1 text-[10px] text-ink-faint">
                  {a.earned ? a.hint : `${a.hint} · ${a.progress}`}
                </div>
              </div>
            );
          })}
        </div>
      </section>
    </div>
  );
}
