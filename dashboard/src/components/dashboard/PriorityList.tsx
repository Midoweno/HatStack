import { useMemo } from "react";
import {
  DndContext,
  PointerSensor,
  closestCenter,
  useSensor,
  useSensors,
  type DragEndEvent,
} from "@dnd-kit/core";
import { SortableContext, arrayMove, verticalListSortingStrategy } from "@dnd-kit/sortable";
import type { Project, Task } from "@/lib/dashboard-types";
import { useDashboard } from "@/lib/dashboard-store";
import { TaskItem } from "./TaskItem";

interface Props {
  tasks: Task[];
  projects: Project[];
  onEditTask: (t: Task) => void;
}

export function PriorityList({ tasks, projects, onEditTask }: Props) {
  const reorderPriority = useDashboard((s) => s.reorderPriority);
  const projectById = new Map(projects.map((p) => [p.id, p]));

  const starredTasks = useMemo(
    () =>
      tasks
        .filter((t) => t.starred && !t.completed)
        .sort((a, b) => (b.starOrder ?? 0) - (a.starOrder ?? 0)),
    [tasks],
  );

  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 5 } }),
  );

  const onDragEnd = (e: DragEndEvent) => {
    const { active, over } = e;
    if (!over || active.id === over.id) return;
    const ids = starredTasks.map((t) => t.id);
    const oldIndex = ids.indexOf(String(active.id));
    const newIndex = ids.indexOf(String(over.id));
    if (oldIndex === -1 || newIndex === -1) return;
    reorderPriority(arrayMove(ids, oldIndex, newIndex));
  };

  if (starredTasks.length === 0) {
    return (
      <div className="mx-auto max-w-xl rounded-2xl border border-dashed border-hairline px-6 py-16 text-center text-sm text-ink-faint">
        No starred tasks yet — hover a task in the Hats view and click the
        star to pin it here.
      </div>
    );
  }

  return (
    <div className="mx-auto max-w-xl">
      <DndContext sensors={sensors} collisionDetection={closestCenter} onDragEnd={onDragEnd}>
        <SortableContext items={starredTasks.map((t) => t.id)} strategy={verticalListSortingStrategy}>
          <div className="space-y-0.5 rounded-2xl border border-hairline-strong bg-surface p-3">
            {starredTasks.map((t) => (
              <TaskItem
                key={t.id}
                task={t}
                project={t.projectId ? projectById.get(t.projectId) : undefined}
                onEdit={onEditTask}
                dragMode="sortable"
              />
            ))}
          </div>
        </SortableContext>
      </DndContext>
    </div>
  );
}
