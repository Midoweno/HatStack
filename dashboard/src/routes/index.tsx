import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useMemo, useState } from "react";
import {
  DndContext,
  DragOverlay,
  PointerSensor,
  useSensor,
  useSensors,
  type DragEndEvent,
  type DragStartEvent,
} from "@dnd-kit/core";
import { Archive, LogOut, Plus } from "lucide-react";
import { format } from "date-fns";
import { HATS, URGENCY_META, type Hat, type Project, type Space, type Task } from "@/lib/dashboard-types";
import { useDashboard } from "@/lib/dashboard-store";
import { useAuth } from "@/lib/use-auth";
import { supabase } from "@/lib/supabase";
import { cn } from "@/lib/utils";
import { LoginScreen } from "@/components/auth/LoginScreen";
import { ThemeToggle } from "@/components/ThemeToggle";
import { Button } from "@/components/ui/button";
import { HatColumn } from "@/components/dashboard/HatColumn";
import { PriorityList } from "@/components/dashboard/PriorityList";
import { ProjectDialog } from "@/components/dashboard/ProjectDialog";
import { TaskDialog } from "@/components/dashboard/TaskDialog";
import { ArchiveSheet } from "@/components/dashboard/ArchiveSheet";
import { ProjectTasksDialog } from "@/components/dashboard/ProjectTasksDialog";
import { ChiView } from "@/components/chi/ChiView";
import { GoalDialog } from "@/components/chi/GoalDialog";

type ViewMode = "hats" | "priority" | "chi";

const VIEWS: { id: ViewMode; label: string }[] = [
  { id: "hats", label: "Hats" },
  { id: "priority", label: "Priority" },
  { id: "chi", label: "CHI" },
];

export const Route = createFileRoute("/")({
  component: IndexRoute,
});

function IndexRoute() {
  const { session, loading, event } = useAuth();
  const loadingData = useDashboard((s) => s.loading);
  const loadError = useDashboard((s) => s.loadError);
  const init = useDashboard((s) => s.init);
  const reset = useDashboard((s) => s.reset);

  useEffect(() => {
    if (session?.user.id) {
      init(session.user.id);
    } else if (event === "SIGNED_OUT") {
      // Only wipe loaded state on an explicit sign-out. Supabase's auth
      // listener can momentarily report a null session during token refresh
      // (e.g. after a mobile tab resumes from background) — treating that
      // as a sign-out was clearing projects/tasks from the store until the
      // user manually refreshed the page.
      reset();
    }
  }, [session?.user.id, event, init, reset]);

  // If the first load failed, try again on its own as soon as the connection
  // is back or the tab is revisited, rather than waiting for a manual reload.
  useEffect(() => {
    const userId = session?.user.id;
    if (!loadError || !userId) return;
    const retry = () => init(userId);
    const onVisible = () => {
      if (document.visibilityState === "visible") retry();
    };
    window.addEventListener("online", retry);
    document.addEventListener("visibilitychange", onVisible);
    return () => {
      window.removeEventListener("online", retry);
      document.removeEventListener("visibilitychange", onVisible);
    };
  }, [loadError, session?.user.id, init]);

  if (loading) return null;
  if (!session) return <LoginScreen />;
  if (loadingData) return null;
  if (loadError) {
    return <LoadErrorScreen message={loadError} onRetry={() => init(session.user.id)} />;
  }

  return <Dashboard />;
}

function LoadErrorScreen({ message, onRetry }: { message: string; onRetry: () => void }) {
  return (
    <div className="flex min-h-screen items-center justify-center bg-background px-4">
      <div className="w-full max-w-sm text-center">
        <h1 className="font-display text-3xl text-ink">Couldn't load your tasks</h1>
        <p className="mt-2 text-sm text-ink-soft">
          Your tasks are safe — we just couldn't reach them. A retry usually fixes it.
        </p>
        <p className="mt-3 break-words text-xs text-ink-faint">{message}</p>
        <Button className="mt-6 w-full" onClick={onRetry}>
          Try again
        </Button>
      </div>
    </div>
  );
}

