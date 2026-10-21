import { useEffect, useRef, useState } from "react";
import { useNavigate } from "react-router-dom";
import { useRealtime } from "../realtime/Realtime.jsx";
import { timeAgo } from "../api/client.js";
import { IconBell } from "./Icons.jsx";

export default function NotificationBell() {
  const { items, unread, markAllRead } = useRealtime();
  const navigate = useNavigate();
  const [open, setOpen] = useState(false);
  const ref = useRef(null);

  useEffect(() => {
    if (!open) return undefined;
    const close = (e) => { if (!ref.current?.contains(e.target)) setOpen(false); };
    const esc = (e) => { if (e.key === "Escape") setOpen(false); };
    document.addEventListener("mousedown", close);
    document.addEventListener("keydown", esc);
    return () => { document.removeEventListener("mousedown", close); document.removeEventListener("keydown", esc); };
  }, [open]);

  const go = (n) => { setOpen(false); if (n.link?.startsWith("/")) navigate(n.link); };

  return (
    <div className="bell" ref={ref}>
      <button className="icon-btn" onClick={() => setOpen(!open)} aria-expanded={open} aria-haspopup="dialog"
              aria-label={unread ? `Notifications, ${unread} unread` : "Notifications"}>
        <IconBell size={19} />
        {unread > 0 && <span className="bell-count">{unread > 9 ? "9+" : unread}</span>}
      </button>
      {open && (
        <div className="popover" role="dialog" aria-label="Notifications">
          <div className="popover-head">
            <span>Notifications</span>
            {unread > 0 && <button className="link-btn small" onClick={markAllRead}>Mark all as read</button>}
          </div>
          {items.length === 0 ? (
            <p className="popover-empty">You are all caught up.</p>
          ) : (
            <ul>
              {items.slice(0, 12).map((n, i) => (
                <li key={n.id ?? i} className={n.is_read ? "" : "unread"}>
                  <button className="note-btn" onClick={() => go(n)}>
                    <strong>{n.title}</strong>
                    {n.body && <span className="clamp-1">{n.body}</span>}
                    {n.created_at && <span className="faint small">{timeAgo(n.created_at)}</span>}
                  </button>
                </li>
              ))}
            </ul>
          )}
        </div>
      )}
    </div>
  );
}
