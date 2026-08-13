import { useMemo, useState } from "react";
import {
  addDays,
  addMonths,
  addWeeks,
  eachDayOfInterval,
  endOfMonth,
  endOfWeek,
  format,
  isSameMonth,
  isToday,
  startOfMonth,
  startOfWeek,
  subDays,
  subMonths,
  subWeeks,
} from "date-fns";
import { ChevronLeft, ChevronRight } from "lucide-react";
import type { Task } from "@/lib/dashboard-types";
import { URGENCY_META, URGENCY_ORDER } from "@/lib/dashboard-types";
import { useDashboard } from "@/lib/dashboard-store";
import { Checkbox } from "@/components/ui/checkbox";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

type ViewMode = "day" | "week" | "month";

interface Props {
  tasks: Task[];
  onEditTask: (t: Task) => void;
}

const WEEKDAY_LABELS = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];

function sortTasks(tasks: Task[]) {
  return [...tasks].sort((a, b) => URGENCY_ORDER[a.urgency] - URGENCY_ORDER[b.urgency]);
}

export function CalendarView({ tasks, onEditTask }: Props) {
  const [viewMode, setViewMode] = useState<ViewMode>("week");
  const [anchor, setAnchor] = useState(new Date());

  const datedTasks = useMemo(
    () => tasks.filter((t) => !t.completed && !t.parentTaskId && t.dueDate),
    [tasks],
  );
  const tasksByDate = useMemo(() => {
    const map = new Map<string, Task[]>();
    for (const t of datedTasks) {
      const key = t.dueDate!;
      if (!map.has(key)) map.set(key, []);
      map.get(key)!.push(t);
    }
    return map;
  }, [datedTasks]);

  const goPrev = () => {
    setAnchor((d) => (viewMode === "day" ? subDays(d, 1) : viewMode === "week" ? subWeeks(d, 1) : subMonths(d, 1)));
  };
  const goNext = () => {
    setAnchor((d) => (viewMode === "day" ? addDays(d, 1) : viewMode === "week" ? addWeeks(d, 1) : addMonths(d, 1)));
  };
  const goToday = () => setAnchor(new Date());

  const jumpToDay = (day: Date) => {
    setAnchor(day);
    setViewMode("day");
  };

  const headerLabel =
    viewMode === "day"
      ? format(anchor, "EEEE, MMMM d, yyyy")
      : viewMode === "week"
        ? (() => {
            const start = startOfWeek(anchor, { weekStartsOn: 0 });
            const end = endOfWeek(anchor, { weekStartsOn: 0 });
            return `${format(start, "MMM d")} – ${format(end, "MMM d, yyyy")}`;
          })()
        : format(anchor, "MMMM yyyy");

  return (
    <div className="rounded-2xl border border-hairline-strong bg-surface">
      <header className="flex flex-wrap items-center justify-between gap-3 border-b border-hairline px-5 pt-5 pb-4">
        <h2 className="font-display text-2xl text-ink">{headerLabel}</h2>
        <div className="flex items-center gap-2">
          <div className="inline-flex rounded-full border border-hairline bg-surface p-0.5">
            {(["day", "week", "month"] as const).map((v) => (
              <button
                key={v}
                onClick={() => setViewMode(v)}
                className={cn(
                  "rounded-full px-3 py-1 text-xs font-medium capitalize transition-colors",
                  viewMode === v ? "bg-ink text-background" : "text-ink-faint hover:text-ink-soft",
                )}
              >
                {v}
              </button>
            ))}
          </div>
          <div className="flex items-center gap-1">
            <Button variant="ghost" size="icon" onClick={goPrev} aria-label="Previous">
              <ChevronLeft className="h-4 w-4" />
            </Button>
            <Button variant="ghost" size="sm" onClick={goToday}>
              Today
            </Button>
            <Button variant="ghost" size="icon" onClick={goNext} aria-label="Next">
              <ChevronRight className="h-4 w-4" />
            </Button>
          </div>
        </div>
      </header>

      {viewMode === "day" && (
        <DayView tasks={sortTasks(tasksByDate.get(format(anchor, "yyyy-MM-dd")) ?? [])} onEditTask={onEditTask} />
      )}
      {viewMode === "week" && <WeekView anchor={anchor} tasksByDate={tasksByDate} onEditTask={onEditTask} />}
      {viewMode === "month" && (
        <MonthView anchor={anchor} tasksByDate={tasksByDate} onEditTask={onEditTask} onJumpToDay={jumpToDay} />
      )}
    </div>
  );
}

function DayView({ tasks, onEditTask }: { tasks: Task[]; onEditTask: (t: Task) => void }) {
  if (tasks.length === 0) {
    return <p className="px-5 py-10 text-center text-sm text-ink-faint">Nothing due today.</p>;
  }
  return (
    <div className="space-y-1.5 p-4">
      {tasks.map((t) => (
        <CalendarTaskChip key={t.id} task={t} onEdit={onEditTask} showCheckbox size="full" />
      ))}
    </div>
  );
}

