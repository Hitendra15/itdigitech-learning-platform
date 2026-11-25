import { useEffect, useState } from "react";
import { NavLink, Outlet, useLocation, useNavigate } from "react-router-dom";
import { useAuth } from "../auth/AuthContext.jsx";
import { Brand, NotificationBell } from "../components/Layout.jsx";
import { initialsOf } from "../components/ui.jsx";
import { useRealtime, useRealtimeEvent } from "../realtime/Realtime.jsx";
import api from "../api/client.js";
import {
  IconArrowLeft, IconAward, IconBook, IconFile, IconFlag, IconEye, IconCard, IconChart, IconChat, IconDashboard, IconHelp, IconList, IconLogout, IconMegaphone,
  IconMenu, IconPercent, IconReceipt, IconSettings, IconTag, IconTest, IconUsers, IconX,
} from "../components/Icons.jsx";

const GROUPS = [
  { label: null, items: [{ to: "/console", label: "Dashboard", Icon: IconDashboard, end: true }] },
  { label: "Website", items: [
    { to: "/console/website", label: "Homepage", Icon: IconEye, end: true },
    { to: "/console/website/promotions", label: "Promotions", Icon: IconFlag },
    { to: "/console/website/media", label: "Media library", Icon: IconFile },
    { to: "/console/website/settings", label: "Website settings", Icon: IconSettings },
  ] },
  { label: "Learning content", items: [
    { to: "/console/courses", label: "Courses", Icon: IconBook },
    { to: "/console/tests", label: "Tests", Icon: IconTest },
  ] },
  { label: "People and revenue", items: [
    { to: "/console/users", label: "Students", Icon: IconUsers },
    { to: "/console/orders", label: "Orders", Icon: IconReceipt },
    { to: "/console/plans", label: "Plans", Icon: IconTag },
    { to: "/console/certificates", label: "Certificates", Icon: IconAward },
    { to: "/console/coupons", label: "Coupons", Icon: IconPercent },
  ] },
  { label: "Support", items: [
    { to: "/console/chats", label: "Live chat", Icon: IconChat, badge: "chats" },
    { to: "/console/tickets", label: "Requests", Icon: IconChat, badge: "tickets" },
    { to: "/console/faqs", label: "Help articles", Icon: IconHelp },
  ] },
  { label: "Operate", items: [
    { to: "/console/announcements", label: "Announcements", Icon: IconMegaphone },
    { to: "/console/reports", label: "Reports", Icon: IconChart },
    { to: "/console/activity", label: "Activity", Icon: IconList },
    { to: "/console/settings", label: "Settings", Icon: IconSettings },
  ] },
];

export default function AdminLayout() {
  const { user, logout } = useAuth();
  const { staffUnread, status } = useRealtime();
  const navigate = useNavigate();
  const location = useLocation();
  const [menu, setMenu] = useState(false);
  const [chatsWaiting, setChatsWaiting] = useState(0);
  const loadChats = () => api.get("/admin-api/chats/counts").then((r) => setChatsWaiting(r.data.waiting)).catch(() => {});
  useEffect(() => { loadChats(); }, []);
  useRealtimeEvent((e) => { if (e.kind?.startsWith("chat_")) loadChats(); });
  useEffect(() => { setMenu(false); }, [location.pathname]);
  const name = user.profile?.full_name || user.email;

  return (
    <div className="shell console">
      <aside className={`sidebar ${menu ? "open" : ""}`}>
        <div className="sidebar-top">
          <Brand light />
          <button className="icon-btn on-dark only-mobile" onClick={() => setMenu(false)} aria-label="Close menu"><IconX /></button>
        </div>
        <span className="console-chip">Admin console</span>
        <nav className="nav" aria-label="Admin">
          {GROUPS.map((g, i) => (
            <div key={i} className="nav-group">
              {g.label && <span className="nav-label">{g.label}</span>}
              {g.items.map(({ to, label, Icon, end, badge }) => (
                <NavLink key={to} to={to} end={end}>
                  <Icon /> {label}
                  {badge === "chats" && chatsWaiting > 0 && <span className="nav-badge" aria-label={`${chatsWaiting} waiting`}>{chatsWaiting}</span>}
                  {badge === "tickets" && staffUnread > 0 && <span className="nav-badge" aria-label={`${staffUnread} need a reply`}>{staffUnread}</span>}
                </NavLink>
              ))}
            </div>
          ))}
        </nav>
        <div className="sidebar-bottom">
          <NavLink to="/account" className="nav-plain"><IconCard size={18} /> My account</NavLink>
          <button className="nav-plain" onClick={() => navigate("/dashboard")}><IconArrowLeft size={18} /> Learner view</button>
          <div className="account">
            <span className="avatar" aria-hidden>{initialsOf(name)}</span>
            <div className="account-text"><strong>{name}</strong><span>{user.email}</span></div>
            <button className="icon-btn on-dark" onClick={async () => { await logout(); navigate("/login"); }} aria-label="Sign out" title="Sign out"><IconLogout /></button>
          </div>
        </div>
      </aside>
      {menu && <div className="scrim" onClick={() => setMenu(false)} />}

      <div className="shell-main">
        <header className="topbar">
          <button className="icon-btn only-mobile" onClick={() => setMenu(true)} aria-label="Open menu"><IconMenu /></button>
          <div className="topbar-brand only-mobile"><Brand /></div>
          <div className="topbar-end">
            <span className={`live ${status === "live" ? "on" : ""}`} title={status === "live" ? "Live updates connected" : "Reconnecting to live updates"}>{status === "live" ? "Live" : "Offline"}</span>
            <NotificationBell />
          </div>
        </header>
        <main className="page page-wide"><Outlet /></main>
      </div>
    </div>
  );
}
