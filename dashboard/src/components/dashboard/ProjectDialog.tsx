import { useEffect, useState } from "react";
import { format } from "date-fns";
import { useDashboard } from "@/lib/dashboard-store";
import type { Hat, Project } from "@/lib/dashboard-types";
import { HATS } from "@/lib/dashboard-types";
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

interface Props {
  open: boolean;
  onOpenChange: (v: boolean) => void;
  defaultHat?: Hat;
  project?: Project | null;
}

export function ProjectDialog({ open, onOpenChange, defaultHat, project }: Props) {
  const addProject = useDashboard((s) => s.addProject);
  const updateProject = useDashboard((s) => s.updateProject);

  const [name, setName] = useState("");
  const [icon, setIcon] = useState("");
  const [hat, setHat] = useState<Hat>(defaultHat ?? "work");
  const [dueDate, setDueDate] = useState("");

  useEffect(() => {
    if (open) {
      setName(project?.name ?? "");
      setIcon(project?.icon ?? "");
      setHat(project?.hat ?? defaultHat ?? "work");
      setDueDate(project?.dueDate ?? "");
    }
  }, [open, project, defaultHat]);

  const submit = () => {
    if (!name.trim()) return;
    if (project) {
      updateProject(project.id, {
        name: name.trim(),
        icon: icon.trim() || undefined,
        hat,
        dueDate: dueDate || undefined,
      });
    } else {
      addProject({
        name: name.trim(),
        icon: icon.trim() || undefined,
        hat,
        dueDate: dueDate || undefined,
      });
    }
    onOpenChange(false);
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>{project ? "Edit project" : "New project"}</DialogTitle>
        </DialogHeader>
        <div className="space-y-4">
          <div className="grid grid-cols-[80px_1fr] gap-3">
            <div className="space-y-1.5">
              <Label>Icon</Label>
              <Input
                value={icon}
                onChange={(e) => setIcon(e.target.value)}
                placeholder="📄"
                maxLength={4}
              />
            </div>
            <div className="space-y-1.5">
              <Label>Name</Label>
              <Input
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder="Columbia Preparation"
                autoFocus
              />
            </div>
          </div>
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
        </div>
        <DialogFooter>
          <Button variant="ghost" onClick={() => onOpenChange(false)}>
            Cancel
          </Button>
          <Button onClick={submit}>{project ? "Save" : "Create project"}</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
