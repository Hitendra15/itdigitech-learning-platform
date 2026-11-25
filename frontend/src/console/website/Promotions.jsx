import { useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import api, { errorMessage, fmtDate } from "../../api/client.js";
import { Confirm } from "../../components/Modal.jsx";
import { useToast } from "../../components/Toast.jsx";
import { Alert, EmptyState, PageHead, SearchBox, Skeleton, StatusPill } from "../../components/ui.jsx";
import { IconEdit, IconPlus, IconTrash } from "../../components/Icons.jsx";
import { useDebounced, useDocumentTitle, useFetch } from "../../hooks.js";

const B = "/admin-api/website";
export const STATUS = {
  live: ["published", "Live now"], scheduled: ["waiting_on_student", "Scheduled"], ended: ["closed", "Ended"],
  draft: ["draft", "Draft"], coupon_invalid: ["failed", "Hidden: coupon invalid"],
};
export const PLACE_LABEL = { top_bar: "Top bar", home_section: "Homepage", pricing: "Pricing page" };

export default function Promotions() {
  useDocumentTitle("Promotions");
  const toast = useToast();
  const navigate = useNavigate();
  const [q, setQ] = useState("");
  const dq = useDebounced(q);
  const [status, setStatus] = useState("");
  const list = useFetch(`${B}/promotions`, { ...(dq ? { search: dq } : {}), ...(status ? { status } : {}) });
  const [removing, setRemoving] = useState(null);
  const [busy, setBusy] = useState(false);
  const rows = list.data ?? [];

  const toggle = async (p) => {
    try { await api.patch(`${B}/promotions/${p.id}`, { is_active: !p.is_active }); toast.success(p.is_active ? "Promotion turned off" : "Promotion turned on"); list.reload(true); }
    catch (e) { toast.error(errorMessage(e)); }
  };
  const duplicate = async (p) => {
    try { const { data } = await api.post(`${B}/promotions/${p.id}/duplicate`); toast.success("Copy created as a draft"); navigate(`/console/website/promotions/${data.id}`); }
    catch (e) { toast.error(errorMessage(e)); }
  };
  const remove = async () => {
    setBusy(true);
    try { await api.delete(`${B}/promotions/${removing.id}`); toast.success("Promotion deleted"); setRemoving(null); list.reload(true); }
    catch (e) { toast.error(errorMessage(e)); } finally { setBusy(false); }
  };
  const filtered = Boolean(dq || status);

  return (
    <div className="stack-lg">
      <PageHead title="Promotions" lead="Banners and offers that switch on and off by themselves. Visitors only ever see what is live right now."
        actions={<Link className="btn btn-primary" to="/console/website/promotions/new"><IconPlus size={16} /> New promotion</Link>} />
      <div className="toolbar">
        <SearchBox value={q} onChange={setQ} placeholder="Search promotions" />
        <label className="filter"><span className="sr-only">Status</span>
          <select value={status} onChange={(e) => setStatus(e.target.value)} aria-label="Status"><option value="">Status: all</option>
            {Object.entries(STATUS).map(([k, [, l]]) => <option key={k} value={k}>{l}</option>)}</select></label>
      </div>
      {list.error && !list.data ? <Alert>{errorMessage(list.error)} <button className="link-btn" onClick={() => list.reload()}>Try again</button></Alert>
        : list.loading && !list.data ? <div className="table-wrap pad"><Skeleton lines={4} height={20} /></div>
        : rows.length === 0 ? (
          <EmptyState title={filtered ? "No promotions match" : "No promotions yet"}
            action={!filtered && <Link className="btn btn-primary" to="/console/website/promotions/new"><IconPlus size={16} /> Create a promotion</Link>}>
            {filtered ? "Try a different search or clear the filter." : "Create a banner for a sale, a launch or an announcement. Choose when it starts and ends and it handles the rest. Until one is live, no promotional space appears on the site."}</EmptyState>
        ) : (
          <div className="table-wrap"><table className="table">
            <thead><tr><th>Promotion</th><th>Status</th><th>Appears on</th><th>Schedule</th><th className="actions-col"><span className="sr-only">Actions</span></th></tr></thead>
            <tbody>{rows.map((p) => (
              <tr key={p.id}>
                <td data-label="Promotion"><div className="cell-stack"><Link to={`/console/website/promotions/${p.id}`}><strong>{p.name}</strong></Link><span className="clamp-1">{p.title}</span></div></td>
                <td data-label="Status"><StatusPill value={STATUS[p.status]?.[0]} label={STATUS[p.status]?.[1] ?? p.status} /></td>
                <td data-label="Appears on">{p.placements.map((x) => PLACE_LABEL[x] ?? x).join(", ")}</td>
                <td data-label="Schedule"><div className="cell-stack"><span>{p.starts_at ? `From ${fmtDate(p.starts_at, true)}` : "Starts when turned on"}</span><span>{p.ends_at ? `Until ${fmtDate(p.ends_at, true)}` : "No end date"}</span></div></td>
                <td className="actions-col" data-label="Actions"><div className="row-actions">
                  <label className="switch" title={p.is_active ? "Turn off" : "Turn on"}><input type="checkbox" checked={p.is_active} onChange={() => toggle(p)} aria-label={`${p.name} is turned on`} /><span aria-hidden /></label>
                  <button className="btn btn-ghost btn-sm" onClick={() => duplicate(p)}>Duplicate</button>
                  <Link className="icon-btn" to={`/console/website/promotions/${p.id}`} aria-label={`Edit ${p.name}`}><IconEdit size={18} /></Link>
                  <button className="icon-btn danger" onClick={() => setRemoving(p)} aria-label={`Delete ${p.name}`}><IconTrash size={18} /></button>
                </div></td>
              </tr>))}</tbody></table></div>
        )}
      <Confirm open={Boolean(removing)} danger busy={busy} confirmLabel="Delete promotion" title="Delete this promotion?" onCancel={() => setRemoving(null)} onConfirm={remove}>
        {removing ? `“${removing.name}” will disappear from the site and cannot be restored. To keep it for next time, turn it off or use Duplicate instead.` : ""}</Confirm>
    </div>
  );
}
