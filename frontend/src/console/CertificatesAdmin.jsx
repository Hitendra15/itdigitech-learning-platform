import { useEffect, useState } from "react";
import api, { errorMessage, fmtDate } from "../api/client.js";
import { useDebounced, useDocumentTitle } from "../hooks.js";
import { useToast } from "../components/Toast.jsx";
import { EmptyState, SearchBox, Spinner } from "../components/ui.jsx";

export default function CertificatesAdmin() {
  useDocumentTitle("Certificates");
  const toast = useToast();
  const [q, setQ] = useState("");
  const dq = useDebounced(q);
  const [rows, setRows] = useState(null);
  const load = () => api.get("/admin-api/certificates", { params: dq ? { search: dq } : {} }).then((r) => setRows(r.data)).catch(() => setRows([]));
  useEffect(() => { load(); }, [dq]); // eslint-disable-line react-hooks/exhaustive-deps

  const toggle = async (c) => {
    let reason = "";
    if (!c.revoked) { reason = window.prompt("Reason for withdrawing this certificate (visible to admins only):") ?? null; if (reason === null) return; }
    try { await api.post(`/admin-api/certificates/${c.id}/revoke`, { restore: c.revoked, reason }); toast.success(c.revoked ? "Certificate restored" : "Certificate withdrawn"); load(); }
    catch (err) { toast.error(errorMessage(err)); }
  };

  return (
    <div className="stack-lg">
      <header className="page-head"><div><h1>Certificates</h1><p className="lead">Every certificate issued to students. Withdrawn certificates fail public verification straight away.</p></div></header>
      <SearchBox value={q} onChange={setQ} placeholder="Search by ID, name or email" />
      {!rows ? <Spinner /> : rows.length === 0 ? <EmptyState title="No certificates found">Certificates appear once students finish a course.</EmptyState> : (
        <div className="table-wrap"><div className="table-scroll"><table className="table">
          <thead><tr><th>ID</th><th>Student</th><th>Course</th><th>Issued</th><th>Score</th><th>Status</th><th className="actions-col" /></tr></thead>
          <tbody>{rows.map((c) => (
            <tr key={c.id}><td><code>{c.code}</code></td><td>{c.recipient_name}<br /><span className="muted small">{c.email}</span></td><td>{c.course_title}</td><td>{fmtDate(c.issued_at)}</td><td>{c.average_score != null ? `${c.average_score}%` : "-"}</td>
              <td>{c.revoked ? <span className="pill pill-bad" title={c.revoked_reason}>Withdrawn</span> : <span className="pill pill-good">Valid</span>}</td>
              <td className="actions-col"><button className="btn btn-ghost btn-sm" onClick={() => toggle(c)}>{c.revoked ? "Restore" : "Withdraw"}</button></td></tr>
          ))}</tbody></table></div></div>
      )}
    </div>
  );
}
