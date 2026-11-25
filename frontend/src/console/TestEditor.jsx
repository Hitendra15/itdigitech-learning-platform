import { useCallback, useEffect, useState } from "react";
import { Link, useParams } from "react-router-dom";
import api, { errorMessage, fieldErrors, fmtDate } from "../api/client.js";
import CrudPage, { cleanPayload } from "../components/CrudPage.jsx";
import { Alert, EmptyState, Spinner, StatusPill } from "../components/ui.jsx";
import Modal, { Confirm } from "../components/Modal.jsx";
import { FieldInput } from "../components/FormFields.jsx";
import { useToast } from "../components/Toast.jsx";
import { useDocumentTitle } from "../hooks.js";
import { IconArrowDown, IconArrowLeft, IconArrowUp, IconEdit, IconPlus, IconTrash } from "../components/Icons.jsx";
import { testFields } from "./Tests.jsx";

const LETTERS = "abcdefghijklmnopqrstuvwxyz";
const newQ = () => ({ text: "", explanation: "", marks: 1, options: [{ id: "a", text: "" }, { id: "b", text: "" }], correct: [] });

export default function TestEditor() {
  const { id } = useParams();
  const toast = useToast();
  const [test, setTest] = useState(null);
  const [questions, setQuestions] = useState(null);
  const [error, setError] = useState("");
  const [tab, setTab] = useState("questions");
  const [editing, setEditing] = useState(null);
  const [errors, setErrors] = useState({});
  const [formError, setFormError] = useState("");
  const [saving, setSaving] = useState(false);
  const [removing, setRemoving] = useState(null);
  const [settings, setSettings] = useState(null);
  useDocumentTitle(test ? `${test.title} questions` : "Test");

  const load = useCallback(async () => {
    try {
      const [t, q] = await Promise.all([api.get(`/admin-api/tests/${id}`), api.get("/admin-api/questions", { params: { test: id } })]);
      setTest(t.data); setQuestions(q.data);
    } catch (e) { setError(errorMessage(e, "Could not load this test.")); }
  }, [id]);
  useEffect(() => { load(); }, [load]);

  const open = (q) => {
    setErrors({}); setFormError("");
    setEditing(q ? { id: q.id, text: q.text, explanation: q.explanation, marks: q.marks, options: q.options.map((o) => ({ ...o })), correct: q.correct_answer.map(String) } : newQ());
  };
  const setOpt = (i, text) => setEditing({ ...editing, options: editing.options.map((o, j) => (j === i ? { ...o, text } : o)) });
  const toggleCorrect = (oid) => {
    const has = editing.correct.includes(oid);
    setEditing({ ...editing, correct: has ? editing.correct.filter((c) => c !== oid) : [...editing.correct, oid] });
  };
  const addOpt = () => {
    const used = new Set(editing.options.map((o) => o.id));
    const nid = [...LETTERS].find((l) => !used.has(l));
    if (nid) setEditing({ ...editing, options: [...editing.options, { id: nid, text: "" }] });
  };
  const delOpt = (i) => {
    const gone = editing.options[i].id;
    setEditing({ ...editing, options: editing.options.filter((_, j) => j !== i), correct: editing.correct.filter((c) => c !== gone) });
  };

  const save = async (e) => {
    e.preventDefault(); setErrors({}); setFormError("");
    if (!editing.correct.length) { setFormError("Tick at least one correct answer."); return; }
    if (editing.options.some((o) => !o.text.trim())) { setFormError("Every option needs some text. Remove the empty ones."); return; }
    setSaving(true);
    const payload = { test: id, text: editing.text, explanation: editing.explanation, marks: Number(editing.marks || 1), options: editing.options, correct_answer: editing.correct };
    try {
      if (editing.id) await api.patch(`/admin-api/questions/${editing.id}`, payload);
      else await api.post("/admin-api/questions", { ...payload, order: (questions?.length ?? 0) + 1 });
      toast.success(editing.id ? "Question saved" : "Question added"); setEditing(null); load();
    } catch (err) { const fe = fieldErrors(err); setErrors(fe); setFormError(fe.options || fe.correct_answer || err.response?.data?.detail || "Fix the highlighted fields and save again."); }
    finally { setSaving(false); }
  };

  const move = async (i, dir) => {
    const ids = questions.map((q) => q.id); const j = i + dir;
    if (j < 0 || j >= ids.length) return;
    [ids[i], ids[j]] = [ids[j], ids[i]];
    try { await api.post("/admin-api/questions/reorder", { ids }); load(); } catch (e) { toast.error(errorMessage(e)); }
  };
  const remove = async () => {
    setSaving(true);
    try { await api.delete(`/admin-api/questions/${removing.id}`); toast.success("Question deleted"); setRemoving(null); load(); }
    catch (e) { toast.error(errorMessage(e)); } finally { setSaving(false); }
  };

  const saveSettings = async (e) => {
    e.preventDefault(); setSaving(true); setErrors({});
    try { await api.patch(`/admin-api/tests/${id}`, cleanPayload(settings, testFields)); toast.success("Test settings saved"); setSettings(null); load(); }
    catch (err) { setErrors(fieldErrors(err)); } finally { setSaving(false); }
  };

  if (error) return <div className="stack"><Alert>{error}</Alert><Link className="link-btn" to="/console/tests"><IconArrowLeft size={16} /> Back to tests</Link></div>;
  if (!test || !questions) return <Spinner label="Loading test…" />;
  const total = questions.reduce((s, q) => s + q.marks, 0);

  return (
    <div className="stack-lg">
      <Link className="link-btn" to="/console/tests"><IconArrowLeft size={16} /> All tests</Link>
      <header className="page-head">
        <div><h1>{test.title}</h1><p className="lead">{test.course_title} · {questions.length} questions · {total} marks · {test.duration_minutes} min · pass at {test.pass_percent}%</p></div>
        <div className="row gap">
          <StatusPill value={test.is_published ? "published" : "draft"} />
          <button className="btn btn-ghost" onClick={() => { setErrors({}); setSettings({ ...test, module: test.module ?? "" }); }}>Test settings</button>
          <button className="btn btn-primary" onClick={() => open(null)}><IconPlus size={18} /> Add question</button>
        </div>
      </header>

      <div className="tabs" role="tablist">
        <button role="tab" aria-selected={tab === "questions"} className={tab === "questions" ? "on" : ""} onClick={() => setTab("questions")}>Questions</button>
        <button role="tab" aria-selected={tab === "results"} className={tab === "results" ? "on" : ""} onClick={() => setTab("results")}>Student results</button>
      </div>

      {tab === "results" ? (
        <div className="embedded">
          <CrudPage title="Student results" noun="attempt" endpoint="/admin-api/attempts" params={{ test: id }} allowCreate={false} allowEdit={false} allowDelete={false} searchPlaceholder="Search student"
            columns={[
              { key: "student", label: "Student" },
              { key: "score", label: "Score", num: true, render: (a) => (a.submitted_at ? `${a.score} / ${a.total_marks}` : "-") },
              { key: "passed", label: "Result", render: (a) => (a.submitted_at ? <StatusPill value={a.passed ? "passed" : "failed"} label={a.passed ? "Passed" : "Not passed"} /> : <StatusPill value="open" label="In progress" />) },
              { key: "started_at", label: "Started", render: (a) => fmtDate(a.started_at, true) },
            ]} />
        </div>
      ) : questions.length === 0 ? (
        <EmptyState title="No questions yet" action={<button className="btn btn-primary" onClick={() => open(null)}><IconPlus size={18} /> Write the first question</button>}>
          Students cannot start a test until it has questions.
        </EmptyState>
      ) : (
        <ol className="q-list">
          {questions.map((q, i) => (
            <li key={q.id} className="panel q-card">
              <div className="q-top">
                <span className="q-num">{i + 1}</span>
                <p className="q-text">{q.text}</p>
                <span className="muted small">{q.marks} {q.marks === 1 ? "mark" : "marks"}</span>
                <div className="row-actions">
                  <button className="icon-btn" aria-label="Move up" disabled={i === 0} onClick={() => move(i, -1)}><IconArrowUp size={18} /></button>
                  <button className="icon-btn" aria-label="Move down" disabled={i === questions.length - 1} onClick={() => move(i, 1)}><IconArrowDown size={18} /></button>
                  <button className="icon-btn" aria-label="Edit question" onClick={() => open(q)}><IconEdit size={18} /></button>
                  <button className="icon-btn danger" aria-label="Delete question" onClick={() => setRemoving(q)}><IconTrash size={18} /></button>
                </div>
              </div>
              <ul className="q-opts">{q.options.map((o) => <li key={o.id} className={q.correct_answer.includes(o.id) ? "right" : ""}><span>{o.id.toUpperCase()}</span>{o.text}</li>)}</ul>
              {q.explanation && <p className="muted small q-exp">Explanation: {q.explanation}</p>}
            </li>
          ))}
        </ol>
      )}

      <Modal open={Boolean(editing)} onClose={() => !saving && setEditing(null)} size="lg" busy={saving} title={editing?.id ? "Edit question" : "New question"}
        footer={<><button className="btn btn-ghost" onClick={() => setEditing(null)} disabled={saving}>Cancel</button><button className="btn btn-primary" form="q-form" disabled={saving}>{saving ? "Saving…" : "Save question"}</button></>}>
        {editing && (
          <form id="q-form" className="form" onSubmit={save}>
            {formError && <Alert>{formError}</Alert>}
            <FieldInput field={{ name: "text", label: "Question", type: "textarea", required: true, rows: 3 }} value={editing.text} error={errors.text} onChange={(v) => setEditing({ ...editing, text: v })} />
            <fieldset className="field opts-field">
              <legend>Answer options <span className="hint">Tick every correct answer. More than one tick makes it a multiple-answer question.</span></legend>
              {editing.options.map((o, i) => (
                <div key={o.id} className="opt-row">
                  <input type="checkbox" checked={editing.correct.includes(o.id)} onChange={() => toggleCorrect(o.id)} aria-label={`Option ${o.id.toUpperCase()} is correct`} />
                  <span className="opt-letter">{o.id.toUpperCase()}</span>
                  <input type="text" value={o.text} onChange={(e) => setOpt(i, e.target.value)} placeholder={`Option ${o.id.toUpperCase()}`} aria-label={`Option ${o.id.toUpperCase()} text`} />
                  <button type="button" className="icon-btn danger" aria-label={`Remove option ${o.id.toUpperCase()}`} disabled={editing.options.length <= 2} onClick={() => delOpt(i)}><IconTrash size={16} /></button>
                </div>
              ))}
              {editing.options.length < 8 && <button type="button" className="btn btn-ghost btn-sm" onClick={addOpt}><IconPlus size={16} /> Add option</button>}
            </fieldset>
            <div className="form-row">
              <FieldInput field={{ name: "marks", label: "Marks", type: "number", min: 1, required: true }} value={editing.marks} error={errors.marks} onChange={(v) => setEditing({ ...editing, marks: v })} />
            </div>
            <FieldInput field={{ name: "explanation", label: "Explanation", type: "textarea", rows: 3, help: "Shown to the student after they submit." }} value={editing.explanation} onChange={(v) => setEditing({ ...editing, explanation: v })} />
          </form>
        )}
      </Modal>

      <Modal open={Boolean(settings)} onClose={() => !saving && setSettings(null)} size="lg" title="Test settings" busy={saving}
        footer={<><button className="btn btn-ghost" onClick={() => setSettings(null)} disabled={saving}>Cancel</button><button className="btn btn-primary" form="ts-form" disabled={saving}>{saving ? "Saving…" : "Save settings"}</button></>}>
        {settings && (
          <form id="ts-form" className="form form-grid" onSubmit={saveSettings}>
            {testFields.map((f) => <FieldInput key={f.name} field={f} value={settings[f.name]} error={errors[f.name]} onChange={(v) => setSettings({ ...settings, [f.name]: v })} />)}
          </form>
        )}
      </Modal>

      <Confirm open={Boolean(removing)} danger busy={saving} confirmLabel="Delete question" title="Delete this question?" onCancel={() => setRemoving(null)} onConfirm={remove}>
        Past attempts keep their scores, but the question is removed from the test.
      </Confirm>
    </div>
  );
}
