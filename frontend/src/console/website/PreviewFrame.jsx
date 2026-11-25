import { useEffect, useState } from "react";
import SectionRenderer from "../../site/sections.jsx";
import { PromoBar } from "../../site/PromoBanner.jsx";
import { SiteContext } from "../../site/SiteContext.jsx";
import { PREVIEW_DATA, PREVIEW_READY } from "./previewProtocol.js";

/**
 * Rendered inside the console's preview iframe. It has no credentials and fetches nothing private:
 * the console page (which is authenticated) posts the preview data in. Opened directly, it stays empty.
 */
export default function PreviewFrame() {
  const [data, setData] = useState(null);
  useEffect(() => {
    const onMsg = (e) => { if (e.origin === window.location.origin && e.source === window.parent && e.data?.type === PREVIEW_DATA) setData(e.data.payload); };
    window.addEventListener("message", onMsg);
    window.parent.postMessage({ type: PREVIEW_READY }, window.location.origin);
    return () => window.removeEventListener("message", onMsg);
  }, []);
  if (!data) return <p style={{ padding: "2rem", font: "14px system-ui", color: "#5b6780" }}>Loading preview…</p>;
  const bar = data.promotions.find((p) => p.placements.includes("top_bar"));
  return (
    <SiteContext.Provider value={{ profile: data.profile, promotions: data.promotions, loading: false }}>
      <div className="site" onClickCapture={(e) => { if (e.target.closest("a")) e.preventDefault(); }}>
        {bar && <PromoBar promo={bar} previewing />}
        <SectionRenderer sections={data.sections} />
      </div>
    </SiteContext.Provider>
  );
}
