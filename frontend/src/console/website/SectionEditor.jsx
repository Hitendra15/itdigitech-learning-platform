import { useEffect, useState } from "react";
import { Link, useNavigate, useParams } from "react-router-dom";
import api, { errorMessage } from "../../api/client.js";
import { Confirm } from "../../components/Modal.jsx";
import { useToast } from "../../components/Toast.jsx";
import { Alert, PageHead, Skeleton, StatusPill } from "../../components/ui.jsx";
import { IconArrowLeft } from "../../components/Icons.jsx";
import { useDocumentTitle, useFetch } from "../../hooks.js";
import SchemaForm from "./SchemaForm.jsx";

const B = "/admin-api/website";

export default function SectionEditor() {
  const { id } = useParams();
  const navigate = useNavigate();
  const toast = useToast();
  const sections = useFetch(`${B}/sections`);
  const schema = useFetch(`${B}/schema`);
  const section = sections.data?.find((s) => s.id === id);
  const spec = section && schema.data?.sections?.[section.section_type];
  useDocumentTitle(section ? `Edit ${section.label}` : "Edit section");

  const [values, setValues] = useState(null);
  const [label, setLabel] = useState("");
  const [enabled, setEnabled] = useState(true);
  const [errors, setErrors] = useState({});
  const [saving, setSaving] = useState(false);
  const [dirty, setDirty] = useState(false);
  const [discard, setDiscard] = useState(false);

  useEffect(() => { if (section && !dirty) { setValues(section.content); setLabel(section.label); setEnabled(section.is_enabled); } }, [section]); // eslint-disable-line
  useEffect(() => {
    if (!dirty) return undefined;
    const warn = (e) => { e.preventDefault(); e.returnValue = ""; };
    window.addEventListener("beforeunload", warn);
    return () => window.removeEventListener("beforeunload", warn);
  }, [dirty]);

  if ((sections.loading && !sections.data) || (schema.loading && !schema.data)) return <div className="panel"><Skeleton lines={6} height={22} /></div>;
  if (!section || !spec) return <Alert>That section no longer exists. <Link to="/console/website">Back to the homepage</Link></Alert>;

  const save = async (e) => {
    e.preventDefault();
    setSaving(true); setErrors({});
    try {
      await api.patch(`${B}/sections/${id}`, { content: values, label, is_enabled: enabled });
      setDirty(false);
      toast.success("Saved as a draft. Publish from the Homepage screen to make it live.");
      sections.reload(true);
    } catch (err) {
      const d = err.response?.data;
      if (d && typeof d === "object" && !d.detail) { setErrors(d.content ?? d); toast.error("Some fields need attention. They are highlighted below."); }
      else toast.error(errorMessage(err));
    } finally { setSaving(false); }
  };
  const revert = async () => {
    setSaving(true);
    try { await api.post(`${B}/sections/${id}/discard`); setDirty(false); setDiscard(false); await sections.reload(true); toast.success("Draft discarded"); }
    catch (err) { toast.error(errorMessage(err)); } finally { setSaving(false); }
  };

  return (
    <div className="stack-lg narrow-xl">
      <div><Link to="/console/website" className="link-btn small" onClick={(e) => { if (dirty && !window.confirm("You have unsaved changes. Leave without saving?")) e.preventDefault(); }}><IconArrowLeft size={16} /> Homepage</Link></div>
      <PageHead title={section.label} lead={spec.description}
        actions={section.has_draft ? <StatusPill value="draft" label="Unpublished changes" /> : <StatusPill value="published" label="Live" />} />
      <form className="panel stack" onSubmit={save} noValidate>
        <div className="form-row">
          <div className="field"><label htmlFor="sec-label">Name in the console</label><input id="sec-label" value={label} maxLength={80} onChange={(e) => { setLabel(e.target.value); setDirty(true); }} /><span className="hint">Only you see this name.</span></div>
          <div className="field field-check"><label className="check"><input type="checkbox" checked={enabled} onChange={(e) => { setEnabled(e.target.checked); setDirty(true); }} /><span><strong>Show on the homepage</strong><small>Turn off to hide without deleting.</small></span></label></div>
        </div>
        {spec.fields.length === 0
          ? <Alert type="info">This section has nothing to configure. It shows the active promotion for the “Homepage promo section” placement and disappears when none is live. Manage promotions under Website → Promotions.</Alert>
          : <SchemaForm fields={spec.fields} values={values ?? {}} errors={errors} onChange={(v) => { setValues(v); setDirty(true); }} />}
        <div className="form-actions sticky-actions">
          <button className="btn btn-primary" disabled={saving}>{saving ? "Saving…" : "Save draft"}</button>
          <Link className="btn btn-ghost" to="/console/website/preview">Preview</Link>
          {section.has_draft && <button type="button" className="btn btn-ghost" onClick={() => setDiscard(true)}>Discard draft</button>}
          {dirty && <span className="muted small" role="status">Unsaved changes</span>}
        </div>
      </form>
      <Confirm open={discard} danger busy={saving} confirmLabel="Discard draft" title="Discard this draft?" onCancel={() => setDiscard(false)} onConfirm={revert}>This section goes back to what is live now.</Confirm>
    </div>
  );
}
