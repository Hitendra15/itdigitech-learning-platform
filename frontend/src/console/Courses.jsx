import { Link } from "react-router-dom";
import CrudPage from "../components/CrudPage.jsx";
import { StatusPill } from "../components/ui.jsx";
import { IconBook } from "../components/Icons.jsx";

export default function Courses() {
  return (
    <CrudPage title="Courses" lead="Create courses, then open one to build its modules and lessons." noun="course" endpoint="/admin-api/courses"
      searchPlaceholder="Search courses" createLabel="New course"
      filters={[{ name: "is_published", label: "Visibility", options: [{ value: "true", label: "Published" }, { value: "false", label: "Draft" }] }]}
      columns={[
        { key: "title", label: "Course", render: (c) => <div className="cell-stack"><Link to={`/console/courses/${c.id}`}><strong>{c.title}</strong></Link><span>/{c.slug}</span></div> },
        { key: "is_published", label: "Visibility", render: (c) => <StatusPill value={c.is_published ? "published" : "draft"} /> },
        { key: "modules_count", label: "Modules", num: true },
        { key: "lessons_count", label: "Lessons", num: true },
        { key: "enrolled_count", label: "Students", num: true },
      ]}
      fields={[
        { name: "title", label: "Title", required: true, span: 2 },
        { name: "slug", label: "URL slug", help: "Leave empty to generate it from the title." },
        { name: "level", label: "Level", type: "select", options: [{ value: "beginner", label: "Beginner" }, { value: "intermediate", label: "Intermediate" }, { value: "advanced", label: "Advanced" }], default: "beginner", required: true },
        { name: "description", label: "Description", type: "textarea", span: 2, rows: 4 },
        { name: "is_published", label: "Published", type: "checkbox", span: 2, help: "Students can only see published courses." },
      ]}
      toPayload={(v) => ({ title: v.title, slug: v.slug, level: v.level, description: v.description, is_published: v.is_published })}
      rowActions={(c) => <Link className="btn btn-ghost btn-sm" to={`/console/courses/${c.id}`}><IconBook size={16} /> Curriculum</Link>} />
  );
}
