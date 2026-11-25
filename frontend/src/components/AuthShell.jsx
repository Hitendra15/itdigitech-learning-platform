import { Brand } from "./Layout.jsx";
import { IconCheck, IconShield, IconCode } from "./Icons.jsx";

// Split-screen frame shared by Sign in and Create account.
export default function AuthShell({ title, subtitle, children, footer }) {
  return (
    <div className="auth-split">
      <aside className="auth-brand">
        <Brand light />
        <div className="auth-pitch">
          <h2>Learn to code the way the industry works.</h2>
          <p>Structured video lessons, notes and timed tests that track your progress from the first lesson to the last.</p>

          {/* A small live-looking course path: the one memorable element of the page */}
          <div className="path" aria-hidden>
            <div className="path-step done"><span><IconCheck size={14} /></span>Install Python and run Hello World</div>
            <div className="path-step done"><span><IconCheck size={14} /></span>Variables and data types</div>
            <div className="path-step now"><span><IconCode size={14} /></span>Loops and functions</div>
            <div className="path-step"><span /> Module 1 test</div>
          </div>
        </div>
        <div className="auth-foot"><IconShield size={16} /> Secure payments by Razorpay: UPI, cards and net banking</div>
      </aside>

      <main className="auth-panel">
        <div className="auth-card">
          <div className="auth-mobile-brand"><Brand /></div>
          <h1>{title}</h1>
          <p className="lead">{subtitle}</p>
          {children}
          <p className="auth-footer">{footer}</p>
        </div>
      </main>
    </div>
  );
}
