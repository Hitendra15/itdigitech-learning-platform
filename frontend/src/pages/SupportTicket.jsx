import { useCallback, useEffect, useRef, useState } from "react";
import { Link, useParams } from "react-router-dom";
import api, { errorMessage } from "../api/client.js";
import { Alert, Spinner, StatusPill } from "../components/ui.jsx";
import { Confirm } from "../components/Modal.jsx";
import { Thread } from "../components/Thread.jsx";
import { useToast } from "../components/Toast.jsx";
import { useDocumentTitle } from "../hooks.js";
import { useRealtime, useRealtimeEvent } from "../realtime/Realtime.jsx";
import { IconArrowLeft, IconPaperclip, IconSend, IconX } from "../components/Icons.jsx";

export default function SupportTicket() {
  const { id } = useParams();
  const toast = useToast();
  const { refreshCounters, status: socket } = useRealtime();
  const [t, setT] = useState(null);
  const [error, setError] = useState("");
  const [body, setBody] = useState("");
  const [file, setFile] = useState(null);
  const [busy, setBusy] = useState(false);
  const [closing, setClosing] = useState(false);
  const fileRef = useRef(null);
  useDocumentTitle(t ? `${t.reference} ${t.subject}` : "Support");

  const load = useCallback(async () => {
    try { const { data } = await api.get(`/support/tickets/${id}`); setT(data); refreshCounters(); }
    catch (err) { setError(err.response?.status === 404 ? "We could not find this request." : errorMessage(err)); }
  }, [id, refreshCounters]);
  useEffect(() => { load(); }, [load]);

  // Live: staff replies and status changes land instantly.
  useRealtimeEvent((e) => {
    if (e.ticket_id !== id) return;
    if (e.kind === "ticket_message" && e.message && !e.message.is_internal_note) {
      setT((cur) => (cur && !cur.messages.some((m) => m.id === e.message.id)
        ? { ...cur, status: e.status, messages: [...cur.messages, e.message] } : cur));
      if (e.message.is_staff_reply) api.get(`/support/tickets/${id}`).then(refreshCounters).catch(() => {});
    } else if (e.kind === "ticket_update") {
      setT((cur) => (cur ? { ...cur, status: e.status } : cur));
      load();
    }
  });

  const send = async (e) => {
    e.preventDefault();
    if (!body.trim()) return;
    setBusy(true);
    const fd = new FormData();
    fd.append("body", body);
    if (file) fd.append("attachment", file);
    try {
      const { data } = await api.post(`/support/tickets/${id}/messages`, fd);
      setT((cur) => (cur.messages.some((m) => m.id === data.id) ? cur : { ...cur, status: cur.status === "waiting_on_student" || cur.status === "resolved" ? "open" : cur.status, messages: [...cur.messages, data] }));
      setBody(""); setFile(null); if (fileRef.current) fileRef.current.value = "";
    } catch (err) { toast.error(errorMessage(err)); }
    finally { setBusy(false); }
  };

  const close = async () => {
    setBusy(true);
    try { await api.post(`/support/tickets/${id}/close`); toast.success("Request closed"); setClosing(false); await load(); }
    catch (err) { toast.error(errorMessage(err)); }
    finally { setBusy(false); }
  };

  if (error) return <div className="stack"><Alert>{error}</Alert><Link className="link-btn" to="/support"><IconArrowLeft size={16} /> Back to support</Link></div>;
  if (!t) return <Spinner label="Loading conversation…" />;
  const closed = t.status === "closed";
  const onKey = (e) => { if ((e.metaKey || e.ctrlKey) && e.key === "Enter") send(e); };

  return (
    <div className="chat-page">
      <Link className="link-btn" to="/support"><IconArrowLeft size={16} /> All requests</Link>
      <header className="chat-head">
        <div>
          <span className="muted small">{t.reference} · {t.category_label}</span>
          <h1>{t.subject}</h1>
        </div>
        <div className="row gap wrap">
          <StatusPill value={t.status} label={t.status_label} />
          {!closed && <button className="btn btn-ghost btn-sm" onClick={() => setClosing(true)}>Mark as solved</button>}
        </div>
      </header>

      <section className="chat" aria-label="Conversation">
        <Thread messages={t.messages} viewer="student" />
        {t.status === "waiting_on_student" && <div className="chat-hint">We replied and are waiting to hear back from you.</div>}
        {t.status === "resolved" && <div className="chat-hint">Marked resolved. Reply below if you still need help; otherwise it closes automatically in a few days.</div>}

        {closed ? (
          <div className="chat-closed">This request is closed. <Link to="/support/new">Open a new request</Link> if you need more help.</div>
        ) : (
          <form className="composer" onSubmit={send}>
            <textarea value={body} onChange={(e) => setBody(e.target.value)} onKeyDown={onKey} rows={3} maxLength={5000}
                      placeholder="Write a reply…" aria-label="Your reply" />
            <div className="composer-bar">
              <div className="row gap">
                <input ref={fileRef} type="file" className="sr-only" id="reply-file" accept=".png,.jpg,.jpeg,.gif,.webp,.pdf,.txt,.zip,.doc,.docx"
                       onChange={(e) => setFile(e.target.files?.[0] ?? null)} />
                <button type="button" className="icon-btn" onClick={() => fileRef.current?.click()} aria-label="Attach a file"><IconPaperclip /></button>
                {file && <span className="chip">{file.name}<button type="button" aria-label="Remove file" onClick={() => { setFile(null); fileRef.current.value = ""; }}><IconX size={14} /></button></span>}
              </div>
              <div className="row gap">
                <span className={`live ${socket === "live" ? "on" : ""}`} title={socket === "live" ? "Replies appear instantly" : "Reconnecting…"}>{socket === "live" ? "Live" : "Offline"}</span>
                <button className="btn btn-primary" disabled={busy || !body.trim()}><IconSend size={18} /> {busy ? "Sending…" : "Send"}</button>
              </div>
            </div>
          </form>
        )}
      </section>

      <Confirm open={closing} title="Close this request?" confirmLabel="Mark as solved" busy={busy} onCancel={() => setClosing(false)} onConfirm={close}>
        Only close it if your problem is sorted. You can always open a new request.
      </Confirm>
    </div>
  );
}
