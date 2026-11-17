import { useEffect, useMemo, useRef, useState } from "react";
import { addDays, format, parseISO } from "date-fns";
import { Check, CheckCheck, ChevronDown, Minus, Plus, Star, X } from "lucide-react";
import { useDashboard } from "@/lib/dashboard-store";
import type {
  DeadlineType,
  Hat,
  RecurrenceFreq,
  Space,
  StarBucket,
  Task,
  Urgency,
} from "@/lib/dashboard-types";
import { DEADLINE_TYPES, HATS, URGENCY_META } from "@/lib/dashboard-types";
import { DEADLINE_ICONS } from "@/lib/deadline-icons";
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Checkbox } from "@/components/ui/checkbox";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { cn } from "@/lib/utils";

interface Props {
  open: boolean;
  onOpenChange: (v: boolean) => void;
  defaultHat?: Hat;
  defaultProjectId?: string;
  task?: Task | null;
  // "chi" makes this a CHI task: goals instead of hats/projects, no starring.
  space?: Space;
}

const NONE = "__none__";
const URGENCIES: Urgency[] = ["critical", "high", "medium", "low"];

// Styled like the Select trigger it replaces, but opens on hover — move the
// cursor down into the list and click to confirm — with tap-to-open/
// tap-to-pick as the touch fallback.
function HoverSelect<T extends string>({
  value,
  options,
  onSelect,
}: {
  value: T;
  options: { value: T; label: string }[];
  onSelect: (v: T) => void;
}) {
  const [open, setOpen] = useState(false);
  const current = options.find((o) => o.value === value);

  return (
    <div
      className="relative"
      onMouseEnter={() => setOpen(true)}
      onMouseLeave={() => setOpen(false)}
    >
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        className="flex h-9 w-full items-center justify-between whitespace-nowrap rounded-md border border-input bg-transparent px-3 py-2 text-sm shadow-sm focus:outline-none focus:ring-1 focus:ring-ring"
      >
        <span className="truncate">{current?.label}</span>
        <ChevronDown className="h-4 w-4 shrink-0 opacity-50" />
      </button>
      {open && (
        <div className="absolute left-0 top-full z-50 max-h-60 w-full overflow-auto rounded-md border border-hairline bg-surface-elevated py-1 text-ink shadow-lg">
          {options.map((opt) => (
            <button
              key={opt.value}
              type="button"
              onClick={() => {
                onSelect(opt.value);
                setOpen(false);
              }}
              className={cn(
                "block w-full truncate px-3 py-1.5 text-left text-sm hover:bg-accent",
                opt.value === value && "font-semibold",
              )}
            >
              {opt.label}
            </button>
          ))}
        </div>
      )}
    </div>
  );
}

interface DraftSubtask {
  id: string;
  name: string;
  dueDate: string;
}

