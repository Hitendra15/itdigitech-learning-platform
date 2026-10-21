import { Link } from "react-router-dom";

export default function Brand({ light, to = "/" }) {
  return (
    <Link to={to} className={`brand ${light ? "brand-light" : ""}`} aria-label="IT DigiTech Learn home">
      <span className="brand-mark" aria-hidden>
        <svg width="17" height="17" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.6" strokeLinecap="round" strokeLinejoin="round"><path d="m8 7-5 5 5 5M16 7l5 5-5 5" /></svg>
      </span>
      <span className="brand-name">IT DigiTech<small>Learn</small></span>
    </Link>
  );
}
