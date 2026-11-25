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
import Chats from "./Chats.jsx";
import CertificatesAdmin from "./CertificatesAdmin.jsx";
import Homepage from "./website/Homepage.jsx";
import SectionEditor from "./website/SectionEditor.jsx";
import HomePreview from "./website/Preview.jsx";
import Promotions from "./website/Promotions.jsx";
import PromotionEditor from "./website/PromotionEditor.jsx";
import MediaLibrary from "./website/MediaLibrary.jsx";
import SiteProfile from "./website/SiteProfile.jsx";

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
        <Route path="website" element={<Homepage />} />
        <Route path="website/sections/:id" element={<SectionEditor />} />
        <Route path="website/preview" element={<HomePreview />} />
        <Route path="website/promotions" element={<Promotions />} />
        <Route path="website/promotions/new" element={<PromotionEditor />} />
        <Route path="website/promotions/:id" element={<PromotionEditor />} />
        <Route path="website/media" element={<MediaLibrary />} />
        <Route path="website/settings" element={<SiteProfile />} />
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
        <Route path="chats" element={<Chats />} />
        <Route path="certificates" element={<CertificatesAdmin />} />
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
