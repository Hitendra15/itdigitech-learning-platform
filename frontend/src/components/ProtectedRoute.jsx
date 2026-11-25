import { Navigate, useLocation } from "react-router-dom";
import { useAuth } from "../auth/AuthContext.jsx";

// requireActive: students who have not paid yet are sent to the plans page.
export default function ProtectedRoute({ children, requireActive = true }) {
  const { user, loading } = useAuth();
  const location = useLocation();
  if (loading) return <div className="loading" role="status"><span className="spinner" aria-hidden /><span>Loading your session…</span></div>;
  if (!user) return <Navigate to="/login" state={{ from: location }} replace />;
  if (requireActive && user.role === "student" && user.status === "pending_payment") {
    return <Navigate to="/plans" replace />;
  }
  return children;
}
