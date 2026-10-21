import { useEffect, useMemo, useState } from "react";
import { Link } from "react-router-dom";
import api from "../api/client.js";
import Brand from "../components/Brand.jsx";
import ThemeToggle from "../components/ThemeToggle.jsx";
import PlanCard, { featuredPlanId } from "../components/PlanCard.jsx";
import { Accordion, CourseCover, ProgressRing } from "../components/ui.jsx";
import { IconArrowRight, IconChat, IconCheck, IconCode, IconPaperclip, IconPlay, IconTest, IconBell } from "../components/Icons.jsx";
import { useDocumentTitle } from "../hooks.js";

const useList = (url) => {
  const [data, setData] = useState(null);
  useEffect(() => { api.get(url).then((r) => setData(r.data.results ?? r.data)).catch(() => setData([])); }, [url]);
  return data;
};

function LessonWindow() {
  return (
    <div className="lw" aria-hidden="true">
      <div className="lw-win">
        <div className="lw-tabs"><span className="lw-tab">total.py</span><span className="lw-lesson">Functions · Lesson 7 of 9</span></div>
        <pre className="lw-code">
<span className="ln">1</span><span className="tk-k">def</span> <span className="tk-f">total</span>(prices, gst=<span className="tk-n">0.18</span>):{"\n"}
<span className="ln">2</span>    subtotal = <span className="tk-f">sum</span>(prices){"\n"}
<span className="ln">3</span>    <span className="tk-k">return</span> <span className="tk-f">round</span>(subtotal * (<span className="tk-n">1</span> + gst), <span className="tk-n">2</span>){"\n"}
<span className="ln">4</span>{"\n"}
<span className="ln">5</span><span className="tk-c"># 499 + 250, with GST</span>{"\n"}
<span className="ln">6</span><span className="tk-f">print</span>(<span className="tk-f">total</span>([<span className="tk-n">499</span>, <span className="tk-n">250</span>]))
        </pre>
        <div className="lw-out"><span>Output</span><b>883.82</b></div>
        <div className="lw-checks">
          <div><header>Practice check</header><span className="lw-count">3 of 3 passed</span></div>
          <div><IconCheck size={15} strokeWidth={2.8} /> Returns a number</div>
          <div><IconCheck size={15} strokeWidth={2.8} /> Adds 18% GST by default</div>
          <div><IconCheck size={15} strokeWidth={2.8} /> Works for an empty list</div>
        </div>
      </div>
      <div className="lw-card">
        <strong>Python Basics</strong>
        <div className="bar"><span style={{ width: "67%" }} /></div>
        <span>6 of 9 lessons completed</span>
      </div>
    </div>
  );
}

