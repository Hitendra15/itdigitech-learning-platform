import { useCallback, useEffect, useRef, useState } from "react";
import { Link, useNavigate, useParams } from "react-router-dom";
import api, { errorMessage, timeAgo } from "../api/client.js";
import { useDebounced, useDocumentTitle, useFetch } from "../hooks.js";
import { Alert, EmptyState, SearchBox, Skeleton, Spinner, StatusPill } from "../components/ui.jsx";
import { Thread } from "../components/Thread.jsx";
import { useToast } from "../components/Toast.jsx";
import { useRealtime, useRealtimeEvent } from "../realtime/Realtime.jsx";
import { IconArrowLeft, IconPaperclip, IconSend, IconX } from "../components/Icons.jsx";

const VIEWS = [
  { key: "needs", label: "Needs reply", params: { unread: "1" } },
  { key: "mine", label: "Mine", params: { assigned: "me", status: "active" } },
  { key: "unassigned", label: "Unassigned", params: { assigned: "unassigned", status: "active" } },
  { key: "open", label: "All open", params: { status: "active" } },
  { key: "resolved", label: "Resolved", params: { status: "resolved" } },
  { key: "closed", label: "Closed", params: { status: "closed" } },
];
const STATUSES = [["open", "Open"], ["in_progress", "In progress"], ["waiting_on_student", "Waiting on student"], ["resolved", "Resolved"], ["closed", "Closed"]];
const PRIORITIES = [["low", "Low"], ["normal", "Normal"], ["high", "High"], ["urgent", "Urgent"]];
const CANNED = [
  ["Ask for payment ID", "Thanks for contacting us. Could you share your Razorpay payment ID (it starts with pay_) and the email you used at checkout? We will check it right away."],
  ["Access restored", "I have checked your payment and unlocked your courses. Please refresh the page or sign out and back in. Let me know if anything is still locked."],
  ["Clear cache and retry", "Please try a hard refresh (Ctrl+Shift+R), or open the site in a private window. If the problem continues, send us a screenshot and the browser you use."],
  ["Resolved, closing", "Glad we could sort this out. I am marking this request as resolved. Reply here if you need anything else."],
];

export default function Tickets() {
  const { id } = useParams();
  useDocumentTitle("Requests");
  const [view, setView] = useState("needs");
  const [q, setQ] = useState("");
  const dq = useDebounced(q);
  const { refreshCounters } = useRealtime();
  const counts = useFetch("/admin-api/tickets/counts");
  const params = { ...VIEWS.find((v) => v.key === view).params, ...(dq ? { search: dq } : {}), page_size: 50 };
  const list = useFetch("/admin-api/tickets", params);

  useRealtimeEvent((e) => { if (e.kind?.startsWith("ticket_")) { list.refresh(); counts.refresh(); } });
  const tally = { needs: counts.data?.unread, mine: counts.data?.mine, unassigned: counts.data?.unassigned };

  return (
    <div className={`inbox ${id ? "has-thread" : ""}`}>
      <section className="inbox-list" aria-label="Support requests">
        <div className="inbox-head">
          <h1>Requests</h1>
          <SearchBox value={q} onChange={setQ} placeholder="Search subject or student" />
          <div className="chips" role="tablist" aria-label="Filter requests">
            {VIEWS.map((v) => (
              <button key={v.key} role="tab" aria-selected={view === v.key} className={`chip-btn ${view === v.key ? "on" : ""}`} onClick={() => setView(v.key)}>
                {v.label}{tally[v.key] > 0 && <span className="chip-n">{tally[v.key]}</span>}
              </button>
            ))}
          </div>
        </div>
        <div className="inbox-rows">
          {list.loading && !list.data ? <div style={{ padding: "1rem" }}><Skeleton lines={5} height={18} /></div>
            : list.data?.results.length === 0 ? <p className="inbox-empty">{dq ? "No requests match your search." : view === "needs" ? "You are all caught up." : "Nothing here."}</p>
            : list.data?.results.map((t) => (
              <Link key={t.id} to={`/console/tickets/${t.id}`} className={`inbox-row ${t.id === id ? "active" : ""} ${t.unread ? "unread" : ""}`}>
                <div className="inbox-top"><strong>{t.student}</strong><span>{timeAgo(t.last_message_at)}</span></div>
                <div className="inbox-subject">{t.unread && <span className="dot-new" aria-label="Unread" />}{t.subject}</div>
                <div className="inbox-meta">
                  <span>{t.reference}</span><StatusPill value={t.status} label={t.status_label} />
                  {t.priority !== "normal" && <StatusPill value={t.priority} label={t.priority_label} />}
                  {t.assigned_to && <span className="muted small">{t.assigned_to.split("@")[0]}</span>}
                </div>
              </Link>
            ))}
        </div>
      </section>

      <section className="inbox-thread" aria-label="Conversation">
        {id ? <TicketThread key={id} id={id} onChanged={() => { list.refresh(); counts.refresh(); refreshCounters(); }} />
          : <div className="inbox-placeholder"><EmptyState title="Select a request">Choose a conversation on the left to read it and reply.</EmptyState></div>}
      </section>
    </div>
  );
}

