import { useEffect, useMemo, useState } from "react";
import { Link, useNavigate, useParams } from "react-router-dom";
import api, { errorMessage, fieldErrors } from "../../api/client.js";
import { Confirm } from "../../components/Modal.jsx";
import { useToast } from "../../components/Toast.jsx";
import { Alert, PageHead, Skeleton, StatusPill } from "../../components/ui.jsx";
import { IconArrowLeft } from "../../components/Icons.jsx";
import { useDocumentTitle, useFetch } from "../../hooks.js";
import { fromLocalInput, toLocalInput } from "../../components/FormFields.jsx";
import { PromoBar, PromoCard } from "../../site/PromoBanner.jsx";
import ImagePicker from "./ImagePicker.jsx";
import { PLACE_LABEL, STATUS } from "./Promotions.jsx";

const B = "/admin-api/website";
const BLANK = { name: "", title: "", description: "", badge_text: "", cta_label: "", cta_url: "", desktop_image: "", mobile_image: "", placements: ["top_bar", "home_section"],
  theme: "brand", coupon: "", show_countdown: false, starts_at: "", ends_at: "", priority: 0, is_active: false };
const THEMES = [["brand", "Brand blue"], ["dark", "Dark"], ["light", "Light"], ["accent", "Warm accent"]];

