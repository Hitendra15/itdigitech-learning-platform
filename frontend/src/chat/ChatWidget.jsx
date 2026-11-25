import { useCallback, useEffect, useRef, useState } from "react";
import { useLocation } from "react-router-dom";
import api, { errorMessage } from "../api/client.js";
import { useAuth } from "../auth/AuthContext.jsx";
import { IconChat, IconSend, IconX, IconHeadset } from "../components/Icons.jsx";
import { useSite } from "../site/SiteContext.jsx";

const STORE = "itd_chat_id";
const HIDE = ["/console", "/preview-frame", "/login", "/register", "/forgot-password", "/reset-password", "/verify-email", "/tests"];
const QUICK = ["Course pricing", "How do certificates work?", "Can I try before buying?", "Talk to an agent"];

const store = {
  get: () => { try { return localStorage.getItem(STORE); } catch { return null; } },
  set: (v) => { try { v ? localStorage.setItem(STORE, v) : localStorage.removeItem(STORE); } catch { /* private mode */ } },
};
const clock = (iso) => new Date(iso).toLocaleTimeString("en-IN", { hour: "numeric", minute: "2-digit" });
const merge = (list, m) => (list.some((x) => x.id === m.id) ? list : [...list, m]);

export default function ChatWidget() {
  const { user } = useAuth();
  const SUPPORT_HOURS = useSite().profile.hours;
  const { pathname } = useLocation();
  const [open, setOpen] = useState(false);
  const [chat, setChat] = useState(null);           // {id, status, messages}
  const [unread, setUnread] = useState(0);
  const [text, setText] = useState("");
  const [form, setForm] = useState({ name: "", email: "", message: "" });
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [emailInput, setEmailInput] = useState("");
  const listRef = useRef(null);
  const openRef = useRef(open);
  openRef.current = open;

  const profileName = user?.profile?.full_name || "";
  useEffect(() => { setForm((f) => ({ ...f, name: f.name || profileName, email: f.email || user?.email || "" })); }, [profileName, user?.email]);

  const adopt = useCallback((data) => setChat((c) => {
    if (c && c.id === data.id) {
      const merged = data.messages.reduce(merge, c.messages.filter((m) => !m.pending));
      if (openRef.current === false && merged.length > c.messages.length) {
        const fresh = merged.slice(c.messages.length).filter((m) => m.sender !== "visitor").length;
        if (fresh) setUnread((n) => n + fresh);
      }
      return { ...data, messages: merged };
    }
    return data;
  }), []);

  // restore a conversation after a page reload
  useEffect(() => {
    const id = store.get();
    if (!id) return;
    api.get(`/chat/sessions/${id}`).then((r) => { r.data.status === "closed" ? store.set(null) : setChat(r.data); }).catch(() => store.set(null));
  }, []);

  // live updates (WebSocket) with a slow poll as a safety net
  const chatId = chat?.id, closed = chat?.status === "closed";
  useEffect(() => {
    if (!chatId || closed) return undefined;
    let ws, retry, tries = 0, stop = false;
    const connect = () => {
      const proto = window.location.protocol === "https:" ? "wss" : "ws";
      ws = new WebSocket(`${proto}://${window.location.host}/ws/chat/${chatId}/`);
      ws.onmessage = (e) => {
        let d; try { d = JSON.parse(e.data); } catch { return; }
        if (!d.kind?.startsWith("chat_")) return;
        setChat((c) => {
          if (!c || c.id !== d.chat_id) return c;
          const next = { ...c, status: d.status ?? c.status, messages: d.message ? merge(c.messages.filter((m) => !(m.pending && m.body === d.message.body && d.message.sender === "visitor")), d.message) : c.messages };
          if (d.message && d.message.sender !== "visitor" && !openRef.current && !c.messages.some((m) => m.id === d.message.id)) setUnread((n) => n + 1);
          return next;
        });
      };
      ws.onopen = () => { tries = 0; };
      ws.onclose = () => { if (!stop) retry = setTimeout(connect, Math.min(20000, 1000 * 2 ** tries++)); };
    };
    connect();
    const poll = setInterval(() => api.get(`/chat/sessions/${chatId}`).then((r) => adopt(r.data)).catch(() => {}), open ? 10000 : 30000);
    return () => { stop = true; clearTimeout(retry); clearInterval(poll); ws?.close(); };
  }, [chatId, closed, open, adopt]);

  useEffect(() => { listRef.current?.scrollTo({ top: listRef.current.scrollHeight, behavior: "smooth" }); }, [chat?.messages.length, open]);
  useEffect(() => { if (open) setUnread(0); }, [open]);
  useEffect(() => { const o = () => setOpen(true); window.addEventListener("itd:open-chat", o); return () => window.removeEventListener("itd:open-chat", o); }, []);
  useEffect(() => {
    if (!open) return undefined;
    const esc = (e) => e.key === "Escape" && setOpen(false);
    document.addEventListener("keydown", esc);
    return () => document.removeEventListener("keydown", esc);
  }, [open]);

  if (HIDE.some((p) => pathname === p || pathname.startsWith(`${p}/`))) return null;

  const start = async (message) => {
    setBusy(true); setError("");
    try {
      const { data } = await api.post("/chat/sessions", { name: form.name || "Guest", email: form.email, message, page: pathname });
      store.set(data.id); setChat(data); setText("");
    } catch (err) { setError(errorMessage(err, "Could not start the chat. Please try again.")); }
    finally { setBusy(false); }
  };

  const send = async (body) => {
    body = body.trim();
    if (!body) return;
    if (!chat || chat.status === "closed") return start(body);
    const temp = { id: `tmp-${Date.now()}`, sender: "visitor", body, created_at: new Date().toISOString(), pending: true };
    setChat((c) => ({ ...c, messages: [...c.messages, temp] })); setText(""); setError("");
    try { const { data } = await api.post(`/chat/sessions/${chat.id}/messages`, { body }); setChat(data); }
    catch (err) {
      setChat((c) => ({ ...c, messages: c.messages.filter((m) => m.id !== temp.id) }));
      setText(body); setError(errorMessage(err, "Message not sent. Please try again."));
    }
  };

  const act = async (path, payload) => {
    try { const { data } = await api.post(`/chat/sessions/${chat.id}/${path}`, payload); setChat(data); return data; }
    catch (err) { setError(errorMessage(err)); return null; }
  };
  const endChat = async () => { await act("close"); store.set(null); };
  const newChat = () => { store.set(null); setChat(null); setError(""); };
  const saveEmail = async (e) => { e.preventDefault(); if (await act("email", { email: emailInput })) setEmailInput(""); };

  const status = chat?.status;
  const live = status === "live", waiting = status === "waiting";
  const agentName = chat?.messages.filter((m) => m.sender === "agent").at(-1)?.author;
  const needsEmail = chat && !chat.emailKnown && (waiting || live);

  return (
    <>
      {!open && (
        <button className="chat-fab" onClick={() => setOpen(true)} aria-label={unread ? `Open chat, ${unread} new messages` : "Open chat"}>
          <IconChat size={26} />
          <span className="chat-fab-label">Chat with us</span>
          {unread > 0 && <span className="chat-fab-badge">{unread}</span>}
        </button>
      )}

      {open && (
        <section className="chat" role="dialog" aria-label="Chat with IT DigiTech">
          <header className="chat-head">
            <span className="chat-avatar"><IconHeadset size={20} /></span>
            <div>
              <strong>{live && agentName ? agentName : "IT DigiTech Support"}</strong>
              <span className="chat-sub"><i className={`dot-live ${live || status === "bot" ? "on" : ""}`} />
                {live ? "You are chatting with our team" : waiting ? "Waiting for an agent…" : status === "closed" ? "Chat ended" : "Assistant online · agents join when needed"}</span>
            </div>
            <button className="icon-btn on-dark" onClick={() => setOpen(false)} aria-label="Minimise chat"><IconX size={20} /></button>
          </header>

          {!chat ? (
            <form className="chat-start" onSubmit={(e) => { e.preventDefault(); start(form.message); }}>
              <p><strong>Hi there 👋</strong><br />Ask about courses, pricing, payments or certificates. Our assistant answers instantly and our support team steps in whenever you need a person.</p>
              {!user && <>
                <label>Your name<input value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} required maxLength={100} autoComplete="name" /></label>
                <label>Email <small>(so we can reply if you leave)</small><input type="email" value={form.email} onChange={(e) => setForm({ ...form, email: e.target.value })} autoComplete="email" /></label>
              </>}
              <label>How can we help?<textarea rows={3} value={form.message} onChange={(e) => setForm({ ...form, message: e.target.value })} maxLength={2000} placeholder="Type your question…" /></label>
              {error && <p className="chat-error" role="alert">{error}</p>}
              <button className="btn btn-primary" disabled={busy || (!user && !form.name.trim())}>{busy ? "Starting…" : "Start chat"}</button>
              <div className="chat-quick">{QUICK.map((q) => <button type="button" key={q} onClick={() => { if (!user && !form.name.trim()) { setForm({ ...form, message: q }); return; } start(q); }}>{q}</button>)}</div>
              {SUPPORT_HOURS && <p className="chat-hours">Team available {SUPPORT_HOURS}</p>}
            </form>
          ) : (
            <>
              <div className="chat-list" ref={listRef} aria-live="polite">
                {chat.messages.map((m) => (
                  <div key={m.id} className={`msg msg-${m.sender === "visitor" ? "me" : m.sender}`}>
                    {m.sender !== "visitor" && <span className="msg-who">{m.sender === "bot" ? "Assistant" : m.author || "Support team"}</span>}
                    <p>{m.body}</p>
                    <time>{m.pending ? "Sending…" : clock(m.created_at)}</time>
                  </div>
                ))}
                {waiting && <p className="chat-note">An agent will reply here shortly.{SUPPORT_HOURS ? ` ${SUPPORT_HOURS}. Outside these hours we reply by email the next working day.` : ""}</p>}
              </div>

              {status === "bot" && <button className="chat-human" onClick={() => act("human")}><IconHeadset size={16} /> Talk to a person</button>}
              {needsEmail && (
                <form className="chat-email" onSubmit={saveEmail}>
                  <input type="email" required value={emailInput} onChange={(e) => setEmailInput(e.target.value)} placeholder="Add your email to get the reply if you leave" aria-label="Your email" />
                  <button className="btn btn-ghost btn-sm">Save</button>
                </form>
              )}
              {error && <p className="chat-error" role="alert">{error}</p>}

              {status === "closed" ? (
                <div className="chat-closed"><p>This chat has ended.</p><button className="btn btn-primary btn-sm" onClick={newChat}>Start a new chat</button></div>
              ) : (
                <form className="chat-compose" onSubmit={(e) => { e.preventDefault(); send(text); }}>
                  <textarea rows={1} value={text} onChange={(e) => setText(e.target.value)} placeholder="Type your message…" maxLength={2000} aria-label="Message"
                    onKeyDown={(e) => { if (e.key === "Enter" && !e.shiftKey) { e.preventDefault(); send(text); } }} />
                  <button className="chat-send" disabled={!text.trim()} aria-label="Send"><IconSend size={18} /></button>
                </form>
              )}
              {status !== "closed" && <button className="chat-end" onClick={endChat}>End chat</button>}
            </>
          )}
        </section>
      )}
    </>
  );
}
