import { IconCheck } from "./Icons.jsx";

export const rupees = (n) => `₹${Number(n).toLocaleString("en-IN")}`;

// One pricing card, used on the public page and inside the app.
export default function PlanCard({ plan, featured, flag, cta }) {
  const gst = Number(plan.gst_percent ?? 18);
  return (
    <li className={`plan ${featured ? "featured" : ""}`}>
      {featured && <span className="plan-flag">{flag || "Most courses"}</span>}
      <div className="plan-top">
        <h3>{plan.name}</h3>
        <p className="plan-price"><strong>{rupees(plan.price)}</strong><span>+ {gst}% GST</span></p>
        <p className="plan-validity">{plan.validity_days ? `${plan.validity_days} days of access` : "Lifetime access"}</p>
      </div>
      <ul className="plan-includes" aria-label="Included courses">
        {plan.courses.map((c) => <li key={c.slug ?? c.title}><IconCheck size={16} strokeWidth={2.4} /> {c.title}</li>)}
        {plan.courses.length === 0 && <li><IconCheck size={16} strokeWidth={2.4} /> Courses added by your institute</li>}
      </ul>
      {cta}
    </li>
  );
}

// "Featured" = the plan that includes the most courses, when there is more than one plan.
export const featuredPlanId = (plans) => {
  if (!plans || plans.length < 2) return null;
  const best = [...plans].sort((a, b) => b.courses.length - a.courses.length)[0];
  return best.courses.length > Math.min(...plans.map((p) => p.courses.length)) ? best.id : null;
};
