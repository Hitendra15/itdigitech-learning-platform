import { useState } from "react";
import api, { errorMessage, fieldErrors, setAccessToken } from "../api/client.js";
import { useAuth } from "../auth/AuthContext.jsx";
import { Alert, PageHead, PasswordField, StatusPill } from "../components/ui.jsx";
import { useToast } from "../components/Toast.jsx";
import { useDocumentTitle } from "../hooks.js";
import { IconCheck, IconMail, IconWarn } from "../components/Icons.jsx";

export default function Profile() {
  useDocumentTitle("Account");
  const { user, refreshUser } = useAuth();
  const toast = useToast();
  const p = user.profile ?? {};
  const [form, setForm] = useState({ full_name: p.full_name ?? "", college_name: p.college_name ?? "", qualification: p.qualification ?? "", city: p.city ?? "", phone: user.phone ?? "" });
  const [saving, setSaving] = useState(false);
  const [errors, setErrors] = useState({});
  const set = (k) => (e) => setForm({ ...form, [k]: e.target.value });

  const saveProfile = async (e) => {
    e.preventDefault();
    setSaving(true); setErrors({});
    try {
      const { phone, ...profile } = form;
      await api.patch("/me", { phone, profile });
      await refreshUser();
      toast.success("Profile saved");
    } catch (err) { setErrors(fieldErrors(err)); toast.error(errorMessage(err)); }
    finally { setSaving(false); }
  };

  const [pw, setPw] = useState({ current: "", next: "", again: "" });
  const [pwError, setPwError] = useState("");
  const [pwBusy, setPwBusy] = useState(false);
  const changePassword = async (e) => {
    e.preventDefault();
    if (pw.next !== pw.again) { setPwError("The new passwords do not match."); return; }
    setPwBusy(true); setPwError("");
    try {
      const { data } = await api.post("/auth/change-password", { current_password: pw.current, new_password: pw.next });
      setAccessToken(data.access);
      setPw({ current: "", next: "", again: "" });
      toast.success("Password updated. Other devices were signed out.");
    } catch (err) {
      const d = err.response?.data ?? {};
      setPwError(d.current_password?.[0] || d.new_password?.join?.(" ") || d.detail || errorMessage(err));
    } finally { setPwBusy(false); }
  };

  const [sending, setSending] = useState(false);
  const resend = async () => {
    setSending(true);
    try { await api.post("/auth/resend-verification"); toast.success(`Confirmation email sent to ${user.email}`); }
    catch (err) { toast.error(err.response?.status === 429 ? "Please wait a little before requesting another email." : errorMessage(err)); }
    finally { setSending(false); }
  };

  return (
    <div className="stack-lg narrow-xl">
      <PageHead title="Account" lead="Your details, email confirmation and password." />

      <section className="panel">
        <div className="panel-head"><h2>Profile</h2></div>
        <form className="form form-grid" onSubmit={saveProfile}>
          <div className="field">
            <label htmlFor="pf-name">Full name</label>
            <input id="pf-name" required value={form.full_name} onChange={set("full_name")} />
            {errors.full_name && <span className="field-error">{errors.full_name}</span>}
          </div>
          <div className="field">
            <label htmlFor="pf-phone">Mobile number</label>
            <input id="pf-phone" inputMode="tel" value={form.phone} onChange={set("phone")} />
          </div>
          <div className="field"><label htmlFor="pf-college">College</label><input id="pf-college" value={form.college_name} onChange={set("college_name")} /></div>
          <div className="field"><label htmlFor="pf-qual">Qualification</label><input id="pf-qual" value={form.qualification} onChange={set("qualification")} placeholder="e.g. B.Tech CSE, 3rd year" /></div>
          <div className="field"><label htmlFor="pf-city">City</label><input id="pf-city" value={form.city} onChange={set("city")} /></div>
          <div className="field span-2 form-actions"><button className="btn btn-primary" disabled={saving}>{saving ? "Saving…" : "Save profile"}</button></div>
        </form>
      </section>

      <section className="panel">
        <div className="panel-head"><h2>Sign-in email</h2></div>
        <div className="kv">
          <div><span>Email</span><strong>{user.email}</strong></div>
          <div><span>Status</span>
            {user.is_email_verified
              ? <span className="pill pill-good"><IconCheck size={14} /> Confirmed</span>
              : <span className="pill pill-warn"><IconWarn size={14} /> Not confirmed</span>}
          </div>
          <div><span>Plan access</span><StatusPill value={user.status} /></div>
        </div>
        {!user.is_email_verified && (
          <div className="panel-note">
            <p>Confirm your email so payment receipts and support replies always reach you.</p>
            <button className="btn btn-ghost" onClick={resend} disabled={sending}><IconMail size={18} /> {sending ? "Sending…" : "Send confirmation email"}</button>
          </div>
        )}
      </section>

      <section className="panel">
        <div className="panel-head"><h2>Change password</h2></div>
        <form className="form" onSubmit={changePassword}>
          <PasswordField label="Current password" value={pw.current} onChange={(v) => setPw({ ...pw, current: v })} autoComplete="current-password" />
          <div className="form-row">
            <PasswordField label="New password" value={pw.next} onChange={(v) => setPw({ ...pw, next: v })} meter />
            <PasswordField label="Confirm new password" value={pw.again} onChange={(v) => setPw({ ...pw, again: v })} />
          </div>
          {pwError && <Alert>{pwError}</Alert>}
          <div><button className="btn btn-primary" disabled={pwBusy}>{pwBusy ? "Updating…" : "Update password"}</button></div>
          <p className="hint">Changing your password signs you out everywhere else and sends a security email.</p>
        </form>
      </section>
    </div>
  );
}
