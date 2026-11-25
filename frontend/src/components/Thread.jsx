import { useEffect, useRef } from "react";
import { IconFile } from "./Icons.jsx";
import { fmtDate } from "../api/client.js";

// Chat-style conversation shared by the student view and the admin inbox.
export function Thread({ messages, viewer = "student" }) {
  const end = useRef(null);
  useEffect(() => { end.current?.scrollIntoView({ block: "end", behavior: "smooth" }); }, [messages.length]);

  let lastDay = "";
  return (
    <ol className="thread" aria-live="polite">
      {messages.map((m) => {
        const mine = viewer === "student" ? !m.is_staff_reply : m.is_staff_reply;
        const day = fmtDate(m.created_at);
        const sep = day !== lastDay;
        lastDay = day;
        return (
          <li key={m.id} className="thread-item">
            {sep && <div className="thread-day"><span>{day}</span></div>}
            <div className={`msg ${mine ? "mine" : "theirs"} ${m.is_internal_note ? "note" : ""}`}>
              <div className="msg-meta">
                <strong>{mine ? "You" : m.author}</strong>
                {m.is_internal_note && <span className="msg-tag">Internal note</span>}
                <time dateTime={m.created_at}>{new Date(m.created_at).toLocaleTimeString("en-IN", { hour: "numeric", minute: "2-digit" })}</time>
              </div>
              <p className="msg-body">{m.body}</p>
              {m.attachment && (
                <a className="msg-file" href={m.attachment} target="_blank" rel="noreferrer"><IconFile size={16} /> {m.attachment_name}</a>
              )}
            </div>
          </li>
        );
      })}
      <li ref={end} aria-hidden />
    </ol>
  );
}
