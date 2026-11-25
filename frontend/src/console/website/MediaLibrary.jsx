import { useRef, useState } from "react";
import api, { errorMessage } from "../../api/client.js";
import Modal, { Confirm } from "../../components/Modal.jsx";
import { useToast } from "../../components/Toast.jsx";
import { Alert, EmptyState, PageHead, Pager, SearchBox, Skeleton } from "../../components/ui.jsx";
import { IconPlus, IconTrash } from "../../components/Icons.jsx";
import { useDebounced, useDocumentTitle, useFetch } from "../../hooks.js";
import { checkImage, forgetAsset, fmtSize, uploadImage } from "./media.js";

const B = "/admin-api/website/media";

export default function MediaLibrary() {
  useDocumentTitle("Media library");
  const toast = useToast();
  const [q, setQ] = useState("");
  const dq = useDebounced(q);
  const [page, setPage] = useState(1);
  const list = useFetch(B, { page, page_size: 24, ...(dq ? { search: dq } : {}) });
  const input = useRef(null);
  const [uploading, setUploading] = useState(0);
  const [editing, setEditing] = useState(null);
  const [alt, setAlt] = useState("");
  const [removing, setRemoving] = useState(null);
  const [busy, setBusy] = useState(false);
  const [over, setOver] = useState(false);
  const rows = list.data?.results ?? [];

  const upload = async (files) => {
    for (const f of [...files]) {
      const problem = checkImage(f);
      if (problem) { toast.error(`${f.name}: ${problem}`); continue; }
      setUploading((n) => n + 1);
      try { await uploadImage(f); toast.success(`${f.name} uploaded`); }
      catch (e) { toast.error(`${f.name}: ${e.response?.data?.image?.[0] || errorMessage(e)}`); }
      finally { setUploading((n) => n - 1); }
    }
    setPage(1); list.reload(true);
  };
  const saveAlt = async (e) => {
    e.preventDefault(); setBusy(true);
    try { await api.patch(`${B}/${editing.id}`, { alt_text: alt }); forgetAsset(editing.id); toast.success("Description saved"); setEditing(null); list.reload(true); }
    catch (err) { toast.error(errorMessage(err)); } finally { setBusy(false); }
  };
  const remove = async () => {
    setBusy(true);
    try { await api.delete(`${B}/${removing.id}`); forgetAsset(removing.id); toast.success("Image deleted"); setRemoving(null); list.reload(true); }
    catch (err) { toast.error(errorMessage(err)); setRemoving(null); } finally { setBusy(false); }
  };

  return (
    <div className="stack-lg" onDragOver={(e) => { e.preventDefault(); setOver(true); }} onDragLeave={(e) => { if (!e.currentTarget.contains(e.relatedTarget)) setOver(false); }}
      onDrop={(e) => { e.preventDefault(); setOver(false); upload(e.dataTransfer.files); }}>
      <PageHead title="Media library" lead="Images used on the homepage and in promotions. JPG, PNG or WebP up to 5 MB. Large images are resized and compressed for fast loading."
        actions={<>
          <input ref={input} type="file" accept="image/jpeg,image/png,image/webp" multiple hidden onChange={(e) => { upload(e.target.files); e.target.value = ""; }} />
          <button className="btn btn-primary" onClick={() => input.current.click()} disabled={uploading > 0}><IconPlus size={16} /> {uploading ? "Uploading…" : "Upload images"}</button>
        </>} />
      <div className="toolbar"><SearchBox value={q} onChange={(v) => { setQ(v); setPage(1); }} placeholder="Search by name or description" /></div>
      {over && <div className="dropzone" role="status">Drop images to upload</div>}
      {list.error && !list.data ? <Alert>{errorMessage(list.error)} <button className="link-btn" onClick={() => list.reload()}>Try again</button></Alert>
        : list.loading && !list.data ? <div className="panel"><Skeleton lines={4} height={90} /></div>
        : rows.length === 0 ? <EmptyState title={dq ? "No images match" : "No images yet"} action={!dq && <button className="btn btn-primary" onClick={() => input.current.click()}><IconPlus size={16} /> Upload your first image</button>}>{dq ? "Try a different search." : "Upload images here, or drag them onto this page."}</EmptyState>
        : <>
          <ul className="media-grid">{rows.map((a) => (
            <li key={a.id} className="media-card">
              <img src={a.url} alt={a.alt_text || ""} loading="lazy" />
              <div className="media-meta">
                <strong className="clamp-1" title={a.name}>{a.name}</strong>
                <span className="muted small">{a.width}×{a.height} · {fmtSize(a.size_bytes)}</span>
                <span className={`small ${a.alt_text ? "muted" : "warn-text"}`}>{a.alt_text || "No description (add one for accessibility)"}</span>
                {a.in_use > 0 && <span className="pill pill-info">In use</span>}
              </div>
              <div className="media-actions">
                <button className="btn btn-ghost btn-sm" onClick={() => { setEditing(a); setAlt(a.alt_text); }}>Edit description</button>
                <button className="icon-btn danger" onClick={() => setRemoving(a)} aria-label={`Delete ${a.name}`}><IconTrash size={18} /></button>
              </div>
            </li>))}</ul>
          <Pager page={page} count={list.data.count} pageSize={24} onPage={setPage} />
        </>}

      <Modal open={Boolean(editing)} onClose={() => !busy && setEditing(null)} title="Image description" size="md"
        footer={<><button className="btn btn-ghost" onClick={() => setEditing(null)} disabled={busy}>Cancel</button><button className="btn btn-primary" form="alt-form" disabled={busy}>{busy ? "Saving…" : "Save"}</button></>}>
        {editing && <form id="alt-form" className="form" onSubmit={saveAlt}>
          <img className="media-edit-img" src={editing.url} alt="" />
          <div className="field"><label htmlFor="alt">Description</label><input id="alt" value={alt} maxLength={200} onChange={(e) => setAlt(e.target.value)} placeholder="A learner writing Python code on a laptop" />
            <span className="hint">Read aloud by screen readers and shown if the image cannot load.</span></div></form>}
      </Modal>
      <Confirm open={Boolean(removing)} danger busy={busy} confirmLabel="Delete image" title="Delete this image?" onCancel={() => setRemoving(null)} onConfirm={remove}>
        {removing ? `“${removing.name}” will be removed permanently.${removing.in_use ? " It is in use, so you will need to replace it where it appears first." : ""}` : ""}</Confirm>
    </div>
  );
}
