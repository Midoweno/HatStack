import { useMemo } from "react";
import type { Project, Task } from "@/lib/dashboard-types";
import { computeChiStats } from "@/lib/chi-stats";
import { computeAchievements } from "@/lib/chi-achievements";
import { cn } from "@/lib/utils";

export function ChiAchievements({ tasks, projects }: { tasks: Task[]; projects: Project[] }) {
  const achievements = useMemo(
    () => computeAchievements(computeChiStats(tasks, projects)),
    [tasks, projects],
  );
  const earned = achievements.filter((a) => a.earned).length;

  return (
    <div>
      <p className="mb-6 text-center text-sm text-ink-soft">
        <span className="font-display text-3xl text-ink">{earned}</span>
        <span className="ml-1.5 text-ink-faint">of {achievements.length} earned</span>
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
              <div className={cn("text-xs font-semibold leading-tight", !a.earned && "text-ink-faint")}>
                {a.name}
              </div>
              <div className="-mt-1 text-[10px] text-ink-faint">
                {a.earned ? a.hint : `${a.hint} · ${a.progress}`}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
