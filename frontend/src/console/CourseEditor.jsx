import { useCallback, useEffect, useState } from "react";
import { Link, useParams } from "react-router-dom";
import api, { errorMessage, fieldErrors } from "../api/client.js";
import { Alert, EmptyState, Spinner, StatusPill } from "../components/ui.jsx";
import Modal, { Confirm } from "../components/Modal.jsx";
import { FieldInput } from "../components/FormFields.jsx";
import { useToast } from "../components/Toast.jsx";
import { useDocumentTitle } from "../hooks.js";
import { IconArrowDown, IconArrowLeft, IconArrowUp, IconEdit, IconPlus, IconTrash } from "../components/Icons.jsx";

const TYPES = [{ value: "video", label: "Video" }, { value: "note", label: "Note" }, { value: "practice", label: "Practice" }, { value: "project", label: "Project" }, { value: "test", label: "Test" }];
const LESSON_FIELDS = [
  { name: "title", label: "Lesson title", required: true, span: 2 },
  { name: "lesson_type", label: "Type", type: "select", options: TYPES, required: true },
  { name: "duration_seconds", label: "Duration (minutes)", type: "number", min: 0, help: "Shown to students next to the lesson." },
  { name: "video_path", label: "Video path", span: 2, placeholder: "/courses/python/intro/playlist.m3u8", help: "The path of the HLS playlist on your video storage. Leave empty for non-video lessons." },
  { name: "note_content", label: "Notes", type: "textarea", rows: 6, span: 2, help: "Students see this next to the lesson. Plain text or code." },
  { name: "is_free_preview", label: "Free preview", type: "checkbox", help: "Anyone can watch it without buying." },
  { name: "is_published", label: "Published", type: "checkbox", default: true },
];

