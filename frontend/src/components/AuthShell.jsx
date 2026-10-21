import { Link } from "react-router-dom";
import Brand from "./Brand.jsx";
import { IconArrowLeft, IconCheck, IconShield, IconCode } from "./Icons.jsx";

// Split-screen frame for sign in, sign up and password recovery.
export default function AuthShell({ title, subtitle, children, footer }) {
  return (
    <div className="auth-split">
      <main className="auth-panel" id="main">
        <Link to="/" className="auth-back"><IconArrowLeft size={16} /> Home</Link>
        <div className="auth-card">
          <div className="auth-mobile-brand"><Brand /></div>
          <h1>{title}</h1>
          {subtitle ? <p className="lead">{subtitle}</p> : null}
          {children}
          {footer && <p className="auth-footer">{footer}</p>}
        </div>
      </main>

      <aside className="auth-brand" aria-hidden="true">
        <Brand light />
        <div className="auth-pitch">
          <h2>Job-ready IT skills, one lesson at a time.</h2>
          <p>Video lessons with notes, timed tests that mark themselves, and support that replies inside the app.</p>
          <div className="path">
            <div className="path-step done"><span><IconCheck size={13} strokeWidth={3} /></span>Install Python and run Hello World</div>
            <div className="path-step done"><span><IconCheck size={13} strokeWidth={3} /></span>Variables and data types</div>
            <div className="path-step now"><span><IconCode size={13} /></span>Loops and functions</div>
            <div className="path-step"><span /> Module 1 test</div>
          </div>
        </div>
        <div className="auth-foot"><IconShield size={16} /> Secure payments by Razorpay: UPI, cards and net banking</div>
      </aside>
    </div>
  );
}
