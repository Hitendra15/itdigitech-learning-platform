import { useSyncExternalStore } from "react";

// Light/dark theme. The first paint is handled by a tiny script in index.html.
const listeners = new Set();
const read = () => (document.documentElement.dataset.theme === "dark" ? "dark" : "light");

export function setTheme(t) {
  if (t === "dark") document.documentElement.dataset.theme = "dark";
  else delete document.documentElement.dataset.theme;
  try { localStorage.setItem("theme", t); } catch { /* private mode */ }
  document.querySelector('meta[name="theme-color"]')?.setAttribute("content", t === "dark" ? "#0a0f19" : "#f6f7f9");
  listeners.forEach((l) => l());
}

export function useTheme() {
  const theme = useSyncExternalStore((cb) => { listeners.add(cb); return () => listeners.delete(cb); }, read, () => "light");
  return [theme, () => setTheme(theme === "dark" ? "light" : "dark")];
}
