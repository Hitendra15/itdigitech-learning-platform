import { useEffect, useRef, useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { useAuth } from "../auth/AuthContext.jsx";
import { initialsOf } from "./ui.jsx";
import { IconChevronDown, IconLogout } from "./Icons.jsx";

export default function UserMenu({ links = [] }) {
  const { user, logout } = useAuth();
  const navigate = useNavigate();
  const [open, setOpen] = useState(false);
  const ref = useRef(null);
  const name = user.profile?.full_name || user.email;

  useEffect(() => {
    if (!open) return undefined;
    const close = (e) => { if (!ref.current?.contains(e.target)) setOpen(false); };
    const esc = (e) => { if (e.key === "Escape") setOpen(false); };
    document.addEventListener("mousedown", close);
    document.addEventListener("keydown", esc);
    return () => { document.removeEventListener("mousedown", close); document.removeEventListener("keydown", esc); };
  }, [open]);

  return (
    <div className="umenu" ref={ref}>
      <button className="umenu-btn" onClick={() => setOpen(!open)} aria-expanded={open} aria-haspopup="menu" aria-label="Account menu">
        <span className="avatar" aria-hidden>{initialsOf(name)}</span>
        <IconChevronDown size={16} className="faint" />
      </button>
      {open && (
        <div className="popover umenu-pop" role="menu">
          <div className="menu-head"><strong>{name}</strong><span>{user.email}</span></div>
          <div className="menu-list">
            {links.map(({ to, label, Icon }) => (
              <Link key={to} to={to} className="menu-item" role="menuitem" onClick={() => setOpen(false)}><Icon size={17} /> {label}</Link>
            ))}
            {links.length > 0 && <div className="menu-sep" />}
            <button className="menu-item danger" role="menuitem" onClick={async () => { setOpen(false); await logout(); navigate("/login"); }}>
              <IconLogout size={17} /> Sign out
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
