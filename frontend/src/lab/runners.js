// Runs student code and reports output.
//  - Python (Pyodide), JavaScript and HTML run inside the student's own browser, in a Web Worker or a
//    sandboxed iframe, with a time limit. Nothing is executed on your server for these.
//  - Java, C and C++ are sent to the isolated runner container through POST /code/run.
import api, { errorMessage } from "../api/client.js";

export const TIME_LIMIT_MS = 8000;

export const LANGUAGES = {
  python: { label: "Python 3", where: "browser", file: "main.py" },
  javascript: { label: "JavaScript", where: "browser", file: "main.js" },
  html: { label: "HTML / CSS / JS", where: "browser", file: "index.html", preview: true },
  java: { label: "Java", where: "server", file: "Main.java" },
  c: { label: "C", where: "server", file: "main.c" },
  cpp: { label: "C++", where: "server", file: "main.cpp" },
};

export const STARTERS = {
  python: 'name = input("Your name? ")\nprint(f"Hello, {name}!")\n\nfor i in range(1, 4):\n    print("Square of", i, "is", i * i)\n',
  javascript: 'const nums = [1, 2, 3, 4, 5];\nconst squares = nums.map((n) => n * n);\nconsole.log("Squares:", squares);\nconsole.log("Sum:", squares.reduce((a, b) => a + b, 0));\n',
  html: '<h1>Hello, web!</h1>\n<p id="msg">Click the button.</p>\n<button onclick="document.getElementById(\'msg\').textContent = \'It works!\'">Click me</button>\n\n<style>\n  body { font-family: sans-serif; padding: 24px; }\n  h1 { color: #007FFF; }\n</style>\n',
  java: 'public class Main {\n    public static void main(String[] args) {\n        System.out.println("Hello from Java!");\n    }\n}\n',
  c: '#include <stdio.h>\n\nint main(void) {\n    printf("Hello from C!\\n");\n    return 0;\n}\n',
  cpp: '#include <iostream>\n\nint main() {\n    std::cout << "Hello from C++!" << std::endl;\n    return 0;\n}\n',
};

// ---------------------------------------------------------------- workers
const JS_WORKER = `
self.onmessage = async (e) => {
  const { code, stdin } = e.data;
  const lines = stdin ? stdin.split("\\n") : [];
  const show = (x) => {
    if (typeof x === "string") return x;
    try { return typeof x === "object" && x !== null ? JSON.stringify(x, null, 2) : String(x); } catch (_) { return String(x); }
  };
  const send = (t, s) => self.postMessage({ t, s });
  console.log = (...a) => send("out", a.map(show).join(" ") + "\\n");
  console.info = console.log; console.debug = console.log;
  console.warn = (...a) => send("err", a.map(show).join(" ") + "\\n");
  console.error = console.warn;
  self.prompt = () => (lines.length ? lines.shift() : null);
  try {
    const AsyncFunction = Object.getPrototypeOf(async function () {}).constructor;
    await new AsyncFunction(code)();
    self.postMessage({ t: "done", code: 0 });
  } catch (err) {
    send("err", (err && err.name ? err.name + ": " + err.message : String(err)) + "\\n");
    self.postMessage({ t: "done", code: 1 });
  }
};`;

const PYODIDE = "https://cdn.jsdelivr.net/pyodide/v0.26.4/full/";
const PY_WORKER = `
importScripts("${PYODIDE}pyodide.js");
let py;
const ready = loadPyodide({ indexURL: "${PYODIDE}" }).then((p) => { py = p; self.postMessage({ t: "ready" }); });
self.onmessage = async (e) => {
  await ready;
  const { code, stdin } = e.data;
  const lines = stdin ? stdin.split("\\n") : [];
  py.setStdout({ batched: (s) => self.postMessage({ t: "out", s: s + "\\n" }) });
  py.setStderr({ batched: (s) => self.postMessage({ t: "err", s: s + "\\n" }) });
  py.setStdin({ stdin: () => (lines.length ? lines.shift() : null) });
  try {
    const g = py.globals.get("dict")();
    await py.runPythonAsync(code, { globals: g });
    g.destroy();
    self.postMessage({ t: "done", code: 0 });
  } catch (err) {
    let m = String(err.message || err);
    const i = m.indexOf('File "<exec>"');
    if (i > 0) m = "Traceback (most recent call last):\\n  " + m.slice(i);
    self.postMessage({ t: "err", s: m.trim() + "\\n" });
    self.postMessage({ t: "done", code: 1 });
  }
};`;

