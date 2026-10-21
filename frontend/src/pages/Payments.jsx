import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import api from "../api/client.js";
import { EmptyState, Spinner } from "../components/ui.jsx";
import { IconDownload, IconReceipt } from "../components/Icons.jsx";
import { useDocumentTitle } from "../hooks.js";

const statusTone = (s = "") => {
  const v = s.toLowerCase();
  if (["paid", "captured", "success", "succeeded", "completed"].includes(v)) return "good";
  if (["failed", "error", "refunded"].includes(v)) return "bad";
  return "warn";
};

export default function Payments() {
  useDocumentTitle("Payments");
  const [rows, setRows] = useState(null);
  useEffect(() => { api.get("/billing/payments").then((r) => setRows(r.data.results ?? r.data)); }, []);
  if (!rows) return <Spinner label="Loading payments…" />;

  return (
    <div className="stack-lg">
      <header className="page-head">
        <div>
          <h1>Payment history</h1>
          <p className="lead">Every payment and its GST invoice, in one place.</p>
        </div>
      </header>

      {rows.length === 0 ? (
        <EmptyState icon={IconReceipt} title="No payments yet" action={<Link className="btn btn-primary" to="/plans">View plans</Link>}>
          Once you buy a plan, your receipt and invoice will be listed here.
        </EmptyState>
      ) : (
        <div className="table-wrap">
          <table className="table">
            <thead>
              <tr><th>Date</th><th>Plan</th><th>Method</th><th className="num">Amount</th><th>Status</th><th>Invoice</th></tr>
            </thead>
            <tbody>
              {rows.map((r) => (
                <tr key={r.razorpay_payment_id}>
                  <td data-label="Date">{new Date(r.created_at).toLocaleDateString("en-IN", { day: "numeric", month: "short", year: "numeric" })}</td>
                  <td data-label="Plan"><strong>{r.plan}</strong></td>
                  <td data-label="Method" className="cap">{r.method || "-"}</td>
                  <td data-label="Amount" className="num">₹{Number(r.total).toLocaleString("en-IN")}</td>
                  <td data-label="Status"><span className={`pill pill-${statusTone(r.status)}`}>{(r.status || "").charAt(0).toUpperCase() + (r.status || "").slice(1)}</span></td>
                  <td data-label="Invoice">
                    {r.invoice_url
                      ? <a className="link-btn" href={r.invoice_url} target="_blank" rel="noreferrer"><IconDownload size={16} /> Download</a>
                      : <span className="muted">-</span>}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
