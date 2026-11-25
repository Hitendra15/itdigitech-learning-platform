import { useMemo, useState } from "react";
import { Link } from "react-router-dom";
import { useAuth } from "../auth/AuthContext.jsx";
import { CourseCover } from "../components/ui.jsx";
import { IconArrowRight, IconCheck } from "../components/Icons.jsx";
import { rupees } from "../api/client.js";
import { useOffer } from "./SiteContext.jsx";

export function SectionHead({ eyebrow, title, lead, center = true }) {
  if (!title && !lead) return null;
  return (
    <header className={`sec-head ${center ? "center" : ""}`}>
      {eyebrow && <span className="eyebrow">{eyebrow}</span>}
      {title && <h2>{title}</h2>}
      {lead && <p className="lead">{lead}</p>}
    </header>
  );
}

export function CourseTile({ c }) {
  return (
    <li className="c-tile">
      <CourseCover title={c.title} level={c.level} />
      <div className="c-tile-body">
        <h3>{c.title}</h3>
        <p className="clamp">{c.description}</p>
        <Link className="link-arrow" to="/pricing">See plans <IconArrowRight size={16} /></Link>
      </div>
    </li>
  );
}

export const discounted = (price, offer) => (offer ? Math.round(Number(price) * (1 - offer.percent / 100)) : null);

export function IncludedGrid({ items = [] }) {
  if (!items.length) return null;
  return (
    <div className="included">
      <h3>Included in every plan</h3>
      <ul>{items.map((t) => <li key={t}><IconCheck size={16} /><span>{t}</span></li>)}</ul>
    </div>
  );
}

/** Plan cards. Prices always come from billing; a discount is shown only while a coupon-backed promotion is live. */
export function PlanCards({ plans }) {
  const { user } = useAuth();
  const offer = useOffer();
  const [want, setWant] = useState("all");
  const titles = useMemo(() => [...new Set(plans.flatMap((p) => p.courses.map((c) => c.title)))], [plans]);
  const max = Math.max(...plans.map((p) => p.courses.length));
  const best = plans.length > 1 ? plans.find((p) => p.courses.length === max)?.id : null;
  const shown = want === "all" ? plans : plans.filter((p) => p.courses.some((c) => c.title === want));

  return (
    <>
      {titles.length > 1 && (
        <div className="want">
          <label htmlFor="want">I want to learn</label>
          <select id="want" value={want} onChange={(e) => setWant(e.target.value)}>
            <option value="all">Show all plans</option>
            {titles.map((t) => <option key={t} value={t}>{t}</option>)}
          </select>
        </div>
      )}
      <ul className="plans">
        {shown.map((p) => {
          const price = Number(p.price);
          const off = discounted(price, offer);
          return (
            <li key={p.id} className={`plan-card ${p.id === best ? "best" : ""}`}>
              {p.id === best && <span className="plan-flag">Best value</span>}
              {offer && <span className="plan-off">{offer.percent}% off</span>}
              <h3>{p.name}</h3>
              <p className="plan-tag">{p.courses.length === 1 ? "A complete course with practice and certificate." : `${p.courses.length} courses bundled together.`}</p>
              <p className="plan-price">
                {off != null && <s>{rupees(price)}</s>}
                <strong>{rupees(off ?? price)}</strong><span>one-time + GST</span>
              </p>
              <p className="plan-note">
                {off != null ? <>With code <b>{offer.code}</b> at checkout. </> : null}
                {p.validity_days ? `${p.validity_days} days of access.` : "Lifetime access."}
              </p>
              <Link className={`btn btn-block ${p.id === best ? "btn-primary" : "btn-ghost"}`} to={user ? "/plans" : "/register"}>Choose {p.name}</Link>
              <ul className="plan-feat">
                <li><IconCheck size={16} /><span><b>{p.courses.length}</b> {p.courses.length === 1 ? "course" : "courses"}</span></li>
                {p.courses.map((c) => <li key={c.slug ?? c.title} className="sub">{c.title}</li>)}
                <li><IconCheck size={16} /><span>Code lab practice</span></li>
                <li><IconCheck size={16} /><span>Verified certificate</span></li>
              </ul>
            </li>
          );
        })}
      </ul>
      {shown.length === 0 && <p className="center muted">No plan includes that course yet.</p>}
    </>
  );
}

export function CompareTable({ plans }) {
  const courses = useMemo(() => [...new Set(plans.flatMap((p) => p.courses.map((c) => c.title)))], [plans]);
  const rows = [
    ["Access", (p) => (p.validity_days ? `${p.validity_days} days` : "Lifetime")],
    ["Price (excl. GST)", (p) => rupees(p.price)],
    ...courses.map((t) => [t, (p) => (p.courses.some((c) => c.title === t) ? <IconCheck size={18} className="ok" aria-label="Included" /> : <span className="dash" aria-label="Not included">—</span>)]),
    ["Code lab practice", () => <IconCheck size={18} className="ok" aria-label="Included" />],
    ["Timed tests and scores", () => <IconCheck size={18} className="ok" aria-label="Included" />],
    ["Verified certificate", () => <IconCheck size={18} className="ok" aria-label="Included" />],
  ];
  return (
    <div className="compare" id="compare">
      <div className="compare-scroll">
        <table>
          <thead><tr><th scope="col"><span className="sr-only">Feature</span></th>{plans.map((p) => <th scope="col" key={p.id}>{p.name}</th>)}</tr></thead>
          <tbody>{rows.map(([label, fn], i) => <tr key={label} className={i < 2 ? "head" : ""}><th scope="row">{label}</th>{plans.map((p) => <td key={p.id}>{fn(p)}</td>)}</tr>)}</tbody>
        </table>
      </div>
    </div>
  );
}
