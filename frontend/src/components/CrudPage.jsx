import { useEffect, useMemo, useState } from "react";
import api, { errorMessage, fieldErrors } from "../api/client.js";
import { useFetch, useDebounced, useDocumentTitle } from "../hooks.js";
import { Confirm } from "./Modal.jsx";
import Modal from "./Modal.jsx";
import { FieldInput } from "./FormFields.jsx";
import { Alert, EmptyState, PageHead, Pager, SearchBox, Skeleton } from "./ui.jsx";
import { useToast } from "./Toast.jsx";
import { IconEdit, IconPlus, IconTrash } from "./Icons.jsx";

const blank = (fields) => Object.fromEntries(fields.map((f) => [f.name, f.default ?? (f.type === "checkbox" ? false : f.type === "multiselect" ? [] : "")]));

/**
 * Generic list + create + edit + delete screen driven by a schema.
 * Most admin screens (plans, coupons, FAQs, flags...) are just configuration of this component.
 */
export default function CrudPage({
  title, lead, noun, endpoint, columns, fields, createFields, filters = [], searchPlaceholder,
  allowCreate = true, allowEdit = true, allowDelete = true, paginated = true, pageSize = 20,
  rowActions, detail, toForm, toPayload, empty, createLabel, extraHead, pollMs, rowKey = "id", params: baseParams,
}) {
  useDocumentTitle(title);
  const toast = useToast();
  const [q, setQ] = useState("");
  const dq = useDebounced(q);
  const [page, setPage] = useState(1);
  const [filterVals, setFilterVals] = useState({});
  const params = useMemo(() => ({ ...baseParams, ...(paginated ? { page, page_size: pageSize } : {}), ...(dq ? { search: dq } : {}),
    ...Object.fromEntries(Object.entries(filterVals).filter(([, v]) => v !== "")) }), [baseParams, page, pageSize, dq, filterVals, paginated]);
  const { data, loading, error, reload, refresh } = useFetch(endpoint, params);
  useEffect(() => { setPage(1); }, [dq, filterVals]);
  useEffect(() => { if (!pollMs) return undefined; const t = setInterval(refresh, pollMs); return () => clearInterval(t); }, [pollMs]); // eslint-disable-line

  const rows = paginated ? data?.results : data;
  const count = paginated ? data?.count ?? 0 : rows?.length ?? 0;

  const [editing, setEditing] = useState(null); // {row|null, values}
  const [errors, setErrors] = useState({});
  const [formError, setFormError] = useState("");
  const [saving, setSaving] = useState(false);
  const [removing, setRemoving] = useState(null);
  const [viewing, setViewing] = useState(null);
  const activeFields = editing && !editing.row && createFields ? createFields : fields;

  const openNew = () => { setErrors({}); setFormError(""); setEditing({ row: null, values: blank(createFields ?? fields) }); };
  const openEdit = (row) => {
    setErrors({}); setFormError("");
    const base = blank(fields);
    const values = toForm ? { ...base, ...toForm(row) } : Object.fromEntries(Object.keys(base).map((k) => [k, row[k] ?? base[k]]));
    setEditing({ row, values });
  };

  const save = async (e) => {
    e.preventDefault();
    setSaving(true); setErrors({}); setFormError("");
    const payload = toPayload ? toPayload(editing.values, editing.row) : cleanPayload(editing.values, activeFields);
    if (payload instanceof Error) { setFormError(payload.message); setSaving(false); return; }
    try {
      if (editing.row) await api.patch(`${endpoint}/${editing.row[rowKey]}`, payload);
      else await api.post(endpoint, payload);
      toast.success(editing.row ? `${cap(noun)} updated` : `${cap(noun)} created`);
      setEditing(null);
      reload(true);
    } catch (err) {
      const fe = fieldErrors(err);
      setErrors(fe);
      setFormError(err.response?.data?.detail || (Object.keys(fe).length ? "Fix the highlighted fields and save again." : errorMessage(err)));
    } finally { setSaving(false); }
  };

  const remove = async () => {
    setSaving(true);
    try {
      await api.delete(`${endpoint}/${removing[rowKey]}`);
      toast.success(`${cap(noun)} deleted`);
      setRemoving(null);
      reload(true);
    } catch (err) { toast.error(errorMessage(err)); setRemoving(null); }
    finally { setSaving(false); }
  };

  const showActions = allowEdit || allowDelete || rowActions || detail;
  const nameOf = (r) => r.title || r.name || r.code || r.question || r.key || r.email || noun;

  return (
    <div className="stack-lg">
      <PageHead title={title} lead={lead}
        actions={<>{extraHead}{allowCreate && <button className="btn btn-primary" onClick={openNew}><IconPlus size={18} /> {createLabel ?? `New ${noun}`}</button>}</>} />

      {(searchPlaceholder || filters.length > 0) && (
        <div className="toolbar">
          {searchPlaceholder && <SearchBox value={q} onChange={setQ} placeholder={searchPlaceholder} />}
          {filters.map((f) => (
            <label key={f.name} className="filter">
              <span className="sr-only">{f.label}</span>
              <select value={filterVals[f.name] ?? ""} onChange={(e) => setFilterVals({ ...filterVals, [f.name]: e.target.value })} aria-label={f.label}>
                <option value="">{f.label}: all</option>
                {f.options.map((o) => <option key={o.value} value={o.value}>{o.label}</option>)}
              </select>
            </label>
          ))}
        </div>
      )}

      {error && !data ? <Alert>{errorMessage(error, "Could not load this list.")} <button className="link-btn" onClick={() => reload()}>Try again</button></Alert>
        : loading && !data ? <div className="table-wrap pad"><Skeleton lines={5} height={18} /></div>
        : rows?.length === 0 ? (
          <EmptyState title={q || Object.values(filterVals).some(Boolean) ? "No matches" : (empty?.title ?? `No ${noun}s yet`)}
            action={allowCreate && !q ? <button className="btn btn-primary" onClick={openNew}><IconPlus size={18} /> {createLabel ?? `New ${noun}`}</button> : null}>
            {q || Object.values(filterVals).some(Boolean) ? "Try a different search or clear the filters." : (empty?.hint ?? `Add your first ${noun} to get started.`)}
          </EmptyState>
        ) : (
          <>
            <div className="table-wrap">
              <table className="table">
                <thead><tr>{columns.map((c) => <th key={c.key} className={c.num ? "num" : ""}>{c.label}</th>)}{showActions && <th className="actions-col"><span className="sr-only">Actions</span></th>}</tr></thead>
                <tbody>
                  {rows.map((r) => (
                    <tr key={r[rowKey]}>
                      {columns.map((c) => <td key={c.key} data-label={c.label} className={c.num ? "num" : ""}>{c.render ? c.render(r) : (r[c.key] ?? "-")}</td>)}
                      {showActions && (
                        <td className="actions-col" data-label="Actions">
                          <div className="row-actions">
                            {detail && <button className="btn btn-ghost btn-sm" onClick={() => setViewing(r)}>Details</button>}
                            {rowActions?.(r, { reload: () => reload(true), toast })}
                            {allowEdit && <button className="icon-btn" onClick={() => openEdit(r)} aria-label={`Edit ${nameOf(r)}`} title="Edit"><IconEdit size={18} /></button>}
                            {allowDelete && <button className="icon-btn danger" onClick={() => setRemoving(r)} aria-label={`Delete ${nameOf(r)}`} title="Delete"><IconTrash size={18} /></button>}
                          </div>
                        </td>
                      )}
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            {paginated && <Pager page={page} count={count} pageSize={pageSize} onPage={setPage} />}
          </>
        )}

      <Modal open={Boolean(editing)} onClose={() => !saving && setEditing(null)} size="lg"
        title={editing?.row ? `Edit ${noun}` : (createLabel ?? `New ${noun}`)}
        footer={<>
          <button className="btn btn-ghost" type="button" onClick={() => setEditing(null)} disabled={saving}>Cancel</button>
          <button className="btn btn-primary" form="crud-form" disabled={saving}>{saving ? "Saving…" : editing?.row ? "Save changes" : `Create ${noun}`}</button>
        </>}>
        {editing && (
          <form id="crud-form" className="form form-grid" onSubmit={save} noValidate={false}>
            {formError && <div className="span-2"><Alert>{formError}</Alert></div>}
            {activeFields.map((f) => (
              <FieldInput key={f.name} field={f} value={editing.values[f.name]} error={errors[f.name]}
                          onChange={(v) => setEditing({ ...editing, values: { ...editing.values, [f.name]: v } })} />
            ))}
          </form>
        )}
      </Modal>

      <Confirm open={Boolean(removing)} danger busy={saving} confirmLabel={`Delete ${noun}`} title={`Delete this ${noun}?`}
               onCancel={() => setRemoving(null)} onConfirm={remove}>
        {removing ? `“${nameOf(removing)}” will be removed. This cannot be undone.` : ""}
      </Confirm>

      <Modal open={Boolean(viewing)} onClose={() => setViewing(null)} title={viewing ? nameOf(viewing) : ""} size="lg">
        {viewing && detail?.(viewing)}
      </Modal>
    </div>
  );
}

const cap = (s) => s.charAt(0).toUpperCase() + s.slice(1);

// Strips empty optional strings and converts number/json fields to real types.
function cleanPayload(values, fields) {
  const out = {};
  for (const f of fields) {
    let v = values[f.name];
    if (f.type === "number") v = v === "" || v == null ? (f.required ? v : null) : v;
    else if (f.type === "json") {
      try { v = v === "" ? {} : JSON.parse(v); } catch { return new Error(`${f.label} must be valid JSON.`); }
    } else if (f.type === "datetime") v = v ? new Date(v).toISOString() : null;
    else if (f.type === "select" && f.allowEmpty && v === "") v = null;
    out[f.name] = v;
  }
  return out;
}
export { cleanPayload, blank };
