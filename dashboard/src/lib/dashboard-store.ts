import { create } from "zustand";
import { addDays, addMonths, addWeeks, addYears, format, isAfter, parseISO } from "date-fns";
import type { RealtimeChannel } from "@supabase/supabase-js";
import { toast } from "sonner";
import { supabase } from "./supabase";
import type {
  DashboardState,
  Drill,
  Hat,
  Project,
  Recurrence,
  RecurrenceFreq,
  Task,
  Urgency,
  Workout,
} from "./dashboard-types";

const uid = () =>
  typeof crypto !== "undefined" && "randomUUID" in crypto
    ? crypto.randomUUID()
    : Math.random().toString(36).slice(2) + Date.now().toString(36);

function addByFreq(date: Date, freq: RecurrenceFreq, interval: number): Date {
  switch (freq) {
    case "daily":
      return addDays(date, interval);
    case "weekly":
      return addWeeks(date, interval);
    case "monthly":
      return addMonths(date, interval);
    case "yearly":
      return addYears(date, interval);
  }
}

// Builds the next occurrence of a completed recurring task, or null if its
// recurrence has expired (past the optional "until" date).
function nextOccurrence(task: Task): Task | null {
  if (!task.recurrence) return null;
  const base = task.dueDate ? parseISO(task.dueDate) : new Date();
  const next = addByFreq(base, task.recurrence.freq, task.recurrence.interval);
  if (task.recurrence.until && isAfter(next, parseISO(task.recurrence.until))) {
    return null;
  }
  return {
    ...task,
    id: uid(),
    dueDate: format(next, "yyyy-MM-dd"),
    recurrenceParentId: task.id,
    completed: false,
    completedAt: undefined,
    createdAt: Date.now(),
  };
}

// --- Supabase row <-> app type conversion -----------------------------

type ProjectRow = {
  id: string;
  user_id: string;
  hat: Hat;
  name: string;
  icon: string | null;
  due_date: string | null;
  description: string | null;
  completed: boolean;
  completed_at: string | null;
  created_at: string;
};

type TaskRow = {
  id: string;
  user_id: string;
  hat: Hat;
  project_id: string | null;
  parent_task_id: string | null;
  name: string;
  urgency: Urgency;
  due_date: string | null;
  description: string | null;
  recurrence_freq: RecurrenceFreq | null;
  recurrence_interval: number | null;
  recurrence_until: string | null;
  recurrence_parent_id: string | null;
  completed: boolean;
  completed_at: string | null;
  created_at: string;
  starred: boolean;
  star_order: number | null;
  star_bucket: "priority" | "future" | null;
};

function projectFromRow(row: ProjectRow): Project {
  return {
    id: row.id,
    hat: row.hat,
    name: row.name,
    icon: row.icon ?? undefined,
    dueDate: row.due_date ?? undefined,
    description: row.description ?? undefined,
    completed: row.completed,
    completedAt: row.completed_at ? new Date(row.completed_at).getTime() : undefined,
    createdAt: new Date(row.created_at).getTime(),
  };
}

function projectToRow(userId: string, p: Project): ProjectRow {
  return {
    id: p.id,
    user_id: userId,
    hat: p.hat,
    name: p.name,
    icon: p.icon ?? null,
    due_date: p.dueDate ?? null,
    description: p.description ?? null,
    completed: p.completed,
    completed_at: p.completedAt ? new Date(p.completedAt).toISOString() : null,
    created_at: new Date(p.createdAt).toISOString(),
  };
}

function projectPatchToRow(patch: Partial<Omit<Project, "id">>) {
  const row: Record<string, unknown> = {};
  if ("hat" in patch) row.hat = patch.hat;
  if ("name" in patch) row.name = patch.name;
  if ("icon" in patch) row.icon = patch.icon ?? null;
  if ("dueDate" in patch) row.due_date = patch.dueDate ?? null;
  if ("description" in patch) row.description = patch.description ?? null;
  if ("completed" in patch) row.completed = patch.completed;
  if ("completedAt" in patch)
    row.completed_at = patch.completedAt ? new Date(patch.completedAt).toISOString() : null;
  return row;
}