function WeekView({
  anchor,
  tasksByDate,
  onEditTask,
}: {
  anchor: Date;
  tasksByDate: Map<string, Task[]>;
  onEditTask: (t: Task) => void;
}) {
  const start = startOfWeek(anchor, { weekStartsOn: 0 });
  const days = Array.from({ length: 7 }, (_, i) => addDays(start, i));

  return (
    <div className="grid grid-cols-1 divide-y divide-hairline sm:grid-cols-7 sm:divide-x sm:divide-y-0">
      {days.map((day, i) => {
        const key = format(day, "yyyy-MM-dd");
        const dayTasks = sortTasks(tasksByDate.get(key) ?? []);
        return (
          <div key={key} className="flex min-h-[140px] flex-col gap-1.5 p-3">
            <div className="flex items-center justify-between">
              <span
                className={cn(
                  "text-[10px] font-semibold uppercase tracking-[0.1em]",
                  isToday(day) ? "rounded-full bg-ink px-2 py-0.5 text-background" : "text-ink-faint",
                )}
              >
                {WEEKDAY_LABELS[i]}
              </span>
              <span
                className={cn(
                  "text-xs tabular-nums",
                  isToday(day)
                    ? "rounded-full bg-ink px-2 py-0.5 font-semibold text-background"
                    : "text-ink-faint",
                )}
              >
                {format(day, "d")}
              </span>
            </div>
            <div className="space-y-1">
              {dayTasks.map((t) => (
                <CalendarTaskChip key={t.id} task={t} onEdit={onEditTask} showCheckbox size="compact" />
              ))}
            </div>
          </div>
        );
      })}
    </div>
  );
}

function MonthView({
  anchor,
  tasksByDate,
  onEditTask,
  onJumpToDay,
}: {
  anchor: Date;
  tasksByDate: Map<string, Task[]>;
  onEditTask: (t: Task) => void;
  onJumpToDay: (day: Date) => void;
}) {
  const gridStart = startOfWeek(startOfMonth(anchor), { weekStartsOn: 0 });
  const gridEnd = endOfWeek(endOfMonth(anchor), { weekStartsOn: 0 });
  const days = eachDayOfInterval({ start: gridStart, end: gridEnd });
  const MAX_VISIBLE = 3;

  return (
    <div>
      <div className="grid grid-cols-7 border-b border-hairline">
        {WEEKDAY_LABELS.map((label) => (
          <div
            key={label}
            className="px-2 py-2 text-center text-[10px] font-semibold uppercase tracking-[0.1em] text-ink-faint"
          >
            {label}
          </div>
        ))}
      </div>
      <div className="grid grid-cols-7">
        {days.map((day) => {
          const key = format(day, "yyyy-MM-dd");
          const dayTasks = sortTasks(tasksByDate.get(key) ?? []);
          const visible = dayTasks.slice(0, MAX_VISIBLE);
          const overflow = dayTasks.length - visible.length;
          const inMonth = isSameMonth(day, anchor);

          return (
            <div
              key={key}
              className={cn(
                "flex min-h-[90px] flex-col gap-1 border-b border-r border-hairline p-1.5 last:border-r-0",
                !inMonth && "bg-surface-elevated/40",
              )}
            >
              <button
                onClick={() => onJumpToDay(day)}
                className={cn(
                  "self-start text-xs tabular-nums",
                  isToday(day)
                    ? "rounded-full bg-ink px-1.5 py-0.5 font-semibold text-background"
                    : !inMonth
                      ? "text-ink-faint/50"
                      : "text-ink-soft",
                )}
              >
                {format(day, "d")}
              </button>
              <div className="space-y-0.5">
                {visible.map((t) => (
                  <CalendarTaskChip key={t.id} task={t} onEdit={onEditTask} size="dot" />
                ))}
                {overflow > 0 && (
                  <button
                    onClick={() => onJumpToDay(day)}
                    className="text-[10px] text-ink-faint hover:text-ink-soft"
                  >
                    +{overflow} more
                  </button>
                )}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}

function CalendarTaskChip({
  task,
  onEdit,
  showCheckbox,
  size,
}: {
  task: Task;
  onEdit: (t: Task) => void;
  showCheckbox?: boolean;
  size: "full" | "compact" | "dot";
}) {
  const toggleTask = useDashboard((s) => s.toggleTask);
  const u = URGENCY_META[task.urgency];

  if (size === "dot") {
    return (
      <button
        onClick={() => onEdit(task)}
        className="flex w-full items-center gap-1 truncate text-left text-[10px] text-ink-soft hover:text-ink"
      >
        <span className={cn("h-1.5 w-1.5 shrink-0 rounded-full", u.dot)} />
        <span className="truncate">{task.name}</span>
      </button>
    );
  }

  return (
    <div
      onClick={() => onEdit(task)}
      className={cn(
        "flex cursor-pointer items-center gap-1.5 rounded-full transition-opacity hover:opacity-90",
        u.dot,
        u.pillText,
        size === "full" ? "px-3 py-1.5 text-sm" : "px-2 py-1 text-[11px]",
      )}
    >
      {showCheckbox && (
        <span onClick={(e) => e.stopPropagation()} className="shrink-0">
          <Checkbox
            checked={task.completed}
            onCheckedChange={() => toggleTask(task.id)}
            className="h-3.5 w-3.5 border-current"
          />
        </span>
      )}
      <span className="truncate">{task.name}</span>
    </div>
  );
}
