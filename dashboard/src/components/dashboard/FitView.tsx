import { useState } from "react";
import { addDays, addWeeks, format, isToday, startOfWeek } from "date-fns";
import {
  DndContext,
  PointerSensor,
  closestCenter,
  useSensor,
  useSensors,
  type DragEndEvent,
} from "@dnd-kit/core";
import { SortableContext, arrayMove, useSortable, verticalListSortingStrategy } from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";
import { CheckCircle2, ChevronLeft, ChevronRight, Circle, Dumbbell, GripVertical, Pencil, Plus, X } from "lucide-react";
import { useDashboard } from "@/lib/dashboard-store";
import type { Drill, Workout } from "@/lib/dashboard-types";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { cn } from "@/lib/utils";

const WEEKDAY_LABELS = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];

export function FitView() {
  const workouts = useDashboard((s) => s.workouts);
  const drills = useDashboard((s) => s.drills);
  const addDrillToDay = useDashboard((s) => s.addDrillToDay);
  const removeWorkoutEntry = useDashboard((s) => s.removeWorkoutEntry);
  const addDrill = useDashboard((s) => s.addDrill);
  const updateDrill = useDashboard((s) => s.updateDrill);
  const deleteDrill = useDashboard((s) => s.deleteDrill);
  const reorderDrills = useDashboard((s) => s.reorderDrills);

  const [weekOffset, setWeekOffset] = useState(0);
  const [newDrillName, setNewDrillName] = useState("");
  const [editingDrillId, setEditingDrillId] = useState<string | null>(null);
  const [editingDrillName, setEditingDrillName] = useState("");

  const weekStart = startOfWeek(addWeeks(new Date(), weekOffset), { weekStartsOn: 0 });
  const days = Array.from({ length: 7 }, (_, i) => addDays(weekStart, i));
  const weekEnd = days[6];

  const workoutByDate = new Map(workouts.map((w) => [w.date, w]));
  const drillById = new Map(drills.map((d) => [d.id, d]));
  const sortedDrills = [...drills].sort((a, b) => a.position - b.position);

  // Which drills have been placed on at least one day in the week currently
  // being viewed — the library shows a check next to each one, so it's easy
  // to see which are still missing for the week.
  const drillsDoneThisWeek = new Set<string>();
  for (const day of days) {
    const w = workoutByDate.get(format(day, "yyyy-MM-dd"));
    w?.entries.forEach((e) => drillsDoneThisWeek.add(e.drillId));
  }

  const sensors = useSensors(useSensor(PointerSensor, { activationConstraint: { distance: 5 } }));

  // The library's own drag-to-reorder — placing drills onto days is a
  // separate hover-and-click picker (see FitDay), not drag-and-drop.
  const onDragEnd = (e: DragEndEvent) => {
    const { active, over } = e;
    if (!over || active.id === over.id) return;
    const ids = sortedDrills.map((d) => d.id);
    const oldIndex = ids.indexOf(String(active.id));
    const newIndex = ids.indexOf(String(over.id));
    if (oldIndex === -1 || newIndex === -1) return;
    reorderDrills(arrayMove(ids, oldIndex, newIndex));
  };

  const submitNewDrill = () => {
    const name = newDrillName.trim();
    if (name) addDrill(name);
    setNewDrillName("");
  };

  const startEditDrill = (drill: Drill) => {
    setEditingDrillId(drill.id);
    setEditingDrillName(drill.name);
  };

  const saveEditDrill = () => {
    const name = editingDrillName.trim();
    if (editingDrillId && name) updateDrill(editingDrillId, name);
    setEditingDrillId(null);
  };

  return (
    <div className="grid grid-cols-1 gap-5 lg:grid-cols-[1fr_260px]">
      <div className="rounded-2xl border border-hairline-strong bg-surface">
        <header className="flex flex-wrap items-center justify-between gap-2 border-b border-hairline px-5 pt-5 pb-4">
          <h2 className="font-display text-2xl text-ink">
            {format(weekStart, "MMM d")} – {format(weekEnd, "MMM d, yyyy")}
          </h2>
          <div className="flex items-center gap-1">
            <Button
              variant="ghost"
              size="icon"
              onClick={() => setWeekOffset((w) => w - 1)}
              aria-label="Previous week"
            >
              <ChevronLeft className="h-4 w-4" />
            </Button>
            {weekOffset !== 0 && (
              <Button variant="ghost" size="sm" onClick={() => setWeekOffset(0)}>
                This week
              </Button>
            )}
            <Button
              variant="ghost"
              size="icon"
              onClick={() => setWeekOffset((w) => w + 1)}
              aria-label="Next week"
            >
              <ChevronRight className="h-4 w-4" />
            </Button>
          </div>
        </header>

        <div className="grid grid-cols-1 divide-y divide-hairline sm:grid-cols-7 sm:divide-x sm:divide-y-0">
          {days.map((day, i) => {
            const dateKey = format(day, "yyyy-MM-dd");
            return (
              <FitDay
                key={dateKey}
                label={WEEKDAY_LABELS[i]}
                dayNumber={format(day, "d")}
                today={isToday(day)}
                workout={workoutByDate.get(dateKey)}
                drills={sortedDrills}
                drillById={drillById}
                onAddDrill={(drillId) => addDrillToDay(dateKey, drillId)}
                onRemoveEntry={(entryId) => removeWorkoutEntry(dateKey, entryId)}
              />
            );
          })}
        </div>
      </div>

      <div className="rounded-2xl border border-hairline-strong bg-surface p-4">
        <h3 className="mb-3 flex items-center gap-1.5 text-[10px] font-semibold uppercase tracking-[0.14em] text-ink-faint">
          <Dumbbell className="h-3 w-3" /> Drill library
        </h3>

        {sortedDrills.length === 0 ? (
          <p className="mb-3 text-xs text-ink-faint">
            Add drills here, then hover a day to pick from them.
          </p>
        ) : (
          <DndContext sensors={sensors} collisionDetection={closestCenter} onDragEnd={onDragEnd}>
            <SortableContext items={sortedDrills.map((d) => d.id)} strategy={verticalListSortingStrategy}>
              <div className="mb-3 space-y-0.5">
                {sortedDrills.map((drill) =>
                  editingDrillId === drill.id ? (
                    <input
                      key={drill.id}
                      autoFocus
                      value={editingDrillName}
                      onChange={(e) => setEditingDrillName(e.target.value)}
                      onBlur={saveEditDrill}
                      onKeyDown={(e) => {
                        if (e.key === "Enter") {
                          e.preventDefault();
                          saveEditDrill();
                        }
                      }}
                      className="h-7 w-full rounded border border-hairline bg-transparent px-2 text-xs text-ink outline-none focus-visible:ring-1 focus-visible:ring-ring"
                    />
                  ) : (
                    <DrillItem
                      key={drill.id}
                      drill={drill}
                      doneThisWeek={drillsDoneThisWeek.has(drill.id)}
                      onStartEdit={() => startEditDrill(drill)}
                      onDelete={() => deleteDrill(drill.id)}
                    />
                  ),
                )}
              </div>
            </SortableContext>
          </DndContext>
        )}

        <form
          onSubmit={(e) => {
            e.preventDefault();
            submitNewDrill();
          }}
          className="flex gap-1.5"
        >
          <Input
            value={newDrillName}
            onChange={(e) => setNewDrillName(e.target.value)}
            placeholder="New drill"
            className="h-8 text-xs"
          />
          <Button type="submit" size="icon" variant="outline" className="h-8 w-8 shrink-0">
            <Plus className="h-3.5 w-3.5" />
          </Button>
        </form>
      </div>
    </div>
  );
}

