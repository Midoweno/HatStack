export type Hat = "routine" | "work" | "personal";

export type Urgency = "critical" | "high" | "medium" | "low";

export const HATS: { id: Hat; label: string }[] = [
  { id: "routine", label: "Routine" },
  { id: "work", label: "Work" },
  { id: "personal", label: "Personal" },
];

export const URGENCY_ORDER: Record<Urgency, number> = {
  critical: 0,
  high: 1,
  medium: 2,
  low: 3,
};

export const URGENCY_META: Record<
  Urgency,
  { label: string; dot: string; ring: string; text: string; pillText: string }
> = {
  critical: {
    label: "Critical",
    dot: "bg-urgency-critical",
    ring: "ring-urgency-critical/40",
    text: "text-urgency-critical",
    pillText: "text-white",
  },
  high: {
    label: "High",
    dot: "bg-urgency-high",
    ring: "ring-urgency-high/40",
    text: "text-urgency-high",
    pillText: "text-black/80",
  },
  medium: {
    label: "Medium",
    dot: "bg-urgency-medium",
    ring: "ring-urgency-medium/40",
    text: "text-urgency-medium",
    pillText: "text-black/80",
  },
  low: {
    label: "Low",
    dot: "bg-urgency-low",
    ring: "ring-urgency-low/40",
    text: "text-urgency-low",
    pillText: "text-black/80",
  },
};

export interface Project {
  id: string;
  hat: Hat;
  name: string;
  icon?: string;
  dueDate?: string; // ISO date
  archived: boolean;
  createdAt: number;
}

export type RecurrenceFreq = "daily" | "weekly" | "monthly" | "yearly";

export interface Recurrence {
  freq: RecurrenceFreq;
  until?: string; // ISO date; recurrence has no end date if omitted
}

export interface Task {
  id: string;
  hat: Hat;
  projectId?: string;
  parentTaskId?: string;
  name: string;
  urgency: Urgency;
  dueDate?: string;
  recurrence?: Recurrence;
  completed: boolean;
  completedAt?: number;
  createdAt: number;
}

export interface DashboardState {
  projects: Project[];
  tasks: Task[];
}
