import { createContext, useCallback, useContext, useMemo, useRef, useState } from "react";
import { IconCheck, IconInfo, IconWarn, IconX } from "./Icons.jsx";

const ToastContext = createContext(null);
export const useToast = () => useContext(ToastContext);

export function ToastProvider({ children }) {
  const [items, setItems] = useState([]);
  const seq = useRef(0);

  const dismiss = useCallback((id) => setItems((xs) => xs.filter((x) => x.id !== id)), []);
  const push = useCallback((type, text, opts = {}) => {
    const id = ++seq.current;
    setItems((xs) => [...xs.slice(-3), { id, type, text, ...opts }]);
    setTimeout(() => dismiss(id), opts.ms ?? (type === "error" ? 7000 : 4500));
  }, [dismiss]);

  const api = useMemo(() => ({
    success: (t, o) => push("ok", t, o),
    error: (t, o) => push("error", t, o),
    info: (t, o) => push("info", t, o),
  }), [push]);

  return (
    <ToastContext.Provider value={api}>
      {children}
      <div className="toasts" role="region" aria-label="Notifications" aria-live="polite">
        {items.map((t) => {
          const Icon = t.type === "ok" ? IconCheck : t.type === "info" ? IconInfo : IconWarn;
          return (
            <div key={t.id} className={`toast toast-${t.type}`} role={t.type === "error" ? "alert" : "status"}>
              <Icon size={18} />
              <div className="toast-text">{t.title && <strong>{t.title}</strong>}<span>{t.text}</span></div>
              <button className="toast-x" onClick={() => dismiss(t.id)} aria-label="Dismiss"><IconX size={16} /></button>
            </div>
          );
        })}
      </div>
    </ToastContext.Provider>
  );
}
