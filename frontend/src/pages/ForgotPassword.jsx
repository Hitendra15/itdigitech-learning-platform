import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import api, { errorMessage } from "../api/client.js";
import AuthShell from "../components/AuthShell.jsx";
import { Alert } from "../components/ui.jsx";
import { IconMail } from "../components/Icons.jsx";
import { useDocumentTitle } from "../hooks.js";

export default function ForgotPassword() {
  useDocumentTitle("Reset password");
  const [email, setEmail] = useState("");
  const [sent, setSent] = useState(false);
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);
  const [wait, setWait] = useState(0);

  useEffect(() => {
    if (wait <= 0) return undefined;
    const t = setTimeout(() => setWait(wait - 1), 1000);
    return () => clearTimeout(t);
  }, [wait]);

  const submit = async (e) => {
    e?.preventDefault();
    setBusy(true); setError("");
    try {
      await api.post("/auth/forgot-password", { email });
      setSent(true); setWait(45);
    } catch (err) {
      setError(err.response?.status === 429 ? "Too many requests. Please wait a few minutes and try again." : errorMessage(err));
    } finally { setBusy(false); }
  };

  return (
    <AuthShell
      title={sent ? "Check your email" : "Forgot your password?"}
      subtitle={sent ? undefined : "Enter the email you registered with and we will send you a link to choose a new password."}
      footer={<Link to="/login">Back to sign in</Link>}
    >
      {sent ? (
        <div className="stack">
          <div className="sent-card">
            <span className="sent-icon"><IconMail size={22} /></span>
            <div>
              <p>If an account exists for <strong>{email}</strong>, a reset link is on its way. The link works for one hour.</p>
              <p className="muted small">Nothing in your inbox? Check spam, or send it again.</p>
            </div>
          </div>
          <button className="btn btn-ghost btn-block" onClick={submit} disabled={busy || wait > 0}>
            {wait > 0 ? `Send again in ${wait}s` : busy ? "Sending…" : "Send the link again"}
          </button>
          {error && <Alert>{error}</Alert>}
          <button className="link-btn" onClick={() => setSent(false)}>Use a different email</button>
        </div>
      ) : (
        <form onSubmit={submit} className="form">
          <div className="field">
            <label htmlFor="email">Email</label>
            <input id="email" type="email" required autoFocus autoComplete="email" placeholder="you@college.edu" value={email}
                   onChange={(e) => setEmail(e.target.value)} />
          </div>
          {error && <Alert>{error}</Alert>}
          <button className="btn btn-primary btn-lg btn-block" disabled={busy}>{busy ? "Sending…" : "Email me a reset link"}</button>
        </form>
      )}
    </AuthShell>
  );
}
