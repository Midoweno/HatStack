import { useEffect, useState } from "react";

export type Theme = "light" | "dark";

const STORAGE_KEY = "hatstack-theme";

function getStoredTheme(): Theme | null {
  try {
    const v = localStorage.getItem(STORAGE_KEY);
    return v === "light" || v === "dark" ? v : null;
  } catch {
    return null;
  }
}

function applyTheme(theme: Theme) {
  document.documentElement.classList.toggle("dark", theme === "dark");
}

// Mirrors the blocking script in __root.tsx that sets the class before first
// paint — this just syncs React state to whatever that script (or a previous
// toggle) already applied, so there's no flash and no hydration mismatch.
export function useTheme() {
  const [theme, setThemeState] = useState<Theme>(() =>
    typeof document !== "undefined" && document.documentElement.classList.contains("dark")
      ? "dark"
      : "light",
  );

  useEffect(() => {
    const stored = getStoredTheme();
    if (stored) setThemeState(stored);
  }, []);

  const setTheme = (theme: Theme) => {
    setThemeState(theme);
    applyTheme(theme);
    try {
      localStorage.setItem(STORAGE_KEY, theme);
    } catch {
      // Private browsing / storage disabled — theme just won't persist.
    }
  };

  const toggleTheme = () => setTheme(theme === "dark" ? "light" : "dark");

  return { theme, toggleTheme };
}
