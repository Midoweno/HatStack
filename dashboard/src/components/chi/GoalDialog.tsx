import { useEffect, useState } from "react";
import { useDashboard } from "@/lib/dashboard-store";
import type { Project } from "@/lib/dashboard-types";
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

interface Props {
  open: boolean;
  onOpenChange: (v: boolean) => void;
  goal?: Project | null;
  defaultPassion?: string;
}

export function GoalDialog({ open, onOpenChange, goal, defaultPassion }: Props) {
  const addProject = useDashboard((s) => s.addProject);
  const updateProject = useDashboard((s) => s.updateProject);
  const deleteGoal = useDashboard((s) => s.deleteGoal);
  const projects = useDashboard((s) => s.projects);
  const tasks = useDashboard((s) => s.tasks);

  const [name, setName] = useState("");
  const [passion, setPassion] = useState("");
  const [outcome, setOutcome] = useState("");
  const [dueDate, setDueDate] = useState("");

  const passions = [
    ...new Set(
      projects
        .filter((p) => p.space === "chi" && p.passion)
        .map((p) => p.passion as string),
    ),
  ].sort();

  useEffect(() => {
    if (open) {
      setName(goal?.name ?? "");
      setPassion(goal?.passion ?? defaultPassion ?? "");
      setOutcome(goal?.description ?? "");
      setDueDate(goal?.dueDate ?? "");
    }
  }, [open, goal, defaultPassion]);

  const submit = () => {
    if (!name.trim()) return;
    const patch = {
      name: name.trim(),
      passion: passion.trim() || undefined,
      description: outcome.trim() || undefined,
      dueDate: dueDate || undefined,
    };
    if (goal) updateProject(goal.id, patch);
    else addProject({ ...patch, hat: "personal", space: "chi" });
    onOpenChange(false);
  };

  const remove = () => {
    if (!goal) return;
    const count = tasks.filter((t) => t.projectId === goal.id && !t.parentTaskId).length;
    const ok = window.confirm(
      count > 0
        ? `Delete "${goal.name}" and its ${count} task${count === 1 ? "" : "s"}? This can't be undone.`
        : `Delete "${goal.name}"?`,
    );
    if (!ok) return;
    deleteGoal(goal.id);
    onOpenChange(false);
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent
        onKeyDown={(e) => {
          if (e.key === "Enter" && !e.shiftKey && (e.target as HTMLElement).tagName !== "TEXTAREA") {
            e.preventDefault();
            submit();
          }
        }}
      >
        <DialogHeader>
          <DialogTitle>{goal ? "Edit goal" : "New goal"}</DialogTitle>
        </DialogHeader>
        <div className="space-y-4">
          <div className="space-y-1.5">
            <Label>Goal</Label>
            <Input
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="Release my first EP"
              autoFocus
            />
          </div>
          <div className="space-y-1.5">
            <Label>Passion</Label>
            <Input
              value={passion}
              onChange={(e) => setPassion(e.target.value)}
              placeholder="Music"
              list="chi-passions"
            />
            <datalist id="chi-passions">
              {passions.map((p) => (
                <option key={p} value={p} />
              ))}
            </datalist>
          </div>
          <div className="space-y-1.5">
            <Label>Outcome (optional)</Label>
            <Textarea
              value={outcome}
              onChange={(e) => setOutcome(e.target.value)}
              placeholder="What does done look like?"
              rows={2}
            />
          </div>
          <div className="space-y-1.5">
            <Label>Target date (optional)</Label>
            <Input type="date" value={dueDate} onChange={(e) => setDueDate(e.target.value)} />
          </div>
        </div>
        <DialogFooter>
          {goal && (
            <Button variant="ghost" className="text-destructive sm:mr-auto" onClick={remove}>
              Delete goal
            </Button>
          )}
          <Button variant="ghost" onClick={() => onOpenChange(false)}>
            Cancel
          </Button>
          <Button onClick={submit}>{goal ? "Save" : "Create goal"}</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
