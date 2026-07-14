import { format, parseISO } from "date-fns";
import { RotateCcw, Trash2 } from "lucide-react";
import { useDashboard } from "@/lib/dashboard-store";
import { HATS } from "@/lib/dashboard-types";
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
} from "@/components/ui/sheet";
import { Button } from "@/components/ui/button";

interface Props {
  open: boolean;
  onOpenChange: (v: boolean) => void;
}

export function ArchiveSheet({ open, onOpenChange }: Props) {
  const projects = useDashboard((s) => s.projects);
  const unarchive = useDashboard((s) => s.unarchiveProject);
  const del = useDashboard((s) => s.deleteProject);
  const archived = projects.filter((p) => p.archived);

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent className="w-full sm:max-w-md">
        <SheetHeader>
          <SheetTitle className="font-display text-2xl">Archive</SheetTitle>
        </SheetHeader>
        <div className="mt-6 space-y-6 px-4 pb-6">
          {archived.length === 0 && (
            <p className="text-sm text-ink-faint">
              Completed projects will land here.
            </p>
          )}
          {HATS.map((h) => {
            const list = archived.filter((p) => p.hat === h.id);
            if (list.length === 0) return null;
            return (
              <div key={h.id}>
                <h3 className="mb-2 text-[10px] font-semibold uppercase tracking-[0.14em] text-ink-faint">
                  {h.label}
                </h3>
                <div className="space-y-2">
                  {list.map((p) => (
                    <div
                      key={p.id}
                      className="flex items-center justify-between rounded-lg border border-hairline bg-surface-elevated px-3 py-2"
                    >
                      <div className="min-w-0">
                        <div className="flex items-center gap-2 text-sm text-ink">
                          {p.icon && <span>{p.icon}</span>}
                          <span className="truncate">{p.name}</span>
                        </div>
                        {p.dueDate && (
                          <p className="text-xs text-ink-faint">
                            Was due {format(parseISO(p.dueDate), "MMM d, yyyy")}
                          </p>
                        )}
                      </div>
                      <div className="flex gap-1">
                        <Button
                          variant="ghost"
                          size="icon"
                          className="h-7 w-7"
                          onClick={() => unarchive(p.id)}
                          aria-label="Unarchive"
                        >
                          <RotateCcw className="h-3.5 w-3.5" />
                        </Button>
                        <Button
                          variant="ghost"
                          size="icon"
                          className="h-7 w-7"
                          onClick={() => del(p.id)}
                          aria-label="Delete"
                        >
                          <Trash2 className="h-3.5 w-3.5" />
                        </Button>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            );
          })}
        </div>
      </SheetContent>
    </Sheet>
  );
}
