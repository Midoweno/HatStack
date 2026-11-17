import { useMemo } from "react";
import { Minus, Plus } from "lucide-react";
import type { Project, Task } from "@/lib/dashboard-types";
import { computeChiStats } from "@/lib/chi-stats";
import { useWeeklyTarget } from "@/lib/use-weekly-target";
import { cn } from "@/lib/utils";

const RADIUS = 52;
const CIRCUMFERENCE = 2 * Math.PI * RADIUS;

function Ring({ value, target }: { value: number; target: number }) {
  const frac = Math.min(1, value / target);
  return (
    <svg
      viewBox="0 0 130 130"
      className="h-48 w-48"
      role="img"
      aria-label={`${value} of ${target} days this week`}
    >
      <circle cx="65" cy="65" r={RADIUS} fill="none" strokeWidth="9" className="stroke-hairline" />
      <circle
        cx="65"
        cy="65"
        r={RADIUS}
        fill="none"
        strokeWidth="9"
        strokeLinecap="round"
        transform="rotate(-90 65 65)"
        className="stroke-chi transition-[stroke-dasharray] duration-700"
        style={{ strokeDasharray: `${frac * CIRCUMFERENCE} ${CIRCUMFERENCE}` }}
      />
      <text
        x="65"
        y="70"
        textAnchor="middle"
        className="fill-ink font-display"
        style={{ fontSize: 36 }}
      >
        {value}/{target}
      </text>
      <text
        x="65"
        y="88"
        textAnchor="middle"
        className="fill-ink-faint"
        style={{ fontSize: 8, letterSpacing: "0.08em" }}
      >
        DAYS THIS WEEK
      </text>
    </svg>
  );
}

function Stat({ value, label }: { value: number; label: string }) {
  return (
    <div className="rounded-2xl border border-hairline-strong bg-surface px-3 py-4 text-center">
      <div className="font-display text-4xl leading-none text-ink">{value}</div>
      <div className="mt-2 text-[10px] uppercase tracking-[0.12em] text-ink-faint">{label}</div>
    </div>
  );
}

export function ChiProgress({ tasks, projects }: { tasks: Task[]; projects: Project[] }) {
  const stats = useMemo(() => computeChiStats(tasks, projects), [tasks, projects]);
  const [target, setTarget] = useWeeklyTarget();
  const maxCount = Math.max(1, ...stats.week.map((d) => d.count));
  const hit = stats.weekActiveDays >= target;

  return (
    <div className="space-y-6">
      <section className="flex flex-col items-center py-2">
        <Ring value={stats.weekActiveDays} target={target} />

        <div className="mt-1 flex items-center gap-2">
          {stats.calendarWeek.map((d) => (
            <div key={d.key} className="flex flex-col items-center gap-1">
              <span
                className={cn(
                  "h-3.5 w-3.5 rounded-full",
                  d.active
                    ? "bg-chi"
                    : d.isFuture
                      ? "border border-dashed border-hairline-strong"
                      : "bg-hairline",
                  d.isToday && "ring-2 ring-chi/40 ring-offset-2 ring-offset-background",
                )}
              />
              <span
                className={cn(
                  "text-[10px] uppercase",
                  d.isToday ? "font-semibold text-chi" : "text-ink-faint",
                )}
              >
                {d.label}
              </span>
            </div>
          ))}
        </div>

        <p className={cn("mt-4 text-sm", hit ? "font-medium text-chi" : "text-ink-soft")}>
          {hit
            ? "Target hit — you showed up this week."
            : `${target - stats.weekActiveDays} more ${target - stats.weekActiveDays === 1 ? "day" : "days"} to hit your target.`}
        </p>

        <div className="mt-3 flex items-center gap-3 text-xs text-ink-faint">
          <span>Weekly target</span>
          <div className="inline-flex items-center rounded-full border border-hairline-strong bg-surface">
            <button
              type="button"
              onClick={() => setTarget(target - 1)}
              disabled={target <= 1}
              aria-label="Lower weekly target"
              className="rounded-l-full px-2.5 py-1.5 text-ink-soft hover:text-ink disabled:opacity-30"
            >
              <Minus className="h-3.5 w-3.5" />
            </button>
            <span className="min-w-12 text-center text-sm tabular-nums text-ink">
              {target} days
            </span>
            <button
              type="button"
              onClick={() => setTarget(target + 1)}
              disabled={target >= 7}
              aria-label="Raise weekly target"
              className="rounded-r-full px-2.5 py-1.5 text-ink-soft hover:text-ink disabled:opacity-30"
            >
              <Plus className="h-3.5 w-3.5" />
            </button>
          </div>
        </div>
        <p className="mt-2 max-w-xs text-center text-[11px] text-ink-faint">
          A day counts when you finish a task or log progress. Showing up matters, not how long.
        </p>
      </section>

      <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
        <Stat value={stats.streak} label="Day streak" />
        <Stat value={stats.weekCount} label="Last 7 days" />
        <Stat value={stats.monthCount} label="This month" />
        <Stat value={stats.goals.length} label="Goals live" />
      </div>

      <section className="rounded-2xl border border-hairline-strong bg-surface p-5">
        <h3 className="mb-4 text-[11px] font-semibold uppercase tracking-[0.18em] text-chi">
          Last 7 days
        </h3>
        <div className="flex h-28 items-end justify-between gap-2">
          {stats.week.map((d) => (
            <div key={d.key} className="flex flex-1 flex-col items-center gap-1.5">
              <span className="text-[10px] tabular-nums text-ink-faint">{d.count || ""}</span>
              <div
                className={cn(
                  "w-full max-w-9 rounded-t-md rounded-b-sm",
                  d.isToday ? "bg-chi" : "bg-hairline-strong/60",
                )}
                style={{ height: `${Math.max(4, (d.count / maxCount) * 72)}px` }}
              />
              <span
                className={cn(
                  "text-[10px] uppercase",
                  d.isToday ? "font-semibold text-chi" : "text-ink-faint",
                )}
              >
                {d.label}
              </span>
            </div>
          ))}
        </div>
      </section>

      {stats.goals.length > 0 && (
        <section className="rounded-2xl border border-hairline-strong bg-surface p-5">
          <h3 className="mb-4 text-[11px] font-semibold uppercase tracking-[0.18em] text-chi">
            Goals
          </h3>
          <div className="space-y-4">
            {stats.goals.map((g) => (
              <div key={g.goal.id}>
                <div className="mb-1.5 flex items-baseline justify-between gap-3 text-sm">
                  <span className="min-w-0 truncate text-ink">
                    {g.goal.name}
                    {g.goal.passion && (
                      <span className="ml-2 text-xs text-ink-faint">{g.goal.passion}</span>
                    )}
                  </span>
                  <span className="shrink-0 tabular-nums text-xs text-ink-faint">
                    {g.target
                      ? `${g.current} / ${g.target}${g.unit ? ` ${g.unit}` : ""}`
                      : `${g.done} / ${g.total}`}{" "}
                    · {g.pct}%
                  </span>
                </div>
                <div className="h-1 overflow-hidden rounded-full bg-hairline">
                  <div
                    className="h-full rounded-full bg-chi transition-all duration-700"
                    style={{ width: `${g.pct}%` }}
                  />
                </div>
              </div>
            ))}
          </div>
        </section>
      )}
    </div>
  );
}
