import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import api, { fmtDate } from "../api/client.js";
import { useAuth } from "../auth/AuthContext.jsx";
import { CourseCover, EmptyState, Skeleton } from "../components/ui.jsx";
import { IconArrowRight, IconBook, IconPlay } from "../components/Icons.jsx";
import { useDocumentTitle } from "../hooks.js";

const greeting = () => {
  const h = new Date().getHours();
  return h < 12 ? "Good morning" : h < 17 ? "Good afternoon" : "Good evening";
};

export default function Dashboard() {
  useDocumentTitle("My courses");
  const { user } = useAuth();
  const [courses, setCourses] = useState(null);
  const [resume, setResume] = useState(null);

  useEffect(() => {
    api.get("/my/courses").then((r) => setCourses(r.data)).catch(() => setCourses([]));
    api.get("/my/continue-learning").then((r) => setResume(r.data)).catch(() => {});
  }, []);

  const first = (user?.profile?.full_name || "").split(" ")[0];

  if (!courses) {
    return (
      <div className="stack-lg">
        <div className="page-head"><div><h1>{greeting()}{first ? `, ${first}` : ""}</h1></div></div>
        <div className="panel"><Skeleton lines={3} height={18} /></div>
        <ul className="course-grid">{[0, 1, 2].map((i) => <li key={i} className="course-card"><div className="cover skeleton-cover" /><div className="course-body"><Skeleton lines={2} /></div></li>)}</ul>
      </div>
    );
  }

  const avg = courses.length ? Math.round(courses.reduce((s, c) => s + (c.progress || 0), 0) / courses.length) : 0;
  const finished = courses.filter((c) => c.progress >= 100).length;
  const resumeCourse = resume ? courses.find((c) => c.slug === resume.course_slug) : null;

  return (
    <div className="stack-lg">
      <header className="page-head">
        <div>
          <h1>{greeting()}{first ? `, ${first}` : ""}</h1>
          <p className="lead">
            {courses.length === 0 ? "You have no active courses yet." : `${courses.length} ${courses.length === 1 ? "course" : "courses"} in progress, ${avg}% complete on average.`}
          </p>
        </div>
        {courses.length > 0 && (
          <dl className="mini-stats">
            <div><dt>Courses</dt><dd>{courses.length}</dd></div>
            <div><dt>Average progress</dt><dd>{avg}%</dd></div>
            <div><dt>Finished</dt><dd>{finished}</dd></div>
          </dl>
        )}
      </header>

      {resume && (
        <Link className="resume" to={`/learn/${resume.course_slug}?lesson=${resume.lesson_id}`}>
          <CourseCover title={resume.course_title} className="resume-cover" />
          <div className="resume-text">
            <span className="resume-kicker">Continue where you left off</span>
            <strong>{resume.lesson_title}</strong>
            <span>{resume.course_title}</span>
            {resumeCourse && <div className="resume-bar"><div className="bar"><span style={{ width: `${resumeCourse.progress}%` }} /></div><span>{resumeCourse.progress}% of the course</span></div>}
          </div>
          <span className="btn btn-primary resume-cta"><IconPlay size={16} /> Resume lesson</span>
        </Link>
      )}

      {courses.length > 0 && (
        <section aria-labelledby="courses-h">
          <div className="section-head"><h2 id="courses-h">Your courses</h2></div>
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
                      <strong>{c.progress >= 100 ? "Completed" : c.progress > 0 ? `${c.progress}% complete` : "Not started"}</strong>
                      <span>{c.expires_at ? `Until ${fmtDate(c.expires_at)}` : "Lifetime access"}</span>
                    </div>
                  </div>
                </Link>
              </li>
            ))}
          </ul>
        </section>
      )}

      {courses.length === 0 && (
        <EmptyState icon={IconBook} title="Nothing to learn yet" action={<Link className="btn btn-primary" to="/plans">Choose a plan <IconArrowRight size={16} /></Link>}>
          Pick a plan and your courses will appear here the moment payment goes through.
        </EmptyState>
      )}
    </div>
  );
}
