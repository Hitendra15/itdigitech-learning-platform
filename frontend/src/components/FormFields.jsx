import { useId } from "react";
import { useFetch } from "../hooks.js";

// Renders one field from a schema: text | textarea | number | checkbox | select | multiselect | datetime | json
export function FieldInput({ field, value, onChange, error }) {
  const uid = useId();
  const id = `${uid}-${field.name}`;
  const common = { id, "aria-invalid": Boolean(error), "aria-describedby": error ? `${id}-err` : field.help ? `${id}-help` : undefined };
  const opts = useOptions(field);

  let control;
  switch (field.type) {
    case "textarea":
      control = <textarea {...common} rows={field.rows ?? 4} value={value ?? ""} placeholder={field.placeholder}
                          onChange={(e) => onChange(e.target.value)} required={field.required} />;
      break;
    case "number":
      control = <input {...common} type="number" step={field.step ?? "1"} min={field.min} max={field.max} inputMode="decimal"
                       value={value ?? ""} placeholder={field.placeholder} required={field.required}
                       onChange={(e) => onChange(e.target.value === "" ? "" : e.target.value)} />;
      break;
    case "checkbox":
      return (
        <div className={`field field-check ${field.span === 2 ? "span-2" : ""}`}>
          <label className="check" htmlFor={id}>
            <input {...common} type="checkbox" checked={Boolean(value)} onChange={(e) => onChange(e.target.checked)} />
            <span><strong>{field.label}</strong>{field.help && <small id={`${id}-help`}>{field.help}</small>}</span>
          </label>
        </div>
      );
    case "select":
      control = (
        <select {...common} value={value ?? ""} onChange={(e) => onChange(e.target.value)} required={field.required}>
          {field.allowEmpty && <option value="">{field.emptyLabel ?? "None"}</option>}
          {opts.map((o) => <option key={o.value} value={o.value}>{o.label}</option>)}
        </select>
      );
      break;
    case "multiselect": {
      const sel = new Set(value ?? []);
      control = (
        <div className="checklist" role="group" aria-labelledby={`${id}-l`}>
          {opts.length === 0 && <span className="muted small">Nothing to choose from yet.</span>}
          {opts.map((o) => (
            <label key={o.value} className="check">
              <input type="checkbox" checked={sel.has(o.value)}
                     onChange={(e) => { const n = new Set(sel); e.target.checked ? n.add(o.value) : n.delete(o.value); onChange([...n]); }} />
              <span>{o.label}</span>
            </label>
          ))}
        </div>
      );
      break;
    }
    case "datetime":
      control = <input {...common} type="datetime-local" value={value ?? ""} onChange={(e) => onChange(e.target.value)} />;
      break;
    case "json":
      control = <textarea {...common} className="mono" rows={field.rows ?? 5} spellCheck={false} value={value ?? ""} onChange={(e) => onChange(e.target.value)} />;
      break;
    default:
      control = <input {...common} type={field.inputType ?? "text"} value={value ?? ""} placeholder={field.placeholder}
                       onChange={(e) => onChange(e.target.value)} required={field.required} disabled={field.disabled}
                       autoComplete="off" />;
  }

  return (
    <div className={`field ${field.span === 2 ? "span-2" : ""}`}>
      <label id={`${id}-l`} htmlFor={id}>{field.label}{!field.required && field.type !== "multiselect" && <span className="optional">optional</span>}</label>
      {control}
      {error ? <span className="field-error" id={`${id}-err`}>{error}</span>
             : field.help && <span className="hint" id={`${id}-help`}>{field.help}</span>}
    </div>
  );
}

function useOptions(field) {
  const src = field.optionsFrom;
  const { data } = useFetch(src ? src.url : null, src ? { page_size: 100 } : undefined);
  if (src) {
    const rows = data?.results ?? data ?? [];
    return rows.map((r) => ({ value: String(r[src.value ?? "id"]), label: r[src.label ?? "title"] }));
  }
  return (field.options ?? []).map((o) => (typeof o === "string" ? { value: o, label: o } : { value: String(o.value), label: o.label }));
}

// ISO <-> <input type="datetime-local">
export const toLocalInput = (iso) => {
  if (!iso) return "";
  const d = new Date(iso);
  const p = (n) => String(n).padStart(2, "0");
  return `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())}T${p(d.getHours())}:${p(d.getMinutes())}`;
};
export const fromLocalInput = (v) => (v ? new Date(v).toISOString() : null);