function taskFromRow(row: TaskRow): Task {
  return {
    id: row.id,
    hat: row.hat,
    projectId: row.project_id ?? undefined,
    parentTaskId: row.parent_task_id ?? undefined,
    name: row.name,
    urgency: row.urgency,
    dueDate: row.due_date ?? undefined,
    description: row.description ?? undefined,
    recurrence: row.recurrence_freq
      ? {
          freq: row.recurrence_freq,
          interval: row.recurrence_interval ?? 1,
          until: row.recurrence_until ?? undefined,
        }
      : undefined,
    recurrenceParentId: row.recurrence_parent_id ?? undefined,
    completed: row.completed,
    completedAt: row.completed_at ? new Date(row.completed_at).getTime() : undefined,
    createdAt: new Date(row.created_at).getTime(),
    starred: row.starred,
    starOrder: row.star_order ?? undefined,
    starBucket: row.star_bucket ?? undefined,
  };
}

function taskToRow(userId: string, t: Task): TaskRow {
  return {
    id: t.id,
    user_id: userId,
    hat: t.hat,
    project_id: t.projectId ?? null,
    parent_task_id: t.parentTaskId ?? null,
    name: t.name,
    urgency: t.urgency,
    due_date: t.dueDate ?? null,
    description: t.description ?? null,
    recurrence_freq: t.recurrence?.freq ?? null,
    recurrence_interval: t.recurrence?.interval ?? 1,
    recurrence_until: t.recurrence?.until ?? null,
    recurrence_parent_id: t.recurrenceParentId ?? null,
    completed: t.completed,
    completed_at: t.completedAt ? new Date(t.completedAt).toISOString() : null,
    created_at: new Date(t.createdAt).toISOString(),
    starred: t.starred ?? false,
    star_order: t.starOrder ?? null,
    star_bucket: t.starBucket ?? null,
  };
}

function taskPatchToRow(patch: Partial<Omit<Task, "id">>) {
  const row: Record<string, unknown> = {};
  if ("hat" in patch) row.hat = patch.hat;
  if ("projectId" in patch) row.project_id = patch.projectId ?? null;
  if ("parentTaskId" in patch) row.parent_task_id = patch.parentTaskId ?? null;
  if ("name" in patch) row.name = patch.name;
  if ("urgency" in patch) row.urgency = patch.urgency;
  if ("dueDate" in patch) row.due_date = patch.dueDate ?? null;
  if ("description" in patch) row.description = patch.description ?? null;
  if ("recurrence" in patch) {
    row.recurrence_freq = patch.recurrence?.freq ?? null;
    row.recurrence_interval = patch.recurrence?.interval ?? 1;
    row.recurrence_until = patch.recurrence?.until ?? null;
  }
  if ("recurrenceParentId" in patch)
    row.recurrence_parent_id = patch.recurrenceParentId ?? null;
  if ("completed" in patch) row.completed = patch.completed;
  if ("completedAt" in patch)
    row.completed_at = patch.completedAt ? new Date(patch.completedAt).toISOString() : null;
  if ("starred" in patch) row.starred = patch.starred ?? false;
  if ("starOrder" in patch) row.star_order = patch.starOrder ?? null;
  if ("starBucket" in patch) row.star_bucket = patch.starBucket ?? null;
  return row;
}

type WorkoutRow = {
  id: string;
  user_id: string;
  date: string;
  notes: string;
  created_at: string;
};

type DrillRow = {
  id: string;
  user_id: string;
  name: string;
  position: number;
  created_at: string;
};

function workoutFromRow(row: WorkoutRow): Workout {
  return {
    id: row.id,
    date: row.date,
    notes: row.notes,
    createdAt: new Date(row.created_at).getTime(),
  };
}

function workoutToRow(userId: string, w: Workout): WorkoutRow {
  return {
    id: w.id,
    user_id: userId,
    date: w.date,
    notes: w.notes,
    created_at: new Date(w.createdAt).toISOString(),
  };
}

function drillFromRow(row: DrillRow): Drill {
  return {
    id: row.id,
    name: row.name,
    position: row.position,
    createdAt: new Date(row.created_at).getTime(),
  };
}

function drillToRow(userId: string, d: Drill): DrillRow {
  return {
    id: d.id,
    user_id: userId,
    name: d.name,
    position: d.position,
    created_at: new Date(d.createdAt).toISOString(),
  };
}

function reportError(action: string, error: { message: string }) {
  console.error(`[dashboard-store] ${action} failed:`, error.message);
  toast.error(`Couldn't save: ${action}`, { description: error.message });
}

// --- Store --------------------------------------------------------------

