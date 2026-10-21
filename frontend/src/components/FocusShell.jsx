import { createContext, useContext, useEffect, useState } from "react";
import { Link, Outlet } from "react-router-dom";
import NotificationBell from "./NotificationBell.jsx";
import ThemeToggle from "./ThemeToggle.jsx";
import UserMenu from "./UserMenu.jsx";
import { ProgressRing } from "./ui.jsx";
import { IconArrowLeft, IconChat, IconBook, IconClock } from "./Icons.jsx";

const Ctx = createContext(() => {});

/** Pages describe their own title bar: useFocusMeta({ title, sub, back, backLabel, progress, timer, timerLow }) */
export function useFocusMeta(meta) {
  const set = useContext(Ctx);
  const key = JSON.stringify(meta);
  useEffect(() => { set(meta); return () => set({}); }, [key]); // eslint-disable-line react-hooks/exhaustive-deps
}

// Distraction-free frame for lessons and tests: one slim bar, full-width content.
export default function FocusShell() {
  const [meta, setMeta] = useState({});
  return (
    <Ctx.Provider value={setMeta}>
      <div className="focus">
        <a className="skip-link" href="#main">Skip to content</a>
        <header className="focus-bar">
          <Link to={meta.back || "/dashboard"} className="btn btn-quiet btn-sm"><IconArrowLeft size={16} /> <span className="hide-sm">{meta.backLabel || "My courses"}</span></Link>
          <span className="focus-sep" aria-hidden />
          <div className="focus-title">
            <strong>{meta.title || "Loading…"}</strong>
            {meta.sub && <span>{meta.sub}</span>}
          </div>
          {typeof meta.progress === "number" && (
            <div className="focus-progress" title={`${meta.progress}% of the course completed`}>
              <ProgressRing value={meta.progress} size={34} stroke={4} label={`${meta.progress}`} />
            </div>
          )}
          {meta.timer && <div className={`timer ${meta.timerLow ? "low" : ""}`} role="timer" aria-live="off"><IconClock size={17} /> {meta.timer}</div>}
          <ThemeToggle />
          <NotificationBell />
          <UserMenu links={[{ to: "/dashboard", label: "My courses", Icon: IconBook }, { to: "/support", label: "Support", Icon: IconChat }]} />
        </header>
        <main id="main" className="focus-body"><Outlet /></main>
      </div>
    </Ctx.Provider>
  );
}
