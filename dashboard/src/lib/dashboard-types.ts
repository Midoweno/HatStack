export type Hat = "routine" | "work" | "personal";

export type Urgency = "critical" | "high" | "medium" | "low";

// Which Priority-view section a starred task sits in.
export type StarBucket = "priority" | "future" | "today";

export type DeadlineType = "exam" | "assignment" | "project";

export const DEADLINE_TYPES: { id: DeadlineType; label: string }[] = [
  { id: "exam", label: "Exam" },
  { id: "assignment", label: "Assignment" },
  { id: "project", label: "Project" },
];

export const HATS: { id: Hat; label: string }[] = [
  { id: "work", label: "Work" },
  { id: "personal", label: "Personal" },
  { id: "routine", label: "Routine" },
];

export const URGENCY_ORDER: Record<Urgency, number> = {
  critical: 0,
  high: 1,
  medium: 2,
  low: 3,
};

export const URGENCY_META: Record<
  Urgency,
  { label: string; dot: string; dotSolid: string; ring: string; text: string; pillText: string }
> = {
  critical: {
    label: "Critical",
    dot: "bg-urgency-critical",
    dotSolid: "bg-urgency-critical",
    ring: "ring-urgency-critical/40",
    text: "text-urgency-critical",
    pillText: "text-black/80",
  },
  high: {
    label: "High",
    dot: "bg-urgency-high/85",
    dotSolid: "bg-urgency-high",
    ring: "ring-urgency-high/40",
    text: "text-urgency-high",
    pillText: "text-black/80",
  },
  medium: {
    label: "Medium",
    dot: "bg-urgency-medium/70",
    dotSolid: "bg-urgency-medium",
    ring: "ring-urgency-medium/40",
    text: "text-urgency-medium",
    pillText: "text-black/80",
  },
  low: {
    label: "Low",
    dot: "bg-urgency-low/55",
    dotSolid: "bg-urgency-low",
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
  description?: string;
  completed: boolean;
  completedAt?: number;
  createdAt: number;
}

export type RecurrenceFreq = "daily" | "weekly" | "monthly" | "yearly";

export interface Recurrence {
  freq: RecurrenceFreq;
  interval: number; // repeat every N units of freq (e.g. freq: "daily", interval: 3 => every 3 days)
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
  description?: string;
  recurrence?: Recurrence;
  // Set on the auto-created next occurrence of a recurring task, pointing
  // back to the task instance that was completed to spawn it. Lets undo /
  // un-completing that instance remove the spawned occurrence again.
  recurrenceParentId?: string;
  completed: boolean;
  completedAt?: number;
  createdAt: number;
  // Starred into the Priority view (a second lens on the same tasks, not a
  // separate list). starOrder ranks position within its column; starBucket
  // picks the column — undefined/"priority" is the top "Priority" column,
  // "future" is the lower one that newly-starred tasks land in by default.
  starred?: boolean;
  starOrder?: number;
  starBucket?: StarBucket;
  // The single "current task" shown above Priority/Future — at most one task
  // is pinned at a time; pinning another one unpins the previous.
  pinned?: boolean;
  // Marks this as an exam/assignment/project so the Priority view shows a
  // countdown tile to its deadline: the recurrence end date if it repeats,
  // otherwise its own due date.
  deadlineType?: DeadlineType;
}

// One entry per drill placed on a day. Slots aren't free text — every entry
// must reference a drill that exists in the library. `id` is unique per
// placement (not per drill) so the same drill can be placed more than once
// on a day and each occurrence can be removed independently.
export interface WorkoutEntry {
  id: string;
  drillId: string;
}

// A day's placed drills, keyed to a real calendar date (not "day of week")
// so history stays put as you navigate to past/future weeks in the FIT view.
export interface Workout {
  id: string;
  date: string; // ISO date, yyyy-MM-dd
  entries: WorkoutEntry[];
  createdAt: number;
}

// A reusable named entry in the FIT drill library, picked into a day via the
// hover menu.
export interface Drill {
  id: string;
  name: string;
  position: number;
  createdAt: number;
}

export interface DashboardState {
  projects: Project[];
  tasks: Task[];
  workouts: Workout[];
  drills: Drill[];
}
