import { useEffect, useRef } from "react";
import { IconX } from "./Icons.jsx";

const FOCUSABLE = 'a[href],button:not([disabled]),input:not([disabled]),select:not([disabled]),textarea:not([disabled]),[tabindex]:not([tabindex="-1"])';

export default function Modal({ open, title, onClose, children, footer, size = "md", busy = false }) {
  const ref = useRef(null);
  const returnTo = useRef(null);
  // Parents pass a brand-new onClose function on every render. If the effect below depended on it, it would
  // re-run after every keystroke and keep pulling focus back to the first field. So we read the latest
  // values from refs and let the effect depend on "open" only.
  const onCloseRef = useRef(onClose);
  const busyRef = useRef(busy);
  onCloseRef.current = onClose;
  busyRef.current = busy;

  useEffect(() => {
    if (!open) return undefined;
    returnTo.current = document.activeElement;
    document.body.style.overflow = "hidden";
    const el = ref.current;
    // Move focus into the dialog once, when it opens.
    (el?.querySelector("[data-autofocus]") || el?.querySelector("input,select,textarea") || el?.querySelector(FOCUSABLE))?.focus();
    const key = (e) => {
      if (e.key === "Escape" && !busyRef.current) onCloseRef.current?.();
      if (e.key === "Tab" && el) {
        const nodes = [...el.querySelectorAll(FOCUSABLE)];
        if (!nodes.length) return;
        const first = nodes[0], last = nodes[nodes.length - 1];
        if (e.shiftKey && document.activeElement === first) { e.preventDefault(); last.focus(); }
        else if (!e.shiftKey && document.activeElement === last) { e.preventDefault(); first.focus(); }
      }
    };
    document.addEventListener("keydown", key);
    return () => {
      document.removeEventListener("keydown", key);
      document.body.style.overflow = "";
      returnTo.current?.focus?.(); // give focus back to the button that opened the dialog
    };
  }, [open]);

  if (!open) return null;
  return (
    <div className="modal-scrim" onMouseDown={(e) => { if (e.target === e.currentTarget && !busy) onClose?.(); }}>
      <div className={`modal modal-${size}`} role="dialog" aria-modal="true" aria-label={title} ref={ref}>
        <header className="modal-head">
          <h2>{title}</h2>
          <button className="icon-btn" onClick={onClose} disabled={busy} aria-label="Close"><IconX /></button>
        </header>
        <div className="modal-body">{children}</div>
        {footer && <footer className="modal-foot">{footer}</footer>}
      </div>
    </div>
  );
}

export function Confirm({ open, title, children, confirmLabel = "Confirm", danger, busy, onConfirm, onCancel }) {
  return (
    <Modal open={open} title={title} onClose={onCancel} size="sm" busy={busy}
      footer={<>
        <button className="btn btn-ghost" onClick={onCancel} disabled={busy}>Cancel</button>
        <button className={`btn ${danger ? "btn-danger" : "btn-primary"}`} onClick={onConfirm} disabled={busy} data-autofocus>
          {busy ? "Working…" : confirmLabel}
        </button>
      </>}>
      <p>{children}</p>
    </Modal>
  );
}
