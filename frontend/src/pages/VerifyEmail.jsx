import { useEffect, useRef, useState } from "react";
import { Link, useSearchParams } from "react-router-dom";
import api from "../api/client.js";
import { useAuth } from "../auth/AuthContext.jsx";
import AuthShell from "../components/AuthShell.jsx";
import { Alert, Spinner } from "../components/ui.jsx";
import { useDocumentTitle } from "../hooks.js";

export default function VerifyEmail() {
  useDocumentTitle("Confirm your email");
  const [params] = useSearchParams();
  const { user, refreshUser } = useAuth();
  const [state, setState] = useState("working"); // working | ok | bad
  const ran = useRef(false);

  useEffect(() => {
    if (ran.current) return; // StrictMode runs effects twice; the token is idempotent but avoid the extra call
    ran.current = true;
    const token = params.get("token");
    if (!token) { setState("bad"); return; }
    api.post("/auth/verify-email", { token })
      .then(() => { setState("ok"); if (user) refreshUser().catch(() => {}); })
      .catch(() => setState("bad"));
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  const home = user ? (user.status === "active" ? "/dashboard" : "/plans") : "/login";
  return (
    <AuthShell
      title={state === "ok" ? "Email confirmed" : state === "bad" ? "We could not confirm this link" : "Confirming your email"}
      subtitle={state === "ok" ? "Thanks. You will now receive payment receipts and support replies at this address." : state === "bad" ? "The link may have expired or already been used." : ""}
      footer={<Link to={home}>{user ? "Go to my account" : "Back to sign in"}</Link>}
    >
      {state === "working" && <Spinner label="Confirming…" />}
      {state === "ok" && <Link className="btn btn-primary btn-lg btn-block" to={home}>Continue</Link>}
      {state === "bad" && (user
        ? <Link className="btn btn-primary btn-lg btn-block" to="/account">Send a new confirmation email</Link>
        : <Alert type="info">Sign in, then request a new confirmation email from your account page.</Alert>)}
    </AuthShell>
  );
}
