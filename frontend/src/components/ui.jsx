import { useId, useState } from "react";
import { IconWarn, IconCheck, IconInfo, IconChevron, IconEye, IconEyeOff, IconSearch } from "./Icons.jsx";

// Circular progress used on the dashboard and test results.
export function ProgressRing({ value = 0, size = 64, stroke = 7, label, tone = "primary" }) {
  const r = (size - stroke) / 2;
  const c = 2 * Math.PI * r;
  const pct = Math.max(0, Math.min(100, value));
  return (
    <div className={`ring ring-${tone}`} style={{ width: size, height: size }} role="img" aria-label={`${pct}% complete`}>
      <svg width={size} height={size} viewBox={`0 0 ${size} ${size}`}>
        <circle className="ring-track" cx={size / 2} cy={size / 2} r={r} strokeWidth={stroke} fill="none" />
        <circle className="ring-fill" cx={size / 2} cy={size / 2} r={r} strokeWidth={stroke} fill="none"
                strokeLinecap="round" strokeDasharray={c} strokeDashoffset={c - (c * pct) / 100}
                transform={`rotate(-90 ${size / 2} ${size / 2})`} />
      </svg>
      <span className="ring-label">{label ?? `${pct}%`}</span>
    </div>
  );
}

// Deterministic cover art for a course, built from its title (no image uploads needed).
const COVERS = [
  ["#146ef5", "#0d0e32", "#e9edff"],
  ["#293c8b", "#0d0e32", "#cfd8ff"],
  ["#0f58c7", "#1e2052", "#d2e1ff"],
  ["#1e2052", "#146ef5", "#fdd261"],
  ["#0d0e32", "#293c8b", "#e9edff"],
];
const hash = (s = "") => [...s].reduce((a, ch) => (a * 31 + ch.charCodeAt(0)) >>> 0, 7);

export function CourseCover({ title = "", level }) {
  const [a, b, c] = COVERS[hash(title) % COVERS.length];
  const initials = title.split(/\s+/).filter(Boolean).slice(0, 2).map((w) => w[0]).join("").toUpperCase();
  return (
    <div className="cover" style={{ "--c1": a, "--c2": b, "--c3": c }} aria-hidden>
      <span className="cover-glyph">{initials || "IT"}</span>
      {level && <span className="cover-level">{level}</span>}
    </div>
  );
}

export function Alert({ type = "error", children }) {
  const Icon = type === "ok" ? IconCheck : type === "info" ? IconInfo : IconWarn;
  return (
    <div className={`alert alert-${type}`} role={type === "error" ? "alert" : "status"}>
      <Icon size={18} />
      <div>{children}</div>
    </div>
  );
}

export function Spinner({ label = "Loading…" }) {
  return (
    <div className="loading" role="status">
      <span className="spinner" aria-hidden />
      <span>{label}</span>
    </div>
  );
}

export function EmptyState({ title, children, action }) {
  return (
    <div className="empty">
      <h2>{title}</h2>
      <p>{children}</p>
      {action}
    </div>
  );
}

export const initialsOf = (name = "") =>
  name.split(/\s+/).filter(Boolean).slice(0, 2).map((w) => w[0]).join("").toUpperCase() || "U";

export const durationLabel = (sec) => {
  if (!sec) return "";
  const m = Math.round(sec / 60);
  return m >= 60 ? `${Math.floor(m / 60)}h ${m % 60}m` : `${m} min`;
};

// ---------- additions used by auth, support and the admin console ----------

export function Skeleton({ lines = 3, height = 14 }) {
  return (
    <div className="skeleton" aria-hidden>
      {Array.from({ length: lines }).map((_, i) => <span key={i} style={{ height, width: `${100 - (i % 3) * 18}%` }} />)}
    </div>
  );
}

const TONES = {
  paid: "good", captured: "good", active: "good", resolved: "good", sent: "good", done: "good", published: "good", passed: "good",
  failed: "bad", suspended: "bad", urgent: "bad", expired: "bad", revoked: "bad", refunded: "bad",
  created: "warn", pending_payment: "warn", open: "warn", high: "warn", waiting_on_student: "info", queued: "warn",
  in_progress: "info", normal: "neutral", low: "neutral", closed: "neutral", draft: "neutral", submitted: "neutral",
};
export function StatusPill({ value, label }) {
  const v = String(value ?? "").toLowerCase();
  const text = label ?? v.replace(/_/g, " ");
  return <span className={`pill pill-${TONES[v] ?? "neutral"}`}>{text}</span>;
}

