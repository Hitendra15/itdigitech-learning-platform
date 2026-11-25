import { useEffect, useRef, useState } from "react";
import { Link, NavLink, Outlet, useLocation } from "react-router-dom";
import { useAuth } from "../auth/AuthContext.jsx";
import { IconChevronDown, IconMail, IconMapPin, IconMenu, IconPhone, IconX } from "../components/Icons.jsx";
import { PromoBar } from "./PromoBanner.jsx";
import { usePromo, useSite } from "./SiteContext.jsx";
import { openChat } from "./config.js";

// Navigation is product structure (routes that exist), not marketing copy, so it stays in code.
const GROUPS = [
  { label: "Courses", items: [
    { to: "/courses", title: "All courses", text: "Python, Java, web development and more" },
    { to: "/pricing", title: "Plans and pricing", text: "Bundle courses and save" },
  ] },
  { label: "Code Lab", items: [
    { to: "/lab", title: "Free code lab", text: "Run code in your browser, no sign-up", badge: "Free" },
    { to: "/courses", title: "Practice lessons", text: "An editor inside every practice lesson" },
  ] },
  { label: "Certificates", items: [
    { to: "/verify", title: "Verify a certificate", text: "Check any certificate ID" },
  ] },
  { label: "Support", items: [
    { to: "/contact#faq", title: "Knowledge base", text: "Instant answers and solutions" },
    { chat: true, title: "Live chat", text: "Chat with our assistant or support team" },
    { to: "/contact", title: "Contact us", text: "Reach our support team" },
  ] },
];

function Logo() {
  const { profile } = useSite();
  return (
    <Link to="/" className="logo" aria-label={`${profile.brand_name} home`}>
      <span className="logo-mark" aria-hidden><svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.6" strokeLinecap="round" strokeLinejoin="round"><path d="m8 7-5 5 5 5M16 7l5 5-5 5" /></svg></span>
      <span className="logo-text"><b>{profile.brand_name}</b>{profile.tagline && <small>{profile.tagline}</small>}</span>
    </Link>
  );
}

function Dropdown({ group }) {
  const [open, setOpen] = useState(false);
  const ref = useRef(null);
  useEffect(() => {
    if (!open) return undefined;
    const off = (e) => { if (!ref.current?.contains(e.target)) setOpen(false); };
    const esc = (e) => { if (e.key === "Escape") setOpen(false); };
    document.addEventListener("mousedown", off); document.addEventListener("keydown", esc);
    return () => { document.removeEventListener("mousedown", off); document.removeEventListener("keydown", esc); };
  }, [open]);
  return (
    <div className={`dd ${open ? "open" : ""}`} ref={ref} onMouseEnter={() => setOpen(true)} onMouseLeave={() => setOpen(false)}>
      <button className="nav-link" aria-expanded={open} aria-haspopup="true" onClick={() => setOpen(!open)}>{group.label} <IconChevronDown size={16} /></button>
      <div className="dd-panel">
        {group.items.map((it) => {
          const inner = <><span className="dd-title">{it.title}{it.badge && <em>{it.badge}</em>}</span><small>{it.text}</small></>;
          return it.chat
            ? <button key={it.title} onClick={() => { setOpen(false); openChat(); }}>{inner}</button>
            : <Link key={it.title} to={it.to} onClick={() => setOpen(false)}>{inner}</Link>;
        })}
      </div>
    </div>
  );
}

function Header() {
  const { user } = useAuth();
  const [open, setOpen] = useState(false);
  const { pathname } = useLocation();
  useEffect(() => { setOpen(false); }, [pathname]);
  const home = user ? (user.role === "admin" ? "/console" : user.status === "active" ? "/dashboard" : "/plans") : "/login";
  return (
    <header className="site-header">
      <div className="header-in">
        <Logo />
        <nav className={`nav-main ${open ? "open" : ""}`} aria-label="Main">
          {GROUPS.map((g) => <Dropdown key={g.label} group={g} />)}
          <NavLink className="nav-link" to="/pricing">Pricing</NavLink>
          <div className="nav-m">
            {GROUPS.flatMap((g) => g.items).filter((i) => i.to).map((i) => <Link key={i.title} className="nav-link" to={i.to}>{i.title}</Link>)}
            {!user && <Link className="nav-link" to="/login">Sign in</Link>}
          </div>
        </nav>
        <div className="header-actions">
          {!user && <Link className="nav-link hide-sm" to={home}>Sign in</Link>}
          <Link className="btn btn-primary" to={user ? home : "/register"}>{user ? "Dashboard" : "Get started"}</Link>
          <button className="icon-btn burger" onClick={() => setOpen(!open)} aria-expanded={open} aria-label={open ? "Close menu" : "Open menu"}>{open ? <IconX /> : <IconMenu />}</button>
        </div>
      </div>
    </header>
  );
}

function Footer() {
  const { profile: p } = useSite();
  return (
    <footer className="site-footer">
      <div className="site-wrap foot-top">
        <div className="foot-brand">
          <Logo />
          {p.about && <p>{p.about}</p>}
          <ul className="foot-contact">
            {p.email && <li><IconMail size={16} /> <a href={`mailto:${p.email}`}>{p.email}</a></li>}
            {p.phone && <li><IconPhone size={16} /> {p.phone}</li>}
            {p.address && <li><IconMapPin size={16} /> {p.address}</li>}
          </ul>
          {p.payment_methods?.length > 0 && <p className="pay" aria-label="Payment methods">{p.payment_methods.map((m) => <span key={m.text}>{m.text}</span>)}</p>}
        </div>
        <nav aria-label="Courses"><h4>Courses</h4><Link to="/courses">All courses</Link><Link to="/pricing">Plans and pricing</Link><Link to="/lab">Free code lab</Link><Link to="/register">Create account</Link></nav>
        <nav aria-label="Certificates"><h4>Certificates</h4><Link to="/verify">Verify a certificate</Link></nav>
        <nav aria-label="Support"><h4>Support</h4><Link to="/contact">Contact us</Link><button onClick={openChat}>Live chat</button><Link to="/contact#faq">Knowledge base</Link><Link to="/forgot-password">Reset password</Link>
          {p.privacy_url && <a href={p.privacy_url}>Privacy policy</a>}{p.terms_url && <a href={p.terms_url}>Terms of service</a>}</nav>
      </div>
      <div className="foot-bar"><div className="site-wrap">
        <span>© {new Date().getFullYear()} {p.legal_name || p.brand_name}.{p.registration ? ` Company registration no. ${p.registration}.` : ""}{p.gstin ? ` GSTIN ${p.gstin}.` : ""}</span>
        {p.footer_note && <span>{p.footer_note}</span>}
      </div></div>
    </footer>
  );
}

export default function PublicLayout() {
  const { pathname, hash } = useLocation();
  const bar = usePromo("top_bar");
  useEffect(() => {
    if (hash) setTimeout(() => document.getElementById(hash.slice(1))?.scrollIntoView({ behavior: "smooth" }), 50);
    else window.scrollTo({ top: 0 });
  }, [pathname, hash]);
  return (
    <div className="site">
      <a className="skip-link" href="#main">Skip to content</a>
      {bar && <PromoBar promo={bar} />}
      <Header />
      <main id="main"><Outlet /></main>
      <Footer />
    </div>
  );
}
