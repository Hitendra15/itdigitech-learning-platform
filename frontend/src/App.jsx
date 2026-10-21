import { Navigate, Route, Routes } from "react-router-dom";
import Layout from "./components/Layout.jsx";
import ProtectedRoute from "./components/ProtectedRoute.jsx";
import { useAuth } from "./auth/AuthContext.jsx";
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
import Home from "./pages/Home.jsx";
import AdminRoutes from "./console/AdminRoutes.jsx";

// Visitors see the public landing page; signed-in users go straight to their home.
function Landing() {
  const { user, loading } = useAuth();
  if (loading) return <div className="loading" role="status" style={{ minHeight: "100vh" }}><span className="spinner" aria-hidden /></div>;
  if (user) return <Navigate to={user.role === "admin" ? "/console" : user.status === "active" ? "/dashboard" : "/plans"} replace />;
  return <Home />;
}

export default function App() {
  return (
    <Routes>
      <Route path="console/*" element={<AdminRoutes />} />
      <Route element={<Layout />}>
        <Route index element={<Landing />} />
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
        <Route path="dashboard" element={<ProtectedRoute><Dashboard /></ProtectedRoute>} />
        <Route path="learn/:slug" element={<ProtectedRoute><CoursePlayer /></ProtectedRoute>} />
        <Route path="tests/:testId" element={<ProtectedRoute><TestRunner /></ProtectedRoute>} />
        <Route path="*" element={<div className="empty"><h2>Page not found</h2><p>The page you are looking for does not exist or has moved.</p><a className="btn btn-primary" href="/">Go to home</a></div>} />
      </Route>
    </Routes>
  );
}
