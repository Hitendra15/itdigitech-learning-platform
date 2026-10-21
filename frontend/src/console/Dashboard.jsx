import { Link } from "react-router-dom";
import { useEffect } from "react";
import { useAuth } from "../auth/AuthContext.jsx";
import { useFetch, useDocumentTitle } from "../hooks.js";
import { rupees, timeAgo, fmtDate } from "../api/client.js";
import { Alert, PageHead, Skeleton, StatCard, StatusPill } from "../components/ui.jsx";
import { BarChart, HBars } from "../components/Charts.jsx";
import { useRealtimeEvent } from "../realtime/Realtime.jsx";

export default function Dashboard() {
  useDocumentTitle("Dashboard");
  const { user } = useAuth();
  const { data, loading, error, reload, refresh } = useFetch("/admin-api/dashboard");
  useRealtimeEvent((e) => { if (e.kind === "ticket_new" || e.kind === "ticket_update") refresh(); });
  useEffect(() => { const t = setInterval(refresh, 60000); return () => clearInterval(t); }, []); // eslint-disable-line

  const first = (user.profile?.full_name || "").split(" ")[0];
  if (error && !data) return <Alert>Could not load the dashboard. <button className="link-btn" onClick={() => reload()}>Try again</button></Alert>;
  if (loading && !data) return <div className="stack-lg"><PageHead title="Dashboard" /><div className="stat-grid">{[0, 1, 2, 3].map((i) => <div key={i} className="stat"><Skeleton lines={3} height={16} /></div>)}</div></div>;
  const t = data.totals;

  return (
    <div className="stack-lg">
      <PageHead title={first ? `Hello, ${first}` : "Dashboard"}
        lead={t.unanswered_tickets ? `${t.unanswered_tickets} support ${t.unanswered_tickets === 1 ? "request needs" : "requests need"} a reply.` : "Here is how the platform is doing."}
        actions={t.unanswered_tickets ? <Link className="btn btn-primary" to="/console/tickets">Open requests</Link> : null} />

      <div className="stat-grid">
        <StatCard label="Revenue, last 30 days" value={rupees(t.revenue_30d)} hint={`${rupees(t.revenue_total)} all time`} />
        <StatCard label="New students, last 30 days" value={t.new_students_30d} hint={`${t.students} students in total`} />
        <StatCard label="Paid students" value={t.active_students} hint={`${t.pending_orders} unpaid orders`} />
        <StatCard label="Open support requests" value={t.open_tickets} tone={t.unanswered_tickets ? "alert" : undefined} hint={`${t.unanswered_tickets} unanswered`} />
      </div>

      <div className="grid-2">
        <section className="panel"><div className="panel-head"><h2>Revenue</h2><span className="muted small">{rupees(data.revenue.reduce((s, d) => s + d.value, 0))} in 14 days</span></div>
          <BarChart data={data.revenue} format={rupees} label="Revenue per day" /></section>
        <section className="panel"><div className="panel-head"><h2>New sign-ups</h2><span className="muted small">{data.signups.reduce((s, d) => s + d.value, 0)} in 14 days</span></div>
          <BarChart data={data.signups} tone="teal" label="Sign-ups per day" /></section>
      </div>

      <div className="grid-2">
        <section className="panel"><div className="panel-head"><h2>Most popular courses</h2><Link to="/console/courses" className="link-btn small">All courses</Link></div>
          {data.top_courses.length ? <HBars rows={data.top_courses.map((c) => ({ label: c.title, value: c.enrolled }))} format={(v) => `${v} enrolled`} />
            : <p className="muted">Enrolments will appear here once students pay.</p>}</section>
        <section className="panel"><div className="panel-head"><h2>Latest requests</h2><Link to="/console/tickets" className="link-btn small">Inbox</Link></div>
          {data.recent_tickets.length ? (
            <ul className="mini-list">{data.recent_tickets.map((k) => (
              <li key={k.id}><Link to={`/console/tickets/${k.id}`}><strong>{k.subject}</strong><span>{k.reference} · {timeAgo(k.last_message_at)}</span></Link><StatusPill value={k.status} label={k.status_label} /></li>
            ))}</ul>
          ) : <p className="muted">No open requests. Nice.</p>}</section>
      </div>

      <section className="panel"><div className="panel-head"><h2>Recent orders</h2><Link to="/console/orders" className="link-btn small">All orders</Link></div>
        {data.recent_orders.length ? (
          <div className="table-scroll"><table className="table table-flat"><thead><tr><th>Student</th><th>Plan</th><th className="num">Total</th><th>Status</th><th>Date</th></tr></thead>
            <tbody>{data.recent_orders.map((o) => (
              <tr key={o.id}><td data-label="Student">{o.student}</td><td data-label="Plan">{o.plan_name}</td><td data-label="Total" className="num">{rupees(o.total)}</td>
                <td data-label="Status"><StatusPill value={o.status} /></td><td data-label="Date">{fmtDate(o.paid_at || o.created_at)}</td></tr>
            ))}</tbody></table></div>
        ) : <p className="muted">No orders yet.</p>}</section>
    </div>
  );
}
