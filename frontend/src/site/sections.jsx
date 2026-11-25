import { createContext, useContext } from "react";
import { Accordion, Skeleton } from "../components/ui.jsx";
import { IconArrowRight, IconCheck, IconHeadset, IconShield, IconStar } from "../components/Icons.jsx";
import { useFetch } from "../hooks.js";
import { rupees } from "../api/client.js";
import { CompareTable, CourseTile, IncludedGrid, PlanCards, SectionHead, discounted } from "./shared.jsx";
import { PromoCard } from "./PromoBanner.jsx";
import SmartLink from "./SmartLink.jsx";
import { iconFor } from "./icons.js";
import { useOffer } from "./SiteContext.jsx";

// Live data for the sections that need it. Fetched once per page, and only if such a section is on the page.
const DataCtx = createContext({});
const useData = () => useContext(DataCtx);

const Tick = () => <IconCheck size={20} className="tick" strokeWidth={3} />;
const initials = (n = "") => n.split(/\s+/).filter(Boolean).slice(0, 2).map((w) => w[0]).join("").toUpperCase();

function Hero({ c }) {
  const { plans } = useData();
  const offer = useOffer();
  const cheapest = c.show_starting_price && plans?.data?.length ? Math.min(...plans.data.map((p) => Number(p.price))) : null;
  const off = cheapest != null ? discounted(cheapest, offer) : null;
  const media = c.image;
  return (
    <section className={`hero ${media ? "" : "no-media"}`}>
      <div className="site-wrap hero-grid">
        <div>
          {c.eyebrow && <span className="hero-chip">{c.eyebrow}</span>}
          <h1>{c.heading}</h1>
          {c.subheading && <p className="hero-sub">{c.subheading}</p>}
          {c.bullets?.length > 0 && <ul className="hero-points">{c.bullets.map((b) => <li key={b.text}><Tick /><span>{b.text}</span></li>)}</ul>}
          {(c.primary_cta_label || c.secondary_cta_label) && (
            <div className="hero-actions">
              {c.primary_cta_label && <SmartLink className="btn btn-primary btn-lg" to={c.primary_cta_url}>{c.primary_cta_label}</SmartLink>}
              {c.secondary_cta_label && <SmartLink className="btn btn-ghost btn-lg" to={c.secondary_cta_url}>{c.secondary_cta_label}</SmartLink>}
            </div>
          )}
          {cheapest != null && (
            <p className="hero-price">Plans from {off != null && <s>{rupees(cheapest)}</s>}<strong>{rupees(off ?? cheapest)}</strong> + GST{offer ? <> with code <b>{offer.code}</b></> : null}</p>
          )}
          {c.assurance && <p className="assurance"><IconShield size={18} /> {c.assurance}</p>}
        </div>
        {media && <div className="media-frame"><img src={media.url} alt={media.alt || ""} width={media.width || undefined} height={media.height || undefined} fetchpriority="high" /></div>}
      </div>
    </section>
  );
}

function Promo({ promotion }) {
  return <section className="promo-section"><div className="site-wrap"><PromoCard promo={promotion} /></div></section>;
}

function Stats({ c }) {
  return <section className="stats" aria-label="Key facts"><div className="site-wrap"><ul>{c.items.map((s) => <li key={s.label}><strong>{s.value}</strong><span>{s.label}</span></li>)}</ul></div></section>;
}

function Highlights({ c }) {
  return (
    <section className="section">
      <div className="site-wrap">
        <SectionHead title={c.heading} lead={c.lead} />
        <ul className="cards">{c.items.map((it) => { const Icon = iconFor(it.icon); return <li key={it.title} className="card"><span className="icon-box"><Icon size={22} /></span><h3>{it.title}</h3>{it.text && <p>{it.text}</p>}</li>; })}</ul>
      </div>
    </section>
  );
}

function Showcase({ c }) {
  const hasImages = c.items.some((it) => it.image); // without any images, alternating rows look empty: use a card grid instead
  return (
    <section className="section alt">
      <div className="site-wrap">
        <SectionHead title={c.heading} lead={c.lead} />
        {hasImages ? (
          <div className="rows">
            {c.items.map((it, i) => (
              <div key={it.title} className={`row-item ${i % 2 ? "flip" : ""} ${it.image ? "" : "text-only"}`}>
                <div>
                  {it.tag && <span className="chip-tag">{it.tag}</span>}
                  <h3>{it.title}</h3>
                  {it.text && <p>{it.text}</p>}
                  {it.cta_label && <SmartLink className="btn btn-ghost" to={it.cta_url}>{it.cta_label}</SmartLink>}
                </div>
                {it.image && <div className="media-frame"><img src={it.image.url} alt={it.image.alt || ""} width={it.image.width || undefined} height={it.image.height || undefined} loading="lazy" /></div>}
              </div>
            ))}
          </div>
        ) : (
          <ul className="cards">
            {c.items.map((it) => (
              <li key={it.title} className="card">
                {it.tag && <span className="chip-tag">{it.tag}</span>}
                <h3>{it.title}</h3>
                {it.text && <p>{it.text}</p>}
                {it.cta_label && <SmartLink className="link-arrow" to={it.cta_url}>{it.cta_label} <IconArrowRight size={16} /></SmartLink>}
              </li>
            ))}
          </ul>
        )}
      </div>
    </section>
  );
}

