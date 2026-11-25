import { useState } from "react";
import { IconX } from "../components/Icons.jsx";
import SmartLink from "./SmartLink.jsx";
import useCountdown from "./useCountdown.js";

const KEY = "itd_promo_dismissed";
const dismissed = (id) => { try { return sessionStorage.getItem(KEY) === id; } catch { return false; } };
const remember = (id) => { try { sessionStorage.setItem(KEY, id); } catch { /* private mode */ } };

function Countdown({ endsAt }) {
  const left = useCountdown(endsAt);
  if (!left) return null;
  return <span className="count" role="timer" aria-label="Time left">{["d", "h", "m", "s"].map((k) => <b key={k}>{left[k]}{k}</b>)}</span>;
}

/** Slim announcement bar for the top of every public page. Visitors can dismiss it for the session. */
export function PromoBar({ promo, previewing = false }) {
  const [hidden, setHidden] = useState(() => !previewing && dismissed(promo.id));
  if (hidden) return null;
  return (
    <div className={`promo-bar theme-${promo.theme}`} role="region" aria-label="Announcement">
      {promo.badge_text && <span className="badge">{promo.badge_text}</span>}
      <span><strong>{promo.title}</strong>{promo.description ? <span className="promo-desc"> · {promo.description}</span> : null}</span>
      {promo.coupon && <span>Code <b>{promo.coupon.code}</b></span>}
      {promo.ends_at && <Countdown endsAt={promo.ends_at} />}
      {promo.cta_label && <SmartLink className="promo-link" to={promo.cta_url}>{promo.cta_label} →</SmartLink>}
      {!previewing && <button className="promo-close" onClick={() => { remember(promo.id); setHidden(true); }} aria-label="Dismiss announcement"><IconX size={16} /></button>}
    </div>
  );
}

/** Larger banner for the homepage promo section and the pricing page. Uses the mobile image on small screens. */
export function PromoCard({ promo }) {
  const d = promo.desktop_image, m = promo.mobile_image;
  const img = d || m;
  return (
    <div className={`promo-card theme-${promo.theme} ${img ? "" : "no-image"}`}>
      <div className="promo-copy">
        {promo.badge_text && <span className="badge">{promo.badge_text}</span>}
        <h2>{promo.title}</h2>
        {promo.description && <p>{promo.description}</p>}
        {promo.coupon && <span className="promo-code">Use code <b>{promo.coupon.code}</b>{promo.coupon.percent_off ? ` for ${promo.coupon.percent_off}% off` : ""}</span>}
        {promo.ends_at && <Countdown endsAt={promo.ends_at} />}
        {promo.cta_label && <SmartLink className="btn btn-light" to={promo.cta_url}>{promo.cta_label}</SmartLink>}
      </div>
      {img && (
        <picture>
          {m && d && <source media="(max-width: 640px)" srcSet={m.url} />}
          <img src={d ? d.url : m.url} alt={(d || m).alt || ""} width={(d || m).width || undefined} height={(d || m).height || undefined} loading="lazy" />
        </picture>
      )}
    </div>
  );
}