// An already-persisted subtask, edited in place: renaming commits on blur/
// Enter (avoids firing a network update per keystroke), the due date commits
// immediately since a date picker only fires onChange once per pick.
function ExistingSubtaskRow({
  subtask,
  onUpdate,
  onDelete,
  onTabToNext,
}: {
  subtask: Task;
  onUpdate: (patch: Partial<Task>) => void;
  onDelete: () => void;
  onTabToNext: () => void;
}) {
  const [name, setName] = useState(subtask.name);
  useEffect(() => setName(subtask.name), [subtask.name]);
  const inputRef = useRef<HTMLInputElement>(null);
  // Escape sets this so the blur it triggers doesn't also commit the reverted
  // text — Escape means discard, not save.
  const cancelingRef = useRef(false);

  const commitName = () => {
    if (cancelingRef.current) {
      cancelingRef.current = false;
      return;
    }
    const trimmed = name.trim();
    if (trimmed && trimmed !== subtask.name) onUpdate({ name: trimmed });
    else setName(subtask.name);
  };

  const cancelEdit = () => {
    cancelingRef.current = true;
    setName(subtask.name);
    inputRef.current?.blur();
  };

  return (
    <div className="flex items-center gap-2">
      <Input
        ref={inputRef}
        value={name}
        onChange={(e) => setName(e.target.value)}
        onBlur={commitName}
        onKeyDown={(e) => {
          if (e.key === "Enter") {
            e.preventDefault();
            commitName();
          } else if (e.key === "Escape") {
            e.preventDefault();
            cancelEdit();
          } else if (e.key === "Tab" && !e.shiftKey) {
            // Same rapid-add shortcut as a blank subtask row: save this
            // rename and open a fresh one.
            e.preventDefault();
            commitName();
            onTabToNext();
          }
        }}
        className="h-8 flex-1 text-sm"
      />
      <Input
        type="date"
        value={subtask.dueDate ?? ""}
        onChange={(e) => onUpdate({ dueDate: e.target.value || undefined })}
        className="h-8 w-auto shrink-0 text-xs"
      />
      <Button
        type="button"
        variant="ghost"
        size="icon"
        className="h-8 w-8 shrink-0 text-ink-faint hover:text-destructive"
        onClick={onDelete}
        aria-label="Delete subtask"
      >
        <X className="h-3.5 w-3.5" />
      </Button>
    </div>
  );
}

// A not-yet-created subtask staged in this dialog session — only becomes a
// real task when the parent task is saved.
function DraftSubtaskRow({
  draft,
  onChange,
  onRemove,
  onTabToNext,
}: {
  draft: DraftSubtask;
  onChange: (patch: Partial<DraftSubtask>) => void;
  onRemove: () => void;
  onTabToNext: () => void;
}) {
  return (
    <div className="flex items-center gap-2">
      <Input
        autoFocus
        value={draft.name}
        onChange={(e) => onChange({ name: e.target.value })}
        onKeyDown={(e) => {
          // Tab opens another blank subtask row instead of moving to the
          // date field, so several can be added back-to-back from the
          // keyboard alone.
          if (e.key === "Tab" && !e.shiftKey) {
            e.preventDefault();
            onTabToNext();
          }
        }}
        placeholder="Subtask name"
        className="h-8 flex-1 text-sm"
      />
      <Input
        type="date"
        value={draft.dueDate}
        onChange={(e) => onChange({ dueDate: e.target.value })}
        className="h-8 w-auto shrink-0 text-xs"
      />
      <Button
        type="button"
        variant="ghost"
        size="icon"
        className="h-8 w-8 shrink-0 text-ink-faint hover:text-destructive"
        onClick={onRemove}
        aria-label="Remove subtask"
      >
        <X className="h-3.5 w-3.5" />
      </Button>
    </div>
  );
}

