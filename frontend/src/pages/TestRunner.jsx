import { useCallback, useEffect, useRef, useState } from "react";
import { Link, useParams } from "react-router-dom";
import api, { errorMessage } from "../api/client.js";
import { Alert, ProgressRing } from "../components/ui.jsx";
import { IconCheck, IconClock, IconShield, IconX } from "../components/Icons.jsx";

const fmt = (s) => `${String(Math.floor(s / 60)).padStart(2, "0")}:${String(s % 60).padStart(2, "0")}`;

export default function TestRunner() {
  const { testId } = useParams();
  const [attempt, setAttempt] = useState(null);
  const [questions, setQuestions] = useState([]);
  const [answers, setAnswers] = useState({});
  const [remaining, setRemaining] = useState(0);
  const [result, setResult] = useState(null);
  const [error, setError] = useState("");
  const [starting, setStarting] = useState(false);
  const submitting = useRef(false);

  const submit = useCallback(async (id) => {
    if (submitting.current) return;
    submitting.current = true;
    try {
      await api.post(`/attempts/${id}/submit`);
      const { data } = await api.get(`/attempts/${id}/result`);
      setResult(data);
    } catch (e) {
      setError(errorMessage(e));
      submitting.current = false;
    }
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
    if (!attempt || result) return;
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
    return (
      <div className="stack-lg narrow">
        <section className={`result ${a.passed ? "pass" : "fail"}`}>
          <ProgressRing value={pct} size={112} stroke={10} tone={a.passed ? "good" : "bad"} label={`${a.score}/${a.total_marks}`} />
          <div>
            <h1>{a.passed ? "You passed" : "Not passed yet"}</h1>
            <p className="lead">
              {a.passed ? `You scored ${pct}%. Review the answers below to see what you got right.` : `You scored ${pct}%. Review the answers below, then revisit the lessons and try again.`}
            </p>
            <Link className="btn btn-ghost" to="/dashboard">Back to my courses</Link>
          </div>
        </section>

        <section aria-labelledby="review-h">
          <h2 id="review-h" className="section-title">Answer review</h2>
          <ol className="review">
            {result.review.map((r, i) => (
              <li key={r.id} className={r.is_correct ? "right" : "wrong"}>
                <div className="review-head">
                  <span className="review-icon">{r.is_correct ? <IconCheck size={16} strokeWidth={2.6} /> : <IconX size={16} strokeWidth={2.6} />}</span>
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
      </div>
    );
  }

  /* ---------- Intro ---------- */
  if (!attempt) {
    return (
      <div className="intro-card">
        <h1>Ready to start?</h1>
        <p className="lead">Take the test when you have an uninterrupted block of time.</p>
        <ul className="rules">
          <li><IconClock size={18} /> The timer starts when you begin.</li>
          <li><IconShield size={18} /> It keeps running on our server even if you close the page.</li>
          <li><IconCheck size={18} /> Answers save as you select them, and the test submits itself when time is up.</li>
        </ul>
        {error && <Alert>{error}</Alert>}
        <button className="btn btn-primary btn-lg" onClick={start} disabled={starting}>{starting ? "Starting…" : "Start test"}</button>
      </div>
    );
  }

  /* ---------- Running ---------- */
  const answered = questions.filter((q) => (answers[q.id] || []).length > 0).length;
  const pctDone = questions.length ? Math.round((answered / questions.length) * 100) : 0;

  return (
    <div className="narrow stack-lg">
      <div className="test-bar">
        <div className="test-bar-info">
          <h1>{attempt.test}</h1>
          <p className="small muted">{answered} of {questions.length} answered</p>
        </div>
        <div className={`timer ${remaining < 60 ? "low" : ""}`} role="timer" aria-live="off">
          <IconClock size={20} /> {fmt(remaining)}
        </div>
        <div className="bar test-progress" aria-hidden><span style={{ width: `${pctDone}%` }} /></div>
      </div>

      {error && <Alert>{error}</Alert>}

      <ol className="questions">
        {questions.map((q, i) => {
          const multi = q.multiple;
          return (
            <li key={q.id} className="question">
              <fieldset>
                <legend>
                  <span className="qnum">Question {i + 1} of {questions.length}</span>
                  <span className="qtext">{q.text}</span>
                </legend>
                {multi && <p className="hint">Select all that apply.</p>}
                <div className="options">
                  {q.options.map((o) => {
                    const checked = (answers[q.id] || []).includes(o.id);
                    return (
                      <label key={o.id} className={`option ${checked ? "selected" : ""} ${multi ? "multi" : ""}`}>
                        <input type={multi ? "checkbox" : "radio"} name={q.id} checked={checked} onChange={() => choose(q, o.id, multi)} />
                        <span className="option-mark" aria-hidden>{checked && <IconCheck size={14} strokeWidth={3} />}</span>
                        <span>{o.text}</span>
                      </label>
                    );
                  })}
                </div>
              </fieldset>
            </li>
          );
        })}
      </ol>

      <div className="submit-row">
        <p className="muted small">{answered < questions.length ? `${questions.length - answered} unanswered` : "All questions answered"}</p>
        <button className="btn btn-primary btn-lg" onClick={() => submit(attempt.id)}>Submit test</button>
      </div>
    </div>
  );
}
