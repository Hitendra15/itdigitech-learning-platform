import { createContext, useContext, useEffect, useMemo, useState } from "react";
import api from "../api/client.js";

// Used only until the API answers, or if it cannot be reached, so the layout never breaks.
export const FALLBACK_PROFILE = {
  brand_name: "IT DigiTech", product_name: "IT DigiTech Learn", tagline: "Learn. Practice. Get certified.", about: "",
  email: "", phone: "", hours: "", address: "", legal_name: "", registration: "", gstin: "", terms_url: "", privacy_url: "",
  payment_methods: [], footer_note: "",
};

export const SiteContext = createContext({ profile: FALLBACK_PROFILE, promotions: [], loading: false });
export const useSite = () => useContext(SiteContext);

/** First live promotion that targets a placement ("top_bar", "home_section", "pricing"), or null. */
export const usePromo = (placement) => useSite().promotions.find((p) => p.placements?.includes(placement)) ?? null;

/** The coupon-backed discount currently being advertised, used to show discounted prices consistently. */
export function useOffer() {
  const { promotions } = useSite();
  const p = promotions.find((x) => x.coupon && x.coupon.percent_off > 0);
  return p ? { code: p.coupon.code, percent: p.coupon.percent_off } : null;
}

export function SiteProvider({ children }) {
  const [state, setState] = useState({ profile: FALLBACK_PROFILE, promotions: [], loading: true });
  useEffect(() => {
    let alive = true;
    api.get("/site/config")
      .then(({ data }) => alive && setState({ profile: { ...FALLBACK_PROFILE, ...data.profile }, promotions: data.promotions ?? [], loading: false }))
      .catch(() => alive && setState((s) => ({ ...s, loading: false })));
    return () => { alive = false; };
  }, []);
  const value = useMemo(() => state, [state]);
  return <SiteContext.Provider value={value}>{children}</SiteContext.Provider>;
}
