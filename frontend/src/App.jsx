import { Navigate, Route, Routes } from "react-router-dom";
import Layout from "./components/Layout.jsx";
import ProtectedRoute from "./components/ProtectedRoute.jsx";
import Login from "./pages/Login.jsx";
import Register from "./pages/Register.jsx";
import Plans from "./pages/Plans.jsx";
import Dashboard from "./pages/Dashboard.jsx";
import CoursePlayer from "./pages/CoursePlayer.jsx";
import TestRunner from "./pages/TestRunner.jsx";
import Payments from "./pages/Payments.jsx";
import ForgotPassword from "./pages/ForgotPassword.jsx";
import ResetPassword from "./pages/ResetPassword.jsx";
import VerifyEmail from "./pages/VerifyEmail.jsx";
import Profile from "./pages/Profile.jsx";
import Support from "./pages/Support.jsx";
import SupportNew from "./pages/SupportNew.jsx";
import SupportTicket from "./pages/SupportTicket.jsx";
import Certificates from "./pages/Certificates.jsx";
import AdminRoutes from "./console/AdminRoutes.jsx";
import PreviewFrame from "./console/website/PreviewFrame.jsx";
import PublicLayout from "./site/PublicLayout.jsx";
import SiteHome from "./site/Home.jsx";
import SiteCourses from "./site/Courses.jsx";
import SitePricing from "./site/Pricing.jsx";
import SiteContact from "./site/Contact.jsx";
import VerifyCertificate from "./site/VerifyCertificate.jsx";
import Lab from "./lab/Lab.jsx";
import ChatWidget from "./chat/ChatWidget.jsx";

export default function App() {
  return (
    <>
    <Routes>
      <Route path="console/*" element={<AdminRoutes />} />
      <Route path="preview-frame" element={<PreviewFrame />} />
      <Route element={<PublicLayout />}>
        <Route index element={<SiteHome />} />
        <Route path="courses" element={<SiteCourses />} />
        <Route path="pricing" element={<SitePricing />} />
        <Route path="contact" element={<SiteContact />} />
        <Route path="lab" element={<Lab />} />
        <Route path="verify" element={<VerifyCertificate />} />
        <Route path="verify/:code" element={<VerifyCertificate />} />
      </Route>
      <Route element={<Layout />}>
        <Route path="login" element={<Login />} />
        <Route path="register" element={<Register />} />
        <Route path="forgot-password" element={<ForgotPassword />} />
        <Route path="reset-password" element={<ResetPassword />} />
        <Route path="verify-email" element={<VerifyEmail />} />
        <Route path="account" element={<ProtectedRoute requireActive={false}><Profile /></ProtectedRoute>} />
        <Route path="support" element={<ProtectedRoute requireActive={false}><Support /></ProtectedRoute>} />
        <Route path="support/new" element={<ProtectedRoute requireActive={false}><SupportNew /></ProtectedRoute>} />
        <Route path="support/:id" element={<ProtectedRoute requireActive={false}><SupportTicket /></ProtectedRoute>} />
        <Route path="plans" element={<ProtectedRoute requireActive={false}><Plans /></ProtectedRoute>} />
        <Route path="payments" element={<ProtectedRoute requireActive={false}><Payments /></ProtectedRoute>} />
        <Route path="certificates" element={<ProtectedRoute requireActive={false}><Certificates /></ProtectedRoute>} />
        <Route path="dashboard" element={<ProtectedRoute><Dashboard /></ProtectedRoute>} />
        <Route path="learn/:slug" element={<ProtectedRoute><CoursePlayer /></ProtectedRoute>} />
        <Route path="tests/:testId" element={<ProtectedRoute><TestRunner /></ProtectedRoute>} />
        <Route path="*" element={<div className="empty"><h2>Page not found</h2><p>The page you are looking for does not exist or has moved.</p><a className="btn btn-primary" href="/">Go to home</a></div>} />
      </Route>
    </Routes>
    <ChatWidget />
    </>
  );
}
