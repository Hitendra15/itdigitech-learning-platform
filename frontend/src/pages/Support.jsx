import { useMemo, useState } from "react";
import { Link } from "react-router-dom";
import { useFetch, useDocumentTitle } from "../hooks.js";
import { Accordion, EmptyState, PageHead, SearchBox, Skeleton, StatusPill } from "../components/ui.jsx";
import { useRealtimeEvent } from "../realtime/Realtime.jsx";
import { IconChat, IconChevron, IconPlus } from "../components/Icons.jsx";
import { timeAgo } from "../api/client.js";

export default function Support() {
  useDocumentTitle("Support");
  const tickets = useFetch("/support/tickets");
  const faqs = useFetch("/support/faqs");
  const [q, setQ] = useState("");

  // New replies and status changes appear without refreshing.
  useRealtimeEvent((e) => { if (e.kind?.startsWith("ticket_")) tickets.refresh(); });

  const shown = useMemo(() => {
    const t = q.trim().toLowerCase();
    return (faqs.data ?? []).filter((f) => !t || f.question.toLowerCase().includes(t) || f.answer.toLowerCase().includes(t));
  }, [faqs.data, q]);

  return (
    <div className="stack-lg">
      <PageHead title="Support" lead="Find a quick answer, or send us a request and we will reply here and by email."
        actions={<Link className="btn btn-primary" to="/support/new"><IconPlus size={18} /> New request</Link>} />

      <div className="support-grid">
        <section aria-labelledby="req-h">
          <div className="section-head"><h2 id="req-h">Your requests</h2></div>
          {tickets.loading && !tickets.data ? <div className="panel"><Skeleton lines={4} height={18} /></div>
            : tickets.data?.length === 0 ? (
              <EmptyState title="No requests yet" action={<Link className="btn btn-primary" to="/support/new">Ask for help</Link>}>
                Payment problem, locked course or a bug? Tell us and we will sort it out.
              </EmptyState>
            ) : (
              <ul className="ticket-list">
                {tickets.data?.map((t) => (
                  <li key={t.id}>
                    <Link to={`/support/${t.id}`} className={`ticket-row ${t.unread ? "unread" : ""}`}>
                      <span className="ticket-ico"><IconChat size={18} /></span>
                      <span className="ticket-main">
                        <span className="ticket-top"><strong>{t.subject}</strong>{t.unread && <span className="dot-new" aria-label="New reply" />}</span>
                        <span className="ticket-preview">{t.preview}</span>
                        <span className="ticket-meta"><span>{t.reference}</span><span>{t.category_label}</span><span>{timeAgo(t.last_message_at)}</span></span>
                      </span>
                      <StatusPill value={t.status} label={t.status_label} />
                      <IconChevron size={18} className="ticket-go" />
                    </Link>
                  </li>
                ))}
              </ul>
            )}
        </section>

        <aside aria-labelledby="faq-h">
          <div className="section-head"><h2 id="faq-h">Quick answers</h2></div>
          <SearchBox value={q} onChange={setQ} placeholder="Search help" />
          <div style={{ marginTop: ".9rem" }}>
            {faqs.loading && !faqs.data ? <Skeleton lines={4} height={16} />
              : shown.length ? <Accordion items={shown} />
              : <p className="muted small">No answers match. Send us a request and we will help.</p>}
          </div>
        </aside>
      </div>
    </div>
  );
}
