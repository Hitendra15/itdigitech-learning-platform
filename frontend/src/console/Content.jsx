import CrudPage from "../components/CrudPage.jsx";
import { StatusPill } from "../components/ui.jsx";
import { fmtDate } from "../api/client.js";

export function Faqs() {
  return (
    <CrudPage title="Help articles" lead="Quick answers shown on the student support page. They also suggest themselves when a student starts typing a request." noun="article"
      endpoint="/admin-api/faqs" paginated={false} createLabel="New article"
      columns={[
        { key: "order", label: "Order", num: true },
        { key: "question", label: "Question", render: (f) => <div className="cell-stack"><strong>{f.question}</strong><span className="clamp-1">{f.answer}</span></div> },
        { key: "category", label: "Category" },
        { key: "is_published", label: "Status", render: (f) => <StatusPill value={f.is_published ? "published" : "draft"} /> },
      ]}
      fields={[
        { name: "question", label: "Question", required: true, span: 2 },
        { name: "answer", label: "Answer", type: "textarea", required: true, rows: 5, span: 2 },
        { name: "category", label: "Category", placeholder: "Payments, Account, Tests…" },
        { name: "order", label: "Sort order", type: "number", min: 0, required: true, default: 0, help: "Lower numbers appear first." },
        { name: "is_published", label: "Show to students", type: "checkbox", span: 2, default: true },
      ]} />
  );
}

export function Announcements() {
  return (
    <CrudPage title="Announcements" lead="Send a message to students. It appears in their notification bell instantly and can be emailed too. Sending runs in the background." noun="announcement"
      endpoint="/admin-api/announcements" allowEdit={false} allowDelete={false} createLabel="New announcement" pollMs={4000}
      columns={[
        { key: "title", label: "Announcement", render: (a) => <div className="cell-stack"><strong>{a.title}</strong><span className="clamp-1">{a.body}</span></div> },
        { key: "audience", label: "Audience", render: (a) => ({ all: "Everyone", active: "Paid students", pending: "Unpaid students" }[a.audience]) },
        { key: "send_email", label: "Email", render: (a) => (a.send_email ? "Yes" : "No") },
        { key: "status", label: "Status", render: (a) => <StatusPill value={a.status} label={a.status === "sent" ? `Sent to ${a.recipients}` : a.status} /> },
        { key: "created_at", label: "Created", render: (a) => fmtDate(a.created_at, true) },
      ]}
      fields={[
        { name: "title", label: "Title", required: true, span: 2 },
        { name: "body", label: "Message", type: "textarea", required: true, rows: 6, span: 2 },
        { name: "audience", label: "Send to", type: "select", required: true, default: "all",
          options: [{ value: "all", label: "Everyone" }, { value: "active", label: "Paid students" }, { value: "pending", label: "Students who have not paid" }] },
        { name: "send_email", label: "Also send as email", type: "checkbox", help: "Emails are queued and sent by background workers." },
      ]} />
  );
}
