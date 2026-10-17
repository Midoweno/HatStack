import { ClipboardList, Folder, GraduationCap, type LucideIcon } from "lucide-react";
import type { DeadlineType } from "./dashboard-types";

export const DEADLINE_ICONS: Record<DeadlineType, LucideIcon> = {
  exam: GraduationCap,
  assignment: ClipboardList,
  project: Folder,
};
