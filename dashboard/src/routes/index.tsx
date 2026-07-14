import { createFileRoute } from "@tanstack/react-router";
import { useMemo, useState } from "react";
import {
  DndContext,
  PointerSensor,
  useSensor,
  useSensors,
  type DragEndEvent,
} from "@dnd-kit/core";
import { Archive, Plus } from "lucide-react";
import { format } from "date-fns";
import { HATS, type Hat, type Project, type Task } from "@/lib/dashboard-types";
import { useDashboard } from "@/lib/dashboard-store";
import { Button } from "@/components/ui/button";
import { HatColumn } from "@/components/dashboard/HatColumn";
import { ProjectDialog } from "@/components/dashboard/ProjectDialog";
import { TaskDialog } from "@/components/dashboard/TaskDialog";
import { ArchiveSheet } from "@/components/dashboard/ArchiveSheet";

export const Route = createFileRoute("/")({
  component: Dashboard,
});

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
  }>({ open: false });
  const [archiveOpen, setArchiveOpen] = useState(false);

  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 5 } }),
  );

  const onDragEnd = (e: DragEndEvent) => {
    const taskId = e.active.data.current?.taskId as string | undefined;
    const hat = e.over?.data.current?.hat as Hat | undefined;
    if (taskId && hat) moveTaskToHat(taskId, hat);
  };

  const today = useMemo(() => format(new Date(), "EEEE, MMMM d"), []);
  const openTaskCount = tasks.filter((t) => !t.completed).length;

  return (
    <div className="min-h-screen bg-background">
      <header className="mx-auto max-w-[1600px] px-6 pt-10 pb-6 sm:px-10">
        <div className="grid grid-cols-[minmax(0,1fr)_auto] items-end gap-4">
          <div className="min-w-0">
            <p className="text-xs uppercase tracking-[0.18em] text-ink-faint">
              {today}
            </p>
            <h1 className="mt-1 font-display text-4xl text-ink sm:text-5xl">
              What are you wearing today?
            </h1>
            <p className="mt-2 max-w-2xl text-sm text-ink-soft">
              Three hats. {openTaskCount} open{" "}
              {openTaskCount === 1 ? "task" : "tasks"}. Execute in urgency order —
              projects give context, tasks give action.
            </p>
          </div>
          <div className="flex shrink-0 gap-2">
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
        task={taskDialog.task}
      />
      <ArchiveSheet open={archiveOpen} onOpenChange={setArchiveOpen} />
    </div>
  );
}
