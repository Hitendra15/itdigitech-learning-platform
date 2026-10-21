import { useRef, useState } from "react";
import { IconFile, IconPaperclip, IconX } from "./Icons.jsx";

const size = (b) => (b > 1048576 ? `${(b / 1048576).toFixed(1)} MB` : `${Math.max(1, Math.round(b / 1024))} KB`);

// Click or drag a file onto the box. Friendly for people who are not used to file inputs.
export default function FileDrop({ file, onFile, accept, label = "Choose a file", hint, maxMb }) {
  const ref = useRef(null);
  const [over, setOver] = useState(false);
  const [error, setError] = useState("");

  const take = (f) => {
    if (!f) return;
    if (maxMb && f.size > maxMb * 1048576) { setError(`That file is too large. The limit is ${maxMb} MB.`); return; }
    setError(""); onFile(f);
  };

  return (
    <div>
      <div className={`drop ${over ? "over" : ""} ${file ? "has" : ""}`}
        onDragOver={(e) => { e.preventDefault(); setOver(true); }} onDragLeave={() => setOver(false)}
        onDrop={(e) => { e.preventDefault(); setOver(false); take(e.dataTransfer.files?.[0]); }}>
        <input ref={ref} type="file" accept={accept} className="sr-only" id="drop-input" onChange={(e) => take(e.target.files?.[0])} />
        {file ? (
          <div className="drop-file">
            <span className="drop-ico"><IconFile size={20} /></span>
            <div className="drop-name"><strong>{file.name}</strong><span>{size(file.size)}</span></div>
            <button type="button" className="icon-btn" aria-label="Remove file" onClick={() => { onFile(null); if (ref.current) ref.current.value = ""; }}><IconX size={18} /></button>
          </div>
        ) : (
          <button type="button" className="drop-empty" onClick={() => ref.current?.click()}>
            <span className="drop-ico"><IconPaperclip size={20} /></span>
            <strong>{label}</strong>
            <span>{hint || "Click to browse, or drag a file here"}</span>
          </button>
        )}
      </div>
      {error && <p className="field-error" style={{ marginTop: 6 }}>{error}</p>}
    </div>
  );
}
