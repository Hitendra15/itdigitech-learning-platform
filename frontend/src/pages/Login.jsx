import { useState } from "react";
import { Link, useLocation, useNavigate } from "react-router-dom";
import { useAuth } from "../auth/AuthContext.jsx";
import { errorMessage } from "../api/client.js";
import AuthShell from "../components/AuthShell.jsx";
import { Alert, PasswordField } from "../components/ui.jsx";
import { useDocumentTitle } from "../hooks.js";

export default function Login() {
  const { login } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();
  const [form, setForm] = useState({ email: "", password: "" });
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);
  const notice = location.state?.notice;
  useDocumentTitle("Sign in");

  const submit = async (e) => {
    e.preventDefault();
    setBusy(true);
    setError("");
    try {
      const user = await login(form.email, form.password);
      const home = user.role === "admin" ? "/console" : user.status === "active" ? "/dashboard" : "/plans";
      navigate(location.state?.from?.pathname && user.status === "active" ? location.state.from.pathname : home, { replace: true });
    } catch (err) {
      setError(errorMessage(err, "We could not sign you in. Try again."));
    } finally {
      setBusy(false);
    }
  };

  return (
    <AuthShell
      title="Welcome back"
      subtitle="Sign in to pick up your course where you left off."
      footer={<>New to IT DigiTech? <Link to="/register">Create an account</Link></>}
    >
      <form onSubmit={submit} className="form">
        <div className="field">
          <label htmlFor="email">Email</label>
          <input id="email" type="email" required autoComplete="email" placeholder="you@college.edu" value={form.email}
                 onChange={(e) => setForm({ ...form, email: e.target.value })} />
        </div>
        <PasswordField id="password" label="Password" autoComplete="current-password" placeholder="Your password"
                       value={form.password} onChange={(v) => setForm({ ...form, password: v })}
                       labelExtra={<Link to="/forgot-password" className="small">Forgot password?</Link>} />
        {notice && <Alert type="ok">{notice}</Alert>}
        {error && <Alert>{error}</Alert>}
        <button className="btn btn-primary btn-lg btn-block" disabled={busy}>{busy ? "Signing in…" : "Sign in"}</button>
      </form>
    </AuthShell>
  );
}
