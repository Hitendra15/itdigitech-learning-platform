import CrudPage from "../components/CrudPage.jsx";
import { StatusPill } from "../components/ui.jsx";
import { fmtDate, rupees } from "../api/client.js";
import { fromLocalInput, toLocalInput } from "../components/FormFields.jsx";

const PLAN_TYPES = [
  { value: "single", label: "Single course" }, { value: "combo", label: "Combo of courses" },
  { value: "all", label: "All courses" }, { value: "college", label: "College subscription" },
];

export function Orders() {
  return (
    <CrudPage title="Orders" lead="Every checkout, paid or not. Open an order to see its Razorpay payments." noun="order"
      endpoint="/admin-api/orders" allowCreate={false} allowEdit={false} allowDelete={false}
      searchPlaceholder="Search student, plan or Razorpay ID"
      filters={[{ name: "status", label: "Status", options: [{ value: "paid", label: "Paid" }, { value: "created", label: "Awaiting payment" }, { value: "failed", label: "Failed" }] }]}
      columns={[
        { key: "student", label: "Student" },
        { key: "plan_name", label: "Plan" },
        { key: "total", label: "Total", num: true, render: (o) => rupees(o.total) },
        { key: "status", label: "Status", render: (o) => <StatusPill value={o.status} /> },
        { key: "created_at", label: "Date", render: (o) => fmtDate(o.paid_at || o.created_at, true) },
      ]}
      detail={(o) => (
        <div className="stack">
          <dl className="kv-grid">
            <div><dt>Student</dt><dd>{o.student}</dd></div>
            <div><dt>Plan</dt><dd>{o.plan_name}</dd></div>
            <div><dt>Subtotal</dt><dd>{rupees(o.subtotal)}</dd></div>
            <div><dt>Discount{o.coupon_code ? ` (${o.coupon_code})` : ""}</dt><dd>{rupees(o.discount)}</dd></div>
            <div><dt>GST</dt><dd>{rupees(o.tax)}</dd></div>
            <div><dt>Total charged</dt><dd><strong>{rupees(o.total)}</strong></dd></div>
            <div><dt>Razorpay order</dt><dd className="mono small">{o.razorpay_order_id || "-"}</dd></div>
            <div><dt>Invoice</dt><dd>{o.invoice_number || "Not generated"}</dd></div>
          </dl>
          <h3 className="sub-h">Payments</h3>
          {o.payments.length ? (
            <div className="table-scroll"><table className="table table-flat"><thead><tr><th>Payment ID</th><th>Method</th><th>Status</th><th className="num">Amount</th><th>When</th></tr></thead>
              <tbody>{o.payments.map((p) => (
                <tr key={p.razorpay_payment_id}><td className="mono small" data-label="Payment ID">{p.razorpay_payment_id}</td><td className="cap" data-label="Method">{p.method || "-"}</td>
                  <td data-label="Status"><StatusPill value={p.status} />{p.error_description && <div className="muted small">{p.error_description}</div>}</td>
                  <td className="num" data-label="Amount">{rupees(p.amount)}</td><td data-label="When">{fmtDate(p.created_at, true)}</td></tr>
              ))}</tbody></table></div>
          ) : <p className="muted">No payment attempts yet.</p>}
        </div>
      )} />
  );
}