function FitDay({
  label,
  dayNumber,
  today,
  workout,
  drills,
  drillById,
  onAddDrill,
  onRemoveEntry,
}: {
  label: string;
  dayNumber: string;
  today: boolean;
  workout: Workout | undefined;
  drills: Drill[];
  drillById: Map<string, Drill>;
  onAddDrill: (drillId: string) => void;
  onRemoveEntry: (entryId: string) => void;
}) {
  const [pickerOpen, setPickerOpen] = useState(false);
  const entries = workout?.entries ?? [];

  return (
    <div
      className="flex min-h-[130px] flex-col gap-1.5 p-3 transition-colors"
      onMouseEnter={() => setPickerOpen(true)}
      onMouseLeave={() => setPickerOpen(false)}
      onClick={() => setPickerOpen((v) => !v)}
    >
      <div className="flex items-center justify-between">
        <span
          className={cn(
            "text-[10px] font-semibold uppercase tracking-[0.1em]",
            today ? "rounded-full bg-ink px-2 py-0.5 text-background" : "text-ink-faint",
          )}
        >
          {label}
        </span>
        <span
          className={cn(
            "text-xs tabular-nums",
            today ? "rounded-full bg-ink px-2 py-0.5 font-semibold text-background" : "text-ink-faint",
          )}
        >
          {dayNumber}
        </span>
      </div>

      {entries.length > 0 && (
        <div className="space-y-1">
          {entries.map((entry) => {
            const drill = drillById.get(entry.drillId);
            if (!drill) return null;
            return (
              <div
                key={entry.id}
                className="group/entry flex items-center justify-between gap-1 rounded bg-surface-elevated px-1.5 py-1 text-xs"
              >
                <span className="truncate font-medium text-ink">{drill.name}</span>
                <button
                  onClick={(e) => {
                    e.stopPropagation();
                    onRemoveEntry(entry.id);
                  }}
                  className="shrink-0 text-ink-faint/50 opacity-0 transition-opacity hover:text-destructive group-hover/entry:opacity-100"
                  aria-label="Remove"
                >
                  <X className="h-3 w-3" />
                </button>
              </div>
            );
          })}
        </div>
      )}

      {pickerOpen && (
        <div
          onClick={(e) => e.stopPropagation()}
          className="max-h-32 overflow-y-auto rounded-md border border-hairline bg-surface-elevated py-1 shadow-sm"
        >
          {drills.length === 0 ? (
            <p className="px-2 py-1.5 text-[10px] text-ink-faint">Add a drill to the library first</p>
          ) : (
            drills.map((d) => (
              <button
                key={d.id}
                onClick={(e) => {
                  e.stopPropagation();
                  onAddDrill(d.id);
                  setPickerOpen(false);
                }}
                className="block w-full truncate px-2 py-1 text-left text-[11px] hover:bg-accent"
              >
                {d.name}
              </button>
            ))
          )}
        </div>
      )}
    </div>
  );
}

