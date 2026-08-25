import { useMemo, useRef, useState } from "react";
import { addDays, addWeeks, format, isToday, startOfWeek } from "date-fns";
import {
  DndContext,
  PointerSensor,
  closestCenter,
  useDroppable,
  useSensor,
  useSensors,
  type DragEndEvent,
} from "@dnd-kit/core";
import { SortableContext, arrayMove, useSortable, verticalListSortingStrategy } from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";
import { ChevronLeft, ChevronRight, Dumbbell, GripVertical, Pencil, Plus, X } from "lucide-react";
import { useDashboard } from "@/lib/dashboard-store";
import type { Drill } from "@/lib/dashboard-types";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { cn } from "@/lib/utils";

const WEEKDAY_LABELS = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];

export function FitView() {
  const workouts = useDashboard((s) => s.workouts);
  const drills = useDashboard((s) => s.drills);
  const setWorkoutNote = useDashboard((s) => s.setWorkoutNote);
  const addDrill = useDashboard((s) => s.addDrill);
  const updateDrill = useDashboard((s) => s.updateDrill);
  const deleteDrill = useDashboard((s) => s.deleteDrill);
  const reorderDrills = useDashboard((s) => s.reorderDrills);

  const [weekOffset, setWeekOffset] = useState(0);
  const [editingDate, setEditingDate] = useState<string | null>(null);
  const [draft, setDraft] = useState("");
  const [newDrillName, setNewDrillName] = useState("");
  const [editingDrillId, setEditingDrillId] = useState<string | null>(null);
  const [editingDrillName, setEditingDrillName] = useState("");

  const weekStart = useMemo(
    () => startOfWeek(addWeeks(new Date(), weekOffset), { weekStartsOn: 0 }),
    [weekOffset],
  );
  const days = useMemo(() => Array.from({ length: 7 }, (_, i) => addDays(weekStart, i)), [weekStart]);
  const weekEnd = days[6];

  const workoutByDate = new Map(workouts.map((w) => [w.date, w]));
  const sortedDrills = [...drills].sort((a, b) => a.position - b.position);

  const sensors = useSensors(useSensor(PointerSensor, { activationConstraint: { distance: 5 } }));

  // Guards against double-firing: Enter (or the blur that follows closing
  // the field) can both try to resolve the same edit.
  const dayEditResolvedRef = useRef(false);

  const openDay = (dateKey: string) => {
    dayEditResolvedRef.current = false;
    setEditingDate(dateKey);
    setDraft(workoutByDate.get(dateKey)?.notes ?? "");
  };

  const saveDay = () => {
    if (dayEditResolvedRef.current) return;
    dayEditResolvedRef.current = true;
    if (editingDate) setWorkoutNote(editingDate, draft);
    setEditingDate(null);
  };

  const cancelDay = () => {
    if (dayEditResolvedRef.current) return;
    dayEditResolvedRef.current = true;
    setEditingDate(null);
  };

  const onDragEnd = (e: DragEndEvent) => {
    const { active, over } = e;
    if (!over) return;
    const activeId = String(active.id);
    const overId = String(over.id);
    if (activeId === overId) return;

    if (overId.startsWith("day-")) {
      const drillName = active.data.current?.name as string | undefined;
      if (!drillName) return;
      const dateKey = overId.slice(4);
      const existing = workoutByDate.get(dateKey)?.notes ?? "";
      setWorkoutNote(dateKey, existing ? `${existing}\n${drillName}` : drillName);
      return;
    }

    if (activeId.startsWith("drill-") && overId.startsWith("drill-")) {
      const ids = sortedDrills.map((d) => `drill-${d.id}`);
      const oldIndex = ids.indexOf(activeId);
      const newIndex = ids.indexOf(overId);
      if (oldIndex === -1 || newIndex === -1 || oldIndex === newIndex) return;
      reorderDrills(arrayMove(ids, oldIndex, newIndex).map((id) => id.slice(6)));
    }
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
    <DndContext sensors={sensors} collisionDetection={closestCenter} onDragEnd={onDragEnd}>
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
                  dateKey={dateKey}
                  label={WEEKDAY_LABELS[i]}
                  dayNumber={format(day, "d")}
                  today={isToday(day)}
                  notes={workoutByDate.get(dateKey)?.notes}
                  editing={editingDate === dateKey}
                  draft={draft}
                  onOpen={() => openDay(dateKey)}
                  onDraftChange={setDraft}
                  onSave={saveDay}
                  onCancel={cancelDay}
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
              Add drills here, then drag them into a day.
            </p>
          ) : (
            <SortableContext
              items={sortedDrills.map((d) => `drill-${d.id}`)}
              strategy={verticalListSortingStrategy}
            >
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
                      onStartEdit={() => startEditDrill(drill)}
                      onDelete={() => deleteDrill(drill.id)}
                    />
                  ),
                )}
              </div>
            </SortableContext>
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
    </DndContext>
  );
}

function FitDay({
  dateKey,
  label,
  dayNumber,
  today,
  notes,
  editing,
  draft,
  onOpen,
  onDraftChange,
  onSave,
  onCancel,
}: {
  dateKey: string;
  label: string;
  dayNumber: string;
  today: boolean;
  notes: string | undefined;
  editing: boolean;
  draft: string;
  onOpen: () => void;
  onDraftChange: (v: string) => void;
  onSave: () => void;
  onCancel: () => void;
}) {
  const { setNodeRef, isOver } = useDroppable({ id: `day-${dateKey}` });

  return (
    <div
      ref={setNodeRef}
      className={cn(
        "flex min-h-[130px] flex-col gap-1.5 p-3 transition-colors",
        isOver && "bg-accent/40",
      )}
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

      {editing ? (
        <Textarea
          autoFocus
          value={draft}
          onChange={(e) => onDraftChange(e.target.value)}
          onBlur={onSave}
          onKeyDown={(e) => {
            if (e.key === "Enter" && !e.shiftKey) {
              e.preventDefault();
              onSave();
            } else if (e.key === "Escape") {
              e.preventDefault();
              onCancel();
            }
          }}
          placeholder="Workout for this day"
          rows={4}
          className="flex-1 resize-none text-xs"
        />
      ) : (
        <button onClick={onOpen} className="flex-1 rounded text-left">
          {notes && <p className="whitespace-pre-wrap text-xs font-medium text-ink">{notes}</p>}
        </button>
      )}
    </div>
  );
}

function DrillItem({
  drill,
  onStartEdit,
  onDelete,
}: {
  drill: Drill;
  onStartEdit: () => void;
  onDelete: () => void;
}) {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({
    id: `drill-${drill.id}`,
    data: { name: drill.name },
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
