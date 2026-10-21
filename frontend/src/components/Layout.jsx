import { Outlet, useLocation } from "react-router-dom";
import { useAuth } from "../auth/AuthContext.jsx";
import { useRealtime } from "../realtime/Realtime.jsx";
import AppShell from "./AppShell.jsx";
import FocusShell from "./FocusShell.jsx";
import VerifyBanner from "./VerifyBanner.jsx";
import { IconBook, IconChat, IconDashboard, IconReceipt, IconTag, IconUser } from "./Icons.jsx";

// Pages that render without any app chrome.
const BARE = ["/", "/login", "/register", "/forgot-password", "/reset-password", "/verify-email"];

export default function Layout() {
  const { user, loading } = useAuth();
  const { supportUnread } = useRealtime();
  const { pathname } = useLocation();

  if (BARE.includes(pathname)) return <Outlet />;
  if (loading) return <div className="loading" role="status" style={{ minHeight: "100vh" }}><span className="spinner" aria-hidden /><span>Loading your session…</span></div>;
  if (!user) return <Outlet />; // ProtectedRoute redirects to sign in

  // Lessons and tests get the distraction-free frame.
  if (pathname.startsWith("/learn/") || pathname.startsWith("/tests/")) return <FocusShell />;

  const groups = [{ items: [
    { to: "/dashboard", label: "My courses", Icon: IconBook },
    { to: "/plans", label: "Plans", Icon: IconTag },
    { to: "/payments", label: "Payments", Icon: IconReceipt },
    { to: "/support", label: "Support", Icon: IconChat, badge: supportUnread },
    { to: "/account", label: "Account", Icon: IconUser },
  ] }];

  const isAdmin = user.role === "admin";
  return (
    <AppShell
      groups={groups}
      tabbar
      banner={<VerifyBanner user={user} />}
      menuLinks={[
        { to: "/account", label: "Account and password", Icon: IconUser },
        { to: "/support", label: "Support", Icon: IconChat },
        ...(isAdmin ? [{ to: "/console", label: "Admin console", Icon: IconDashboard }] : []),
      ]}
    />
  );
}