function TicketThread({ id, onChanged }) {
  const toast = useToast();
  const navigate = useNavigate();
  const [t, setT] = useState(null);
  const [error, setError] = useState("");
  const staff = useFetch("/admin-api/staff");
  const [body, setBody] = useState("");
  const [internal, setInternal] = useState(false);
  const [file, setFile] = useState(null);
  const [busy, setBusy] = useState(false);
  const fileRef = useRef(null);
  useDocumentTitle(t ? `${t.reference} ${t.subject}` : "Request");

  const load = useCallback(async () => {
    try { setT((await api.get(`/admin-api/tickets/${id}`)).data); onChanged(); }
    catch (e) { setError(errorMessage(e, "Could not load this request.")); }
  }, [id]); // eslint-disable-line react-hooks/exhaustive-deps
  useEffect(() => { load(); }, [load]);

  useRealtimeEvent((e) => {
    if (e.ticket_id !== id) return;
    if (e.kind === "ticket_message" && e.message) {
      setT((cur) => (cur && !cur.messages.some((m) => m.id === e.message.id) ? { ...cur, status: e.status, messages: [...cur.messages, e.message] } : cur));
      api.get(`/admin-api/tickets/${id}`).catch(() => {}); // marks it read for staff
    } else if (e.kind === "ticket_update") load();
  });

  const patch = async (changes, okText) => {
    try { const { data } = await api.patch(`/admin-api/tickets/${id}`, changes); setT((cur) => ({ ...cur, ...data, messages: cur.messages })); toast.success(okText); onChanged(); }
    catch (e) { toast.error(errorMessage(e)); }
  };

  const send = async (resolve = false) => {
    if (!body.trim()) return;
    setBusy(true);
    const fd = new FormData();
    fd.append("body", body);
    if (internal) fd.append("internal", "true");
    if (resolve) fd.append("resolve", "true");
    if (file) fd.append("attachment", file);
    try {
      const { data } = await api.post(`/admin-api/tickets/${id}/reply`, fd);
      setT((cur) => (cur.messages.some((m) => m.id === data.id) ? cur : { ...cur, messages: [...cur.messages, data] }));
      setBody(""); setFile(null); if (fileRef.current) fileRef.current.value = "";
      toast.success(internal ? "Note saved" : resolve ? "Reply sent and request resolved" : "Reply sent");
      load();
    } catch (e) { toast.error(errorMessage(e)); } finally { setBusy(false); }
  };

  if (error) return <div className="pad"><Alert>{error}</Alert></div>;
  if (!t) return <Spinner label="Loading request…" />;
  const closed = t.status === "closed";

  return (
    <div className="thread-pane">
      <header className="thread-head">
        <button className="icon-btn only-mobile" onClick={() => navigate("/console/tickets")} aria-label="Back to list"><IconArrowLeft /></button>
        <div className="thread-title">
          <span className="muted small">{t.reference} · {t.category_label}</span>
          <h2>{t.subject}</h2>
          <span className="muted small">{t.student.name} · {t.student.email}{t.student.phone ? ` · ${t.student.phone}` : ""} · <Link to="/console/users">student record</Link></span>
        </div>
      </header>

      <div className="triage">
        <label>Status
          <select value={t.status} onChange={(e) => patch({ status: e.target.value }, "Status updated")}>{STATUSES.map(([v, l]) => <option key={v} value={v}>{l}</option>)}</select>
        </label>
        <label>Priority
          <select value={t.priority} onChange={(e) => patch({ priority: e.target.value }, "Priority updated")}>{PRIORITIES.map(([v, l]) => <option key={v} value={v}>{l}</option>)}</select>
        </label>
        <label>Assigned to
          <select value={t.assigned_to?.id ?? ""} onChange={(e) => patch({ assigned_to: e.target.value || null }, "Assignment updated")}>
            <option value="">Unassigned</option>
            {(staff.data ?? []).map((s) => <option key={s.id} value={s.id}>{s.name}</option>)}
          </select>
        </label>
      </div>

      <div className="thread-scroll"><Thread messages={t.messages} viewer="staff" /></div>

      {closed ? <div className="chat-closed">This request is closed. Change the status above to reopen it.</div> : (
        <form className={`composer ${internal ? "is-note" : ""}`} onSubmit={(e) => { e.preventDefault(); send(false); }}>
          <div className="composer-modes" role="tablist">
            <button type="button" role="tab" aria-selected={!internal} className={!internal ? "on" : ""} onClick={() => setInternal(false)}>Reply to student</button>
            <button type="button" role="tab" aria-selected={internal} className={internal ? "on" : ""} onClick={() => setInternal(true)}>Internal note</button>
            {!internal && (
              <select className="canned" aria-label="Insert a saved reply" value="" onChange={(e) => { if (e.target.value) setBody((b) => (b ? b + "\n\n" : "") + CANNED[e.target.value][1]); }}>
                <option value="">Saved replies…</option>
                {CANNED.map(([l], i) => <option key={l} value={i}>{l}</option>)}
              </select>
            )}
          </div>
          <textarea rows={4} value={body} onChange={(e) => setBody(e.target.value)} maxLength={5000} aria-label={internal ? "Internal note" : "Reply"}
            placeholder={internal ? "Only admins can see this note." : "Write your reply. The student is notified instantly and by email."}
            onKeyDown={(e) => { if ((e.metaKey || e.ctrlKey) && e.key === "Enter") send(false); }} />
          <div className="composer-bar">
            <div className="row gap">
              <input ref={fileRef} type="file" className="sr-only" accept=".png,.jpg,.jpeg,.gif,.webp,.pdf,.txt,.zip,.doc,.docx" onChange={(e) => setFile(e.target.files?.[0] ?? null)} />
              <button type="button" className="icon-btn" aria-label="Attach a file" onClick={() => fileRef.current?.click()}><IconPaperclip /></button>
              {file && <span className="chip">{file.name}<button type="button" aria-label="Remove file" onClick={() => { setFile(null); fileRef.current.value = ""; }}><IconX size={14} /></button></span>}
            </div>
            <div className="row gap">
              {!internal && <button type="button" className="btn btn-ghost" disabled={busy || !body.trim()} onClick={() => send(true)}>Send and resolve</button>}
              <button className="btn btn-primary" disabled={busy || !body.trim()}><IconSend size={18} /> {busy ? "Sending…" : internal ? "Save note" : "Send reply"}</button>
            </div>
          </div>
        </form>
      )}
    </div>
  );
}