export function PageHead({ title, lead, actions }) {
  return (
    <header className="page-head">
      <div><h1>{title}</h1>{lead && <p className="lead">{lead}</p>}</div>
      {actions && <div className="row gap wrap">{actions}</div>}
    </header>
  );
}

export function SearchBox({ value, onChange, placeholder = "Search" }) {
  return (
    <label className="searchbox">
      <IconSearch size={18} />
      <span className="sr-only">{placeholder}</span>
      <input type="search" value={value} onChange={(e) => onChange(e.target.value)} placeholder={placeholder} />
    </label>
  );
}

export function Pager({ page, count, pageSize = 20, onPage }) {
  const pages = Math.max(1, Math.ceil(count / pageSize));
  if (pages <= 1) return count ? <div className="pager"><span className="muted small">{count} total</span></div> : null;
  return (
    <nav className="pager" aria-label="Pagination">
      <span className="muted small">{(page - 1) * pageSize + 1}–{Math.min(page * pageSize, count)} of {count}</span>
      <div className="row gap">
        <button className="btn btn-ghost btn-sm" disabled={page <= 1} onClick={() => onPage(page - 1)}>Previous</button>
        <span className="small">Page {page} of {pages}</span>
        <button className="btn btn-ghost btn-sm" disabled={page >= pages} onClick={() => onPage(page + 1)}>Next</button>
      </div>
    </nav>
  );
}

export function StatCard({ label, value, hint, tone }) {
  return (
    <div className={`stat ${tone ? `stat-${tone}` : ""}`}>
      <span className="stat-label">{label}</span>
      <strong className="stat-value">{value}</strong>
      {hint && <span className="stat-hint">{hint}</span>}
    </div>
  );
}

export function Accordion({ items }) {
  const [open, setOpen] = useState(null);
  return (
    <div className="faq">
      {items.map((f) => (
        <div key={f.id} className={`faq-item ${open === f.id ? "open" : ""}`}>
          <button className="faq-q" aria-expanded={open === f.id} onClick={() => setOpen(open === f.id ? null : f.id)}>
            <span>{f.question}</span><IconChevron size={18} />
          </button>
          {open === f.id && <div className="faq-a">{f.answer}</div>}
        </div>
      ))}
    </div>
  );
}

// Password input with show/hide and an optional strength meter.
export function scorePassword(pw = "") {
  let s = 0;
  if (pw.length >= 8) s++;
  if (pw.length >= 12) s++;
  if (/[a-z]/.test(pw) && /[A-Z]/.test(pw)) s++;
  if (/\d/.test(pw)) s++;
  if (/[^A-Za-z0-9]/.test(pw)) s++;
  return Math.min(4, s);
}
const STRENGTH = ["Too short", "Weak", "Fair", "Good", "Strong"];

export function PasswordField({ label, value, onChange, autoComplete = "new-password", meter = false, hint, id: idProp, required = true, labelExtra, placeholder }) {
  const auto = useId();
  const id = idProp || auto;
  const [show, setShow] = useState(false);
  const score = scorePassword(value);
  return (
    <div className="field">
      <div className="label-row"><label htmlFor={id}>{label}</label>{labelExtra}</div>
      <div className="pw">
        <input id={id} type={show ? "text" : "password"} required={required} minLength={autoComplete === "current-password" ? undefined : 8} autoComplete={autoComplete} placeholder={placeholder}
               value={value} onChange={(e) => onChange(e.target.value)} />
        <button type="button" className="pw-toggle" onClick={() => setShow(!show)} aria-label={show ? "Hide password" : "Show password"} aria-pressed={show}>
          {show ? <IconEyeOff size={18} /> : <IconEye size={18} />}
        </button>
      </div>
      {meter && value && (
        <div className="meter" aria-live="polite">
          <div className="meter-bars">{[1, 2, 3, 4].map((n) => <span key={n} className={score >= n ? `on on-${score}` : ""} />)}</div>
          <span className="small muted">{STRENGTH[score]}</span>
        </div>
      )}
      {hint && <span className="hint">{hint}</span>}
    </div>
  );
}