export function TaskDialog({
  open,
  onOpenChange,
  defaultHat,
  defaultProjectId,
  task,
  space,
}: Props) {
  const isChi = space === "chi";
  const addTask = useDashboard((s) => s.addTask);
  const updateTask = useDashboard((s) => s.updateTask);
  const deleteTask = useDashboard((s) => s.deleteTask);
  const completeRecurringSeries = useDashboard((s) => s.completeRecurringSeries);
  const projects = useDashboard((s) => s.projects);
  const allTasks = useDashboard((s) => s.tasks);

  const [name, setName] = useState("");
  const [hat, setHat] = useState<Hat>(defaultHat ?? "work");
  const [urgency, setUrgency] = useState<Urgency>("medium");
  const [deadlineType, setDeadlineType] = useState<DeadlineType | undefined>(undefined);
  const [dueDate, setDueDate] = useState("");
  const [description, setDescription] = useState("");
  // New tasks start starred (landing in Future); un-star to keep one out of
  // the Priority view.
  const [starred, setStarred] = useState(true);
  const [starBucket, setStarBucket] = useState<StarBucket>("future");
  const [projectId, setProjectId] = useState<string>(NONE);
  const [repeat, setRepeat] = useState<RecurrenceFreq | "none">("none");
  const [recurrenceInterval, setRecurrenceInterval] = useState(1);
  const [recurrenceEnd, setRecurrenceEnd] = useState("");
  // "Work on it every day until it's due": a daily repeat that ends on the
  // deadline. While on, the date field below means the deadline (the series
  // end date) and the generic Repeat controls are hidden.
  const [dailyUntilDue, setDailyUntilDue] = useState(false);
  const [draftSubtasks, setDraftSubtasks] = useState<DraftSubtask[]>([]);

  useEffect(() => {
    if (open) {
      setName(task?.name ?? "");
      setHat(task?.hat ?? defaultHat ?? "work");
      setUrgency(task?.urgency ?? "medium");
      setDeadlineType(task?.deadlineType);
      const rec = task?.recurrence;
      const isDailyUntil = !!rec && rec.freq === "daily" && rec.interval === 1 && !!rec.until;
      setDailyUntilDue(isDailyUntil);
      setDueDate(isDailyUntil ? (rec?.until ?? "") : (task?.dueDate ?? ""));
      setDescription(task?.description ?? "");
      setStarred(task ? (task.starred ?? false) : !isChi);
      setStarBucket(task?.starBucket ?? "future");
      setProjectId(task?.projectId ?? defaultProjectId ?? NONE);
      setRepeat(isDailyUntil ? "none" : (rec?.freq ?? "none"));
      setRecurrenceInterval(rec?.interval ?? 1);
      setRecurrenceEnd(isDailyUntil ? "" : (rec?.until ?? ""));
      setDraftSubtasks([]);
    }
  }, [open, task, defaultHat, defaultProjectId, isChi]);

  const availableProjects = useMemo(
    () =>
      projects.filter((p) =>
        isChi ? p.space === "chi" && !p.completed : !p.completed && p.space !== "chi" && p.hat === hat,
      ),
    [projects, hat, isChi],
  );

  const existingSubtasks = useMemo(
    () => (task ? allTasks.filter((t) => t.parentTaskId === task.id) : []),
    [allTasks, task],
  );

  const addDraftSubtask = () => {
    setDraftSubtasks((rows) => [...rows, { id: crypto.randomUUID(), name: "", dueDate: "" }]);
  };
  const updateDraftSubtask = (id: string, patch: Partial<DraftSubtask>) => {
    setDraftSubtasks((rows) => rows.map((r) => (r.id === id ? { ...r, ...patch } : r)));
  };
  const removeDraftSubtask = (id: string) => {
    setDraftSubtasks((rows) => rows.filter((r) => r.id !== id));
  };

  useEffect(() => {
    if (projectId !== NONE && !availableProjects.some((p) => p.id === projectId)) {
      setProjectId(NONE);
    }
  }, [hat, availableProjects, projectId]);

  // The date field can't be a deadline without a date in it.
  useEffect(() => {
    if (!dueDate && dailyUntilDue) setDailyUntilDue(false);
  }, [dueDate, dailyUntilDue]);

  const submit = () => {
    if (!name.trim()) return;
    const daily = dailyUntilDue && !!dueDate;

    // In daily mode the date field is the deadline, and the task's own due
    // date is today's copy: today, or — when this task already was a daily
    // series — wherever its current copy is, as long as that's not past the
    // (possibly just-edited) deadline.
    let taskDue = dueDate || undefined;
    if (daily) {
      const today = format(new Date(), "yyyy-MM-dd");
      const wasDaily =
        task?.recurrence?.freq === "daily" &&
        task.recurrence.interval === 1 &&
        !!task.recurrence.until;
      const current = wasDaily ? task?.dueDate : undefined;
      taskDue = current && current <= dueDate ? current : today <= dueDate ? today : dueDate;
    }

    const payload = {
      name: name.trim(),
      hat: isChi ? ("personal" as const) : hat,
      ...(isChi ? { space: "chi" as const } : {}),
      urgency,
      deadlineType,
      dueDate: taskDue,
      description: description.trim() || undefined,
      projectId: projectId === NONE ? undefined : projectId,
      recurrence: daily
        ? { freq: "daily" as const, interval: 1, until: dueDate }
        : repeat === "none"
          ? undefined
          : {
              freq: repeat,
              interval: Math.max(1, recurrenceInterval || 1),
              until: recurrenceEnd || undefined,
            },
      starred: isChi ? false : starred,
    };
    let parentId: string;
    if (task) {
      // Only bump starOrder (to the top of its column) when the star state
      // actually changed — newly starred, or moved to the other column —
      // so a plain edit doesn't disturb an already-starred task's position.
      const justStarred = starred && !task.starred;
      const bucketChanged = starred && (task.starBucket ?? "future") !== starBucket;
      updateTask(task.id, {
        ...payload,
        ...(justStarred || bucketChanged ? { starOrder: Date.now(), starBucket } : {}),
      });
      parentId = task.id;
    } else {
      parentId = addTask({ ...payload, starBucket: starred ? starBucket : undefined }).id;
    }
    for (const draft of draftSubtasks) {
      const draftName = draft.name.trim();
      if (!draftName) continue;
      addTask({
        hat: isChi ? "personal" : hat,
        space: isChi ? "chi" : undefined,
        urgency,
        name: draftName,
        dueDate: draft.dueDate || undefined,
        parentTaskId: parentId,
      });
    }
    onOpenChange(false);
  };

  const finishSeries = () => {
    if (!task) return;
    completeRecurringSeries(task.id);
    onOpenChange(false);
  };

  // Quickly push a due date forward or back a day — for "kicking the can
  // down the road" on something that isn't quite done yet.
  const shiftDueDate = (deltaDays: number) => {
    const base = dueDate ? parseISO(dueDate) : new Date();
    setDueDate(format(addDays(base, deltaDays), "yyyy-MM-dd"));
  };

  // Enter saves no matter what's focused — clicking a button like "Prio" or
  // an urgency pill leaves focus sitting on it, and Enter should still save
  // from there (Shift+Enter still makes a newline in the description).
  // Escape-to-close (discarding changes) is handled natively by the Dialog
  // primitive. The one exception is a closed Select trigger (Hat/Project/
  // Repeat, role="combobox"), where Enter should open its dropdown instead —
  // Radix's own listbox is portaled outside this element once open, so this
  // check never intercepts picking an option, only the trigger itself.
  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key !== "Enter" || e.shiftKey) return;
    if ((e.target as HTMLElement).getAttribute("role") === "combobox") return;
    e.preventDefault();
    submit();
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent onKeyDown={handleKeyDown}>
        <Button
          variant="ghost"
          size="icon"
          className="absolute right-11 top-4 h-7 w-7 text-ink-soft hover:text-ink"
          onClick={submit}
          aria-label="Save task"
        >
          <Check className="h-4 w-4" />
        </Button>
        <DialogHeader>
          <DialogTitle>{task ? "Edit task" : "New task"}</DialogTitle>
        </DialogHeader>
        <div className="space-y-4">
          <div className="space-y-1.5">
            <Label>Task</Label>
            <div className="flex items-center gap-2">
              <Input
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder="Email professor today"
                autoFocus
                className="flex-1"
              />
              {!isChi && (
              <Button
                type="button"
                variant="outline"
                size="icon"
                className={cn("shrink-0", starred && "border-amber-500 text-amber-500")}
                onClick={() => setStarred((v) => !v)}
                aria-label={starred ? "Remove from Priority view" : "Add to Priority view"}
              >
                <Star className={cn("h-4 w-4", starred && "fill-current")} />
              </Button>
              )}
            </div>
            {!isChi && starred && (
              <div className="mt-2 inline-flex rounded-full border border-hairline bg-surface p-0.5">
                {(["today", "priority", "future"] as const).map((b) => (
                  <button
                    key={b}
                    type="button"
                    onClick={() => setStarBucket(b)}
                    className={cn(
                      "rounded-full px-3 py-1 text-xs font-medium capitalize transition-colors",
                      starBucket === b
                        ? "bg-ink text-background"
                        : "text-ink-faint hover:text-ink-soft",
                    )}
                  >
                    {b === "priority" ? "Prio" : b === "today" ? "Today" : "Future"}
                  </button>
                ))}
              </div>
            )}
          </div>

          <div className={cn("grid gap-3", isChi ? "grid-cols-1" : "grid-cols-2")}>
            {!isChi && (
            <div className="space-y-1.5">
              <Label>Hat</Label>
              <HoverSelect
                value={hat}
                options={HATS.map((h) => ({ value: h.id, label: h.label }))}
                onSelect={setHat}
              />
            </div>
            )}
            <div className="space-y-1.5">
              <Label>{isChi ? "Goal" : "Project"}</Label>
              <HoverSelect
                value={projectId}
                options={[
                  { value: NONE, label: isChi ? "No goal yet" : "Standalone" },
                  ...availableProjects.map((p) => ({
                    value: p.id,
                    label: p.icon ? `${p.icon} ${p.name}` : p.name,
                  })),
                ]}
                onSelect={setProjectId}
              />
            </div>
          </div>

          <div className="space-y-1.5">
            <Label>Urgency</Label>
            <div className="flex gap-1">
              {URGENCIES.map((u) => (
                <button
                  key={u}
                  type="button"
                  onClick={() => setUrgency(u)}
                  className={cn(
                    "flex flex-1 items-center justify-center gap-1.5 rounded-md border border-hairline px-2 py-2 text-xs transition-colors",
                    urgency === u
                      ? "border-ink/40 bg-accent"
                      : "hover:border-ink-faint/40",
                  )}
                >
                  <span
                    className={cn("h-2 w-2 rounded-full", URGENCY_META[u].dot)}
                  />
                  <span className="capitalize">{u}</span>
                </button>
              ))}
            </div>
          </div>

          <div className="space-y-1.5">
            <Label>Type (optional)</Label>
            <div className="flex gap-1">
              <button
                type="button"
                onClick={() => setDeadlineType(undefined)}
                className={cn(
                  "flex flex-1 items-center justify-center rounded-md border border-hairline px-2 py-2 text-xs transition-colors",
                  deadlineType === undefined ? "border-ink/40 bg-accent" : "hover:border-ink-faint/40",
                )}
              >
                None
              </button>
              {DEADLINE_TYPES.map((d) => {
                const Icon = DEADLINE_ICONS[d.id];
                return (
                  <button
                    key={d.id}
                    type="button"
                    onClick={() => setDeadlineType(d.id)}
                    className={cn(
                      "flex flex-1 items-center justify-center gap-1.5 rounded-md border border-hairline px-2 py-2 text-xs transition-colors",
                      deadlineType === d.id ? "border-ink/40 bg-accent" : "hover:border-ink-faint/40",
                    )}
                  >
                    <Icon className="h-3.5 w-3.5" />
                    {d.label}
                  </button>
                );
              })}
            </div>
          </div>

          <div className="space-y-1.5">
            <Label>{dailyUntilDue ? "Deadline" : "Due date"}</Label>
            <div className="space-y-2">
              <div className="flex items-center justify-center gap-2">
                <Button
                  type="button"
                  variant="outline"
                  size="icon"
                  className="shrink-0"
                  onClick={() => shiftDueDate(-1)}
                  aria-label="Push due date back a day"
                >
                  <Minus className="h-4 w-4" />
                </Button>
                <Input
                  type="date"
                  value={dueDate}
                  onChange={(e) => setDueDate(e.target.value)}
                  className="w-auto shrink-0"
                />
                <Button
                  type="button"
                  variant="outline"
                  size="icon"
                  className="shrink-0"
                  onClick={() => shiftDueDate(1)}
                  aria-label="Push due date forward a day"
                >
                  <Plus className="h-4 w-4" />
                </Button>
              </div>
              <Button
                type="button"
                variant="outline"
                className="w-full"
                onClick={() => setDueDate(format(new Date(), "yyyy-MM-dd"))}
              >
                Due Today
              </Button>
              <label
                className={cn(
                  "flex items-start gap-3 rounded-md border border-hairline px-3 py-2.5",
                  dueDate ? "cursor-pointer hover:border-ink-faint/40" : "cursor-not-allowed opacity-60",
                )}
              >
                <Checkbox
                  checked={dailyUntilDue}
                  disabled={!dueDate}
                  onCheckedChange={(v) => {
                    setDailyUntilDue(v === true);
                    if (v === true) setRepeat("none");
                  }}
                  className="mt-0.5"
                />
                <span className="min-w-0 text-sm leading-snug">
                  <span className="font-medium">Work on it every day until it's due</span>
                  <span className="mt-0.5 block text-xs text-ink-faint">
                    {!dueDate
                      ? "Pick a due date first."
                      : dailyUntilDue
                        ? `A fresh copy shows up each day, ending ${format(parseISO(dueDate), "EEE, MMM d")}.${
                            deadlineType ? "" : " Set a Type above to see a countdown tile."
                          }`
                        : "Completing today's copy brings it back tomorrow, until the due date."}
                  </span>
                </span>
              </label>
            </div>
          </div>

          <div className="space-y-1.5">
            <Label>Description (optional)</Label>
            <Textarea
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              placeholder="Notes, links, or details for this task"
              rows={3}
            />
          </div>

          <div className="space-y-1.5">
            <Label>Subtasks (optional)</Label>
            <div className="space-y-2">
              {existingSubtasks.map((st) => (
                <ExistingSubtaskRow
                  key={st.id}
                  subtask={st}
                  onUpdate={(patch) => updateTask(st.id, patch)}
                  onDelete={() => deleteTask(st.id)}
                  onTabToNext={addDraftSubtask}
                />
              ))}
              {draftSubtasks.map((d) => (
                <DraftSubtaskRow
                  key={d.id}
                  draft={d}
                  onChange={(patch) => updateDraftSubtask(d.id, patch)}
                  onRemove={() => removeDraftSubtask(d.id)}
                  onTabToNext={addDraftSubtask}
                />
              ))}
              <Button type="button" variant="outline" size="sm" className="w-full" onClick={addDraftSubtask}>
                <Plus className="mr-1.5 h-3.5 w-3.5" /> Add subtask
              </Button>
            </div>
          </div>

          {!dailyUntilDue && (
            <>
          <div className="space-y-1.5">
            <Label>Repeat</Label>
            <Select
              value={repeat}
              onValueChange={(v) => setRepeat(v as RecurrenceFreq | "none")}
            >
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="none">Does not repeat</SelectItem>
                <SelectItem value="daily">Day(s)</SelectItem>
                <SelectItem value="weekly">Week(s)</SelectItem>
                <SelectItem value="monthly">Month(s)</SelectItem>
                <SelectItem value="yearly">Year(s)</SelectItem>
              </SelectContent>
            </Select>
          </div>

          {repeat !== "none" && (
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1.5">
                <Label>Every</Label>
                <Input
                  type="number"
                  min={1}
                  value={recurrenceInterval}
                  onChange={(e) => setRecurrenceInterval(Number(e.target.value))}
                />
              </div>
              <div className="space-y-1.5">
                <Label>Ends (optional)</Label>
                <Input
                  type="date"
                  value={recurrenceEnd}
                  onChange={(e) => setRecurrenceEnd(e.target.value)}
                />
              </div>
            </div>
          )}
            </>
          )}
        </div>
        <DialogFooter>
          {task?.recurrence && (
            <Button
              variant="outline"
              className="sm:mr-auto"
              onClick={finishSeries}
            >
              <CheckCheck className="mr-1.5 h-4 w-4" />
              Complete series (stop repeating)
            </Button>
          )}
          <Button variant="ghost" onClick={() => onOpenChange(false)}>
            Cancel
          </Button>
          <Button onClick={submit}>{task ? "Save" : "Create task"}</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
