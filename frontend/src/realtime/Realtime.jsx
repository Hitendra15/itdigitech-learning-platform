import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState } from "react";
import api from "../api/client.js";
import { useAuth } from "../auth/AuthContext.jsx";
import { useToast } from "../components/Toast.jsx";

const Ctx = createContext(null);
export const useRealtime = () => useContext(Ctx);

/** Subscribe a component to live events for as long as it is mounted. */
export function useRealtimeEvent(handler) {
  const { subscribe } = useRealtime();
  const ref = useRef(handler);
  ref.current = handler;
  useEffect(() => subscribe((e) => ref.current(e)), [subscribe]);
}

// One WebSocket per tab, shared by notifications, support chat and the admin inbox.
export function RealtimeProvider({ children }) {
  const { user } = useAuth();
  const toast = useToast();
  const handlers = useRef(new Set());
  const [status, setStatus] = useState("off");
  const [items, setItems] = useState([]);
  const [unread, setUnread] = useState(0);
  const [supportUnread, setSupportUnread] = useState(0);
  const [staffUnread, setStaffUnread] = useState(0);
  const isStaff = user?.role === "admin";

  const subscribe = useCallback((fn) => { handlers.current.add(fn); return () => handlers.current.delete(fn); }, []);

  const refreshCounters = useCallback(async () => {
    if (!user) return;
    try {
      const { data } = await api.get("/support/unread");
      setSupportUnread(data.unread);
      if (isStaff) setStaffUnread((await api.get("/admin-api/tickets/counts")).data.unread);
    } catch { /* counters are best effort */ }
  }, [user, isStaff]);

  // history
  useEffect(() => {
    if (!user) { setItems([]); setUnread(0); return; }
    api.get("/my/notifications").then((r) => { setItems(r.data.results); setUnread(r.data.unread); }).catch(() => {});
    refreshCounters();
  }, [user?.id]); // eslint-disable-line react-hooks/exhaustive-deps

  // socket with auto-reconnect and a fresh one-time ticket every time
  useEffect(() => {
    if (!user) return undefined;
    let ws, timer, ping, tries = 0, closed = false;

    const schedule = () => { if (!closed) timer = setTimeout(connect, Math.min(30000, 1000 * 2 ** tries++)); };
    async function connect() {
      try {
        const { data } = await api.post("/auth/ws-ticket");
        const proto = window.location.protocol === "https:" ? "wss" : "ws";
        ws = new WebSocket(`${proto}://${window.location.host}/ws/notifications/?ticket=${data.ticket}`);
        ws.onopen = () => { tries = 0; setStatus("live"); ping = setInterval(() => ws.readyState === 1 && ws.send('{"type":"ping"}'), 30000); };
        ws.onmessage = (e) => {
          let d; try { d = JSON.parse(e.data); } catch { return; }
          if (d.kind === "pong") return;
          handlers.current.forEach((h) => h(d));
        };
        ws.onclose = () => { clearInterval(ping); setStatus("off"); schedule(); };
      } catch { setStatus("off"); schedule(); }
    }
    connect();
    return () => { closed = true; clearTimeout(timer); clearInterval(ping); ws?.close(); setStatus("off"); };
  }, [user?.id]); // eslint-disable-line react-hooks/exhaustive-deps

  // built-in handling for notifications + counters
  useEffect(() => subscribe((e) => {
    if (e.kind === "notification") {
      setItems((xs) => [{ ...e, id: e.id ?? crypto.randomUUID() }, ...xs].slice(0, 30));
      setUnread((n) => n + 1);
      toast.info(e.body || "", { title: e.title });
    } else if (e.kind === "ticket_message" && e.message && !e.message.is_internal_note) {
      if (e.message.is_staff_reply) setSupportUnread((n) => n + 1);
      else if (isStaff) setStaffUnread((n) => n + 1);
    } else if (e.kind === "ticket_new" && isStaff) {
      setStaffUnread((n) => n + 1);
      toast.info(e.subject, { title: `New request ${e.reference}` });
    } else if (e.kind === "ticket_update") {
      refreshCounters();
    }
  }), [subscribe, toast, isStaff, refreshCounters]);

  const markAllRead = async () => {
    setItems((xs) => xs.map((x) => ({ ...x, is_read: true }))); setUnread(0);
    try { await api.post("/my/notifications"); } catch { /* ignore */ }
  };

  const value = useMemo(() => ({
    status, subscribe, items, unread, markAllRead, supportUnread, staffUnread, refreshCounters,
  }), [status, subscribe, items, unread, supportUnread, staffUnread, refreshCounters]); // eslint-disable-line react-hooks/exhaustive-deps

  return <Ctx.Provider value={value}>{children}</Ctx.Provider>;
}
