import { useEffect, useState } from "react";
import { Link, useNavigate, useParams } from "react-router-dom";
import api, { fmtDate } from "../api/client.js";
import { useDocumentTitle } from "../hooks.js";
import { IconAward, IconCheck, IconX } from "../components/Icons.jsx";

export default function VerifyCertificate() {
  useDocumentTitle("Verify a certificate");
  const { code } = useParams();
  const navigate = useNavigate();
  const [input, setInput] = useState(code || "");
  const [res, setRes] = useState(null);
  const [loading, setLoading] = useState(Boolean(code));

  useEffect(() => {
    if (!code) { setRes(null); return; }
    setLoading(true);
    api.get(`/certificates/verify/${encodeURIComponent(code)}`).then((r) => setRes(r.data)).catch((e) => setRes(e.response?.data ?? { valid: false, detail: "Could not check this certificate right now." })).finally(() => setLoading(false));
  }, [code]);

  return (
    <div className="section">
      <div className="site-wrap narrow-wrap">
        <span className="eyebrow">Certificate check</span>
        <h1>Verify a certificate</h1>
        <p className="lead">Enter the certificate ID printed at the bottom of the PDF, or scan its QR code.</p>
        <form className="verify-form" onSubmit={(e) => { e.preventDefault(); input.trim() && navigate(`/verify/${input.trim().toUpperCase()}`); }}>
          <input value={input} onChange={(e) => setInput(e.target.value)} placeholder="ITD-XXXXXXXXXX" aria-label="Certificate ID" autoComplete="off" />
          <button className="btn btn-primary">Verify</button>
        </form>

        {loading && <p className="muted">Checking…</p>}
        {res?.valid && (
          <div className="verify-result ok" role="status">
            <span className="verify-badge"><IconCheck size={22} /></span>
            <div>
              <h2>Valid certificate</h2>
              <p><strong>{res.recipient_name}</strong> completed <strong>{res.course_title}</strong> on IT DigiTech Learn.</p>
              <p className="muted small">Issued {fmtDate(res.issued_at)}{res.average_score != null ? ` · Average score ${res.average_score}%` : ""} · ID {res.code}</p>
            </div>
          </div>
        )}
        {res && !res.valid && !loading && (
          <div className="verify-result bad" role="alert">
            <span className="verify-badge"><IconX size={22} /></span>
            <div><h2>Not verified</h2><p>{res.detail || "We could not find a valid certificate with this ID."}</p><p className="muted small">Check the ID for typing mistakes, or <Link to="/contact">contact us</Link>.</p></div>
          </div>
        )}
        {!res && !loading && <p className="muted small"><IconAward size={16} style={{ verticalAlign: "-3px" }} /> Every IT DigiTech certificate has a unique ID and QR code.</p>}
      </div>
    </div>
  );
}
