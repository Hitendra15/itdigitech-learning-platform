import { useEffect, useRef, useState } from "react";
import { Link, NavLink, Outlet, useLocation, useNavigate } from "react-router-dom";
import { useAuth } from "../auth/AuthContext.jsx";
import { useRealtime } from "../realtime/Realtime.jsx";
import { IconAward, IconBell, IconBook, IconCode, IconChat, IconDashboard, IconLogout, IconMail, IconMenu, IconReceipt, IconTag, IconUser, IconX } from "./Icons.jsx";
import api from "../api/client.js";
import { useToast } from "./Toast.jsx";
import { initialsOf } from "./ui.jsx";

function Brand({ light }) {
  return (
    <Link to="/" className={`brand ${light ? "brand-light" : ""}`}>
      <span className="brand-mark" aria-hidden>
        <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.6" strokeLinecap="round" strokeLinejoin="round"><path d="m8 7-5 5 5 5M16 7l5 5-5 5" /></svg>
      </span>
      <span className="brand-name">IT DigiTech<small>Learn</small></span>
    </Link>
  );
}
export { Brand };

export function NotificationBell() {
  const { items, unread, markAllRead } = useRealtime();
  const navigate = useNavigate();
  const [open, setOpen] = useState(false);
  const ref = useRef(null);

  useEffect(() => {
    if (!open) return undefined;
    const close = (e) => { if (!ref.current?.contains(e.target)) setOpen(false); };
    const esc = (e) => { if (e.key === "Escape") setOpen(false); };
    document.addEventListener("mousedown", close);
    document.addEventListener("keydown", esc);
    return () => { document.removeEventListener("mousedown", close); document.removeEventListener("keydown", esc); };
  }, [open]);

  const go = (n) => { setOpen(false); if (n.link) navigate(n.link.startsWith("/") ? n.link : "/"); };

  return (
    <div className="bell" ref={ref}>
      <button className="icon-btn" onClick={() => setOpen(!open)} aria-expanded={open} aria-label={unread ? `Notifications, ${unread} unread` : "Notifications"}>
        <IconBell />
        {unread > 0 && <span className="bell-count">{unread > 9 ? "9+" : unread}</span>}
      </button>
      {open && (
        <div className="popover" role="dialog" aria-label="Notifications">
          <div className="popover-head">
            <span>Notifications</span>
            {unread > 0 && <button className="link-btn small" onClick={markAllRead}>Mark all read</button>}
          </div>
          {items.length === 0 ? (
            <p className="popover-empty">You are all caught up.</p>
          ) : (
            <ul>
              {items.slice(0, 10).map((n, i) => (
                <li key={n.id ?? i} className={n.is_read ? "" : "unread"}>
                  <button className="note-btn" onClick={() => go(n)}>
                    <strong>{n.title}</strong>
                    {n.body && <span>{n.body}</span>}
                  </button>
                </li>
              ))}
            </ul>
          )}
        </div>
      )}
    </div>
  );
}

export function VerifyBanner({ user }) {
  const toast = useToast();
  const [sent, setSent] = useState(false);
  if (user.is_email_verified || sent) return sent ? <div className="banner banner-ok" role="status"><IconMail size={18} /> Confirmation email sent to {user.email}.</div> : null;
  const resend = async () => {
    try { await api.post("/auth/resend-verification"); setSent(true); }
    catch { toast.error("Could not send the email right now. Try again in a few minutes."); }
  };
  return (
    <div className="banner" role="status">
      <IconMail size={18} />
      <span>Please confirm your email address so receipts and support replies reach you.</span>
      <button className="link-btn" onClick={resend}>Resend email</button>
    </div>
  );
}

export default function Layout() {
  const { user, logout } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();
  const [menu, setMenu] = useState(false);
  const { supportUnread } = useRealtime();

  useEffect(() => { setMenu(false); }, [location.pathname]);

  // Sign in and registration are full-screen split layouts with their own branding.
  if (["/login", "/register", "/forgot-password", "/reset-password", "/verify-email"].includes(location.pathname)) return <Outlet />;

  const active = user?.status === "active";
  const name = user?.profile?.full_name || user?.email || "";
  const logoutNow = async () => { await logout(); navigate("/login"); };

  if (!user) {
    return (
      <>
        <header className="publicbar">
          <Brand />
          <div className="row gap">
            <Link to="/login" className="btn btn-ghost">Sign in</Link>
            <Link to="/register" className="btn btn-primary">Create account</Link>
          </div>
        </header>
        <main className="page"><Outlet /></main>
      </>
    );
  }

  const nav = (
    <nav className="nav" aria-label="Main">
      {active && <NavLink to="/dashboard"><IconBook /> My courses</NavLink>}
      {active && <NavLink to="/lab"><IconCode /> Code lab</NavLink>}
      {active && <NavLink to="/certificates"><IconAward /> Certificates</NavLink>}
      <NavLink to="/plans"><IconTag /> Plans</NavLink>
      <NavLink to="/payments"><IconReceipt /> Payments</NavLink>
      <NavLink to="/support"><IconChat /> Support{supportUnread > 0 && <span className="nav-badge" aria-label={`${supportUnread} unread`}>{supportUnread}</span>}</NavLink>
      <NavLink to="/account"><IconUser /> Account</NavLink>
      {user.role === "admin" && <NavLink to="/console" className="nav-admin"><IconDashboard /> Admin console</NavLink>}
    </nav>
  );

  const account = (
    <div className="account">
      <span className="avatar" aria-hidden>{initialsOf(name)}</span>
      <div className="account-text">
        <strong>{user.profile?.full_name || "Student"}</strong>
        <span>{user.email}</span>
      </div>
      <button className="icon-btn on-dark" onClick={logoutNow} aria-label="Sign out" title="Sign out"><IconLogout /></button>
    </div>
  );

  return (
    <div className="shell">
      <aside className={`sidebar ${menu ? "open" : ""}`}>
        <div className="sidebar-top">
          <Brand light />
          <button className="icon-btn on-dark only-mobile" onClick={() => setMenu(false)} aria-label="Close menu"><IconX /></button>
        </div>
        {nav}
        {account}
      </aside>
      {menu && <div className="scrim" onClick={() => setMenu(false)} />}

      <div className="shell-main">
        <header className="topbar">
          <button className="icon-btn only-mobile" onClick={() => setMenu(true)} aria-label="Open menu"><IconMenu /></button>
          <div className="topbar-brand only-mobile"><Brand /></div>
          <div className="topbar-end">
            <NotificationBell />
          </div>
        </header>
        <main className="page"><VerifyBanner user={user} /><Outlet /></main>
      </div>
    </div>
  );
}
