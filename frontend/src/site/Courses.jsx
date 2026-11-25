import { useMemo, useState } from "react";
import { Link } from "react-router-dom";
import { useDocumentTitle, useFetch } from "../hooks.js";
import { EmptyState, SearchBox, Skeleton } from "../components/ui.jsx";
import { CourseTile } from "./shared.jsx";
import { openChat } from "./config.js";

export default function Courses() {
  useDocumentTitle("Courses");
  const { data, loading } = useFetch("/courses");
  const [q, setQ] = useState("");
  const [level, setLevel] = useState("all");
  const levels = useMemo(() => ["all", ...new Set((data ?? []).map((c) => c.level))], [data]);
  const shown = (data ?? []).filter((c) => (level === "all" || c.level === level) && `${c.title} ${c.description}`.toLowerCase().includes(q.toLowerCase()));
  return (
    <>
      <section className="page-hero"><div className="site-wrap"><h1>Courses built around practice</h1><p>Every course mixes video lessons, hands-on coding, timed tests and a final certificate.</p></div></section>
      <section className="section">
        <div className="site-wrap">
          <div className="filters"><SearchBox value={q} onChange={setQ} placeholder="Search courses" />
            <div className="chips">{levels.map((l) => <button key={l} className={`chip-btn cap ${level === l ? "on" : ""}`} onClick={() => setLevel(l)}>{l}</button>)}</div></div>
          {loading ? <Skeleton lines={4} height={90} /> : shown.length === 0 ? (
            <EmptyState title="No courses match" action={<button className="btn btn-primary" onClick={openChat}>Ask us for a course</button>}>Try a different search, or tell us what you would like to learn.</EmptyState>
          ) : <ul className="c-grid">{shown.map((c) => <CourseTile key={c.id} c={c} />)}</ul>}
          <p className="center sec-more"><Link className="btn btn-ghost btn-lg" to="/pricing">See Plans and Pricing</Link></p>
        </div>
      </section>
    </>
  );
}
