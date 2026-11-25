import { useEffect, useId, useRef, useState } from "react";
import api, { errorMessage } from "../../api/client.js";
import Modal from "../../components/Modal.jsx";
import { Alert, Skeleton } from "../../components/ui.jsx";
import { SearchBox } from "../../components/ui.jsx";
import { useDebounced } from "../../hooks.js";
import { IconPlus, IconX } from "../../components/Icons.jsx";
import { checkImage, fmtSize, getAsset, rememberAsset, uploadImage } from "./media.js";

/** Pick an image from the media library or upload a new one. `value` is the asset id (or ""). */
export default function ImagePicker({ value, onChange, label, help, error, onAsset }) {
  const uid = useId();
  const [asset, setAsset] = useState(null);
  const [open, setOpen] = useState(false);
  useEffect(() => {
    let alive = true;
    if (!value) { setAsset(null); onAsset?.(null); return undefined; }
    getAsset(value).then((a) => { if (alive) { setAsset(a); onAsset?.(a); } }).catch(() => alive && setAsset(null));
    return () => { alive = false; };
  }, [value]); // eslint-disable-line react-hooks/exhaustive-deps

  return (
    <div className="field">
      <span className="lbl" id={`${uid}-l`}>{label}<span className="optional">optional</span></span>
      <div className={`imgpick ${error ? "bad" : ""}`}>
        {asset ? <img src={asset.url} alt={asset.alt_text || ""} /> : <span className="imgpick-empty" aria-hidden>No image</span>}
        <div className="imgpick-actions">
          <button type="button" className="btn btn-ghost btn-sm" onClick={() => setOpen(true)} aria-describedby={`${uid}-l`}>{value ? "Change image" : "Choose image"}</button>
          {value && <button type="button" className="btn btn-ghost btn-sm" onClick={() => onChange("")}><IconX size={14} /> Remove</button>}
        </div>
      </div>
      {error ? <span className="field-error">{error}</span> : help && <span className="hint">{help}</span>}
      <Library open={open} onClose={() => setOpen(false)} onPick={(a) => { rememberAsset(a); onChange(a.id); setOpen(false); }} />
    </div>
  );
}

function Library({ open, onClose, onPick }) {
  const [q, setQ] = useState("");
  const dq = useDebounced(q);
  const [rows, setRows] = useState(null);
  const [err, setErr] = useState("");
  const [busy, setBusy] = useState(false);
  const file = useRef(null);

  useEffect(() => {
    if (!open) return;
    setRows(null);
    api.get("/admin-api/website/media", { params: { page_size: 60, ...(dq ? { search: dq } : {}) } })
      .then((r) => setRows(r.data.results)).catch((e) => setErr(errorMessage(e)));
  }, [open, dq]);

  const upload = async (f) => {
    if (!f) return;
    const problem = checkImage(f);
    if (problem) { setErr(problem); return; }
    setBusy(true); setErr("");
    try { onPick(await uploadImage(f)); } catch (e) { setErr(e.response?.data?.image?.[0] || errorMessage(e)); } finally { setBusy(false); }
  };

  return (
    <Modal open={open} onClose={onClose} title="Choose an image" size="lg"
      footer={<><button className="btn btn-ghost" onClick={onClose}>Cancel</button></>}>
      <div className="stack">
        <div className="toolbar">
          <SearchBox value={q} onChange={setQ} placeholder="Search images" />
          <input ref={file} type="file" accept="image/jpeg,image/png,image/webp" hidden onChange={(e) => { upload(e.target.files[0]); e.target.value = ""; }} />
          <button className="btn btn-primary" disabled={busy} onClick={() => file.current.click()}><IconPlus size={16} /> {busy ? "Uploading…" : "Upload new"}</button>
        </div>
        {err && <Alert>{err}</Alert>}
        {rows === null ? <Skeleton lines={3} height={80} />
          : rows.length === 0 ? <p className="muted center">{dq ? "No images match your search." : "Your library is empty. Upload your first image."}</p>
          : <ul className="media-grid compact">{rows.map((a) => (
            <li key={a.id}><button type="button" className="media-tile" onClick={() => onPick(a)}>
              <img src={a.url} alt={a.alt_text || ""} loading="lazy" /><span className="clamp-1">{a.name}</span><small>{a.width}×{a.height} · {fmtSize(a.size_bytes)}</small>
            </button></li>))}</ul>}
        <p className="hint">JPG, PNG or WebP, up to 5 MB. Large images are resized and compressed automatically.</p>
      </div>
    </Modal>
  );
}
