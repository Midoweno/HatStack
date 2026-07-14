import { useEffect, useMemo, useState } from "react";
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
  const projects = useDashboard((s) => s.projects);

  const [name, setName] = useState("");
  const [hat, setHat] = useState<Hat>(defaultHat ?? "routine");
  const [urgency, setUrgency] = useState<Urgency>("medium");
  const [dueDate, setDueDate] = useState("");
  const [projectId, setProjectId] = useState<string>(NONE);
  const [repeat, setRepeat] = useState<RecurrenceFreq | "none">("none");
  const [recurrenceEnd, setRecurrenceEnd] = useState("");

  useEffect(() => {
    if (open) {
      setName(task?.name ?? "");
      setHat(task?.hat ?? defaultHat ?? "routine");
      setUrgency(task?.urgency ?? "medium");
      setDueDate(task?.dueDate ?? "");
      setProjectId(task?.projectId ?? defaultProjectId ?? NONE);
      setRepeat(task?.recurrence?.freq ?? "none");
      setRecurrenceEnd(task?.recurrence?.until ?? "");
    }
  }, [open, task, defaultHat, defaultProjectId]);

  const availableProjects = useMemo(
    () => projects.filter((p) => !p.archived && p.hat === hat),
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
      projectId: projectId === NONE ? undefined : projectId,
      recurrence:
        repeat === "none"
          ? undefined
          : { freq: repeat, until: recurrenceEnd || undefined },
    };
    if (task) {
      updateTask(task.id, payload);
    } else {
      addTask(payload);
    }
    onOpenChange(false);
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>{task ? "Edit task" : "New task"}</DialogTitle>
        </DialogHeader>
        <div className="space-y-4">
          <div className="space-y-1.5">
            <Label>Task</Label>
            <Input
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="Email professor today"
              autoFocus
            />
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
            <Input
              type="date"
              value={dueDate}
              onChange={(e) => setDueDate(e.target.value)}
            />
          </div>

          <div className="grid grid-cols-2 gap-3">
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
                  <SelectItem value="daily">Daily</SelectItem>
                  <SelectItem value="weekly">Weekly</SelectItem>
                  <SelectItem value="monthly">Monthly</SelectItem>
                  <SelectItem value="yearly">Yearly</SelectItem>
                </SelectContent>
              </Select>
            </div>
            {repeat !== "none" && (
              <div className="space-y-1.5">
                <Label>Ends (optional)</Label>
                <Input
                  type="date"
                  value={recurrenceEnd}
                  onChange={(e) => setRecurrenceEnd(e.target.value)}
                />
              </div>
            )}
          </div>
        </div>
        <DialogFooter>
          <Button variant="ghost" onClick={() => onOpenChange(false)}>
            Cancel
          </Button>
          <Button onClick={submit}>{task ? "Save" : "Create task"}</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
