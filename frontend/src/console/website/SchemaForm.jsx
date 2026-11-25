import { useId } from "react";
import { IconArrowDown, IconArrowUp, IconPlus, IconTrash } from "../../components/Icons.jsx";
import ImagePicker from "./ImagePicker.jsx";

const msgOf = (e) => (typeof e === "string" ? e : Array.isArray(e) && typeof e[0] === "string" ? e[0] : null);
const blankOf = (fields) => Object.fromEntries(fields.map((f) => [f.name, f.type === "list" ? [] : f.type === "bool" ? Boolean(f.default) : f.default ?? ""]));

/**
 * Renders any form described by the backend schema (text, textarea, url, number, select, bool, image, list).
 * errors mirrors the shape of values: { field: "message", list: [{ field: "message" }, {}] }.
 */
export default function SchemaForm({ fields, values, onChange, errors = {} }) {
  const set = (name, v) => onChange({ ...values, [name]: v });
  return (
    <div className="sf">
      {fields.map((f) => <SchemaField key={f.name} spec={f} value={values[f.name]} error={errors?.[f.name]} onChange={(v) => set(f.name, v)} />)}
    </div>
  );
}

function SchemaField({ spec, value, error, onChange }) {
  const uid = useId();
  const id = `${uid}-${spec.name}`;
  const msg = spec.type === "list" ? null : msgOf(error);
  const describe = msg ? `${id}-err` : spec.help ? `${id}-help` : undefined;
  const footer = msg ? <span className="field-error" id={`${id}-err`}>{msg}</span> : spec.help ? <span className="hint" id={`${id}-help`}>{spec.help}</span> : null;
  const label = <>{spec.label}{!spec.required && spec.type !== "bool" && <span className="optional">optional</span>}</>;
  const common = { id, "aria-invalid": Boolean(msg), "aria-describedby": describe };

  switch (spec.type) {
    case "bool":
      return (
        <div className="field field-check">
          <label className="check" htmlFor={id}><input {...common} type="checkbox" checked={Boolean(value)} onChange={(e) => onChange(e.target.checked)} /><span><strong>{spec.label}</strong>{spec.help && <small>{spec.help}</small>}</span></label>
        </div>
      );
    case "image":
      return <ImagePicker label={spec.label} help={spec.help} value={value} error={msg} onChange={onChange} />;
    case "select":
      return (
        <div className="field"><label htmlFor={id}>{label}</label>
          <select {...common} value={value ?? ""} onChange={(e) => onChange(e.target.value)}>{spec.options.map((o) => <option key={o.value} value={o.value}>{o.label}</option>)}</select>{footer}</div>
      );
    case "number":
      return (
        <div className="field"><label htmlFor={id}>{label}</label>
          <input {...common} type="number" min={spec.min} max={spec.max} inputMode="numeric" value={value ?? ""} onChange={(e) => onChange(e.target.value === "" ? "" : Number(e.target.value))} />{footer}</div>
      );
    case "textarea":
      return (
        <div className="field"><label htmlFor={id}>{label}</label>
          <textarea {...common} rows={3} value={value ?? ""} onChange={(e) => onChange(e.target.value)} />
          <span className="counter" aria-hidden>{(value ?? "").length}/{spec.max}</span>{footer}</div>
      );
    case "list":
      return <ListField spec={spec} value={value ?? []} error={error} onChange={onChange} label={label} />;
    default:
      return (
        <div className="field"><label htmlFor={id}>{label}</label>
          <input {...common} type="text" value={value ?? ""} maxLength={spec.max + 40} placeholder={spec.type === "url" ? "/pricing or https://…" : undefined} onChange={(e) => onChange(e.target.value)} />
          {spec.type === "text" && spec.max <= 160 && <span className="counter" aria-hidden>{(value ?? "").length}/{spec.max}</span>}{footer}</div>
      );
  }
}

function ListField({ spec, value, onChange, error, label }) {
  const move = (i, d) => { const n = [...value]; const j = i + d; if (j < 0 || j >= n.length) return; [n[i], n[j]] = [n[j], n[i]]; onChange(n); };
  const listMsg = msgOf(error);
  const itemErrors = Array.isArray(error) && typeof error[0] === "object" ? error : [];
  return (
    <fieldset className="field sf-list">
      <legend>{label}</legend>
      {value.length === 0 && <p className="hint">Nothing here yet.</p>}
      {value.map((item, i) => (
        <div key={i} className="sf-item">
          <div className="sf-item-head">
            <strong>{spec.item_label} {i + 1}</strong>
            <span className="row">
              <button type="button" className="icon-btn" disabled={i === 0} onClick={() => move(i, -1)} aria-label={`Move ${spec.item_label.toLowerCase()} ${i + 1} up`}><IconArrowUp size={16} /></button>
              <button type="button" className="icon-btn" disabled={i === value.length - 1} onClick={() => move(i, 1)} aria-label={`Move ${spec.item_label.toLowerCase()} ${i + 1} down`}><IconArrowDown size={16} /></button>
              <button type="button" className="icon-btn danger" onClick={() => onChange(value.filter((_, k) => k !== i))} aria-label={`Remove ${spec.item_label.toLowerCase()} ${i + 1}`}><IconTrash size={16} /></button>
            </span>
          </div>
          <SchemaForm fields={spec.fields} values={item} errors={itemErrors[i] || {}} onChange={(v) => onChange(value.map((x, k) => (k === i ? v : x)))} />
        </div>
      ))}
      <div><button type="button" className="btn btn-ghost btn-sm" disabled={value.length >= spec.max_items} onClick={() => onChange([...value, blankOf(spec.fields)])}><IconPlus size={16} /> Add {spec.item_label.toLowerCase()}</button>
        {value.length >= spec.max_items && <span className="hint"> Maximum of {spec.max_items} reached.</span>}</div>
      {listMsg && <span className="field-error">{listMsg}</span>}
    </fieldset>
  );
}
