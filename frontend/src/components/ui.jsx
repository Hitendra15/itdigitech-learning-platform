import { useId, useState } from "react";
import { IconWarn, IconCheck, IconInfo, IconChevron, IconEye, IconEyeOff, IconSearch } from "./Icons.jsx";

// ---------- progress ----------
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
      <span className="ring-label" style={size < 48 ? { fontSize: ".6875rem" } : size > 90 ? { fontSize: "1.375rem" } : undefined}>{label ?? `${pct}%`}</span>
    </div>
  );
}

// ---------- course cover art ----------
// Generated from the title so every course looks distinct without uploading images.
const HUES = {
  indigo: ["#18235c", "#5b82ff", "#c7d6ff"],
  teal: ["#0b3532", "#2fc08b", "#b6f0d8"],
  amber: ["#43260a", "#f2a516", "#ffe0a3"],
  plum: ["#331a4d", "#b57cf5", "#e6d0ff"],
  coral: ["#47191a", "#f2766b", "#ffd0cb"],
  sky: ["#0f2f46", "#4cb3e8", "#c9ecff"],
};
const NAMES = Object.keys(HUES);
const TOPICS = [[/python/i, "amber"], [/java\b|java /i, "coral"], [/react|web|html|css|javascript/i, "sky"], [/sql|data ?base/i, "teal"], [/git/i, "plum"], [/structure|algorithm|dsa/i, "indigo"]];
const hash = (s = "") => [...s].reduce((a, ch) => (a * 31 + ch.charCodeAt(0)) >>> 0, 7);

function Pattern({ kind, a, b }) {
  switch (kind) {
    case 0: // quarter-circle tiles
      return <g>{Array.from({ length: 4 }).flatMap((_, y) => Array.from({ length: 7 }).map((__, x) => {
        const i = (x * 3 + y * 5) % 4; const px = x * 60 - 20; const py = y * 60 - 30;
        return i === 0 ? <path key={`${x}${y}`} d={`M${px} ${py + 60}a60 60 0 0 1 60 -60v60z`} fill={a} opacity=".9" />
          : i === 1 ? <circle key={`${x}${y}`} cx={px + 30} cy={py + 30} r="14" fill={b} />
          : i === 2 ? <rect key={`${x}${y}`} x={px + 8} y={py + 8} width="44" height="44" rx="6" fill="none" stroke={a} strokeWidth="2" opacity=".6" />
          : null;
      }))}</g>;
    case 1: // rising bars
      return <g>{Array.from({ length: 11 }).map((_, i) => { const h = 40 + ((i * 37) % 90); return <rect key={i} x={14 + i * 30} y={180 - h} width="20" height={h} rx="4" fill={i % 3 === 0 ? b : a} opacity={i % 3 === 0 ? 1 : .85} />; })}</g>;
    case 2: // concentric arcs
      return <g fill="none">{[28, 52, 76, 100, 124, 148].map((r, i) => <circle key={r} cx="250" cy="150" r={r} stroke={i % 2 ? b : a} strokeWidth={i % 2 ? 2 : 10} opacity={i % 2 ? .7 : .9} />)}<circle cx="250" cy="150" r="12" fill={b} stroke="none" /></g>;
    case 3: // diagonal stripes + sun
      return <g><circle cx="238" cy="62" r="40" fill={b} />{Array.from({ length: 14 }).map((_, i) => <path key={i} d={`M${-40 + i * 34} 190L${40 + i * 34} -10`} stroke={a} strokeWidth="9" opacity=".75" />)}</g>;
    case 4: // dot matrix
      return <g>{Array.from({ length: 6 }).flatMap((_, y) => Array.from({ length: 12 }).map((__, x) => <circle key={`${x}${y}`} cx={20 + x * 27} cy={22 + y * 27} r={(x * 7 + y * 11) % 9 === 0 ? 8 : 3} fill={(x * 7 + y * 11) % 9 === 0 ? b : a} opacity={(x * 7 + y * 11) % 9 === 0 ? 1 : .7} />))}</g>;
    default: // staircase
      return <g>{Array.from({ length: 7 }).map((_, i) => <rect key={i} x={20 + i * 40} y={150 - i * 20} width="40" height={30 + i * 20} fill={i % 2 ? a : b} opacity={i % 2 ? .85 : .95} />)}</g>;
  }
}

export function CourseCover({ title = "", level, className = "" }) {
  const h = hash(title);
  const topic = TOPICS.find(([re]) => re.test(title));
  const [bg, a, b] = HUES[topic ? topic[1] : NAMES[h % NAMES.length]];
  return (
    <div className={`cover ${className}`} aria-hidden>
      <svg viewBox="0 0 320 180" preserveAspectRatio="xMidYMid slice"><rect width="320" height="180" fill={bg} /><Pattern kind={(h >> 3) % 6} a={a} b={b} /></svg>
      {level && <span className="cover-level">{level}</span>}
    </div>
  );
}

// ---------- feedback ----------
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

export function EmptyState({ title, children, action, icon: Icon }) {
  return (
    <div className="empty">
      {Icon && <span className="empty-ico"><Icon size={22} /></span>}
      <h2>{title}</h2>
      <p>{children}</p>
      {action}
    </div>
  );
}

export function Skeleton({ lines = 3, height = 14 }) {
  return (
    <div className="skeleton" aria-hidden>
      {Array.from({ length: lines }).map((_, i) => <span key={i} style={{ height, width: `${100 - (i % 3) * 18}%` }} />)}
    </div>
  );
}

// ---------- helpers ----------
export const initialsOf = (name = "") =>
  name.split(/\s+/).filter(Boolean).slice(0, 2).map((w) => w[0]).join("").toUpperCase() || "U";

export const durationLabel = (sec) => {
  if (!sec) return "";
  const m = Math.round(sec / 60);
  return m >= 60 ? `${Math.floor(m / 60)}h ${m % 60}m` : `${m} min`;
};

const TONES = {
  paid: "good", captured: "good", active: "good", resolved: "good", sent: "good", done: "good", published: "good", passed: "good", success: "good",
  failed: "bad", suspended: "bad", urgent: "bad", expired: "bad", revoked: "bad", refunded: "bad",
  created: "warn", pending_payment: "warn", open: "warn", high: "warn", queued: "warn",
  waiting_on_student: "info", in_progress: "info",
  normal: "neutral", low: "neutral", closed: "neutral", draft: "neutral", submitted: "neutral",
};
export function StatusPill({ value, label }) {
  const v = String(value ?? "").toLowerCase();
  const raw = v.replace(/_/g, " ");
  const text = label ?? raw.charAt(0).toUpperCase() + raw.slice(1);
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
        <span className="small muted">Page {page} of {pages}</span>
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

// ---------- password ----------
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
        <input id={id} type={show ? "text" : "password"} required={required} minLength={autoComplete === "current-password" ? undefined : 8}
               autoComplete={autoComplete} placeholder={placeholder} value={value} onChange={(e) => onChange(e.target.value)} />
        <button type="button" className="pw-toggle" onClick={() => setShow(!show)} aria-label={show ? "Hide password" : "Show password"} aria-pressed={show}>
          {show ? <IconEyeOff size={18} /> : <IconEye size={18} />}
        </button>
      </div>
      {meter && value && (
        <div className="meter" aria-live="polite">
          <div className="meter-bars">{[1, 2, 3, 4].map((n) => <span key={n} className={score >= n ? `on-${score}` : ""} />)}</div>
          <span className="small muted">{STRENGTH[score]}</span>
        </div>
      )}
      {hint && <span className="hint">{hint}</span>}
    </div>
  );
}
