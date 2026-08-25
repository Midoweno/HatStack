import { useEffect, useMemo, useState } from "react";
import { format } from "date-fns";
import { Check, CheckCheck, Star } from "lucide-react";
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

  // Enter saves (Shift+Enter still makes a newline in the description).
  // Escape-to-close is handled natively by the Dialog primitive. Buttons
  // (including the Hat/Project/Repeat selects) are skipped so their own
  // Enter behavior — opening a dropdown, clicking "Due Today" — isn't
  // immediately followed by a second, redundant submit.
  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key !== "Enter" || e.shiftKey) return;
    if ((e.target as HTMLElement).tagName === "BUTTON") return;
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
              <Select value={hat} onValueChange={(v) => setHat(v as Hat)}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {HATS.map((h) => (
                    <SelectItem key={h.id} value={h.id}>
                      {h.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1.5">
              <Label>Project</Label>
              <Select value={projectId} onValueChange={setProjectId}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value={NONE}>Standalone</SelectItem>
                  {availableProjects.map((p) => (
                    <SelectItem key={p.id} value={p.id}>
                      {p.icon ? `${p.icon} ` : ""}
                      {p.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
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
            <div className="flex gap-2">
              <Input
                type="date"
                value={dueDate}
                onChange={(e) => setDueDate(e.target.value)}
              />
              <Button
                type="button"
                variant="outline"
                className="shrink-0"
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
