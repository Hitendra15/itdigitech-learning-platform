import { useState } from "react";
import api, { errorMessage, fmtDate } from "../api/client.js";
import CrudPage from "../components/CrudPage.jsx";
import Modal, { Confirm } from "../components/Modal.jsx";
import { StatusPill } from "../components/ui.jsx";
import { FieldInput } from "../components/FormFields.jsx";
import { useToast } from "../components/Toast.jsx";
import { useFetch } from "../hooks.js";
import { IconBook, IconMail } from "../components/Icons.jsx";

const ROLES = [{ value: "student", label: "Student" }, { value: "admin", label: "Admin" }, { value: "faculty", label: "Faculty" }];
const STATUSES = [{ value: "active", label: "Active" }, { value: "pending_payment", label: "Pending payment" }, { value: "suspended", label: "Suspended" }];

function Access({ user, onClose, onChanged }) {
  const toast = useToast();
  const list = useFetch(`/admin-api/users/${user.id}/enrollments`);
  const [course, setCourse] = useState("");
  const [days, setDays] = useState("");
  const [busy, setBusy] = useState(false);
  const courses = useFetch("/admin-api/courses", { page_size: 100 });

  const grant = async (e) => {
    e.preventDefault(); setBusy(true);
    try {
      await api.post(`/admin-api/users/${user.id}/enrollments`, { course, validity_days: days || undefined });
      toast.success("Course unlocked"); setCourse(""); setDays(""); list.reload(true); onChanged();
    } catch (err) { toast.error(errorMessage(err)); } finally { setBusy(false); }
  };
  const revoke = async (id) => {
    try { await api.post(`/admin-api/users/${user.id}/revoke-course`, { course: id }); toast.success("Access removed"); list.reload(true); onChanged(); }
    catch (err) { toast.error(errorMessage(err)); }
  };

  return (
    <Modal open title={`Course access: ${user.full_name || user.email}`} onClose={onClose} size="lg">
      <form className="inline-form" onSubmit={grant}>
        <FieldInput field={{ name: "c", label: "Unlock a course", type: "select", required: true, allowEmpty: true, emptyLabel: "Choose a course",
          options: (courses.data?.results ?? []).map((c) => ({ value: c.id, label: c.title })) }} value={course} onChange={setCourse} />
        <FieldInput field={{ name: "d", label: "Valid for (days)", type: "number", placeholder: "No expiry", help: "Leave empty for lifetime access." }} value={days} onChange={setDays} />
        <button className="btn btn-primary" disabled={busy || !course}>{busy ? "Unlocking…" : "Unlock"}</button>
      </form>
      <h3 className="sub-h">Current access</h3>
      {list.data?.length ? (
        <ul className="mini-list">{list.data.map((e) => (
          <li key={e.course_id}><div><strong>{e.course}</strong><span>{e.expires_at ? `Expires ${fmtDate(e.expires_at)}` : "No expiry"}</span></div>
            <div className="row gap"><StatusPill value={e.status} />{e.status === "active" && <button className="btn btn-ghost btn-sm" onClick={() => revoke(e.course_id)}>Remove</button>}</div></li>
        ))}</ul>
      ) : <p className="muted">This student has no courses yet.</p>}
    </Modal>
  );
}

export default function Users() {
  const toast = useToast();
  const [access, setAccess] = useState(null);
  const [confirm, setConfirm] = useState(null); // {row, kind, reload}
  const [busy, setBusy] = useState(false);
  const [bump, setBump] = useState(0);

  const run = async () => {
    setBusy(true);
    const { row, kind, reload } = confirm;
    try {
      await api.post(`/admin-api/users/${row.id}/${kind}`);
      toast.success(kind === "suspend" ? "Account suspended" : "Account reactivated");
      setConfirm(null); reload();
    } catch (err) { toast.error(errorMessage(err)); } finally { setBusy(false); }
  };

  return (
    <>
      <CrudPage key={bump} title="Students and staff" lead="Everyone with an account. Invite people, unlock courses, suspend access or send a password reset." noun="user"
        endpoint="/admin-api/users" allowDelete={false} createLabel="Invite user" searchPlaceholder="Search name, email or phone"
        filters={[{ name: "role", label: "Role", options: ROLES }, { name: "status", label: "Status", options: STATUSES }]}
        columns={[
          { key: "full_name", label: "Name", render: (u) => <div className="cell-stack"><strong>{u.full_name || "-"}</strong><span>{u.email}</span></div> },
          { key: "role", label: "Role", render: (u) => <span className="cap">{u.role}</span> },
          { key: "status", label: "Status", render: (u) => <StatusPill value={u.status} /> },
          { key: "active_courses", label: "Courses", num: true },
          { key: "is_email_verified", label: "Email", render: (u) => u.is_email_verified ? <span className="pill pill-good">Confirmed</span> : <span className="pill pill-neutral">Unconfirmed</span> },
          { key: "created_at", label: "Joined", render: (u) => fmtDate(u.created_at) },
        ]}
        createFields={[
          { name: "full_name", label: "Full name", required: true },
          { name: "email", label: "Email", required: true, inputType: "email", help: "They get an email with a link to set their own password." },
          { name: "phone", label: "Mobile number" },
          { name: "role", label: "Role", type: "select", options: ROLES, default: "student", required: true },
        ]}
        fields={[
          { name: "full_name", label: "Full name", required: true },
          { name: "phone", label: "Mobile number" },
          { name: "college_name", label: "College" },
          { name: "role", label: "Role", type: "select", options: ROLES, required: true },
          { name: "status", label: "Account status", type: "select", options: STATUSES, required: true },
          { name: "is_email_verified", label: "Email confirmed", type: "checkbox" },
        ]}
        rowActions={(u, { reload, toast: t }) => (
          <>
            <button className="icon-btn" title="Course access" aria-label={`Course access for ${u.email}`} onClick={() => setAccess(u)}><IconBook size={18} /></button>
            <button className="icon-btn" title="Send password reset email" aria-label={`Send password reset to ${u.email}`}
              onClick={async () => { try { const r = await api.post(`/admin-api/users/${u.id}/send-reset`); t.success(r.data.detail); } catch (e) { t.error(errorMessage(e)); } }}><IconMail size={18} /></button>
            {u.is_active
              ? <button className="btn btn-ghost btn-sm" onClick={() => setConfirm({ row: u, kind: "suspend", reload })}>Suspend</button>
              : <button className="btn btn-ghost btn-sm" onClick={() => setConfirm({ row: u, kind: "activate", reload })}>Reactivate</button>}
          </>
        )} />
      {access && <Access user={access} onClose={() => setAccess(null)} onChanged={() => setBump((b) => b + 1)} />}
      <Confirm open={Boolean(confirm)} busy={busy} danger={confirm?.kind === "suspend"} title={confirm?.kind === "suspend" ? "Suspend this account?" : "Reactivate this account?"}
        confirmLabel={confirm?.kind === "suspend" ? "Suspend" : "Reactivate"} onCancel={() => setConfirm(null)} onConfirm={run}>
        {confirm?.kind === "suspend" ? `${confirm?.row.email} will be signed out everywhere and cannot sign in until you reactivate the account.` : `${confirm?.row.email} will be able to sign in again.`}
      </Confirm>
    </>
  );
}
