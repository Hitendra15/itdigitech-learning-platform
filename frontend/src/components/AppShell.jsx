import { useEffect, useState } from "react";
import { NavLink, Outlet, useLocation } from "react-router-dom";
import Brand from "./Brand.jsx";
import NotificationBell from "./NotificationBell.jsx";
import ThemeToggle from "./ThemeToggle.jsx";
import UserMenu from "./UserMenu.jsx";
import { IconMenu, IconX } from "./Icons.jsx";
import { useRealtime } from "../realtime/Realtime.jsx";

/**
 * Shared frame for the learner app and the admin console.
 * groups: [{ label?, items: [{ to, label, Icon, end?, badge? }] }]
 */
export default function AppShell({ groups, tag, footer, menuLinks, tabbar = false, wide = false, banner }) {
  const [open, setOpen] = useState(false);
  const { pathname } = useLocation();
  const { status } = useRealtime();
  useEffect(() => { setOpen(false); }, [pathname]);
  useEffect(() => { window.scrollTo({ top: 0 }); }, [pathname]);

  const tabItems = groups.flatMap((g) => g.items).slice(0, 5);

  return (
    <div className={`app ${tabbar ? "has-tabbar" : ""}`}>
      <a className="skip-link" href="#main">Skip to content</a>
      <aside className={`side ${open ? "open" : ""}`} aria-label="Primary">
        <div className="side-top">
          <Brand to={tag ? "/console" : "/dashboard"} />
          <button className="icon-btn only-mobile" onClick={() => setOpen(false)} aria-label="Close menu"><IconX /></button>
        </div>
        {tag && <span className="side-tag">{tag}</span>}
        <nav className="nav">
          {groups.map((g, i) => (
            <div key={i} className="nav-group">
              {g.label && <span className="nav-label">{g.label}</span>}
              {g.items.map(({ to, label, Icon, end, badge }) => (
                <NavLink key={to} to={to} end={end}>
                  <Icon size={19} /> {label}
                  {badge > 0 && <span className="nav-badge" aria-label={`${badge} unread`}>{badge}</span>}
                </NavLink>
              ))}
            </div>
          ))}
        </nav>
        {footer && <div className="side-foot">{footer}</div>}
      </aside>
      {open && <div className="scrim" onClick={() => setOpen(false)} />}

      <div className="app-main">
        <header className="topbar">
          <button className="icon-btn only-mobile menu-btn" onClick={() => setOpen(true)} aria-label="Open menu"><IconMenu /></button>
          <div className="topbar-brand only-mobile"><Brand /></div>
          <div className="topbar-end">
            {tag && <span className={`live ${status === "live" ? "on" : ""}`} title={status === "live" ? "Live updates connected" : "Reconnecting to live updates"}>{status === "live" ? "Live" : "Offline"}</span>}
            <ThemeToggle />
            <NotificationBell />
            <UserMenu links={menuLinks} />
          </div>
        </header>
        <main id="main" className={`page ${wide ? "page-wide" : ""}`}>{banner}<Outlet /></main>
      </div>

      {tabbar && (
        <nav className="tabbar" aria-label="Primary">
          {tabItems.map(({ to, label, Icon, end, badge }) => (
            <NavLink key={to} to={to} end={end}><Icon size={22} />{label}{badge > 0 && <span className="nav-badge">{badge}</span>}</NavLink>
          ))}
        </nav>
      )}
    </div>
  );
}
