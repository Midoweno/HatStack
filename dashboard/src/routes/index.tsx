import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useMemo, useState } from "react";
import {
  DndContext,
  PointerSensor,
  useSensor,
  useSensors,
  type DragEndEvent,
} from "@dnd-kit/core";
import { Archive, LogOut, Plus } from "lucide-react";
import { format } from "date-fns";
import { HATS, type Hat, type Project, type Task } from "@/lib/dashboard-types";
import { useDashboard } from "@/lib/dashboard-store";
import { useAuth } from "@/lib/use-auth";
import { supabase } from "@/lib/supabase";
import { LoginScreen } from "@/components/auth/LoginScreen";
import { Button } from "@/components/ui/button";
import { HatColumn } from "@/components/dashboard/HatColumn";
import { ProjectDialog } from "@/components/dashboard/ProjectDialog";
import { TaskDialog } from "@/components/dashboard/TaskDialog";
import { ArchiveSheet } from "@/components/dashboard/ArchiveSheet";
import { ProjectTasksDialog } from "@/components/dashboard/ProjectTasksDialog";

export const Route = createFileRoute("/")({
  component: IndexRoute,
});

function IndexRoute() {
  const { session, loading, event } = useAuth();
  const loadingData = useDashboard((s) => s.loading);
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

  if (loading) return null;
  if (!session) return <LoginScreen />;
  if (loadingData) return null;

  return <Dashboard />;
}

function Dashboard() {
  const projects = useDashboard((s) => s.projects);
  const tasks = useDashboard((s) => s.tasks);
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
  }>({ open: false });
  const [archiveOpen, setArchiveOpen] = useState(false);
  const [openProject, setOpenProject] = useState<Project | null>(null);

  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 5 } }),
  );

  const onDragEnd = (e: DragEndEvent) => {
    const taskId = e.active.data.current?.taskId as string | undefined;
    const hat = e.over?.data.current?.hat as Hat | undefined;
    if (taskId && hat) moveTaskToHat(taskId, hat);
  };

  const today = useMemo(() => format(new Date(), "EEEE, MMMM d"), []);

  return (
    <div className="min-h-screen bg-background">
      <header className="mx-auto max-w-[1600px] px-6 pt-10 pb-6 sm:px-10">
        <div className="flex flex-col gap-4 sm:grid sm:grid-cols-[minmax(0,1fr)_auto] sm:items-end">
          <div className="min-w-0">
            <p className="text-xs uppercase tracking-[0.18em] text-ink-faint">
              {today}
            </p>
            <h1 className="mt-1 font-display text-4xl text-ink sm:text-5xl">
              What are we wearing today?
            </h1>
          </div>
          <div className="flex flex-wrap shrink-0 gap-2">
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
              onClick={() => setTaskDialog({ open: true })}
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

      <main className="mx-auto max-w-[1600px] px-6 pb-16 sm:px-10">
        <DndContext sensors={sensors} onDragEnd={onDragEnd}>
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
        </DndContext>

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
      />
      <ArchiveSheet open={archiveOpen} onOpenChange={setArchiveOpen} />
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
