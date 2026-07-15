import { create } from "zustand";
import { persist } from "zustand/middleware";
import { addDays, addMonths, addWeeks, addYears, format, isAfter, parseISO } from "date-fns";
import type {
  DashboardState,
  Hat,
  Project,
  Recurrence,
  RecurrenceFreq,
  Task,
  Urgency,
} from "./dashboard-types";

const uid = () =>
  typeof crypto !== "undefined" && "randomUUID" in crypto
    ? crypto.randomUUID()
    : Math.random().toString(36).slice(2) + Date.now().toString(36);

function addByFreq(date: Date, freq: RecurrenceFreq): Date {
  switch (freq) {
    case "daily":
      return addDays(date, 1);
    case "weekly":
      return addWeeks(date, 1);
    case "monthly":
      return addMonths(date, 1);
    case "yearly":
      return addYears(date, 1);
  }
}

// Builds the next occurrence of a completed recurring task, or null if its
// recurrence has expired (past the optional "until" date).
function nextOccurrence(task: Task): Task | null {
  if (!task.recurrence) return null;
  const base = task.dueDate ? parseISO(task.dueDate) : new Date();
  const next = addByFreq(base, task.recurrence.freq);
  if (task.recurrence.until && isAfter(next, parseISO(task.recurrence.until))) {
    return null;
  }
  return {
    ...task,
    id: uid(),
    dueDate: format(next, "yyyy-MM-dd"),
    completed: false,
    completedAt: undefined,
    createdAt: Date.now(),
  };
}

interface Store extends DashboardState {
  addProject: (input: {
    hat: Hat;
    name: string;
    icon?: string;
    dueDate?: string;
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
    parentTaskId?: string;
    recurrence?: Recurrence;
  }) => Task;
  updateTask: (id: string, patch: Partial<Omit<Task, "id">>) => void;
  // Returns the id of the next recurring occurrence created, if any, so
  // callers (e.g. an undo action) can remove it when reverting completion.
  toggleTask: (id: string) => string | undefined;
  moveTaskToHat: (id: string, hat: Hat) => void;
  deleteTask: (id: string) => void;
}

const seed: DashboardState = {
  projects: [
    {
      id: "p-columbia",
      hat: "work",
      name: "Columbia Preparation",
      icon: "📄",
      dueDate: "2026-08-15",
      completed: false,
      createdAt: Date.now(),
    },
    {
      id: "p-portfolio",
      hat: "work",
      name: "AI Portfolio",
      icon: "💻",
      dueDate: "2026-09-01",
      completed: false,
      createdAt: Date.now(),
    },
    {
      id: "p-badminton",
      hat: "personal",
      name: "Badminton Gear",
      icon: "🏸",
      dueDate: "2026-07-25",
      completed: false,
      createdAt: Date.now(),
    },
  ],
  tasks: [
    {
      id: "t1",
      hat: "work",
      projectId: "p-columbia",
      name: "Email professor about recommendation",
      urgency: "critical",
      dueDate: new Date().toISOString().slice(0, 10),
      completed: false,
      createdAt: Date.now(),
    },
    {
      id: "t2",
      hat: "work",
      projectId: "p-portfolio",
      name: "Draft project case studies",
      urgency: "medium",
      completed: false,
      createdAt: Date.now(),
    },
    {
      id: "t3",
      hat: "routine",
      name: "Take medication",
      urgency: "high",
      dueDate: new Date().toISOString().slice(0, 10),
      completed: false,
      createdAt: Date.now(),
    },
    {
      id: "t4",
      hat: "routine",
      name: "Groceries",
      urgency: "medium",
      completed: false,
      createdAt: Date.now(),
    },
    {
      id: "t5",
      hat: "personal",
      projectId: "p-badminton",
      name: "Order new racket grip",
      urgency: "low",
      completed: false,
      createdAt: Date.now(),
    },
    {
      id: "t6",
      hat: "personal",
      name: "Call Mom",
      urgency: "high",
      completed: false,
      createdAt: Date.now(),
    },
  ],
};

export const useDashboard = create<Store>()(
  persist(
    (set) => ({
      ...seed,

      addProject: (input) => {
        const project: Project = {
          id: uid(),
          hat: input.hat,
          name: input.name,
          icon: input.icon,
          dueDate: input.dueDate,
          completed: false,
          createdAt: Date.now(),
        };
        set((s) => ({ projects: [...s.projects, project] }));
        return project;
      },
      updateProject: (id, patch) =>
        set((s) => ({
          projects: s.projects.map((p) => (p.id === id ? { ...p, ...patch } : p)),
        })),
      completeProject: (id) =>
        set((s) => ({
          projects: s.projects.map((p) =>
            p.id === id ? { ...p, completed: true, completedAt: Date.now() } : p,
          ),
        })),
      uncompleteProject: (id) =>
        set((s) => ({
          projects: s.projects.map((p) =>
            p.id === id ? { ...p, completed: false, completedAt: undefined } : p,
          ),
        })),
      deleteProject: (id) =>
        set((s) => ({
          projects: s.projects.filter((p) => p.id !== id),
          tasks: s.tasks.map((t) =>
            t.projectId === id ? { ...t, projectId: undefined } : t,
          ),
        })),

      addTask: (input) => {
        const task: Task = {
          id: uid(),
          hat: input.hat,
          projectId: input.projectId,
          parentTaskId: input.parentTaskId,
          name: input.name,
          urgency: input.urgency,
          dueDate: input.dueDate,
          recurrence: input.recurrence,
          completed: false,
          createdAt: Date.now(),
        };
        set((s) => ({ tasks: [...s.tasks, task] }));
        return task;
      },
      updateTask: (id, patch) =>
        set((s) => ({
          tasks: s.tasks.map((t) => (t.id === id ? { ...t, ...patch } : t)),
        })),
      toggleTask: (id) => {
        let createdId: string | undefined;
        set((s) => {
          const target = s.tasks.find((t) => t.id === id);
          if (!target) return s;

          const completing = !target.completed;
          const tasks = s.tasks.map((t) =>
            t.id === id
              ? {
                  ...t,
                  completed: completing,
                  completedAt: completing ? Date.now() : undefined,
                }
              : t,
          );

          if (completing && target.recurrence) {
            const next = nextOccurrence(target);
            if (next) {
              tasks.push(next);
              createdId = next.id;
            }
          }

          return { tasks };
        });
        return createdId;
      },
      moveTaskToHat: (id, hat) =>
        set((s) => ({
          tasks: s.tasks.map((t) =>
            t.id === id ? { ...t, hat, projectId: undefined } : t,
          ),
        })),
      deleteTask: (id) =>
        set((s) => ({ tasks: s.tasks.filter((t) => t.id !== id) })),
    }),
    { name: "hats-dashboard-v1" },
  ),
);
