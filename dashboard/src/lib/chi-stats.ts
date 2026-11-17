import {
  addDays,
  differenceInCalendarDays,
  format,
  parseISO,
  startOfDay,
  startOfWeek,
  subDays,
} from "date-fns";
import type { Project, Task } from "./dashboard-types";

export interface GoalProgress {
  goal: Project;
  // Tasks done / total (always), plus the logged number when the goal has a target.
  done: number;
  total: number;
  current: number;
  target?: number;
  unit?: string;
  pct: number;
  achieved: boolean;
}

export interface WeekDay {
  key: string;
  label: string;
  count: number;
  isToday: boolean;
}

export interface CalendarDay {
  key: string;
  label: string;
  active: boolean;
  isToday: boolean;
  isFuture: boolean;
}

export interface ChiStats {
  // Tasks finished, and every time you showed up (a task done or progress logged).
  tasksDone: number;
  activityTotal: number;
  streak: number;
  bestStreak: number;
  bestDay: number;
  weekCount: number;
  monthCount: number;
  // Rolling last 7 days, for the bar chart.
  week: WeekDay[];
  // This calendar week (Monday first), for the "days showed up" target.
  calendarWeek: CalendarDay[];
  weekActiveDays: number;
  // Goals still in progress (achieved goals live in Achievements).
  goals: GoalProgress[];
  goalsFinished: number;
  goalsCreated: number;
}

const dayKey = (d: Date) => format(d, "yyyy-MM-dd");

export const goalCurrent = (goal: Project) =>
  (goal.progress ?? []).reduce((sum, e) => sum + e.amount, 0);

// A goal with a number is achieved when the logged total reaches it; a goal
// without one, when it has tasks and every one of them is done.
export function isGoalAchieved(goal: Project, goalTasks: Task[]): boolean {
  if (goal.target && goal.target > 0) return goalCurrent(goal) >= goal.target;
  return goalTasks.length > 0 && goalTasks.every((t) => t.completed);
}

// Everything on the Progress and Achievements tabs is derived from the CHI
// tasks (what's done, and when) and the progress you've logged — nothing is
// stored separately. Showing up on a day = finishing a task or logging progress.
export function computeChiStats(tasks: Task[], projects: Project[], now = new Date()): ChiStats {
  const chiTasks = tasks.filter((t) => t.space === "chi" && !t.parentTaskId);
  const goals = projects.filter((p) => p.space === "chi");

  const perDay = new Map<string, number>();
  const bump = (key: string) => perDay.set(key, (perDay.get(key) ?? 0) + 1);
  for (const t of chiTasks) {
    if (t.completed && t.completedAt) bump(dayKey(new Date(t.completedAt)));
  }
  for (const g of goals) for (const e of g.progress ?? []) bump(e.date);
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

  const monday = startOfWeek(now, { weekStartsOn: 1 });
  const todayKey = dayKey(now);
  const calendarWeek: CalendarDay[] = Array.from({ length: 7 }, (_, i) => {
    const d = addDays(monday, i);
    const key = dayKey(d);
    return {
      key,
      label: format(d, "EEEEE"),
      active: (perDay.get(key) ?? 0) > 0,
      isToday: key === todayKey,
      isFuture: key > todayKey,
    };
  });

  const monthPrefix = format(now, "yyyy-MM");
  let monthCount = 0;
  for (const [key, n] of perDay) if (key.startsWith(monthPrefix)) monthCount += n;

  const goalProgress: GoalProgress[] = goals.map((goal) => {
    const own = chiTasks.filter((t) => t.projectId === goal.id);
    const done = own.filter((t) => t.completed).length;
    const total = own.length;
    const hasTarget = !!goal.target && goal.target > 0;
    const current = goalCurrent(goal);
    const pct = hasTarget
      ? Math.min(100, Math.round((current / goal.target!) * 100))
      : total > 0
        ? Math.round((done / total) * 100)
        : 0;
    return {
      goal,
      done,
      total,
      current,
      target: hasTarget ? goal.target : undefined,
      unit: goal.unit,
      pct,
      achieved: isGoalAchieved(goal, own),
    };
  });

  return {
    tasksDone: chiTasks.filter((t) => t.completed).length,
    activityTotal: [...perDay.values()].reduce((a, b) => a + b, 0),
    streak,
    bestStreak,
    bestDay: Math.max(0, ...perDay.values()),
    weekCount: week.reduce((n, d) => n + d.count, 0),
    monthCount,
    week,
    calendarWeek,
    weekActiveDays: calendarWeek.filter((d) => d.active).length,
    goals: goalProgress.filter((g) => !g.goal.completed),
    goalsFinished: goalProgress.filter((g) => g.goal.completed || g.achieved).length,
    goalsCreated: goals.length,
  };
}
