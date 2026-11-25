import { useEffect, useState } from "react";
import api, { errorMessage } from "../../api/client.js";
import { useToast } from "../../components/Toast.jsx";
import { Alert, PageHead, Skeleton } from "../../components/ui.jsx";
import { useDocumentTitle, useFetch } from "../../hooks.js";
import SchemaForm from "./SchemaForm.jsx";

const B = "/admin-api/website/profile";
const GROUPS = [
  ["Company", ["brand_name", "product_name", "tagline", "about"]],
  ["Contact", ["email", "phone", "hours", "address"]],
  ["Legal and footer", ["legal_name", "registration", "gstin", "terms_url", "privacy_url", "payment_methods", "footer_note"]],
  ["Search and sharing", ["seo_title", "seo_description", "og_image"]],
];

export default function SiteProfile() {
  useDocumentTitle("Website settings");
  const toast = useToast();
  const { data, loading, error, reload } = useFetch(B);
  const [values, setValues] = useState(null);
  const [errors, setErrors] = useState({});
  const [saving, setSaving] = useState(false);
  const [dirty, setDirty] = useState(false);
  useEffect(() => { if (data && !dirty) setValues(data.values); }, [data]); // eslint-disable-line

  if (error && !data) return <Alert>{errorMessage(error)} <button className="link-btn" onClick={() => reload()}>Try again</button></Alert>;
  if (loading || !values) return <div className="panel"><Skeleton lines={8} height={22} /></div>;
  const byName = Object.fromEntries(data.fields.map((f) => [f.name, f]));

  const save = async (e) => {
    e.preventDefault(); setSaving(true); setErrors({});
    try { await api.put(B, values); setDirty(false); toast.success("Website settings saved. They are live now."); }
    catch (err) { const d = err.response?.data; if (d && !d.detail) { setErrors(d); toast.error("Some fields need attention."); } else toast.error(errorMessage(err)); }
    finally { setSaving(false); }
  };

  return (
    <div className="stack-lg narrow-xl">
      <PageHead title="Website settings" lead="Company details, footer and search-engine information. These apply to the whole public site and go live as soon as you save." />
      <form className="stack" onSubmit={save} noValidate>
        {GROUPS.map(([title, names]) => (
          <section key={title} className="panel stack"><h2>{title}</h2>
            <SchemaForm fields={names.map((n) => byName[n]).filter(Boolean)} values={values} errors={errors} onChange={(v) => { setValues(v); setDirty(true); }} /></section>))}
        <div className="form-actions sticky-actions"><button className="btn btn-primary" disabled={saving}>{saving ? "Saving…" : "Save settings"}</button>{dirty && <span className="muted small" role="status">Unsaved changes</span>}</div>
      </form>
    </div>
  );
}
