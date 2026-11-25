import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import api, { errorMessage, fmtDate } from "../api/client.js";
import { downloadCertificate } from "../lib/certificate.js";
import { useToast } from "./Toast.jsx";
import { IconAward, IconCheck, IconDownload } from "./Icons.jsx";

/** Sits in the course player. Shows what is left, then unlocks "Get certificate" and "Download PDF". */
export default function CertificateCard({ slug, refreshKey }) {
  const toast = useToast();
  const [state, setState] = useState(null);
  const [busy, setBusy] = useState(false);

  useEffect(() => { api.get(`/my/courses/${slug}/certificate`).then((r) => setState(r.data)).catch(() => {}); }, [slug, refreshKey]);
  if (!state) return null;

  const cert = state.certificate;
  const claim = async () => {
    setBusy(true);
    try {
      const { data } = await api.post(`/my/courses/${slug}/certificate`);
      setState({ ...state, certificate: data });
      toast.success("Your certificate is ready.");
    } catch (err) { toast.error(errorMessage(err)); }
    finally { setBusy(false); }
  };
  const download = async () => { setBusy(true); const e = await downloadCertificate(cert.code); setBusy(false); if (e) toast.error(e); };

  return (
    <div className={`cert-card ${cert ? "done" : state.eligible ? "ready" : ""}`}>
      <span className="cert-icon"><IconAward size={22} /></span>
      <div className="cert-body">
        <h3>{cert ? "Certificate earned" : state.eligible ? "You finished the course!" : "Course certificate"}</h3>
        {cert ? <p className="small">Issued {fmtDate(cert.issued_at)} · ID <code>{cert.code}</code></p>
          : state.eligible ? <p className="small">Everything is complete. Claim your certificate now.</p>
          : <ul className="cert-todo small">{state.todo.map((t) => <li key={t}>{t}</li>)}</ul>}
      </div>
      {cert ? <button className="btn btn-primary btn-sm" onClick={download} disabled={busy}><IconDownload size={16} /> Download PDF</button>
        : state.eligible ? <button className="btn btn-primary btn-sm" onClick={claim} disabled={busy}>{busy ? "Preparing…" : <><IconCheck size={16} /> Get certificate</>}</button> : null}
      {cert && <Link className="link-btn small" to={`/verify/${cert.code}`}>Public verification page</Link>}
    </div>
  );
}
