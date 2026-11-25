import { useCallback, useEffect, useState } from "react";
import { Link, useParams, useSearchParams } from "react-router-dom";
import api, { errorMessage } from "../api/client.js";
import { Alert, Spinner, durationLabel } from "../components/ui.jsx";
import CertificateCard from "../components/CertificateCard.jsx";
import PracticePanel from "../lab/PracticePanel.jsx";
import { IconArrowLeft, IconArrowRight, IconCheck, IconChevronDown, IconClock, IconDownload, IconFile, IconPlay, IconTest } from "../components/Icons.jsx";

export default function CoursePlayer() {
  const { slug } = useParams();
  const [params, setParams] = useSearchParams();
  const [curriculum, setCurriculum] = useState(null);
  const [tests, setTests] = useState([]);
  const [lesson, setLesson] = useState(null);
  const [video, setVideo] = useState(null);
  const [error, setError] = useState("");
  const [courseProgress, setCourseProgress] = useState(null);
  const [marking, setMarking] = useState(false);
  const [certKey, setCertKey] = useState(0);

  const loadCurriculum = useCallback(async () => {
    try {
      const { data } = await api.get(`/my/courses/${slug}/curriculum`);
      setCurriculum(data);
    } catch (err) {
      setError(errorMessage(err));
    }
  }, [slug]);

  useEffect(() => {
    loadCurriculum();
    api.get(`/courses/${slug}/tests`).then((r) => setTests(r.data)).catch(() => {});
  }, [slug, loadCurriculum]);

  const lessonId = params.get("lesson");

  // Default to the first lesson if none selected
  useEffect(() => {
    if (curriculum && !lessonId) {
      const first = curriculum.modules.flatMap((m) => m.lessons)[0];
      if (first) setParams({ lesson: first.id }, { replace: true });
    }
  }, [curriculum, lessonId, setParams]);

  useEffect(() => {
    if (!lessonId) return;
    setLesson(null);
    setVideo(null);
    api.get(`/lessons/${lessonId}`).then((r) => setLesson(r.data)).catch((e) => setError(errorMessage(e)));
    api.get(`/lessons/${lessonId}/video`).then((r) => setVideo(r.data)).catch(() => setVideo(null));
  }, [lessonId]);

  const markComplete = async () => {
    setMarking(true);
    try {
      const { data } = await api.post(`/lessons/${lessonId}/progress`, { completed: true });
      setCourseProgress(data.course_progress);
      await loadCurriculum();
      setCertKey((k) => k + 1);
    } finally {
      setMarking(false);
    }
  };

  if (error) {
    return (
      <div className="stack">
        <Alert>{error}</Alert>
        <div><Link className="btn btn-primary" to="/plans">View plans</Link></div>
      </div>
    );
  }
  if (!curriculum) return <Spinner label="Loading course…" />;

  const all = curriculum.modules.flatMap((m) => m.lessons);
  const idx = all.findIndex((l) => l.id === lessonId);
  const current = all[idx];
  const prev = idx > 0 ? all[idx - 1] : null;
  const next = idx >= 0 && idx < all.length - 1 ? all[idx + 1] : null;
  const doneCount = all.filter((l) => l.completed).length;
  const pct = courseProgress ?? (all.length ? Math.round((doneCount / all.length) * 100) : 0);
  const go = (l) => { setParams({ lesson: l.id }); window.scrollTo({ top: 0, behavior: "smooth" }); };

  return (
    <div className="player">
      <div className="player-main">
        <nav className="crumbs" aria-label="Breadcrumb">
          <Link to="/dashboard">My courses</Link>
          <span aria-hidden>/</span>
          <span>{curriculum.course.title}</span>
        </nav>

        {!lesson ? <Spinner label="Loading lesson…" /> : (
          <article className="lesson">
            <h1>{lesson.title}</h1>
            <p className="lesson-meta">
              {idx >= 0 && <span>Lesson {idx + 1} of {all.length}</span>}
              {lesson.duration_seconds > 0 && <span><IconClock size={15} /> {durationLabel(lesson.duration_seconds)}</span>}
            </p>

            {video ? (
              <div className="video-frame">
                <video key={video.url} className="video" controls controlsList="nodownload" src={video.url}
                       onTimeUpdate={(e) => {
                         // lightweight resume position, sent at most every ~15s
                         const t = Math.floor(e.currentTarget.currentTime);
                         if (t > 0 && t % 15 === 0) api.post(`/lessons/${lessonId}/progress`, { position: t }).catch(() => {});
                       }} />
              </div>
            ) : lesson.lesson_type === "video" ? (
              <div className="video-frame video-empty">
                <IconPlay size={28} />
                <p>The video for this lesson is not available yet.</p>
              </div>
            ) : null}

            {lesson.lesson_type === "practice" && <PracticePanel lesson={lesson} />}

            {lesson.notes.map((n, i) => (
              <section key={i} className="notes">
                <h2><IconFile size={18} /> {n.title}</h2>
                {n.content && <pre>{n.content}</pre>}
                {n.file && <a className="link-btn" href={n.file} target="_blank" rel="noreferrer"><IconDownload size={16} /> Download notes (PDF)</a>}
              </section>
            ))}

            <div className="lesson-actions">
              <button className="btn btn-ghost" disabled={!prev} onClick={() => prev && go(prev)}><IconArrowLeft size={18} /> Previous</button>
              <button className={`btn ${current?.completed ? "btn-done" : "btn-primary"}`} onClick={markComplete} disabled={current?.completed || marking}>
                {current?.completed ? <><IconCheck size={18} /> Lesson completed</> : marking ? "Saving…" : "Mark lesson as complete"}
              </button>
              <button className="btn btn-ghost" disabled={!next} onClick={() => next && go(next)}>Next <IconArrowRight size={18} /></button>
            </div>
          </article>
        )}
      </div>

      <aside className="curriculum" aria-label="Course contents">
        <div className="curriculum-head">
          <h2>{curriculum.course.title}</h2>
          <div className="bar" role="progressbar" aria-valuenow={pct} aria-valuemin={0} aria-valuemax={100} aria-label="Course progress"><span style={{ width: `${pct}%` }} /></div>
          <p className="small muted">{doneCount} of {all.length} lessons done ({pct}%)</p>
        </div>

        {curriculum.modules.map((m) => (
          <details key={m.id} className="module" open>
            <summary><span>{m.title}</span><IconChevronDown size={18} /></summary>
            <ul>
              {m.lessons.map((l) => (
                <li key={l.id}>
                  <button className={`lesson-link ${l.id === lessonId ? "active" : ""}`} onClick={() => go(l)} aria-current={l.id === lessonId ? "true" : undefined}>
                    <span className={`dot ${l.completed ? "done" : ""}`} aria-hidden>{l.completed && <IconCheck size={12} strokeWidth={3} />}</span>
                    <span className="lesson-title">{l.title}</span>
                    {l.duration_seconds > 0 && <span className="lesson-dur">{durationLabel(l.duration_seconds)}</span>}
                    <span className="sr-only">{l.completed ? " (completed)" : ""}</span>
                  </button>
                </li>
              ))}
            </ul>
          </details>
        ))}

        <CertificateCard slug={slug} refreshKey={certKey} />

        {tests.length > 0 && (
          <div className="module tests">
            <h3>Tests</h3>
            <ul>
              {tests.map((t) => (
                <li key={t.id}>
                  <Link className="lesson-link" to={`/tests/${t.id}`}>
                    <span className="dot test" aria-hidden><IconTest size={12} /></span>
                    <span className="lesson-title">{t.title}</span>
                    <span className="lesson-dur">{t.duration_minutes} min</span>
                  </Link>
                </li>
              ))}
            </ul>
          </div>
        )}
      </aside>
    </div>
  );
}
