import { useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { useAuth } from "../auth/AuthContext.jsx";
import { errorMessage } from "../api/client.js";
import AuthShell from "../components/AuthShell.jsx";
import { Alert, PasswordField } from "../components/ui.jsx";

export default function Register() {
  const { register } = useAuth();
  const navigate = useNavigate();
  const [form, setForm] = useState({ full_name: "", email: "", phone: "", college_name: "", password: "" });
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);
  const set = (k) => (e) => setForm({ ...form, [k]: e.target.value });

  const submit = async (e) => {
    e.preventDefault();
    setBusy(true);
    setError("");
    try {
      await register(form);
      navigate("/plans", { replace: true }); // payment is mandatory before access
    } catch (err) {
      setError(errorMessage(err));
    } finally {
      setBusy(false);
    }
  };

  return (
    <AuthShell
      title="Create your account"
      subtitle="Next you will choose a plan and pay. Courses unlock as soon as payment succeeds."
      footer={<>Already registered? <Link to="/login">Sign in</Link></>}
    >
      <form onSubmit={submit} className="form">
        <div className="field">
          <label htmlFor="full_name">Full name</label>
          <input id="full_name" required autoComplete="name" value={form.full_name} onChange={set("full_name")} />
        </div>
        <div className="field">
          <label htmlFor="email">Email</label>
          <input id="email" type="email" required autoComplete="email" placeholder="you@college.edu" value={form.email} onChange={set("email")} />
        </div>
        <div className="form-row">
          <div className="field">
            <label htmlFor="phone">Mobile number</label>
            <input id="phone" inputMode="tel" autoComplete="tel" value={form.phone} onChange={set("phone")} />
          </div>
          <div className="field">
            <label htmlFor="college">College <span className="optional">optional</span></label>
            <input id="college" value={form.college_name} onChange={set("college_name")} />
          </div>
        </div>
        <PasswordField id="password" label="Password" value={form.password} onChange={(v) => setForm({ ...form, password: v })} meter hint="At least 8 characters. We will email you a link to confirm your address." />
        {error && <Alert>{error}</Alert>}
        <button className="btn btn-primary btn-lg btn-block" disabled={busy}>{busy ? "Creating account…" : "Continue to plans"}</button>
      </form>
    </AuthShell>
  );
}
