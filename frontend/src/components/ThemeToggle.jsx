import { useTheme } from "../theme.js";
import { IconMoon, IconSun } from "./Icons.jsx";

export default function ThemeToggle() {
  const [theme, toggle] = useTheme();
  const dark = theme === "dark";
  return (
    <button className="icon-btn" onClick={toggle} aria-label={dark ? "Switch to light theme" : "Switch to dark theme"} title={dark ? "Light theme" : "Dark theme"}>
      {dark ? <IconSun size={19} /> : <IconMoon size={19} />}
    </button>
  );
}