export default function PromotionEditor() {
  const { id } = useParams();
  const isNew = !id || id === "new";
  const navigate = useNavigate();
  const toast = useToast();
  useDocumentTitle(isNew ? "New promotion" : "Edit promotion");
  const existing = useFetch(isNew ? null : `${B}/promotions/${id}`);
  const coupons = useFetch("/admin-api/coupons", { page_size: 100 });
  const [v, setV] = useState(BLANK);
  const [errors, setErrors] = useState({});
  const [saving, setSaving] = useState(false);
  const [dirty, setDirty] = useState(false);
  const [removing, setRemoving] = useState(false);
  const [imgs, setImgs] = useState({});

  useEffect(() => {
    const p = existing.data;
    if (p && !dirty) setV({ ...BLANK, ...p, desktop_image: p.desktop_image ?? "", mobile_image: p.mobile_image ?? "", coupon: p.coupon ?? "", starts_at: toLocalInput(p.starts_at), ends_at: toLocalInput(p.ends_at), description: p.description ?? "" });
  }, [existing.data]); // eslint-disable-line
  useEffect(() => {
    if (!dirty) return undefined;
    const warn = (e) => { e.preventDefault(); e.returnValue = ""; };
    window.addEventListener("beforeunload", warn);
    return () => window.removeEventListener("beforeunload", warn);
  }, [dirty]);

  const set = (k, val) => { setV((x) => ({ ...x, [k]: val })); setDirty(true); };
  const coupon = (coupons.data?.results ?? []).find((c) => c.id === v.coupon);
  const togglePlace = (k) => set("placements", v.placements.includes(k) ? v.placements.filter((x) => x !== k) : [...v.placements, k]);

  // the same components visitors see, fed by the form
  const preview = useMemo(() => ({
    id: "preview", title: v.title || "Your headline appears here", description: v.description, badge_text: v.badge_text, cta_label: v.cta_label, cta_url: v.cta_url || "/",
    theme: v.theme, placements: v.placements, desktop_image: imgs.desktop ? { url: imgs.desktop.url, alt: imgs.desktop.alt_text } : null,
    mobile_image: imgs.mobile ? { url: imgs.mobile.url, alt: imgs.mobile.alt_text } : null,
    ends_at: v.show_countdown && v.ends_at ? new Date(v.ends_at).toISOString() : null,
    coupon: coupon ? { code: coupon.code, percent_off: Number(coupon.percent_off) } : null,
  }), [v, imgs, coupon]);

  const save = async (e) => {
    e.preventDefault();
    setSaving(true); setErrors({});
    const body = { ...v, starts_at: fromLocalInput(v.starts_at), ends_at: fromLocalInput(v.ends_at), desktop_image: v.desktop_image || null, mobile_image: v.mobile_image || null,
      coupon: v.coupon || null, priority: Number(v.priority) || 0 };
    try {
      const { data } = isNew ? await api.post(`${B}/promotions`, body) : await api.patch(`${B}/promotions/${id}`, body);
      setDirty(false);
      toast.success(isNew ? "Promotion created" : "Promotion saved");
      data.warnings?.forEach((w) => toast.info(w, { ms: 9000 }));
      if (isNew) navigate(`/console/website/promotions/${data.id}`, { replace: true }); else existing.reload(true);
    } catch (err) {
      const fe = fieldErrors(err);
      setErrors(fe);
      toast.error(Object.keys(fe).length ? "Fix the highlighted fields and save again." : errorMessage(err));
    } finally { setSaving(false); }
  };
  const remove = async () => {
    setSaving(true);
    try { await api.delete(`${B}/promotions/${id}`); setDirty(false); toast.success("Promotion deleted"); navigate("/console/website/promotions"); }
    catch (err) { toast.error(errorMessage(err)); setRemoving(false); } finally { setSaving(false); }
  };

  if (!isNew && existing.loading && !existing.data) return <div className="panel"><Skeleton lines={8} height={22} /></div>;
  if (!isNew && existing.error) return <Alert>That promotion no longer exists. <Link to="/console/website/promotions">Back to promotions</Link></Alert>;
  const st = existing.data?.status;
  const Err = ({ k }) => (errors[k] ? <span className="field-error">{errors[k]}</span> : null);

  return (
    <div className="stack-lg">
      <div><Link to="/console/website/promotions" className="link-btn small" onClick={(e) => { if (dirty && !window.confirm("You have unsaved changes. Leave without saving?")) e.preventDefault(); }}><IconArrowLeft size={16} /> Promotions</Link></div>
      <PageHead title={isNew ? "New promotion" : v.name || "Edit promotion"} lead="Everything visitors see comes from this form. Nothing is built into the website."
        actions={!isNew && st && <StatusPill value={STATUS[st]?.[0]} label={STATUS[st]?.[1] ?? st} />} />
      {existing.data?.warnings?.map((w) => <Alert key={w} type="info">{w}</Alert>)}

      <div className="promo-edit">
        <form className="panel stack" onSubmit={save} noValidate>
          <h2>Content</h2>
          <div className="field"><label htmlFor="p-name">Internal name</label><input id="p-name" value={v.name} onChange={(e) => set("name", e.target.value)} aria-invalid={Boolean(errors.name)} /><span className="hint">For your team only, for example “Year-end sale”.</span><Err k="name" /></div>
          <div className="field"><label htmlFor="p-title">Headline</label><input id="p-title" value={v.title} maxLength={120} onChange={(e) => set("title", e.target.value)} aria-invalid={Boolean(errors.title)} /><Err k="title" /></div>
          <div className="field"><label htmlFor="p-desc">Description<span className="optional">optional</span></label><textarea id="p-desc" rows={2} maxLength={240} value={v.description} onChange={(e) => set("description", e.target.value)} /><Err k="description" /></div>
          <div className="form-row">
            <div className="field"><label htmlFor="p-badge">Badge<span className="optional">optional</span></label><input id="p-badge" value={v.badge_text} maxLength={24} placeholder="Limited time" onChange={(e) => set("badge_text", e.target.value)} /><Err k="badge_text" /></div>
            <div className="field"><label htmlFor="p-theme">Colour</label><select id="p-theme" value={v.theme} onChange={(e) => set("theme", e.target.value)}>{THEMES.map(([k, l]) => <option key={k} value={k}>{l}</option>)}</select></div>
          </div>
          <div className="form-row">
            <div className="field"><label htmlFor="p-cta">Button text<span className="optional">optional</span></label><input id="p-cta" value={v.cta_label} maxLength={40} placeholder="View plans" onChange={(e) => set("cta_label", e.target.value)} /><Err k="cta_label" /></div>
            <div className="field"><label htmlFor="p-url">Button link</label><input id="p-url" value={v.cta_url} placeholder="/pricing" onChange={(e) => set("cta_url", e.target.value)} aria-invalid={Boolean(errors.cta_url)} /><Err k="cta_url" /></div>
          </div>
          <div className="form-row">
            <ImagePicker label="Desktop image" value={v.desktop_image} onChange={(x) => set("desktop_image", x)} onAsset={(a) => setImgs((s) => ({ ...s, desktop: a }))} error={errors.desktop_image} help="About 1200×600. Used on the homepage and pricing page." />
            <ImagePicker label="Mobile image" value={v.mobile_image} onChange={(x) => set("mobile_image", x)} onAsset={(a) => setImgs((s) => ({ ...s, mobile: a }))} error={errors.mobile_image} help="About 800×800. Falls back to the desktop image." />
          </div>

          <h2>Where it appears</h2>
          <fieldset className="field place-grid"><legend className="sr-only">Placements</legend>
            {Object.entries(PLACE_LABEL).map(([k, l]) => (
              <label key={k} className={`cat ${v.placements.includes(k) ? "on" : ""}`}><input type="checkbox" checked={v.placements.includes(k)} onChange={() => togglePlace(k)} /><strong>{l}</strong>
                <span>{{ top_bar: "A slim bar above the header on every public page.", home_section: "A larger banner inside the homepage’s Promotion section.", pricing: "A banner at the top of the pricing page." }[k]}</span></label>))}
          </fieldset>
          <Err k="placements" />

          <h2>Offer and schedule</h2>
          <div className="field"><label htmlFor="p-coupon">Coupon<span className="optional">optional</span></label>
            <select id="p-coupon" value={v.coupon} onChange={(e) => set("coupon", e.target.value)}><option value="">No coupon</option>{(coupons.data?.results ?? []).map((c) => <option key={c.id} value={c.id}>{c.code} ({Number(c.percent_off)}% off)</option>)}</select>
            <span className="hint">Shows the code and discount, and updates plan prices on the site. The promotion hides itself if the coupon expires. Create coupons under Coupons.</span><Err k="coupon" /></div>
          <div className="form-row">
            <div className="field"><label htmlFor="p-start">Starts<span className="optional">optional</span></label><input id="p-start" type="datetime-local" value={v.starts_at} onChange={(e) => set("starts_at", e.target.value)} /><span className="hint">Blank means as soon as it is turned on.</span><Err k="starts_at" /></div>
            <div className="field"><label htmlFor="p-end">Ends<span className="optional">optional</span></label><input id="p-end" type="datetime-local" value={v.ends_at} onChange={(e) => set("ends_at", e.target.value)} aria-invalid={Boolean(errors.ends_at)} /><span className="hint">Times are in your local time zone.</span><Err k="ends_at" /></div>
          </div>
          <div className="form-row">
            <div className="field field-check"><label className="check"><input type="checkbox" checked={v.show_countdown} onChange={(e) => set("show_countdown", e.target.checked)} /><span><strong>Show a countdown</strong><small>Needs an end date.</small></span></label><Err k="show_countdown" /></div>
            <div className="field"><label htmlFor="p-pri">Priority</label><input id="p-pri" type="number" value={v.priority} onChange={(e) => set("priority", e.target.value)} /><span className="hint">If two promotions are live, the higher number is shown.</span></div>
          </div>
          <div className="field field-check publish-toggle"><label className="check"><input type="checkbox" checked={v.is_active} onChange={(e) => set("is_active", e.target.checked)} /><span><strong>Turned on</strong><small>When on, the promotion goes live at its start time and stops at its end time. When off, it is a draft and nobody sees it.</small></span></label></div>

          <div className="form-actions sticky-actions">
            <button className="btn btn-primary" disabled={saving}>{saving ? "Saving…" : isNew ? "Create promotion" : "Save changes"}</button>
            <Link className="btn btn-ghost" to="/console/website/promotions">Cancel</Link>
            {!isNew && <button type="button" className="btn btn-ghost danger-text" onClick={() => setRemoving(true)}>Delete</button>}
            {dirty && <span className="muted small" role="status">Unsaved changes</span>}
          </div>
        </form>

        <aside className="promo-preview" aria-label="Live preview">
          <div className="panel stack">
            <h2>Preview</h2>
            {v.placements.includes("top_bar") && <div><p className="hint">Top bar</p><div className="site-embed"><PromoBar promo={preview} previewing /></div></div>}
            {(v.placements.includes("home_section") || v.placements.includes("pricing")) && <div><p className="hint">Homepage and pricing banner (desktop)</p><div className="site-embed"><PromoCard promo={{ ...preview, mobile_image: null }} /></div></div>}
            {imgs.mobile && <div><p className="hint">On phones</p><div className="site-embed phone"><PromoCard promo={{ ...preview, desktop_image: null }} /></div></div>}
            <p className="hint">This preview uses the same components as the public site, and updates as you type.</p>
          </div>
        </aside>
      </div>
      <Confirm open={removing} danger busy={saving} confirmLabel="Delete promotion" title="Delete this promotion?" onCancel={() => setRemoving(false)} onConfirm={remove}>It will disappear from the site and cannot be restored.</Confirm>
    </div>
  );
}
