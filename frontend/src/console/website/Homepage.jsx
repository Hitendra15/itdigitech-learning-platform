import { useMemo, useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import api, { errorMessage, fmtDate } from "../../api/client.js";
import { Confirm } from "../../components/Modal.jsx";
import Modal from "../../components/Modal.jsx";
import { useToast } from "../../components/Toast.jsx";
import { Alert, EmptyState, PageHead, Skeleton, StatusPill } from "../../components/ui.jsx";
import { IconArrowDown, IconArrowUp, IconEdit, IconEye, IconPlus, IconTrash } from "../../components/Icons.jsx";
import { useDocumentTitle, useFetch } from "../../hooks.js";

const B = "/admin-api/website";

function summary(s) {
  const c = s.content || {};
  if (s.section_type === "promo") return "Shows the live promotion, if there is one";
  if (s.section_type === "faq") return "Questions from Help articles";
  if (s.section_type === "plans") return "Plans from billing, loaded live";
  if (s.section_type === "courses") return "Published courses, loaded live";
  const n = c.items?.length;
  return [c.heading || c.eyebrow, n != null ? `${n} item${n === 1 ? "" : "s"}` : null].filter(Boolean).join(" · ");
}

export default function Homepage() {
  useDocumentTitle("Homepage");
  const toast = useToast();
  const navigate = useNavigate();
  const sections = useFetch(`${B}/sections`);
  const status = useFetch(`${B}/home/status`);
  const schema = useFetch(`${B}/schema`);
  const [busy, setBusy] = useState(false);
  const [confirm, setConfirm] = useState(null); // "publish" | "discard" | {delete: section}
  const [adding, setAdding] = useState(false);
  const rows = sections.data ?? [];
  const pending = status.data?.pending ?? 0;
  const reloadAll = () => { sections.reload(true); status.reload(true); };

  const run = async (fn, ok) => {
    setBusy(true);
    try { await fn(); if (ok) toast.success(ok); reloadAll(); }
    catch (e) {
      const d = e.response?.data;
      toast.error(d?.section ? `${errorMessage(e)} Open that section and fix the highlighted fields.` : errorMessage(e));
    } finally { setBusy(false); setConfirm(null); }
  };

  const move = (i, d) => {
    const ids = rows.map((r) => r.id);
    const j = i + d;
    if (j < 0 || j >= ids.length) return;
    [ids[i], ids[j]] = [ids[j], ids[i]];
    run(() => api.post(`${B}/sections/reorder`, { ids }));
  };
  const toggle = (s) => run(() => api.patch(`${B}/sections/${s.id}`, { is_enabled: !s.is_enabled }));

  const addable = useMemo(() => Object.entries(schema.data?.sections ?? {}).filter(([k, v]) => !(v.singleton && rows.some((r) => r.section_type === k))), [schema.data, rows]);

  return (
    <div className="stack-lg">
      <PageHead title="Homepage" lead="Turn sections on or off, reorder them and edit their content. Nothing reaches visitors until you publish."
        actions={<>
          <Link className="btn btn-ghost" to="/console/website/preview"><IconEye size={16} /> Preview</Link>
          <button className="btn btn-ghost" disabled={!pending || busy} onClick={() => setConfirm("discard")}>Discard changes</button>
          <button className="btn btn-primary" disabled={!pending || busy} onClick={() => setConfirm("publish")}>Publish{pending ? ` ${pending} change${pending === 1 ? "" : "s"}` : ""}</button>
        </>} />

      <div className={`banner ${pending ? "" : "banner-ok"}`} role="status">
        {pending ? <><strong>{pending} section{pending === 1 ? "" : "s"} with unpublished changes.</strong> Visitors still see the previous version.</>
          : <>Everything is published{status.data?.last_published_at ? ` (last on ${fmtDate(status.data.last_published_at, true)})` : ""}.</>}
      </div>

      {sections.error && !sections.data ? <Alert>{errorMessage(sections.error)} <button className="link-btn" onClick={() => sections.reload()}>Try again</button></Alert>
        : sections.loading && !sections.data ? <div className="panel"><Skeleton lines={6} height={22} /></div>
        : rows.length === 0 ? <EmptyState title="The homepage has no sections" action={<button className="btn btn-primary" onClick={() => setAdding(true)}><IconPlus size={16} /> Add a section</button>}>Add your first section, or ask a developer to run <code className="mono">seed_website</code> to restore the defaults.</EmptyState>
        : (
          <ol className="sec-list" aria-label="Homepage sections in display order">
            {rows.map((s, i) => (
              <li key={s.id} className={`sec-row ${s.is_enabled ? "" : "off"}`}>
                <span className="sec-num" aria-hidden>{i + 1}</span>
                <div className="sec-main">
                  <Link to={`/console/website/sections/${s.id}`} className="sec-title"><strong>{s.label}</strong></Link>
                  <span className="muted small">{[s.label !== s.type_label ? s.type_label : null, summary(s)].filter(Boolean).join(" · ")}</span>
                </div>
                <span className="sec-state">
                  {s.has_draft ? <StatusPill value="draft" label="Unpublished changes" /> : <StatusPill value={s.live_enabled ? "published" : "closed"} label={s.live_enabled ? "Live" : "Hidden"} />}
                </span>
                <label className="switch" title={s.is_enabled ? "Shown on the homepage" : "Hidden from the homepage"}>
                  <input type="checkbox" checked={s.is_enabled} disabled={busy} onChange={() => toggle(s)} aria-label={`Show ${s.label} on the homepage`} /><span aria-hidden />
                </label>
                <span className="row-actions">
                  <button className="icon-btn" disabled={i === 0 || busy} onClick={() => move(i, -1)} aria-label={`Move ${s.label} up`}><IconArrowUp size={18} /></button>
                  <button className="icon-btn" disabled={i === rows.length - 1 || busy} onClick={() => move(i, 1)} aria-label={`Move ${s.label} down`}><IconArrowDown size={18} /></button>
                  <button className="icon-btn" onClick={() => navigate(`/console/website/sections/${s.id}`)} aria-label={`Edit ${s.label}`}><IconEdit size={18} /></button>
                  <button className="icon-btn danger" onClick={() => setConfirm({ del: s })} aria-label={`Delete ${s.label}`}><IconTrash size={18} /></button>
                </span>
              </li>
            ))}
          </ol>
        )}

      {rows.length > 0 && <div><button className="btn btn-ghost" onClick={() => setAdding(true)}><IconPlus size={16} /> Add a section</button></div>}

      <Confirm open={confirm === "publish"} busy={busy} confirmLabel="Publish now" title="Publish the homepage?" onCancel={() => setConfirm(null)}
        onConfirm={() => run(() => api.post(`${B}/home/publish`), "Homepage published")}>{pending} change{pending === 1 ? "" : "s"} will go live for all visitors immediately.</Confirm>
      <Confirm open={confirm === "discard"} danger busy={busy} confirmLabel="Discard changes" title="Discard unpublished changes?" onCancel={() => setConfirm(null)}
        onConfirm={() => run(() => api.post(`${B}/home/discard`), "Changes discarded")}>Every section goes back to what is live now. This cannot be undone.</Confirm>
      <Confirm open={Boolean(confirm?.del)} danger busy={busy} confirmLabel="Delete section" title="Delete this section?" onCancel={() => setConfirm(null)}
        onConfirm={() => run(() => api.delete(`${B}/sections/${confirm.del.id}`), "Section deleted")}>
        {confirm?.del ? `“${confirm.del.label}” will be removed from the homepage straight away. This cannot be undone.` : ""}</Confirm>

      <Modal open={adding} onClose={() => setAdding(false)} title="Add a section" size="md" footer={<button className="btn btn-ghost" onClick={() => setAdding(false)}>Cancel</button>}>
        <ul className="pick-list">
          {addable.map(([k, v]) => (
            <li key={k}><button className="pick" disabled={busy} onClick={async () => { setAdding(false); await run(async () => { const { data } = await api.post(`${B}/sections`, { section_type: k }); navigate(`/console/website/sections/${data.id}`); }); }}>
              <strong>{v.label}</strong><span>{v.description}</span></button></li>
          ))}
          {addable.length === 0 && <li className="muted">Every section type is already on the page.</li>}
        </ul>
      </Modal>
    </div>
  );
}
