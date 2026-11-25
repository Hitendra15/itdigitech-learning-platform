import { useCallback, useEffect, useRef, useState } from "react";
import api, { errorMessage, timeAgo } from "../api/client.js";
import { useDocumentTitle } from "../hooks.js";
import { useRealtimeEvent } from "../realtime/Realtime.jsx";
import { useToast } from "../components/Toast.jsx";
import { Spinner } from "../components/ui.jsx";
import { IconSend } from "../components/Icons.jsx";

const VIEWS = [["active", "Active"], ["waiting", "Waiting"], ["closed", "Closed"], ["", "All"]];
const CANNED = [
  ["Greeting", "Hi! Thanks for reaching out to IT DigiTech. How can I help you today?"],
  ["Ask for email", "Could you share your registered email address so I can check your account?"],
  ["Payment check", "I'm checking your payment now. Could you share the Razorpay payment ID (starts with pay_)?"],
  ["Wrap up", "Is there anything else I can help you with? If not, I'll close this chat. Have a great day!"],
];

export default function Chats() {
  useDocumentTitle("Live chat");
  const toast = useToast();
  const [view, setView] = useState("active");
  const [list, setList] = useState(null);
  const [openId, setOpenId] = useState(null);
  const [chat, setChat] = useState(null);
  const [text, setText] = useState("");
  const [busy, setBusy] = useState(false);
  const bodyRef = useRef(null);

  const loadList = useCallback(() => api.get("/admin-api/chats", { params: view ? { status: view } : {} }).then((r) => setList(r.data)).catch(() => setList([])), [view]);
  const loadChat = useCallback((id) => api.get(`/admin-api/chats/${id}`).then((r) => setChat(r.data)).catch((e) => toast.error(errorMessage(e))), [toast]);

  useEffect(() => { loadList(); }, [loadList]);
  useEffect(() => { if (openId) loadChat(openId); else setChat(null); }, [openId, loadChat]);
  useEffect(() => { bodyRef.current?.scrollTo({ top: bodyRef.current.scrollHeight }); }, [chat?.messages.length]);

  useRealtimeEvent((e) => {
    if (!e.kind?.startsWith("chat_")) return;
    loadList();
    if (e.kind === "chat_escalated") toast.info(`${e.visitor_name} is waiting for an agent`, { title: "New live chat" });
    if (e.chat_id === openId) loadChat(openId);
  });

  const reply = async (body) => {
    if (!body.trim() || !openId) return;
    setBusy(true);
    try { const { data } = await api.post(`/admin-api/chats/${openId}`, { body }); setChat(data); setText(""); loadList(); }
    catch (err) { toast.error(errorMessage(err)); } finally { setBusy(false); }
  };
  const close = async () => { try { const { data } = await api.post(`/admin-api/chats/${openId}/close`); setChat(data); loadList(); } catch (err) { toast.error(errorMessage(err)); } };

  return (
    <div className={`inbox ${openId ? "has-thread" : ""}`}>
      <section className="inbox-list" aria-label="Live chats">
        <div className="inbox-head">
          <h1>Live chat</h1>
          <div className="chips" role="tablist">
            {VIEWS.map(([k, l]) => <button key={k} role="tab" aria-selected={view === k} className={`chip-btn ${view === k ? "on" : ""}`} onClick={() => setView(k)}>{l}</button>)}
          </div>
        </div>
        <div className="inbox-rows">
          {!list ? <Spinner /> : list.length === 0 ? <p className="inbox-empty">No chats here.</p> : list.map((c) => (
            <button key={c.id} className={`inbox-row ${c.id === openId ? "active" : ""} ${c.unread ? "unread" : ""}`} onClick={() => setOpenId(c.id)}>
              <span className="inbox-top"><strong>{c.visitor_name}{c.is_student ? " · student" : ""}</strong><time>{timeAgo(c.last_message_at)}</time></span>
              <span className="inbox-sub clamp">{c.preview}</span>
              <span className="inbox-meta"><span className={`pill ${c.status === "waiting" ? "pill-warn" : c.status === "live" ? "pill-good" : "pill-neutral"}`}>{c.status}</span></span>
            </button>
          ))}
        </div>
      </section>

      <section className="inbox-thread" aria-label="Conversation">
        {!chat ? <p className="inbox-empty">Select a chat to reply.</p> : (
          <>
            <header className="thread-head">
              <div><h2>{chat.visitor_name}</h2><p className="muted small">{chat.reference} · {chat.visitor_email || "no email"}{chat.page_url ? ` · from ${chat.page_url}` : ""}</p></div>
              {chat.status !== "closed" && <button className="btn btn-ghost btn-sm" onClick={close}>Close chat</button>}
            </header>
            <div className="chat-thread" ref={bodyRef}>
              {chat.messages.map((m) => <div key={m.id} className={`msg msg-${m.sender === "agent" ? "me" : m.sender}`}><span className="msg-who">{m.sender === "visitor" ? chat.visitor_name : m.sender === "bot" ? "Assistant" : m.author}</span><p>{m.body}</p><time>{timeAgo(m.created_at)}</time></div>)}
            </div>
            {chat.status !== "closed" && (
              <div className="thread-compose">
                <div className="chips">{CANNED.map(([l, t]) => <button key={l} className="chip-btn" onClick={() => setText(t)}>{l}</button>)}</div>
                <form className="chat-compose" onSubmit={(e) => { e.preventDefault(); reply(text); }}>
                  <textarea rows={2} value={text} onChange={(e) => setText(e.target.value)} placeholder="Reply to the visitor…" onKeyDown={(e) => { if (e.key === "Enter" && !e.shiftKey) { e.preventDefault(); reply(text); } }} />
                  <button className="chat-send" disabled={busy || !text.trim()} aria-label="Send"><IconSend size={18} /></button>
                </form>
              </div>
            )}
          </>
        )}
      </section>
    </div>
  );
}