export function Plans() {
  return (
    <CrudPage title="Plans" lead="What students can buy. GST is added on top of the price at checkout." noun="plan" endpoint="/admin-api/plans"
      searchPlaceholder="Search plans" createLabel="New plan"
      filters={[{ name: "is_active", label: "Status", options: [{ value: "true", label: "Active" }, { value: "false", label: "Inactive" }] }]}
      columns={[
        { key: "name", label: "Plan", render: (p) => <div className="cell-stack"><strong>{p.name}</strong><span>{PLAN_TYPES.find((t) => t.value === p.plan_type)?.label}</span></div> },
        { key: "price", label: "Price", num: true, render: (p) => rupees(p.price) },
        { key: "gst_percent", label: "GST", num: true, render: (p) => `${Number(p.gst_percent)}%` },
        { key: "validity_days", label: "Validity", render: (p) => (p.validity_days ? `${p.validity_days} days` : "Lifetime") },
        { key: "courses", label: "Courses", render: (p) => (p.include_all_courses ? "All" : p.courses.length) },
        { key: "orders_count", label: "Orders", num: true },
        { key: "is_active", label: "Status", render: (p) => <StatusPill value={p.is_active ? "active" : "draft"} label={p.is_active ? "Active" : "Inactive"} /> },
      ]}
      fields={[
        { name: "name", label: "Plan name", required: true },
        { name: "plan_type", label: "Plan type", type: "select", options: PLAN_TYPES, required: true, default: "single" },
        { name: "price", label: "Price (₹, before GST)", type: "number", step: "0.01", min: 1, required: true },
        { name: "gst_percent", label: "GST %", type: "number", step: "0.01", min: 0, max: 100, required: true, default: 18 },
        { name: "validity_days", label: "Validity in days", type: "number", min: 1, help: "Leave empty for lifetime access." },
        { name: "include_all_courses", label: "Includes every course", type: "checkbox", help: "New courses are added to this plan automatically." },
        { name: "courses", label: "Courses included", type: "multiselect", span: 2, optionsFrom: { url: "/admin-api/courses", value: "id", label: "title" } },
        { name: "is_active", label: "Available to buy", type: "checkbox", span: 2, default: true },
      ]}
      toForm={(p) => ({ ...p, courses: (p.courses ?? []).map(String), validity_days: p.validity_days ?? "" })}
      toPayload={(v) => ({ ...v, validity_days: v.validity_days === "" ? null : v.validity_days })} />
  );
}

export function Coupons() {
  return (
    <CrudPage title="Coupons" lead="Discount codes students can enter at checkout." noun="coupon" endpoint="/admin-api/coupons"
      searchPlaceholder="Search codes" createLabel="New coupon"
      columns={[
        { key: "code", label: "Code", render: (c) => <strong className="mono">{c.code}</strong> },
        { key: "percent_off", label: "Discount", render: (c) => [Number(c.percent_off) ? `${Number(c.percent_off)}%` : null, Number(c.flat_off) ? rupees(c.flat_off) : null].filter(Boolean).join(" + ") },
        { key: "used_count", label: "Used", num: true, render: (c) => (c.max_uses ? `${c.used_count} / ${c.max_uses}` : c.used_count) },
        { key: "valid_to", label: "Valid until", render: (c) => (c.valid_to ? fmtDate(c.valid_to) : "No end date") },
        { key: "is_active", label: "Status", render: (c) => <StatusPill value={c.is_active ? "active" : "draft"} label={c.is_active ? "Active" : "Off"} /> },
      ]}
      fields={[
        { name: "code", label: "Code", required: true, help: "Stored in capitals, for example WELCOME20." },
        { name: "max_uses", label: "Maximum uses", type: "number", min: 1, help: "Leave empty for unlimited." },
        { name: "percent_off", label: "Percent off", type: "number", step: "0.01", min: 0, max: 100, required: true, default: 0 },
        { name: "flat_off", label: "Flat amount off (₹)", type: "number", step: "0.01", min: 0, required: true, default: 0 },
        { name: "valid_from", label: "Starts", type: "datetime" },
        { name: "valid_to", label: "Ends", type: "datetime" },
        { name: "is_active", label: "Active", type: "checkbox", span: 2, default: true },
      ]}
      toForm={(c) => ({ ...c, valid_from: toLocalInput(c.valid_from), valid_to: toLocalInput(c.valid_to), max_uses: c.max_uses ?? "" })}
      toPayload={(v) => ({ ...v, valid_from: fromLocalInput(v.valid_from), valid_to: fromLocalInput(v.valid_to), max_uses: v.max_uses === "" ? null : v.max_uses })} />
  );
}
