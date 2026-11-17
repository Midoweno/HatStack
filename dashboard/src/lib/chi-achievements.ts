import {
  Crown,
  Flame,
  Gem,
  Sparkles,
  Sprout,
  Target,
  Trophy,
  Zap,
  Brain,
  type LucideIcon,
} from "lucide-react";
import type { ChiStats } from "./chi-stats";

export interface Achievement {
  id: string;
  name: string;
  hint: string;
  icon: LucideIcon;
  earned: boolean;
  // "3 / 7" while locked, so the next step is always visible.
  progress: string;
}

function make(
  id: string,
  name: string,
  hint: string,
  icon: LucideIcon,
  value: number,
  target: number,
): Achievement {
  return {
    id,
    name,
    hint,
    icon,
    earned: value >= target,
    progress: `${Math.min(value, target)} / ${target}`,
  };
}

export function computeAchievements(stats: ChiStats): Achievement[] {
  return [
    make("first", "First step", "Finish 1 task", Sparkles, stats.done, 1),
    make("roll", "On a roll", "3-day streak", Flame, stats.bestStreak, 3),
    make("week", "Week warrior", "7-day streak", Zap, stats.bestStreak, 7),
    make("goal", "Goal getter", "Finish a goal", Target, stats.goalsFinished, 1),
    make("hundred", "Centurion", "Finish 100 tasks", Trophy, stats.done, 100),
    make("unbroken", "Unbroken", "30-day streak", Gem, stats.bestStreak, 30),
    make("deep", "Deep work", "10 tasks in one day", Brain, stats.bestDay, 10),
    make("master", "Master", "Finish 5 goals", Crown, stats.goalsFinished, 5),
    make("seeds", "Beginner's mind", "Start 3 goals", Sprout, stats.goalsCreated, 3),
  ];
}
