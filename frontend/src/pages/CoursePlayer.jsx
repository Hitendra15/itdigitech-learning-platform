import { useCallback, useEffect, useState } from "react";
import { Link, useParams, useSearchParams } from "react-router-dom";
import api, { errorMessage } from "../api/client.js";
import { Alert, Spinner, durationLabel } from "../components/ui.jsx";
import { useFocusMeta } from "../components/FocusShell.jsx";
import { useDocumentTitle } from "../hooks.js";
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

  useEffect(() => {
    if (curriculum && !lessonId) {
      const first = curriculum.modules.flatMap((m) => m.lessons).find((l) => !l.completed) || curriculum.modules.flatMap((m) => m.lessons)[0];
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

  const all = curriculum ? curriculum.modules.flatMap((m) => m.lessons) : [];
  const doneCount = all.filter((l) => l.completed).length;
  const pct = courseProgress ?? (all.length ? Math.round((doneCount / all.length) * 100) : 0);
  useFocusMeta({ title: curriculum?.course.title, sub: all.length ? `${doneCount} of ${all.length} lessons completed` : undefined, progress: curriculum ? pct : undefined });
  useDocumentTitle(lesson?.title);

  const markComplete = async () => {
    setMarking(true);
    try {
      const { data } = await api.post(`/lessons/${lessonId}/progress`, { completed: true });
      setCourseProgress(data.course_progress);
      await loadCurriculum();
    } finally {
      setMarking(false);
    }
  };

  if (error) {
    return (
      <div className="page"><div className="stack narrow">
        <Alert>{error}</Alert>
        <div><Link className="btn btn-primary" to="/plans">View plans</Link></div>
      </div></div>
    );
  }
  if (!curriculum) return <Spinner label="Loading course…" />;

  const idx = all.findIndex((l) => l.id === lessonId);
  const current = all[idx];
  const prev = idx > 0 ? all[idx - 1] : null;
  const next = idx >= 0 && idx < all.length - 1 ? all[idx + 1] : null;
  const go = (l) => { setParams({ lesson: l.id }); window.scrollTo({ top: 0, behavior: "smooth" }); };
  const currentModule = curriculum.modules.find((m) => m.lessons.some((l) => l.id === lessonId));

  return (
    <div className="player">
      <div className="player-main">
        {!lesson ? <Spinner label="Loading lesson…" /> : (
          <article className="lesson">
            {video ? (
              <div className="video-frame">
                <iframe
                  key={video.url}
                  className="video"
                  src={video.url}
                  title="Lesson Video"
                  allow="autoplay; encrypted-media; picture-in-picture; fullscreen"
                  allowFullScreen
                />
              </div>
            ) : lesson.lesson_type === "video" ? (
              <div className="video-frame video-empty">
                <span className="video-empty-ico"><IconPlay size={24} /></span>
                <p><strong>Video not available yet</strong></p>
                <p>The notes below cover this lesson. The video will appear here once it is uploaded.</p>
              </div>
            ) : null}

            <header className="lesson-head">
              <div>
                <p className="lesson-crumb">{currentModule?.title}</p>
                <h1>{lesson.title}</h1>
                <p className="lesson-meta">
                  {idx >= 0 && <span>Lesson {idx + 1} of {all.length}</span>}
                  {lesson.duration_seconds > 0 && <span><IconClock size={15} /> {durationLabel(lesson.duration_seconds)}</span>}
                </p>
              </div>
              <div className="lesson-actions">
                <button className="btn btn-ghost" disabled={!prev} onClick={() => prev && go(prev)} aria-label="Previous lesson"><IconArrowLeft size={18} /> <span className="hide-sm">Previous</span></button>
                <button className={`btn ${current?.completed ? "btn-done" : "btn-primary"}`} onClick={markComplete} disabled={current?.completed || marking}>
                  {current?.completed ? <><IconCheck size={18} strokeWidth={2.6} /> Completed</> : marking ? "Saving…" : "Mark as complete"}
                </button>
                <button className="btn btn-ghost" disabled={!next} onClick={() => next && go(next)} aria-label="Next lesson"><span className="hide-sm">Next</span> <IconArrowRight size={18} /></button>
              </div>
            </header>

            {lesson.notes.map((n, i) => (
              <section key={i} className="notes">
                <h2><IconFile size={18} /> {n.title}</h2>
                {n.content && <pre>{n.content}</pre>}
                {n.file && <a className="link-btn" href={n.file} target="_blank" rel="noreferrer"><IconDownload size={16} /> Download notes (PDF)</a>}
              </section>
            ))}
          </article>
        )}
      </div>

      <aside className="curriculum" aria-label="Course contents">
        <div className="curriculum-head">
          <h2>Course content</h2>
          <div className="bar" role="progressbar" aria-valuenow={pct} aria-valuemin={0} aria-valuemax={100} aria-label="Course progress"><span style={{ width: `${pct}%` }} /></div>
          <p className="small muted">{doneCount} of {all.length} lessons · {pct}%</p>
        </div>

        {curriculum.modules.map((m, mi) => {
          const done = m.lessons.filter((l) => l.completed).length;
          return (
            <details key={m.id} className="module" open={m.lessons.some((l) => l.id === lessonId) || mi === 0}>
              <summary>
                <span className="module-title"><strong>{m.title}</strong><small>{done} of {m.lessons.length} completed</small></span>
                <IconChevronDown size={18} />
              </summary>
              <ul>
                {m.lessons.map((l) => (
                  <li key={l.id}>
                    <button className={`lesson-link ${l.id === lessonId ? "active" : ""}`} onClick={() => go(l)} aria-current={l.id === lessonId ? "true" : undefined}>
                      <span className={`dot ${l.completed ? "done" : ""}`} aria-hidden>{l.completed ? <IconCheck size={12} strokeWidth={3.2} /> : l.id === lessonId ? <IconPlay size={9} /> : null}</span>
                      <span className="lesson-title">{l.title}</span>
                      {l.duration_seconds > 0 && <span className="lesson-dur">{durationLabel(l.duration_seconds)}</span>}
                      {l.completed && <span className="sr-only"> (completed)</span>}
                    </button>
                  </li>
                ))}
              </ul>
            </details>
          );
        })}

        {tests.length > 0 && (
          <div className="curriculum-tests">
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
