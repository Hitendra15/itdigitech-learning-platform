import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import api from "../api/client.js";
import { useAuth } from "../auth/AuthContext.jsx";
import { CourseCover, EmptyState, ProgressRing, Spinner } from "../components/ui.jsx";
import { IconArrowRight, IconPlay } from "../components/Icons.jsx";

const greeting = () => {
  const h = new Date().getHours();
  return h < 12 ? "Good morning" : h < 17 ? "Good afternoon" : "Good evening";
};

export default function Dashboard() {
  const { user } = useAuth();
  const [courses, setCourses] = useState(null);
  const [resume, setResume] = useState(null);

  useEffect(() => {
    api.get("/my/courses").then((r) => setCourses(r.data));
    api.get("/my/continue-learning").then((r) => setResume(r.data));
  }, []);

  if (!courses) return <Spinner label="Loading your courses…" />;

  const first = (user?.profile?.full_name || "").split(" ")[0];
  const avg = courses.length ? Math.round(courses.reduce((s, c) => s + (c.progress || 0), 0) / courses.length) : 0;
  const done = courses.filter((c) => c.progress >= 100).length;

  return (
    <div className="stack-lg">
      <header className="page-head">
        <div>
          <h1>{greeting()}{first ? `, ${first}` : ""}</h1>
          <p className="lead">
            {courses.length === 0
              ? "You have no active courses yet."
              : `You are enrolled in ${courses.length} ${courses.length === 1 ? "course" : "courses"} and ${avg}% through on average.`}
          </p>
        </div>
      </header>

      {resume && (
        <Link className="resume" to={`/learn/${resume.course_slug}?lesson=${resume.lesson_id}`}>
          <div className="resume-play"><IconPlay size={22} /></div>
          <div className="resume-text">
            <span className="resume-kicker">Continue learning</span>
            <strong>{resume.lesson_title}</strong>
            <span>{resume.course_title}</span>
          </div>
          <span className="resume-cta">Resume lesson <IconArrowRight size={18} /></span>
        </Link>
      )}

      {courses.length > 0 && (
        <section aria-labelledby="courses-h">
          <div className="section-head">
            <h2 id="courses-h">Your courses</h2>
            {courses.length > 1 && <span className="muted small">{done} of {courses.length} finished</span>}
          </div>
          <ul className="course-grid">
            {courses.map((c) => (
              <li key={c.id}>
                <Link to={`/learn/${c.slug}`} className="course-card">
                  <CourseCover title={c.title} level={c.level} />
                  <div className="course-body">
                    <h3>{c.title}</h3>
                    <p className="clamp">{c.description}</p>
                  </div>
                  <div className="course-foot">
                    <div className="bar" role="progressbar" aria-valuenow={c.progress} aria-valuemin={0} aria-valuemax={100} aria-label={`${c.title} progress`}>
                      <span style={{ width: `${c.progress}%` }} />
                    </div>
                    <div className="course-meta">
                      <strong>{c.progress}%</strong>
                      <span>{c.expires_at ? `Access until ${new Date(c.expires_at).toLocaleDateString("en-IN", { day: "numeric", month: "short", year: "numeric" })}` : "Lifetime access"}</span>
                    </div>
                  </div>
                </Link>
              </li>
            ))}
          </ul>
        </section>
      )}

      {courses.length === 0 && (
        <EmptyState title="Nothing to learn yet" action={<Link className="btn btn-primary" to="/plans">Choose a plan</Link>}>
          Pick a plan and your courses will appear here the moment payment goes through.
        </EmptyState>
      )}
    </div>
  );
}
