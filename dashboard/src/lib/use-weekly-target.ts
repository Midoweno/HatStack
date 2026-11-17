import { useEffect, useState } from "react";

const KEY = "hatstack-chi-weekly-target";
const DEFAULT_TARGET = 4;

// How many days a week you aim to show up. Kept on this device only.
export function useWeeklyTarget() {
  const [target, setTargetState] = useState(DEFAULT_TARGET);

  useEffect(() => {
    try {
      const saved = Number(localStorage.getItem(KEY));
      if (saved >= 1 && saved <= 7) setTargetState(saved);
    } catch {
      // Storage unavailable — the default is fine.
    }
  }, []);

  const setTarget = (n: number) => {
    const next = Math.min(7, Math.max(1, n));
    setTargetState(next);
    try {
      localStorage.setItem(KEY, String(next));
    } catch {
      // Not persisted; still applies for this session.
    }
  };

  return [target, setTarget] as const;
}
