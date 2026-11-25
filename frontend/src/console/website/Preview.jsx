import { useEffect, useRef, useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import api, { errorMessage } from "../../api/client.js";
import { useToast } from "../../components/Toast.jsx";
import { Alert } from "../../components/ui.jsx";
import { IconArrowLeft } from "../../components/Icons.jsx";
import { useDocumentTitle } from "../../hooks.js";
import { PREVIEW_READY, PREVIEW_DATA } from "./previewProtocol.js";

const B = "/admin-api/website";
const DEVICES = [["Desktop", "100%"], ["Tablet", "820px"], ["Mobile", "390px"]];

/** Inside the console: toolbar + an iframe, so Tablet/Mobile really use those viewport widths. */
export default function HomePreview() {
  useDocumentTitle("Preview homepage");
  const toast = useToast();
  const navigate = useNavigate();
  const [device, setDevice] = useState(0);
  const [busy, setBusy] = useState(false);
  const [data, setData] = useState(null);
  const [err, setErr] = useState(null);
  const frame = useRef(null);
  useEffect(() => { api.get(`${B}/home/preview`).then((r) => setData(r.data)).catch(setErr); }, []);
  // Hand the (authenticated) preview data to the credential-free frame. Same-origin only.
  const send = () => frame.current?.contentWindow?.postMessage({ type: PREVIEW_DATA, payload: data }, window.location.origin);
  useEffect(() => {
    const onMsg = (e) => { if (e.origin === window.location.origin && e.source === frame.current?.contentWindow && e.data?.type === PREVIEW_READY) send(); };
    window.addEventListener("message", onMsg);
    if (data) send();
    return () => window.removeEventListener("message", onMsg);
  }, [data]); // eslint-disable-line react-hooks/exhaustive-deps
  const publish = async () => {
    setBusy(true);
    try { await api.post(`${B}/home/publish`); toast.success("Homepage published"); navigate("/console/website"); }
    catch (e) { toast.error(errorMessage(e)); } finally { setBusy(false); }
  };
  return (
    <div className="preview-page">
      <div className="preview-bar">
        <Link to="/console/website" className="link-btn small"><IconArrowLeft size={16} /> Back to editing</Link>
        <div className="seg" role="group" aria-label="Preview size">
          {DEVICES.map(([n], i) => <button key={n} type="button" className={device === i ? "on" : ""} aria-pressed={device === i} onClick={() => setDevice(i)}>{n}</button>)}
        </div>
        <button className="btn btn-primary btn-sm" disabled={busy} onClick={publish}>Publish</button>
      </div>
      <p className="muted small center">This is exactly what visitors will see after you publish, including unpublished changes. Only you can see it.</p>
      {err && <Alert>{errorMessage(err)}</Alert>}
      <div className="preview-stage"><iframe ref={frame} title="Homepage preview" src="/preview-frame" style={{ width: DEVICES[device][1] }} /></div>
    </div>
  );
}