export default function CourseEditor() {
  const { id } = useParams();
  const toast = useToast();
  const [data, setData] = useState(null);
  const [error, setError] = useState("");
  const [moduleForm, setModuleForm] = useState(null); // {id?, title}
  const [lessonForm, setLessonForm] = useState(null); // {moduleId, lesson?, values}
  const [errors, setErrors] = useState({});
  const [formError, setFormError] = useState("");
  const [saving, setSaving] = useState(false);
  const [removing, setRemoving] = useState(null); // {kind, item}
  useDocumentTitle(data ? `${data.course.title} curriculum` : "Course");

  const load = useCallback(async () => {
    try { setData((await api.get(`/admin-api/courses/${id}/curriculum`)).data); }
    catch (e) { setError(errorMessage(e, "Could not load this course.")); }
  }, [id]);
  useEffect(() => { load(); }, [load]);

  const togglePublish = async () => {
    try { await api.patch(`/admin-api/courses/${id}`, { is_published: !data.course.is_published }); toast.success(data.course.is_published ? "Course unpublished" : "Course published"); load(); }
    catch (e) { toast.error(errorMessage(e)); }
  };

  const saveModule = async (e) => {
    e.preventDefault(); setSaving(true);
    try {
      if (moduleForm.id) await api.patch(`/admin-api/modules/${moduleForm.id}`, { title: moduleForm.title });
      else await api.post("/admin-api/modules", { course: id, title: moduleForm.title, order: data.modules.length + 1 });
      toast.success(moduleForm.id ? "Module renamed" : "Module added"); setModuleForm(null); load();
    } catch (err) { toast.error(errorMessage(err)); } finally { setSaving(false); }
  };

  const openLesson = (module, lesson) => {
    setErrors({}); setFormError("");
    const blankV = { title: "", lesson_type: "video", duration_seconds: "", video_path: "", note_content: "", is_free_preview: false, is_published: true };
    setLessonForm({ module, lesson, values: lesson ? { ...blankV, ...lesson, duration_seconds: lesson.duration_seconds ? Math.round(lesson.duration_seconds / 60) : "" } : blankV });
  };
  const saveLesson = async (e) => {
    e.preventDefault(); setSaving(true); setErrors({}); setFormError("");
    const v = lessonForm.values;
    const payload = { title: v.title, lesson_type: v.lesson_type, duration_seconds: Math.round(Number(v.duration_seconds || 0) * 60), video_path: v.video_path, note_content: v.note_content, is_free_preview: v.is_free_preview, is_published: v.is_published };
    try {
      if (lessonForm.lesson) await api.patch(`/admin-api/lessons/${lessonForm.lesson.id}`, payload);
      else await api.post("/admin-api/lessons", { ...payload, module: lessonForm.module.id, order: lessonForm.module.lessons.length + 1 });
      toast.success(lessonForm.lesson ? "Lesson saved" : "Lesson added"); setLessonForm(null); load();
    } catch (err) { setErrors(fieldErrors(err)); setFormError(err.response?.data?.detail || "Fix the highlighted fields and save again."); }
    finally { setSaving(false); }
  };

  const move = async (kind, list, index, dir) => {
    const ids = list.map((x) => x.id);
    const j = index + dir;
    if (j < 0 || j >= ids.length) return;
    [ids[index], ids[j]] = [ids[j], ids[index]];
    // optimistic reorder, then persist
    try { await api.post(`/admin-api/${kind}/reorder`, { ids }); load(); } catch (e) { toast.error(errorMessage(e)); }
  };

  const remove = async () => {
    setSaving(true);
    try { await api.delete(`/admin-api/${removing.kind}/${removing.item.id}`); toast.success("Deleted"); setRemoving(null); load(); }
    catch (e) { toast.error(errorMessage(e)); } finally { setSaving(false); }
  };

  if (error) return <div className="stack"><Alert>{error}</Alert><Link className="link-btn" to="/console/courses"><IconArrowLeft size={16} /> Back to courses</Link></div>;
  if (!data) return <Spinner label="Loading curriculum…" />;
  const { course, modules } = data;

  return (
    <div className="stack-lg">
      <Link className="link-btn" to="/console/courses"><IconArrowLeft size={16} /> All courses</Link>
      <header className="page-head">
        <div>
          <h1>{course.title}</h1>
          <p className="lead">{course.modules_count} modules · {course.lessons_count} lessons · {course.enrolled_count} students</p>
        </div>
        <div className="row gap">
          <StatusPill value={course.is_published ? "published" : "draft"} />
          <button className="btn btn-ghost" onClick={togglePublish}>{course.is_published ? "Unpublish" : "Publish course"}</button>
          <button className="btn btn-primary" onClick={() => setModuleForm({ title: "" })}><IconPlus size={18} /> Add module</button>
        </div>
      </header>

      {modules.length === 0 ? (
        <EmptyState title="No modules yet" action={<button className="btn btn-primary" onClick={() => setModuleForm({ title: "" })}><IconPlus size={18} /> Add the first module</button>}>
          Group lessons into modules, such as “Getting started” or “Functions and loops”.
        </EmptyState>
      ) : modules.map((m, mi) => (
        <section key={m.id} className="panel module-panel">
          <div className="panel-head">
            <h2>{m.title}</h2>
            <div className="row-actions">
              <button className="icon-btn" aria-label="Move module up" disabled={mi === 0} onClick={() => move("modules", modules, mi, -1)}><IconArrowUp size={18} /></button>
              <button className="icon-btn" aria-label="Move module down" disabled={mi === modules.length - 1} onClick={() => move("modules", modules, mi, 1)}><IconArrowDown size={18} /></button>
              <button className="icon-btn" aria-label="Rename module" onClick={() => setModuleForm({ id: m.id, title: m.title })}><IconEdit size={18} /></button>
              <button className="icon-btn danger" aria-label="Delete module" onClick={() => setRemoving({ kind: "modules", item: m })}><IconTrash size={18} /></button>
            </div>
          </div>
          {m.lessons.length === 0 ? <p className="muted">No lessons in this module.</p> : (
            <ol className="lesson-rows">
              {m.lessons.map((l, li) => (
                <li key={l.id}>
                  <span className="lesson-type">{l.lesson_type}</span>
                  <div className="lesson-info">
                    <strong>{l.title}</strong>
                    <span>{l.duration_seconds ? `${Math.round(l.duration_seconds / 60)} min` : "No duration"}{l.video_path ? " · video linked" : ""}{l.note_content ? " · has notes" : ""}</span>
                  </div>
                  {l.is_free_preview && <span className="pill pill-info">Free preview</span>}
                  {!l.is_published && <span className="pill pill-neutral">Hidden</span>}
                  <div className="row-actions">
                    <button className="icon-btn" aria-label="Move lesson up" disabled={li === 0} onClick={() => move("lessons", m.lessons, li, -1)}><IconArrowUp size={18} /></button>
                    <button className="icon-btn" aria-label="Move lesson down" disabled={li === m.lessons.length - 1} onClick={() => move("lessons", m.lessons, li, 1)}><IconArrowDown size={18} /></button>
                    <button className="icon-btn" aria-label={`Edit ${l.title}`} onClick={() => openLesson(m, l)}><IconEdit size={18} /></button>
                    <button className="icon-btn danger" aria-label={`Delete ${l.title}`} onClick={() => setRemoving({ kind: "lessons", item: l })}><IconTrash size={18} /></button>
                  </div>
                </li>
              ))}
            </ol>
          )}
          <button className="btn btn-ghost btn-sm" onClick={() => openLesson(m, null)}><IconPlus size={16} /> Add lesson</button>
        </section>
      ))}

      <Modal open={Boolean(moduleForm)} onClose={() => setModuleForm(null)} size="sm" title={moduleForm?.id ? "Rename module" : "New module"} busy={saving}
        footer={<><button className="btn btn-ghost" onClick={() => setModuleForm(null)}>Cancel</button><button className="btn btn-primary" form="module-form" disabled={saving || !moduleForm?.title.trim()}>{saving ? "Saving…" : "Save module"}</button></>}>
        <form id="module-form" onSubmit={saveModule} className="form">
          <FieldInput field={{ name: "title", label: "Module title", required: true }} value={moduleForm?.title} onChange={(v) => setModuleForm({ ...moduleForm, title: v })} />
        </form>
      </Modal>

      <Modal open={Boolean(lessonForm)} onClose={() => !saving && setLessonForm(null)} size="lg" busy={saving}
        title={lessonForm?.lesson ? "Edit lesson" : `New lesson in ${lessonForm?.module.title ?? ""}`}
        footer={<><button className="btn btn-ghost" onClick={() => setLessonForm(null)} disabled={saving}>Cancel</button><button className="btn btn-primary" form="lesson-form" disabled={saving}>{saving ? "Saving…" : "Save lesson"}</button></>}>
        {lessonForm && (
          <form id="lesson-form" onSubmit={saveLesson} className="form form-grid">
            {formError && <div className="span-2"><Alert>{formError}</Alert></div>}
            {LESSON_FIELDS.map((f) => <FieldInput key={f.name} field={f} value={lessonForm.values[f.name]} error={errors[f.name]}
              onChange={(v) => setLessonForm({ ...lessonForm, values: { ...lessonForm.values, [f.name]: v } })} />)}
          </form>
        )}
      </Modal>

      <Confirm open={Boolean(removing)} danger busy={saving} confirmLabel="Delete" title={`Delete this ${removing?.kind === "modules" ? "module" : "lesson"}?`} onCancel={() => setRemoving(null)} onConfirm={remove}>
        {removing?.kind === "modules" ? `“${removing?.item.title}” and all of its lessons will be removed from the course.` : `“${removing?.item.title}” will be removed from the course.`}
      </Confirm>
    </div>
  );
}