interface Store extends DashboardState {
  userId: string | null;
  loading: boolean;
  init: (userId: string) => Promise<void>;
  reset: () => void;

  addProject: (input: {
    hat: Hat;
    name: string;
    icon?: string;
    dueDate?: string;
    description?: string;
  }) => Project;
  updateProject: (id: string, patch: Partial<Omit<Project, "id">>) => void;
  completeProject: (id: string) => void;
  uncompleteProject: (id: string) => void;
  deleteProject: (id: string) => void;

  addTask: (input: {
    hat: Hat;
    name: string;
    urgency: Urgency;
    projectId?: string;
    dueDate?: string;
    description?: string;
    parentTaskId?: string;
    recurrence?: Recurrence;
    starred?: boolean;
  }) => Task;
  updateTask: (id: string, patch: Partial<Omit<Task, "id">>) => void;
  // Returns the id of the next recurring occurrence created, if any, so
  // callers (e.g. an undo action) can remove it when reverting completion.
  toggleTask: (id: string) => string | undefined;
  // Completes this occurrence without spawning the next one, and stops the
  // recurrence entirely — for "we're done with this series, stop resurfacing it".
  completeRecurringSeries: (id: string) => void;
  moveTaskToHat: (id: string, hat: Hat) => void;
  deleteTask: (id: string) => void;

  toggleStar: (id: string) => void;
  // Sets the given column's full top-to-bottom order after a drag (within a
  // column, or moved in from the other one). orderedIds must include the
  // moved task if this is a cross-column move — its starBucket is set to
  // `bucket` along with everyone else's rank.
  setStarredOrder: (bucket: "priority" | "future", orderedIds: string[]) => void;

  // Upserts the free-text workout note for a given real calendar date
  // (yyyy-MM-dd). Passing empty notes deletes the entry.
  setWorkoutNote: (date: string, notes: string) => void;
  addDrill: (name: string) => Drill;
  updateDrill: (id: string, name: string) => void;
  deleteDrill: (id: string) => void;
  reorderDrills: (orderedIds: string[]) => void;
}

let channel: RealtimeChannel | null = null;