function DrillItem({
  drill,
  doneThisWeek,
  onStartEdit,
  onDelete,
}: {
  drill: Drill;
  doneThisWeek: boolean;
  onStartEdit: () => void;
  onDelete: () => void;
}) {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({
    id: drill.id,
  });
  const style = { transform: CSS.Transform.toString(transform), transition };

  return (
    <div
      ref={setNodeRef}
      style={style}
      className={cn(
        "group flex items-center gap-1.5 rounded-md border border-transparent px-1 py-1.5 text-xs text-ink-soft transition-colors hover:border-hairline hover:bg-surface-elevated",
        isDragging && "opacity-40",
      )}
    >
      <button
        {...attributes}
        {...listeners}
        className="shrink-0 cursor-grab text-ink-faint/50 active:cursor-grabbing"
        aria-label="Drag drill"
      >
        <GripVertical className="h-3.5 w-3.5" />
      </button>
      {doneThisWeek ? (
        <CheckCircle2
          className="h-4 w-4 shrink-0 text-green-500"
          aria-label="Placed at least once this week"
        />
      ) : (
        <Circle className="h-4 w-4 shrink-0 text-ink-faint/25" aria-label="Not placed this week yet" />
      )}
      <span className="flex-1 truncate">{drill.name}</span>
      <button
        onClick={onStartEdit}
        className="shrink-0 opacity-100 transition-opacity hover:text-ink sm:opacity-0 sm:group-hover:opacity-100"
        aria-label="Rename drill"
      >
        <Pencil className="h-3 w-3" />
      </button>
      <button
        onClick={onDelete}
        className="shrink-0 opacity-100 transition-opacity hover:text-destructive sm:opacity-0 sm:group-hover:opacity-100"
        aria-label="Delete drill"
      >
        <X className="h-3 w-3" />
      </button>
    </div>
  );
}
