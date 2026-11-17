import { useEffect, useRef, useState } from "react";
import { Award, BarChart3, Target } from "lucide-react";
import { toast } from "sonner";
import { useDashboard } from "@/lib/dashboard-store";
import { isGoalAchieved } from "@/lib/chi-stats";
import type { Project, Task } from "@/lib/dashboard-types";
import { cn } from "@/lib/utils";
import { Enso } from "./Enso";
import { ChiGoals } from "./ChiGoals";
import { ChiProgress } from "./ChiProgress";
import { ChiAchievements } from "./ChiAchievements";

type ChiTab = "goals" | "progress" | "achievements";

const TABS: { id: ChiTab; label: string; icon: typeof Target }[] = [
  { id: "goals", label: "Goals", icon: Target },
  { id: "progress", label: "Progress", icon: BarChart3 },
  { id: "achievements", label: "Achievements", icon: Award },
];

interface Props {
  tasks: Task[];
  projects: Project[];
  onNewTask: (goalId?: string) => void;
  onEditTask: (task: Task) => void;
  onNewGoal: (passion?: string) => void;
  onEditGoal: (goal: Project) => void;
}

export function ChiView(props: Props) {
  const [tab, setTab] = useState<ChiTab>("goals");
  const completeProject = useDashboard((s) => s.completeProject);
  const uncompleteProject = useDashboard((s) => s.uncompleteProject);

  // The moment a goal becomes achieved (last task ticked, or its number
  // reached) it moves to Achievements. Only a change seen while you're here
  // triggers it, so a goal you reopened isn't moved straight back.
  const wasAchieved = useRef<Map<string, boolean> | null>(null);
  useEffect(() => {
    const chiTasks = props.tasks.filter((t) => t.space === "chi" && !t.parentTaskId);
    const now = new Map<string, boolean>();
    for (const goal of props.projects) {
      if (goal.space !== "chi" || goal.completed) continue;
      const achieved = isGoalAchieved(
        goal,
        chiTasks.filter((t) => t.projectId === goal.id),
      );
      now.set(goal.id, achieved);
      if (wasAchieved.current?.get(goal.id) === false && achieved) {
        completeProject(goal.id);
        toast(`"${goal.name}" achieved`, {
          description: "Moved to Achievements.",
          action: { label: "Undo", onClick: () => uncompleteProject(goal.id) },
          duration: 6000,
        });
      }
    }
    wasAchieved.current = now;
  }, [props.tasks, props.projects, completeProject, uncompleteProject]);

  return (
    <div className="mx-auto max-w-3xl">
      <header className="mb-8 flex items-center gap-4">
        <Enso className="h-14 w-14 shrink-0 text-chi" strokeWidth={2.1} />
        <div>
          <h2 className="font-display text-5xl leading-none text-ink">Chi</h2>
          <p className="mt-1.5 text-sm text-ink-soft">Passion, made tangible.</p>
        </div>
      </header>

      {tab === "goals" && (
        <ChiGoals
          tasks={props.tasks}
          projects={props.projects}
          onNewTask={props.onNewTask}
          onEditTask={props.onEditTask}
          onNewGoal={props.onNewGoal}
          onEditGoal={props.onEditGoal}
        />
      )}
      {tab === "progress" && <ChiProgress tasks={props.tasks} projects={props.projects} />}
      {tab === "achievements" && (
        <ChiAchievements tasks={props.tasks} projects={props.projects} />
      )}

      <nav
        aria-label="CHI sections"
        className="sticky bottom-4 z-20 mx-auto mt-10 flex w-fit items-center gap-1 rounded-full border border-hairline-strong bg-surface/90 p-1.5 shadow-lg backdrop-blur"
      >
        {TABS.map(({ id, label, icon: Icon }) => (
          <button
            key={id}
            type="button"
            onClick={() => setTab(id)}
            aria-current={tab === id ? "page" : undefined}
            className={cn(
              "flex items-center gap-2 rounded-full px-4 py-2 text-sm font-medium transition-colors",
              tab === id ? "bg-chi-soft text-chi" : "text-ink-faint hover:text-ink-soft",
            )}
          >
            <Icon className="h-4 w-4" />
            <span className={cn(tab !== id && "hidden sm:inline")}>{label}</span>
          </button>
        ))}
      </nav>
    </div>
  );
}
