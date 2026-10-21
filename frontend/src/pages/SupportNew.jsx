import { useMemo, useRef, useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import api, { errorMessage, fieldErrors } from "../api/client.js";
import { Accordion, Alert, PageHead } from "../components/ui.jsx";
import { useToast } from "../components/Toast.jsx";
import { useDocumentTitle, useFetch } from "../hooks.js";
import { IconCard, IconBook, IconLock, IconCode, IconHelp, IconPaperclip, IconX } from "../components/Icons.jsx";

const CATEGORIES = [
  { value: "payment", label: "Payment or invoice", hint: "Charged but locked, refunds, GST invoice", Icon: IconCard },
  { value: "course_access", label: "Course access", hint: "Cannot open a course or lesson", Icon: IconBook },
  { value: "technical", label: "Technical problem", hint: "Video, tests or page not working", Icon: IconCode },
  { value: "account", label: "Account or login", hint: "Email, password, profile", Icon: IconLock },
  { value: "other", label: "Something else", hint: "Anything not listed", Icon: IconHelp },
];

export default function SupportNew() {
  useDocumentTitle("New support request");
  const navigate = useNavigate();
  const toast = useToast();
  const faqs = useFetch("/support/faqs");
  const [form, setForm] = useState({ category: "payment", subject: "", body: "", priority: "normal" });
  const [file, setFile] = useState(null);
  const [errors, setErrors] = useState({});
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);
  const fileRef = useRef(null);
  const set = (k) => (e) => setForm({ ...form, [k]: e.target.value });

  // Offer matching answers while they type, so simple questions are solved before a ticket is needed.
  const suggestions = useMemo(() => {
    const words = form.subject.toLowerCase().split(/\W+/).filter((w) => w.length > 3);
    if (!words.length) return [];
    return (faqs.data ?? []).filter((f) => words.some((w) => (f.question + " " + f.answer).toLowerCase().includes(w))).slice(0, 3);
  }, [form.subject, faqs.data]);

  const pick = (e) => {
    const f = e.target.files?.[0];
    if (!f) return;
    if (f.size > 5 * 1024 * 1024) { setError("Attachments can be up to 5 MB."); e.target.value = ""; return; }
    setError(""); setFile(f);
  };

  const submit = async (e) => {
    e.preventDefault();
    setBusy(true); setError(""); setErrors({});
    const fd = new FormData();
    Object.entries(form).forEach(([k, v]) => fd.append(k, v));
    if (file) fd.append("attachment", file);
    try {
      const { data } = await api.post("/support/tickets", fd);
      toast.success(`Request ${data.reference} sent`);
      navigate(`/support/${data.id}`, { replace: true });
    } catch (err) {
      setErrors(fieldErrors(err));
      setError(errorMessage(err, "We could not send your request. Try again."));
    } finally { setBusy(false); }
  };

  return (
    <div className="stack-lg narrow-xl">
      <PageHead title="New support request" lead="Tell us what happened. The more detail you share, the faster we can fix it." />
      <form className="panel form" onSubmit={submit}>
        <fieldset className="field cat-field">
          <legend>What do you need help with?</legend>
          <div className="cat-grid">
            {CATEGORIES.map(({ value, label, hint, Icon }) => (
              <label key={value} className={`cat ${form.category === value ? "on" : ""}`}>
                <input type="radio" name="category" value={value} checked={form.category === value} onChange={set("category")} />
                <Icon size={20} /><strong>{label}</strong><span>{hint}</span>
              </label>
            ))}
          </div>
        </fieldset>

        <div className="field">
          <label htmlFor="sb">Subject</label>
          <input id="sb" required minLength={5} maxLength={200} value={form.subject} onChange={set("subject")} placeholder="e.g. Payment deducted but courses are locked" />
          {errors.subject && <span className="field-error">{errors.subject}</span>}
        </div>

        {suggestions.length > 0 && (
          <div className="suggest" aria-live="polite">
            <strong>These answers might help</strong>
            <Accordion items={suggestions} />
          </div>
        )}

        <div className="field">
          <label htmlFor="bd">Describe the problem</label>
          <textarea id="bd" required minLength={10} maxLength={5000} rows={7} value={form.body} onChange={set("body")}
                    placeholder="What were you trying to do? What happened instead? Include your payment ID or the lesson name if it helps." />
          {errors.body && <span className="field-error">{errors.body}</span>}
        </div>

        <div className="form-row">
          <div className="field">
            <label htmlFor="pr">How urgent is it?</label>
            <select id="pr" value={form.priority} onChange={set("priority")}>
              <option value="low">Low: a question</option>
              <option value="normal">Normal: something is wrong</option>
              <option value="high">High: I am blocked</option>
            </select>
          </div>
          <div className="field">
            <label htmlFor="at">Attachment <span className="optional">optional</span></label>
            <div className="filepick">
              <input id="at" ref={fileRef} type="file" accept=".png,.jpg,.jpeg,.gif,.webp,.pdf,.txt,.zip,.doc,.docx" onChange={pick} className="sr-only" />
              <button type="button" className="btn btn-ghost" onClick={() => fileRef.current?.click()}><IconPaperclip size={18} /> {file ? "Change file" : "Add screenshot or file"}</button>
              {file && <span className="chip">{file.name}<button type="button" aria-label="Remove file" onClick={() => { setFile(null); fileRef.current.value = ""; }}><IconX size={14} /></button></span>}
            </div>
            <span className="hint">Images, PDF, Word, text or ZIP up to 5 MB.</span>
          </div>
        </div>

        {error && <Alert>{error}</Alert>}
        <div className="row gap form-actions">
          <button className="btn btn-primary btn-lg" disabled={busy}>{busy ? "Sending…" : "Send request"}</button>
          <Link className="btn btn-ghost btn-lg" to="/support">Cancel</Link>
        </div>
      </form>
    </div>
  );
}