export default function Home() {
  useDocumentTitle("");
  const courses = useList("/courses");
  const plans = useList("/billing/plans");
  const faqs = useList("/support/faqs");
  const [level, setLevel] = useState("all");

  const levels = useMemo(() => ["all", ...new Set((courses ?? []).map((c) => c.level).filter(Boolean))], [courses]);
  const shown = (courses ?? []).filter((c) => level === "all" || c.level === level);
  const featured = featuredPlanId(plans);

  return (
    <div className="mk">
      <a className="skip-link" href="#main">Skip to content</a>
      <header className="mk-nav">
        <div className="mk-wrap">
          <Brand />
          <nav className="mk-links" aria-label="Sections">
            <a href="#courses">Courses</a><a href="#how">How it works</a><a href="#plans">Plans</a><a href="#faq">Help</a>
          </nav>
          <div className="mk-cta">
            <ThemeToggle />
            <Link className="btn btn-quiet btn-sm" to="/login">Sign in</Link>
            <Link className="btn btn-primary btn-sm" to="/register">Create account</Link>
          </div>
        </div>
      </header>

      <main id="main">
        <section className="mk-hero">
          <div className="mk-wrap">
            <div>
              <h1>Job-ready IT skills, one lesson at a time.</h1>
              <p className="lead">Short video lessons with notes, timed tests that mark themselves, and a support team that replies inside the app. Choose the courses you need and pay once.</p>
              <div className="mk-actions">
                <Link className="btn btn-primary btn-lg" to="/register">Create your account <IconArrowRight size={18} /></Link>
                <a className="btn btn-ghost btn-lg" href="#plans">See plans</a>
              </div>
              <div className="mk-assure">
                <span><IconCheck size={16} strokeWidth={2.6} /> UPI, cards and net banking</span>
                <span><IconCheck size={16} strokeWidth={2.6} /> GST invoice with every payment</span>
                <span><IconCheck size={16} strokeWidth={2.6} /> Resume on any device</span>
              </div>
            </div>
            <LessonWindow />
          </div>
        </section>

        <section className="mk-section" id="how">
          <div className="mk-wrap">
            <div className="mk-head">
              <h2>Every lesson follows the same simple loop</h2>
              <p>No guessing what to do next. You watch, you finish, you get tested, and the platform keeps track of where you stand.</p>
            </div>
            <div className="mk-steps">
              <div className="mk-step"><span className="mk-step-ico"><IconPlay size={20} /></span><h3>Watch a short lesson</h3><p>Each lesson is a video with written notes beside it. Your place is saved, so you can stop and pick up on any device.</p></div>
              <div className="mk-step"><span className="mk-step-ico"><IconCode size={20} /></span><h3>Finish it and see progress</h3><p>Completed lessons fill your course progress bar, so you always know how much is left and what to open next.</p></div>
              <div className="mk-step"><span className="mk-step-ico"><IconTest size={20} /></span><h3>Take the timed test</h3><p>Tests are marked the moment you submit, with the right answer and an explanation for every question.</p></div>
            </div>
          </div>
        </section>

        <section className="mk-section alt" id="courses">
          <div className="mk-wrap">
            <div className="mk-head">
              <h2>What you can learn</h2>
              <p>Each course is a sequence of modules and lessons, with tests along the way.</p>
            </div>
            {levels.length > 2 && (
              <div className="mk-filter" role="group" aria-label="Filter by level">
                {levels.map((l) => <button key={l} className={level === l ? "on" : ""} onClick={() => setLevel(l)} aria-pressed={level === l}>{l === "all" ? "All levels" : l[0].toUpperCase() + l.slice(1)}</button>)}
              </div>
            )}
            <ul className="mk-courses">
              {courses === null && Array.from({ length: 3 }).map((_, i) => <li key={i} className="course-card"><div className="cover skeleton-cover" /><div className="course-body"><div className="skeleton"><span style={{ height: 18, width: "70%" }} /><span style={{ height: 12 }} /><span style={{ height: 12, width: "80%" }} /></div></div></li>)}
              {shown.map((c) => (
                <li key={c.id}>
                  <a href="#plans" className="course-card">
                    <CourseCover title={c.title} level={c.level} />
                    <div className="course-body"><h3>{c.title}</h3><p className="clamp">{c.description}</p></div>
                  </a>
                </li>
              ))}
            </ul>
            {courses?.length === 0 && <p className="muted">New courses are being added. Check back soon.</p>}
          </div>
        </section>

        <section className="mk-section" id="plans">
          <div className="mk-wrap">
            <div className="mk-head">
              <h2>Pay once, learn for the full validity</h2>
              <p>Prices exclude GST, which is added at checkout. Every payment comes with a GST invoice you can download.</p>
            </div>
            {plans?.length ? (
              <ul className="plan-grid">
                {plans.map((p) => <PlanCard key={p.id} plan={p} featured={featured === p.id} cta={<Link className={`btn btn-lg btn-block ${featured === p.id ? "btn-primary" : "btn-ghost"}`} to="/register">Get started</Link>} />)}
              </ul>
            ) : plans === null ? <div className="loading"><span className="spinner" /></div> : <p className="muted">Plans will be published soon.</p>}
          </div>
        </section>

        <section className="mk-section alt">
          <div className="mk-wrap mk-support">
            <div>
              <div className="mk-head" style={{ marginBottom: 0 }}>
                <h2>Stuck? Ask without leaving the course</h2>
                <p>Support is part of the product, not a separate inbox you have to hunt for.</p>
              </div>
              <ul className="mk-list">
                <li><IconBell size={18} /><span><strong>Replies show up live.</strong> When our team answers, it appears in your conversation straight away, and you get an email copy.</span></li>
                <li><IconPaperclip size={18} /><span><strong>Attach a screenshot.</strong> Show us exactly what you see instead of describing it.</span></li>
                <li><IconChat size={18} /><span><strong>Quick answers first.</strong> Common questions are suggested while you type, so simple problems are solved in seconds.</span></li>
              </ul>
            </div>
            <div className="chat-demo" aria-hidden="true">
              <header><strong>Payment deducted but course is locked</strong><span>Example conversation</span></header>
              <div className="bubble me">I paid through UPI an hour ago and my SQL course still shows as locked.<small>10:42</small></div>
              <div className="bubble them">Thanks for the details. I can see the payment was captured, and I am unlocking the course now.<small>10:47 · Support team</small></div>
              <div className="bubble them">All set. Please refresh the page. Reply here if anything is still missing.<small>10:48 · Support team</small></div>
            </div>
          </div>
        </section>

        {faqs?.length > 0 && (
          <section className="mk-section" id="faq">
            <div className="mk-wrap">
              <div className="mk-head"><h2>Common questions</h2></div>
              <div className="mk-faq"><Accordion items={faqs.slice(0, 6)} /></div>
            </div>
          </section>
        )}

        <section className="mk-final">
          <div className="mk-wrap">
            <div><h2>Start with your first lesson today.</h2><p>Creating an account takes a minute. You only pay when you pick a plan.</p></div>
            <div className="row gap wrap">
              <Link className="btn btn-primary btn-lg" to="/register">Create your account</Link>
              <Link className="btn btn-ghost btn-lg" to="/login">Sign in</Link>
            </div>
          </div>
        </section>
      </main>

      <footer className="mk-foot">
        <div className="mk-wrap">
          <div><Brand /><p>Practical IT training for college students, by IT DigiTech Solutions.</p></div>
          <div><h3>Learn</h3><ul><li><a href="#courses">Courses</a></li><li><a href="#plans">Plans</a></li><li><a href="#faq">Help</a></li></ul></div>
          <div><h3>Account</h3><ul><li><Link to="/login">Sign in</Link></li><li><Link to="/register">Create account</Link></li><li><Link to="/forgot-password">Forgot password</Link></li></ul></div>
          <div className="mk-legal">© {new Date().getFullYear()} IT DigiTech Solutions. All rights reserved.</div>
        </div>
      </footer>
    </div>
  );
}
