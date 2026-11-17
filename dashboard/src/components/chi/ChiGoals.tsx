import { differenceInCalendarDays, format, parseISO } from "date-fns";
import { Check, Pencil, Plus } from "lucide-react";
import type { Project, Task } from "@/lib/dashboard-types";
import { Button } from "@/components/ui/button";
import { TaskItem } from "@/components/dashboard/TaskItem";
import { cn } from "@/lib/utils";
import { Enso } from "./Enso";

interface Props {
  tasks: Task[];
  projects: Project[];
  onNewTask: (goalId?: string) => void;
  onEditTask: (task: Task) => void;
  onNewGoal: (passion?: string) => void;
  onEditGoal: (goal: Project) => void;
}

const UNSORTED = "Unsorted";

function byDueThenCreated(a: Task, b: Task) {
  if (a.dueDate && b.dueDate && a.dueDate !== b.dueDate) return a.dueDate < b.dueDate ? -1 : 1;
  if (a.dueDate && !b.dueDate) return -1;
  if (!a.dueDate && b.dueDate) return 1;
  return a.createdAt - b.createdAt;
}

function targetLabel(dueDate: string | undefined) {
  if (!dueDate) return "No target date";
  const days = differenceInCalendarDays(parseISO(dueDate), new Date());
  const when =
    days > 1 ? `${days} days left` : days === 1 ? "tomorrow" : days === 0 ? "today" : `${-days}d past`;
  return `By ${format(parseISO(dueDate), "MMM d")} · ${when}`;
}

export function ChiGoals({ tasks, projects, onNewTask, onEditTask, onNewGoal, onEditGoal }: Props) {
  const goals = projects.filter((p) => p.space === "chi");
  const chiTasks = tasks.filter((t) => t.space === "chi" && !t.parentTaskId);
  const goalIds = new Set(goals.map((g) => g.id));
  const looseOpen = chiTasks
    .filter((t) => !t.completed && (!t.projectId || !goalIds.has(t.projectId)))
    .sort(byDueThenCreated);

  const byPassion = new Map<string, Project[]>();
  for (const g of goals) {
    const key = g.passion?.trim() || UNSORTED;
    byPassion.set(key, [...(byPassion.get(key) ?? []), g]);
  }
  const passions = [...byPassion.keys()].sort((a, b) =>
    a === UNSORTED ? 1 : b === UNSORTED ? -1 : a.localeCompare(b, undefined, { sensitivity: "base" }),
  );

  if (goals.length === 0 && looseOpen.length === 0) {
    return (
      <div className="flex flex-col items-center rounded-3xl border border-dashed border-hairline-strong px-6 py-20 text-center">
        <Enso className="h-20 w-20 text-chi" strokeWidth={1.6} />
        <h3 className="mt-6 font-display text-3xl text-ink">Start with a goal</h3>
        <p className="mt-2 max-w-xs text-sm text-ink-soft">
          Name what you want to make real, then break it into tasks. Every finished task becomes
          visible progress.
        </p>
        <Button
          className="mt-6 bg-chi text-white hover:bg-chi/90"
          onClick={() => onNewGoal()}
        >
          <Plus className="mr-1.5 h-4 w-4" /> New goal
        </Button>
      </div>
    );
  }

  return (
    <div className="space-y-9">
      <div className="flex justify-end">
        <Button
          variant="outline"
          size="sm"
          className="border-chi/40 text-chi hover:bg-chi-soft hover:text-chi"
          onClick={() => onNewGoal()}
        >
          <Plus className="mr-1 h-4 w-4" /> New goal
        </Button>
      </div>

      {passions.map((passion) => (
        <section key={passion}>
          <h3 className="mb-3 px-1 text-[11px] font-semibold uppercase tracking-[0.2em] text-chi">
            {passion}
          </h3>
          <div className="space-y-4">
            {byPassion.get(passion)!.map((goal) => (
              <GoalCard
                key={goal.id}
                goal={goal}
                tasks={chiTasks.filter((t) => t.projectId === goal.id)}
                onNewTask={onNewTask}
                onEditTask={onEditTask}
                onEditGoal={onEditGoal}
              />
            ))}
          </div>
        </section>
      ))}

      {looseOpen.length > 0 && (
        <section>
          <h3 className="mb-3 px-1 text-[11px] font-semibold uppercase tracking-[0.2em] text-ink-faint">
            Loose tasks
          </h3>
          <div className="rounded-2xl border border-hairline-strong bg-surface p-3">
            {looseOpen.map((t) => (
              <TaskItem key={t.id} task={t} onEdit={onEditTask} chi />
            ))}
            <AddTaskButton onClick={() => onNewTask(undefined)} />
          </div>
        </section>
      )}
    </div>
  );
}

function AddTaskButton({ onClick }: { onClick: () => void }) {
  return (
    <button
      type="button"
      onClick={onClick}
      className="mt-1 flex w-full items-center justify-center gap-1.5 rounded-lg py-2 text-xs text-ink-faint transition-colors hover:bg-chi-soft hover:text-chi"
    >
      <Plus className="h-3.5 w-3.5" /> Add task
    </button>
  );
}

function GoalCard({
  goal,
  tasks,
  onNewTask,
  onEditTask,
  onEditGoal,
}: {
  goal: Project;
  tasks: Task[];
  onNewTask: (goalId?: string) => void;
  onEditTask: (task: Task) => void;
  onEditGoal: (goal: Project) => void;
}) {
  const done = tasks.filter((t) => t.completed).length;
  const total = tasks.length;
  const pct = total > 0 ? Math.round((done / total) * 100) : 0;
  const finished = total > 0 && done === total;
  const open = tasks.filter((t) => !t.completed).sort(byDueThenCreated);

  return (
    <article
      className={cn(
        "group/goal rounded-2xl border bg-surface p-4 sm:p-5",
        finished ? "border-chi/50 bg-chi-soft/50" : "border-hairline-strong",
      )}
    >
      <header className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <h4 className="font-display text-2xl leading-tight text-ink">{goal.name}</h4>
          {goal.description && (
            <p className="mt-1 text-sm italic text-ink-soft">{goal.description}</p>
          )}
        </div>
        <div className="flex shrink-0 items-center gap-1">
          {finished && (
            <span className="inline-flex items-center gap-1 rounded-full bg-chi px-2 py-0.5 text-[10px] font-bold uppercase tracking-wide text-white">
              <Check className="h-3 w-3" /> Done
            </span>
          )}
          <button
            type="button"
            onClick={() => onEditGoal(goal)}
            aria-label="Edit goal"
            className="rounded-md p-1.5 text-ink-faint opacity-100 transition-opacity hover:text-ink sm:opacity-0 sm:group-hover/goal:opacity-100"
          >
            <Pencil className="h-3.5 w-3.5" />
          </button>
        </div>
      </header>

      <div className="mt-3 flex items-center justify-between text-xs text-ink-faint">
        <span>{targetLabel(goal.dueDate)}</span>
        <span className="tabular-nums">
          {done} / {total}
        </span>
      </div>
      <div className="mt-1.5 h-1 overflow-hidden rounded-full bg-hairline">
        <div
          className="h-full rounded-full bg-chi transition-all duration-700"
          style={{ width: `${pct}%` }}
        />
      </div>

      <div className="mt-3 space-y-0.5">
        {open.map((t) => (
          <TaskItem key={t.id} task={t} onEdit={onEditTask} chi />
        ))}
      </div>
      <AddTaskButton onClick={() => onNewTask(goal.id)} />
    </article>
  );
}
