import { create } from "zustand";
import { addDays, addMonths, addWeeks, addYears, format, isAfter, parseISO } from "date-fns";
import type { RealtimeChannel } from "@supabase/supabase-js";
import { toast } from "sonner";
import { supabase } from "./supabase";
import type {
  DashboardState,
  DeadlineType,
  Hat,
  Project,
  Recurrence,
  RecurrenceFreq,
  Space,
  StarBucket,
  Task,
  Urgency,
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
    // A starred recurring task's next copy steps one section down, landing at
    // the top of it: completed in Today -> Priority, completed in Priority
    // (or Future) -> Future. A missing bucket means Priority.
    ...(task.starred
      ? {
          starBucket: (task.starBucket === "today" ? "priority" : "future") as StarBucket,
          starOrder: Date.now(),
        }
      : {}),
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
  space: Space;
  passion: string | null;
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
  star_bucket: StarBucket | null;
  pinned: boolean;
  deadline_type: DeadlineType | null;
  space: Space;
};

function projectFromRow(row: ProjectRow): Project {
  return {
    id: row.id,
    hat: row.hat,
    name: row.name,
    icon: row.icon ?? undefined,
    dueDate: row.due_date ?? undefined,
    description: row.description ?? undefined,
    space: row.space ?? "hats",
    passion: row.passion ?? undefined,
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
    space: p.space ?? "hats",
    passion: p.passion ?? null,
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
  if ("passion" in patch) row.passion = patch.passion ?? null;
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
    pinned: row.pinned,
    deadlineType: row.deadline_type ?? undefined,
    space: row.space ?? "hats",
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
    pinned: t.pinned ?? false,
    deadline_type: t.deadlineType ?? null,
    space: t.space ?? "hats",
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
  if ("pinned" in patch) row.pinned = patch.pinned ?? false;
  if ("deadlineType" in patch) row.deadline_type = patch.deadlineType ?? null;
  return row;
}

function reportError(action: string, error: { message: string }) {
  console.error(`[dashboard-store] ${action} failed:`, error.message);
  toast.error(`Couldn't save: ${action}`, { description: error.message });
}

// A starOrder that sorts below every starred, open, top-level task already in
// this section (a missing bucket counts as Priority, like the Priority view).
function bottomStarOrder(tasks: Task[], bucket: StarBucket | undefined): number {
  const orders = tasks
    .filter(
      (t) =>
        t.starred &&
        !t.completed &&
        !t.parentTaskId &&
        !t.pinned &&
        (t.starBucket ?? "priority") === bucket,
    )
    .map((t) => t.starOrder ?? 0);
  return orders.length > 0 ? Math.min(...orders) - 1 : Date.now();
}

// --- Store --------------------------------------------------------------

interface Store extends DashboardState {
  userId: string | null;
  loading: boolean;
  // Set when the initial load still fails after retrying — the dashboard
  // shows a retry screen instead of an empty (and misleading) task list.
  loadError: string | null;
  init: (userId: string) => Promise<void>;
  reset: () => void;

  addProject: (input: {
    hat: Hat;
    name: string;
    icon?: string;
    dueDate?: string;
    description?: string;
    space?: Space;
    passion?: string;
  }) => Project;
  updateProject: (id: string, patch: Partial<Omit<Project, "id">>) => void;
  completeProject: (id: string) => void;
  uncompleteProject: (id: string) => void;
  deleteProject: (id: string) => void;
  // CHI goals: deletes the goal together with its tasks (a Hats project only
  // detaches its tasks, but CHI tasks without a goal would be orphaned).
  deleteGoal: (id: string) => void;

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
    starBucket?: StarBucket;
    deadlineType?: DeadlineType;
    space?: Space;
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
  setStarredOrder: (bucket: StarBucket, orderedIds: string[]) => void;

  // Pins this task as the single "current task" shown above Priority/Future;
  // pinning one unpins whichever task was previously pinned. Calling it on
  // the already-pinned task unpins it.
  togglePin: (id: string) => void;
}

let channel: RealtimeChannel | null = null;

export const useDashboard = create<Store>()((set, get) => ({
  projects: [],
  tasks: [],
  userId: null,
  loading: true,
  loadError: null,

  init: async (userId) => {
    // Guard against redundant reloads (e.g. a transient auth blip re-firing
    // sign-in for a user we're already subscribed to) wiping loaded state
    // and briefly blanking the dashboard while it re-fetches. A failed load
    // is not "loaded", so it is allowed to run again.
    if (get().userId === userId && channel && !get().loadError) return;
    set({ loading: true, userId, loadError: null });

    // A single hiccup (flaky connection, an access token that expired while
    // the tab slept, a cold backend) shouldn't leave you with an empty
    // dashboard: retry a few times, refreshing the session between tries.
    let projectRows: ProjectRow[] | null = null;
    let taskRows: TaskRow[] | null = null;
    let lastError = "";
    for (let attempt = 0; attempt < 4; attempt++) {
      if (attempt > 0) {
        await new Promise((r) => setTimeout(r, 500 * 2 ** (attempt - 1)));
        await supabase.auth.refreshSession().catch(() => undefined);
      }
      const [p, t] = await Promise.all([
        supabase.from("projects").select("*").eq("user_id", userId),
        supabase.from("tasks").select("*").eq("user_id", userId),
      ]);
      const error = p.error ?? t.error;
      if (error) {
        lastError = error.message;
        console.error("[dashboard-store] load failed:", error.message);
        continue;
      }
      projectRows = p.data as ProjectRow[];
      taskRows = t.data as TaskRow[];
      break;
    }

    if (!projectRows || !taskRows) {
      set({ loading: false, loadError: lastError || "Couldn't reach the server" });
      return;
    }

    set({
      projects: projectRows.map(projectFromRow),
      tasks: taskRows.map(taskFromRow),
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
      .subscribe();
  },

  reset: () => {
    channel?.unsubscribe();
    channel = null;
    set({ projects: [], tasks: [], userId: null, loading: true, loadError: null });
  },

  addProject: (input) => {
    const project: Project = {
      id: uid(),
      hat: input.hat,
      name: input.name,
      icon: input.icon,
      dueDate: input.dueDate,
      description: input.description,
      space: input.space,
      passion: input.passion,
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
  deleteGoal: (id) => {
    const tasks = get().tasks;
    const goalTaskIds = tasks.filter((t) => t.projectId === id).map((t) => t.id);
    const subtaskIds = tasks
      .filter((t) => t.parentTaskId && goalTaskIds.includes(t.parentTaskId))
      .map((t) => t.id);
    const doomed = new Set([...goalTaskIds, ...subtaskIds]);
    set((s) => ({
      projects: s.projects.filter((p) => p.id !== id),
      tasks: s.tasks.filter((t) => !doomed.has(t.id)),
    }));
    if (doomed.size > 0) {
      supabase
        .from("tasks")
        .delete()
        .in("id", [...doomed])
        .then(({ error }) => error && reportError("delete goal tasks", error));
    }
    supabase
      .from("projects")
      .delete()
      .eq("id", id)
      .then(({ error }) => error && reportError("delete goal", error));
  },

  addTask: (input) => {
    const newBucket = input.starred ? (input.starBucket ?? "future") : undefined;
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
      deadlineType: input.deadlineType,
      space: input.space,
      completed: false,
      createdAt: Date.now(),
      starred: input.starred,
      // Defaults to "Future" (matching toggleStar) unless the caller picked
      // another section. Lists sort by starOrder high-to-low, so a new task
      // takes a rank just below the lowest in its section: the bottom.
      starOrder: input.starred ? bottomStarOrder(get().tasks, newBucket) : undefined,
      starBucket: newBucket,
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
    let patch: { starred: boolean; starOrder?: number; starBucket?: StarBucket } | undefined;
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
  togglePin: (id) => {
    let nowPinned = false;
    let previousPinnedId: string | undefined;
    set((s) => {
      const target = s.tasks.find((t) => t.id === id);
      if (!target) return s;
      nowPinned = !target.pinned;
      previousPinnedId = nowPinned
        ? s.tasks.find((t) => t.pinned && t.id !== id)?.id
        : undefined;
      return {
        tasks: s.tasks.map((t) => {
          if (t.id === id) return { ...t, pinned: nowPinned };
          if (nowPinned && t.pinned) return { ...t, pinned: false };
          return t;
        }),
      };
    });
    const userId = get().userId;
    if (userId) {
      supabase
        .from("tasks")
        .update(taskPatchToRow({ pinned: nowPinned }))
        .eq("id", id)
        .then(({ error }) => error && reportError("pin task", error));
      if (previousPinnedId) {
        supabase
          .from("tasks")
          .update(taskPatchToRow({ pinned: false }))
          .eq("id", previousPinnedId)
          .then(({ error }) => error && reportError("unpin task", error));
      }
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
}));
