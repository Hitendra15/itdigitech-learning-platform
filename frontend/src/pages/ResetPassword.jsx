import { useEffect, useState } from "react";
import { Link, useNavigate, useSearchParams } from "react-router-dom";
import api, { errorMessage } from "../api/client.js";
import AuthShell from "../components/AuthShell.jsx";
import { Alert, PasswordField, Spinner } from "../components/ui.jsx";
import { useDocumentTitle } from "../hooks.js";

export default function ResetPassword() {
  useDocumentTitle("Choose a new password");
  const [params] = useSearchParams();
  const navigate = useNavigate();
  const uid = params.get("uid") || "";
  const token = params.get("token") || "";
  const [valid, setValid] = useState(null);
  const [pw, setPw] = useState("");
  const [again, setAgain] = useState("");
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    if (!uid || !token) { setValid(false); return; }
    api.get("/auth/reset-password", { params: { uid, token } }).then((r) => setValid(r.data.valid)).catch(() => setValid(false));
  }, [uid, token]);

  const submit = async (e) => {
    e.preventDefault();
    if (pw !== again) { setError("The two passwords do not match."); return; }
    setBusy(true); setError("");
    try {
      await api.post("/auth/reset-password", { uid, token, password: pw });
      navigate("/login", { replace: true, state: { notice: "Password updated. Sign in with your new password." } });
    } catch (err) {
      const d = err.response?.data;
      setError(d?.detail || (Array.isArray(d?.non_field_errors) ? d.non_field_errors[0] : null) || (Array.isArray(d?.password) ? d.password.join(" ") : errorMessage(err)));
    } finally { setBusy(false); }
  };

  if (valid === null) return <AuthShell title="Checking your link" subtitle=""><Spinner label="One moment…" /></AuthShell>;

  if (!valid) {
    return (
      <AuthShell title="This link has expired" subtitle="Reset links work once and stay valid for one hour." footer={<Link to="/login">Back to sign in</Link>}>
        <Link className="btn btn-primary btn-lg btn-block" to="/forgot-password">Get a new link</Link>
      </AuthShell>
    );
  }

  return (
    <AuthShell title="Choose a new password" subtitle="Use at least 8 characters. A mix of letters, numbers and symbols is stronger."
               footer={<Link to="/login">Back to sign in</Link>}>
      <form onSubmit={submit} className="form">
        <PasswordField label="New password" value={pw} onChange={setPw} meter />
        <PasswordField label="Confirm new password" value={again} onChange={setAgain} />
        {error && <Alert>{error}</Alert>}
        <button className="btn btn-primary btn-lg btn-block" disabled={busy}>{busy ? "Saving…" : "Update password"}</button>
      </form>
    </AuthShell>
  );
}
