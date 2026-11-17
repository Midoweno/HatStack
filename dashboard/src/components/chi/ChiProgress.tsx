import { useMemo } from "react";
import type { Project, Task } from "@/lib/dashboard-types";
import { computeChiStats } from "@/lib/chi-stats";
import { cn } from "@/lib/utils";

const RADIUS = 52;
const CIRCUMFERENCE = 2 * Math.PI * RADIUS;

function Ring({ pct }: { pct: number }) {
  return (
    <svg viewBox="0 0 130 130" className="h-44 w-44" role="img" aria-label={`${pct}% of goal tasks done`}>
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
        style={{ strokeDasharray: `${(pct / 100) * CIRCUMFERENCE} ${CIRCUMFERENCE}` }}
      />
      <text
        x="65"
        y="68"
        textAnchor="middle"
        className="fill-ink font-display"
        style={{ fontSize: 34 }}
      >
        {pct}%
      </text>
      <text
        x="65"
        y="86"
        textAnchor="middle"
        className="fill-ink-faint"
        style={{ fontSize: 8, letterSpacing: "0.08em" }}
      >
        TASKS DONE
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
  const maxCount = Math.max(1, ...stats.week.map((d) => d.count));

  if (stats.total === 0) {
    return (
      <p className="rounded-2xl border border-dashed border-hairline px-6 py-16 text-center text-sm text-ink-faint">
        Finish a task in Goals and your progress starts to take shape here.
      </p>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex justify-center py-2">
        <Ring pct={stats.pct} />
      </div>

      <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
        <Stat value={stats.streak} label="Day streak" />
        <Stat value={stats.weekCount} label="Last 7 days" />
        <Stat value={stats.monthCount} label="This month" />
        <Stat value={stats.goals.filter((g) => !g.finished).length} label="Goals live" />
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
                    {g.done} / {g.total} · {g.pct}%
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
