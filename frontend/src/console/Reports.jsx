import { useState } from "react";
import api, { errorMessage, fmtDate } from "../api/client.js";
import { useFetch, useDocumentTitle } from "../hooks.js";
import { EmptyState, PageHead, Skeleton, StatusPill } from "../components/ui.jsx";
import { useToast } from "../components/Toast.jsx";
import { useRealtimeEvent } from "../realtime/Realtime.jsx";
import { IconDownload } from "../components/Icons.jsx";

const KINDS = [
  { kind: "orders", title: "Orders", text: "Every order with amounts, GST, status and payment date." },
  { kind: "users", title: "Students and staff", text: "Accounts with role, status, phone and join date." },
];

export default function Reports() {
  useDocumentTitle("Reports");
  const toast = useToast();
  const jobs = useFetch("/admin-api/exports");
  const [busy, setBusy] = useState(null);

  // The worker pushes a notification when a file is ready, so the list updates by itself.
  useRealtimeEvent((e) => { if (e.kind === "notification" && /export/i.test(e.title)) jobs.refresh(); });

  const start = async (kind) => {
    setBusy(kind);
    try { await api.post("/admin-api/exports", { kind }); toast.info("We are preparing your file. You will get a notification when it is ready."); jobs.refresh(); }
    catch (err) { toast.error(errorMessage(err)); } finally { setBusy(null); }
  };

  return (
    <div className="stack-lg">
      <PageHead title="Reports" lead="Download data as CSV. Files are built in the background so large exports never slow the site." />
      <div className="grid-2">
        {KINDS.map((k) => (
          <section key={k.kind} className="panel">
            <div className="panel-head"><h2>{k.title}</h2></div>
            <p className="muted">{k.text}</p>
            <button className="btn btn-primary" onClick={() => start(k.kind)} disabled={busy === k.kind}>{busy === k.kind ? "Requesting…" : "Prepare CSV"}</button>
          </section>
        ))}
      </div>
      <section>
        <div className="section-head"><h2>Recent exports</h2></div>
        {jobs.loading && !jobs.data ? <div className="panel"><Skeleton lines={3} /></div>
          : jobs.data?.length ? (
            <div className="table-wrap"><table className="table"><thead><tr><th>Report</th><th>Status</th><th className="num">Rows</th><th>Requested</th><th><span className="sr-only">Download</span></th></tr></thead>
              <tbody>{jobs.data.map((j) => (
                <tr key={j.id}><td data-label="Report" className="cap">{j.kind}</td><td data-label="Status"><StatusPill value={j.status} label={j.status === "done" ? "Ready" : j.status} />{j.error && <div className="muted small">{j.error}</div>}</td>
                  <td data-label="Rows" className="num">{j.row_count}</td><td data-label="Requested">{fmtDate(j.created_at, true)}</td>
                  <td data-label="Download">{j.url ? <a className="link-btn" href={j.url} download><IconDownload size={16} /> Download</a> : "-"}</td></tr>
              ))}</tbody></table></div>
          ) : <EmptyState title="No exports yet">Prepare a report above and it will show up here.</EmptyState>}
      </section>
    </div>
  );
}
