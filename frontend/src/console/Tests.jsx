import { Link } from "react-router-dom";
import CrudPage from "../components/CrudPage.jsx";
import { StatusPill } from "../components/ui.jsx";
import { IconTest } from "../components/Icons.jsx";

export default function Tests() {
  return (
    <CrudPage title="Tests" lead="Timed multiple-choice tests attached to a course. Create the test here, then open it to write questions." noun="test" endpoint="/admin-api/tests"
      searchPlaceholder="Search tests or courses" createLabel="New test"
      filters={[{ name: "is_published", label: "Visibility", options: [{ value: "true", label: "Published" }, { value: "false", label: "Draft" }] }]}
      columns={[
        { key: "title", label: "Test", render: (t) => <div className="cell-stack"><Link to={`/console/tests/${t.id}`}><strong>{t.title}</strong></Link><span>{t.course_title}</span></div> },
        { key: "question_count", label: "Questions", num: true },
        { key: "duration_minutes", label: "Time", num: true, render: (t) => `${t.duration_minutes} min` },
        { key: "pass_percent", label: "Pass mark", num: true, render: (t) => `${t.pass_percent}%` },
        { key: "attempts_count", label: "Attempts", num: true },
        { key: "is_published", label: "Visibility", render: (t) => <StatusPill value={t.is_published ? "published" : "draft"} /> },
      ]}
      fields={testFields}
      toForm={(t) => ({ ...t, module: t.module ?? "" })}
      rowActions={(t) => <Link className="btn btn-ghost btn-sm" to={`/console/tests/${t.id}`}><IconTest size={16} /> Questions</Link>} />
  );
}

export const testFields = [
  { name: "title", label: "Title", required: true, span: 2 },
  { name: "course", label: "Course", type: "select", required: true, allowEmpty: true, emptyLabel: "Choose a course", optionsFrom: { url: "/admin-api/courses", value: "id", label: "title" } },
  { name: "duration_minutes", label: "Time limit (minutes)", type: "number", min: 1, required: true, default: 30 },
  { name: "pass_percent", label: "Pass mark (%)", type: "number", min: 1, max: 100, required: true, default: 50 },
  { name: "max_attempts", label: "Attempts allowed", type: "number", min: 1, required: true, default: 3 },
  { name: "is_published", label: "Published", type: "checkbox", span: 2, default: true, help: "Students can only take published tests." },
];
