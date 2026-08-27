import { useEffect, useMemo, useState } from "react";
import { addDays, format, parseISO } from "date-fns";
import { Check, CheckCheck, ChevronDown, Minus, Plus, Star } from "lucide-react";
import { useDashboard } from "@/lib/dashboard-store";
import type { Hat, RecurrenceFreq, Task, Urgency } from "@/lib/dashboard-types";
import { HATS, URGENCY_META } from "@/lib/dashboard-types";
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

export function TaskDialog({
  open,
  onOpenChange,
  defaultHat,
  defaultProjectId,
  task,
}: Props) {
  const addTask = useDashboard((s) => s.addTask);
  const updateTask = useDashboard((s) => s.updateTask);
  const completeRecurringSeries = useDashboard((s) => s.completeRecurringSeries);
  const projects = useDashboard((s) => s.projects);

  const [name, setName] = useState("");
  const [hat, setHat] = useState<Hat>(defaultHat ?? "work");
  const [urgency, setUrgency] = useState<Urgency>("medium");
  const [dueDate, setDueDate] = useState("");
  const [description, setDescription] = useState("");
  const [starred, setStarred] = useState(false);
  const [starBucket, setStarBucket] = useState<"priority" | "future">("future");
  const [projectId, setProjectId] = useState<string>(NONE);
  const [repeat, setRepeat] = useState<RecurrenceFreq | "none">("none");
  const [recurrenceInterval, setRecurrenceInterval] = useState(1);
  const [recurrenceEnd, setRecurrenceEnd] = useState("");

  useEffect(() => {
    if (open) {
      setName(task?.name ?? "");
      setHat(task?.hat ?? defaultHat ?? "work");
      setUrgency(task?.urgency ?? "medium");
      setDueDate(task?.dueDate ?? "");
      setDescription(task?.description ?? "");
      setStarred(task?.starred ?? false);
      setStarBucket(task?.starBucket ?? "future");
      setProjectId(task?.projectId ?? defaultProjectId ?? NONE);
      setRepeat(task?.recurrence?.freq ?? "none");
      setRecurrenceInterval(task?.recurrence?.interval ?? 1);
      setRecurrenceEnd(task?.recurrence?.until ?? "");
    }
  }, [open, task, defaultHat, defaultProjectId]);

  const availableProjects = useMemo(
    () => projects.filter((p) => !p.completed && p.hat === hat),
    [projects, hat],
  );

  useEffect(() => {
    if (projectId !== NONE && !availableProjects.some((p) => p.id === projectId)) {
      setProjectId(NONE);
    }
  }, [hat, availableProjects, projectId]);

  const submit = () => {
    if (!name.trim()) return;
    const payload = {
      name: name.trim(),
      hat,
      urgency,
      dueDate: dueDate || undefined,
      description: description.trim() || undefined,
      projectId: projectId === NONE ? undefined : projectId,
      recurrence:
        repeat === "none"
          ? undefined
          : {
              freq: repeat,
              interval: Math.max(1, recurrenceInterval || 1),
              until: recurrenceEnd || undefined,
            },
      starred,
    };
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
    } else {
      addTask({ ...payload, starBucket: starred ? starBucket : undefined });
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
            </div>
            {starred && (
              <div className="mt-2 inline-flex rounded-full border border-hairline bg-surface p-0.5">
                {(["priority", "future"] as const).map((b) => (
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
                    {b === "priority" ? "Prio" : "Future"}
                  </button>
                ))}
              </div>
            )}
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <Label>Hat</Label>
              <HoverSelect
                value={hat}
                options={HATS.map((h) => ({ value: h.id, label: h.label }))}
                onSelect={setHat}
              />
            </div>
            <div className="space-y-1.5">
              <Label>Project</Label>
              <HoverSelect
                value={projectId}
                options={[
                  { value: NONE, label: "Standalone" },
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
            <Label>Due date</Label>
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