function Courses({ c }) {
  const { courses } = useData();
  if (courses.loading) return <section className="section"><div className="site-wrap"><Skeleton lines={3} height={90} /></div></section>;
  if (!courses.data?.length) return null; // nothing to show: no empty gap
  return (
    <section className="section">
      <div className="site-wrap">
        <SectionHead title={c.heading} lead={c.lead} />
        <ul className="c-grid">{courses.data.slice(0, c.limit || 6).map((x) => <CourseTile key={x.id} c={x} />)}</ul>
        {c.cta_label && <p className="center sec-more"><SmartLink className="btn btn-ghost btn-lg" to={c.cta_url}>{c.cta_label} <IconArrowRight size={16} /></SmartLink></p>}
      </div>
    </section>
  );
}

function Plans({ c }) {
  const { plans } = useData();
  if (plans.loading) return <section className="section alt" id="pricing"><div className="site-wrap"><Skeleton lines={3} height={140} /></div></section>;
  if (!plans.data?.length) return null;
  return (
    <section className="section alt" id="pricing">
      <div className="site-wrap">
        <SectionHead title={c.heading} lead={c.lead} />
        <PlanCards plans={plans.data} />
        {c.show_included && <IncludedGrid items={c.included?.map((i) => i.text)} />}
        {c.show_compare && plans.data.length > 1 && <CompareTable plans={plans.data} />}
      </div>
    </section>
  );
}

function Support({ c }) {
  return (
    <section className="section dark">
      <div className="site-wrap">
        <SectionHead title={c.heading} lead={c.lead} />
        <ul className="cards">{c.items.map((it) => { const Icon = iconFor(it.icon); return <li key={it.title} className="card"><span className="icon-box"><Icon size={22} /></span><h3>{it.title}</h3>{it.text && <p>{it.text}</p>}</li>; })}</ul>
        {c.cta_label && <p className="center sec-more"><SmartLink className="btn btn-light btn-lg" to="#chat"><IconHeadset size={18} /> {c.cta_label}</SmartLink></p>}
      </div>
    </section>
  );
}

function Testimonials({ c }) {
  return (
    <section className="section">
      <div className="site-wrap">
        <SectionHead title={c.heading} lead={c.lead} />
        <ul className="quotes">
          {c.items.map((q) => (
            <li key={q.name + q.text} className="quote">
              <div className="stars" role="img" aria-label={`${q.rating || 5} out of 5`}>{Array.from({ length: q.rating || 5 }).map((_, i) => <IconStar key={i} size={16} fill="currentColor" />)}</div>
              <p>{q.text}</p>
              <footer>
                {q.photo ? <img src={q.photo.url} alt="" /> : <span className="quote-avatar" aria-hidden>{initials(q.name)}</span>}
                <div><b>{q.name}</b>{q.role && <small>{q.role}</small>}</div>
              </footer>
            </li>
          ))}
        </ul>
      </div>
    </section>
  );
}

function Faq({ c }) {
  const { faqs } = useData();
  if (!faqs.data?.length) return null;
  return (
    <section className="section alt">
      <div className="site-wrap narrow-wrap">
        <SectionHead title={c.heading} lead={c.lead} />
        <Accordion items={faqs.data.slice(0, c.limit || 8)} />
        <p className="center sec-more muted">Still unsure? <SmartLink className="link-btn" to="#chat">Chat with our team</SmartLink></p>
      </div>
    </section>
  );
}

function Cta({ c }) {
  const offer = useOffer();
  return (
    <section className="cta-band">
      <div className="site-wrap">
        <div className="cta-in">
          <h2>{c.heading}</h2>
          {c.text && <p>{c.text}</p>}
          <div className="hero-actions">
            <SmartLink className="btn btn-light btn-lg" to={c.cta_url}>{c.cta_label}</SmartLink>
            {c.secondary_cta_label && <SmartLink className="btn btn-outline-light btn-lg" to={c.secondary_cta_url}>{c.secondary_cta_label}</SmartLink>}
          </div>
          {c.show_offer_code && offer && <small>Use code <b>{offer.code}</b> at checkout for {offer.percent}% off.</small>}
        </div>
      </div>
    </section>
  );
}

/** type -> component. To add a homepage section: add a field list in the backend schema and an entry here. */
export const SECTION_COMPONENTS = {
  hero: Hero, promo: Promo, stats: Stats, highlights: Highlights, showcase: Showcase, courses: Courses,
  plans: Plans, support: Support, testimonials: Testimonials, faq: Faq, cta: Cta,
};

export default function SectionRenderer({ sections }) {
  const types = new Set(sections.map((s) => s.type));
  const courses = useFetch(types.has("courses") ? "/courses" : null);
  const plans = useFetch(types.has("plans") || types.has("hero") ? "/billing/plans" : null);
  const faqs = useFetch(types.has("faq") ? "/support/faqs" : null);
  return (
    <DataCtx.Provider value={{ courses, plans, faqs }}>
      {sections.map((s) => {
        const Component = SECTION_COMPONENTS[s.type];
        return Component ? <Component key={s.id} c={s.content} promotion={s.promotion} /> : null; // unknown type from a newer server: skip, never crash
      })}
    </DataCtx.Provider>
  );
}
