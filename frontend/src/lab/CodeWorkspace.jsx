import { lazy, Suspense, useCallback, useEffect, useRef, useState } from "react";
import { Link } from "react-router-dom";
import { LANGUAGES, TIME_LIMIT_MS, runCode, warmUpPython } from "./runners.js";
import { IconPlay, IconRefresh } from "../components/Icons.jsx";

const CodeEditor = lazy(() => import("./CodeEditor.jsx"));

/**
 * Editor + Run button + output, shared by the public Code lab and by practice lessons.
 * `languages` lists the picker choices; pass one entry to lock the language (practice lessons).
 */
export default function CodeWorkspace({ language, onLanguage, languages = Object.keys(LANGUAGES), code, onCode, canRunServer = true, onReset, onRan, minHeight }) {
  const [tab, setTab] = useState("output");
  const [stdin, setStdin] = useState("");
  const [running, setRunning] = useState(false);
  const [status, setStatus] = useState("");
  const [result, setResult] = useState(null);
  const [live, setLive] = useState([]);
  const outRef = useRef(null);
  const spec = LANGUAGES[language];

  useEffect(() => { if (language === "python") warmUpPython(); }, [language]);
  useEffect(() => { setResult(null); setLive([]); setTab(spec?.preview ? "preview" : "output"); }, [language]); // eslint-disable-line react-hooks/exhaustive-deps
  useEffect(() => { outRef.current?.scrollTo({ top: outRef.current.scrollHeight }); }, [live, result]);

  const run = useCallback(async () => {
    if (running) return;
    setRunning(true); setResult(null); setLive([]);
    setTab(spec?.preview ? "preview" : "output");
    const res = await runCode(language, code, { stdin, onChunk: (c) => setLive((l) => [...l, c]), onStatus: setStatus });
    setResult(res); setRunning(false); setStatus("");
    onRan?.(res);
  }, [running, language, code, stdin, spec, onRan]);

  const blocked = spec?.where === "server" && !canRunServer;
  const failed = result && result.exit_code !== 0;

  return (
    <div className="workspace">
      <div className="ws-bar">
        {languages.length > 1 ? (
          <label className="ws-lang"><span className="sr-only">Language</span>
            <select value={language} onChange={(e) => onLanguage?.(e.target.value)}>
              {languages.map((l) => <option key={l} value={l}>{LANGUAGES[l].label}</option>)}
            </select>
          </label>
        ) : <span className="ws-lang-fixed">{spec?.label}</span>}
        <div className="ws-actions">
          {onReset && <button type="button" className="btn btn-ghost btn-sm" onClick={onReset}><IconRefresh size={16} /> Reset</button>}
          <button type="button" className="btn btn-primary btn-sm run-btn" onClick={run} disabled={running || blocked} title="Ctrl/Cmd + Enter">
            <IconPlay size={14} /> {running ? "Running…" : "Run code"}
          </button>
        </div>
      </div>

      <Suspense fallback={<div className="code-editor code-loading">Loading editor…</div>}>
        <CodeEditor language={language} value={code} onChange={onCode} onRun={run} minHeight={minHeight} />
      </Suspense>

      {blocked && <p className="ws-note">Java, C and C++ run on our secure server. <Link to="/login">Sign in</Link> to run them. Python, JavaScript and HTML work without an account.</p>}

      <div className="ws-tabs" role="tablist">
        {spec?.preview
          ? <button role="tab" aria-selected={tab === "preview"} className={tab === "preview" ? "on" : ""} onClick={() => setTab("preview")}>Preview</button>
          : <>
              <button role="tab" aria-selected={tab === "output"} className={tab === "output" ? "on" : ""} onClick={() => setTab("output")}>Output</button>
              <button role="tab" aria-selected={tab === "input"} className={tab === "input" ? "on" : ""} onClick={() => setTab("input")}>Input{stdin ? " •" : ""}</button>
            </>}
        {result && !spec?.preview && <span className={`ws-meta ${failed ? "bad" : "good"}`}>{failed ? `Exited with code ${result.exit_code}` : "Finished successfully"} · {result.ms} ms</span>}
      </div>

      {tab === "preview" && (
        <iframe title="Page preview" className="ws-preview" sandbox="allow-scripts allow-modals" srcDoc={result?.preview ?? ""} />
      )}
      {tab === "input" && (
        <textarea className="ws-stdin" value={stdin} onChange={(e) => setStdin(e.target.value)} rows={4}
          placeholder={"Values your program reads (input(), prompt(), scanf, Scanner), one per line.\nExample:\nAsha"} aria-label="Program input" />
      )}
      {tab === "output" && (
        <pre className="ws-out" ref={outRef} aria-live="polite">
          {status && <span className="o-note">{status}{"\n"}</span>}
          {!result && !running && !status && live.length === 0 && <span className="o-note">Press “Run code” to see the output here.</span>}
          {(result ? [] : live).map((c, i) => <span key={i} className={c.t === "err" ? "o-err" : ""}>{c.s}</span>)}
          {result && <>
            {result.compile_output && <span className="o-err">{result.compile_output}{"\n"}</span>}
            {result.stdout}
            {result.stderr && <span className="o-err">{result.stderr}</span>}
            {!result.stdout && !result.stderr && !result.compile_output && <span className="o-note">The program finished without printing anything.</span>}
          </>}
        </pre>
      )}
      <p className="ws-hint">Tip: press Ctrl/Cmd + Enter to run. Code stops automatically after {TIME_LIMIT_MS / 1000} seconds.</p>
    </div>
  );
}