function Dashboard() {
  const allProjects = useDashboard((s) => s.projects);
  const allTasks = useDashboard((s) => s.tasks);
  // Hats and Priority only ever see Hats data; CHI has its own space.
  const projects = useMemo(() => allProjects.filter((p) => p.space !== "chi"), [allProjects]);
  const tasks = useMemo(() => allTasks.filter((t) => t.space !== "chi"), [allTasks]);
  const moveTaskToHat = useDashboard((s) => s.moveTaskToHat);

  const [projectDialog, setProjectDialog] = useState<{
    open: boolean;
    hat?: Hat;
    project?: Project | null;
  }>({ open: false });
  const [taskDialog, setTaskDialog] = useState<{
    open: boolean;
    hat?: Hat;
    task?: Task | null;
    defaultProjectId?: string;
    space?: Space;
  }>({ open: false });
  const [goalDialog, setGoalDialog] = useState<{
    open: boolean;
    goal?: Project | null;
    passion?: string;
  }>({ open: false });
  const [archiveOpen, setArchiveOpen] = useState(false);
  const [openProject, setOpenProject] = useState<Project | null>(null);
  const [view, setView] = useState<ViewMode>("priority");
  const [activeTaskId, setActiveTaskId] = useState<string | null>(null);

  // "N" opens New Task, and Left/Right arrows cycle the view tabs — unless
  // the user is typing somewhere (including navigating a date input's
  // segments with the arrow keys) or another dialog is already up.
  useEffect(() => {
    const dialogsOpen =
      projectDialog.open || taskDialog.open || goalDialog.open || archiveOpen || !!openProject;
    if (dialogsOpen) return;
    const handler = (e: KeyboardEvent) => {
      if (e.metaKey || e.ctrlKey || e.altKey) return;
      const target = e.target as HTMLElement;
      if (["INPUT", "TEXTAREA", "SELECT"].includes(target.tagName) || target.isContentEditable) {
        return;
      }
      if (e.key.toLowerCase() === "n") {
        e.preventDefault();
        setTaskDialog({ open: true, space: view === "chi" ? "chi" : undefined });
      } else if (e.key === "ArrowLeft" || e.key === "ArrowRight") {
        e.preventDefault();
        const idx = VIEWS.findIndex((v) => v.id === view);
        const delta = e.key === "ArrowRight" ? 1 : -1;
        setView(VIEWS[(idx + delta + VIEWS.length) % VIEWS.length].id);
      }
    };
    window.addEventListener("keydown", handler);
    return () => window.removeEventListener("keydown", handler);
  }, [projectDialog.open, taskDialog.open, goalDialog.open, archiveOpen, openProject, view]);

  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { delay: 200, tolerance: 8 } }),
  );

  const onDragStart = (e: DragStartEvent) => {
    setActiveTaskId((e.active.data.current?.taskId as string | undefined) ?? null);
  };

  const onDragEnd = (e: DragEndEvent) => {
    setActiveTaskId(null);
    const taskId = e.active.data.current?.taskId as string | undefined;
    const hat = e.over?.data.current?.hat as Hat | undefined;
    if (taskId && hat) moveTaskToHat(taskId, hat);
  };

  const activeTask = activeTaskId ? tasks.find((t) => t.id === activeTaskId) : null;

  const today = useMemo(() => format(new Date(), "EEEE, MMMM d"), []);

  return (
    <div className="min-h-screen bg-background">
      <header className="mx-auto max-w-[1600px] px-4 pt-8 pb-5 sm:px-10 sm:pt-10 sm:pb-6">
        <div className="flex flex-col gap-4 sm:grid sm:grid-cols-[minmax(0,1fr)_auto] sm:items-end">
          <div className="min-w-0">
            <p className="text-xs uppercase tracking-[0.18em] text-ink-faint">
              {today}
            </p>
            <h1 className="mt-1 font-display text-4xl text-ink sm:text-5xl">
              What's on the agenda?
            </h1>
            <div className="mt-3 inline-flex rounded-full border border-hairline bg-surface p-0.5">
              {VIEWS.map((v) => (
                <button
                  key={v.id}
                  onClick={() => setView(v.id)}
                  className={cn(
                    "rounded-full px-3 py-1 text-xs font-medium transition-colors",
                    view === v.id
                      ? v.id === "chi"
                        ? "bg-chi text-white"
                        : "bg-ink text-background"
                      : "text-ink-faint hover:text-ink-soft",
                  )}
                >
                  {v.label}
                </button>
              ))}
            </div>
          </div>
          <div className="flex flex-wrap shrink-0 items-center gap-2">
            <ThemeToggle />
            <Button
              variant="ghost"
              size="sm"
              onClick={() => setArchiveOpen(true)}
              className="text-ink-soft"
            >
              <Archive className="mr-1.5 h-4 w-4" />
              Archive
            </Button>
            <Button
              size="sm"
              onClick={() => setTaskDialog({ open: true, space: view === "chi" ? "chi" : undefined })}
            >
              <Plus className="mr-1 h-4 w-4" />
              New task
            </Button>
            <Button
              variant="ghost"
              size="sm"
              onClick={() => supabase.auth.signOut()}
              className="text-ink-soft"
            >
              <LogOut className="mr-1.5 h-4 w-4" />
              Sign out
            </Button>
          </div>
        </div>
      </header>

      <main className="mx-auto max-w-[1600px] px-3 pb-16 sm:px-10">
        {view === "hats" ? (
          <DndContext sensors={sensors} onDragStart={onDragStart} onDragEnd={onDragEnd}>
            <div className="grid grid-cols-1 gap-5 lg:grid-cols-3">
              {HATS.map((h) => (
                <HatColumn
                  key={h.id}
                  hat={h.id}
                  label={h.label}
                  projects={projects}
                  tasks={tasks}
                  onAddProject={() =>
                    setProjectDialog({ open: true, hat: h.id, project: null })
                  }
                  onAddTask={() =>
                    setTaskDialog({ open: true, hat: h.id, task: null })
                  }
                  onEditProject={(p) =>
                    setProjectDialog({ open: true, hat: p.hat, project: p })
                  }
                  onEditTask={(t) =>
                    setTaskDialog({ open: true, hat: t.hat, task: t })
                  }
                  onOpenProject={(p) => setOpenProject(p)}
                />
              ))}
            </div>
            <DragOverlay>
              {activeTask && (
                <div
                  className={cn(
                    "flex items-center rounded-full px-3 py-1.5 shadow-lg",
                    URGENCY_META[activeTask.urgency].dot,
                    URGENCY_META[activeTask.urgency].pillText,
                  )}
                >
                  <p className="text-sm leading-snug">{activeTask.name}</p>
                </div>
              )}
            </DragOverlay>
          </DndContext>
        ) : view === "chi" ? (
          <ChiView
            tasks={allTasks}
            projects={allProjects}
            onNewTask={(goalId) =>
              setTaskDialog({ open: true, space: "chi", task: null, defaultProjectId: goalId })
            }
            onEditTask={(t) => setTaskDialog({ open: true, space: "chi", task: t })}
            onNewGoal={(passion) => setGoalDialog({ open: true, goal: null, passion })}
            onEditGoal={(g) => setGoalDialog({ open: true, goal: g })}
          />
        ) : (
          <PriorityList
            tasks={tasks}
            projects={projects}
            onEditTask={(t) => setTaskDialog({ open: true, hat: t.hat, task: t })}
          />
        )}

        <footer className="mt-8 flex flex-wrap items-center gap-x-5 gap-y-2 text-[11px] text-ink-faint">
          <span className="uppercase tracking-[0.14em]">Urgency</span>
          <span className="inline-flex items-center gap-1.5">
            <span className="h-2 w-2 rounded-full bg-urgency-critical" /> Critical
          </span>
          <span className="inline-flex items-center gap-1.5">
            <span className="h-2 w-2 rounded-full bg-urgency-high" /> High
          </span>
          <span className="inline-flex items-center gap-1.5">
            <span className="h-2 w-2 rounded-full bg-urgency-medium" /> Medium
          </span>
          <span className="inline-flex items-center gap-1.5">
            <span className="h-2 w-2 rounded-full bg-urgency-low" /> Low
          </span>
        </footer>
      </main>

      <ProjectDialog
        open={projectDialog.open}
        onOpenChange={(v) =>
          setProjectDialog((s) => ({ ...s, open: v, project: v ? s.project : null }))
        }
        defaultHat={projectDialog.hat}
        project={projectDialog.project}
      />
      <TaskDialog
        open={taskDialog.open}
        onOpenChange={(v) =>
          setTaskDialog((s) => ({ ...s, open: v, task: v ? s.task : null }))
        }
        defaultHat={taskDialog.hat}
        defaultProjectId={taskDialog.defaultProjectId}
        task={taskDialog.task}
        space={taskDialog.space}
      />
      <GoalDialog
        open={goalDialog.open}
        onOpenChange={(v) => setGoalDialog((s) => ({ ...s, open: v, goal: v ? s.goal : null }))}
        goal={goalDialog.goal}
        defaultPassion={goalDialog.passion}
      />
      <ArchiveSheet
        open={archiveOpen}
        onOpenChange={setArchiveOpen}
        space={view === "chi" ? "chi" : "hats"}
      />
      <ProjectTasksDialog
        project={openProject}
        onOpenChange={(v) => !v && setOpenProject(null)}
        tasks={tasks}
        onEditTask={(t) => {
          setOpenProject(null);
          setTaskDialog({ open: true, hat: t.hat, task: t });
        }}
        onAddTask={(p) => {
          setOpenProject(null);
          setTaskDialog({ open: true, hat: p.hat, task: null, defaultProjectId: p.id });
        }}
      />
    </div>
  );
}
