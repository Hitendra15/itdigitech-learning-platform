import { useMemo } from "react";
import CodeMirror from "@uiw/react-codemirror";
import { keymap } from "@codemirror/view";
import { Prec } from "@codemirror/state";
import { python } from "@codemirror/lang-python";
import { javascript } from "@codemirror/lang-javascript";
import { html } from "@codemirror/lang-html";
import { java } from "@codemirror/lang-java";
import { cpp } from "@codemirror/lang-cpp";

const LANG = { python: () => python(), javascript: () => javascript(), html: () => html(), java: () => java(), c: () => cpp(), cpp: () => cpp() };

/** Real code editor: syntax colours, auto-indent, bracket matching, undo. Ctrl/Cmd+Enter runs the code. */
export default function CodeEditor({ language, value, onChange, onRun, minHeight = "320px", readOnly = false }) {
  const extensions = useMemo(() => [
    LANG[language]?.() ?? [],
    Prec.highest(keymap.of([{ key: "Mod-Enter", run: () => { onRun?.(); return true; } }])),
  ], [language, onRun]);

  return (
    <div className="code-editor" aria-label={`${language} code editor`}>
      <CodeMirror value={value} onChange={onChange} extensions={extensions} readOnly={readOnly} minHeight={minHeight} maxHeight="70vh"
        basicSetup={{ lineNumbers: true, foldGutter: false, highlightActiveLine: true, bracketMatching: true, closeBrackets: true, autocompletion: true, indentOnInput: true }} />
    </div>
  );
}
