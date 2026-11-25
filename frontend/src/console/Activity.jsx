import { useState } from "react";
import CrudPage from "../components/CrudPage.jsx";
import { PageHead, StatusPill } from "../components/ui.jsx";
import { fmtDate } from "../api/client.js";
import { useDocumentTitle } from "../hooks.js";

export default function Activity() {
  useDocumentTitle("Activity");
  const [tab, setTab] = useState("audit");
  return (
    <div className="stack-lg">
      <PageHead title="Activity" lead="Who changed what in this console, and every email the platform sent." />
      <div className="tabs" role="tablist">
        <button role="tab" aria-selected={tab === "audit"} className={tab === "audit" ? "on" : ""} onClick={() => setTab("audit")}>Admin actions</button>
        <button role="tab" aria-selected={tab === "email"} className={tab === "email" ? "on" : ""} onClick={() => setTab("email")}>Email delivery</button>
      </div>
      <div className="embedded">
        {tab === "audit" ? (
          <CrudPage key="a" title="Admin actions" noun="entry" endpoint="/admin-api/audit-log" allowCreate={false} allowEdit={false} allowDelete={false} searchPlaceholder="Search actions or people"
            columns={[
              { key: "created_at", label: "When", render: (r) => fmtDate(r.created_at, true) },
              { key: "actor", label: "Who" },
              { key: "action", label: "Action", render: (r) => <span>{r.action} <strong>{r.target_type}</strong></span> },
              { key: "summary", label: "Details", render: (r) => <span className="clamp-1">{r.summary}</span> },
            ]} />
        ) : (
          <CrudPage key="e" title="Email delivery" noun="email" endpoint="/admin-api/email-log" allowCreate={false} allowEdit={false} allowDelete={false} searchPlaceholder="Search address or subject"
            filters={[{ name: "status", label: "Status", options: [{ value: "sent", label: "Sent" }, { value: "failed", label: "Failed" }] }]}
            columns={[
              { key: "created_at", label: "When", render: (r) => fmtDate(r.created_at, true) },
              { key: "to", label: "To" },
              { key: "subject", label: "Subject", render: (r) => <div className="cell-stack"><span>{r.subject}</span>{r.error && <span className="err-text">{r.error}</span>}</div> },
              { key: "status", label: "Status", render: (r) => <StatusPill value={r.status} /> },
            ]} />
        )}
      </div>
    </div>
  );
}
