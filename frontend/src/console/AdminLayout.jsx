import { NavLink } from "react-router-dom";
import AppShell from "../components/AppShell.jsx";
import { useRealtime } from "../realtime/Realtime.jsx";
import {
  IconBook, IconChart, IconChat, IconDashboard, IconHelp, IconHome, IconList, IconMegaphone, IconPercent,
  IconReceipt, IconSettings, IconTag, IconTest, IconUser, IconUsers,
} from "../components/Icons.jsx";

export default function AdminLayout() {
  const { staffUnread } = useRealtime();
  const groups = [
    { items: [{ to: "/console", label: "Dashboard", Icon: IconDashboard, end: true }] },
    { label: "Content", items: [
      { to: "/console/courses", label: "Courses", Icon: IconBook },
      { to: "/console/tests", label: "Tests", Icon: IconTest },
    ] },
    { label: "People and revenue", items: [
      { to: "/console/users", label: "Students", Icon: IconUsers },
      { to: "/console/orders", label: "Orders", Icon: IconReceipt },
      { to: "/console/plans", label: "Plans", Icon: IconTag },
      { to: "/console/coupons", label: "Coupons", Icon: IconPercent },
    ] },
    { label: "Support", items: [
      { to: "/console/tickets", label: "Requests", Icon: IconChat, badge: staffUnread },
      { to: "/console/faqs", label: "Help articles", Icon: IconHelp },
    ] },
    { label: "Operate", items: [
      { to: "/console/announcements", label: "Announcements", Icon: IconMegaphone },
      { to: "/console/reports", label: "Reports", Icon: IconChart },
      { to: "/console/activity", label: "Activity", Icon: IconList },
      { to: "/console/settings", label: "Settings", Icon: IconSettings },
    ] },
  ];
  return (
    <AppShell
      groups={groups}
      tag="Admin console"
      wide
      footer={<NavLink to="/dashboard"><IconHome size={17} /> Learner view</NavLink>}
      menuLinks={[{ to: "/account", label: "Account and password", Icon: IconUser }, { to: "/dashboard", label: "Learner view", Icon: IconHome }]}
    />
  );
}
