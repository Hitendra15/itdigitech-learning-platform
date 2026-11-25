import { useEffect, useRef, useState } from "react";
import api from "../api/client.js";
import { Spinner } from "../components/ui.jsx";
import CodeWorkspace from "./CodeWorkspace.jsx";
import { STARTERS } from "./runners.js";

/** The editor inside a practice lesson. Saves the student's work automatically and restores it next visit. */
export default function PracticePanel({ lesson }) {
  const language = lesson.language || "python";
  const starter = lesson.starter_code || STARTERS[language] || "";
  const [code, setCode] = useState(null);
  const [saved, setSaved] = useState("");
  const timer = useRef(null);
  const loaded = useRef(false);

  useEffect(() => {
    loaded.current = false; setCode(null);
    api.get(`/lessons/${lesson.id}/code`)
      .then((r) => setCode(r.data.code ?? starter))
      .catch(() => setCode(starter))
      .finally(() => { loaded.current = true; });
    return () => clearTimeout(timer.current);
  }, [lesson.id]); // eslint-disable-line react-hooks/exhaustive-deps

  const change = (v) => {
    setCode(v);
    if (!loaded.current) return;
    setSaved("Saving…");
    clearTimeout(timer.current);
    timer.current = setTimeout(() => {
      api.put(`/lessons/${lesson.id}/code`, { code: v, language }).then(() => setSaved("All changes saved")).catch(() => setSaved("Could not save (offline?)"));
    }, 1200);
  };

  if (code === null) return <Spinner label="Opening your editor…" />;
  return (
    <section className="practice" aria-label="Practice editor">
      <div className="practice-head"><h2>Try it yourself</h2><span className="muted small" aria-live="polite">{saved}</span></div>
      <p className="muted small">Edit the code, press Run and see the result. Your work is saved automatically.</p>
      <CodeWorkspace language={language} languages={[language]} code={code} onCode={change} onReset={() => change(starter)} minHeight="260px" />
    </section>
  );
}
