import { differenceInCalendarDays, format, parseISO, startOfDay, subDays } from "date-fns";
import type { Project, Task } from "./dashboard-types";

export interface GoalProgress {
  goal: Project;
  done: number;
  total: number;
  pct: number;
  finished: boolean;
}

export interface WeekDay {
  key: string;
  label: string;
  count: number;
  isToday: boolean;
}

export interface ChiStats {
  total: number;
  done: number;
  pct: number;
  streak: number;
  bestStreak: number;
  bestDay: number;
  weekCount: number;
  monthCount: number;
  week: WeekDay[];
  goals: GoalProgress[];
  goalsFinished: number;
  goalsCreated: number;
}

const dayKey = (d: Date) => format(d, "yyyy-MM-dd");

// Everything on the Progress and Achievements tabs is derived from the CHI
// tasks themselves (what's done, and when) — nothing is stored separately.
export function computeChiStats(tasks: Task[], projects: Project[], now = new Date()): ChiStats {
  const chiTasks = tasks.filter((t) => t.space === "chi" && !t.parentTaskId);
  const goals = projects.filter((p) => p.space === "chi");
  const doneTasks = chiTasks.filter((t) => t.completed);

  const perDay = new Map<string, number>();
  for (const t of doneTasks) {
    if (!t.completedAt) continue;
    const key = dayKey(new Date(t.completedAt));
    perDay.set(key, (perDay.get(key) ?? 0) + 1);
  }
  const hasDay = (d: Date) => (perDay.get(dayKey(d)) ?? 0) > 0;

  // Current streak counts back from today, or from yesterday if nothing has
  // been done yet today (so the streak doesn't read 0 first thing in the morning).
  let cursor = startOfDay(now);
  if (!hasDay(cursor)) cursor = subDays(cursor, 1);
  let streak = 0;
  while (hasDay(cursor)) {
    streak++;
    cursor = subDays(cursor, 1);
  }

  let bestStreak = 0;
  let run = 0;
  let prev: Date | null = null;
  for (const key of [...perDay.keys()].sort()) {
    const d = parseISO(key);
    run = prev && differenceInCalendarDays(d, prev) === 1 ? run + 1 : 1;
    bestStreak = Math.max(bestStreak, run);
    prev = d;
  }

  const week: WeekDay[] = Array.from({ length: 7 }, (_, i) => {
    const d = subDays(now, 6 - i);
    const key = dayKey(d);
    return { key, label: format(d, "EEEEE"), count: perDay.get(key) ?? 0, isToday: i === 6 };
  });

  const monthPrefix = format(now, "yyyy-MM");
  let monthCount = 0;
  for (const [key, n] of perDay) if (key.startsWith(monthPrefix)) monthCount += n;

  const goalProgress: GoalProgress[] = goals.map((goal) => {
    const own = chiTasks.filter((t) => t.projectId === goal.id);
    const done = own.filter((t) => t.completed).length;
    const total = own.length;
    return {
      goal,
      done,
      total,
      pct: total > 0 ? Math.round((done / total) * 100) : 0,
      finished: total > 0 && done === total,
    };
  });

  return {
    total: chiTasks.length,
    done: doneTasks.length,
    pct: chiTasks.length > 0 ? Math.round((doneTasks.length / chiTasks.length) * 100) : 0,
    streak,
    bestStreak,
    bestDay: Math.max(0, ...perDay.values()),
    weekCount: week.reduce((n, d) => n + d.count, 0),
    monthCount,
    week,
    goals: goalProgress,
    goalsFinished: goalProgress.filter((g) => g.finished).length,
    goalsCreated: goals.length,
  };
}