const spawn = (src) => new Worker(URL.createObjectURL(new Blob([src], { type: "text/javascript" })));

let pyWorker = null;
let pyReady = null;
export function warmUpPython() { ensurePython().catch(() => {}); }
function ensurePython() {
  if (pyWorker) return pyReady;
  const w = spawn(PY_WORKER);
  pyWorker = w;
  pyReady = new Promise((resolve, reject) => {
    const t = setTimeout(() => { w.terminate(); pyWorker = null; reject(new Error("Python took too long to load. Check your internet connection and try again.")); }, 60000);
    const onMsg = (e) => { if (e.data.t === "ready") { clearTimeout(t); w.removeEventListener("message", onMsg); resolve(); } };
    w.addEventListener("message", onMsg);
    w.onerror = () => { clearTimeout(t); pyWorker = null; reject(new Error("Python could not be started in this browser.")); };
  });
  return pyReady;
}

function execInWorker(worker, code, stdin, onChunk, { keep }) {
  return new Promise((resolve) => {
    const out = [], err = [];
    const started = performance.now();
    const finish = (exit, extra = "") => {
      clearTimeout(timer);
      worker.removeEventListener("message", onMsg);
      if (extra) err.push(extra);
      resolve({ stdout: out.join(""), stderr: err.join(""), exit_code: exit, ms: Math.round(performance.now() - started) });
    };
    const timer = setTimeout(() => {
      worker.terminate();               // the only reliable way to stop an infinite loop
      if (keep) { pyWorker = null; }    // Python restarts on the next run
      finish(124, `\nTime limit exceeded (${TIME_LIMIT_MS / 1000} s). Check for an infinite loop.\n`);
    }, TIME_LIMIT_MS);
    const onMsg = (e) => {
      const { t, s, code: c } = e.data;
      if (t === "out") { out.push(s); onChunk?.({ t, s }); }
      else if (t === "err") { err.push(s); onChunk?.({ t, s }); }
      else if (t === "done") finish(c);
    };
    worker.addEventListener("message", onMsg);
    worker.postMessage({ code, stdin });
  });
}

// ---------------------------------------------------------------- public API
/** Returns { stdout, stderr, compile_output, exit_code, ms, preview? } */
export async function runCode(language, code, { stdin = "", onChunk, onStatus } = {}) {
  const spec = LANGUAGES[language];
  if (!spec) throw new Error("Unsupported language.");
  if (!code.trim()) return { stdout: "", stderr: "Nothing to run yet. Write some code first.\n", exit_code: 1, ms: 0 };

  if (language === "html") return { stdout: "", stderr: "", exit_code: 0, ms: 0, preview: code };

  if (language === "javascript") {
    return execInWorker(spawn(JS_WORKER), code, stdin, onChunk, { keep: false });
  }

  if (language === "python") {
    if (!pyWorker) onStatus?.("Starting Python (first run takes a few seconds)…");
    try { await ensurePython(); } catch (e) { return { stdout: "", stderr: e.message + "\n", exit_code: 1, ms: 0 }; }
    onStatus?.("");
    return execInWorker(pyWorker, code, stdin, onChunk, { keep: true });
  }

  // Java / C / C++ on the isolated server runner
  const started = performance.now();
  try {
    const { data } = await api.post("/code/run", { language, code, stdin });
    return { ...data, ms: Math.round(performance.now() - started) };
  } catch (err) {
    if (err.response?.status === 401) return { stdout: "", stderr: "Sign in to run Java, C and C++.\n", exit_code: 1, ms: 0 };
    return { stdout: "", stderr: errorMessage(err, "Could not reach the code runner.") + "\n", exit_code: 1, ms: 0 };
  }
}
