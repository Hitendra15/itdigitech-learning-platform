import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import api, { errorMessage, fmtDate } from "../api/client.js";
import { downloadCertificate } from "../lib/certificate.js";
import { useDocumentTitle } from "../hooks.js";
import { useToast } from "../components/Toast.jsx";
import { Alert, EmptyState, Spinner } from "../components/ui.jsx";
import { IconAward, IconDownload } from "../components/Icons.jsx";

export default function Certificates() {
  useDocumentTitle("Certificates");
  const toast = useToast();
  const [certs, setCerts] = useState(null);
  const [courses, setCourses] = useState([]);
  const [busy, setBusy] = useState("");

  const load = () => Promise.all([api.get("/my/certificates"), api.get("/my/courses")]).then(([c, m]) => { setCerts(c.data); setCourses(m.data); });
  useEffect(() => { load().catch(() => setCerts([])); }, []);

  if (!certs) return <Spinner label="Loading certificates…" />;
  const have = new Set(certs.map((c) => c.course_slug));
  const claimable = courses.filter((c) => c.progress >= 100 && !have.has(c.slug));

  const download = async (code) => { setBusy(code); const e = await downloadCertificate(code); setBusy(""); if (e) toast.error(e); };
  const claim = async (slug) => {
    setBusy(slug);
    try { await api.post(`/my/courses/${slug}/certificate`); await load(); toast.success("Certificate issued."); }
    catch (err) { toast.error(errorMessage(err)); }
    finally { setBusy(""); }
  };

  return (
    <div className="stack-lg">
      <header className="page-head"><div><h1>My certificates</h1><p className="lead">Download your certificates or share the ID so employers and colleges can verify them online.</p></div></header>

      {claimable.map((c) => (
        <Alert key={c.slug} type="ok">
          <div className="row gap" style={{ justifyContent: "space-between", flexWrap: "wrap" }}>
            <span>You completed <strong>{c.title}</strong>. Your certificate is ready to claim.</span>
            <button className="btn btn-primary btn-sm" disabled={busy === c.slug} onClick={() => claim(c.slug)}>{busy === c.slug ? "Preparing…" : "Get certificate"}</button>
          </div>
        </Alert>
      ))}

      {certs.length === 0 ? (
        <EmptyState title="No certificates yet" action={<Link className="btn btn-primary" to="/dashboard">Continue learning</Link>}>
          Finish all lessons and pass the tests of a course and its certificate appears here.
        </EmptyState>
      ) : (
        <ul className="cert-grid">
          {certs.map((c) => (
            <li key={c.id} className="cert-tile">
              <span className="cert-icon"><IconAward size={24} /></span>
              <h3>{c.course_title}</h3>
              <p className="muted small">Issued {fmtDate(c.issued_at)}{c.average_score != null ? ` · Score ${c.average_score}%` : ""}</p>
              <p className="small">Certificate ID <code>{c.code}</code></p>
              <div className="row gap">
                <button className="btn btn-primary btn-sm" disabled={busy === c.code} onClick={() => download(c.code)}><IconDownload size={16} /> {busy === c.code ? "Preparing…" : "Download PDF"}</button>
                <Link className="btn btn-ghost btn-sm" to={`/verify/${c.code}`}>Verify</Link>
              </div>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