export const useDashboard = create<Store>()((set, get) => ({
  projects: [],
  tasks: [],
  workouts: [],
  drills: [],
  userId: null,
  loading: true,

  init: async (userId) => {
    // Guard against redundant reloads (e.g. a transient auth blip re-firing
    // sign-in for a user we're already subscribed to) wiping loaded state
    // and briefly blanking the dashboard while it re-fetches.
    if (get().userId === userId && channel) return;
    set({ loading: true, userId });

    const [
      { data: projectRows, error: pErr },
      { data: taskRows, error: tErr },
      { data: workoutRows, error: wErr },
      { data: drillRows, error: dErr },
    ] = await Promise.all([
      supabase.from("projects").select("*").eq("user_id", userId),
      supabase.from("tasks").select("*").eq("user_id", userId),
      supabase.from("workouts").select("*").eq("user_id", userId),
      supabase.from("drills").select("*").eq("user_id", userId),
    ]);

    if (pErr) reportError("load projects", pErr);
    if (tErr) reportError("load tasks", tErr);
    if (wErr) reportError("load workouts", wErr);
    if (dErr) reportError("load drills", dErr);

    set({
      projects: (projectRows ?? []).map(projectFromRow),
      tasks: (taskRows ?? []).map(taskFromRow),
      workouts: (workoutRows ?? []).map(workoutFromRow),
      drills: (drillRows ?? []).map(drillFromRow),
      loading: false,
    });

    channel?.unsubscribe();
    channel = supabase
      .channel(`dashboard-${userId}`)
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "projects", filter: `user_id=eq.${userId}` },
        (payload) => {
          if (payload.eventType === "DELETE") {
            const id = (payload.old as { id: string }).id;
            set((s) => ({ projects: s.projects.filter((p) => p.id !== id) }));
            return;
          }
          const project = projectFromRow(payload.new as ProjectRow);
          set((s) => ({
            projects: s.projects.some((p) => p.id === project.id)
              ? s.projects.map((p) => (p.id === project.id ? project : p))
              : [...s.projects, project],
          }));
        },
      )
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "tasks", filter: `user_id=eq.${userId}` },
        (payload) => {
          if (payload.eventType === "DELETE") {
            const id = (payload.old as { id: string }).id;
            set((s) => ({ tasks: s.tasks.filter((t) => t.id !== id) }));
            return;
          }
          const task = taskFromRow(payload.new as TaskRow);
          set((s) => ({
            tasks: s.tasks.some((t) => t.id === task.id)
              ? s.tasks.map((t) => (t.id === task.id ? task : t))
              : [...s.tasks, task],
          }));
        },
      )
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "workouts", filter: `user_id=eq.${userId}` },
        (payload) => {
          if (payload.eventType === "DELETE") {
            const id = (payload.old as { id: string }).id;
            set((s) => ({ workouts: s.workouts.filter((w) => w.id !== id) }));
            return;
          }
          const workout = workoutFromRow(payload.new as WorkoutRow);
          set((s) => ({
            workouts: s.workouts.some((w) => w.id === workout.id)
              ? s.workouts.map((w) => (w.id === workout.id ? workout : w))
              : [...s.workouts, workout],
          }));
        },
      )
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "drills", filter: `user_id=eq.${userId}` },
        (payload) => {
          if (payload.eventType === "DELETE") {
            const id = (payload.old as { id: string }).id;
            set((s) => ({ drills: s.drills.filter((d) => d.id !== id) }));
            return;
          }
          const drill = drillFromRow(payload.new as DrillRow);
          set((s) => ({
            drills: s.drills.some((d) => d.id === drill.id)
              ? s.drills.map((d) => (d.id === drill.id ? drill : d))
              : [...s.drills, drill],
          }));
        },
      )
      .subscribe();
  },

  reset: () => {
    channel?.unsubscribe();
    channel = null;
    set({ projects: [], tasks: [], workouts: [], drills: [], userId: null, loading: true });
  },

  addProject: (input) => {
    const project: Project = {
      id: uid(),
      hat: input.hat,
      name: input.name,
      icon: input.icon,
      dueDate: input.dueDate,
      description: input.description,
      completed: false,
      createdAt: Date.now(),
    };
    set((s) => ({ projects: [...s.projects, project] }));
    const userId = get().userId;
    if (userId) {
      supabase
        .from("projects")
        .insert(projectToRow(userId, project))
        .then(({ error }) => error && reportError("add project", error));
    }
    return project;
  },
  updateProject: (id, patch) => {
    set((s) => ({
      projects: s.projects.map((p) => (p.id === id ? { ...p, ...patch } : p)),
      // Keep a project's tasks in the same hat group as the project itself —
      // groups must not overlap across Routine/Work/Personal.
      tasks:
        "hat" in patch
          ? s.tasks.map((t) => (t.projectId === id ? { ...t, hat: patch.hat! } : t))
          : s.tasks,
    }));
    supabase
      .from("projects")
      .update(projectPatchToRow(patch))
      .eq("id", id)
      .then(({ error }) => error && reportError("update project", error));
    if ("hat" in patch) {
      supabase
        .from("tasks")
        .update(taskPatchToRow({ hat: patch.hat }))
        .eq("project_id", id)
        .then(({ error }) => error && reportError("move project tasks", error));
    }
  },
  completeProject: (id) => get().updateProject(id, { completed: true, completedAt: Date.now() }),
  uncompleteProject: (id) =>
    get().updateProject(id, { completed: false, completedAt: undefined }),
  deleteProject: (id) => {
    set((s) => ({
      projects: s.projects.filter((p) => p.id !== id),
      tasks: s.tasks.map((t) => (t.projectId === id ? { ...t, projectId: undefined } : t)),
    }));
    supabase
      .from("projects")
      .delete()
      .eq("id", id)
      .then(({ error }) => error && reportError("delete project", error));
  },

  addTask: (input) => {
    const task: Task = {
      id: uid(),
      hat: input.hat,
      projectId: input.projectId,
      parentTaskId: input.parentTaskId,
      name: input.name,
      urgency: input.urgency,
      dueDate: input.dueDate,
      description: input.description,
      recurrence: input.recurrence,
      completed: false,
      createdAt: Date.now(),
      starred: input.starred,
      // Matches toggleStar: newly-starred tasks land in "Future".
      starOrder: input.starred ? Date.now() : undefined,
      starBucket: input.starred ? "future" : undefined,
    };
    set((s) => ({ tasks: [...s.tasks, task] }));
    const userId = get().userId;
    if (userId) {
      supabase
        .from("tasks")
        .insert(taskToRow(userId, task))
        .then(({ error }) => error && reportError("add task", error));
    }
    return task;
  },
  updateTask: (id, patch) => {
    set((s) => ({
      tasks: s.tasks.map((t) => (t.id === id ? { ...t, ...patch } : t)),
    }));
    supabase
      .from("tasks")
      .update(taskPatchToRow(patch))
      .eq("id", id)
      .then(({ error }) => error && reportError("update task", error));
  },
  toggleTask: (id) => {
    let createdId: string | undefined;
    let created: Task | undefined;
    let removedId: string | undefined;
    let toggled: Task | undefined;

    set((s) => {
      const target = s.tasks.find((t) => t.id === id);
      if (!target) return s;

      const completing = !target.completed;
      let tasks = s.tasks.map((t) => {
        if (t.id !== id) return t;
        toggled = { ...t, completed: completing, completedAt: completing ? Date.now() : undefined };
        return toggled;
      });

      // Guard against creating a second next-occurrence for the same task
      // (e.g. a duplicate toggle replayed by a stale reconnect) — each
      // completed occurrence should spawn exactly one successor.
      const alreadySpawned = s.tasks.some((t) => t.recurrenceParentId === id);
      if (completing && target.recurrence && !alreadySpawned) {
        const next = nextOccurrence(target);
        if (next) {
          tasks.push(next);
          created = next;
          createdId = next.id;
        }
      }

      if (!completing) {
        // Un-completing a recurring task: remove the next occurrence it
        // spawned, if the user hasn't already completed that one too.
        const spawned = tasks.find((t) => t.recurrenceParentId === id && !t.completed);
        if (spawned) {
          tasks = tasks.filter((t) => t.id !== spawned.id);
          removedId = spawned.id;
        }
      }

      return { tasks };
    });

    const userId = get().userId;
    if (userId && toggled) {
      supabase
        .from("tasks")
        .update(taskPatchToRow({ completed: toggled.completed, completedAt: toggled.completedAt }))
        .eq("id", id)
        .then(({ error }) => error && reportError("toggle task", error));
    }
    if (userId && created) {
      supabase
        .from("tasks")
        .insert(taskToRow(userId, created))
        .then(({ error }) => {
          // 23505 = unique_violation: another device already spawned this
          // task's next occurrence — that's the correct outcome, not a bug.
          if (error && error.code !== "23505") reportError("add recurring task", error);
        });
    }
    if (userId && removedId) {
      supabase
        .from("tasks")
        .delete()
        .eq("id", removedId)
        .then(({ error }) => error && reportError("remove recurring occurrence", error));
    }

    return createdId;
  },
  completeRecurringSeries: (id) => {
    const completedAt = Date.now();
    let removedId: string | undefined;

    set((s) => {
      const target = s.tasks.find((t) => t.id === id);
      if (!target) return s;

      let tasks = s.tasks.map((t) =>
        t.id === id ? { ...t, completed: true, completedAt, recurrence: undefined } : t,
      );

      // Drop any next occurrence already spawned from this task, since the
      // whole series is being ended.
      const spawned = tasks.find((t) => t.recurrenceParentId === id && !t.completed);
      if (spawned) {
        tasks = tasks.filter((t) => t.id !== spawned.id);
        removedId = spawned.id;
      }

      return { tasks };
    });

    const userId = get().userId;
    if (userId) {
      supabase
        .from("tasks")
        .update(taskPatchToRow({ completed: true, completedAt, recurrence: undefined }))
        .eq("id", id)
        .then(({ error }) => error && reportError("complete recurring series", error));
      if (removedId) {
        supabase
          .from("tasks")
          .delete()
          .eq("id", removedId)
          .then(({ error }) => error && reportError("remove recurring occurrence", error));
      }
    }
  },
  moveTaskToHat: (id, hat) => get().updateTask(id, { hat, projectId: undefined }),
  deleteTask: (id) => {
    const subtaskIds = get()
      .tasks.filter((t) => t.parentTaskId === id)
      .map((t) => t.id);
    set((s) => ({
      tasks: s.tasks.filter((t) => t.id !== id && t.parentTaskId !== id),
    }));
    supabase
      .from("tasks")
      .delete()
      .eq("id", id)
      .then(({ error }) => error && reportError("delete task", error));
    if (subtaskIds.length) {
      supabase
        .from("tasks")
        .delete()
        .in("id", subtaskIds)
        .then(({ error }) => error && reportError("delete subtasks", error));
    }
  },

  toggleStar: (id) => {
    let patch: { starred: boolean; starOrder?: number; starBucket?: "priority" | "future" } | undefined;
    set((s) => ({
      tasks: s.tasks.map((t) => {
        if (t.id !== id) return t;
        const starred = !t.starred;
        // Newly-starred tasks land in "Future"; the user promotes them to
        // "Priority" by dragging.
        patch = {
          starred,
          starOrder: starred ? Date.now() : t.starOrder,
          starBucket: starred ? "future" : t.starBucket,
        };
        return { ...t, ...patch };
      }),
    }));
    const userId = get().userId;
    if (userId && patch) {
      supabase
        .from("tasks")
        .update(taskPatchToRow(patch))
        .eq("id", id)
        .then(({ error }) => error && reportError("star task", error));
    }
  },
  setStarredOrder: (bucket, orderedIds) => {
    const base = Date.now();
    const orderMap = new Map(orderedIds.map((id, i) => [id, base - i]));
    set((s) => ({
      tasks: s.tasks.map((t) =>
        orderMap.has(t.id) ? { ...t, starBucket: bucket, starOrder: orderMap.get(t.id)! } : t,
      ),
    }));
    const userId = get().userId;
    if (userId) {
      orderedIds.forEach((id, i) => {
        supabase
          .from("tasks")
          .update({ star_bucket: bucket, star_order: base - i })
          .eq("id", id)
          .then(({ error }) => error && reportError("reorder priority list", error));
      });
    }
  },

  setWorkoutNote: (date, notes) => {
    const trimmed = notes.trim();
    const existing = get().workouts.find((w) => w.date === date);
    const userId = get().userId;

    if (!trimmed) {
      if (!existing) return;
      set((s) => ({ workouts: s.workouts.filter((w) => w.date !== date) }));
      if (userId) {
        supabase
          .from("workouts")
          .delete()
          .eq("id", existing.id)
          .then(({ error }) => error && reportError("clear workout", error));
      }
      return;
    }

    if (existing) {
      const updated = { ...existing, notes: trimmed };
      set((s) => ({ workouts: s.workouts.map((w) => (w.id === existing.id ? updated : w)) }));
      if (userId) {
        supabase
          .from("workouts")
          .update({ notes: trimmed })
          .eq("id", existing.id)
          .then(({ error }) => error && reportError("save workout", error));
      }
    } else {
      const workout: Workout = { id: uid(), date, notes: trimmed, createdAt: Date.now() };
      set((s) => ({ workouts: [...s.workouts, workout] }));
      if (userId) {
        supabase
          .from("workouts")
          .insert(workoutToRow(userId, workout))
          .then(({ error }) => error && reportError("save workout", error));
      }
    }
  },
  addDrill: (name) => {
    const maxPosition = get().drills.reduce((max, d) => Math.max(max, d.position), -1);
    const drill: Drill = { id: uid(), name, position: maxPosition + 1, createdAt: Date.now() };
    set((s) => ({ drills: [...s.drills, drill] }));
    const userId = get().userId;
    if (userId) {
      supabase
        .from("drills")
        .insert(drillToRow(userId, drill))
        .then(({ error }) => error && reportError("add drill", error));
    }
    return drill;
  },
  updateDrill: (id, name) => {
    set((s) => ({ drills: s.drills.map((d) => (d.id === id ? { ...d, name } : d)) }));
    supabase
      .from("drills")
      .update({ name })
      .eq("id", id)
      .then(({ error }) => error && reportError("update drill", error));
  },
  deleteDrill: (id) => {
    set((s) => ({ drills: s.drills.filter((d) => d.id !== id) }));
    supabase
      .from("drills")
      .delete()
      .eq("id", id)
      .then(({ error }) => error && reportError("delete drill", error));
  },
  reorderDrills: (orderedIds) => {
    set((s) => {
      const positionById = new Map(orderedIds.map((id, i) => [id, i]));
      return {
        drills: s.drills.map((d) =>
          positionById.has(d.id) ? { ...d, position: positionById.get(d.id)! } : d,
        ),
      };
    });
    const userId = get().userId;
    if (userId) {
      orderedIds.forEach((id, i) => {
        supabase
          .from("drills")
          .update({ position: i })
          .eq("id", id)
          .then(({ error }) => error && reportError("reorder drills", error));
      });
    }
  },
}));
