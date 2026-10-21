import { useCallback, useEffect, useRef, useState } from "react";
import { Link, useParams } from "react-router-dom";
import api, { errorMessage } from "../api/client.js";
import { Alert, ProgressRing } from "../components/ui.jsx";
import Modal from "../components/Modal.jsx";
import { useFocusMeta } from "../components/FocusShell.jsx";
import { useDocumentTitle } from "../hooks.js";
import { IconArrowLeft, IconArrowRight, IconCheck, IconClock, IconFlag, IconFlagFill, IconShield, IconX } from "../components/Icons.jsx";

const fmt = (s) => `${String(Math.floor(s / 60)).padStart(2, "0")}:${String(s % 60).padStart(2, "0")}`;

export default function TestRunner() {
  useDocumentTitle("Test");
  const { testId } = useParams();
  const [attempt, setAttempt] = useState(null);
  const [questions, setQuestions] = useState([]);
  const [answers, setAnswers] = useState({});
  const [flagged, setFlagged] = useState({});
  const [current, setCurrent] = useState(0);
  const [remaining, setRemaining] = useState(0);
  const [result, setResult] = useState(null);
  const [error, setError] = useState("");
  const [starting, setStarting] = useState(false);
  const [confirming, setConfirming] = useState(false);
  const [busy, setBusy] = useState(false);
  const submitting = useRef(false);

  useFocusMeta({
    title: attempt?.test || (result ? "Test result" : "Test"),
    sub: attempt && !result ? `Question ${current + 1} of ${questions.length}` : undefined,
    timer: attempt && !result ? fmt(remaining) : undefined,
    timerLow: remaining < 60,
  });

  const submit = useCallback(async (id) => {
    if (submitting.current) return;
    submitting.current = true;
    setBusy(true);
    try {
      await api.post(`/attempts/${id}/submit`);
      const { data } = await api.get(`/attempts/${id}/result`);
      setResult(data);
      setConfirming(false);
    } catch (e) {
      setError(errorMessage(e));
      setConfirming(false);
      submitting.current = false;
    } finally { setBusy(false); }
  }, []);

  const start = async () => {
    setError("");
    setStarting(true);
    try {
      const { data } = await api.post(`/tests/${testId}/start`);
      setAttempt(data.attempt);
      setQuestions(data.questions);
      setAnswers(data.answers || {});
    } catch (e) {
      setError(errorMessage(e));
    } finally {
      setStarting(false);
    }
  };

  // Timer is display-only: the server enforces expires_at and auto-submits.
  useEffect(() => {
    if (!attempt || result) return undefined;
    const tick = () => {
      const left = Math.max(0, Math.round((new Date(attempt.expires_at) - Date.now()) / 1000));
      setRemaining(left);
      if (left === 0) submit(attempt.id);
    };
    tick();
    const t = setInterval(tick, 1000);
    return () => clearInterval(t);
  }, [attempt, result, submit]);

  const choose = (q, optionId, multi) => {
    const prev = answers[q.id] || [];
    const next = multi ? (prev.includes(optionId) ? prev.filter((x) => x !== optionId) : [...prev, optionId]) : [optionId];
    setAnswers({ ...answers, [q.id]: next });
    api.post(`/attempts/${attempt.id}/answer`, { question_id: q.id, response: next }).catch((e) => setError(errorMessage(e)));
  };

  /* ---------- Result ---------- */
  if (result) {
    const a = result.attempt;
    const pct = a.total_marks ? Math.round((a.score / a.total_marks) * 100) : 0;
    const right = result.review.filter((r) => r.is_correct).length;
    return (
      <div className="page"><div className="stack-lg narrow">
        <section className={`result ${a.passed ? "pass" : "fail"}`}>
          <ProgressRing value={pct} size={120} stroke={10} tone={a.passed ? "good" : "bad"} label={`${pct}%`} />
          <div className="result-text">
            <h1>{a.passed ? "You passed" : "Not passed yet"}</h1>
            <p className="lead">{a.passed ? "Well done. Review the answers below to see what you got right." : "Review the answers below, revisit the lessons, and try again."}</p>
            <dl className="mini-stats">
              <div><dt>Score</dt><dd>{a.score} / {a.total_marks}</dd></div>
              <div><dt>Correct</dt><dd>{right} of {result.review.length}</dd></div>
            </dl>
            <Link className="btn btn-ghost" to="/dashboard">Back to my courses</Link>
          </div>
        </section>

        <section aria-labelledby="review-h">
          <div className="section-head"><h2 id="review-h">Answer review</h2></div>
          <ol className="review">
            {result.review.map((r, i) => (
              <li key={r.id} className={r.is_correct ? "right" : "wrong"}>
                <div className="review-head">
                  <span className="review-icon">{r.is_correct ? <IconCheck size={15} strokeWidth={3} /> : <IconX size={15} strokeWidth={3} />}</span>
                  <p><span className="qnum">Question {i + 1}</span><strong>{r.text}</strong></p>
                </div>
                <dl className="answers">
                  <div><dt>Your answer</dt><dd>{r.your_answer.join(", ") || "Not answered"}</dd></div>
                  <div><dt>Correct answer</dt><dd>{r.correct_answer.join(", ")}</dd></div>
                </dl>
                {r.explanation && <p className="explain">{r.explanation}</p>}
              </li>
            ))}
          </ol>
        </section>
      </div></div>
    );
  }

  /* ---------- Intro ---------- */
  if (!attempt) {
    return (
      <div className="page"><div className="intro-card">
        <span className="intro-ico"><IconClock size={22} /></span>
        <h1>Ready to start?</h1>
        <p className="lead">Take the test when you have an uninterrupted block of time.</p>
        <ul className="rules">
          <li><IconClock size={18} /><span><strong>The timer starts when you begin.</strong> You will see it at the top of the screen.</span></li>
          <li><IconShield size={18} /><span><strong>It keeps running on our server</strong> even if you close the page or lose connection.</span></li>
          <li><IconCheck size={18} /><span><strong>Answers save as you select them</strong>, and the test submits itself when time is up.</span></li>
        </ul>
        {error && <Alert>{error}</Alert>}
        <div className="row gap wrap">
          <button className="btn btn-primary btn-lg" onClick={start} disabled={starting}>{starting ? "Starting…" : "Start test"}</button>
          <Link className="btn btn-ghost btn-lg" to="/dashboard">Not now</Link>
        </div>
      </div></div>
    );
  }

  /* ---------- Running ---------- */
  const q = questions[current];
  const multi = q?.multiple;
  const answered = questions.filter((x) => (answers[x.id] || []).length > 0).length;
  const flaggedCount = questions.filter((x) => flagged[x.id]).length;
  const unanswered = questions.length - answered;

  return (
    <div className="exam">
      <div className="exam-main">
        {error && <Alert>{error}</Alert>}
        <fieldset className="question" key={q.id}>
          <legend className="sr-only">Question {current + 1} of {questions.length}</legend>
          <div className="question-top">
            <span className="qnum">Question {current + 1} of {questions.length}</span>
            <button className={`flag-btn ${flagged[q.id] ? "on" : ""}`} onClick={() => setFlagged({ ...flagged, [q.id]: !flagged[q.id] })} aria-pressed={!!flagged[q.id]}>
              {flagged[q.id] ? <IconFlagFill size={16} /> : <IconFlag size={16} />} {flagged[q.id] ? "Flagged" : "Flag for review"}
            </button>
          </div>
          <p className="qtext">{q.text}</p>
          {multi && <p className="hint">Select all that apply.</p>}
          <div className="options">
            {q.options.map((o, oi) => {
              const checked = (answers[q.id] || []).includes(o.id);
              return (
                <label key={o.id} className={`option ${checked ? "selected" : ""} ${multi ? "multi" : ""}`}>
                  <input type={multi ? "checkbox" : "radio"} name={q.id} checked={checked} onChange={() => choose(q, o.id, multi)} />
                  <span className="option-mark" aria-hidden>{checked ? <IconCheck size={14} strokeWidth={3.2} /> : String.fromCharCode(65 + oi)}</span>
                  <span>{o.text}</span>
                </label>
              );
            })}
          </div>
        </fieldset>

        <div className="exam-nav">
          <button className="btn btn-ghost" disabled={current === 0} onClick={() => setCurrent(current - 1)}><IconArrowLeft size={18} /> Previous</button>
          {current < questions.length - 1
            ? <button className="btn btn-primary" onClick={() => setCurrent(current + 1)}>Next <IconArrowRight size={18} /></button>
            : <button className="btn btn-primary" onClick={() => setConfirming(true)}>Review and submit</button>}
        </div>
      </div>

      <aside className="exam-side" aria-label="Question navigator">
        <div className="panel">
          <div className="panel-head"><h2>Questions</h2><span className="small muted">{answered} of {questions.length} answered</span></div>
          <div className="bar" aria-hidden><span style={{ width: `${questions.length ? (answered / questions.length) * 100 : 0}%` }} /></div>
          <ol className="palette">
            {questions.map((x, i) => (
              <li key={x.id}>
                <button className={`pal ${i === current ? "current" : ""} ${(answers[x.id] || []).length ? "answered" : ""} ${flagged[x.id] ? "flagged" : ""}`}
                        onClick={() => setCurrent(i)} aria-label={`Question ${i + 1}${(answers[x.id] || []).length ? ", answered" : ", not answered"}${flagged[x.id] ? ", flagged" : ""}`} aria-current={i === current ? "step" : undefined}>
                  {i + 1}
                </button>
              </li>
            ))}
          </ol>
          <ul className="legend">
            <li><span className="pal answered" /> Answered</li><li><span className="pal" /> Not answered</li><li><span className="pal flagged" /> Flagged</li>
          </ul>
          <button className="btn btn-primary btn-block" onClick={() => setConfirming(true)}>Submit test</button>
        </div>
      </aside>

      <Modal open={confirming} onClose={() => !busy && setConfirming(false)} size="sm" title="Submit your test?" busy={busy}
        footer={<>
          <button className="btn btn-ghost" onClick={() => setConfirming(false)} disabled={busy}>Keep working</button>
          <button className="btn btn-primary" onClick={() => submit(attempt.id)} disabled={busy} data-autofocus>{busy ? "Submitting…" : "Submit test"}</button>
        </>}>
        <div className="stack">
          <p>You cannot change your answers after submitting.</p>
          <ul className="submit-summary">
            <li><strong>{answered}</strong> answered</li>
            <li className={unanswered ? "warn" : ""}><strong>{unanswered}</strong> not answered</li>
            <li className={flaggedCount ? "warn" : ""}><strong>{flaggedCount}</strong> flagged for review</li>
          </ul>
        </div>
      </Modal>
    </div>
  );
}
