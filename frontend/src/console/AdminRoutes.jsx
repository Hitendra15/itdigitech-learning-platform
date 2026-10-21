import { Navigate, Route, Routes } from "react-router-dom";
import { useAuth } from "../auth/AuthContext.jsx";
import AdminLayout from "./AdminLayout.jsx";
import Dashboard from "./Dashboard.jsx";
import Users from "./Users.jsx";
import Courses from "./Courses.jsx";
import CourseEditor from "./CourseEditor.jsx";
import Tests from "./Tests.jsx";
import TestEditor from "./TestEditor.jsx";
import { Orders, Plans, Coupons } from "./Billing.jsx";
import Tickets from "./Tickets.jsx";
import { Faqs, Announcements } from "./Content.jsx";
import Reports from "./Reports.jsx";
import Activity from "./Activity.jsx";
import Settings from "./Settings.jsx";

// Only platform admins can enter. Everyone else is sent back to the learner app.
export default function AdminRoutes() {
  const { user, loading } = useAuth();
  if (loading) return <div className="loading" role="status"><span className="spinner" aria-hidden /><span>Loading…</span></div>;
  if (!user) return <Navigate to="/login" state={{ from: { pathname: "/console" } }} replace />;
  if (user.role !== "admin") return <Navigate to="/" replace />;

  return (
    <Routes>
      <Route element={<AdminLayout />}>
        <Route index element={<Dashboard />} />
        <Route path="users" element={<Users />} />
        <Route path="courses" element={<Courses />} />
        <Route path="courses/:id" element={<CourseEditor />} />
        <Route path="tests" element={<Tests />} />
        <Route path="tests/:id" element={<TestEditor />} />
        <Route path="orders" element={<Orders />} />
        <Route path="plans" element={<Plans />} />
        <Route path="coupons" element={<Coupons />} />
        <Route path="tickets" element={<Tickets />} />
        <Route path="tickets/:id" element={<Tickets />} />
        <Route path="faqs" element={<Faqs />} />
        <Route path="announcements" element={<Announcements />} />
        <Route path="reports" element={<Reports />} />
        <Route path="activity" element={<Activity />} />
        <Route path="settings" element={<Settings />} />
        <Route path="*" element={<div className="empty"><h2>Page not found</h2><p>This console page does not exist.</p></div>} />
      </Route>
    </Routes>
  );
}
